import "server-only";

/* POST /api/marketing/messages/refresh — read the space's conversations from
   Meta now (the Messages tab's Refresh): { space }. Each account at most
   every 30 seconds; the cron reads them every 5 minutes anyway. "view": it
   copies the platform's messages into the Hub and changes nothing there. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { listAccounts } from "@/lib/server/marketing/accounts";
import { syncMessages } from "@/lib/server/marketing/messages";
import { SPACE_MODULE, asSpace } from "@/lib/marketing/spaces";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as { space?: unknown };
  const space = asSpace(typeof body.space === "string" ? body.space : null);
  const denied = await requireModuleAction(auth, SPACE_MODULE[space], "view");
  if (denied) return denied;
  try {
    const accounts = (await listAccounts(auth.tenant_id, space))
      .filter((a) => a.connection === "api" && (a.platform === "facebook" || a.platform === "instagram")).slice(0, 6);
    let refreshed = 0;
    for (const a of accounts) {
      const r = await syncMessages(auth.tenant_id, a.id, { minGapMs: 30_000 });
      if (r.ok && !r.skipped) refreshed++;
    }
    return NextResponse.json({ refreshed });
  } catch (e) {
    console.error("[api/marketing/messages/refresh]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "Could not refresh the messages." }, { status: 500 });
  }
}
