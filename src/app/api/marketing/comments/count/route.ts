import "server-only";

/* GET /api/marketing/comments/count?space= — how many comment threads wait
   for a reply: the number on the Comments tab. Needs "view". */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { needsReplyCount } from "@/lib/server/marketing/comments";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const space = asSpace(req.nextUrl.searchParams.get("space"));
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  try {
    return NextResponse.json({ needs: await needsReplyCount(auth.tenant_id, space) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/comments/count]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not count the comments." }, { status: 500 });
  }
}
