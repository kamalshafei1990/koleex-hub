import "server-only";

/* ===========================================================================
   Visual statements snapshot — single API call powering /finance/visual.

   Returns the three core statements (P&L, BS, CF) for the current period
   PLUS a trend series so the visual page can show a bar chart + clean
   table without a second round-trip.
   ========================================================================== */

import { buildProfitLoss, buildCashFlow, type Period, type ProfitLoss, type CashFlowStatement } from "@/lib/accounting/statements";
import { resolveBaseCurrency } from "@/lib/finance/currency";
import { getSupabaseServer } from "@/lib/server/supabase-server";

export type Granularity = "week" | "month" | "quarter" | "year";

export interface TrendBucket {
  label: string;       // "Q1 2026" / "Apr 2" / "2026"
  from: string;
  to: string;
  revenue: number;
  net_income: number;
}

export interface BalanceLine { code: string; name: string; amount: number }
export interface BalanceSection { label: string; amount: number; accounts: BalanceLine[] }
export interface BalanceSheet {
  as_of: string;
  currency: string;
  assets: BalanceSection;
  liabilities: BalanceSection;
  equity: BalanceSection;
  total_assets: number;
  total_liab_eq: number;
  reconciled: boolean;
}

export interface VisualSnapshot {
  base_currency: string;
  granularity: Granularity;
  period: Period;
  income: ProfitLoss;
  /** Comparison period of the same granularity (opt-in). When omitted, the
   *  dashboard renders a single-column view. */
  income_compare?: ProfitLoss;
  /** Period the comparison set covers (only present when compare is on). */
  compare_period?: Period;
  balance: BalanceSheet;
  cash_flow: CashFlowStatement;
  cash_flow_compare?: CashFlowStatement;
  trend: TrendBucket[];     // last 5 buckets ending at periodEnd
}

export interface BuildVisualSnapshotOpts {
  /** ISO yyyy-mm-dd. Defaults to today. Determines the "current" period. */
  periodEnd?: string;
  /** When provided, the snapshot includes a comparison set. */
  compareEnd?: string;
}

/* ─── Period helpers ──────────────────────────────────────── */

function endOfDay(d: Date) { d.setUTCHours(23, 59, 59, 999); return d; }
function todayIso() { return new Date().toISOString().slice(0, 10); }

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function periodFor(granularity: Granularity, base: Date): { from: string; to: string; label: string } {
  const d = new Date(base);
  if (granularity === "week") {
    /* Treat "week" as the last 7 days. */
    const to = d.toISOString().slice(0, 10);
    const start = new Date(d); start.setUTCDate(start.getUTCDate() - 6);
    return { from: start.toISOString().slice(0, 10), to, label: to.slice(5) };
  }
  if (granularity === "month") {
    /* Whole calendar month containing `base`. */
    const m = d.getUTCMonth();
    const y = d.getUTCFullYear();
    const start = new Date(Date.UTC(y, m, 1));
    const end   = new Date(Date.UTC(y, m + 1, 0));
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      label: `${MONTH_SHORT[m]} ${y}`,
    };
  }
  if (granularity === "quarter") {
    const m = d.getUTCMonth();
    const q = Math.floor(m / 3);
    const startMonth = q * 3;
    const start = new Date(Date.UTC(d.getUTCFullYear(), startMonth, 1));
    const endMonth = startMonth + 3;
    const end = new Date(Date.UTC(d.getUTCFullYear(), endMonth, 0));
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      label: `Q${q + 1} ${d.getUTCFullYear()}`,
    };
  }
  /* year */
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const end   = new Date(Date.UTC(d.getUTCFullYear(), 11, 31));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    label: `${d.getUTCFullYear()}`,
  };
}

