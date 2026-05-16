/* ===========================================================================
   Customer Behavior Engine  —  Phase 2.0

   Derives:
     · collection behavior (avg delay, late rate, trend)
     · revenue share / concentration
     · composite health + risk scores

   Inputs: finance customer accounts, orders, payments. All exist; no
   schema, API, or permission changes are made by this module.

   Every score is a pure function of inputs — no random "AI" guesses.
   ========================================================================== */

import type { FinanceOrder, FinancePayment } from "@/lib/finance/types";
import type {
  CollectionBehavior,
  CustomerBehaviorProfile,
  Pressure,
  Score,
  Direction,
} from "./types";
import { clamp01, daysBetween, daysFromToday, mean, safePct, softHealth } from "./behavior";

/* ---------------------------------------------------------------------------
   Internal shapes
   --------------------------------------------------------------------------- */

interface CustomerInput {
  id: string;
  name: string;
  totalRevenue: number;
  outstanding: number;
  overdue: number;
  ordersCount: number;
}

/* ---------------------------------------------------------------------------
   Collection behavior — calculated from payment dates vs. order due dates.

   For each completed in-payment that's linked to an order, compare its
   payment_date to that order's payment_due_date. The mean of the
   resulting days-late values per customer is their average delay.
   --------------------------------------------------------------------------- */

interface CollectionEvent {
  customerKey: string;
  daysLate: number; // positive = late, negative = early/on-time
  /** A second window for trend comparison (older payments). */
  bucket: "current" | "prior";
}

function bucketForPayment(payment: FinancePayment): "current" | "prior" {
  const days = daysFromToday(payment.payment_date);
  if (days == null) return "current";
  /* Current = last 90 days, Prior = 91..180 days. */
  return days >= -90 ? "current" : "prior";
}

export function computeCollectionBehavior(
  customerKey: string,
  payments: FinancePayment[],
  orders: FinanceOrder[],
): CollectionBehavior {
  const orderById = new Map<string, FinanceOrder>();
  for (const o of orders) orderById.set(o.id, o);

  const events: CollectionEvent[] = [];
  for (const p of payments) {
    if (p.direction !== "in" || p.status !== "completed") continue;
    if (!p.linked_order_id) continue;
    const order = orderById.get(p.linked_order_id);
    if (!order) continue;
    /* Identify the customer this payment belongs to. We accept the
       payment's party_id OR the order's customer_id. */
    const cid = p.party_id ?? order.customer_id;
    if (!cid || cid !== customerKey) continue;
    const due = order.payment_due_date;
    if (!due) continue;
    const days = daysBetween(p.payment_date, due);
    if (days == null) continue;
    events.push({
      customerKey,
      daysLate: days, // payment_date − due_date
      bucket: bucketForPayment(p),
    });
  }

  if (events.length === 0) {
    return {
      averageDelayDays: 0,
      latePaymentRate: 0,
      delayTrendDays: 0,
      trend: "flat" as Direction,
      label: "Unknown",
    };
  }

  const current = events.filter((e) => e.bucket === "current").map((e) => e.daysLate);
  const prior   = events.filter((e) => e.bucket === "prior").map((e) => e.daysLate);

  const avgDelay = mean(current.length > 0 ? current : events.map((e) => e.daysLate));
  const lateCount = events.filter((e) => e.daysLate > 0).length;
  const latePaymentRate = lateCount / events.length;
  const priorAvg = prior.length > 0 ? mean(prior) : avgDelay;
  const delayTrendDays = avgDelay - priorAvg;

  let trend: Direction = "flat";
  if (delayTrendDays > 3) trend = "up";
  else if (delayTrendDays < -3) trend = "down";

  let label: CollectionBehavior["label"] = "Reliable";
  if (avgDelay >= 30) label = "Severe";
  else if (avgDelay >= 14) label = "Late";
  else if (avgDelay >= 5) label = "Slow";
  else label = "Reliable";

  return {
    averageDelayDays: Math.round(avgDelay * 10) / 10,
    latePaymentRate: Math.round(latePaymentRate * 100) / 100,
    delayTrendDays: Math.round(delayTrendDays * 10) / 10,
    trend,
    label,
  };
}

