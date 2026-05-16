/* ===========================================================================
   Treasury Forecast Engine — Phase 2.8
   ----------------------------------------------------------------------------
   Deterministic cash-position projection + stress simulation.

   Inputs: existing finance + treasury rows (bank accounts, orders,
   payments, cash movements, expenses). No new data model.

   The engine builds a per-day trajectory in reporting currency from
   today out to a 90-day horizon, then projects:

     · cash position at each day
     · projected cash at 7 / 30 / 60 / 90 days
     · lowest projected point + its date
     · first negative-cash date (if any)
     · runway days (until cash crosses zero)
     · biggest liquidity drivers (which input contributes the most outflow)

   Scenario assumptions mutate the event stream BEFORE projection:

     · customerDelay        — shift inbound events later
     · supplierAcceleration — shift outbound events earlier
     · fxShock              — translate non-reporting-currency amounts
                              with an adverse FX move
     · costShock            — scale all outflows up
     · revenueDrop          — scale all inflows down

   Every result carries assumptions + drivers + confidence + limitations
   so the UI can render an explainable forecast — no black-box numbers.

   Pure functions only. No fetch, no React, no DB.
   ========================================================================== */

import type {
  BankAccount,
  CashMovement,
  FinanceExpense,
  FinanceOrder,
  FinancePayment,
} from "@/lib/finance/types";

/* ────────────────────────────────────────────────────────────────────────
   Reporting currency + FX translation. Mirrors treasury.ts so the
   forecast totals line up with the dashboard's treasury panel.
   ──────────────────────────────────────────────────────────────────────── */

export const REPORTING_CURRENCY = "USD";

const FX_TABLE: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.26,
  CNY: 0.139,
  EGP: 0.020,
};

function fxRate(currency: string): number {
  return FX_TABLE[currency] ?? 1.0;
}

function toReporting(amount: number, currency: string): number {
  return amount * fxRate(currency);
}

function daysFromToday(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  const now = Date.now();
  return Math.round((d - now) / 86_400_000);
}

function shiftDateIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ────────────────────────────────────────────────────────────────────────
   Public types
   ──────────────────────────────────────────────────────────────────────── */

export type CashEventSource =
  | "customer_collect"          // from a finance_payments inflow row
  | "customer_collect_forecast" // derived from orders[].outstanding_receivable
  | "supplier_due"              // from a finance_payments outflow row
  | "supplier_due_forecast"     // derived from order_suppliers[]
  | "expense_due"               // from finance_expenses
  | "scheduled_movement"        // a forward cash movement
  | "tax_refund";

export interface CashEvent {
  key: string;
  /** yyyy-mm-dd in the event's own timezone (we treat as UTC date). */
  date: string;
  daysFromNow: number;
  direction: "inflow" | "outflow";
  source: CashEventSource;
  /** Human party (customer / supplier / counterparty). */
  party: string;
  /** Stable id of the underlying entity for scenario filtering. */
  entityId?: string;
  /** Stable id of the related customer when known (for customer-delay
   *  scenarios that target specific customers). */
  customerId?: string;
  /** Stable id of the related supplier when known (for supplier-
   *  acceleration scenarios that target specific suppliers). */
  supplierId?: string;
  /** Native amount + currency. */
  amount: number;
  currency: string;
  /** Confidence weight applied to the event when projecting (0..1).
   *  Scheduled bank movements 1.0; approved payments ~0.85; AR
   *  forecasts ~0.6. The forecast multiplies by this factor. */
  confidence: number;
}

export interface ForecastDayPoint {
  /** yyyy-mm-dd. */
  date: string;
  daysFromNow: number;
  /** Cumulative projected cash on this day (reporting currency). */
  cumulative: number;
  /** Sum of inflows that day (reporting currency, confidence-weighted). */
  inflowDay: number;
  /** Sum of outflows that day (reporting currency, confidence-weighted). */
  outflowDay: number;
}

