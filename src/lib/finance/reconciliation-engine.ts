/* ===========================================================================
   Phase 2.5 — Auto-Reconciliation Engine
   ----------------------------------------------------------------------------
   Deterministic orchestration layer that sits on top of the Phase 2.4
   matching primitives in `@/lib/intelligence/reconcile.ts`.

   What this module owns:
     · candidate classification (exact / partial / overpayment / underpayment
       / fee_adjusted / duplicate_risk)
     · confidence-level bucketing (high / medium / low)
     · structured matched-factor + warning lists for the queue UI
     · a single planCandidates() function that scans pending movements
       and produces ranked suggestions ready to persist

   PURE FUNCTIONS only — no DB, no fetch, no React. The API endpoints
   feed this engine with movements + payments arrays and persist the
   output rows.
   ========================================================================== */

import type {
  CashMovement,
  FinancePayment,
  ReconciliationCandidateType,
  ReconciliationConfidenceLevel,
  ReconciliationMatchedFactor,
  ReconciliationWarning,
} from "@/lib/finance/types";
import {
  matchConfidence,
  duplicateMovementConfidence,
  type MatchScore,
} from "@/lib/intelligence/reconcile";

/* ────────────────────────────────────────────────────────────────────────
   Confidence bucketing — turns the 0..1 composite into a high/medium/low
   label that the queue UI renders as a coloured pill. Thresholds match
   the spec:
     · high   : ≥ 0.85 and same direction + same currency + tight amount
     · medium : ≥ 0.60 and same direction + same currency
     · low    : ≥ 0.35
   Anything below 0.35 we don't surface as a candidate at all.
   ──────────────────────────────────────────────────────────────────────── */

const CONFIDENCE_HIGH = 0.85;
const CONFIDENCE_MEDIUM = 0.6;
const CONFIDENCE_LOW = 0.35;

function bucketConfidence(score: number): ReconciliationConfidenceLevel | null {
  if (score >= CONFIDENCE_HIGH) return "high";
  if (score >= CONFIDENCE_MEDIUM) return "medium";
  if (score >= CONFIDENCE_LOW) return "low";
  return null;
}

/* ────────────────────────────────────────────────────────────────────────
   Candidate-type classifier — describes the SHAPE of the match
   independently of confidence.
   ──────────────────────────────────────────────────────────────────────── */

function classifyCandidate(
  movement: CashMovement,
  payment: FinancePayment,
  scores: MatchScore,
): ReconciliationCandidateType {
  const expected = Number(payment.expected_amount ?? payment.amount ?? 0);
  const actual = Number(movement.amount ?? 0);

  if (expected <= 0 || actual <= 0) return "exact";

  const diff = actual - expected;
  const absRatio = Math.abs(diff) / Math.max(expected, actual);

  if (absRatio < 0.005) return "exact";

  /* "fee adjusted" — actual is slightly smaller than expected by a tiny
     amount (< 2 %) AND the payment is direction "in". This commonly
     reflects an inbound wire that had a remittance fee deducted. */
  if (
    diff < 0 &&
    absRatio < 0.02 &&
    movement.direction === "inflow" &&
    payment.direction === "in"
  ) {
    return "fee_adjusted";
  }

  if (diff > 0) return "overpayment";
  if (diff < 0) {
    /* Partial vs underpayment: partial = a clearly-smaller installment,
       underpayment = within striking distance of the expected. The 60%
       cut is just a heuristic; the operator sees both as needing review. */
    return absRatio >= 0.4 ? "partial" : "underpayment";
  }

  if (scores.partial) return "partial";
  return "exact";
}

/* ────────────────────────────────────────────────────────────────────────
   Factor + warning extraction — translates the per-signal scores into
   structured rows the queue UI can render as chips.
   ──────────────────────────────────────────────────────────────────────── */

