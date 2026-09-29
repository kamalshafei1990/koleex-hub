import "server-only";

/* GET /api/marketing/messages/[id] — one conversation and its newest
   messages, oldest first. "view" on the conversation's space. */

import { NextResponse } from "next/server";
import { conversationDetail } from "@/lib/server/marketing/messages";
import { gateConversation } from "@/lib/server/marketing/message-gate";
import { requireModuleAction } from "@/lib/server/auth";
import { SPACE_MODULE } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gateConversation(req, id, "view");
    if (g instanceof NextResponse) return g;
    const [detail, cannotReply] = await Promise.all([
      conversationDetail(g.auth.tenant_id, g.conversation),
      requireModuleAction(g.auth, SPACE_MODULE[g.conversation.space], "edit"),
    ]);
    return NextResponse.json({ ...detail, canReply: cannotReply === null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/messages/[id] GET]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the conversation." }, { status: 500 });
  }
}