export interface ScenarioAssumptions {
  /** Delay inbound (customer) events by N days. When `customerIds`
   *  is set, only those customers shift; otherwise every customer
   *  collection shifts. */
  customerDelay?: { customerIds?: string[]; days: number };
  /** Move outbound (supplier) events earlier by N days. */
  supplierAcceleration?: { supplierIds?: string[]; days: number };
  /** Adverse FX move against the reporting currency. `currency`
   *  optional — when omitted, all non-reporting currencies shock. */
  fxShock?: { currency?: string; pct: number };
  /** Scale every outflow up. */
  costShock?: { pct: number };
  /** Scale every inflow down. */
  revenueDrop?: { pct: number };
}

export interface ForecastDrivers {
  /** Ranked top liquidity-pressure entries — by absolute reporting-
   *  currency outflow within the horizon. */
  topOutflows: Array<{
    key: string;
    party: string;
    amountReporting: number;
    daysFromNow: number;
    source: CashEventSource;
  }>;
  /** Ranked top inflow drivers — equivalent. */
  topInflows: Array<{
    key: string;
    party: string;
    amountReporting: number;
    daysFromNow: number;
    source: CashEventSource;
  }>;
}

export interface ForecastResult {
  /** The full daily cash trajectory. */
  trajectory: ForecastDayPoint[];
  /** Buckets for headline cards. */
  startingCash: number;
  d7: number;
  d30: number;
  d60: number;
  d90: number;
  /** Worst projected position in the horizon. */
  lowestProjected: number;
  lowestProjectedDate: string | null;
  /** First day the projection crosses zero. null when it never does. */
  firstNegativeDate: string | null;
  /** Runway days = day index of first negative (or `null`). */
  runwayDays: number | null;
  /** Sums over the horizon. */
  totalInflow: number;
  totalOutflow: number;
  /** Composite confidence — average of event confidences weighted
   *  by absolute reporting-currency amount. */
  confidence: number;
  /** What inputs drove the trajectory. */
  drivers: ForecastDrivers;
  /** Assumption ledger — what knobs were set + which inputs they
   *  touched. Used by the UI's "explainable forecast" panel and by
   *  the intelligence layer when synthesising forecast events. */
  assumptions: AppliedAssumption[];
  /** Limitations the engine is honest about. */
  limitations: string[];
  /** The events fed into the projection AFTER assumptions applied. */
  events: CashEvent[];
  /** Horizon in days. */
  horizonDays: number;
}

export interface AppliedAssumption {
  /** Stable key for the UI ("customer_delay" / "fx_shock" / …). */
  key: string;
  /** Human-readable description ("Customer payments delayed by 15 days"). */
  label: string;
  /** Number of events the assumption modified. */
  affectedEventCount: number;
  /** Reporting-currency impact vs base (positive when scenario
   *  reduces cash, negative when it helps). */
  cashImpact: number;
}

export interface ForecastDiff {
  /** Per-day diff = stress.cumulative − base.cumulative. */
  perDay: Array<{ date: string; daysFromNow: number; delta: number }>;
  /** Headline differences. */
  d7Delta: number;
  d30Delta: number;
  d60Delta: number;
  d90Delta: number;
  lowestDelta: number;
  /** Days runway shifted: stress.runway − base.runway (null if either side has none). */
  runwayDelta: number | null;
  /** Cumulative cash impact at horizon: `stress.d90 − base.d90`. */
  totalImpact: number;
  /** Sign of the headline diff: "improves" / "neutral" / "deteriorates". */
  direction: "improves" | "neutral" | "deteriorates";
}

/* ────────────────────────────────────────────────────────────────────────
   Event extraction — pulls cash events from the existing data model.
   Mirrors the Phase 2.4 treasury timeline but expands to a 90-day
   horizon and adds expense due dates + scheduled cash movements.
   ──────────────────────────────────────────────────────────────────────── */