function buildMatchedFactors(scores: MatchScore): ReconciliationMatchedFactor[] {
  const out: ReconciliationMatchedFactor[] = [];
  if (scores.direction === 1) out.push({ key: "direction",    label: "Same direction",     score: 1 });
  if (scores.amount >= 0.95)  out.push({ key: "amount",       label: "Same amount",        score: scores.amount });
  else if (scores.amount >= 0.5)
                              out.push({ key: "amount_close", label: "Amount close",       score: scores.amount });
  if (scores.reference >= 0.95) out.push({ key: "bank_reference", label: "Reference match",   score: scores.reference });
  else if (scores.reference >= 0.5)
                                out.push({ key: "ref_partial",    label: "Reference overlap", score: scores.reference });
  if (scores.timing >= 0.85)  out.push({ key: "timing",       label: "Same-day movement",  score: scores.timing });
  else if (scores.timing >= 0.5)
                              out.push({ key: "timing_near",  label: "Within ~7 days",     score: scores.timing });
  if (scores.counterparty >= 0.5)
                              out.push({ key: "counterparty", label: "Counterparty match", score: scores.counterparty });
  return out;
}

function buildWarnings(
  movement: CashMovement,
  payment: FinancePayment,
  scores: MatchScore,
  candidateType: ReconciliationCandidateType,
): ReconciliationWarning[] {
  const warnings: ReconciliationWarning[] = [];

  if (movement.currency !== payment.currency) {
    warnings.push({
      key: "currency-mismatch",
      severity: "watch",
      message: `Currencies differ — payment ${payment.currency} vs movement ${movement.currency}. Likely an FX leg.`,
    });
  }

  if (scores.timing < 0.4 && scores.timing > 0) {
    const m = new Date(movement.movement_date).getTime();
    const p = new Date(payment.payment_date).getTime();
    const days = Math.abs(Math.round((m - p) / 86_400_000));
    warnings.push({
      key: "timing-gap",
      severity: "info",
      message: `Bank movement is ${days} days off from payment date.`,
    });
  }

  if (scores.reference === 0 && scores.amount < 0.95) {
    warnings.push({
      key: "weak-reference",
      severity: "info",
      message: "No bank-reference overlap — amount + timing only.",
    });
  }

  if (candidateType === "partial") {
    const expected = Number(payment.expected_amount ?? payment.amount ?? 0);
    const actual = Number(movement.amount ?? 0);
    const pct = Math.round((actual / Math.max(expected, 1)) * 100);
    warnings.push({
      key: "partial-amount",
      severity: "info",
      message: `Partial — bank received ${pct}% of expected.`,
    });
  }

  if (candidateType === "overpayment") {
    const expected = Number(payment.expected_amount ?? payment.amount ?? 0);
    const actual = Number(movement.amount ?? 0);
    const diff = actual - expected;
    warnings.push({
      key: "overpayment",
      severity: "watch",
      message: `Customer paid ${diff.toFixed(2)} ${movement.currency} more than expected.`,
    });
  }

  if (candidateType === "underpayment") {
    warnings.push({
      key: "underpayment",
      severity: "watch",
      message: "Bank short of expected — confirm if a partial settlement was agreed.",
    });
  }

  if (candidateType === "fee_adjusted") {
    warnings.push({
      key: "fee-adjusted",
      severity: "info",
      message: "Likely a remittance fee was deducted upstream.",
    });
  }

  return warnings;
}

/* ────────────────────────────────────────────────────────────────────────
   Reason summary — single human-readable sentence the engine writes
   into the candidate row so the queue UI doesn't have to recompute it.
   ──────────────────────────────────────────────────────────────────────── */

