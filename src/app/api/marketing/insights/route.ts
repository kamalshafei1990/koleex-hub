import "server-only";

/* GET /api/marketing/insights?space=&period=7|28|90&account= — each
   connected Facebook Page's and Instagram account's numbers for the period
   (Meta's days, ending yesterday) against the period before, and day by
   day. Needs "view". */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { loadInsights } from "@/lib/server/marketing/insights";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";
import { asPeriod } from "@/lib/marketing/insights";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const params = req.nextUrl.searchParams;
  const space = asSpace(params.get("space"));
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  const account = params.get("account");
  try {
    const data = await loadInsights(auth.tenant_id, space, asPeriod(params.get("period")), account && UUID_RE.test(account) ? account : null);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/insights GET]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the insights." }, { status: 500 });
  }
}