export interface ForecastInputs {
  bankAccounts: BankAccount[];
  orders: FinanceOrder[];
  payments: FinancePayment[];
  cashMovements: CashMovement[];
  expenses?: FinanceExpense[];
  /** Forecast horizon in days. Default 90. */
  horizonDays?: number;
  /** Floor for individual events (skip dust). Default 0 (keep all). */
  minEventAmount?: number;
}

function extractEvents(input: ForecastInputs): CashEvent[] {
  const horizon = input.horizonDays ?? 90;
  const events: CashEvent[] = [];

  /* Scheduled / pending cash movements — high confidence (1.0). */
  for (const m of input.cashMovements) {
    if (m.reconciliation_status !== "unreconciled") continue;
    if (m.cleared_at) continue;
    const days = daysFromToday(m.movement_date);
    if (days == null || days < 0 || days > horizon) continue;
    if ((input.minEventAmount ?? 0) > Math.abs(m.amount)) continue;
    events.push({
      key: `movement:${m.id}`,
      date: m.movement_date,
      daysFromNow: days,
      direction: m.direction,
      source: "scheduled_movement",
      party: m.counterparty_name ?? m.bank_reference ?? "Movement",
      entityId: m.id,
      amount: m.amount,
      currency: m.currency,
      confidence: 1.0,
    });
  }

  /* Approved + pending finance_payments. */
  for (const p of input.payments) {
    const reconciled = ["matched", "verified"].includes(p.reconciliation_status ?? "");
    if (reconciled) continue;
    if (p.status === "cancelled" || p.status === "bounced") continue;
    const days = daysFromToday(p.payment_date);
    if (days == null || days < 0 || days > horizon) continue;
    const amount = Number(p.expected_amount ?? p.amount ?? 0);
    if (amount <= 0) continue;
    const confidence = p.approval_status === "approved" ? 0.85
                     : p.approval_status === "submitted" ? 0.70
                     : 0.50;
    events.push({
      key: `payment:${p.id}`,
      date: p.payment_date,
      daysFromNow: days,
      direction: p.direction === "in" ? "inflow" : "outflow",
      source: p.direction === "in" ? "customer_collect" : "supplier_due",
      party: p.party_name || (p.party_type === "supplier" ? "Supplier" : "Party"),
      entityId: p.id,
      customerId: p.direction === "in" ? (p.party_id ?? undefined) : undefined,
      supplierId: p.direction === "out" ? (p.party_id ?? undefined) : undefined,
      amount,
      currency: p.currency,
      confidence,
    });
  }

  /* AR forecasts from orders[].outstanding_receivable. */
  for (const o of input.orders) {
    const outstanding = Number(o.outstanding_receivable ?? 0);
    if (outstanding <= 0) continue;
    if (!o.payment_due_date) continue;
    const days = daysFromToday(o.payment_due_date);
    if (days == null || days > horizon) continue;
    /* Overdue receivables: keep them in the window but flag low-
       confidence — they pull cash forward when actually collected. */
    const isOverdue = days < 0;
    events.push({
      key: `order-ar:${o.id}`,
      date: isOverdue ? new Date().toISOString().slice(0, 10) : o.payment_due_date,
      daysFromNow: Math.max(0, days),
      direction: "inflow",
      source: "customer_collect_forecast",
      party: o.customer_name || "Customer",
      entityId: o.id,
      customerId: o.customer_id ?? undefined,
      amount: outstanding,
      currency: o.currency,
      confidence: isOverdue ? 0.35 : 0.6,
    });
  }

  /* AP forecasts from order_suppliers. */
  for (const o of input.orders) {
    for (const s of o.suppliers ?? []) {
      const outstanding = Math.max(0, Number(s.supplier_cost ?? 0) - Number(s.paid_amount ?? 0));
      if (outstanding <= 0) continue;
      if (!s.due_date) continue;
      const days = daysFromToday(s.due_date);
      if (days == null || days > horizon) continue;
      const isOverdue = days < 0;
      events.push({
        key: `order-ap:${s.id}`,
        date: isOverdue ? new Date().toISOString().slice(0, 10) : s.due_date,
        daysFromNow: Math.max(0, days),
        direction: "outflow",
        source: "supplier_due_forecast",
        party: s.supplier_name || "Supplier",
        entityId: s.id,
        supplierId: s.supplier_id ?? undefined,
        amount: outstanding,
        currency: s.currency,
        confidence: isOverdue ? 0.9 : 0.7,
      });
    }
  }

  /* Expense due dates — recurring rents, utilities, salaries. */
  for (const e of input.expenses ?? []) {
    if (e.payment_status === "paid") continue;
    const dueIso = e.due_date ?? e.expense_date;
    if (!dueIso) continue;
    const days = daysFromToday(dueIso);
    if (days == null || days > horizon) continue;
    const amount = Number(e.amount ?? 0);
    if (amount <= 0) continue;
    events.push({
      key: `expense:${e.id}`,
      date: dueIso,
      daysFromNow: Math.max(0, days),
      direction: "outflow",
      source: "expense_due",
      party: e.title ?? "Expense",
      entityId: e.id,
      amount,
      currency: e.currency,
      confidence: 0.8,
    });
  }

  return events.sort((a, b) => a.daysFromNow - b.daysFromNow || a.date.localeCompare(b.date));
}