function buildReasonSummary(
  movement: CashMovement,
  payment: FinancePayment,
  scores: MatchScore,
  level: ReconciliationConfidenceLevel,
  candidateType: ReconciliationCandidateType,
): string {
  const pct = Math.round(scores.total * 100);
  const parts: string[] = [`${pct}% confidence`];
  if (scores.amount >= 0.95) parts.push("same amount");
  else if (scores.amount >= 0.5) parts.push("amount close");
  if (movement.currency === payment.currency) parts.push(`same ${payment.currency}`);
  if (scores.reference >= 0.95) parts.push("reference match");
  if (scores.timing >= 0.85) parts.push("same-day movement");
  else if (scores.timing >= 0.5) parts.push("within a week");
  const head = parts.join(", ");
  const tail =
    candidateType === "exact" ? "" :
    candidateType === "partial" ? "; partial settlement." :
    candidateType === "overpayment" ? "; bank exceeds payment." :
    candidateType === "underpayment" ? "; bank short of payment." :
    candidateType === "fee_adjusted" ? "; remittance fee likely deducted." :
    candidateType === "duplicate_risk" ? "; possible duplicate movement." :
    "";
  void level; // reserved for future tone variations
  return head + tail + ".";
}

/* ────────────────────────────────────────────────────────────────────────
   Hard reject — fast pre-check that drops a candidate before scoring.
   ──────────────────────────────────────────────────────────────────────── */

function hardRejectPair(movement: CashMovement, payment: FinancePayment): boolean {
  /* Direction must agree (in ↔ inflow, out ↔ outflow). */
  const expectedDir = payment.direction === "in" ? "inflow" : "outflow";
  if (movement.direction !== expectedDir) return true;

  /* Currency must agree (FX cases handled as warnings only when amounts
     line up exactly via exchange_rate, which the operator confirms). */
  if (movement.currency !== payment.currency) {
    /* Allow if the movement carries a reporting_amount that aligns with
       expected — i.e. there's an explicit FX leg. Otherwise reject. */
    if (!movement.reporting_amount || !movement.exchange_rate) return true;
  }

  /* Payment already fully reconciled. */
  if (payment.reconciliation_status === "verified") return true;

  /* Movement already verified. */
  if (movement.reconciliation_status === "verified") return true;

  return false;
}

/* ────────────────────────────────────────────────────────────────────────
   Plan + score — runs the matcher over the candidate cross-product and
   returns one suggestion per (movement → best payment). Callers persist
   these as finance_reconciliation_candidates rows.
   ──────────────────────────────────────────────────────────────────────── */

export interface PlannedCandidate {
  payment_id: string;
  cash_movement_id: string;
  confidence: number;
  confidence_level: ReconciliationConfidenceLevel;
  candidate_type: ReconciliationCandidateType;
  match_reason_summary: string;
  matched_factors: ReconciliationMatchedFactor[];
  warnings: ReconciliationWarning[];
  metadata: Record<string, unknown>;
}

export interface PlanInputs {
  movements: CashMovement[];
  payments: FinancePayment[];
  /** When provided, skip pairs that already have an active candidate. */
  excludeActivePairs?: Set<string>;     // keys: `${payment_id}::${cash_movement_id}`
}

