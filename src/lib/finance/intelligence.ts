/* ===========================================================================
   Finance Intelligence  —  Phase 1.7 operational-intelligence layer.

   PURE FUNCTIONS only. Zero DOM, zero React, zero API calls. Everything
   takes the data the dashboard already has (or already loads via
   existing endpoints) and turns it into operational signals:

     · prioritiseWorkflow()       — re-orders + tints the WorkflowRail
                                     by current financial pressure.
     · computeAging()             — AR/AP aging buckets from orders.
     · buildIncomingTimeline()    — expected/overdue collections.
     · buildOutgoingTimeline()    — supplier dues + AP obligations.
     · projectLiquidity()         — 7/30/60-day cash projection from
                                     trend trajectory + AR/AP.
     · detectAnomalies()          — period-over-period spikes and
                                     compression callouts.
     · computeConcentration()     — top customer + supplier share.
     · computeCCC()               — cash conversion cycle proxy.
     · buildCopilotContext()      — proactive hints for the Copilot.

   NO API, schema, or calculation changes. Read-only intelligence on
   top of fields the existing endpoints already return.
   ========================================================================== */

import type {
  DashboardKpi,
  DashboardPeriod,
  FinanceOrder,
} from "@/lib/finance/types";

/* ---------------------------------------------------------------------------
   Shared types
   --------------------------------------------------------------------------- */

export type Pressure = "calm" | "watch" | "risk" | "critical";

export type AnomalySeverity = "info" | "watch" | "risk";

export interface AnomalySignal {
  key: string;
  label: string;        // short: "Collection velocity ↓ 22%"
  detail: string;       // longer: "Customer payments slowed vs previous quarter."
  severity: AnomalySeverity;
  direction: "up" | "down" | "flat";
  magnitudePct: number; // |delta| in %, for sorting
}

export interface AgingBucket {
  key: "current" | "1_30" | "31_60" | "61_90" | "90_plus";
  label: string;        // e.g. "1–30 days"
  amount: number;
  count: number;
}

export interface TimelineEvent {
  key: string;
  /* yyyy-mm-dd or ISO; we sort lexicographically */
  date: string;
  /* days from today; negative = overdue */
  daysFromNow: number;
  party: string;
  amount: number;
  state: "upcoming" | "due_soon" | "overdue" | "settled";
  reference: string;    // e.g. "ORD-2026-0014"
}

export interface LiquidityProjection {
  /* Net cash flow projected over each window */
  d7: number;
  d30: number;
  d60: number;
  /* Inflow pressure 0..1 (incoming relative to outgoing) */
  inflowShare: number;
  /* Net pressure label */
  pressure: Pressure;
  /* Hints derived from the projection (1–2 sentences) */
  narrative: string;
}

export interface ConcentrationSnapshot {
  topCustomer: { name: string; share: number } | null;
  topSupplier: { name: string; share: number } | null;
  /* Herfindahl-Hirschman-style concentration index, 0..1 */
  hhi: number;
}

export interface CopilotHint {
  key: string;
  text: string;
  severity: AnomalySeverity;
}

/* ---------------------------------------------------------------------------
   Pressure scoring  —  the single function the workflow rail leans on.
   --------------------------------------------------------------------------- */

export function arPressure(kpi: DashboardKpi | null): Pressure {
  const ar = kpi?.accounts_receivable ?? 0;
  const revenue = Math.max(1, kpi?.total_revenue ?? 0);
  const ratio = ar / revenue;
  if (ar === 0) return "calm";
  if (ratio >= 0.6) return "critical";
  if (ratio >= 0.35) return "risk";
  if (ratio >= 0.15) return "watch";
  return "calm";
}

export function apPressure(kpi: DashboardKpi | null): Pressure {
  const ap = kpi?.accounts_payable ?? 0;
  const ar = kpi?.accounts_receivable ?? 0;
  if (ap === 0) return "calm";
  /* If AP exceeds AR by a wide margin, the business is funding
     suppliers from working capital — escalates fast. */
  if (ar > 0 && ap > ar * 2) return "critical";
  if (ar > 0 && ap > ar * 1.3) return "risk";
  if (ap > 0) return "watch";
  return "calm";
}

export function marginPressure(kpi: DashboardKpi | null): Pressure {
  const m = kpi?.gross_margin_pct ?? 0;
  if (m < 0) return "critical";
  if (m < 10) return "risk";
  if (m < 20) return "watch";
  return "calm";
}

