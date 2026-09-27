import "server-only";

/* GET /api/marketing/posts/[id] — one post with its whole text, all its
   pictures and its comments. Opening a post refreshes it from its platform
   first (numbers, comments, and the picture links, which Meta expires after
   some days); ?part=media refreshes the pictures only — what a Feed card
   asks when its picture stops loading. A failed refresh still returns what
   the Hub has. Needs "view" on the space of the post's account. */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { accountSpace } from "@/lib/server/marketing/accounts";
import { loadPostDetail, postAccountId } from "@/lib/server/marketing/feed";
import { refreshPost } from "@/lib/server/marketing/sync";
import { SPACE_MODULE } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
  try {
    const accountId = await postAccountId(auth.tenant_id, id);
    const space = accountId ? await accountSpace(auth.tenant_id, accountId) : null;
    if (!space) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
    if (denied) return denied;
    const mediaOnly = req.nextUrl.searchParams.get("part") === "media";
    await refreshPost(auth.tenant_id, id, { engagement: !mediaOnly }).catch((e) => {
      console.warn("[api/marketing/posts] refresh:", e instanceof Error ? e.message : String(e));
    });
    const detail = await loadPostDetail(auth.tenant_id, id);
    if (!detail) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    return NextResponse.json(detail, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[api/marketing/posts]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the post." }, { status: 500 });
  }
}
