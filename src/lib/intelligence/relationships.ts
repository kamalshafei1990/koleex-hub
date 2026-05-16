/* ===========================================================================
   Cross-Module Relationship Engine  —  Phase 2.0

   This is the *correlation* surface of the intelligence layer. Given the
   raw event stream, it identifies operational narratives that span more
   than one module: "logistics spike compressing margin", "AR risk
   caused by delayed shipment", "supplier dependency amplifying COGS
   inflation."

   These correlations are what makes Hub feel like a *connected* OS
   rather than ten separate apps. The dashboard renders them as a calm
   pressure narrative, and the Copilot picks them up as context.
   ========================================================================== */

import type {
  CrossModuleCorrelation,
  ModuleKey,
  OperationalEvent,
  Severity,
} from "./types";
import { stableId } from "./behavior";

interface CorrelationContext {
  byKind: Map<string, OperationalEvent[]>;
}

function buildIndex(events: OperationalEvent[]): CorrelationContext {
  const byKind = new Map<string, OperationalEvent[]>();
  for (const e of events) {
    const arr = byKind.get(e.kind) ?? [];
    arr.push(e);
    byKind.set(e.kind, arr);
  }
  return { byKind };
}

function maxSeverity(a: Severity, b: Severity): Severity {
  const rank: Record<Severity, number> = { critical: 0, risk: 1, watch: 2, info: 3 };
  return rank[a] <= rank[b] ? a : b;
}

/* ---------------------------------------------------------------------------
   Confidence scoring  (Phase 2.0.1)

   A correlation's confidence is a function of:
     · severity of the supporting signals (worse = more confident the
       narrative reflects real pressure, not noise)
     · evidence count (3rd corroborating signal lifts confidence sharply)
     · whether ALL supporting signals are individually material

   The result is on 0..1. The pipeline discards correlations below 0.55.
   --------------------------------------------------------------------------- */

const SEVERITY_CONFIDENCE: Record<Severity, number> = {
  critical: 0.95,
  risk: 0.75,
  watch: 0.55,
  info: 0.35,
};

function scoreConfidence(supporting: OperationalEvent[]): number {
  if (supporting.length === 0) return 0;
  /* Base = max-severity confidence. */
  const base = Math.max(...supporting.map((e) => SEVERITY_CONFIDENCE[e.severity]));
  /* Corroboration bonus: +0.08 per additional supporting signal beyond
     the first, capped at +0.20. */
  const bonus = Math.min(0.20, Math.max(0, supporting.length - 1) * 0.08);
  /* Persistence bonus: any supporting signal with persistence ≥ 2 adds
     +0.06. (Caps the same way.) */
  const persistent = supporting.some((e) => (e.persistence ?? 0) >= 2);
  return Math.min(1, base + bonus + (persistent ? 0.06 : 0));
}

const MIN_CONFIDENCE = 0.55;

/* ---------------------------------------------------------------------------
   Rule set.

   Each rule looks for a pair (or trio) of event kinds. When matched it
   emits a single correlation that names the causal narrative.

   Adding rules is intentionally simple: most are 2-line lookups.
   --------------------------------------------------------------------------- */

