import "server-only";

/* GET    /api/marketing/posts/[id] — a post written in the Hub, its accounts
          and their results, and what the caller may do with it. "view".
   PATCH  — save an edit: { version, body, media, targets }. "edit"; only the
          author or an approver, only while a draft, in review or sent back.
   DELETE ?version= — delete a draft (or one sent back / in review). "delete";
          only the author or an approver.
   Every change carries the version the screen read (409 when stale). An
   edit that takes a post out of review, or a delete, settles its
   notifications after the response (marketing/notify). */

import { after, NextResponse, type NextRequest } from "next/server";
import { requireModuleAction } from "@/lib/server/auth";
import { EDITABLE, cleanInput, deletePost, isError, loadPost, sharedDraft, updatePost } from "@/lib/server/marketing/posts";
import { gatePost, readVersion, reply } from "@/lib/server/marketing/post-gate";
import { settleDeleted, settleReview } from "@/lib/server/marketing/notify";
import { SPACE_MODULE } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const g = await gatePost(null, id, "view");
    if (g instanceof NextResponse) return g;
    const post = await loadPost(g.auth.tenant_id, id);
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    const mine = post.created_by === g.auth.account_id;
    const [cannotEdit, cannotDelete] = await Promise.all([
      requireModuleAction(g.auth, SPACE_MODULE[post.space], "edit"),
      requireModuleAction(g.auth, SPACE_MODULE[post.space], "delete"),
    ]);
    const open = EDITABLE.includes(post.status) && (mine || g.approver || sharedDraft(post));
    return NextResponse.json({
      post,
      canApprove: g.approver,
      canEdit: open && cannotEdit === null,
      canDelete: open && cannotDelete === null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/posts/id GET]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the post." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const g = await gatePost(req, id, "edit");
    if (g instanceof NextResponse) return g;
    const v = await readVersion(req);
    if (v instanceof NextResponse) return v;
    const clean = cleanInput(g.auth.tenant_id, v.body);
    if (isError(clean)) return reply(clean);
    const saved = await updatePost(g.auth.tenant_id, id, v.version, clean.input, { accountId: g.auth.account_id, approver: g.approver });
    if (!isError(saved) && g.post.status === "in_review") after(() => settleReview(g.auth.tenant_id, id));
    return reply(saved);
  } catch (e) {
    console.error("[api/marketing/posts/id PATCH]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not save the post." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const g = await gatePost(req, id, "delete");
    if (g instanceof NextResponse) return g;
    const version = Number(req.nextUrl.searchParams.get("version"));
    if (!Number.isInteger(version) || version < 1) return NextResponse.json({ error: "Reload the post and try again.", code: "no_version" }, { status: 400 });
    const gone = await deletePost(g.auth.tenant_id, id, version, { accountId: g.auth.account_id, approver: g.approver });
    if (!isError(gone)) after(() => settleDeleted(id));
    return reply(gone);
  } catch (e) {
    console.error("[api/marketing/posts/id DELETE]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not delete the post." }, { status: 500 });
  }
}