/* ────────────────────────────────────────────────────────────────────────
   Apply scenario assumptions.

   Returns a fresh event array (input is never mutated) plus the
   appliedAssumptions ledger so the UI can show what changed.
   ──────────────────────────────────────────────────────────────────────── */

export function applyScenarioAssumptions(
  events: CashEvent[],
  assumptions: ScenarioAssumptions | null | undefined,
  horizonDays: number,
): { events: CashEvent[]; applied: AppliedAssumption[] } {
  if (!assumptions) return { events, applied: [] };
  const applied: AppliedAssumption[] = [];
  let out = events.slice();

  /* — customer delay — */
  if (assumptions.customerDelay && assumptions.customerDelay.days > 0) {
    const targetIds = assumptions.customerDelay.customerIds;
    let count = 0;
    out = out.map((e) => {
      const isCustomer = e.direction === "inflow" && (e.source === "customer_collect" || e.source === "customer_collect_forecast");
      if (!isCustomer) return e;
      if (targetIds && targetIds.length > 0) {
        if (!e.customerId || !targetIds.includes(e.customerId)) return e;
      }
      count += 1;
      const newDays = Math.min(horizonDays, e.daysFromNow + assumptions.customerDelay!.days);
      return {
        ...e,
        daysFromNow: newDays,
        date: shiftDateIso(e.date, assumptions.customerDelay!.days),
      };
    });
    const movedAmount = events
      .filter((e) => e.direction === "inflow" && (e.source === "customer_collect" || e.source === "customer_collect_forecast"))
      .filter((e) => !targetIds?.length || (e.customerId && targetIds.includes(e.customerId)))
      .reduce((s, e) => s + toReporting(e.amount, e.currency) * e.confidence, 0);
    applied.push({
      key: "customer_delay",
      label: targetIds?.length
        ? `Selected customers delayed by ${assumptions.customerDelay.days} days`
        : `All customer payments delayed by ${assumptions.customerDelay.days} days`,
      affectedEventCount: count,
      cashImpact: movedAmount,
    });
  }

  /* — supplier acceleration — */
  if (assumptions.supplierAcceleration && assumptions.supplierAcceleration.days > 0) {
    const targetIds = assumptions.supplierAcceleration.supplierIds;
    let count = 0;
    out = out.map((e) => {
      const isSupplier = e.direction === "outflow" && (e.source === "supplier_due" || e.source === "supplier_due_forecast");
      if (!isSupplier) return e;
      if (targetIds && targetIds.length > 0) {
        if (!e.supplierId || !targetIds.includes(e.supplierId)) return e;
      }
      count += 1;
      const newDays = Math.max(0, e.daysFromNow - assumptions.supplierAcceleration!.days);
      return {
        ...e,
        daysFromNow: newDays,
        date: shiftDateIso(e.date, -assumptions.supplierAcceleration!.days),
      };
    });
    const movedAmount = events
      .filter((e) => e.direction === "outflow" && (e.source === "supplier_due" || e.source === "supplier_due_forecast"))
      .filter((e) => !targetIds?.length || (e.supplierId && targetIds.includes(e.supplierId)))
      .reduce((s, e) => s + toReporting(e.amount, e.currency) * e.confidence, 0);
    applied.push({
      key: "supplier_acceleration",
      label: targetIds?.length
        ? `Selected suppliers accelerated by ${assumptions.supplierAcceleration.days} days`
        : `All supplier payments accelerated by ${assumptions.supplierAcceleration.days} days`,
      affectedEventCount: count,
      cashImpact: movedAmount,
    });
  }

  /* — FX shock — */
  if (assumptions.fxShock && assumptions.fxShock.pct !== 0) {
    const pct = Math.abs(assumptions.fxShock.pct);
    const targetCurrency = assumptions.fxShock.currency;
    let count = 0;
    out = out.map((e) => {
      const matches = !targetCurrency
        ? e.currency !== REPORTING_CURRENCY
        : e.currency === targetCurrency;
      if (!matches) return e;
      count += 1;
      /* Adverse FX move: non-reporting amounts translate at a worse
         rate. For inflows this means less reporting cash; for
         outflows this means more reporting cash needed. We scale the
         NATIVE amount in two directions so projection math is correct. */
      const adverse = e.direction === "inflow" ? 1 - pct / 100 : 1 + pct / 100;
      return { ...e, amount: e.amount * adverse };
    });
    const beforeAdj = events
      .filter((e) => !targetCurrency ? e.currency !== REPORTING_CURRENCY : e.currency === targetCurrency)
      .reduce((s, e) => s + toReporting(e.amount, e.currency) * e.confidence * (e.direction === "inflow" ? 1 : -1), 0);
    const adverse = (1 - pct / 100);
    const afterAdj = beforeAdj * adverse;
    applied.push({
      key: "fx_shock",
      label: targetCurrency
        ? `FX shock −${pct}% on ${targetCurrency}`
        : `FX shock −${pct}% on all non-${REPORTING_CURRENCY} flows`,
      affectedEventCount: count,
      cashImpact: Math.abs(beforeAdj - afterAdj),
    });
  }

  /* — cost shock (scale outflows up) — */
  if (assumptions.costShock && assumptions.costShock.pct > 0) {
    const factor = 1 + assumptions.costShock.pct / 100;
    let count = 0;
    out = out.map((e) => {
      if (e.direction !== "outflow") return e;
      count += 1;
      return { ...e, amount: e.amount * factor };
    });
    const outflowsBase = events.filter((e) => e.direction === "outflow")
      .reduce((s, e) => s + toReporting(e.amount, e.currency) * e.confidence, 0);
    applied.push({
      key: "cost_shock",
      label: `All outflows scaled up by ${assumptions.costShock.pct}%`,
      affectedEventCount: count,
      cashImpact: outflowsBase * (factor - 1),
    });
  }

  /* — revenue drop (scale inflows down) — */
  if (assumptions.revenueDrop && assumptions.revenueDrop.pct > 0) {
    const factor = 1 - assumptions.revenueDrop.pct / 100;
    let count = 0;
    out = out.map((e) => {
      if (e.direction !== "inflow") return e;
      count += 1;
      return { ...e, amount: e.amount * Math.max(0, factor) };
    });
    const inflowsBase = events.filter((e) => e.direction === "inflow")
      .reduce((s, e) => s + toReporting(e.amount, e.currency) * e.confidence, 0);
    applied.push({
      key: "revenue_drop",
      label: `All inflows scaled down by ${assumptions.revenueDrop.pct}%`,
      affectedEventCount: count,
      cashImpact: inflowsBase * (1 - factor),
    });
  }

  /* Resort because event days/dates may have shifted. */
  out = out.sort((a, b) => a.daysFromNow - b.daysFromNow || a.date.localeCompare(b.date));
  return { events: out, applied };
}