export function correlate(events: OperationalEvent[]): CrossModuleCorrelation[] {
  const idx = buildIndex(events);
  const out: CrossModuleCorrelation[] = [];

  const hasAny = (kind: string) => (idx.byKind.get(kind)?.length ?? 0) > 0;
  const firstOf = (kind: string): OperationalEvent | undefined => idx.byKind.get(kind)?.[0];
  const allOf = (kind: string): OperationalEvent[] => idx.byKind.get(kind) ?? [];

  const emit = (
    args: Omit<CrossModuleCorrelation, "confidence" | "evidenceCount"> & { supporting: OperationalEvent[] },
  ): void => {
    const { supporting, ...rest } = args;
    const confidence = scoreConfidence(supporting);
    if (confidence < MIN_CONFIDENCE) return;
    /* Resolve a stable state for the correlation — worsening if ANY
       support is worsening, improving if ALL non-info supports are
       improving. */
    let state: CrossModuleCorrelation["state"] = undefined;
    if (supporting.some((e) => e.state === "worsening")) state = "worsening";
    else if (supporting.length > 0 && supporting.every((e) => e.state === "improving" || e.state === "resolved")) state = "improving";
    else if (supporting.some((e) => e.state === "recurring")) state = "recurring";
    out.push({
      ...rest,
      confidence: Math.round(confidence * 100) / 100,
      evidenceCount: supporting.length,
      state,
    });
  };

  /* 1) Logistics spike + margin drop = logistics-driven margin compression.
     Strengthens if there's ALSO a logistics expense_anomaly. */
  if (hasAny("logistics_spike") && hasAny("margin_drop")) {
    const log = firstOf("logistics_spike")!;
    const mar = firstOf("margin_drop")!;
    const corroborating = allOf("expense_anomaly").filter((e) => /freight|shipping|customs|logistics/i.test(e.entity?.name ?? ""));
    const supporting = [log, mar, ...corroborating];
    emit({
      key: stableId(["corr", "logistics-margin"]),
      sources: supporting.map((s) => s.key),
      affects: ["finance", "logistics"] as ModuleKey[],
      severity: maxSeverity(log.severity, mar.severity),
      headline: "Logistics costs compressing margin",
      narrative: `Logistics spend is up ${(log.magnitude ?? 0).toFixed(0)}% versus the prior period and gross margin sits at ${(mar.magnitude ?? 0).toFixed(1)}%. The freight pressure is a likely driver of the margin compression.`,
      magnitude: log.magnitude,
      supporting,
    });
  }

  /* 2) Collection delay + liquidity pressure = AR-driven liquidity squeeze. */
  const collDelays = idx.byKind.get("collection_delay") ?? [];
  if (collDelays.length > 0 && hasAny("liquidity_pressure")) {
    const liq = firstOf("liquidity_pressure")!;
    const headName = collDelays[0].entity?.name ?? "Customers";
    const supporting = [...collDelays, liq];
    emit({
      key: stableId(["corr", "collection-liquidity"]),
      sources: supporting.map((s) => s.key),
      affects: ["finance", "customer"] as ModuleKey[],
      severity: maxSeverity(liq.severity, collDelays[0].severity),
      headline: "Slowing collections tightening liquidity",
      narrative: `${headName} ${collDelays.length > 1 ? "and others " : ""}are paying slower than the prior 90 days while AP exceeds AR. Liquidity window is contracting because cash is stuck in receivables.`,
      supporting,
    });
  }

  /* 3) Customer concentration + overdue payments = single-counterparty AR risk. */
  const concentration = idx.byKind.get("customer_concentration") ?? [];
  const overdue = idx.byKind.get("overdue_payment") ?? [];
  if (concentration.length > 0 && overdue.length > 0) {
    const top = concentration[0];
    const matched = overdue.filter((o) => o.entity?.name === top.entity?.name);
    if (matched.length > 0) {
      const supporting = [top, ...matched];
      emit({
        key: stableId(["corr", "concentration-overdue", top.entity?.id ?? top.entity?.name ?? "x"]),
        sources: supporting.map((s) => s.key),
        affects: ["finance", "customer"] as ModuleKey[],
        severity: "risk",
        headline: "Top customer is also late paying",
        narrative: `${top.entity?.name ?? "Top customer"} represents ${(top.magnitude ?? 0).toFixed(0)}% of revenue and has overdue invoices. Concentration + collection risk on the same counterparty.`,
        magnitude: top.magnitude,
        supporting,
      });
    }
  }

  /* 4) Supplier dependency + margin drop = supplier-driven cost inflation. */
  if (hasAny("supplier_dependency") && hasAny("margin_drop")) {
    const dep = firstOf("supplier_dependency")!;
    const mar = firstOf("margin_drop")!;
    const supporting = [dep, mar];
    emit({
      key: stableId(["corr", "supplier-margin", dep.entity?.name ?? "x"]),
      sources: supporting.map((s) => s.key),
      affects: ["finance", "supplier"] as ModuleKey[],
      severity: maxSeverity(dep.severity, mar.severity),
      headline: "Supplier dependency amplifying margin risk",
      narrative: `${dep.entity?.name ?? "A single supplier"} absorbs ${(dep.magnitude ?? 0).toFixed(0)}% of COGS and gross margin is compressed at ${(mar.magnitude ?? 0).toFixed(1)}%. Any further price move from this supplier will compound the margin pressure.`,
      supporting,
    });
  }

  /* 5) Supplier overdue + liquidity pressure = relationship strain. */
  if (hasAny("supplier_overdue") && hasAny("liquidity_pressure")) {
    const ovr = firstOf("supplier_overdue")!;
    const liq = firstOf("liquidity_pressure")!;
    const supporting = [ovr, liq];
    emit({
      key: stableId(["corr", "supplier-overdue-liquidity"]),
      sources: supporting.map((s) => s.key),
      affects: ["supplier", "finance"] as ModuleKey[],
      severity: maxSeverity(ovr.severity, liq.severity),
      headline: "Supplier payments slipping under cash pressure",
      narrative: "Outgoing supplier payments are running past due while liquidity is tight. Stagger remaining AP and accelerate top AR to avoid relationship strain.",
      supporting,
    });
  }

  /* 6) Revenue decline + collection delay = top-of-funnel slowdown. */
  if (hasAny("revenue_decline") && (idx.byKind.get("collection_delay")?.length ?? 0) > 0) {
    const rev = firstOf("revenue_decline")!;
    const col = firstOf("collection_delay")!;
    const supporting = [rev, col];
    emit({
      key: stableId(["corr", "revenue-collection"]),
      sources: supporting.map((s) => s.key),
      affects: ["finance", "customer", "crm"] as ModuleKey[],
      severity: maxSeverity(rev.severity, col.severity),
      headline: "Revenue softening while collections slow",
      narrative: "Top-of-funnel and cash conversion are decelerating together. Cross-check pipeline health (CRM) and AR aging (Finance) before adjusting commercial terms.",
      supporting,
    });
  }

  /* 7) Inventory shortage + revenue decline = supply-side miss. */
  if (hasAny("inventory_shortage") && hasAny("revenue_decline")) {
    const inv = firstOf("inventory_shortage")!;
    const rev = firstOf("revenue_decline")!;
    const supporting = [inv, rev];
    emit({
      key: stableId(["corr", "inventory-revenue"]),
      sources: supporting.map((s) => s.key),
      affects: ["inventory", "finance"] as ModuleKey[],
      severity: maxSeverity(inv.severity, rev.severity),
      headline: "Stock shortage may be limiting revenue",
      narrative: "Multiple SKUs are below safety stock while revenue is declining. Check whether unfulfilled demand is leaving through the back door.",
      supporting,
    });
  }

  /* Sort: critical → risk → watch, then descending confidence. */
  const sevRank: Record<Severity, number> = { critical: 0, risk: 1, watch: 2, info: 3 };
  return out.sort((a, b) =>
    sevRank[a.severity] - sevRank[b.severity] || (b.confidence ?? 0) - (a.confidence ?? 0)
  );
}
