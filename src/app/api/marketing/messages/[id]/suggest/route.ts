import "server-only";

/* POST /api/marketing/messages/[id]/suggest — Koleex AI drafts answers to
   the conversation: {}. Internal accounts only (like every Koleex AI door),
   with "edit" on the conversation's space. Public text: KOLEEX only, no
   prices. Suggestions only — nothing is sent here; { fallback, reason } when
   the AI is not available or its answer could not be read. */

import { NextResponse } from "next/server";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { conversationContext } from "@/lib/server/marketing/messages";
import { gateConversation } from "@/lib/server/marketing/message-gate";
import { suggestMessageReplies } from "@/lib/server/marketing/captions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUGGESTION_MAX = 400;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gateConversation(req, id, "edit");
    if (g instanceof NextResponse) return g;
    const notInternal = requireInternalUser(g.auth);
    if (notInternal) return notInternal;
    const messages = await conversationContext(g.conversation);
    if (!messages.some((m) => !m.ours)) return NextResponse.json({ error: "There is nothing to answer in this conversation." }, { status: 409 });
    return NextResponse.json(await suggestMessageReplies({ messages, max: SUGGESTION_MAX }));
  } catch (e) {
    console.error("[api/marketing/messages/suggest]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not draft an answer." }, { status: 500 });
  }
}
