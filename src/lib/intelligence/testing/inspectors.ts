/* ===========================================================================
   Phase 2.0.2  —  Debug Inspectors

   Developer-only explanation helpers. They translate the intelligence
   layer's pure-function outputs into human-readable rationale, so the
   team can audit any number on the dashboard.

   NOT user-facing. The dashboard never imports from this file.
   ========================================================================== */

import type {
  CrossModuleCorrelation,
  HealthDimension,
  OperationalEvent,
  Severity,
} from "../types";
import { signalPriorityScore } from "../priority";

/* ---------------------------------------------------------------------------
   explainPriority — full breakdown of the priority score so a dev can
   answer "why is THIS event at the top?".
   --------------------------------------------------------------------------- */

export interface PriorityExplanation {
  total: number;
  severity: { value: Severity; weight: number };
  /** Soft log-scaled amount or magnitude proxy. */
  impact: number;
  /** Urgency component derived from kind + magnitude. */
  urgency: number;
  /** Persistence boost from consecutive runs. */
  persistence: number;
  /** State modifier (worsening +15, improving −8, resolved −25). */
  stateModifier: number;
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 1000, risk: 400, watch: 120, info: 30,
};

export function explainPriority(e: OperationalEvent): PriorityExplanation {
  const total = signalPriorityScore(e);
  const severityWeight = SEVERITY_WEIGHT[e.severity];
  /* Re-derive subcomponents by recomputing each piece transparently. */
  const amount = e.amount && e.amount > 0 ? Math.log10(Math.min(e.amount, 1_000_000) + 1) * 10 : 0;
  const magnitude = !amount && e.magnitude && e.magnitude > 0 ? Math.min(60, e.magnitude / 2) : 0;
  const impact = amount + magnitude;
  /* For urgency we cannot recompute without rewriting the table; we
     can only say "total − everything-else" gives us urgency + state.
     But we want each component independently — so just re-implement the
     same table here to keep this file standalone. */
  const urgency = urgencyComponent(e);
  const persistence = persistenceComponent(e);
  const stateModifier = stateMod(e);
  return {
    total,
    severity: { value: e.severity, weight: severityWeight },
    impact: Math.round(impact * 10) / 10,
    urgency,
    persistence,
    stateModifier,
  };
}

function urgencyComponent(e: OperationalEvent): number {
  switch (e.kind) {
    case "overdue_payment":
    case "supplier_overdue": {
      const days = e.magnitude ?? 0;
      if (days >= 60) return 60;
      if (days >= 30) return 40;
      if (days >= 14) return 22;
      if (days >= 7) return 12;
      return 4;
    }
    case "supplier_due": {
      const days = e.magnitude ?? 7;
      if (days <= 3) return 20;
      if (days <= 7) return 10;
      return 2;
    }
    case "liquidity_pressure": return 50;
    case "margin_drop":         return 35;
    case "revenue_decline":     return 30;
    case "collection_delay":    return 18;
    case "logistics_spike":     return 20;
    case "customer_concentration":
    case "supplier_dependency": return 12;
    default:                    return 8;
  }
}

function persistenceComponent(e: OperationalEvent): number {
  const p = e.persistence ?? 0;
  if (p <= 1) return 0;
  if (p === 2) return 8;
  if (p === 3) return 14;
  return 20;
}

function stateMod(e: OperationalEvent): number {
  switch (e.state) {
    case "worsening": return 15;
    case "improving": return -8;
    case "resolved":  return -25;
    default:          return 0;
  }
}

/* ---------------------------------------------------------------------------
   explainSignal — short human paragraph describing the event's
   provenance and weighting.
   --------------------------------------------------------------------------- */

export function explainSignal(e: OperationalEvent): string {
  const p = explainPriority(e);
  const parts: string[] = [];
  parts.push(`[${e.kind}] severity=${e.severity} (weight ${p.severity.weight})`);
  parts.push(`impact=${p.impact}`);
  parts.push(`urgency=${p.urgency}`);
  if (p.persistence > 0) parts.push(`persistence+${p.persistence}`);
  if (p.stateModifier !== 0) parts.push(`state(${e.state})=${p.stateModifier >= 0 ? "+" : ""}${p.stateModifier}`);
  parts.push(`total=${p.total}`);
  return parts.join("  ·  ");
}

/* ---------------------------------------------------------------------------
   explainCorrelation — confidence math + supporting evidence count.
   --------------------------------------------------------------------------- */

export function explainCorrelation(c: CrossModuleCorrelation): string {
  const conf = ((c.confidence ?? 0) * 100).toFixed(0);
  return `[${c.severity}] confidence=${conf}%  evidence=${c.evidenceCount ?? c.sources.length}  state=${c.state ?? "new"}  affects=[${c.affects.join(",")}]`;
}

/* ---------------------------------------------------------------------------
   explainHealthScore — module-by-module driver lines.
   --------------------------------------------------------------------------- */

export function explainHealthScore(dimensions: HealthDimension[]): string {
  return dimensions
    .map((d) => `${d.module.padEnd(10, " ")} ${String(d.score).padStart(3, " ")}  ${d.pressure.padEnd(8, " ")}  — ${d.driver}`)
    .join("\n");
}