export function cashPressure(kpi: DashboardKpi | null): Pressure {
  const net = (kpi?.cash_in ?? 0) - (kpi?.cash_out ?? 0);
  const total = Math.max(1, kpi?.cash_out ?? 0);
  if (net >= 0) return "calm";
  if (Math.abs(net) / total >= 0.4) return "critical";
  if (Math.abs(net) / total >= 0.15) return "risk";
  return "watch";
}

/* Highest-pressure label across all dimensions — used to tint the
   header chip and switch the dashboard tone. */
export function overallPressure(kpi: DashboardKpi | null): Pressure {
  const dims: Pressure[] = [
    arPressure(kpi),
    apPressure(kpi),
    marginPressure(kpi),
    cashPressure(kpi),
  ];
  if (dims.includes("critical")) return "critical";
  if (dims.includes("risk")) return "risk";
  if (dims.includes("watch")) return "watch";
  return "calm";
}

/* ---------------------------------------------------------------------------
   Aging buckets  —  AR and AP, derived directly from orders.
   --------------------------------------------------------------------------- */

function daysFromToday(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function ageingBucketFor(daysOverdue: number): AgingBucket["key"] {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1_30";
  if (daysOverdue <= 60) return "31_60";
  if (daysOverdue <= 90) return "61_90";
  return "90_plus";
}

const BUCKET_LABELS: Record<AgingBucket["key"], string> = {
  current: "Current",
  "1_30":  "1–30 d",
  "31_60": "31–60 d",
  "61_90": "61–90 d",
  "90_plus": "90+ d",
};

export function computeArAging(orders: FinanceOrder[]): AgingBucket[] {
  const buckets: Record<AgingBucket["key"], AgingBucket> = {
    current: { key: "current", label: BUCKET_LABELS.current, amount: 0, count: 0 },
    "1_30":  { key: "1_30",    label: BUCKET_LABELS["1_30"],    amount: 0, count: 0 },
    "31_60": { key: "31_60",   label: BUCKET_LABELS["31_60"],   amount: 0, count: 0 },
    "61_90": { key: "61_90",   label: BUCKET_LABELS["61_90"],   amount: 0, count: 0 },
    "90_plus": { key: "90_plus", label: BUCKET_LABELS["90_plus"], amount: 0, count: 0 },
  };
  for (const o of orders) {
    const outstanding = o.outstanding_receivable ?? 0;
    if (outstanding <= 0) continue;
    const due = daysFromToday(o.payment_due_date);
    const overdueDays = due == null ? 0 : Math.max(0, -due);
    const key = ageingBucketFor(overdueDays);
    buckets[key].amount += outstanding;
    buckets[key].count += 1;
  }
  return Object.values(buckets);
}

export function computeApAging(orders: FinanceOrder[]): AgingBucket[] {
  const buckets: Record<AgingBucket["key"], AgingBucket> = {
    current: { key: "current", label: BUCKET_LABELS.current, amount: 0, count: 0 },
    "1_30":  { key: "1_30",    label: BUCKET_LABELS["1_30"],    amount: 0, count: 0 },
    "31_60": { key: "31_60",   label: BUCKET_LABELS["31_60"],   amount: 0, count: 0 },
    "61_90": { key: "61_90",   label: BUCKET_LABELS["61_90"],   amount: 0, count: 0 },
    "90_plus": { key: "90_plus", label: BUCKET_LABELS["90_plus"], amount: 0, count: 0 },
  };
  for (const o of orders) {
    for (const s of o.suppliers ?? []) {
      const outstanding = Math.max(0, (s.supplier_cost ?? 0) - (s.paid_amount ?? 0));
      if (outstanding <= 0) continue;
      const due = daysFromToday(s.due_date);
      const overdueDays = due == null ? 0 : Math.max(0, -due);
      const key = ageingBucketFor(overdueDays);
      buckets[key].amount += outstanding;
      buckets[key].count += 1;
    }
  }
  return Object.values(buckets);
}

/* ---------------------------------------------------------------------------
   Timelines  —  upcoming inflows / outflows over a rolling horizon.
   --------------------------------------------------------------------------- */

export function buildIncomingTimeline(orders: FinanceOrder[], horizonDays = 45): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const o of orders) {
    const outstanding = o.outstanding_receivable ?? 0;
    if (outstanding <= 0) continue;
    const due = o.payment_due_date;
    const days = daysFromToday(due);
    const state: TimelineEvent["state"] =
      days == null ? "upcoming"
      : days < 0 ? "overdue"
      : days <= 7 ? "due_soon"
      : "upcoming";
    /* Soft horizon clip — keep overdue, drop far-future. */
    if (days != null && days > horizonDays) continue;
    events.push({
      key: `in-${o.id}`,
      date: due ?? "",
      daysFromNow: days ?? 9_999,
      party: o.customer_name || "Customer",
      amount: outstanding,
      state,
      reference: o.order_no,
    });
  }
  /* Overdue first (most negative), then sooner-due. */
  return events.sort((a, b) => a.daysFromNow - b.daysFromNow);
}

