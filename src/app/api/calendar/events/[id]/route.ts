import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import {
  canReadEvent,
  eventAttendeeIds,
  isEventOwner,
  isUuid,
  loadCalendarEvent,
  sanitizeEventInput,
} from "@/lib/server/calendar-access";
import { clearEventNotifications, notifyEventChanged } from "@/lib/server/calendar-notify";

/* /api/calendar/events/[id]
   One event. The caller's tenant is part of every load, so a cross-tenant or
   malformed id is a 404 rather than a leak of its existence.

     GET    — the owner, a Super Admin, or an INVITED guest (the guest needs
              the base row to open a recurring occurrence and to answer the
              invitation; the old 403 broke both).
     PATCH  — the owner or a Super Admin. Only the writable columns are
              accepted; a time change re-arms the reminder and tells guests.
     DELETE — the owner or a Super Admin. Guests hear it was cancelled and
              every unread notification about the event is closed. */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Calendar");
  if (deny) return deny;

  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let q = supabaseServer.from("koleex_calendar_events").select("*").eq("id", id);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error } = await q.maybeSingle();
  if (error) {
    console.error("[api/calendar/events GET one]", error.message);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
  const ev = data as { id: string; account_id: string } | null;
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const actor = { accountId: auth.account_id, isSuperAdmin: auth.is_super_admin };
  if (!(await canReadEvent(ev, actor))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ event: { ...ev, invited: !isEventOwner(ev, actor) } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Calendar", "edit");
  if (deny) return deny;

  const existing = await loadCalendarEvent(id, auth.tenant_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isEventOwner(existing, { accountId: auth.account_id, isSuperAdmin: auth.is_super_admin })) {
    return NextResponse.json({ error: "Cannot edit another account's event" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  const input = sanitizeEventInput(body, "update", existing);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  if (Object.keys(input.row).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("koleex_calendar_events")
    .update(input.row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[api/calendar/events PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  if (input.timeChanged) {
    const guests = await eventAttendeeIds(id, { excludeDeclined: true });
    await notifyEventChanged({ ...existing, ...(data as object) } as typeof existing, guests, auth.account_id, "rescheduled");
  }
  return NextResponse.json({ event: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Calendar", "delete");
  if (deny) return deny;

  const existing = await loadCalendarEvent(id, auth.tenant_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isEventOwner(existing, { accountId: auth.account_id, isSuperAdmin: auth.is_super_admin })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  /* Read the guest list BEFORE the delete — the attendee rows cascade away. */
  const guests = await eventAttendeeIds(id, { excludeDeclined: true });

  const { error } = await supabaseServer.from("koleex_calendar_events").delete().eq("id", id);
  if (error) {
    console.error("[api/calendar/events DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  await clearEventNotifications(id);
  await notifyEventChanged(existing, guests, auth.account_id, "cancelled");
  return NextResponse.json({ ok: true });
}
