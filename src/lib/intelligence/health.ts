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
  ApprovalIntelligenceSnapshot,
  BusinessHealth,
  CustomerBehaviorProfile,
  HealthDimension,
  InventorySnapshot,
  LogisticsSnapshot,
  ModuleKey,
  PaymentControlSnapshot,
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

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
  if (abs >= 1_000)     return sign + (abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2) + "K";
  return sign + abs.toFixed(0);
}

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
  /* Phase 2.0.1: gentler tiering on AP/AR — same boundaries but
     smaller damage to reduce overreaction on a single-period gap. */
  const apHeavy = kpi.accounts_payable > kpi.accounts_receivable * 1.3;
  const apSevere = kpi.accounts_payable > kpi.accounts_receivable * 2;

  /* Margin damage softened: previous −22 at <10% was too punishing
     for a single bucket; we now penalise more gently and let the
     composite weighting (35% finance) carry the signal. */
  if (margin < 0) score -= 28;
  else if (margin < 10) score -= 16;
  else if (margin < 20) score -= 7;

  if (cashNet < 0) score -= 8;            // was −12
  if (apSevere) score -= 14;              // was −18
  else if (apHeavy) score -= 7;            // was −10

  /* Existing health_status signal kept but softened (−10 / −5). */
  if (kpi.health_status === "stress") score -= 10;
  else if (kpi.health_status === "watch") score -= 5;

  score = clamp01(score);
  /* Phase 2.0.1: drivers reference the actual numbers driving the
     score, not vague qualitative phrases. */
  const driver = (() => {
    if (margin < 0) return `Gross margin negative at ${margin.toFixed(1)}%.`;
    if (apSevere) return `AP ${formatCompact(kpi.accounts_payable)} exceeds AR ${formatCompact(kpi.accounts_receivable)} by 2× — liquidity tight.`;
    if (margin < 10) return `Gross margin compressed at ${margin.toFixed(1)}%.`;
    if (apHeavy) return `AP exceeds AR — working-capital pressure.`;
    if (margin < 20) return `Gross margin ${margin.toFixed(1)}% — room to improve.`;
    if (cashNet < 0) return `Cash out exceeds cash in for the period.`;
    return `Margin ${margin.toFixed(1)}%, cash net positive.`;
  })();

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
   Phase 2.2.1 — Approval operations health dimension.

   Scoring comes pre-computed from buildApprovalSnapshot(); we just
   wrap it into a HealthDimension with a deterministic driver line.
   --------------------------------------------------------------------------- */

export function scoreApprovalHealth(approval: ApprovalIntelligenceSnapshot | null): HealthDimension {
  if (!approval || approval.backlog.count === 0) {
    return {
      module: "approval",
      score: 100,
      pressure: "calm",
      driver: "No pending reviews — approval queue is empty.",
    };
  }
  const a = approval;
  const driver = (() => {
    const bits: string[] = [];
    bits.push(`${a.backlog.count} pending review${a.backlog.count === 1 ? "" : "s"} (${formatCompact(a.backlog.totalValue)} USD).`);
    if (a.backlog.oldestDays >= 7) bits.push(`Oldest waiting ${a.backlog.oldestDays}d.`);
    if (a.cycle.trendPct >= 50 && a.cycle.avgCycleDays >= 4) {
      bits.push(`Cycle ${a.cycle.avgCycleDays.toFixed(1)}d (↑ ${a.cycle.trendPct.toFixed(0)}%).`);
    }
    return bits.join(" ");
  })();
  return { module: "approval", score: a.healthScore, pressure: a.pressure, driver };
}

/* ---------------------------------------------------------------------------
   Phase 2.3 — Payment control health dimension.
   --------------------------------------------------------------------------- */

export function scorePaymentHealth(payment: PaymentControlSnapshot | null): HealthDimension {
  if (!payment ||
      (payment.pendingApproval.count === 0 &&
       payment.reconciliation.unreconciledCount === 0 &&
       payment.reconciliation.mismatchCount === 0 &&
       payment.evidence.missingCount === 0 &&
       payment.failedCount === 0)) {
    return { module: "payment", score: 100, pressure: "calm",
      driver: "Cash movements reconciled — no pending approvals, mismatches, or failures." };
  }
  const driver = (() => {
    const bits: string[] = [];
    if (payment.pendingApproval.count > 0) {
      bits.push(`${payment.pendingApproval.count} pending approval (${formatCompact(payment.pendingApproval.totalValue)} USD).`);
    }
    if (payment.reconciliation.unreconciledCount > 0) {
      bits.push(`${payment.reconciliation.unreconciledCount} unreconciled (${formatCompact(payment.reconciliation.unreconciledValue)} USD).`);
    }
    if (payment.reconciliation.mismatchCount > 0) {
      bits.push(`${payment.reconciliation.mismatchCount} mismatch${payment.reconciliation.mismatchCount === 1 ? "" : "es"}.`);
    }
    if (payment.failedCount > 0) {
      bits.push(`${payment.failedCount} failed at the bank.`);
    }
    return bits.join(" ");
  })();
  return {
    module: "payment",
    score: payment.healthScore,
    pressure: payment.pressure,
    driver,
  };
}

/* ---------------------------------------------------------------------------
   Composite.
   --------------------------------------------------------------------------- */

const WEIGHTS: Record<ModuleKey, number> = {
  finance: 0.275,
  customer: 0.18,
  supplier: 0.14,
  logistics: 0.09,
  inventory: 0.07,
  approval: 0.075,    // Phase 2.2.1 — operational review pressure
  payment: 0.10,      // Phase 2.3 — cash control
  crm: 0.045,
  production: 0.0125,
  operations: 0.0125,
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
