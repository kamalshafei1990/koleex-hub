import "server-only";

/* ===========================================================================
   FX status — supports the /finance/fx-rates manager:
     · which non-base currencies are actively used by open documents
     · which of those pairs are missing a configured rate
     · which configured rates are stale (>14d since effective_date)
     · per-pair usage count (open invoices + bills)
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import { resolveBaseCurrency } from "@/lib/finance/currency";

const STALE_DAYS = 14;

export interface FxPairUsage {
  pair: string;                    // e.g. "USD→CNY"
  from_currency: string;
  to_currency: string;             // tenant base
  has_rate: boolean;
  rate: number | null;
  effective_date: string | null;
  stale_days: number | null;       // null when no rate
  open_invoice_count: number;
  open_bill_count: number;
  open_total_original: number;     // sum of open balances in the original ccy
}

export interface FxStatusSnapshot {
  base_currency: string;
  /* All non-base currencies the tenant has active exposure to. Sorted
     by open_total_original desc so the busiest pair surfaces first. */
  pairs: FxPairUsage[];
  missing_pairs:    FxPairUsage[];
  stale_pairs:      FxPairUsage[];
}

export async function buildFxStatus(tenantId: string): Promise<FxStatusSnapshot> {
  const base = await resolveBaseCurrency(tenantId);

  const [invsRes, billsRes, ratesRes] = await Promise.all([
    supabaseServer.from("invoices")
      .select("currency, balance, status, cancelled_at")
      .eq("tenant_id", tenantId),
    supabaseServer.from("vendor_bills")
      .select("currency, balance, status")
      .eq("tenant_id", tenantId),
    supabaseServer.from("finance_fx_rates")
      .select("from_currency, to_currency, rate, effective_date")
      .eq("tenant_id", tenantId),
  ]);

  type Inv  = { currency: string; balance: number; status: string; cancelled_at: string | null };
  type Bill = { currency: string; balance: number; status: string };
  type Rate = { from_currency: string; to_currency: string; rate: number; effective_date: string };

  const invs = ((invsRes.data ?? []) as Inv[])
    .filter((i) => !i.cancelled_at && i.status !== "draft" && i.status !== "cancelled" && i.status !== "void" && Number(i.balance) > 0);
  const bills = ((billsRes.data ?? []) as Bill[])
    .filter((b) => b.status !== "draft" && b.status !== "cancelled" && Number(b.balance) > 0);

  /* Per-currency usage on open documents. */
  const usage = new Map<string, { invs: number; bills: number; total: number }>();
  for (const i of invs) {
    if (!i.currency || i.currency === base) continue;
    const u = usage.get(i.currency) ?? { invs: 0, bills: 0, total: 0 };
    u.invs += 1; u.total += Number(i.balance) || 0;
    usage.set(i.currency, u);
  }
  for (const b of bills) {
    if (!b.currency || b.currency === base) continue;
    const u = usage.get(b.currency) ?? { invs: 0, bills: 0, total: 0 };
    u.bills += 1; u.total += Number(b.balance) || 0;
    usage.set(b.currency, u);
  }

  /* Most-recent configured rate per pair (where to = base). */
  const latest = new Map<string, Rate>();
  for (const r of (ratesRes.data ?? []) as Rate[]) {
    if (r.to_currency !== base) continue;
    const cur = latest.get(r.from_currency);
    if (!cur || cur.effective_date < r.effective_date) latest.set(r.from_currency, r);
  }

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);

  const pairs: FxPairUsage[] = Array.from(usage.entries()).map(([from, u]) => {
    const r = latest.get(from);
    const stale = r ? Math.max(0, Math.floor((today.getTime() - new Date(r.effective_date).getTime()) / 86_400_000)) : null;
    return {
      pair: `${from}→${base}`,
      from_currency: from,
      to_currency: base,
      has_rate: !!r,
      rate: r?.rate ?? null,
      effective_date: r?.effective_date ?? null,
      stale_days: stale,
      open_invoice_count: u.invs,
      open_bill_count: u.bills,
      open_total_original: u.total,
    };
  }).sort((a, b) => b.open_total_original - a.open_total_original);

  return {
    base_currency: base,
    pairs,
    missing_pairs: pairs.filter((p) => !p.has_rate),
    stale_pairs:   pairs.filter((p) => p.has_rate && (p.stale_days ?? 0) > STALE_DAYS),
  };
}
