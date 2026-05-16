/* ===========================================================================
   Supplier Intelligence Engine  —  Phase 2.0

   Derives:
     · spend concentration per supplier
     · reliability (payment cadence on supplier side)
     · dependency score (single-source risk)

   Inputs: orders.suppliers + payments. No schema or API changes.
   ========================================================================== */

import type { FinanceOrder, FinancePayment } from "@/lib/finance/types";
import type {
  Direction,
  Pressure,
  Score,
  SupplierDependencyProfile,
} from "./types";
import { clamp01, daysBetween, mean } from "./behavior";

interface SupplierAgg {
  id: string;
  name: string;
  totalSpend: number;
  outstanding: number;
  ordersCount: number;
}

export function aggregateSuppliersFromOrders(orders: FinanceOrder[]): SupplierAgg[] {
  const acc = new Map<string, SupplierAgg>();
  for (const o of orders) {
    for (const s of o.suppliers ?? []) {
      const id = s.supplier_id || s.supplier_name || "";
      if (!id) continue;
      const prev = acc.get(id) ?? {
        id,
        name: s.supplier_name || "Supplier",
        totalSpend: 0,
        outstanding: 0,
        ordersCount: 0,
      };
      prev.totalSpend += Number(s.supplier_cost) || 0;
      prev.outstanding += Math.max(0, (Number(s.supplier_cost) || 0) - (Number(s.paid_amount) || 0));
      prev.ordersCount += 1;
      acc.set(id, prev);
    }
  }
  return Array.from(acc.values());
}

/* ---------------------------------------------------------------------------
   Reliability — payment cadence on the *outgoing* side. We don't have
   "supplier shipment confirmation" data, but we DO have payment dates
   vs supplier due dates, which serves as a proxy for how disciplined
   the business is at honouring its own commitments to this supplier.
   That's a useful signal in itself (lateness on our side often signals
   relationship strain).
   --------------------------------------------------------------------------- */

function computeSupplierReliability(supplierId: string, payments: FinancePayment[], orders: FinanceOrder[]): {
  averagePayDelayDays: number;
  onTimeRate: number;
  reliabilityScore: Score;
} {
  const supplierLineIds = new Set<string>();
  const supplierLineDueDates = new Map<string, string | null>();
  for (const o of orders) {
    for (const s of o.suppliers ?? []) {
      if ((s.supplier_id || s.supplier_name) === supplierId) {
        supplierLineIds.add(s.id);
        supplierLineDueDates.set(s.id, s.due_date);
      }
    }
  }
  if (supplierLineIds.size === 0) {
    return { averagePayDelayDays: 0, onTimeRate: 1, reliabilityScore: 100 };
  }
  const deltas: number[] = [];
  let onTime = 0;
  for (const p of payments) {
    if (p.direction !== "out" || p.status !== "completed") continue;
    if (!p.linked_order_supplier_id || !supplierLineIds.has(p.linked_order_supplier_id)) continue;
    const due = supplierLineDueDates.get(p.linked_order_supplier_id);
    if (!due) continue;
    const d = daysBetween(p.payment_date, due);
    if (d == null) continue;
    deltas.push(d);
    if (d <= 0) onTime += 1;
  }
  if (deltas.length === 0) return { averagePayDelayDays: 0, onTimeRate: 1, reliabilityScore: 100 };
  const avg = mean(deltas);
  const onTimeRate = onTime / deltas.length;
  /* Reliability = onTime% − scaled penalty for average lateness. */
  const lateDamage = Math.min(40, Math.max(0, avg) * 1.5);
  const score = clamp01(onTimeRate * 100 - lateDamage * 0.5);
  return {
    averagePayDelayDays: Math.round(avg * 10) / 10,
    onTimeRate: Math.round(onTimeRate * 100) / 100,
    reliabilityScore: Math.round(score),
  };
}

/* ---------------------------------------------------------------------------
   Build supplier profiles.
   --------------------------------------------------------------------------- */