function priorBase(granularity: Granularity, base: Date): Date {
  const d = new Date(base);
  if (granularity === "week")    d.setUTCDate(d.getUTCDate() - 7);
  if (granularity === "month")   d.setUTCMonth(d.getUTCMonth() - 1);
  if (granularity === "quarter") d.setUTCMonth(d.getUTCMonth() - 3);
  if (granularity === "year")    d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d;
}

/* ─── Balance sheet builder ───────────────────────────────── */
/* We build it directly here rather than depending on a separate
   buildBalanceSheet() that may not exist. Same posted-line logic as
   the P&L: sum debits and credits per account, classify by COA code
   range. */

async function buildBalanceSheet(tenantId: string, asOf: string, currency: string): Promise<BalanceSheet> {
  const { data: acctsRaw } = await getSupabaseServer()
    .from("accounting_accounts").select("id, code, name, type, normal_balance")
    .eq("tenant_id", tenantId);
  type Acct = { id: string; code: string; name: string; type: string; normal_balance: string };
  const accts = (acctsRaw ?? []) as Acct[];

  const { data: linesRaw } = await getSupabaseServer()
    .from("accounting_journal_lines")
    .select("account_id, debit, credit, accounting_journal_entries!inner(entry_date, status, tenant_id)")
    .eq("tenant_id", tenantId)
    .eq("accounting_journal_entries.tenant_id", tenantId)
    .eq("accounting_journal_entries.status", "posted")
    .lte("accounting_journal_entries.entry_date", asOf);
  type LineRow = {
    account_id: string; debit: number | string; credit: number | string;
    accounting_journal_entries: { entry_date: string; status: string };
  };
  const lines = (linesRaw ?? []) as unknown as LineRow[];

  const debitMap  = new Map<string, number>();
  const creditMap = new Map<string, number>();
  for (const l of lines) {
    debitMap.set(l.account_id,  (debitMap.get(l.account_id)  ?? 0) + (Number(l.debit)  || 0));
    creditMap.set(l.account_id, (creditMap.get(l.account_id) ?? 0) + (Number(l.credit) || 0));
  }
  function balanceFor(a: Acct) {
    const d = debitMap.get(a.id)  ?? 0;
    const c = creditMap.get(a.id) ?? 0;
    return a.normal_balance === "debit" ? d - c : c - d;
  }

  const asset = accts.filter((a) => a.type === "asset" || a.type === "contra_asset");
  const liab  = accts.filter((a) => a.type === "liability" || a.type === "contra_liability");
  const eq    = accts.filter((a) => a.type === "equity");

  function section(label: string, group: Acct[]): BalanceSection {
    const accLines = group.map((a) => ({ code: a.code, name: a.name, amount: balanceFor(a) }))
      .filter((x) => Math.abs(x.amount) > 0.005)
      .sort((a, b) => a.code.localeCompare(b.code));
    const amount = accLines.reduce((s, l) => s + l.amount, 0);
    return { label, amount, accounts: accLines };
  }
  const assets = section("Assets", asset);
  const liabilities = section("Liabilities", liab);
  const equity = section("Equity", eq);

  /* Roll year-to-date earnings into Equity. */
  const yearStart = `${asOf.slice(0, 4)}-01-01`;
  const pl = await buildProfitLoss(tenantId, { from: yearStart, to: asOf }, { currency });
  if (Math.abs(pl.net_profit) > 0.005) {
    equity.accounts.push({ code: "3900", name: "Current Year Earnings", amount: pl.net_profit });
    equity.amount += pl.net_profit;
  }

  const total_assets  = assets.amount;
  const total_liab_eq = liabilities.amount + equity.amount;
  return {
    as_of: asOf, currency,
    assets, liabilities, equity,
    total_assets, total_liab_eq,
    reconciled: Math.abs(total_assets - total_liab_eq) < 0.5,
  };
}

/* ─── Snapshot builder ────────────────────────────────────── */

