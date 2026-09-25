import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { canReadEvent, isEventOwner, loadCalendarEvent } from "@/lib/server/calendar-access";
import { notifyInvited, notifyRsvp, withdrawInvites } from "@/lib/server/calendar-notify";
import { internalAccountIds } from "@/lib/server/internal-accounts";
import { isCalendarAttendeeStatus } from "@/lib/calendar-enums";

/* Guests of a calendar event.
     GET   → { attendees: [{ account_id, status, name }] }
             for the organizer, a guest of the event, or a Super Admin under
             the calendar's private-record rule (someone else's private event
             needs can_view_private, logged). `name` is null when the account
             has none — the client words the fallback in its language.
     PUT   → { accountIds: string[] } replaces the whole guest list.
             Organizer or Super Admin, with the Calendar "edit" action.
             Guests are ACTIVE INTERNAL accounts of the tenant, never the
             organizer. The newly added are invited; the removed have their
             unread invitation withdrawn.
     PATCH → { status: "accepted" | "declined" } — the caller answers their
             OWN invitation; the organizer is told. */

const ATTENDEES = "koleex_calendar_event_attendees";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Calendar");
  if (deny) return deny;

  const ev = await loadCalendarEvent(id, auth.tenant_id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canReadEvent(ev, auth))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows } = await supabaseServer.from(ATTENDEES).select("account_id, status").eq("event_id", id);
  const list = (rows ?? []) as Array<{ account_id: string; status: string }>;

  /* account_id has no FK to accounts — resolve names in one round trip. */
  const nameById = new Map<string, string | null>();
  if (list.length) {
    const { data: accts } = await supabaseServer
      .from("accounts")
      .select("id, username, person:people ( full_name )")
      .in("id", list.map((r) => r.account_id));
    for (const a of (accts ?? []) as Array<{ id: string; username: string | null; person: { full_name: string | null } | { full_name: string | null }[] | null }>) {
      const p = Array.isArray(a.person) ? a.person[0] : a.person;
      nameById.set(a.id, p?.full_name || a.username || null);
    }
  }

  return NextResponse.json({
    attendees: list.map((r) => ({ account_id: r.account_id, status: r.status, name: nameById.get(r.account_id) ?? null })),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Calendar", "edit");
  if (deny) return deny;

  const ev = await loadCalendarEvent(id, auth.tenant_id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isEventOwner(ev, { accountId: auth.account_id, isSuperAdmin: auth.is_super_admin })) {
    return NextResponse.json({ error: "Only the organizer can manage attendees" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { accountIds?: unknown } | null;
  if (!body || !Array.isArray(body.accountIds)) {
    return NextResponse.json({ error: "accountIds must be an array" }, { status: 400 });
  }
  const requested = body.accountIds
    .filter((x): x is string => typeof x === "string" && !!x)
    .filter((x) => x !== ev.account_id) // the organizer is never their own guest
    .slice(0, 100);
  const wanted = await internalAccountIds(requested, ev.tenant_id);

  const { data: current } = await supabaseServer.from(ATTENDEES).select("account_id").eq("event_id", id);
  const currentIds = new Set((current ?? []).map((r) => (r as { account_id: string }).account_id));
  const wantedSet = new Set(wanted);
  const toAdd = wanted.filter((a) => !currentIds.has(a));
  const toRemove = [...currentIds].filter((a) => !wantedSet.has(a));

  if (toRemove.length) {
    const { error } = await supabaseServer.from(ATTENDEES).delete().eq("event_id", id).in("account_id", toRemove);
    if (error) return NextResponse.json({ error: "Failed to update attendees" }, { status: 500 });
    await withdrawInvites(id, toRemove);
  }
  if (toAdd.length) {
    const { error } = await supabaseServer.from(ATTENDEES).insert(
      toAdd.map((account_id) => ({ event_id: id, account_id, status: "invited", tenant_id: ev.tenant_id })),
    );
    if (error) return NextResponse.json({ error: "Failed to update attendees" }, { status: 500 });
    await notifyInvited(ev, toAdd, auth.account_id);
  }

  return NextResponse.json({ ok: true, count: wanted.length, added: toAdd.length, removed: toRemove.length });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Calendar");
  if (deny) return deny;

  const ev = await loadCalendarEvent(id, auth.tenant_id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  const status = body?.status;
  if (!isCalendarAttendeeStatus(status) || status === "invited") {
    return NextResponse.json({ error: "status must be accepted or declined" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from(ATTENDEES)
    .update({ status })
    .eq("event_id", id)
    .eq("account_id", auth.account_id)
    .select("account_id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to respond" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "You are not on this event's guest list" }, { status: 404 });

  const { data: me } = await supabaseServer
    .from("accounts").select("username, person:people ( full_name )").eq("id", auth.account_id).maybeSingle();
  const person = (me as { username?: string | null; person?: { full_name?: string | null } | { full_name?: string | null }[] | null } | null);
  const p = Array.isArray(person?.person) ? person?.person[0] : person?.person;
  await notifyRsvp(ev, auth.account_id, p?.full_name || person?.username || auth.username || "A colleague", status);

  return NextResponse.json({ ok: true, status });
}
