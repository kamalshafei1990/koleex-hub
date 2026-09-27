import "server-only";

/* GET /api/marketing/calendar?space=&from=YYYY-MM-DD&to=YYYY-MM-DD — the
   posts of a range of Shanghai days (at most six weeks): the Hub's posts
   with a time or published in it, and the posts published on the space's
   accounts outside the Hub. Needs "view". */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { calendarRange, loadCalendar } from "@/lib/server/marketing/calendar";
import { canApprovePosts } from "@/lib/server/marketing/approvals";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const params = req.nextUrl.searchParams;
  const space = asSpace(params.get("space"));
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  const range = calendarRange(params.get("from") ?? "", params.get("to") ?? "");
  if (!range) return NextResponse.json({ error: "Choose a range of up to six weeks." }, { status: 400 });
  try {
    const [items, canApprove, cannotCreate] = await Promise.all([
      loadCalendar(auth.tenant_id, space, range),
      canApprovePosts(auth, space),
      requireModuleAction(auth, SPACE_MODULE[space], "create"),
    ]);
    return NextResponse.json({ items, canApprove, canCreate: cannotCreate === null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/calendar]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the calendar." }, { status: 500 });
  }
}