/* ────────────────────────────────────────────────────────────────────────
   Project cash — walks the event stream day by day.
   ──────────────────────────────────────────────────────────────────────── */

function projectTrajectory(
  startingCash: number,
  events: CashEvent[],
  horizonDays: number,
): {
  trajectory: ForecastDayPoint[];
  lowestProjected: number;
  lowestProjectedDate: string | null;
  firstNegativeDate: string | null;
  runwayDays: number | null;
  totalInflow: number;
  totalOutflow: number;
} {
  /* Group events by daysFromNow so the trajectory grows monotonically. */
  const byDay = new Map<number, { in: number; out: number }>();
  let totalInflow = 0;
  let totalOutflow = 0;
  for (const e of events) {
    const reporting = toReporting(e.amount, e.currency) * e.confidence;
    const bucket = byDay.get(e.daysFromNow) ?? { in: 0, out: 0 };
    if (e.direction === "inflow") {
      bucket.in += reporting;
      totalInflow += reporting;
    } else {
      bucket.out += reporting;
      totalOutflow += reporting;
    }
    byDay.set(e.daysFromNow, bucket);
  }

  const trajectory: ForecastDayPoint[] = [];
  let cum = startingCash;
  let lowest = startingCash;
  let lowestDate: string | null = null;
  let firstNegativeDate: string | null = null;
  let runwayDays: number | null = null;

  const today = new Date();
  for (let d = 0; d <= horizonDays; d += 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + d);
    const iso = date.toISOString().slice(0, 10);
    const bucket = byDay.get(d) ?? { in: 0, out: 0 };
    cum += bucket.in - bucket.out;
    if (cum < lowest) {
      lowest = cum;
      lowestDate = iso;
    }
    if (cum < 0 && firstNegativeDate == null) {
      firstNegativeDate = iso;
      runwayDays = d;
    }
    trajectory.push({
      date: iso,
      daysFromNow: d,
      cumulative: cum,
      inflowDay: bucket.in,
      outflowDay: bucket.out,
    });
  }

  return {
    trajectory,
    lowestProjected: lowest,
    lowestProjectedDate: lowestDate,
    firstNegativeDate,
    runwayDays,
    totalInflow,
    totalOutflow,
  };
}

