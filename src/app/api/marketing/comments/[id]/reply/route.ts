import "server-only";

/* POST /api/marketing/comments/[id]/reply — reply to a comment as the
   account: { message }. "edit" on the account's space (owner, 28/09/2026:
   replies are customer service, no approval). Sent once even when asked
   twice; Meta's refusal comes back in its own words. */

import { NextResponse } from "next/server";
import { isError, replyToComment } from "@/lib/server/marketing/comments";
import { gateComment } from "@/lib/server/marketing/comment-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gateComment(req, id, "edit");
    if (g instanceof NextResponse) return g;
    const body = (await req.json().catch(() => ({}))) as { message?: unknown };
    const r = await replyToComment(g.auth.tenant_id, g.comment.id, g.auth.account_id, typeof body.message === "string" ? body.message : "");
    if (isError(r)) return NextResponse.json({ error: r.error, code: r.code ?? null }, { status: r.status });
    return NextResponse.json(r);
  } catch (e) {
    console.error("[api/marketing/comments/reply]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not send the reply." }, { status: 500 });
  }
}
