import "server-only";

/* The door of every /api/marketing/posts/[id]/* route, in this order: signed
   in (a write refuses view-as), the post is this tenant's, the caller has the
   action on the Roles module of the post's OWN space — and whether they may
   approve there. Nothing is read or written for a caller who fails a step. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction, type ModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { postMeta, isError, type Result } from "@/lib/server/marketing/posts";
import { canApprovePosts } from "@/lib/server/marketing/approvals";
import { SPACE_MODULE, type MarketingSpace } from "@/lib/marketing/spaces";
import type { PostStatus } from "@/lib/marketing/post-types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PostGate {
  auth: ServerAuthContext;
  post: { space: MarketingSpace; created_by: string; status: PostStatus; version: number; shared: boolean };
  approver: boolean;
}

export async function gatePost(req: Request | null, id: string, action: ModuleAction): Promise<PostGate | NextResponse> {
  const auth = await requireAuth(req ?? undefined);
  if (auth instanceof NextResponse) return auth;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
  const post = await postMeta(auth.tenant_id, id);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  const denied = await requireModuleAction(auth, SPACE_MODULE[post.space], action);
  if (denied) return denied;
  return { auth, post, approver: await canApprovePosts(auth, post.space) };
}

/** A posts function's answer as a response. */
export function reply<T extends object>(r: Result<T>, ok: (v: T) => object = (v) => v): NextResponse {
  if (isError(r)) return NextResponse.json({ error: r.error, code: r.code ?? null, issues: r.issues ?? null }, { status: r.status });
  return NextResponse.json(ok(r));
}

export const notApprover = () =>
  NextResponse.json({ error: "Only an approver can do this: on Social Marketing the super admins and the roles given «Social Marketing Approvals»; on CEO Brand the account granted «CEO Brand Approvals».", code: "not_approver" }, { status: 403 });

/** The version the person's screen read — required for every change. */
export async function readVersion(req: Request): Promise<{ version: number; body: Record<string, unknown> } | NextResponse> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const version = body.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return NextResponse.json({ error: "Reload the post and try again.", code: "no_version" }, { status: 400 });
  }
  return { version, body };
}
