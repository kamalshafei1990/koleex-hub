import "server-only";

/* GET  /api/marketing/posts?space=&filter=all|drafts|review|scheduled|published|problems&cursor=
        — the space's posts written in the Hub, newest change first, 20 at a
        time, with the counts of drafts, posts waiting for approval and posts
        with a problem, and whether the caller may approve. Needs "view".
   POST /api/marketing/posts — a new draft: { space, body, media, targets }.
        Needs "create". Pictures and videos must be this tenant's uploads. */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { cleanInput, createPost, isError, listPosts } from "@/lib/server/marketing/posts";
import { canApprovePosts } from "@/lib/server/marketing/approvals";
import { reply } from "@/lib/server/marketing/post-gate";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";
import type { PostFilter } from "@/lib/marketing/post-types";

export const dynamic = "force-dynamic";

const FILTERS: readonly PostFilter[] = ["all", "drafts", "review", "scheduled", "published", "problems"];

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const params = req.nextUrl.searchParams;
  const space = asSpace(params.get("space"));
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  const f = params.get("filter") as PostFilter | null;
  const filter: PostFilter = f && FILTERS.includes(f) ? f : "all";
  try {
    const [list, canApprove] = await Promise.all([listPosts(auth.tenant_id, space, filter, params.get("cursor")), canApprovePosts(auth, space)]);
    return NextResponse.json({ ...list, canApprove }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/posts GET]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the posts." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const space = asSpace(typeof body.space === "string" ? body.space : null);
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "create");
  if (denied) return denied;
  const clean = cleanInput(auth.tenant_id, body);
  if (isError(clean)) return reply(clean);
  try {
    const out = await createPost(auth.tenant_id, space, auth.account_id, clean.input);
    if (isError(out)) return reply(out);
    return NextResponse.json({ id: out.id, version: 1 }, { status: 201 });
  } catch (e) {
    console.error("[api/marketing/posts POST]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not save the post." }, { status: 500 });
  }
}
