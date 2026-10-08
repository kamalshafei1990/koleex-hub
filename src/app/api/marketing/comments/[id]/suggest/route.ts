import "server-only";

/* POST /api/marketing/comments/[id]/suggest — Koleex AI drafts replies to the
   comment's thread: {}. Internal accounts only (like every Koleex AI door),
   with "edit" on the account's space. Public text: KOLEEX only, no prices.
   Suggestions only — nothing is sent here; { fallback, reason } when the AI
   is not available or its answer could not be read. */

import { NextResponse } from "next/server";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { threadContext } from "@/lib/server/marketing/comments";
import { gateComment } from "@/lib/server/marketing/comment-gate";
import { suggestCommentReplies } from "@/lib/server/marketing/captions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* A drafted reply is short: two sentences, not the full reply limit. */
const SUGGESTION_MAX = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gateComment(req, id, "edit");
    if (g instanceof NextResponse) return g;
    const notInternal = requireInternalUser(g.auth);
    if (notInternal) return notInternal;
    const ctx = await threadContext(g.auth.tenant_id, g.comment);
    if (!ctx.messages.length) return NextResponse.json({ error: "There is nothing to answer in this thread." }, { status: 409 });
    return NextResponse.json(await suggestCommentReplies({ post: ctx.post, messages: ctx.messages, max: SUGGESTION_MAX }));
  } catch (e) {
    console.error("[api/marketing/comments/suggest]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not draft a reply." }, { status: 500 });
  }
}