export function buildOutgoingTimeline(orders: FinanceOrder[], horizonDays = 45): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const o of orders) {
    for (const s of o.suppliers ?? []) {
      const outstanding = Math.max(0, (s.supplier_cost ?? 0) - (s.paid_amount ?? 0));
      if (outstanding <= 0) continue;
      const due = s.due_date;
      const days = daysFromToday(due);
      const state: TimelineEvent["state"] =
        days == null ? "upcoming"
        : days < 0 ? "overdue"
        : days <= 7 ? "due_soon"
        : "upcoming";
      if (days != null && days > horizonDays) continue;
      events.push({
        key: `out-${s.id}`,
        date: due ?? "",
        daysFromNow: days ?? 9_999,
        party: s.supplier_name || "Supplier",
        amount: outstanding,
        state,
        reference: o.order_no,
      });
    }
  }
  return events.sort((a, b) => a.daysFromNow - b.daysFromNow);
}

/* ---------------------------------------------------------------------------
   Liquidity projection  —  forward cash position over 7/30/60 days.

   We don't have a forecast endpoint and can't add one (no API changes).
   Instead we synthesise a projection from the data already in hand:

     · burn rate = avg cash_out / period bucket (from trend series)
     · run-in   = avg cash_in / period bucket
     · adjust by AR (incoming) and AP (outgoing) actually scheduled
   --------------------------------------------------------------------------- */

export function projectLiquidity(
  kpi: DashboardKpi | null,
  period: DashboardPeriod,
  ar: TimelineEvent[],
  ap: TimelineEvent[],
): LiquidityProjection {
  if (!kpi) {
    return { d7: 0, d30: 0, d60: 0, inflowShare: 0.5, pressure: "calm",
      narrative: "Awaiting financial data…" };
  }
  /* Days per bucket in the trend series */
  const bucketDays =
    period === "week" ? 1
    : period === "quarter" ? 7
    : 30;
  const buckets = kpi.trend.length || 1;
  const totalCashIn = kpi.cash_in ?? 0;
  const totalCashOut = kpi.cash_out ?? 0;
  const periodDays = bucketDays * buckets;
  const dailyIn = totalCashIn / Math.max(1, periodDays);
  const dailyOut = totalCashOut / Math.max(1, periodDays);

  const window = (days: number): number => {
    const arInWindow = ar
      .filter((e) => e.daysFromNow <= days)
      .reduce((s, e) => s + e.amount, 0);
    const apInWindow = ap
      .filter((e) => e.daysFromNow <= days)
      .reduce((s, e) => s + e.amount, 0);
    /* Steady-state contribution capped to remaining capacity */
    const baselineIn = dailyIn * days;
    const baselineOut = dailyOut * days;
    return baselineIn + arInWindow - baselineOut - apInWindow;
  };

  const d7 = window(7);
  const d30 = window(30);
  const d60 = window(60);

  const totalInflow = dailyIn * 30 + ar.filter((e) => e.daysFromNow <= 30).reduce((s, e) => s + e.amount, 0);
  const totalOutflow = dailyOut * 30 + ap.filter((e) => e.daysFromNow <= 30).reduce((s, e) => s + e.amount, 0);
  const inflowShare = totalInflow + totalOutflow > 0
    ? totalInflow / (totalInflow + totalOutflow)
    : 0.5;

  /* Pressure: if both 7d and 30d are red, that's critical. */
  let pressure: Pressure = "calm";
  if (d7 < 0 && d30 < 0) pressure = "critical";
  else if (d30 < 0) pressure = "risk";
  else if (inflowShare < 0.45) pressure = "watch";

  const narrative = (() => {
    if (pressure === "critical")
      return "Negative cash window in both 7 and 30 days. Prioritise collections and defer non-essential outflows.";
    if (pressure === "risk")
      return "30-day projection is negative. Watch AR closely and stagger supplier payments where possible.";
    if (pressure === "watch")
      return "Inflows are lagging outflows. Liquidity stable for now but momentum is soft.";
    return "Cash window healthy across 7, 30, and 60 days.";
  })();

  return { d7, d30, d60, inflowShare, pressure, narrative };
}

