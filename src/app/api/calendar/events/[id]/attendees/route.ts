import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { sendPushToAccounts } from "@/lib/server/web-push";

/* Attendees of a calendar event.
     GET  → list { attendees: [{ account_id, status, account:{...} }] }
     PUT  → replace the whole attendee set { accountIds: string[] }

   Only the event OWNER (account_id) or a Super Admin may change attendees.
   Newly-added people are notified via inbox + web-push. */

const EVENTS = "koleex_calendar_events";
const ATTENDEES = "koleex_calendar_event_attendees";

async function ownedEvent(id: string, tenantId: string | null) {
  let q = supabaseServer.from(EVENTS).select("id, account_id, title, start_at, tenant_id").eq("id", id);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  return data as
    | { id: string; account_id: string; title: string; start_at: string; tenant_id: string | null }
    | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Calendar");
  if (deny) return deny;

  const ev = await ownedEvent(id, auth.tenant_id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: rows } = await supabaseServer
    .from(ATTENDEES)
    .select("account_id, status")
    .eq("event_id", id);
  const list = (rows ?? []) as Array<{ account_id: string; status: string }>;

  // Manual name join — account_id has no FK to accounts, so resolve names in one round-trip.
  const ids = list.map((r) => r.account_id);
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: accts } = await supabaseServer
      .from("accounts")
      .select("id, username, person:people ( full_name )")
      .in("id", ids);
    for (const a of (accts ?? []) as Array<{ id: string; username: string | null; person: { full_name: string | null } | { full_name: string | null }[] | null }>) {
      const p = Array.isArray(a.person) ? a.person[0] : a.person;
      nameById.set(a.id, p?.full_name || a.username || "Someone");
    }
  }

  return NextResponse.json({
    attendees: list.map((r) => ({ account_id: r.account_id, status: r.status, name: nameById.get(r.account_id) ?? "Someone" })),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Calendar");
  if (deny) return deny;

  const ev = await ownedEvent(id, auth.tenant_id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ev.account_id !== auth.account_id && !auth.is_super_admin) {
    return NextResponse.json({ error: "Only the organizer can manage attendees" }, { status: 403 });
  }

  const body = (await req.json()) as { accountIds?: unknown };
  const wanted = Array.from(
    new Set(
      (Array.isArray(body.accountIds) ? body.accountIds : [])
        .filter((x): x is string => typeof x === "string" && !!x)
        // The organizer is implicitly on their own event — never store them as a guest.
        .filter((x) => x !== ev.account_id),
    ),
  ).slice(0, 100);

  const { data: current } = await supabaseServer
    .from(ATTENDEES)
    .select("account_id")
    .eq("event_id", id);
  const currentIds = new Set((current ?? []).map((r) => (r as { account_id: string }).account_id));
  const wantedSet = new Set(wanted);

  const toAdd = wanted.filter((a) => !currentIds.has(a));
  const toRemove = [...currentIds].filter((a) => !wantedSet.has(a));

  if (toRemove.length) {
    await supabaseServer.from(ATTENDEES).delete().eq("event_id", id).in("account_id", toRemove);
  }
  if (toAdd.length) {
    await supabaseServer.from(ATTENDEES).insert(
      toAdd.map((account_id) => ({
        event_id: id,
        account_id,
        status: "invited",
        tenant_id: ev.tenant_id,
      })),
    );

    // Notify the newly invited — inbox + push (best-effort, never fails the write).
    const when = new Date(ev.start_at).toLocaleString();
    await supabaseServer.from("inbox_messages").insert(
      toAdd.map((rid) => ({
        recipient_account_id: rid,
        sender_account_id: auth.account_id,
        category: "calendar",
        subject: `📅 Invitation: ${ev.title}`,
        body: `You've been invited to "${ev.title}" on ${when}.`,
        link: `/calendar`,
        metadata: { type: "calendar_invite", event_id: id },
      })),
    );
    await sendPushToAccounts(toAdd, {
      title: `📅 ${ev.title}`,
      body: `You're invited — ${when}`,
      url: "/calendar",
      tag: `calendar-invite-${id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, count: wanted.length });
}
