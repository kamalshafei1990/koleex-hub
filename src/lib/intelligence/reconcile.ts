/* ===========================================================================
   Auto-reconciliation matching helpers — Phase 2.4

   Deterministic similarity functions for matching a CashMovement
   against a candidate FinancePayment. All scores are 0..1; the caller
   combines them into a single confidence score and decides what to
   do (auto-match above 0.9; suggest above 0.6; ignore below).

   Pure functions — no fetch, no React. The Phase-2.5 ML matcher will
   layer on top of these baselines without replacing them.
   ========================================================================== */

import type { CashMovement, FinancePayment } from "@/lib/finance/types";

const REF_NORMALIZE = /[^a-z0-9]/gi;

function normaliseRef(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(REF_NORMALIZE, "");
}

/* ---------------------------------------------------------------------------
   Individual signals — each returns 0..1
   --------------------------------------------------------------------------- */

/** Exact-amount match. 1.0 when within 0.01, else linear decay to 0 by 5%. */
export function amountScore(movement: CashMovement, payment: FinancePayment): number {
  const expected = Number(payment.expected_amount ?? payment.amount ?? 0);
  const actual = Number(movement.amount ?? 0);
  if (expected <= 0 || actual <= 0) return 0;
  const diff = Math.abs(actual - expected);
  if (diff < 0.01) return 1;
  const ratio = diff / Math.max(expected, actual);
  if (ratio >= 0.05) return 0;
  /* Linear decay: 0% diff → 1, 5% diff → 0. */
  return 1 - ratio * 20;
}

/** Reference similarity. Returns 1.0 on exact normalised match,
 *  0.6 if one contains the other, else 0. */
export function referenceScore(movement: CashMovement, payment: FinancePayment): number {
  const a = normaliseRef(movement.bank_reference ?? movement.external_reference);
  const b = normaliseRef(payment.bank_reference ?? payment.reference_no);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return 0.6;
  return 0;
}

/** Timing proximity. 1.0 on same date, linear decay to 0 over 14 days. */
export function timingScore(movement: CashMovement, payment: FinancePayment): number {
  const m = new Date(movement.movement_date).getTime();
  const p = new Date(payment.payment_date).getTime();
  if (Number.isNaN(m) || Number.isNaN(p)) return 0;
  const days = Math.abs((m - p) / 86_400_000);
  if (days < 0.5) return 1;
  if (days >= 14) return 0;
  return Math.max(0, 1 - days / 14);
}

/** Counterparty similarity. Case-insensitive token overlap. */
export function counterpartyScore(movement: CashMovement, payment: FinancePayment): number {
  const a = (movement.counterparty_name ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const b = (payment.party_name ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  let overlap = 0;
  for (const t of b) if (setA.has(t)) overlap += 1;
  return Math.min(1, overlap / Math.max(a.length, b.length));
}

/** Direction match. Inflow ⇔ direction 'in', outflow ⇔ direction 'out'. */
export function directionScore(movement: CashMovement, payment: FinancePayment): number {
  const expected = payment.direction === "in" ? "inflow" : "outflow";
  return movement.direction === expected ? 1 : 0;
}

/* ---------------------------------------------------------------------------
   Composite confidence
   --------------------------------------------------------------------------- */

export interface MatchScore {
  total: number;        // 0..1 — composite confidence
  amount: number;
  reference: number;
  timing: number;
  counterparty: number;
  direction: number;    // 0 or 1 — multiplier
  partial: boolean;     // true when amount ratio is in 0.05..0.5 range
}

/**
 * Composite confidence with a hard direction filter — wrong-direction
 * matches always score 0 regardless of other signals.
 *
 *   total = direction × (
 *     0.50 × amount +
 *     0.25 × reference +
 *     0.15 × timing +
 *     0.10 × counterparty
 *   )
 *
 * The weights reflect the audit reality: amount is king, references
 * are second-best (when present), timing is tertiary because batched
 * payments can land on different days, and counterparty is a tie-breaker.
 */
export function matchConfidence(movement: CashMovement, payment: FinancePayment): MatchScore {
  const a = amountScore(movement, payment);
  const r = referenceScore(movement, payment);
  const t = timingScore(movement, payment);
  const c = counterpartyScore(movement, payment);
  const d = directionScore(movement, payment);
  const total = d * (0.5 * a + 0.25 * r + 0.15 * t + 0.10 * c);
  const expected = Number(payment.expected_amount ?? payment.amount ?? 0);
  const actual = Number(movement.amount ?? 0);
  const partial = expected > 0 && actual > 0 &&
    Math.abs(actual - expected) / Math.max(expected, actual) >= 0.05 &&
    Math.abs(actual - expected) / Math.max(expected, actual) <= 0.5;
  return { total: Math.round(total * 100) / 100, amount: a, reference: r, timing: t, counterparty: c, direction: d, partial };
}

/* ---------------------------------------------------------------------------
   Duplicate-movement detection — flags two movements that look like
   the same bank event entered twice.
   --------------------------------------------------------------------------- */

export function duplicateMovementConfidence(a: CashMovement, b: CashMovement): number {
  if (a.id === b.id) return 0;
  if (a.bank_account_id !== b.bank_account_id) return 0;
  if (a.direction !== b.direction) return 0;
  if (a.currency !== b.currency) return 0;
  const amountDiff = Math.abs(a.amount - b.amount);
  if (amountDiff > 0.01) {
    /* Same to 2 decimals only is enough — treat as dup. */
    if (Math.abs(a.amount - b.amount) / Math.max(a.amount, b.amount) > 0.001) return 0;
  }
  const dA = new Date(a.movement_date).getTime();
  const dB = new Date(b.movement_date).getTime();
  if (Number.isNaN(dA) || Number.isNaN(dB)) return 0;
  const days = Math.abs((dA - dB) / 86_400_000);
  if (days > 3) return 0;
  /* If references differ, drop confidence; if they match exactly, boost. */
  const aRef = normaliseRef(a.bank_reference ?? a.external_reference);
  const bRef = normaliseRef(b.bank_reference ?? b.external_reference);
  if (aRef && bRef && aRef === bRef) return 0.95;
  if (aRef && bRef && aRef !== bRef) return 0.4;
  return 0.7;
}

/**
 * Walk the cross-product of movements and payments to find the best
 * candidate match per movement above a confidence floor. Pure; returns
 * the suggestion list ordered by confidence desc.
 */
export interface MatchSuggestion {
  movementId: string;
  paymentId: string;
  confidence: number;
  scores: MatchScore;
}

export function suggestMatches(
  movements: CashMovement[],
  payments: FinancePayment[],
  confidenceFloor = 0.6,
): MatchSuggestion[] {
  const out: MatchSuggestion[] = [];
  for (const m of movements) {
    if (m.reconciliation_status !== "unreconciled") continue;
    let best: { paymentId: string; scores: MatchScore } | null = null;
    for (const p of payments) {
      const scores = matchConfidence(m, p);
      if (scores.total < confidenceFloor) continue;
      if (!best || scores.total > best.scores.total) best = { paymentId: p.id, scores };
    }
    if (best) out.push({ movementId: m.id, paymentId: best.paymentId, confidence: best.scores.total, scores: best.scores });
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}