function bucketAt(trajectory: ForecastDayPoint[], day: number): number {
  if (trajectory.length === 0) return 0;
  const clamped = Math.min(day, trajectory[trajectory.length - 1].daysFromNow);
  const point = trajectory.find((p) => p.daysFromNow === clamped);
  return point?.cumulative ?? trajectory[trajectory.length - 1].cumulative;
}

/* ────────────────────────────────────────────────────────────────────────
   Build forecast — orchestration entry point.
   ──────────────────────────────────────────────────────────────────────── */

export function buildTreasuryForecast(
  input: ForecastInputs,
  assumptions?: ScenarioAssumptions | null,
): ForecastResult {
  const horizonDays = input.horizonDays ?? 90;

  /* Starting cash = sum of available_balance for ACTIVE accounts,
     translated to reporting currency. We exclude restricted + pending
     deliberately — restricted is not spendable and pending isn't real
     cash yet. The Phase 2.4 dashboard's "available" line uses the
     same definition. */
  const startingCash = input.bankAccounts
    .filter((a) => a.status === "active")
    .reduce((s, a) => s + toReporting(a.available_balance, a.currency), 0);

  const baseEvents = extractEvents(input);
  const { events: scenarioEvents, applied } = applyScenarioAssumptions(baseEvents, assumptions, horizonDays);

  const projected = projectTrajectory(startingCash, scenarioEvents, horizonDays);

  /* Composite confidence — weighted by absolute reporting amount. */
  let totalWeight = 0;
  let confidenceSum = 0;
  for (const e of scenarioEvents) {
    const w = toReporting(e.amount, e.currency);
    totalWeight += w;
    confidenceSum += w * e.confidence;
  }
  const confidence = totalWeight > 0 ? confidenceSum / totalWeight : 1;

  /* Drivers — top 5 outflows + top 5 inflows by absolute reporting amount. */
  const ranked = scenarioEvents
    .map((e) => ({
      key: e.key,
      party: e.party,
      amountReporting: toReporting(e.amount, e.currency) * e.confidence,
      daysFromNow: e.daysFromNow,
      source: e.source,
      direction: e.direction,
    }))
    .sort((a, b) => b.amountReporting - a.amountReporting);
  const topOutflows = ranked.filter((r) => r.direction === "outflow").slice(0, 5).map((r) => ({ key: r.key, party: r.party, amountReporting: r.amountReporting, daysFromNow: r.daysFromNow, source: r.source }));
  const topInflows  = ranked.filter((r) => r.direction === "inflow").slice(0, 5).map((r) => ({ key: r.key, party: r.party, amountReporting: r.amountReporting, daysFromNow: r.daysFromNow, source: r.source }));

  const limitations: string[] = [
    "Forecast uses current bank balances + open receivables/payables. Real bank reality may diverge.",
    "FX translation uses a deterministic in-engine table; not live mid-market rates.",
    "Confidence weights are heuristic — approved payments 0.85, AR forecasts 0.60.",
  ];

  return {
    trajectory: projected.trajectory,
    startingCash,
    d7:  bucketAt(projected.trajectory, 7),
    d30: bucketAt(projected.trajectory, 30),
    d60: bucketAt(projected.trajectory, 60),
    d90: bucketAt(projected.trajectory, 90),
    lowestProjected:     projected.lowestProjected,
    lowestProjectedDate: projected.lowestProjectedDate,
    firstNegativeDate:   projected.firstNegativeDate,
    runwayDays:          projected.runwayDays,
    totalInflow:         projected.totalInflow,
    totalOutflow:        projected.totalOutflow,
    confidence,
    drivers: { topOutflows, topInflows },
    assumptions: applied,
    limitations,
    events: scenarioEvents,
    horizonDays,
  };
}

