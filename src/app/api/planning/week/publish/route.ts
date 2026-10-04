import "server-only";

import { NextResponse, after } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { PLANNING_ERR } from "@/lib/server/planning-access";
import { publishWeek } from "@/lib/server/planning-week";
import { parseWeekBody } from "@/lib/server/planning-week-body";

/* POST /api/planning/week/publish — publish every draft in the week the
   caller may edit, then send ONE grouped notice per person (after the
   response). Body as /week/copy. preview:true answers { count, people }. */

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "edit");
  if (deny) return deny;

  const parsed = parseWeekBody(await req.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: PLANNING_ERR[400] }, { status: 400 });

  try {
    const r = await publishWeek(auth, parsed.scope, parsed.preview, (fn) => after(fn));
    return NextResponse.json({ count: r.count, people: r.people, items: r.published });
  } catch (e) {
    console.error("[api/planning/week/publish]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
  }
}
