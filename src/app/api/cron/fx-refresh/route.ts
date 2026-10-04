import "server-only";

/* GET /api/cron/fx-refresh
   Daily Vercel cron (see vercel.json). Fetches the live CNY-per-USD rate
   once and writes it to two places for every tenant:

     · commercial_settings.fx_cny_per_usd — the quoting default
     · finance_fx_rates (USD→CNY and CNY→USD, today's effective_date) —
       the ledger's rate table, which stamps every journal line's
       exchange_rate. Before, only the quoting default moved; the books
       kept converting at whatever rate an operator typed months ago.

   No user session — protected by the CRON_SECRET bearer that Vercel
   attaches to cron invocations automatically. If CRON_SECRET is unset
   (e.g. local dev), the guard is skipped so it can be run by hand. */

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

  /* Quoting default: all tenants. Supabase requires a filter on UPDATE,
     so match every row via "tenant_id is not null". */
  const { error, count } = await supabaseServer
    .from("commercial_settings")
    .update({ fx_cny_per_usd: fx.rate, updated_at: fx.fetchedAt }, { count: "exact" })
    .not("tenant_id", "is", null);
  if (error) {
    console.error("[cron/fx-refresh]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* Ledger rate table: one USD→CNY and one CNY→USD row per tenant for
     today. The unique key (tenant, from, to, effective_date) makes the
     upsert idempotent, and a rate an operator entered by hand today is
     overwritten by the market rate — the book rate should be the market. */
  const today = fx.fetchedAt.slice(0, 10);
  const { data: tenants } = await supabaseServer.from("tenants").select("id");
  const inverse = Math.round((1 / fx.rate) * 1_000_000) / 1_000_000;
  const rows = ((tenants ?? []) as { id: string }[]).flatMap((t) => [
    { tenant_id: t.id, from_currency: "USD", to_currency: "CNY", rate: fx.rate, effective_date: today, notes: `Market rate (${fx.source})` },
    { tenant_id: t.id, from_currency: "CNY", to_currency: "USD", rate: inverse, effective_date: today, notes: `Market rate (${fx.source})` },
  ]);
  let ratesWritten = 0;
  if (rows.length) {
    const { error: fxErr, count: fxCount } = await supabaseServer
      .from("finance_fx_rates")
      .upsert(rows, { onConflict: "tenant_id,from_currency,to_currency,effective_date", count: "exact" });
    if (fxErr) console.error("[cron/fx-refresh] finance_fx_rates:", fxErr.message);
    else ratesWritten = fxCount ?? rows.length;
  }

  return NextResponse.json({
    ok: true,
    rate: fx.rate,
    source: fx.source,
    fetchedAt: fx.fetchedAt,
    tenantsUpdated: count ?? null,
    ledgerRatesWritten: ratesWritten,
  });
}