/* ---------------------------------------------------------------------------
   Anomaly detection  —  spot unusual operational behaviour.

   Anomalies come from two places:
     · Period-over-period deltas (the API already gives us these).
     · Concentration thresholds on top_orders / top_expense_categories.
   --------------------------------------------------------------------------- */

export function detectAnomalies(kpi: DashboardKpi | null): AnomalySignal[] {
  if (!kpi) return [];
  const out: AnomalySignal[] = [];

  /* Period-over-period spikes — only flag if previous period had
     activity AND the delta is material (>= 20%). */
  const dims: { key: string; pct: number | null; label: string; goodDirection: 1 | -1 }[] = [
    { key: "revenue",     pct: kpi.delta.revenue_pct,    label: "Revenue",          goodDirection:  1 },
    { key: "expenses",    pct: kpi.delta.expenses_pct,   label: "Operating spend",  goodDirection: -1 },
    { key: "gross_profit",pct: kpi.delta.gross_profit_pct, label: "Gross profit",   goodDirection:  1 },
    { key: "net_profit",  pct: kpi.delta.net_profit_pct, label: "Net profit",       goodDirection:  1 },
    { key: "cash_in",     pct: kpi.delta.cash_in_pct,    label: "Cash inflow",      goodDirection:  1 },
    { key: "cash_out",    pct: kpi.delta.cash_out_pct,   label: "Cash outflow",     goodDirection: -1 },
  ];
  for (const d of dims) {
    if (d.pct == null) continue;
    const mag = Math.abs(d.pct);
    if (mag < 20) continue;
    const direction: AnomalySignal["direction"] = d.pct > 0 ? "up" : d.pct < 0 ? "down" : "flat";
    const isBad =
      (d.goodDirection === 1 && direction === "down") ||
      (d.goodDirection === -1 && direction === "up");
    const severity: AnomalySeverity =
      mag >= 50 && isBad ? "risk"
      : mag >= 30 && isBad ? "watch"
      : mag >= 50 && !isBad ? "info"
      : "info";
    out.push({
      key: `delta-${d.key}`,
      label: `${d.label} ${direction === "up" ? "↑" : "↓"} ${mag.toFixed(0)}%`,
      detail: `${d.label} ${direction === "up" ? "rose" : "fell"} ${mag.toFixed(0)}% vs the previous period.`,
      severity,
      direction,
      magnitudePct: mag,
    });
  }

  /* Top expense concentration */
  const topCat = kpi.top_expense_categories?.[0];
  if (topCat && topCat.share_pct >= 45) {
    out.push({
      key: `expense-concentration-${topCat.name}`,
      label: `${topCat.name} ${topCat.share_pct.toFixed(0)}% of spend`,
      detail: `${topCat.name} dominates operating spend this period.`,
      severity: topCat.share_pct >= 60 ? "watch" : "info",
      direction: "up",
      magnitudePct: topCat.share_pct,
    });
  }

  /* Customer concentration */
  const top = kpi.top_orders?.[0];
  if (top && kpi.total_revenue > 0) {
    const share = (top.selling_price / kpi.total_revenue) * 100;
    if (share >= 40) {
      out.push({
        key: `customer-concentration-${top.id}`,
        label: `${top.customer_name || "Top customer"} ${share.toFixed(0)}% of revenue`,
        detail: `Single-customer revenue concentration is elevated.`,
        severity: share >= 60 ? "risk" : "watch",
        direction: "up",
        magnitudePct: share,
      });
    }
  }

  /* Sort by severity then magnitude */
  const sevRank: Record<AnomalySeverity, number> = { risk: 0, watch: 1, info: 2 };
  return out.sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || b.magnitudePct - a.magnitudePct);
}

