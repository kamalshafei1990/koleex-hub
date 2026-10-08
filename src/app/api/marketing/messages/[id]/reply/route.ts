import "server-only";

/* POST /api/marketing/messages/[id]/reply — answer the customer as the
   account: { message }. "edit" on the conversation's space (customer
   service, no approval), inside Meta's 24-hour window. Sent once even when
   asked twice; Meta's refusal comes back in plain words. */

import { NextResponse } from "next/server";
import { isError, replyToConversation } from "@/lib/server/marketing/messages";
import { gateConversation } from "@/lib/server/marketing/message-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gateConversation(req, id, "edit");
    if (g instanceof NextResponse) return g;
    const body = (await req.json().catch(() => ({}))) as { message?: unknown };
    const r = await replyToConversation(g.auth.tenant_id, g.conversation.id, g.auth.account_id, typeof body.message === "string" ? body.message : "");
    if (isError(r)) return NextResponse.json({ error: r.error, code: r.code ?? null }, { status: r.status });
    return NextResponse.json(r);
  } catch (e) {
    console.error("[api/marketing/messages/reply]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not send the message." }, { status: 500 });
  }
}
