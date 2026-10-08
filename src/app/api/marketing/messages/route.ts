import "server-only";

/* GET /api/marketing/messages?space=&filter=needs|all&account=&cursor= — the
   customers' private conversations on the space's Page and Instagram
   account, newest first, with how many wait for an answer. Needs "view";
   canReply says whether the reader may answer ("edit"). */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { listConversations } from "@/lib/server/marketing/messages";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

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
  const cursor = Math.max(0, Math.floor(Number(params.get("cursor")) || 0));
  try {
    const [list, cannotReply] = await Promise.all([
      listConversations(auth.tenant_id, space, { filter: params.get("filter") === "all" ? "all" : "needs", accountId: account && UUID_RE.test(account) ? account : null, cursor }),
      requireModuleAction(auth, SPACE_MODULE[space], "edit"),
    ]);
    return NextResponse.json({ ...list, canReply: cannotReply === null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/messages GET]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the messages." }, { status: 500 });
  }
}
