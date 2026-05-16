/* ===========================================================================
   Business-aware Copilot context  —  Phase 2.0

   Replaces the finance-only buildCopilotContext with a cross-module
   version. The Copilot now hears from every module:

     · cross-module correlations come first (these are causal stories)
     · then severity-ordered individual events
     · then a calm-state fallback

   The output is the same `CopilotHint[]` shape FloatingPanel already
   consumes, so the UI is unchanged. Only the depth of the assistant's
   awareness changed.
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

export function buildBusinessCopilotContext(args: BuildArgs): CopilotHint[] {
  const { events, correlations, pageContext } = args;
  const hints: CopilotHint[] = [];

  /* 1) Cross-module correlations FIRST — these are the most valuable
        signals because they explain *why* something is happening. */
  for (const c of correlations.slice(0, 2)) {
    hints.push({
      key: c.key,
      module: c.affects[0] ?? "operations",
      severity: c.severity,
      text: c.narrative,
      related: { eventKeys: c.sources },
    });
  }

  /* 2) Page-biased hints — if the user is looking at a specific
        customer/supplier/order, pull events for that entity. */
  if (pageContext) {
    const scoped = events.filter((e) => {
      if (pageContext.customerId && e.entity?.type === "customer" && e.entity?.id === pageContext.customerId) return true;
      if (pageContext.supplierId && e.entity?.type === "supplier" && e.entity?.id === pageContext.supplierId) return true;
      if (pageContext.orderId && e.entity?.type === "order" && e.entity?.id === pageContext.orderId) return true;
      return false;
    });
    for (const e of scoped.slice(0, 2)) {
      hints.push({
        key: e.key,
        module: e.source,
        severity: e.severity,
        text: e.detail,
        related: { eventKeys: [e.key] },
      });
    }
  }

  /* 3) Severity-ordered top events that we haven't already surfaced. */
  const known = new Set(hints.map((h) => h.key));
  const remaining = [...events]
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity])
    .filter((e) => !known.has(e.key));
  const needed = Math.max(0, 4 - hints.length);
  for (const e of remaining.slice(0, needed)) {
    if (e.severity === "info") continue;
    hints.push({
      key: e.key,
      module: e.source,
      severity: e.severity,
      text: e.detail,
      related: { eventKeys: [e.key] },
    });
  }

  /* 4) Calm fallback. */
  if (hints.length === 0) {
    hints.push({
      key: "calm",
      module: "operations",
      severity: "info",
      text: "All operational signals are calm across Finance, customer, supplier, logistics, and inventory.",
    });
  }

  /* Final shape — cap at 4 to keep the panel calm. */
  return hints.slice(0, 4);
}
