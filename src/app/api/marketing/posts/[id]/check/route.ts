import "server-only";

/* POST /api/marketing/posts/[id]/check — Koleex AI reads a CEO Brand post
   against the JD's not-allowed content again (lib/server/marketing/
   content-check) — when the check failed, or the post changed after it.
   "edit"; the author or an approver; CEO Brand posts only. Answers the new
   check, or 409 "busy" while another run holds it. */

import { NextResponse } from "next/server";
import { runContentCheck } from "@/lib/server/marketing/content-check";
import { gatePost } from "@/lib/server/marketing/post-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gatePost(req, id, "edit");
    if (g instanceof NextResponse) return g;
    if (g.post.space !== "ceo") return NextResponse.json({ error: "Only CEO Brand posts are checked." }, { status: 400 });
    if (g.post.created_by !== g.auth.account_id && !g.approver && !g.post.shared) {
      return NextResponse.json({ error: "Only the author or an approver can check this post." }, { status: 403 });
    }
    const out = await runContentCheck(g.auth.tenant_id, id);
    if (out === "busy") return NextResponse.json({ error: "Koleex AI is already checking this post.", code: "busy" }, { status: 409 });
    if (!out) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    return NextResponse.json({ content_check: out });
  } catch (e) {
    console.error("[api/marketing/posts/check]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not check the post." }, { status: 500 });
  }
}
