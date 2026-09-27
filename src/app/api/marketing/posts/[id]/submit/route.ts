import "server-only";

/* POST /api/marketing/posts/[id]/submit — send a draft (or a post sent back)
   for approval: { version }. "edit"; the author or an approver. Refused with
   the reasons (422) while the post cannot go to one of its accounts. */

import { NextResponse } from "next/server";
import { submitPost } from "@/lib/server/marketing/posts";
import { gatePost, readVersion, reply } from "@/lib/server/marketing/post-gate";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gatePost(req, id, "edit");
    if (g instanceof NextResponse) return g;
    if (g.post.created_by !== g.auth.account_id && !g.approver) {
      return NextResponse.json({ error: "Only the author or an approver can send this post." }, { status: 403 });
    }
    const v = await readVersion(req);
    if (v instanceof NextResponse) return v;
    return reply(await submitPost(g.auth.tenant_id, id, v.version));
  } catch (e) {
    console.error("[api/marketing/posts/submit]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not send the post." }, { status: 500 });
  }
}
