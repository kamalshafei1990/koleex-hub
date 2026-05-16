/* ===========================================================================
   Forecasting helpers  —  Phase 2.0

   Small, transparent forward-looking math. The system avoids
   "AI predictions" — instead it offers a few defensible linear
   projections an operator can audit at a glance.
   ========================================================================== */

import type { DashboardKpi } from "@/lib/finance/types";

/* ---------------------------------------------------------------------------
   Trend slope on a 1-D series via simple linear regression.
   Returns slope per bucket and the linear projection at `horizon` buckets.
   --------------------------------------------------------------------------- */

export function linearTrend(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((s, x) => s + x, 0) / n;
  const yMean = values.reduce((s, y) => s + y, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

export function projectAt(slope: number, intercept: number, x: number): number {
  return slope * x + intercept;
}

/* ---------------------------------------------------------------------------
   Revenue trajectory — projects next 1/2/3 buckets from the trend
   series the dashboard already loads.
   --------------------------------------------------------------------------- */

export function projectRevenue(kpi: DashboardKpi | null, buckets = 3): number[] {
  if (!kpi || kpi.trend.length < 3) return [];
  const series = kpi.trend.map((d) => d.revenue);
  const { slope, intercept } = linearTrend(series);
  const out: number[] = [];
  for (let k = 1; k <= buckets; k++) {
    out.push(Math.max(0, projectAt(slope, intercept, series.length - 1 + k)));
  }
  return out;
}
