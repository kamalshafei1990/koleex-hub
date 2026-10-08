import "server-only";

/* GET /api/cron/rating-cycle (daily 08:17) — the monthly rating rhythm
   (src/lib/server/ratings/scheduler.ts): opens next month's cycle on the
   20th, nags unfinished scores on the 25th, pushes finalize on the 28th,
   and publishes the finalized cycle to employees on the 1st. A cycle that
   never passed review is NOT auto-finalized — the CEO is nudged instead;
   the mandatory gate is a promise, and crons don't break promises.

   ?dry=1 — a SUPER ADMIN's preview of what would run today; nothing is
   opened, reminded or published. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { runRatingCycle } from "@/lib/server/ratings/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("dry") === "1") {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const preview = await runRatingCycle({ dryRun: true, tenantId: auth.tenant_id });
    return NextResponse.json(preview, { headers: { "Cache-Control": "private, no-store" } });
  }

  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  /* every tenant with employees gets its own run — one tenant's failure
     never stops the others */
  const { data: tenants } = await supabaseServer.from("tenants").select("id");
  const results: Record<string, unknown> = {};
  for (const t of tenants ?? []) {
    try {
      results[t.id] = await runRatingCycle({ tenantId: t.id });
    } catch (e) {
      results[t.id] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json({ ok: true, results }, { headers: { "Cache-Control": "no-store" } });
}