/* ────────────────────────────────────────────────────────────────────────
   Compare base vs stress.
   ──────────────────────────────────────────────────────────────────────── */

export function compareForecasts(base: ForecastResult, stress: ForecastResult): ForecastDiff {
  const len = Math.min(base.trajectory.length, stress.trajectory.length);
  const perDay = [] as ForecastDiff["perDay"];
  for (let i = 0; i < len; i += 1) {
    const b = base.trajectory[i];
    const s = stress.trajectory[i];
    perDay.push({ date: b.date, daysFromNow: b.daysFromNow, delta: s.cumulative - b.cumulative });
  }

  const d90Delta = stress.d90 - base.d90;
  const direction: ForecastDiff["direction"] =
    Math.abs(d90Delta) < 1 ? "neutral" :
    d90Delta < 0 ? "deteriorates" : "improves";

  let runwayDelta: number | null = null;
  if (base.runwayDays != null && stress.runwayDays != null) {
    runwayDelta = stress.runwayDays - base.runwayDays;
  } else if (base.runwayDays == null && stress.runwayDays != null) {
    runwayDelta = -stress.runwayDays;
  } else if (base.runwayDays != null && stress.runwayDays == null) {
    runwayDelta = +999;
  }

  return {
    perDay,
    d7Delta:  stress.d7  - base.d7,
    d30Delta: stress.d30 - base.d30,
    d60Delta: stress.d60 - base.d60,
    d90Delta,
    lowestDelta: stress.lowestProjected - base.lowestProjected,
    runwayDelta,
    totalImpact: d90Delta,
    direction,
  };
}

