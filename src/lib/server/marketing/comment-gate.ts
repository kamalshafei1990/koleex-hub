import "server-only";

/* The door of every /api/marketing/comments/[id]/* route, in this order:
   signed in (a write refuses view-as), the comment is this tenant's, the
   caller has the action on the Roles module of the comment's account's
   space — and whether they may approve there (hiding is theirs). Nothing is
   read or written for a caller who fails a step. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction, type ModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { loadComment } from "@/lib/server/marketing/comments";
import { canApprovePosts } from "@/lib/server/marketing/approvals";
import { SPACE_MODULE } from "@/lib/marketing/spaces";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CommentGate {
  auth: ServerAuthContext;
  comment: NonNullable<Awaited<ReturnType<typeof loadComment>>>;
  approver: boolean;
}

export async function gateComment(req: Request, id: string, action: ModuleAction): Promise<CommentGate | NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid comment id." }, { status: 400 });
  const comment = await loadComment(auth.tenant_id, id);
  if (!comment) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  const denied = await requireModuleAction(auth, SPACE_MODULE[comment.space], action);
  if (denied) return denied;
  return { auth, comment, approver: await canApprovePosts(auth, comment.space) };
}
