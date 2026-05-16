/* ===========================================================================
   Reconciliation Intelligence — Phase 2.5

   Reads the persisted finance_reconciliation_candidates rows (passed in
   from the API caller) and turns them into operational events that flow
   through the shared materiality → noise → priority pipeline.

   Pure function — no DB, no fetch, no React.

   Discipline:
     · weak/empty signals disappear (no candidates → no events)
     · severities mirror the Phase 2.x calibration (≥0.85 = strong, etc.)
     · every event carries the integer count that triggered it so the
       dashboard panels can render the same number without recomputing
   ========================================================================== */

import type {
  FinanceReconciliationCandidate,
  ReconciliationCandidateType,
} from "@/lib/finance/types";
import type { OperationalEvent, Severity } from "./types";
import { stableId } from "./behavior";

const NOW = () => Date.now();

const PARTIAL_TYPES: ReconciliationCandidateType[] = ["partial", "underpayment", "overpayment", "fee_adjusted"];

export interface ReconciliationIntelligenceInput {
  candidates: FinanceReconciliationCandidate[];
}

export interface ReconciliationSnapshot {
  events: OperationalEvent[];
  /** Pending suggested candidates. */
  pendingCount: number;
  /** High-confidence suggestions awaiting confirm. */
  highConfidencePendingCount: number;
  /** Suggestions older than 7 days (waiting too long). */
  oldestPendingDays: number;
  /** Rejected suggestions in the last 30 days. */
  rejectedRecentCount: number;
  /** Duplicate-risk candidates outstanding. */
  duplicateRiskCount: number;
  /** Partial / under / over candidates outstanding. */
  partialPendingCount: number;
  /** Pairs that have been rejected ≥ 2 times — pattern signal. */
  repeatRejectionPairs: number;
}

function daysAgo(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((NOW() - t) / 86_400_000));
}

