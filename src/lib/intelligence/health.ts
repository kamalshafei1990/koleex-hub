/* ===========================================================================
   Business Health Engine  —  Phase 2.0

   Aggregates per-module health into a single composite 0..100 score
   with severity-aware pressure, and produces a calm executive
   narrative. This is what the dashboard renders as the "business
   nervous system" pulse.

   No randomness, no AI sweetening — every number is a transparent
   function of inputs.
   ========================================================================== */

import type { DashboardKpi } from "@/lib/finance/types";
import type {
  BusinessHealth,
  CustomerBehaviorProfile,
  HealthDimension,
  InventorySnapshot,
  LogisticsSnapshot,
  ModuleKey,
  Pressure,
  Score,
  SupplierDependencyProfile,
} from "./types";
import { clamp01 } from "./behavior";

const PRESSURE_FROM_SCORE = (score: Score): Pressure => {
  if (score >= 80) return "calm";
  if (score >= 60) return "watch";
  if (score >= 40) return "risk";
  return "critical";
};

/* ---------------------------------------------------------------------------
   Per-module scorers — each returns a HealthDimension.
   --------------------------------------------------------------------------- */

export function scoreFinanceHealth(kpi: DashboardKpi | null): HealthDimension {
  if (!kpi) {
    return { module: "finance", score: 50, pressure: "watch", driver: "Awaiting financial data." };
  }
  let score = 100;
  const margin = kpi.gross_margin_pct ?? 0;
  const cashNet = (kpi.cash_in ?? 0) - (kpi.cash_out ?? 0);
  const apHeavy = kpi.accounts_payable > kpi.accounts_receivable * 1.3;
  const apSevere = kpi.accounts_payable > kpi.accounts_receivable * 2;

  if (margin < 0) score -= 35;
  else if (margin < 10) score -= 22;
  else if (margin < 20) score -= 10;

  if (cashNet < 0) score -= 12;
  if (apSevere) score -= 18;
  else if (apHeavy) score -= 10;

  if (kpi.health_status === "stress") score -= 12;
  else if (kpi.health_status === "watch") score -= 6;

  score = clamp01(score);
  const driver =
    score >= 80 ? "Margin and cash position healthy."
    : score >= 60 ? "Margin or cash showing mild pressure."
    : score >= 40 ? "Material financial pressure — margin, AR, or AP."
    : "Severe financial pressure across multiple dimensions.";

  return { module: "finance", score: Math.round(score), pressure: PRESSURE_FROM_SCORE(score), driver };
}

export function scoreCustomerHealth(customers: CustomerBehaviorProfile[]): HealthDimension {
  if (customers.length === 0) {
    return { module: "customer", score: 100, pressure: "calm", driver: "No customer activity yet." };
  }
  const totalRev = customers.reduce((s, c) => s + c.totalRevenue, 0);
  const weight = (c: CustomerBehaviorProfile) => (totalRev > 0 ? c.totalRevenue / totalRev : 1 / customers.length);
  const weighted = customers.reduce((s, c) => s + c.healthScore * weight(c), 0);
  const score = Math.round(clamp01(weighted));
  const slow = customers.filter((c) => c.collection.label === "Late" || c.collection.label === "Severe");
  const driver =
    score >= 80 ? "Customers paying reliably; concentration manageable."
    : score >= 60 ? `${slow.length} customer${slow.length === 1 ? "" : "s"} drifting late.`
    : score >= 40 ? "Customer payment cadence under pressure."
    : "Severe collection issues across the cohort.";
  return { module: "customer", score, pressure: PRESSURE_FROM_SCORE(score), driver };
}

export function scoreSupplierHealth(suppliers: SupplierDependencyProfile[]): HealthDimension {
  if (suppliers.length === 0) {
    return { module: "supplier", score: 100, pressure: "calm", driver: "No supplier activity yet." };
  }
  const top = suppliers[0];
  /* Score blends concentration penalty + average reliability. */
  let score = 100 - Math.min(50, top.cogsShare * 0.7);
  const avgReliability = suppliers.reduce((s, p) => s + p.reliabilityScore, 0) / suppliers.length;
  score = (score * 0.55) + (avgReliability * 0.45);
  score = clamp01(score);
  const driver =
    score >= 80 ? "Supplier base diversified and reliable."
    : score >= 60 ? "Some concentration or payment friction with suppliers."
    : score >= 40 ? `${top.name} dependency at ${top.cogsShare.toFixed(0)}% drives risk.`
    : "Severe supplier dependency or relationship strain.";
  return { module: "supplier", score: Math.round(score), pressure: PRESSURE_FROM_SCORE(score), driver };
}

