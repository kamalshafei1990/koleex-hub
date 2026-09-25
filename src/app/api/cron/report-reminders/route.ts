import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/cron/report-reminders  (every 15 minutes)
   Reports Phase 3B (owner's rule, 25 Sep 2026): an hour before a report's
   deadline its author is reminded; if it is still missing, their manager is
   told — the daily 2 hours after the deadline, the weekly and monthly at the
   end of the next working day. src/lib/server/reports/nudges.ts does it;
   each nudge is claimed in a ledger before it is sent, so a second run (or a
   stranger calling this URL while CRON_SECRET is unset) sends nothing twice.

   Phase 3D runs first in the same job: the reports EVENTS ask for (leave,
   a finished customer meeting or visit, a late or absent day, a probation
   ending) are created once and announced (src/lib/server/reports/events.ts),
   so one asked for now can already be reminded in this run.

   The answer carries counts only — never a name.

   ?dry=1 — a SUPER ADMIN's preview of who would be told what right now,
   from their own signed-in session; nothing is claimed or sent.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { runReportNudges } from "@/lib/server/reports/nudges";
import { runReportEvents } from "@/lib/server/reports/events";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("dry") === "1") {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const [events, nudges] = await Promise.all([
      runReportEvents({ dryRun: true, tenantId: auth.tenant_id }),
      runReportNudges({ dryRun: true, tenantId: auth.tenant_id }),
    ]);
    return NextResponse.json({ ...nudges, events }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const events = await runReportEvents();
  const run = await runReportNudges();
  return NextResponse.json({ ok: true, tenants: run.tenants, reminders: run.reminders, escalations: run.escalations, asked: events.created, cancelled: events.cancelled }, { headers: { "Cache-Control": "no-store" } });
}