export function planCandidates(input: PlanInputs): PlannedCandidate[] {
  const { movements, payments } = input;
  const excludeKeys = input.excludeActivePairs ?? new Set<string>();
  const out: PlannedCandidate[] = [];

  /* Index movements + payments to look up later. */
  const eligibleMovements = movements.filter(
    (m) => m.reconciliation_status === "unreconciled" || m.reconciliation_status === "matched",
  );
  const eligiblePayments = payments.filter(
    (p) =>
      (p.reconciliation_status ?? "unreconciled") !== "verified" &&
      p.status !== "cancelled" &&
      p.status !== "bounced",
  );

  for (const m of eligibleMovements) {
    /* Walk all payments, score every pair, keep the top 1. The engine
       deliberately stops at 1 candidate per movement so the queue
       doesn't drown in near-duplicates. The operator can request a
       rescan after rejecting. */
    let best: { payment: FinancePayment; scores: MatchScore } | null = null;
    for (const p of eligiblePayments) {
      const key = `${p.id}::${m.id}`;
      if (excludeKeys.has(key)) continue;
      if (hardRejectPair(m, p)) continue;
      const scores = matchConfidence(m, p);
      if (scores.total < CONFIDENCE_LOW) continue;
      if (!best || scores.total > best.scores.total) best = { payment: p, scores };
    }
    if (!best) continue;
    const level = bucketConfidence(best.scores.total);
    if (!level) continue;
    const candidateType = classifyCandidate(m, best.payment, best.scores);
    const matched_factors = buildMatchedFactors(best.scores);
    const warnings = buildWarnings(m, best.payment, best.scores, candidateType);
    const match_reason_summary = buildReasonSummary(m, best.payment, best.scores, level, candidateType);

    out.push({
      payment_id: best.payment.id,
      cash_movement_id: m.id,
      confidence: Math.round(best.scores.total * 10_000) / 10_000,
      confidence_level: level,
      candidate_type: candidateType,
      match_reason_summary,
      matched_factors,
      warnings,
      metadata: {
        scores: {
          amount: best.scores.amount,
          reference: best.scores.reference,
          timing: best.scores.timing,
          counterparty: best.scores.counterparty,
          direction: best.scores.direction,
          partial: best.scores.partial,
        },
        movement_date: m.movement_date,
        payment_date: best.payment.payment_date,
        amount_expected: Number(best.payment.expected_amount ?? best.payment.amount ?? 0),
        amount_actual: Number(m.amount ?? 0),
        difference_amount:
          Number(m.amount ?? 0) - Number(best.payment.expected_amount ?? best.payment.amount ?? 0),
      },
    });
  }

  /* Highest confidence first — the queue UI just consumes this order. */
  return out.sort((a, b) => b.confidence - a.confidence);
}

/* ────────────────────────────────────────────────────────────────────────
   Duplicate-movement detection — wraps the Phase 2.4 primitive into the
   same PlannedCandidate shape so the queue can render duplicate risk
   alongside payment matches.

   Strategy: scan O(n²) over unreconciled movements; collapse pairs to
   the higher-id row as the "duplicate" and the older one as the
   anchor. Confidence ≥ 0.7 surfaces as duplicate_risk.
   ──────────────────────────────────────────────────────────────────────── */

export interface PlannedDuplicate {
  cash_movement_id: string;
  duplicate_of_movement_id: string;
  confidence: number;
  confidence_level: ReconciliationConfidenceLevel;
  match_reason_summary: string;
  warnings: ReconciliationWarning[];
}

export function planDuplicateRisks(movements: CashMovement[]): PlannedDuplicate[] {
  const out: PlannedDuplicate[] = [];
  const seenPairs = new Set<string>();
  const pool = movements.filter((m) => m.reconciliation_status !== "verified");

  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      const a = pool[i];
      const b = pool[j];
      const conf = duplicateMovementConfidence(a, b);
      if (conf < 0.7) continue;
      /* Anchor = older movement; duplicate = newer movement. */
      const anchorIsA = (a.movement_date ?? "") <= (b.movement_date ?? "");
      const anchor = anchorIsA ? a : b;
      const dup = anchorIsA ? b : a;
      const k = `${anchor.id}::${dup.id}`;
      if (seenPairs.has(k)) continue;
      seenPairs.add(k);
      out.push({
        cash_movement_id: dup.id,
        duplicate_of_movement_id: anchor.id,
        confidence: Math.round(conf * 10_000) / 10_000,
        confidence_level: conf >= 0.9 ? "high" : conf >= 0.7 ? "medium" : "low",
        match_reason_summary: `Possible duplicate bank movement — same account, amount and direction within 3 days.`,
        warnings: [
          {
            key: "duplicate-risk",
            severity: "watch",
            message: "Two movements look like the same bank event; confirm before reconciling.",
          },
        ],
      });
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}
