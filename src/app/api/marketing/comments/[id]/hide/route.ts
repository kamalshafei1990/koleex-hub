import "server-only";

/* POST /api/marketing/comments/[id]/hide — hide a comment on its platform,
   or show it again: { hidden: boolean }. Approvers only (owner, 28/09/2026):
   the super admins and the roles given «Social Marketing Approvals». */

import { NextResponse } from "next/server";
import { isError, setCommentHidden } from "@/lib/server/marketing/comments";
import { gateComment } from "@/lib/server/marketing/comment-gate";
import { notApprover } from "@/lib/server/marketing/post-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gateComment(req, id, "edit");
    if (g instanceof NextResponse) return g;
    if (!g.approver) return notApprover();
    const body = (await req.json().catch(() => ({}))) as { hidden?: unknown };
    if (typeof body.hidden !== "boolean") return NextResponse.json({ error: "Say whether to hide it." }, { status: 400 });
    const r = await setCommentHidden(g.auth.tenant_id, g.comment.id, body.hidden);
    if (isError(r)) return NextResponse.json({ error: r.error, code: r.code ?? null }, { status: r.status });
    return NextResponse.json({ ok: true, hidden: body.hidden });
  } catch (e) {
    console.error("[api/marketing/comments/hide]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not change the comment." }, { status: 500 });
  }
}
