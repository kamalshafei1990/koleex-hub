import "server-only";

/* GET /api/marketing/comments?space=&filter=needs|all|hidden&account=&cursor=
   — the comment threads of the space's accounts (the last 90 days), newest
   activity first, 20 at a time, with how many need a reply, and what the
   caller may do: reply ("edit") and hide (approvers — the only ones ever
   sent hidden comments). Needs "view". */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { listThreads } from "@/lib/server/marketing/comments";
import { canApprovePosts } from "@/lib/server/marketing/approvals";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";
import { COMMENT_FILTERS, type CommentFilter } from "@/lib/marketing/comment-types";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const params = req.nextUrl.searchParams;
  const space = asSpace(params.get("space"));
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  const f = params.get("filter") as CommentFilter | null;
  const filter: CommentFilter = f && COMMENT_FILTERS.includes(f) ? f : "needs";
  const account = params.get("account");
  const cursor = Math.max(0, Math.min(10_000, Number(params.get("cursor")) || 0));
  try {
    const [canHide, cannotReply] = await Promise.all([canApprovePosts(auth, space), requireModuleAction(auth, SPACE_MODULE[space], "edit")]);
    const list = await listThreads(auth.tenant_id, space, { filter, accountId: account && UUID_RE.test(account) ? account : null, cursor, canSeeHidden: canHide });
    return NextResponse.json({ ...list, canReply: cannotReply === null, canHide }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/comments GET]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the comments." }, { status: 500 });
  }
}
