/* ===========================================================================
   Logistics Intelligence  —  Phase 2.0

   Reads expenses to build a logistics picture without owning a separate
   logistics endpoint. We bucket expense categories into the six
   canonical logistics buckets the business cares about:

     · shipping       — outbound freight, courier, last-mile
     · freight        — sea/air/road carrier
     · customs        — duties, brokerage
     · packaging      — crates, pallets, labels
     · warehousing    — storage, handling
     · insurance      — cargo insurance

   Mapping is name-based against finance_expense_categories. The
   matching is case-insensitive and uses contains-matching to tolerate
   "International Freight", "Sea Freight", "Customs Clearance", etc.
   ========================================================================== */

import type { FinanceExpense } from "@/lib/finance/types";
import type {
  Direction,
  LogisticsBucket,
  LogisticsSnapshot,
  Pressure,
} from "./types";
import { classifyDirection, daysFromToday } from "./behavior";

type Bucket = LogisticsBucket["bucket"];

const KEYWORDS: Record<Bucket, string[]> = {
  shipping:    ["shipping", "courier", "delivery", "logistics"],
  freight:     ["freight", "haulage", "cargo", "trucking"],
  customs:     ["customs", "duty", "duties", "broker"],
  packaging:   ["packaging", "crate", "pallet", "label", "wrap"],
  warehousing: ["warehouse", "warehousing", "storage", "handling"],
  insurance:   ["insurance", "cargo insurance"],
};

const ORDER: Bucket[] = ["shipping", "freight", "customs", "packaging", "warehousing", "insurance"];

function classify(categoryName: string | null | undefined): Bucket | null {
  if (!categoryName) return null;
  const n = categoryName.toLowerCase();
  for (const b of ORDER) {
    for (const kw of KEYWORDS[b]) {
      if (n.includes(kw)) return b;
    }
  }
  return null;
}

/* ---------------------------------------------------------------------------
   Snapshot builder.

   `priorExpenses` is the prior comparable period (e.g. previous 90 days
   when current period = current 90 days). Trends are computed bucket-wise.
   --------------------------------------------------------------------------- */

export function buildLogisticsSnapshot(args: {
  current: FinanceExpense[];
  prior?: FinanceExpense[];
  totalOpex: number;
}): LogisticsSnapshot {
  const { current, prior = [], totalOpex } = args;

  const totals: Record<Bucket, number> = {
    shipping: 0, freight: 0, customs: 0, packaging: 0, warehousing: 0, insurance: 0,
  };
  const priorTotals: Record<Bucket, number> = {
    shipping: 0, freight: 0, customs: 0, packaging: 0, warehousing: 0, insurance: 0,
  };

  for (const e of current) {
    const b = classify(e.category_name);
    if (!b) continue;
    totals[b] += Number(e.amount) || 0;
  }
  for (const e of prior) {
    const b = classify(e.category_name);
    if (!b) continue;
    priorTotals[b] += Number(e.amount) || 0;
  }

  const total = ORDER.reduce((s, b) => s + totals[b], 0);
  const priorTotal = ORDER.reduce((s, b) => s + priorTotals[b], 0);
  const shareOfOpex = totalOpex > 0 ? (total / totalOpex) * 100 : 0;

  const buckets: LogisticsBucket[] = ORDER.map((b) => {
    const t = totals[b];
    const p = priorTotals[b];
    const trendPct = p > 0 ? ((t - p) / p) * 100 : (t > 0 ? 100 : 0);
    return {
      bucket: b,
      total: t,
      share: total > 0 ? (t / total) * 100 : 0,
      trend: classifyDirection(trendPct, 8),
      trendPct: Math.round(trendPct * 10) / 10,
    };
  }).filter((b) => b.total > 0);

  const headlineTrend = priorTotal > 0
    ? ((total - priorTotal) / priorTotal) * 100
    : (total > 0 ? 100 : 0);
  const trend = classifyDirection(headlineTrend, 8);

  /* Pressure rules: logistics squeezing margins. */
  let pressure: Pressure = "calm";
  if (trend === "up" && headlineTrend >= 25) pressure = "risk";
  else if (trend === "up" && headlineTrend >= 12) pressure = "watch";
  if (shareOfOpex >= 40 && pressure !== "risk") pressure = "watch";
  if (shareOfOpex >= 55) pressure = "risk";

  return {
    total: Math.round(total),
    shareOfOpex: Math.round(shareOfOpex * 10) / 10,
    buckets,
    trend,
    trendPct: Math.round(headlineTrend * 10) / 10,
    pressure,
    read: buildLogisticsRead({ total, headlineTrend, shareOfOpex, buckets }),
  };
}

