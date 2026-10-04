import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/work-reports/obligations/preview?from=YYYY-MM-DD — the launch
   preview (owner's pick 26/09/2026, «نشغّل التقارير فعلًا»): a week from
   that day as the reminder job would run it, person by person — each report
   due, the reminder, who hears of a missing one and when, the days off.

   The same door as who-writes-what (a super admin or HR·edit): it names
   everyone who owes a report and their managers. Reads only — nothing is
   claimed, stored or sent (src/lib/server/reports/launch.ts).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireReportsUser } from "@/lib/server/reports/core";
import { canSetUp } from "@/lib/server/reports/obligations";
import { loadLaunchPlan } from "@/lib/server/reports/launch";

export const dynamic = "force-dynamic";

const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  if (!(await canSetUp(auth))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const from = new URL(req.url).searchParams.get("from");
  if (!isDay(from)) return NextResponse.json({ error: "bad_date" }, { status: 400 });
  return NextResponse.json(await loadLaunchPlan(auth, from), { headers: { "Cache-Control": "private, no-store" } });
}