export function buildSupplierProfiles(args: {
  orders: FinanceOrder[];
  payments: FinancePayment[];
}): SupplierDependencyProfile[] {
  const { orders, payments } = args;
  const aggs = aggregateSuppliersFromOrders(orders);
  const totalCOGS = aggs.reduce((s, x) => s + x.totalSpend, 0);
  const profiles: SupplierDependencyProfile[] = [];

  for (const agg of aggs) {
    const cogsShare = totalCOGS > 0 ? (agg.totalSpend / totalCOGS) * 100 : 0;
    const reliability = computeSupplierReliability(agg.id, payments, orders);

    /* Dependency: largely a function of cogsShare with a small kicker
       from outstanding (single-supplier OS is bad on liquidity too). */
    let dependency = 0;
    if (cogsShare >= 70) dependency = 95;
    else if (cogsShare >= 50) dependency = 80;
    else if (cogsShare >= 35) dependency = 60;
    else if (cogsShare >= 20) dependency = 35;
    else if (cogsShare >= 10) dependency = 18;
    else dependency = Math.max(5, cogsShare);

    if (agg.outstanding > 0 && agg.totalSpend > 0) {
      dependency = Math.min(100, dependency + Math.min(8, (agg.outstanding / agg.totalSpend) * 8));
    }

    const pressure: Pressure =
      cogsShare >= 70 ? "critical"
      : cogsShare >= 50 ? "risk"
      : cogsShare >= 30 ? "watch"
      : "calm";

    profiles.push({
      id: agg.id,
      name: agg.name,
      totalSpend: agg.totalSpend,
      outstanding: agg.outstanding,
      cogsShare: Math.round(cogsShare * 10) / 10,
      ordersCount: agg.ordersCount,
      dependencyScore: Math.round(dependency),
      reliabilityScore: reliability.reliabilityScore,
      pressure,
      read: buildSupplierRead({
        name: agg.name,
        cogsShare,
        outstanding: agg.outstanding,
        reliability: reliability.reliabilityScore,
      }),
    });
  }
  return profiles.sort((a, b) => b.dependencyScore - a.dependencyScore);
}

function buildSupplierRead(args: {
  name: string;
  cogsShare: number;
  outstanding: number;
  reliability: Score;
}): string {
  const { name, cogsShare, outstanding, reliability } = args;
  const bits: string[] = [];
  if (cogsShare >= 70) bits.push(`${name} absorbs ${cogsShare.toFixed(0)}% of procurement spend — critical dependency.`);
  else if (cogsShare >= 50) bits.push(`${name} represents ${cogsShare.toFixed(0)}% of procurement spend.`);
  else if (cogsShare >= 30) bits.push(`${name} is ${cogsShare.toFixed(0)}% of procurement spend.`);
  if (outstanding > 0) bits.push(`Open balance of ${formatCompact(outstanding)} USD.`);
  if (reliability < 50) bits.push(`Payment cadence is strained.`);
  else if (reliability >= 90) bits.push(`Payments to this supplier are consistently on time.`);
  if (bits.length === 0) bits.push(`${name} is a diversified, low-dependency relationship.`);
  return bits.join(" ");
}

/* Small inline duplicate so we don't drag in FinanceUiX. */
function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
  if (abs >= 1_000)     return sign + (abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2) + "K";
  return sign + abs.toFixed(0);
}

/* ---------------------------------------------------------------------------
   Cohort summary — useful for the dashboard "Supplier health" tile.
   --------------------------------------------------------------------------- */

export interface SupplierCohortSummary {
  topShare: number;          // %
  topName: string | null;
  diversificationScore: Score; // higher = more diverse
  cohortHealth: Score;
  trend: Direction;
}

export function summarizeSupplierCohort(profiles: SupplierDependencyProfile[]): SupplierCohortSummary {
  if (profiles.length === 0) {
    return { topShare: 0, topName: null, diversificationScore: 100, cohortHealth: 100, trend: "flat" };
  }
  const top = profiles[0];
  /* Herfindahl-Hirschman (sum of squared shares, scaled). */
  const hhi = profiles.reduce((s, p) => s + Math.pow(p.cogsShare / 100, 2), 0);
  /* HHI ∈ [1/n, 1]. Map 1 → 0% diversification, 1/n → 100%. */
  const diversification = clamp01((1 - hhi) * 100);
  const cohortHealth = clamp01(
    diversification * 0.55 +
    (profiles.reduce((s, p) => s + p.reliabilityScore, 0) / profiles.length) * 0.45
  );
  return {
    topShare: Math.round(top.cogsShare * 10) / 10,
    topName: top.name,
    diversificationScore: Math.round(diversification),
    cohortHealth: Math.round(cohortHealth),
    trend: "flat",
  };
}
