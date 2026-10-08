import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { PLANNING_ERR } from "@/lib/server/planning-access";
import { copyLastWeek } from "@/lib/server/planning-week";
import { parseWeekBody } from "@/lib/server/planning-week-body";

/* POST /api/planning/week/copy — copy the previous week's items into the
   week starting at `week_start`, as drafts, skipping duplicates.
   Body: { week_start: ISO, resource_ids?: uuid[], include_open?: boolean,
           tz?: IANA zone, preview?: boolean }
   preview:true answers { count, skipped } and writes nothing. Only rows the
   caller may edit are copied (super admin: all). See lib/server/planning-week. */

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "create");
  if (deny) return deny;

  const parsed = parseWeekBody(await req.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: PLANNING_ERR[400] }, { status: 400 });

  try {
    const r = await copyLastWeek(auth, parsed.scope, parsed.preview);
    return NextResponse.json({ count: r.count, skipped: r.skipped, items: r.created });
  } catch (e) {
    console.error("[api/planning/week/copy]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
  }
}
