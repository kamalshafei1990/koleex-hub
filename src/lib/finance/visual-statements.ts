import "server-only";

/* ===========================================================================
   Visual statements snapshot — single API call powering /finance/visual.

   Returns the three core statements (P&L, BS, CF) for the current period
   PLUS a trend series so the visual page can show a bar chart + clean
   table without a second round-trip.
   ========================================================================== */

import {
  buildProfitLoss, buildCashFlow, buildBalanceSheet,
  type Period, type ProfitLoss, type CashFlowStatement, type BalanceSheet, type BalanceLine, type BalanceSection,
} from "@/lib/accounting/statements";
import { resolveBaseCurrency } from "@/lib/finance/currency";

export type { BalanceSheet, BalanceLine, BalanceSection };

export type Granularity = "week" | "month" | "quarter" | "year";

export interface TrendBucket {
  label: string;       // "Q1 2026" / "Apr 2" / "2026"
  from: string;
  to: string;
  revenue: number;
  net_income: number;
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
