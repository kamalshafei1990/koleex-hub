/* ===========================================================================
   Risk Assessment  —  Phase 2.0

   Inverse-of-health rollup, but weighted differently. Health asks
   "how healthy is the business?". Risk asks "what could hurt us next?".

   We prioritise dependency, concentration, and accelerating bad trends
   over absolute current state.
   ========================================================================== */

import type {
  CustomerBehaviorProfile,
  ModuleKey,
  OperationalEvent,
  RiskAssessment,
  RiskFactor,
  Severity,
  SupplierDependencyProfile,
} from "./types";
import { clamp01 } from "./behavior";

const SEV_TO_RISK: Record<Severity, number> = { critical: 30, risk: 18, watch: 8, info: 2 };

export function assessRisk(args: {
  events: OperationalEvent[];
  customers: CustomerBehaviorProfile[];
  suppliers: SupplierDependencyProfile[];
}): RiskAssessment {
  const factors: RiskFactor[] = [];
  let risk = 0;

  for (const e of args.events) {
    risk += SEV_TO_RISK[e.severity];
    factors.push({
      key: e.key,
      label: e.label,
      severity: e.severity,
      module: e.source,
    });
  }

  /* Concentration adds a structural risk premium even without events. */
  const topCustomer = args.customers[0];
  if (topCustomer && topCustomer.revenueShare >= 40) {
    risk += topCustomer.revenueShare >= 60 ? 18 : 10;
    factors.push({
      key: `customer-share-${topCustomer.id}`,
      label: `${topCustomer.name} concentration · ${topCustomer.revenueShare.toFixed(0)}%`,
      severity: topCustomer.revenueShare >= 60 ? "risk" : "watch",
      module: "customer" as ModuleKey,
    });
  }
  const topSupplier = args.suppliers[0];
  if (topSupplier && topSupplier.cogsShare >= 35) {
    risk += topSupplier.cogsShare >= 60 ? 20 : 12;
    factors.push({
      key: `supplier-share-${topSupplier.id}`,
      label: `${topSupplier.name} dependency · ${topSupplier.cogsShare.toFixed(0)}%`,
      severity: topSupplier.cogsShare >= 60 ? "risk" : "watch",
      module: "supplier" as ModuleKey,
    });
  }

  /* Sort + dedupe by key to keep the list tidy. */
  const seen = new Set<string>();
  const uniqueFactors = factors.filter((f) => {
    if (seen.has(f.key)) return false;
    seen.add(f.key);
    return true;
  });
  const sevRank: Record<Severity, number> = { critical: 0, risk: 1, watch: 2, info: 3 };
  uniqueFactors.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);

  const score = clamp01(risk);
  const pressure =
    score >= 70 ? "critical"
    : score >= 50 ? "risk"
    : score >= 25 ? "watch"
    : "calm";
  return {
    score: Math.round(score),
    pressure,
    factors: uniqueFactors,
  };
}
