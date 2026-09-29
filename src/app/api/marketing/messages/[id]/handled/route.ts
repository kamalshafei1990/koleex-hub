import "server-only";

/* POST /api/marketing/messages/[id]/handled — «No reply needed», or waiting
   again: { handled }. "edit" on the conversation's space. */

import { NextResponse } from "next/server";
import { isError, setConversationHandled } from "@/lib/server/marketing/messages";
import { gateConversation } from "@/lib/server/marketing/message-gate";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gateConversation(req, id, "edit");
    if (g instanceof NextResponse) return g;
    const body = (await req.json().catch(() => ({}))) as { handled?: unknown };
    if (typeof body.handled !== "boolean") return NextResponse.json({ error: "Say whether it needs a reply." }, { status: 400 });
    const r = await setConversationHandled(g.auth.tenant_id, g.conversation.id, body.handled, g.auth.account_id);
    if (isError(r)) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r);
  } catch (e) {
    console.error("[api/marketing/messages/handled]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }
}
