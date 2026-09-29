import "server-only";

/* POST /api/marketing/posts/[id]/submit — send a draft (or a post sent back)
   for approval: { version, confirmed? }. "edit"; the author or an approver
   (or any CEO Brand writer, for a quick capture — a shared draft).
   Refused with the reasons (422) while the post cannot go to one of its
   accounts. A CEO Brand post also needs `confirmed: true` — its sender
   confirms it shows none of the JD's not-allowed content (400 "confirm").
   After the response the approvers are asked (marketing/notify) and, for a
   CEO Brand post, Koleex AI reads it against that list (content-check). */

import { after, NextResponse } from "next/server";
import { isError, submitPost } from "@/lib/server/marketing/posts";
import { notifyPostSubmitted } from "@/lib/server/marketing/notify";
import { checkPostContent } from "@/lib/server/marketing/content-check";
import { gatePost, readVersion, reply } from "@/lib/server/marketing/post-gate";

export const dynamic = "force-dynamic";
/* Koleex AI's check of a CEO Brand post runs after the response, inside this
   function's time. */
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gatePost(req, id, "edit");
    if (g instanceof NextResponse) return g;
    if (g.post.created_by !== g.auth.account_id && !g.approver && !g.post.shared) {
      return NextResponse.json({ error: "Only the author or an approver can send this post." }, { status: 403 });
    }
    const v = await readVersion(req);
    if (v instanceof NextResponse) return v;
    const confirmedBy = v.body.confirmed === true ? g.auth.account_id : null;
    const sent = await submitPost(g.auth.tenant_id, id, v.version, { confirmedBy });
    if (!isError(sent)) after(() => notifyPostSubmitted(g.auth, id));
    if (!isError(sent) && g.post.space === "ceo") after(() => checkPostContent(g.auth.tenant_id, id));
    return reply(sent);
  } catch (e) {
    console.error("[api/marketing/posts/submit]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not send the post." }, { status: 500 });
  }
}
