import "server-only";

/* GET /api/marketing/feed?space=company|ceo — the Feed: one column per
       account read by API (Facebook Pages, Instagram accounts), each with its
       week and newest posts, and how many of the space's accounts are shared
       by hand. Needs "view" on the space.
   GET /api/marketing/feed?account=<id> — that column again (after a refresh).
   GET /api/marketing/feed?account=<id>&cursor=<c> — its next older posts.
       With an account, the account's OWN space decides the permission.
   Only what the syncs stored is read here; never an access key. */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { accountSpace } from "@/lib/server/marketing/accounts";
import { loadColumn, loadFeed, loadMorePosts, parseCursor } from "@/lib/server/marketing/feed";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const params = req.nextUrl.searchParams;
  const accountId = params.get("account");
  try {
    if (accountId === null) {
      const space = asSpace(params.get("space"));
      const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
      if (denied) return denied;
      return NextResponse.json(await loadFeed(auth.tenant_id, space), PRIVATE);
    }
    if (!UUID_RE.test(accountId)) return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
    const space = await accountSpace(auth.tenant_id, accountId);
    if (!space) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
    if (denied) return denied;

    const rawCursor = params.get("cursor");
    if (rawCursor !== null) {
      const cursor = parseCursor(rawCursor);
      if (!cursor) return NextResponse.json({ error: "Invalid position." }, { status: 400 });
      const page = await loadMorePosts(auth.tenant_id, accountId, cursor);
      if (!page) return NextResponse.json({ error: "Account not found." }, { status: 404 });
      return NextResponse.json(page, PRIVATE);
    }
    const column = await loadColumn(auth.tenant_id, accountId);
    if (!column) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    return NextResponse.json({ column }, PRIVATE);
  } catch (e) {
    console.error("[api/marketing/feed]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not load the Feed." }, { status: 500 });
  }
}