export function buildReconciliationSnapshot(
  input: ReconciliationIntelligenceInput,
): ReconciliationSnapshot {
  const candidates = input.candidates ?? [];

  /* No candidates at all → dormant snapshot. The engine has either not
     run yet (e.g. fresh tenant) or there's genuinely nothing to do. */
  if (candidates.length === 0) {
    return {
      events: [],
      pendingCount: 0,
      highConfidencePendingCount: 0,
      oldestPendingDays: 0,
      rejectedRecentCount: 0,
      duplicateRiskCount: 0,
      partialPendingCount: 0,
      repeatRejectionPairs: 0,
    };
  }

  const suggested = candidates.filter((c) => c.status === "suggested");
  const highConfPending = suggested.filter((c) => c.confidence_level === "high");
  const pendingCount = suggested.length;
  const highConfidencePendingCount = highConfPending.length;

  /* Oldest waiting age across suggested rows. */
  let oldestPendingDays = 0;
  for (const c of suggested) {
    const age = daysAgo(c.suggested_at);
    if (age > oldestPendingDays) oldestPendingDays = age;
  }

  /* Rejections in the last 30 days. */
  const cutoff = Date.now() - 30 * 86_400_000;
  const rejected = candidates.filter((c) => c.status === "rejected");
  const rejectedRecent = rejected.filter((c) => c.rejected_at && new Date(c.rejected_at).getTime() >= cutoff);
  const rejectedRecentCount = rejectedRecent.length;

  /* Repeat-rejection pairs — same (payment_id, cash_movement_id) seen
     in rejected ≥ 2 times. Strong signal of a noisy matcher or genuine
     ambiguity in the data. */
  const pairRejectCount = new Map<string, number>();
  for (const c of rejected) {
    const k = `${c.payment_id}::${c.cash_movement_id}`;
    pairRejectCount.set(k, (pairRejectCount.get(k) ?? 0) + 1);
  }
  let repeatRejectionPairs = 0;
  for (const v of pairRejectCount.values()) if (v >= 2) repeatRejectionPairs += 1;

  /* Outstanding duplicate-risk and partial-match candidates. */
  const duplicateRiskCount = suggested.filter((c) => c.candidate_type === "duplicate_risk").length;
  const partialPendingCount = suggested.filter((c) => PARTIAL_TYPES.includes(c.candidate_type)).length;

  const events: OperationalEvent[] = [];
  const now = NOW();

  /* ── high_confidence_unconfirmed_match ──
     A pile of ≥85% suggestions waiting for confirmation is wasted
     reconciliation capacity. Watch when there's any high-confidence
     queue; escalates to risk when ≥10 sit idle. */
  if (highConfidencePendingCount >= 1) {
    const severity: Severity =
      highConfidencePendingCount >= 10 ? "risk" :
      highConfidencePendingCount >= 3  ? "watch" :
      "watch";
    events.push({
      key: stableId(["recon-high-conf"]),
      source: "treasury",
      kind: "high_confidence_unconfirmed_match",
      severity,
      magnitude: highConfidencePendingCount,
      label: `${highConfidencePendingCount} high-confidence match${highConfidencePendingCount === 1 ? "" : "es"} unconfirmed`,
      detail: `${highConfidencePendingCount} bank-movement matches scored ≥85% confidence but still wait for operator confirm — reconcile to release cash position.`,
      ts: now,
    });
  }

  /* ── reconciliation_backlog ──
     Total suggested queue is the canonical backlog measure. Calm under
     5; watch 5..14; risk ≥15. Treat oldest-waiting-days as a
     materiality booster — old items deserve escalation. */
  if (pendingCount >= 5) {
    const severity: Severity =
      pendingCount >= 15 || oldestPendingDays >= 14 ? "risk" :
      pendingCount >= 10 || oldestPendingDays >= 7  ? "watch" :
      "watch";
    events.push({
      key: stableId(["recon-backlog"]),
      source: "treasury",
      kind: "reconciliation_backlog",
      severity,
      magnitude: pendingCount,
      label: `${pendingCount} reconciliations in queue`,
      detail: `${pendingCount} match suggestion${pendingCount === 1 ? "" : "s"} await${pendingCount === 1 ? "s" : ""} operator decision${oldestPendingDays >= 7 ? ` — oldest is ${oldestPendingDays} days old` : ""}.`,
      ts: now,
    });
  }

  /* ── duplicate_cash_movement_risk ── */
  if (duplicateRiskCount >= 1) {
    const severity: Severity = duplicateRiskCount >= 3 ? "risk" : "watch";
    events.push({
      key: stableId(["recon-duplicate"]),
      source: "treasury",
      kind: "duplicate_cash_movement_risk",
      severity,
      magnitude: duplicateRiskCount,
      label: `${duplicateRiskCount} possible duplicate bank movement${duplicateRiskCount === 1 ? "" : "s"}`,
      detail: `${duplicateRiskCount} cash movement${duplicateRiskCount === 1 ? "" : "s"} look like duplicates — confirm with the bank before reconciling.`,
      ts: now,
    });
  }

  /* ── partial_match_pressure ──
     ≥3 outstanding partial/over/under/fee_adjusted candidates suggests
     a systemic issue (FX leg, partial settlements, payment scheduling). */
  if (partialPendingCount >= 3) {
    const severity: Severity = partialPendingCount >= 8 ? "risk" : "watch";
    events.push({
      key: stableId(["recon-partial"]),
      source: "treasury",
      kind: "partial_match_pressure",
      severity,
      magnitude: partialPendingCount,
      label: `${partialPendingCount} partial / variance matches`,
      detail: `${partialPendingCount} partial, under, over, or fee-adjusted matches sit in queue — recurring shape suggests a systemic discrepancy worth investigating.`,
      ts: now,
    });
  }

  /* ── rejected_reconciliation_pattern ──
     ≥5 rejections in the last 30 days OR ≥2 repeat-rejection pairs
     indicate the matcher is producing noise or the data has ambiguous
     duplicates. */
  if (rejectedRecentCount >= 5 || repeatRejectionPairs >= 2) {
    const severity: Severity =
      repeatRejectionPairs >= 3 || rejectedRecentCount >= 15 ? "risk" :
      "watch";
    const detail =
      repeatRejectionPairs >= 2
        ? `${repeatRejectionPairs} payment/movement pair${repeatRejectionPairs === 1 ? " has" : "s have"} been rejected more than once — investigate ambiguous data.`
        : `${rejectedRecentCount} reconciliation suggestions rejected in the last 30 days — review matcher accuracy or data quality.`;
    events.push({
      key: stableId(["recon-rejection-pattern"]),
      source: "treasury",
      kind: "rejected_reconciliation_pattern",
      severity,
      magnitude: Math.max(rejectedRecentCount, repeatRejectionPairs),
      label: `Reconciliation rejections trending up`,
      detail,
      ts: now,
    });
  }

  return {
    events,
    pendingCount,
    highConfidencePendingCount,
    oldestPendingDays,
    rejectedRecentCount,
    duplicateRiskCount,
    partialPendingCount,
    repeatRejectionPairs,
  };
}