/* ---------------------------------------------------------------------------
   Concentration snapshot  —  top customer + supplier with HHI.
   --------------------------------------------------------------------------- */

export function computeConcentration(kpi: DashboardKpi | null, orders: FinanceOrder[]): ConcentrationSnapshot {
  /* Top customer is already in kpi.top_orders */
  const top = kpi?.top_orders?.[0];
  const topCustomer = top && (kpi?.total_revenue ?? 0) > 0
    ? { name: top.customer_name || "Top customer", share: (top.selling_price / kpi!.total_revenue) * 100 }
    : null;

  /* Top supplier requires summing across orders */
  const supplierTotals = new Map<string, number>();
  let supplierGrandTotal = 0;
  for (const o of orders) {
    for (const s of o.suppliers ?? []) {
      const cost = s.supplier_cost ?? 0;
      if (cost <= 0) continue;
      const name = s.supplier_name || "Supplier";
      supplierTotals.set(name, (supplierTotals.get(name) ?? 0) + cost);
      supplierGrandTotal += cost;
    }
  }
  let topSupplier: ConcentrationSnapshot["topSupplier"] = null;
  let topVal = 0;
  for (const [name, val] of supplierTotals) {
    if (val > topVal) { topVal = val; topSupplier = { name, share: 0 }; }
  }
  if (topSupplier && supplierGrandTotal > 0) {
    topSupplier.share = (topVal / supplierGrandTotal) * 100;
  }

  /* HHI on supplier side, normalised to 0..1 */
  let hhi = 0;
  if (supplierGrandTotal > 0) {
    for (const val of supplierTotals.values()) {
      const share = val / supplierGrandTotal;
      hhi += share * share;
    }
  }
  return { topCustomer, topSupplier, hhi };
}

/* ---------------------------------------------------------------------------
   CCC proxy  —  days between paying suppliers and getting paid.
   We don't have invoice-level dates, so we approximate via:
     DSO  ≈ AR / dailyRevenue
     DPO  ≈ AP / dailySupplierCost
     CCC  ≈ DSO − DPO   (inventory leg omitted by design)
   --------------------------------------------------------------------------- */

export function computeCCC(kpi: DashboardKpi | null, period: DashboardPeriod): { dso: number; dpo: number; ccc: number } {
  if (!kpi) return { dso: 0, dpo: 0, ccc: 0 };
  const periodDays = period === "week" ? 7 : period === "quarter" ? 90 : 365;
  const dailyRevenue = (kpi.total_revenue ?? 0) / Math.max(1, periodDays);
  const dailySupplier = (kpi.total_supplier_cost ?? 0) / Math.max(1, periodDays);
  const dso = dailyRevenue > 0 ? (kpi.accounts_receivable ?? 0) / dailyRevenue : 0;
  const dpo = dailySupplier > 0 ? (kpi.accounts_payable ?? 0) / dailySupplier : 0;
  return { dso, dpo, ccc: dso - dpo };
}

/* ---------------------------------------------------------------------------
   Copilot context  —  small list of proactive operational hints.
   Returned in priority order; the Copilot panel surfaces the top 4.
   --------------------------------------------------------------------------- */

