import "server-only";

/* POST /api/marketing/comments/refresh — bring in the new comments on the
   space's recent posts now (the Comments tab's Refresh): { space }. Each
   account at most once a minute; the cron does it every 15 minutes anyway.
   "view": it copies the platform into the Hub and changes nothing there. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/marketing/accounts";
import { refreshRecentComments } from "@/lib/server/marketing/sync";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as { space?: unknown };
  const space = asSpace(typeof body.space === "string" ? body.space : null);
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  try {
    const started = Date.now();
    const accounts = (await listAccounts(auth.tenant_id, space))
      .filter((a) => a.connection === "api" && (a.platform === "facebook" || a.platform === "instagram")).slice(0, 10);
    let refreshed = 0;
    for (const a of accounts) {
      const left = 45_000 - (Date.now() - started);
      if (left < 8_000) break;
      const r = await refreshRecentComments(auth.tenant_id, a.id, { minGapMs: 60_000, budgetMs: Math.min(15_000, left) });
      if (r.ok && !r.skipped) refreshed++;
    }
    return NextResponse.json({ refreshed });
  } catch (e) {
    console.error("[api/marketing/comments/refresh]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not refresh the comments." }, { status: 500 });
  }
}
