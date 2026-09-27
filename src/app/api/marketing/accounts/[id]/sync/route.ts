import "server-only";

/* POST /api/marketing/accounts/[id]/sync — refresh one account's posts,
   numbers and comments from its platform into the Hub. { force: true } is
   the Refresh button (at most once a minute); without it, the Feed's refresh
   on opening (at most every 10 minutes). Needs "view" on the account's own
   space: it copies the platform into the Hub and changes nothing there. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { accountSpace } from "@/lib/server/marketing/accounts";
import { syncAccount } from "@/lib/server/marketing/sync";
import { SPACE_MODULE } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid account id." }, { status: 400 });
  try {
    const space = await accountSpace(auth.tenant_id, id);
    if (!space) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
    if (denied) return denied;
    const body = (await req.json().catch(() => ({}))) as { force?: unknown };
    const out = await syncAccount(auth.tenant_id, id, { force: body.force === true, budgetMs: 40_000 });
    /* The outcome only; the column read after it shows the account's state. */
    return NextResponse.json({ ok: out.ok, skipped: out.skipped ?? null, posts: out.posts ?? null, historyDone: out.historyDone ?? null });
  } catch (e) {
    console.error("[api/marketing/accounts sync]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not refresh the account." }, { status: 500 });
  }
}
