/* ===========================================================================
   Business-aware Copilot context  —  Phase 2.0 / refined in 2.0.1

   Replaces the finance-only context builder with a cross-module
   version. Phase 2.0.1 hardens the filter:

     · only HIGH-confidence correlations are surfaced
     · only watch+ severity events are eligible
     · the list is capped at 3 (was 4) — calmer panel
     · if there's nothing meaningful to say, the assistant stays quiet
       (a single calm one-liner, not three filler hints)

   ========================================================================== */

import type {
  CopilotHint,
  CrossModuleCorrelation,
  OperationalEvent,
  Severity,
} from "./types";

interface BuildArgs {
  events: OperationalEvent[];
  correlations: CrossModuleCorrelation[];
  /** Optional: page context the user is currently viewing, used to
   *  bias hints toward that entity (customer/supplier/order). */
  pageContext?: {
    customerId?: string;
    supplierId?: string;
    orderId?: string;
  };
}

const SEV_RANK: Record<Severity, number> = { critical: 0, risk: 1, watch: 2, info: 3 };
const MIN_CORRELATION_CONFIDENCE = 0.6;
const MAX_HINTS = 3;

export function buildBusinessCopilotContext(args: BuildArgs): CopilotHint[] {
  const { events, correlations, pageContext } = args;
  const hints: CopilotHint[] = [];

  /* 1) Cross-module correlations FIRST — but only ones that earned
        their confidence and are at least watch-level. */
  const qualifyingCorr = correlations.filter(
    (c) => c.severity !== "info" && (c.confidence ?? 0) >= MIN_CORRELATION_CONFIDENCE,
  );
  for (const c of qualifyingCorr.slice(0, 2)) {
    hints.push({
      key: c.key,
      module: c.affects[0] ?? "operations",
      severity: c.severity,
      text: c.state === "worsening"
        ? `Worsening · ${c.narrative}`
        : c.state === "recurring"
          ? `Persisting · ${c.narrative}`
          : c.narrative,
      related: { eventKeys: c.sources },
    });
  }

  /* 2) Page-biased hints — if the user is looking at a specific
        customer/supplier/order, pull events for that entity. */
  if (pageContext && hints.length < MAX_HINTS) {
    const scoped = events.filter((e) => {
      if (pageContext.customerId && e.entity?.type === "customer" && e.entity?.id === pageContext.customerId) return true;
      if (pageContext.supplierId && e.entity?.type === "supplier" && e.entity?.id === pageContext.supplierId) return true;
      if (pageContext.orderId && e.entity?.type === "order" && e.entity?.id === pageContext.orderId) return true;
      return false;
    });
    const scopedMaterial = scoped.filter((e) => e.severity !== "info");
    for (const e of scopedMaterial.slice(0, 1)) {
      if (hints.some((h) => h.key === e.key)) continue;
      hints.push({
        key: e.key,
        module: e.source,
        severity: e.severity,
        text: e.detail,
        related: { eventKeys: [e.key] },
      });
    }
  }

  /* 3) Highest-priority remaining events — but only at risk/critical,
        and only if there's still room. We deliberately avoid filling
        slots with watch-level events when correlations didn't surface;
        the user's signal-to-noise stays high. */
  if (hints.length < MAX_HINTS) {
    const known = new Set(hints.map((h) => h.key));
    const remaining = [...events]
      .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || (b.priority ?? 0) - (a.priority ?? 0))
      .filter((e) => !known.has(e.key) && (e.severity === "critical" || e.severity === "risk"));
    const needed = MAX_HINTS - hints.length;
    for (const e of remaining.slice(0, needed)) {
      hints.push({
        key: e.key,
        module: e.source,
        severity: e.severity,
        text: e.state === "worsening" ? `Worsening · ${e.detail}` : e.detail,
        related: { eventKeys: [e.key] },
      });
    }
  }

  /* 4) Calm-state fallback. */
  if (hints.length === 0) {
    hints.push({
      key: "calm",
      module: "operations",
      severity: "info",
      text: "No material pressure detected across Finance, customer, supplier, logistics, or inventory this period.",
    });
  }

  return hints.slice(0, MAX_HINTS);
}
