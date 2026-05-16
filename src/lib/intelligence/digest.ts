/* ===========================================================================
   Executive Signal Digest  —  Phase 2.0.1

   Curates 3–5 narratives a senior analyst would brief a CEO with:

     · biggest pressure     — highest-priority current event/correlation
     · biggest risk         — structural risk (concentration, dependency)
     · biggest dependency   — top supplier / top customer share
     · biggest improvement  — an "improving" or "resolved" signal
     · biggest opportunity  — where margin is being made (top profit)

   Discipline rule: the digest may emit FEWER than 5 items. An empty
   digest is acceptable. Weak items are never padded in.
   ========================================================================== */

import type { DashboardKpi } from "@/lib/finance/types";
import type {
  CrossModuleCorrelation,
  CustomerBehaviorProfile,
  DigestItem,
  OperationalEvent,
  SupplierDependencyProfile,
} from "./types";

/* ---------------------------------------------------------------------------
   Build digest.
   --------------------------------------------------------------------------- */

export function buildExecutiveDigest(args: {
  kpi: DashboardKpi | null;
  events: OperationalEvent[];        // expected: prioritised, material
  correlations: CrossModuleCorrelation[];
  customers: CustomerBehaviorProfile[];
  suppliers: SupplierDependencyProfile[];
}): DigestItem[] {
  const { kpi, events, correlations, customers, suppliers } = args;
  const out: DigestItem[] = [];

  /* 1) BIGGEST PRESSURE — top correlation when confidence is high,
        otherwise top event by priority. */
  const topCorr = correlations.find((c) => (c.confidence ?? 0) >= 0.6 && c.severity !== "info");
  if (topCorr) {
    out.push({
      key: `digest-pressure-${topCorr.key}`,
      kind: "biggest_pressure",
      severity: topCorr.severity,
      module: topCorr.affects[0] ?? "operations",
      headline: topCorr.headline,
      narrative: topCorr.narrative,
      magnitude: topCorr.magnitude,
      confidence: topCorr.confidence,
      state: topCorr.state,
    });
  } else {
    const topEvent = events.find((e) => e.severity === "critical" || e.severity === "risk");
    if (topEvent) {
      out.push({
        key: `digest-pressure-${topEvent.key}`,
        kind: "biggest_pressure",
        severity: topEvent.severity,
        module: topEvent.source,
        headline: topEvent.label,
        narrative: topEvent.detail,
        magnitude: topEvent.magnitude,
        state: topEvent.state,
      });
    }
  }

  /* 2) BIGGEST RISK — pick the highest-impact structural risk that
        isn't already the top pressure. We look for concentration /
        dependency events first; if none, look at margin / liquidity. */
  const usedKeys = new Set(out.map((i) => i.key));
  const riskCandidates = events.filter(
    (e) =>
      !usedKeys.has(`digest-pressure-${e.key}`) &&
      (e.kind === "customer_concentration" ||
       e.kind === "supplier_dependency" ||
       e.kind === "liquidity_pressure"),
  );
  if (riskCandidates.length > 0) {
    const r = riskCandidates[0];
    out.push({
      key: `digest-risk-${r.key}`,
      kind: "biggest_risk",
      severity: r.severity,
      module: r.source,
      headline: r.label,
      narrative: r.detail,
      magnitude: r.magnitude,
      state: r.state,
    });
  }

  /* 3) BIGGEST DEPENDENCY — top supplier OR top customer share, if
        material AND not already covered. */
  const topSupplier = suppliers[0];
  const topCustomer = customers[0];
  const candidate =
    topSupplier && topSupplier.cogsShare >= 50
      ? {
          key: `digest-dep-supplier-${topSupplier.id}`,
          kind: "biggest_dependency" as const,
          severity: topSupplier.pressure === "critical" ? ("risk" as const) : ("watch" as const),
          module: "supplier" as const,
          headline: `${topSupplier.name} · ${topSupplier.cogsShare.toFixed(0)}% of COGS`,
          narrative: topSupplier.read,
          magnitude: topSupplier.cogsShare,
        }
      : topCustomer && topCustomer.revenueShare >= 40
        ? {
            key: `digest-dep-customer-${topCustomer.id}`,
            kind: "biggest_dependency" as const,
            severity: topCustomer.revenueShare >= 60 ? ("risk" as const) : ("watch" as const),
            module: "customer" as const,
            headline: `${topCustomer.name} · ${topCustomer.revenueShare.toFixed(0)}% of revenue`,
            narrative: topCustomer.read,
            magnitude: topCustomer.revenueShare,
          }
        : null;
  if (candidate && !out.some((i) => i.key === candidate.key)) {
    out.push(candidate);
  }

  /* 4) BIGGEST IMPROVEMENT — first "improving" or "resolved" event
        with persistence ≥ 2 (so we know it was previously real). */
  const improvement = events.find(
    (e) => (e.state === "improving" || e.state === "resolved") && (e.persistence ?? 0) >= 2,
  );
  if (improvement) {
    out.push({
      key: `digest-improvement-${improvement.key}`,
      kind: "biggest_improvement",
      severity: "info",
      module: improvement.source,
      headline: improvement.state === "resolved"
        ? `Resolved: ${improvement.label}`
        : `Improving: ${improvement.label}`,
      narrative: improvement.state === "resolved"
        ? `Pressure cleared after appearing in ${improvement.persistence ?? "prior"} consecutive runs.`
        : `Severity de-escalated versus the prior run.`,
      state: improvement.state,
    });
  }

  /* 5) BIGGEST OPPORTUNITY — top profitable order line in this period.
        Quiet, single line, only if there's a real winner (>15% margin). */
  const topOrder = kpi?.top_orders?.[0];
  if (topOrder && topOrder.net_profit_pct >= 15 && topOrder.net_profit > 0) {
    out.push({
      key: `digest-opp-${topOrder.id}`,
      kind: "biggest_opportunity",
      severity: "info",
      module: "finance",
      headline: `${topOrder.customer_name || "Top order"} · ${topOrder.net_profit_pct.toFixed(0)}% net margin`,
      narrative: `${topOrder.customer_name || "Top order"} delivered ${formatCompactMoney(topOrder.net_profit)} USD at ${topOrder.net_profit_pct.toFixed(1)}% net margin — replicable pattern worth understanding.`,
      magnitude: topOrder.net_profit_pct,
    });
  }

  return out.slice(0, 5);
}

function formatCompactMoney(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
  if (abs >= 1_000)     return sign + (abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2) + "K";
  return sign + abs.toFixed(0);
}
