import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { sanitizeEventInput } from "@/lib/server/calendar-access";
import { feedWindow, loadCalendarFeed } from "@/lib/server/calendar-feed";

/* GET /api/calendar/events?accountId=&from=&to=
   One account's calendar within [from, to): its own events, the occurrences
   of its recurring series, the events it is invited to, and read-only
   mirrors of Planning, To-do, Projects, approved leave and report
   deadlines — all loaded by lib/server/calendar-feed.ts, which the AI
   agent's listMyCalendar reads too.

   Calendar is a Type C (personal) module: only the account itself or a
   Super Admin may read it, whatever the role's Scope says. Private events on
   someone else's calendar are hidden unless the role has can_view_private
   (break-glass), in which case the read is audit-logged. */

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
    return NextResponse.json({ error: "accountId, from, to are required" }, { status: 400 });
  }
  const winFrom = new Date(from);
  const winTo = new Date(to);
  if (Number.isNaN(winFrom.getTime()) || Number.isNaN(winTo.getTime()) || winTo <= winFrom) {
    return NextResponse.json({ error: "from/to must be ISO timestamps with from < to" }, { status: 400 });
  }
  /* A window bounded to a quarter keeps the series expansion and the mirror
     scans proportional to what a screen can show. */
  if (winTo.getTime() - winFrom.getTime() > 93 * 86_400_000) {
    return NextResponse.json({ error: "window too large" }, { status: 400 });
  }

  const viewingOwn = accountId === auth.account_id;
  if (!viewingOwn && !auth.is_super_admin) {
    return NextResponse.json({ error: "Only a Super Admin can view another account's calendar" }, { status: 403 });
  }

  try {
    const events = await loadCalendarFeed(auth, accountId, feedWindow(winFrom, winTo));
    return NextResponse.json({ events });
  } catch (e) {
    console.error("[api/calendar/events]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

/* POST /api/calendar/events — create an event. Non-SA callers create only on
   their OWN calendar; tenant_id and the server-managed columns come from the
   session, never the body. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Calendar", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const targetAccountId = typeof body.account_id === "string" && body.account_id ? body.account_id : auth.account_id;
  if (targetAccountId !== auth.account_id && !auth.is_super_admin) {
    return NextResponse.json({ error: "Cannot create events on another account's calendar" }, { status: 403 });
  }

  const input = sanitizeEventInput(body, "create");
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("koleex_calendar_events")
    .insert({ ...input.row, account_id: targetAccountId, tenant_id: auth.tenant_id })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[api/calendar/events POST]", error.message);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
  return NextResponse.json({ event: data });
}
