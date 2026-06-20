import "server-only";

/* GET /api/cron/fx-refresh
   Daily Vercel cron (see vercel.json). Fetches the live CNY-per-USD rate
   once and writes it into EVERY tenant's commercial_settings. No user
   session — protected by the CRON_SECRET bearer that Vercel attaches to
   cron invocations automatically. If CRON_SECRET is unset (e.g. local
   dev), the guard is skipped so it can be run by hand. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { fetchCnyPerUsd } from "@/lib/server/fx";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authz = req.headers.get("authorization");
    if (authz !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  let fx;
  try {
    fx = await fetchCnyPerUsd();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "FX provider unavailable" },
      { status: 502 },
    );
  }

  /* Update all tenants. Supabase requires a filter on UPDATE, so match
     every row via "tenant_id is not null". */
  const { error, count } = await supabaseServer
    .from("commercial_settings")
    .update({ fx_cny_per_usd: fx.rate, updated_at: fx.fetchedAt }, { count: "exact" })
    .not("tenant_id", "is", null);
  if (error) {
    console.error("[cron/fx-refresh]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    rate: fx.rate,
    source: fx.source,
    fetchedAt: fx.fetchedAt,
    tenantsUpdated: count ?? null,
  });
}