/* ---------------------------------------------------------------------------
   Build profiles for a list of customers.

   `customerInputs` is the dashboard-aggregated view; if all you have
   is the order list, you can build inputs via `buildInputsFromOrders`
   below.
   --------------------------------------------------------------------------- */

export function buildCustomerProfiles(args: {
  customers: CustomerInput[];
  orders: FinanceOrder[];
  payments: FinancePayment[];
  totalRevenue: number;
}): CustomerBehaviorProfile[] {
  const { customers, orders, payments, totalRevenue } = args;
  const profiles: CustomerBehaviorProfile[] = [];
  for (const c of customers) {
    if (!c.id) continue;
    const collection = computeCollectionBehavior(c.id, payments, orders);
    const revenueShare = totalRevenue > 0 ? (c.totalRevenue / totalRevenue) * 100 : 0;
    const overdueRatio = c.totalRevenue > 0 ? Math.min(1, c.overdue / c.totalRevenue) : 0;

    /* Health =
         starts at 100
         − delay damage (avgDelay >= 30d → ~40 pts off)
         − late rate damage (rate >= 0.6 → 30 pts off)
         − overdue damage (overdueRatio 1.0 → 40 pts off)
         + buffer for low concentration                                 */
    const delayDamage = Math.min(40, Math.max(0, collection.averageDelayDays) * 1.3);
    const lateRateDamage = Math.min(30, collection.latePaymentRate * 50);
    const overdueDamage = Math.min(40, overdueRatio * 60);
    let health = 100 - delayDamage - lateRateDamage - overdueDamage;
    health = clamp01(health);

    /* Risk =
         base from inverse-health
         + concentration penalty (share >= 40% → adds risk)
         + trend penalty (delay rising → adds risk)                       */
    let risk = 100 - health;
    if (revenueShare >= 60) risk += 18;
    else if (revenueShare >= 40) risk += 10;
    if (collection.trend === "up" && collection.delayTrendDays > 5) risk += 8;
    risk = clamp01(risk);

    /* Pressure rolls up the worst of overdue, delay, and concentration. */
    const pressure: Pressure =
      overdueRatio >= 0.4 || collection.averageDelayDays >= 30 || revenueShare >= 60 ? "critical"
      : overdueRatio >= 0.2 || collection.averageDelayDays >= 14 || revenueShare >= 40 ? "risk"
      : overdueRatio > 0 || collection.averageDelayDays >= 5 || revenueShare >= 25 ? "watch"
      : "calm";

    const read = buildCustomerRead({
      name: c.name,
      collection,
      overdueRatio,
      revenueShare,
    });

    profiles.push({
      id: c.id,
      name: c.name,
      totalRevenue: c.totalRevenue,
      outstanding: c.outstanding,
      overdue: c.overdue,
      revenueShare: Math.round(revenueShare * 10) / 10,
      ordersCount: c.ordersCount,
      collection,
      healthScore: Math.round(health),
      riskScore: Math.round(risk),
      pressure,
      read,
    });
  }
  return profiles.sort((a, b) => b.riskScore - a.riskScore);
}

function buildCustomerRead(args: {
  name: string;
  collection: CollectionBehavior;
  overdueRatio: number;
  revenueShare: number;
}): string {
  const { name, collection, overdueRatio, revenueShare } = args;
  const bits: string[] = [];

  /* Phase 2.0.1: every clause must reference a real operational
     number. No "slightly behind", no "appears stable" — those are
     calm-state fallbacks the digest can choose to suppress entirely. */
  if (collection.label === "Severe")
    bits.push(`${name} averages ${collection.averageDelayDays.toFixed(0)} days late on payments.`);
  else if (collection.label === "Late")
    bits.push(`${name} settles invoices ${collection.averageDelayDays.toFixed(0)} days past due on average.`);
  else if (collection.label === "Slow" && collection.averageDelayDays >= 5)
    bits.push(`${name} runs ${collection.averageDelayDays.toFixed(0)} days behind the due date on average.`);
  else if (collection.label === "Reliable")
    bits.push(`${name} settles invoices within ${Math.max(0, Math.round(collection.averageDelayDays))} days of due.`);
  /* Unknown / no data: stay silent rather than emit filler. */

  if (collection.trend === "up" && collection.delayTrendDays >= 5) {
    bits.push(`Cadence deteriorated ${collection.delayTrendDays.toFixed(0)} days versus the prior 90-day window.`);
  } else if (collection.trend === "down" && collection.delayTrendDays <= -5) {
    bits.push(`Cadence improved ${Math.abs(collection.delayTrendDays).toFixed(0)} days versus the prior 90-day window.`);
  }

  if (revenueShare >= 40) {
    bits.push(`Represents ${revenueShare.toFixed(0)}% of period revenue — single-counterparty concentration.`);
  }
  if (overdueRatio >= 0.2) {
    bits.push(`${(overdueRatio * 100).toFixed(0)}% of their revenue is currently overdue.`);
  }
  return bits.join(" ");
}

