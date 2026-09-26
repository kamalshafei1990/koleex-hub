/* ---------------------------------------------------------------------------
   The number reports' data (Reports 6C) — the shapes the APIs send and the
   one way each page and its paper read them. The APIs are the doors: a 403
   is "locked" (the page says which permission opens it), never a guess.

     /api/reports/operational             sales … suppliers  (Finance + the
                                          «private records» switch for costs)
     /api/accounting/profit-loss          { statement }       (Finance)
     /api/accounting/balance-sheet        { balance_sheet, currency }
     /api/accounting/cash-flow            { statement }
     /api/accounting/statements/ar-aging  { report }          one row per party
     /api/accounting/statements/ap-aging  { report }          and currency
   --------------------------------------------------------------------------- */

import type { Money, OpsKind, StatementTab } from "@/lib/reports/numbers";
import { DATED_KINDS } from "@/lib/reports/numbers";

export type OpsRow = { key: string; label: string | null; count: number; amounts: Money; open?: Money; qty?: number; meta?: Record<string, string | number | null> };
export type OpsReport = { rows: OpsRow[]; totals: { count: number; amounts: Money; open?: Money; qty?: number }; base: string };

export type PLLine = { account_id: string; code: string; name: string; amount: number };
export type PLSection = { label: string; amount: number; accounts: PLLine[] };
export type ProfitLoss = {
  period: { from: string; to: string }; currency: string;
  revenue: PLSection; cost_of_sales: PLSection; gross_profit: number; gross_margin_pct: number;
  operating_expenses: PLSection; operating_profit: number; operating_margin_pct: number;
  net_profit: number; net_margin_pct: number; comparison?: ProfitLoss;
};
export type BalanceSummary = { as_of: string; total_assets: number; total_liabilities: number; total_equity: number; current_year_earnings: number; balanced_difference: number };
export type CashLine = { label: string; amount: number; detail?: string };
export type CashSection = { label: string; amount: number; lines: CashLine[] };
export type CashFlow = {
  period: { from: string; to: string }; currency: string; opening_cash: number;
  operating: CashSection; investing: CashSection; financing: CashSection;
  net_change: number; closing_cash: number; reconciled: boolean;
};
export type AgingTotals = { by_bucket: Record<string, number>; total_open: number; total_overdue: number };
export type AgingRow = { party_id: string | null; party_name: string | null; total_open: number; total_overdue: number; buckets: Record<string, number>; currency: string };
export type Aging = { as_of: string; buckets: string[]; parties: AgingRow[]; totals: AgingTotals; totals_by_currency?: Record<string, AgingTotals> };

export type StatementData =
  | { tab: "pl"; pl: ProfitLoss }
  | { tab: "bs"; bs: BalanceSummary; currency: string }
  | { tab: "cf"; cf: CashFlow }
  | { tab: "ar" | "ap"; aging: Aging };

export type Fetched<D> = { state: "ok"; data: D } | { state: "locked" } | { state: "error" };

async function getJson<D>(url: string, pick: (j: Record<string, unknown>) => D | null): Promise<Fetched<D>> {
  try {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (res.status === 403) return { state: "locked" };
    if (!res.ok) return { state: "error" };
    const data = pick((await res.json()) as Record<string, unknown>);
    return data ? { state: "ok", data } : { state: "error" };
  } catch {
    return { state: "error" };
  }
}

export function fetchOps(kind: OpsKind, from: string, to: string): Promise<Fetched<OpsReport>> {
  const qs = new URLSearchParams({ kind, ...(DATED_KINDS.has(kind) ? { from, to } : {}) });
  return getJson(`/api/reports/operational?${qs.toString()}`, (j) => (j.report as OpsReport | undefined) ?? null);
}

/** Per tab: a period (P&L with the previous one when `cmp`, cash flow) or
 *  one day (the balance sheet, the two agings). */
export function fetchStatement(tab: StatementTab, q: { from: string; to: string; asOf: string; cmp: boolean }): Promise<Fetched<StatementData>> {
  const range = `from=${q.from}&to=${q.to}`;
  switch (tab) {
    case "pl": return getJson(`/api/accounting/profit-loss?${range}${q.cmp ? "&compare_prior=1" : ""}`, (j) => (j.statement ? { tab: "pl", pl: j.statement as ProfitLoss } : null));
    case "bs": return getJson(`/api/accounting/balance-sheet?as_of=${q.asOf}`, (j) => (j.balance_sheet ? { tab: "bs", bs: j.balance_sheet as BalanceSummary, currency: String(j.currency ?? "CNY") } : null));
    case "cf": return getJson(`/api/accounting/cash-flow?${range}`, (j) => (j.statement ? { tab: "cf", cf: j.statement as CashFlow } : null));
    case "ar": case "ap": return getJson(`/api/accounting/statements/${tab}-aging?as_of=${q.asOf}`, (j) => (j.report ? { tab, aging: j.report as Aging } : null));
  }
}

/** The aging totals per currency — a response from before 6C carried one
 *  mixed total; read as one currency then (every row had the first code). */
export function agingTotals(a: Aging): Record<string, AgingTotals> {
  if (a.totals_by_currency && Object.keys(a.totals_by_currency).length) return a.totals_by_currency;
  return a.parties.length ? { [a.parties[0].currency]: a.totals } : {};
}