function emptyCashFlow(from: string, to: string, currency: string): CashFlowStatement {
  return {
    period: { from, to }, currency,
    opening_cash: 0,
    operating: { label: "Operating", amount: 0, lines: [] },
    investing: { label: "Investing", amount: 0, lines: [] },
    financing: { label: "Financing", amount: 0, lines: [] },
    net_change: 0, closing_cash: 0, reconciled: true,
  } as CashFlowStatement;
}

export async function buildVisualSnapshot(
  tenantId: string,
  granularity: Granularity,
  opts: BuildVisualSnapshotOpts = {},
): Promise<VisualSnapshot> {
  const baseCurrency = await resolveBaseCurrency(tenantId);

  /* Anchor date for the "current" view. Defaults to today, but can be
     any historical date so operators can navigate. */
  const anchorIso = opts.periodEnd ?? todayIso();
  const anchor = new Date(`${anchorIso}T00:00:00Z`);
  const cur = periodFor(granularity, anchor);

  /* Optional comparison anchor. When present we compute a second P&L
     and Cash Flow against the same granularity window. */
  const compareIso = opts.compareEnd;
  const compareAnchor = compareIso ? new Date(`${compareIso}T00:00:00Z`) : null;
  const comparePeriod = compareAnchor ? periodFor(granularity, compareAnchor) : null;

  const tasks: Promise<unknown>[] = [
    buildProfitLoss(tenantId, { from: cur.from, to: cur.to }, { currency: baseCurrency }),
    buildBalanceSheet(tenantId, cur.to, baseCurrency),
    buildCashFlow(tenantId, { from: cur.from, to: cur.to }).catch(
      () => emptyCashFlow(cur.from, cur.to, baseCurrency),
    ),
  ];
  if (comparePeriod) {
    tasks.push(
      buildProfitLoss(tenantId, { from: comparePeriod.from, to: comparePeriod.to }, { currency: baseCurrency }),
      buildCashFlow(tenantId, { from: comparePeriod.from, to: comparePeriod.to }).catch(
        () => emptyCashFlow(comparePeriod.from, comparePeriod.to, baseCurrency),
      ),
    );
  }
  const results = await Promise.all(tasks);
  const income = results[0] as ProfitLoss;
  const balance = results[1] as BalanceSheet;
  const cash_flow = results[2] as CashFlowStatement;
  const income_compare = comparePeriod ? (results[3] as ProfitLoss) : undefined;
  const cash_flow_compare = comparePeriod ? (results[4] as CashFlowStatement) : undefined;

  /* Trend — last 5 buckets of the chosen granularity (oldest first),
     ending at the anchor date so the chart shifts with navigation. */
  const trendPeriods = Array.from({ length: 5 }, (_, idx) => {
    const i = 4 - idx;  /* 4..0 → oldest first */
    const b = new Date(anchor);
    if (granularity === "week")    b.setUTCDate(b.getUTCDate() - i * 7);
    if (granularity === "month")   b.setUTCMonth(b.getUTCMonth() - i);
    if (granularity === "quarter") b.setUTCMonth(b.getUTCMonth() - i * 3);
    if (granularity === "year")    b.setUTCFullYear(b.getUTCFullYear() - i);
    return periodFor(granularity, b);
  });
  const trendPLs = await Promise.all(
    trendPeriods.map((p) =>
      buildProfitLoss(tenantId, { from: p.from, to: p.to }, { currency: baseCurrency }),
    ),
  );
  const trend: TrendBucket[] = trendPeriods.map((p, idx) => ({
    label: p.label, from: p.from, to: p.to,
    revenue: trendPLs[idx].revenue.amount,
    net_income: trendPLs[idx].net_profit,
  }));
  void endOfDay;
  void priorBase;

  return {
    base_currency: baseCurrency,
    granularity,
    period: { from: cur.from, to: cur.to },
    income,
    income_compare,
    compare_period: comparePeriod ? { from: comparePeriod.from, to: comparePeriod.to } : undefined,
    balance,
    cash_flow,
    cash_flow_compare,
    trend,
  };
}
