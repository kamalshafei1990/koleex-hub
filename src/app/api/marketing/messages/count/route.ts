import "server-only";

/* GET /api/marketing/messages/count?space= — how many conversations wait for
   an answer (the Messages tab's number). Needs "view". */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { needsMessagesCount } from "@/lib/server/marketing/messages";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const space = asSpace(req.nextUrl.searchParams.get("space"));
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  try {
    return NextResponse.json({ needs: await needsMessagesCount(auth.tenant_id, space) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/messages/count]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not count the messages." }, { status: 500 });
  }
}