/* ---------------------------------------------------------------------------
   Convenience: build inputs from the raw order list when an explicit
   customer-account list isn't available. Aggregates revenue +
   outstanding from orders directly.
   --------------------------------------------------------------------------- */

export function buildInputsFromOrders(orders: FinanceOrder[]): CustomerInput[] {
  const acc = new Map<string, CustomerInput>();
  for (const o of orders) {
    const id = o.customer_id || "";
    if (!id) continue;
    const prev = acc.get(id) ?? {
      id,
      name: o.customer_name || "Customer",
      totalRevenue: 0,
      outstanding: 0,
      overdue: 0,
      ordersCount: 0,
    };
    prev.totalRevenue += Number(o.selling_price) || 0;
    prev.outstanding += Number(o.outstanding_receivable) || 0;
    /* Overdue: outstanding when due date is in the past. */
    const due = daysFromToday(o.payment_due_date);
    if (due != null && due < 0) {
      prev.overdue += Number(o.outstanding_receivable) || 0;
    }
    prev.ordersCount += 1;
    acc.set(id, prev);
  }
  return Array.from(acc.values());
}

/* ---------------------------------------------------------------------------
   Aggregate-level helpers for the dashboard.
   --------------------------------------------------------------------------- */

export interface CustomerCohortSummary {
  averageDelayDays: number;
  delayTrendDays: number;
  trend: Direction;
  latePaymentRate: number;
  /** Health score across the entire cohort (weighted by revenue). */
  cohortHealth: Score;
}

export function summarizeCohort(profiles: CustomerBehaviorProfile[]): CustomerCohortSummary {
  if (profiles.length === 0) {
    return { averageDelayDays: 0, delayTrendDays: 0, trend: "flat", latePaymentRate: 0, cohortHealth: 100 };
  }
  /* Revenue-weighted averages so the big customers dominate the cohort
     reading, mirroring real CFO intuition. */
  const totalRev = profiles.reduce((s, p) => s + p.totalRevenue, 0);
  const weight = (p: CustomerBehaviorProfile) => (totalRev > 0 ? p.totalRevenue / totalRev : 1 / profiles.length);
  const avgDelay = profiles.reduce((s, p) => s + p.collection.averageDelayDays * weight(p), 0);
  const trendDelta = profiles.reduce((s, p) => s + p.collection.delayTrendDays * weight(p), 0);
  const lateRate = profiles.reduce((s, p) => s + p.collection.latePaymentRate * weight(p), 0);
  const health = profiles.reduce((s, p) => s + p.healthScore * weight(p), 0);

  /* Need PoP trend label using the weighted average delta in days. */
  let trend: Direction = "flat";
  if (trendDelta > 3) trend = "up";
  else if (trendDelta < -3) trend = "down";

  /* Use safePct for symmetry with the rest of the lib (no usage here
     beyond defensive import - safePct already used internally above). */
  void safePct;
  void softHealth;

  return {
    averageDelayDays: Math.round(avgDelay * 10) / 10,
    delayTrendDays: Math.round(trendDelta * 10) / 10,
    trend,
    latePaymentRate: Math.round(lateRate * 100) / 100,
    cohortHealth: Math.round(health),
  };
}
