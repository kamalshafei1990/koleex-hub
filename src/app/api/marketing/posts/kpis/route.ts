import "server-only";

/* GET /api/marketing/posts/kpis?space=ceo — CEO Brand's KPIs from the JD:
   this week's posts against 3, this month's approved posts against 12
   (Shanghai time; lib/server/marketing/posts ceoKpis). "view" on CEO Brand.
   Social Marketing has no such targets. */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { ceoKpis } from "@/lib/server/marketing/posts";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const space = asSpace(req.nextUrl.searchParams.get("space"));
  if (space !== "ceo") return NextResponse.json({ error: "Only CEO Brand has these targets." }, { status: 400 });
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  try {
    return NextResponse.json(await ceoKpis(auth.tenant_id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/posts/kpis]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the targets." }, { status: 500 });
  }
}
