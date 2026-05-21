import "server-only";

import { NextResponse } from "next/server";
import { buildVisualSnapshot } from "@/lib/finance/visual-statements";
import { getSupabaseServer } from "@/lib/server/supabase-server";

/* /api/_debug/finance-snapshot
   Diagnostic-only endpoint. Bypasses normal auth so we can verify
   whether the Vercel runtime can talk to Supabase + run
   buildVisualSnapshot. Guarded by a header secret so it isn't a back
   door. Will be removed in a follow-up commit once the data issue is
   resolved.

   Usage:
     curl https://hub.koleexgroup.com/api/_debug/finance-snapshot \
       -H "x-debug-key: $DEBUG_KEY" \
       --data-urlencode tenant=490fbd4d-f3e8-44fa-83e6-ee26f961d5ca
*/

const DEBUG_KEY = "koleex-debug-2026-finance-snapshot";

export async function GET(req: Request) {
  const key = req.headers.get("x-debug-key");
  if (key !== DEBUG_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const tenant = url.searchParams.get("tenant");
  if (!tenant) {
    return NextResponse.json({ error: "tenant param required" }, { status: 400 });
  }

  const diag: Record<string, unknown> = {};

  /* Smoke test 1 — can we even talk to Supabase via this runtime? */
  try {
    const client = getSupabaseServer();
    const { data: t, error: e1 } = await client
      .from("tenants").select("id, name").eq("id", tenant).maybeSingle();
    diag.smoke_tenants = { ok: !e1, error: e1?.message, data: t };
  } catch (e) {
    diag.smoke_tenants = { ok: false, threw: String(e) };
  }

  /* Smoke test 2 — direct accounting_journal_lines count for this tenant */
  try {
    const client = getSupabaseServer();
    const { count, error: e2 } = await client
      .from("accounting_journal_lines")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant);
    diag.smoke_lines = { ok: !e2, error: e2?.message, count };
  } catch (e) {
    diag.smoke_lines = { ok: false, threw: String(e) };
  }

  /* Smoke test 3 — embedded join (the actual API path) */
  try {
    const client = getSupabaseServer();
    const { data, error: e3 } = await client
      .from("accounting_journal_lines")
      .select("account_id, debit, credit, accounting_journal_entries!inner(entry_date, status, tenant_id)")
      .eq("tenant_id", tenant)
      .eq("accounting_journal_entries.tenant_id", tenant)
      .eq("accounting_journal_entries.status", "posted")
      .limit(3);
    diag.smoke_embedded = { ok: !e3, error: e3?.message, rowCount: (data ?? []).length, sample: data };
  } catch (e) {
    diag.smoke_embedded = { ok: false, threw: String(e) };
  }

  /* Smoke test 4 — full buildVisualSnapshot pipeline */
  try {
    const snap = await buildVisualSnapshot(tenant, "year");
    diag.smoke_snapshot = {
      ok: true,
      base_currency: snap.base_currency,
      period: snap.period,
      revenue_total: snap.income.revenue.amount,
      revenue_accounts: snap.income.revenue.accounts.length,
      net_profit: snap.income.net_profit,
      trend_buckets: snap.trend.map((b) => ({ label: b.label, revenue: b.revenue, net_income: b.net_income })),
    };
  } catch (e) {
    diag.smoke_snapshot = { ok: false, threw: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) };
  }

  return NextResponse.json(diag);
}