/* ────────────────────────────────────────────────────────────────────────
   Public helpers — exported for callers (intelligence layer, UI).
   ──────────────────────────────────────────────────────────────────────── */

export function findNegativeCashDate(result: ForecastResult): string | null {
  return result.firstNegativeDate;
}

export function calculateRunwayDays(result: ForecastResult): number | null {
  return result.runwayDays;
}

export function calculateScenarioImpact(base: ForecastResult, stress: ForecastResult): {
  amount: number; pct: number; direction: ForecastDiff["direction"];
} {
  const amount = stress.d90 - base.d90;
  const pct = base.d90 !== 0 ? (amount / base.d90) * 100 : 0;
  const direction: ForecastDiff["direction"] =
    Math.abs(amount) < 1 ? "neutral" :
    amount < 0 ? "deteriorates" : "improves";
  return { amount, pct, direction };
}

/* Rank liquidity risks — combine three dimensions:
   1. Largest single outflows
   2. Largest concentrations by currency
   3. Earliest outflows ≥ a materiality floor
   The output is one sorted list of pressure entries the UI can render. */
export interface LiquidityRisk {
  key: string;
  label: string;
  detail: string;
  amountReporting: number;
  daysFromNow: number | null;
  severity: "info" | "watch" | "risk";
}

export function rankLiquidityRisks(result: ForecastResult): LiquidityRisk[] {
  const risks: LiquidityRisk[] = [];

  /* Top 3 outflows. */
  for (const o of result.drivers.topOutflows.slice(0, 3)) {
    if (o.amountReporting < 5_000) continue;
    risks.push({
      key: `outflow:${o.key}`,
      label: `${o.party} — ${o.daysFromNow}d`,
      detail: `Large outflow of ${o.amountReporting.toFixed(0)} USD in ${o.daysFromNow} days.`,
      amountReporting: o.amountReporting,
      daysFromNow: o.daysFromNow,
      severity: o.amountReporting >= 50_000 ? "risk" : "watch",
    });
  }

  /* Currency concentration in outflows. */
  const byCurrency = new Map<string, number>();
  for (const e of result.events) {
    if (e.direction !== "outflow") continue;
    const amt = toReporting(e.amount, e.currency) * e.confidence;
    byCurrency.set(e.currency, (byCurrency.get(e.currency) ?? 0) + amt);
  }
  const totalOut = Array.from(byCurrency.values()).reduce((s, v) => s + v, 0);
  for (const [ccy, amt] of byCurrency.entries()) {
    if (ccy === REPORTING_CURRENCY) continue;
    const share = totalOut > 0 ? amt / totalOut : 0;
    if (share < 0.3 || amt < 5_000) continue;
    risks.push({
      key: `currency:${ccy}`,
      label: `${ccy} concentration`,
      detail: `${Math.round(share * 100)}% of horizon outflows sit in ${ccy} — exposed to FX moves.`,
      amountReporting: amt,
      daysFromNow: null,
      severity: share >= 0.6 ? "watch" : "info",
    });
  }

  /* Early negative-cash window. */
  if (result.firstNegativeDate && result.runwayDays != null) {
    risks.push({
      key: "negative_window",
      label: `Cash negative on ${result.firstNegativeDate}`,
      detail: `Projection crosses zero in ${result.runwayDays} days at ${result.lowestProjected.toFixed(0)} USD.`,
      amountReporting: Math.abs(result.lowestProjected),
      daysFromNow: result.runwayDays,
      severity: result.runwayDays <= 14 ? "risk" : "watch",
    });
  }

  return risks.sort((a, b) => b.amountReporting - a.amountReporting);
}