export function scoreLogisticsHealth(logistics: LogisticsSnapshot): HealthDimension {
  let score = 100;
  if (logistics.trend === "up") {
    if (logistics.trendPct >= 25) score -= 30;
    else if (logistics.trendPct >= 12) score -= 18;
    else if (logistics.trendPct >= 6) score -= 8;
  }
  if (logistics.shareOfOpex >= 55) score -= 15;
  else if (logistics.shareOfOpex >= 40) score -= 8;
  score = clamp01(score);
  return {
    module: "logistics",
    score: Math.round(score),
    pressure: PRESSURE_FROM_SCORE(score),
    driver: logistics.read,
  };
}

export function scoreInventoryHealth(inventory: InventorySnapshot | undefined): HealthDimension {
  if (!inventory || !inventory.available) {
    return { module: "inventory", score: 80, pressure: "calm", driver: "Inventory module not connected." };
  }
  let score = 100;
  const below = inventory.belowSafetyStock ?? 0;
  const reserved = inventory.reservedForUnpaid ?? 0;
  const aging = inventory.agingInventoryValue ?? 0;
  if (below >= 40) score -= 35;
  else if (below >= 20) score -= 20;
  else if (below >= 8) score -= 10;
  if (reserved > 0) score -= 8;
  if (aging >= 100_000) score -= 12;
  else if (aging > 0) score -= 5;
  score = clamp01(score);
  return {
    module: "inventory",
    score: Math.round(score),
    pressure: PRESSURE_FROM_SCORE(score),
    driver: inventory.read,
  };
}

/* ---------------------------------------------------------------------------
   Composite.
   --------------------------------------------------------------------------- */

const WEIGHTS: Record<ModuleKey, number> = {
  finance: 0.35,
  customer: 0.20,
  supplier: 0.15,
  logistics: 0.10,
  inventory: 0.10,
  crm: 0.05,
  production: 0.025,
  operations: 0.025,
};

export function composeBusinessHealth(dimensions: HealthDimension[]): BusinessHealth {
  if (dimensions.length === 0) {
    return {
      composite: 100,
      pressure: "calm",
      dimensions: [],
      headline: "No activity yet — health pending.",
    };
  }
  /* Weighted average, then renormalise by total weight present. */
  let weightedScore = 0;
  let totalWeight = 0;
  let worst: Pressure = "calm";
  const rank: Record<Pressure, number> = { critical: 0, risk: 1, watch: 2, calm: 3 };
  for (const d of dimensions) {
    const w = WEIGHTS[d.module] ?? 0.05;
    weightedScore += d.score * w;
    totalWeight += w;
    if (rank[d.pressure] < rank[worst]) worst = d.pressure;
  }
  const composite = clamp01(weightedScore / Math.max(0.001, totalWeight));

  /* Headline: choose the lowest-scoring dimension's driver as the
     leading sentence, then add a "elsewhere..." tail summarising the
     rest. Calm, executive-grade. */
  const sorted = [...dimensions].sort((a, b) => a.score - b.score);
  const lead = sorted[0];
  const elsewhereOk = sorted.slice(1).filter((d) => d.score >= 80).length;
  const elsewhereWatch = sorted.slice(1).filter((d) => d.score >= 60 && d.score < 80).length;
  const elsewhereRisk = sorted.slice(1).filter((d) => d.score < 60).length;
  const tail = elsewhereRisk > 0 ? `Pressure also on ${elsewhereRisk} other dimension${elsewhereRisk > 1 ? "s" : ""}.`
             : elsewhereWatch > 0 ? `Mild pressure on ${elsewhereWatch} other dimension${elsewhereWatch > 1 ? "s" : ""}.`
             : elsewhereOk > 0 ? `Other dimensions healthy.`
             : "";
  const headline = `${lead.driver}${tail ? " " + tail : ""}`;

  return {
    composite: Math.round(composite),
    pressure: worst,
    dimensions,
    headline,
  };
}
