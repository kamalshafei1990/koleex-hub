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
import type { ReconciliationSnapshot } from "./reconciliation";
import type { FinanceReconciliationCandidate, CashMovement } from "@/lib/finance/types";
import type { ForecastSnapshot } from "./treasury-forecast-events";

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
  /* Phase 2.5 — reconciliation-aware Copilot. Optional so old callers
     keep compiling; when present we inject up to 1 targeted hint per
     reconciliation theme so the assistant can say something concrete
     ("4 high-confidence matches waiting") instead of repeating the
     generic event detail. */
  reconciliation?: ReconciliationSnapshot;
  reconciliationCandidates?: FinanceReconciliationCandidate[];
  /** Optional movement lookup for duplicate-risk callouts that name
   *  the bank account. */
  cashMovements?: CashMovement[];
  /** Phase 2.8 — treasury forecast snapshot. Drives forecast-aware
   *  hints with concrete amounts ("Cash turns negative on June 18")
   *  and named parties ("If Malouka delays 30d…"). */
  forecast?: ForecastSnapshot;
}

const SEV_RANK: Record<Severity, number> = { critical: 0, risk: 1, watch: 2, info: 3 };
const MIN_CORRELATION_CONFIDENCE = 0.6;
const MAX_HINTS = 3;

function fmtCompactUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export function buildBusinessCopilotContext(args: BuildArgs): CopilotHint[] {
  const { events, correlations, pageContext, reconciliation, reconciliationCandidates, cashMovements, forecast } = args;
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

  /* 1b) Reconciliation-aware hints. Phase 2.5.
        We inject AT MOST 2 reconciliation hints, only when there's
        something specific to say — never as filler. The text names
        the count, the confidence, and (for duplicates) the bank
        account by name so the operator can act without opening the
        queue first. */
  if (reconciliation) {
    const r = reconciliation;
    const known = new Set(hints.map((h) => h.key));
    const reconHints: CopilotHint[] = [];

    /* High-confidence unconfirmed — most actionable single-shot hint. */
    if (r.highConfidencePendingCount >= 1) {
      const n = r.highConfidencePendingCount;
      const sample = (reconciliationCandidates ?? []).find(
        (c) => c.status === "suggested" && c.confidence_level === "high",
      );
      const sampleNote = sample
        ? ` Top match scored ${Math.round(sample.confidence * 100)}%.`
        : "";
      reconHints.push({
        key: "copilot-recon-high-conf",
        module: "treasury",
        severity: n >= 5 ? "risk" : "watch",
        text: `${n} high-confidence reconciliation match${n === 1 ? "" : "es"} waiting for confirmation.${sampleNote}`,
        related: { eventKeys: ["recon-high-conf"] },
      });
    }

    /* Duplicate movements — name the bank account when we can. */
    if (r.duplicateRiskCount >= 1 && reconciliationCandidates && cashMovements) {
      const dup = reconciliationCandidates.find(
        (c) => c.status === "suggested" && c.candidate_type === "duplicate_risk",
      );
      const m = dup?.cash_movement ?? null;
      const movementId = m?.id ?? dup?.cash_movement_id ?? null;
      const movement = movementId ? cashMovements.find((mv) => mv.id === movementId) : null;
      const accountLabel = movement?.counterparty_name || movement?.bank_reference || "a bank account";
      reconHints.push({
        key: "copilot-recon-duplicate",
        module: "treasury",
        severity: r.duplicateRiskCount >= 3 ? "risk" : "watch",
        text: `Possible duplicate bank movement on ${accountLabel} — review before reconciling.`,
        related: { eventKeys: ["recon-duplicate"] },
      });
    } else if (r.duplicateRiskCount >= 1) {
      reconHints.push({
        key: "copilot-recon-duplicate",
        module: "treasury",
        severity: r.duplicateRiskCount >= 3 ? "risk" : "watch",
        text: `${r.duplicateRiskCount} possible duplicate bank movement${r.duplicateRiskCount === 1 ? "" : "s"} detected — confirm with the bank before reconciling.`,
        related: { eventKeys: ["recon-duplicate"] },
      });
    }

    /* Partial-match pressure — only if it's a sustained pile-up. */
    if (r.partialPendingCount >= 3 && !reconHints.find((h) => h.key === "copilot-recon-high-conf")) {
      reconHints.push({
        key: "copilot-recon-partial",
        module: "treasury",
        severity: r.partialPendingCount >= 8 ? "risk" : "watch",
        text: `${r.partialPendingCount} partial / variance matches in queue — recurring shape suggests systemic discrepancy.`,
        related: { eventKeys: ["recon-partial"] },
      });
    }

    /* Rejection pattern — only if it's worth investigating. */
    if (r.repeatRejectionPairs >= 2 && !reconHints.find((h) => h.key === "copilot-recon-partial")) {
      reconHints.push({
        key: "copilot-recon-rejection-pattern",
        module: "treasury",
        severity: r.repeatRejectionPairs >= 3 ? "risk" : "watch",
        text: `${r.repeatRejectionPairs} payment/movement pairs rejected more than once — investigate ambiguous data.`,
        related: { eventKeys: ["recon-rejection-pattern"] },
      });
    }

    /* Backlog — last because it's the most "summary" of the bunch.
       Only emits when neither high-confidence nor duplicate-risk is
       already speaking, so we don't double-count. */
    if (
      r.pendingCount >= 10 &&
      !reconHints.find((h) =>
        h.key === "copilot-recon-high-conf" || h.key === "copilot-recon-duplicate",
      )
    ) {
      const ageNote = r.oldestPendingDays >= 7 ? `; oldest is ${r.oldestPendingDays}d` : "";
      reconHints.push({
        key: "copilot-recon-backlog",
        module: "treasury",
        severity: r.pendingCount >= 15 ? "risk" : "watch",
        text: `Reconciliation queue holds ${r.pendingCount} suggestion${r.pendingCount === 1 ? "" : "s"}${ageNote}.`,
        related: { eventKeys: ["recon-backlog"] },
      });
    }

    /* Inject up to 2 reconciliation hints, dedup against existing. */
    for (const h of reconHints.slice(0, 2)) {
      if (known.has(h.key)) continue;
      if (hints.length >= MAX_HINTS) break;
      hints.push(h);
      known.add(h.key);
    }
  }

  /* 1c) Forecast-aware hints. Phase 2.8.
        Inject AT MOST 2 hints. Numbers always concrete, never generic. */
  if (forecast && (forecast.base || forecast.stress)) {
    const known = new Set(hints.map((h) => h.key));
    const fHints: CopilotHint[] = [];
    const base = forecast.base;
    const stress = forecast.stress;
    const diff = forecast.diff;
    const assumptions = forecast.assumptions;

    /* Negative cash on base case — the most actionable hint we can emit. */
    if (base?.firstNegativeDate && Math.abs(base.lowestProjected) >= 5_000) {
      fHints.push({
        key: "copilot-forecast-negative-cash",
        module: "treasury",
        severity: base.runwayDays != null && base.runwayDays <= 7 ? "critical" : "risk",
        text: `Cash projected negative on ${base.firstNegativeDate} — runway ${base.runwayDays ?? "—"}d, low point ${fmtCompactUsd(base.lowestProjected)} USD.`,
        related: { eventKeys: ["forecast-negative-cash"] },
      });
    }

    /* Stress scenario impact — only when materially worse. */
    if (stress && diff && diff.direction === "deteriorates" && Math.abs(diff.d90Delta) >= 5_000 && assumptions) {
      const topApplied = stress.assumptions[0];
      const newNegative = stress.firstNegativeDate && stress.firstNegativeDate !== base?.firstNegativeDate;
      const text = newNegative
        ? `${topApplied?.label ?? "Stress scenario"} pushes cash negative on ${stress.firstNegativeDate}.`
        : `${topApplied?.label ?? "Stress scenario"} reduces 90-day cash by ${fmtCompactUsd(Math.abs(diff.d90Delta))} USD.`;
      fHints.push({
        key: "copilot-forecast-stress",
        module: "treasury",
        severity: newNegative ? "risk" : "watch",
        text,
        related: { eventKeys: ["forecast-shock"] },
      });
    }

    /* Customer-delay targeted hint when an obvious driver exists. */
    if (assumptions?.customerDelay && stress) {
      const targeted = stress.assumptions.find((a) => a.key === "customer_delay");
      if (targeted && targeted.cashImpact >= 5_000) {
        const customerHint = stress.drivers.topInflows[0];
        if (customerHint) {
          fHints.push({
            key: "copilot-forecast-customer-delay",
            module: "treasury",
            severity: "watch",
            text: `If ${customerHint.party} delays ${assumptions.customerDelay.days}d, ${fmtCompactUsd(customerHint.amountReporting)} USD shifts out of the window.`,
            related: { eventKeys: ["forecast-customer-delay"] },
          });
        }
      }
    }

    /* Largest liquidity-risk driver — calm summary when nothing
       above fired but the base case carries a meaningful driver. */
    if (fHints.length === 0 && base) {
      const topOut = base.drivers.topOutflows[0];
      if (topOut && topOut.amountReporting >= 25_000) {
        fHints.push({
          key: "copilot-forecast-driver",
          module: "treasury",
          severity: "info",
          text: `Largest outflow in the next ${base.horizonDays}d is ${topOut.party} at ${fmtCompactUsd(topOut.amountReporting)} USD on day ${topOut.daysFromNow}.`,
        });
      }
    }

    for (const h of fHints.slice(0, 2)) {
      if (known.has(h.key)) continue;
      if (hints.length >= MAX_HINTS) break;
      hints.push(h);
      known.add(h.key);
    }
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
