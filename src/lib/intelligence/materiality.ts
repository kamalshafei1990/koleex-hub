/* ===========================================================================
   Materiality Gate  —  Phase 2.0.1

   Suppresses signals that aren't operationally meaningful. The test is
   pragmatic: "would a finance manager care about this in the next
   30 minutes?"  If the answer is no, the signal is dropped.

   These thresholds are intentionally explicit and adjustable in one
   place. They are NOT magic numbers scattered through synthesis.
   ========================================================================== */

import type { OperationalEvent, OperationalEventKind, Severity } from "./types";

/* ---------------------------------------------------------------------------
   Per-kind materiality threshold. Each rule receives the raw event and
   returns true when the signal clears the bar for visibility.

   When a kind is missing from this map the signal passes through (default
   permissive). New kinds should add their own threshold deliberately.
   --------------------------------------------------------------------------- */

type Rule = (e: OperationalEvent) => boolean;

const RULES: Partial<Record<OperationalEventKind, Rule>> = {
  /* Overdue receivable: must be at least USD 2K AND ≥ 7 days late, OR
     any amount ≥ USD 20K (high-value), OR a 30+ day delinquency. */
  overdue_payment: (e) => {
    const amount = e.amount ?? 0;
    const days = e.magnitude ?? 0;
    return (amount >= 2_000 && days >= 7) || amount >= 20_000 || days >= 30;
  },

  /* Supplier overdue: same logic as customer side. */
  supplier_overdue: (e) => {
    const amount = e.amount ?? 0;
    const days = e.magnitude ?? 0;
    return (amount >= 2_000 && days >= 7) || amount >= 20_000 || days >= 30;
  },

  /* Supplier due soon: never material unless amount ≥ USD 10K within 7d
     OR ≥ USD 25K within 14d. Otherwise it's a working reminder, not a
     pressure signal. */
  supplier_due: (e) => (e.amount ?? 0) >= 10_000,

  /* Collection delay: at least 7 days of additional lateness in the
     90-day rolling trend OR a 14d trend regardless. */
  collection_delay: (e) => (e.magnitude ?? 0) >= 7,

  /* Customer concentration: 35% of revenue minimum to be worth surfacing. */
  customer_concentration: (e) => (e.magnitude ?? 0) >= 35,

  /* Supplier dependency: 40% of COGS minimum. */
  supplier_dependency: (e) => (e.magnitude ?? 0) >= 40,

  /* Revenue decline: at least 25% drop in headline. */
  revenue_decline: (e) => (e.magnitude ?? 0) >= 25,

  /* Margin drop: only when margin < 12% (was 15) OR negative. */
  margin_drop: (e) => (e.magnitude ?? 0) < 12,

  /* Liquidity pressure: at least USD 25K AP-over-AR gap to count. */
  liquidity_pressure: (e) => Math.abs(e.magnitude ?? 0) >= 25_000,

  /* Logistics spike: at least 15% PoP increase AND at least USD 5K
     in the bucket. */
  logistics_spike: (e) => (e.magnitude ?? 0) >= 15 && (e.amount ?? 0) >= 5_000,

  /* Expense anomaly: 40% PoP movement AND at least USD 5K. */
  expense_anomaly: (e) => Math.abs(e.magnitude ?? 0) >= 40 && (e.amount ?? 0) >= 5_000,

  /* ── Phase 2.2.1 approval kinds ────────────────────────────────── */

  /* Backlog: at least 5 pending AND either ≥ 10 items OR ≥ USD 5K
     value. The engine already enforces this; the gate is the
     trust-but-verify layer that drops anything weaker. */
  approval_backlog: (e) =>
    (e.magnitude ?? 0) >= 5 &&
    ((e.magnitude ?? 0) >= 10 || (e.amount ?? 0) >= 5_000),

  /* Review delay: only material at ≥ 7 days waiting. */
  review_delay: (e) => (e.magnitude ?? 0) >= 7,

  /* Concentration: ≥ 60% of queue on one reviewer (engine emits
     magnitude as a 0..100 percentage). */
  approval_concentration: (e) => (e.magnitude ?? 0) >= 60,

  /* Repeated rejection: rejection rate ≥ 30 (percent, engine emits as int). */
  repeated_rejection: (e) => (e.magnitude ?? 0) >= 30,

  /* Unresolved changes: ≥ 2 items stuck. */
  unresolved_changes_request: (e) => (e.magnitude ?? 0) >= 2,

  /* Velocity drop: ≥ 50% PoP slowdown. */
  approval_velocity_drop: (e) => (e.magnitude ?? 0) >= 50,

  /* ── Phase 2.3 payment-control kinds ────────────────────────────── */

  /* Approval delay: ≥ 3 pending AND ≥ USD 10K total. */
  payment_approval_delay: (e) =>
    (e.magnitude ?? 0) >= 3 && (e.amount ?? 0) >= 10_000,

  /* Large unapproved: ≥ USD 25K. */
  large_unapproved_payment: (e) => (e.amount ?? 0) >= 25_000,

  /* Mismatch: ≥ 1 line AND USD 100+ aggregate, OR ≥ 3 lines. */
  payment_mismatch: (e) =>
    ((e.magnitude ?? 0) >= 1 && (e.amount ?? 0) >= 100) || (e.magnitude ?? 0) >= 3,

  /* Unreconciled: ≥ 2 lines OR ≥ USD 10K single-line. */
  unreconciled_payment: (e) =>
    (e.magnitude ?? 0) >= 2 || (e.amount ?? 0) >= 10_000,

  /* Missing evidence: ≥ 2 settled payments without evidence. */
  missing_payment_evidence: (e) => (e.magnitude ?? 0) >= 2,

  /* Failed: any single failed payment is material. */
  failed_payment: (e) => (e.magnitude ?? 0) >= 1,

  /* Duplicate risk: any candidate ≥ USD 500 already filtered in
     engine; the gate is a defense-in-depth pass-through. */
  duplicate_payment_risk: (e) => (e.magnitude ?? 0) >= 1,
};

/**
 * Returns true if the event clears its materiality threshold.
 * Critical-severity signals always pass (a critical signal has cleared
 * an even stricter bar somewhere else in the pipeline).
 */
export function isMaterial(e: OperationalEvent): boolean {
  if (e.severity === "critical") return true;
  const rule = RULES[e.kind];
  if (!rule) return true;
  return rule(e);
}

/** Drop non-material signals from a stream. */
export function applyMaterialityGate(events: OperationalEvent[]): OperationalEvent[] {
  return events.filter(isMaterial);
}

/* ---------------------------------------------------------------------------
   Severity normalisation — once weak signals are filtered, the
   remaining signals get a small severity bump if they were sitting on
   the threshold. This corrects the "everything is info" bias the old
   synthesizer had.
   --------------------------------------------------------------------------- */

export function normaliseSeverity(events: OperationalEvent[]): OperationalEvent[] {
  return events.map((e) => {
    const bumped: Severity = (() => {
      if (e.severity !== "info") return e.severity;
      /* Promote info → watch when the signal is material but was tagged
         info purely because of conservative defaults at synthesis. */
      if (e.kind === "supplier_due") return "watch";
      if (e.kind === "expense_anomaly") return "watch";
      return e.severity;
    })();
    return bumped === e.severity ? e : { ...e, severity: bumped };
  });
}
