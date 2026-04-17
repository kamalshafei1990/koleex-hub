import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/calendar/events
   Returns events for a given account within [from, to).

   Calendar is a Type C (Personal) module: scope rules are hardcoded
   regardless of koleex_permissions scope setting.

   Access rules:
     - Must be authenticated + have "Calendar" module permission.
     - Viewing OWN calendar: allowed, returns all events (including private).
     - Viewing SOMEONE ELSE's calendar: only allowed for Super Admin.
     - Private events on another's calendar are hidden unless role has
       can_view_private (break-glass) — in which case they're included
       and the access is audit-logged.

   Query params:
     accountId   (required) — which account's calendar to view
     from        (required) — ISO timestamp; lower bound of window (gte end_at)
     to          (required) — ISO timestamp; upper bound of window (lt start_at)
*/

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Calendar");
  if (deny) return deny;

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!accountId || !from || !to) {
    return NextResponse.json(
      { error: "accountId, from, to are required" },
      { status: 400 },
    );
  }

  // Type C rule: only Super Admin can view someone else's calendar.
  const viewingOwn = accountId === auth.account_id;
  if (!viewingOwn && !auth.is_super_admin) {
    return NextResponse.json({ events: [] });
  }

  let query = supabaseServer
    .from("koleex_calendar_events")
    .select("*")
    .eq("account_id", accountId)
    .lt("start_at", to)
    .gte("end_at", from)
    .order("start_at", { ascending: true });

  // Multi-tenancy: event must belong to the viewer's tenant.
  if (auth.tenant_id) {
    query = query.eq("tenant_id", auth.tenant_id);
  }

  // Privacy: hide is_private on other's calendar unless break-glass.
  if (!viewingOwn && !auth.can_view_private) {
    query = query.eq("is_private", false);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[api/calendar/events]", error.message);
    return NextResponse.json(
      { error: "Failed to load events" },
      { status: 500 },
    );
  }

  // Audit break-glass private reads.
  if (!viewingOwn && auth.can_view_private) {
    const privateIds = (data ?? [])
      .filter((e) => (e as { is_private?: boolean }).is_private)
      .map((e) => (e as { id: string }).id);
    if (privateIds.length > 0) {
      // Fire-and-forget — match the behaviour of logPrivateAccess in scope.ts.
      void supabaseServer.from("koleex_private_access_log").insert(
        privateIds.map((id) => ({
          account_id: auth.account_id,
          role_id: auth.role_id,
          module_name: "Calendar",
          record_type: "koleex_calendar_events",
          record_id: id,
          access_reason: null,
        })),
      );
    }
  }

  return NextResponse.json({ events: data ?? [] });
}

/* POST /api/calendar/events — create a new event.
   Body must set account_id. Type C rule: non-SA can only create events
   on their OWN calendar. Server enforces tenant_id from the session. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Calendar");
  if (deny) return deny;

  const body = (await req.json()) as Record<string, unknown>;
  const targetAccountId = (body.account_id as string) || auth.account_id;

  if (targetAccountId !== auth.account_id && !auth.is_super_admin) {
    return NextResponse.json(
      { error: "Cannot create events on another account's calendar" },
      { status: 403 },
    );
  }

  const row = {
    ...body,
    account_id: targetAccountId,
    tenant_id: auth.tenant_id, // server-side truth
  };

  const { data, error } = await supabaseServer
    .from("koleex_calendar_events")
    .insert(row)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[api/calendar/events POST]", error.message);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 },
    );
  }
  return NextResponse.json({ event: data });
}
