import "server-only";

/* POST /api/marketing/insights/refresh — read the space's numbers from Meta
   now (the Insights tab's Refresh): { space }. Each account at most once a
   minute; the cron keeps them current anyway. "view": it copies the
   platform's numbers into the Hub and changes nothing there. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/marketing/accounts";
import { syncInsights } from "@/lib/server/marketing/insights";
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
      .filter((a) => a.connection === "api" && (a.platform === "facebook" || a.platform === "instagram"))
      .slice(0, 10);
    let refreshed = 0;
    for (const a of accounts) {
      const left = 50_000 - (Date.now() - started);
      if (left < 8_000) break;
      const r = await syncInsights(auth.tenant_id, a.id, { budgetMs: Math.min(25_000, left), force: true });
      if (r.ok && !r.skipped) refreshed++;
    }
    return NextResponse.json({ refreshed });
  } catch (e) {
    console.error("[api/marketing/insights/refresh]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not refresh the insights." }, { status: 500 });
  }
}
