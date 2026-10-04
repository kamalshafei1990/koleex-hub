import "server-only";

/* POST /api/marketing/posts/[id]/approve — approve: { version }. A post with
   a time still ahead is scheduled (the cron publishes it then); any other is
   published now. Approvers only (the super admins and the roles given «Social
   Marketing Approvals»); an approver's own draft goes out the same way.
   Publishing starts in this request (60 s at most); anything still being
   prepared (an Instagram video) continues through /publish. The author
   hears the decision after the response (marketing/notify). */

import { after, NextResponse } from "next/server";
import { approvePost, isError } from "@/lib/server/marketing/posts";
import { publishPost } from "@/lib/server/marketing/publish";
import { notifyPostDecided } from "@/lib/server/marketing/notify";
import { gatePost, notApprover, readVersion, reply } from "@/lib/server/marketing/post-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gatePost(req, id, "edit");
    if (g instanceof NextResponse) return g;
    if (!g.approver) return notApprover();
    const v = await readVersion(req);
    if (v instanceof NextResponse) return v;
    const approved = await approvePost(g.auth.tenant_id, id, v.version, g.auth.account_id);
    if (isError(approved)) return reply(approved);
    after(() => notifyPostDecided(g.auth, id, approved.scheduled ? "scheduled" : "approved"));
    /* A time still ahead: the post waits for it; the cron publishes it. */
    if (approved.scheduled) return NextResponse.json({ version: approved.version, status: "scheduled", busy: false });
    const out = await publishPost(g.auth.tenant_id, id, { budgetMs: 45_000, actorId: g.auth.account_id });
    return NextResponse.json({ version: approved.version, status: out.status, busy: out.busy });
  } catch (e) {
    console.error("[api/marketing/posts/approve]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not approve the post." }, { status: 500 });
  }
}
