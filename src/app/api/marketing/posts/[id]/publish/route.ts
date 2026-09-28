import "server-only";

/* POST /api/marketing/posts/[id]/publish — carry on publishing an approved
   post (an Instagram video still being prepared, an account the last run did
   not reach): {}. "edit" — the approval was already given.
   { retry: true } sends the accounts that failed again: approvers only — the
   failure notice goes first (a new failure writes its own). */

import { NextResponse } from "next/server";
import { isError, retryFailed } from "@/lib/server/marketing/posts";
import { publishPost } from "@/lib/server/marketing/publish";
import { settleFailure } from "@/lib/server/marketing/notify";
import { gatePost, notApprover, reply } from "@/lib/server/marketing/post-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const g = await gatePost(req, id, "edit");
    if (g instanceof NextResponse) return g;
    const body = (await req.json().catch(() => ({}))) as { retry?: unknown };
    if (body.retry === true) {
      if (!g.approver) return notApprover();
      const r = await retryFailed(g.auth.tenant_id, id);
      if (isError(r)) return reply(r);
      await settleFailure(id);
    } else if (g.post.status !== "approved" && g.post.status !== "publishing") {
      return NextResponse.json({ error: "Nothing is waiting to be published.", code: "idle" }, { status: 409 });
    }
    const out = await publishPost(g.auth.tenant_id, id, { budgetMs: 45_000, actorId: g.auth.account_id });
    return NextResponse.json({ status: out.status, busy: out.busy });
  } catch (e) {
    console.error("[api/marketing/posts/publish]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not publish the post." }, { status: 500 });
  }
}