export function buildCopilotContext(args: {
  kpi: DashboardKpi | null;
  ar: TimelineEvent[];
  ap: TimelineEvent[];
  liquidity: LiquidityProjection;
  concentration: ConcentrationSnapshot;
  anomalies: AnomalySignal[];
}): CopilotHint[] {
  const { kpi, ar, ap, liquidity, concentration, anomalies } = args;
  const out: CopilotHint[] = [];

  if (!kpi) return out;

  /* 1) Overdue AR */
  const overdueAr = ar.filter((e) => e.state === "overdue");
  if (overdueAr.length > 0) {
    const total = overdueAr.reduce((s, e) => s + e.amount, 0);
    out.push({
      key: "ar-overdue",
      severity: overdueAr.length >= 3 ? "risk" : "watch",
      text: `${overdueAr.length} customer ${overdueAr.length === 1 ? "invoice" : "invoices"} overdue · ${shortMoney(total)} pending collection.`,
    });
  }

  /* 2) Supplier dues this week */
  const dueSoonAp = ap.filter((e) => e.state === "due_soon" || e.state === "overdue");
  if (dueSoonAp.length > 0) {
    const total = dueSoonAp.reduce((s, e) => s + e.amount, 0);
    out.push({
      key: "ap-due-soon",
      severity: ap.some((e) => e.state === "overdue") ? "risk" : "watch",
      text: `${dueSoonAp.length} supplier ${dueSoonAp.length === 1 ? "payment" : "payments"} due within 7 days · ${shortMoney(total)}.`,
    });
  }

  /* 3) Liquidity narrative */
  if (liquidity.pressure !== "calm") {
    out.push({
      key: "liquidity",
      severity: liquidity.pressure === "critical" ? "risk" : "watch",
      text: liquidity.narrative,
    });
  }

  /* 4) Concentration */
  if (concentration.topCustomer && concentration.topCustomer.share >= 40) {
    out.push({
      key: "concentration-customer",
      severity: concentration.topCustomer.share >= 60 ? "risk" : "watch",
      text: `${concentration.topCustomer.name} represents ${concentration.topCustomer.share.toFixed(0)}% of revenue this period.`,
    });
  }
  if (concentration.topSupplier && concentration.topSupplier.share >= 50) {
    out.push({
      key: "concentration-supplier",
      severity: concentration.topSupplier.share >= 70 ? "risk" : "watch",
      text: `${concentration.topSupplier.name} supplies ${concentration.topSupplier.share.toFixed(0)}% of cost of goods.`,
    });
  }

  /* 5) Anomalies — only the top one to avoid noise */
  const topAnomaly = anomalies[0];
  if (topAnomaly && topAnomaly.severity !== "info") {
    out.push({
      key: `anomaly-${topAnomaly.key}`,
      severity: topAnomaly.severity,
      text: topAnomaly.detail,
    });
  }

  /* 6) Healthy fallback */
  if (out.length === 0) {
    out.push({
      key: "calm",
      severity: "info",
      text: "All operational signals are calm. No urgent finance actions queued.",
    });
  }
  return out;
}

/* Compact money helper — keeps imports light for callers. */
function shortMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M USD`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K USD`;
  return `${n.toFixed(0)} USD`;
}

/* ---------------------------------------------------------------------------
   Workflow prioritisation  —  pure ordering function consumed by the
   FinanceDashboard. Takes the current pressure landscape and returns a
   stable but priority-ordered list of workflow keys with severity tags.

   The dashboard renders icons + labels itself; this just answers
   "what's most urgent right now?".
   --------------------------------------------------------------------------- */

export type WorkflowKey =
  | "follow-up"
  | "pay-suppliers"
  | "add-expense"
  | "record-payment"
  | "new-order"
  | "reminders";

export interface PrioritisedWorkflow {
  key: WorkflowKey;
  pressure: Pressure;
  reason: string;
}

export function prioritiseWorkflow(kpi: DashboardKpi | null): PrioritisedWorkflow[] {
  const arP = arPressure(kpi);
  const apP = apPressure(kpi);
  const cashP = cashPressure(kpi);

  const items: PrioritisedWorkflow[] = [
    { key: "follow-up",      pressure: arP,
      reason: arP === "calm" ? "All receivables current"
            : arP === "watch" ? "Some AR outstanding"
            : arP === "risk"  ? "Material AR exposure"
            : "Severe AR exposure" },
    { key: "pay-suppliers",  pressure: apP,
      reason: apP === "calm" ? "Nothing pending"
            : apP === "watch" ? "AP queue building"
            : apP === "risk"  ? "AP exceeds AR margin"
            : "AP exceeds AR materially" },
    { key: "record-payment", pressure: cashP === "calm" ? "calm" : "watch",
      reason: cashP === "calm" ? "Capture inflows/outflows" : "Update cash position" },
    { key: "add-expense",    pressure: "calm", reason: "Fast operational entry" },
    { key: "new-order",      pressure: "calm", reason: "Start a profit run" },
    { key: "reminders",      pressure: "calm", reason: "Severity-sorted center" },
  ];

  /* Sort by pressure DESC, then preserve insertion order. */
  const rank: Record<Pressure, number> = { critical: 0, risk: 1, watch: 2, calm: 3 };
  return items
    .map((it, idx) => ({ it, idx }))
    .sort((a, b) => rank[a.it.pressure] - rank[b.it.pressure] || a.idx - b.idx)
    .map(({ it }) => it);
}