function buildLogisticsRead(args: {
  total: number;
  headlineTrend: number;
  shareOfOpex: number;
  buckets: LogisticsBucket[];
}): string {
  const { total, headlineTrend, shareOfOpex, buckets } = args;
  if (total === 0) return "No logistics spend recorded for this window.";
  const bits: string[] = [];
  /* Phase 2.0.1: only report meaningful moves (≥10%). Otherwise no
     trend clause — silence is preferred to a "spend is stable" filler. */
  if (headlineTrend >= 25) bits.push(`Logistics spend ${headlineTrend.toFixed(0)}% above the prior period.`);
  else if (headlineTrend >= 10) bits.push(`Logistics spend ${headlineTrend.toFixed(0)}% higher than the prior period.`);
  else if (headlineTrend <= -10) bits.push(`Logistics spend ${Math.abs(headlineTrend).toFixed(0)}% lower than the prior period.`);
  if (shareOfOpex >= 30) bits.push(`${shareOfOpex.toFixed(0)}% of operating spend.`);
  /* Call out the spiking bucket if there is one (≥ 25% bump). */
  const spiking = [...buckets].sort((a, b) => b.trendPct - a.trendPct)[0];
  if (spiking && spiking.trendPct >= 25) {
    bits.push(`${capitalise(spiking.bucket)} is up ${spiking.trendPct.toFixed(0)}% — primary driver.`);
  }
  /* If nothing concrete fires we return empty — caller decides whether
     to suppress the tile or fall back. */
  return bits.join(" ");
}

function capitalise(s: string): string {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

/* ---------------------------------------------------------------------------
   Optional: detect category-level expense anomalies (any spike, not
   just logistics). Returned in priority order.
   --------------------------------------------------------------------------- */

export interface ExpenseAnomaly {
  category: string;
  currentTotal: number;
  priorTotal: number;
  pctChange: number;
  direction: Direction;
}

export function detectExpenseAnomalies(
  current: FinanceExpense[],
  prior: FinanceExpense[],
  threshold = 30,
): ExpenseAnomaly[] {
  const c = new Map<string, number>();
  const p = new Map<string, number>();
  for (const e of current) {
    if (!e.category_name) continue;
    c.set(e.category_name, (c.get(e.category_name) ?? 0) + (Number(e.amount) || 0));
  }
  for (const e of prior) {
    if (!e.category_name) continue;
    p.set(e.category_name, (p.get(e.category_name) ?? 0) + (Number(e.amount) || 0));
  }

  const anomalies: ExpenseAnomaly[] = [];
  for (const [cat, curr] of c) {
    const prev = p.get(cat) ?? 0;
    if (prev === 0 && curr === 0) continue;
    const pct = prev === 0 ? 100 : ((curr - prev) / prev) * 100;
    if (Math.abs(pct) < threshold) continue;
    anomalies.push({
      category: cat,
      currentTotal: curr,
      priorTotal: prev,
      pctChange: Math.round(pct * 10) / 10,
      direction: classifyDirection(pct, threshold),
    });
  }
  return anomalies.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
}

/* ---------------------------------------------------------------------------
   Helper: split a single expense list into current/prior buckets by
   date — useful when the caller fetched everything in one shot.
   --------------------------------------------------------------------------- */

export function splitByPeriod(expenses: FinanceExpense[], periodDays: number): { current: FinanceExpense[]; prior: FinanceExpense[] } {
  const current: FinanceExpense[] = [];
  const prior: FinanceExpense[] = [];
  for (const e of expenses) {
    const d = daysFromToday(e.expense_date);
    if (d == null) continue;
    if (d >= -periodDays && d <= 0) current.push(e);
    else if (d >= -2 * periodDays && d < -periodDays) prior.push(e);
  }
  return { current, prior };
}
