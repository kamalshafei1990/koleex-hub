/* ===========================================================================
   Payment Control Intelligence  —  Phase 2.3

   Reads finance_payments rows (with Phase-2.3 approval + reconciliation
   columns) and produces:

     · pending-approval summary    (count + value + oldest waiting)
     · reconciliation summary      (unreconciled + mismatch + disputed)
     · evidence summary            (paid items missing bank evidence)
     · failed-movement count
     · operational events          (the 7 new payment kinds, all
                                    materially filtered)
     · composite 0..100 health     (consumed by composeBusinessHealth)

   The engine is a pure function of the payment list — no API calls,
   no React, no async. Same discipline rules as the rest of the
   intelligence layer: weak signals disappear, narratives anchor on
   concrete numbers.
   ========================================================================== */

import type { ApprovalStatus, FinancePayment } from "@/lib/finance/types";
import type {
  OperationalEvent,
  PaymentControlSnapshot,
  Pressure,
  Severity,
} from "./types";
import { clamp01, daysFromToday, stableId } from "./behavior";

const NOW = () => Date.now();

const PENDING_APPROVAL: ReadonlySet<ApprovalStatus> = new Set([
  "submitted", "under_review", "requires_changes",
]);

const TERMINAL_MOVEMENT: ReadonlySet<string> = new Set([
  "paid", "received", "partially_paid", "partially_received",
]);

const MISMATCH_TOLERANCE_USD = 1;        // less than $1 = matched
const UNRECONCILED_GRACE_DAYS = 3;        // ignore items < 3d since payment

function waitingDays(p: FinancePayment): number {
  const ts =
    p.approval_status === "requires_changes" ? (p.reviewed_at ?? p.submitted_at)
    : (p.submitted_at ?? p.reviewed_at ?? p.created_at ?? null);
  if (!ts) return 0;
  const d = daysFromToday(ts);
  return d == null ? 0 : Math.max(0, -d);
}

function paymentValue(p: FinancePayment): number {
  return Math.abs(Number(p.actual_amount ?? p.expected_amount ?? p.amount ?? 0));
}

function daysSincePayment(p: FinancePayment): number {
  const d = daysFromToday(p.payment_date);
  return d == null ? 0 : Math.max(0, -d);
}

/* ---------------------------------------------------------------------------
   Event synthesis
   --------------------------------------------------------------------------- */

function buildEvents(payments: FinancePayment[]): OperationalEvent[] {
  const out: OperationalEvent[] = [];
  const now = NOW();

  /* 1) Pending approvals — large payments waiting. */
  const pendingApproval = payments.filter((p) =>
    PENDING_APPROVAL.has((p.approval_status ?? "draft") as ApprovalStatus));
  const totalPendingValue = pendingApproval.reduce((s, p) => s + paymentValue(p), 0);
  const oldestPendingWait = pendingApproval.reduce((m, p) => Math.max(m, waitingDays(p)), 0);
  if (pendingApproval.length >= 3 && totalPendingValue >= 10_000) {
    const severity: Severity =
      totalPendingValue >= 100_000 || oldestPendingWait >= 14 ? "risk"
      : "watch";
    out.push({
      key: stableId(["payment-approval-delay"]),
      source: "payment",
      kind: "payment_approval_delay",
      severity,
      magnitude: pendingApproval.length,
      amount: totalPendingValue,
      label: `${pendingApproval.length} payments awaiting approval`,
      detail: `${pendingApproval.length} payments totalling ${formatCompact(totalPendingValue)} USD are pending approval${oldestPendingWait >= 7 ? `; oldest has waited ${Math.round(oldestPendingWait)} days` : ""}.`,
      ts: now,
    });
  }

  /* 2) Large unapproved payment — single high-value item in
        draft/submitted, regardless of how long it's been there. */
  const largeUnapproved = payments
    .filter((p) => {
      const a = (p.approval_status ?? "draft") as ApprovalStatus;
      return (a === "draft" || a === "submitted" || a === "under_review")
        && paymentValue(p) >= 25_000;
    })
    .sort((a, b) => paymentValue(b) - paymentValue(a))[0];
  if (largeUnapproved) {
    const value = paymentValue(largeUnapproved);
    const severity: Severity = value >= 100_000 ? "risk" : "watch";
    out.push({
      key: stableId(["payment-large-unapproved", largeUnapproved.id]),
      source: "payment",
      kind: "large_unapproved_payment",
      severity,
      entity: { type: "expense", id: largeUnapproved.id, name: largeUnapproved.party_name },
      amount: value,
      magnitude: value,
      label: `${largeUnapproved.party_name} · ${formatCompact(value)} unapproved`,
      detail: `High-value ${largeUnapproved.direction === "in" ? "incoming" : "outgoing"} payment of ${formatCompact(value)} USD to/from ${largeUnapproved.party_name} hasn't cleared approval yet.`,
      ts: now,
    });
  }

  /* 3) Payment mismatch — actual differs from expected materially. */
  const mismatches = payments.filter((p) =>
    p.expected_amount != null && p.actual_amount != null &&
    Math.abs((p.actual_amount as number) - (p.expected_amount as number)) > MISMATCH_TOLERANCE_USD);
  if (mismatches.length > 0) {
    const totalDiff = mismatches.reduce((s, p) => s + Math.abs((p.actual_amount as number) - (p.expected_amount as number)), 0);
    if (totalDiff >= 100 || mismatches.length >= 3) {
      const severity: Severity =
        totalDiff >= 5_000 || mismatches.length >= 5 ? "risk" : "watch";
      out.push({
        key: stableId(["payment-mismatch"]),
        source: "payment",
        kind: "payment_mismatch",
        severity,
        magnitude: mismatches.length,
        amount: totalDiff,
        label: `${mismatches.length} payment${mismatches.length === 1 ? "" : "s"} with bank mismatch`,
        detail: `${mismatches.length} payment${mismatches.length === 1 ? " has a" : "s have"} ${formatCompact(totalDiff)} USD aggregate difference between expected and bank-reported amounts.`,
        ts: now,
      });
    }
  }

  /* 4) Unreconciled (terminal but never reconciled, past the grace window). */
  const unreconciled = payments.filter((p) => {
    const movement = (p.movement_status ?? null) as string | null;
    const movementTerminal = movement != null && TERMINAL_MOVEMENT.has(movement);
    const legacyTerminal = movement == null && p.status === "completed";
    const isTerminal = movementTerminal || legacyTerminal;
    if (!isTerminal) return false;
    const recState = p.reconciliation_status ?? "unreconciled";
    if (recState !== "unreconciled") return false;
    return daysSincePayment(p) >= UNRECONCILED_GRACE_DAYS;
  });
  if (unreconciled.length >= 2 || (unreconciled.length >= 1 && unreconciled[0] && paymentValue(unreconciled[0]) >= 10_000)) {
    const totalValue = unreconciled.reduce((s, p) => s + paymentValue(p), 0);
    const severity: Severity =
      unreconciled.length >= 5 || totalValue >= 50_000 ? "risk" : "watch";
    out.push({
      key: stableId(["payment-unreconciled"]),
      source: "payment",
      kind: "unreconciled_payment",
      severity,
      magnitude: unreconciled.length,
      amount: totalValue,
      label: `${unreconciled.length} unreconciled payment${unreconciled.length === 1 ? "" : "s"}`,
      detail: `${unreconciled.length} completed payment${unreconciled.length === 1 ? " has" : "s have"} not been reconciled against bank evidence — ${formatCompact(totalValue)} USD unverified.`,
      ts: now,
    });
  }

  /* 5) Missing evidence on terminal payments. */
  const missingEvidence = payments.filter((p) => {
    const movement = (p.movement_status ?? null) as string | null;
    const movementTerminal = movement != null && TERMINAL_MOVEMENT.has(movement);
    const legacyTerminal = movement == null && p.status === "completed";
    if (!movementTerminal && !legacyTerminal) return false;
    if (p.has_payment_evidence) return false;
    return daysSincePayment(p) >= UNRECONCILED_GRACE_DAYS;
  });
  if (missingEvidence.length >= 2) {
    const totalValue = missingEvidence.reduce((s, p) => s + paymentValue(p), 0);
    const severity: Severity = missingEvidence.length >= 5 ? "risk" : "watch";
    out.push({
      key: stableId(["payment-missing-evidence"]),
      source: "payment",
      kind: "missing_payment_evidence",
      severity,
      magnitude: missingEvidence.length,
      amount: totalValue,
      label: `${missingEvidence.length} payment${missingEvidence.length === 1 ? "" : "s"} missing evidence`,
      detail: `${missingEvidence.length} settled payment${missingEvidence.length === 1 ? " is" : "s are"} missing bank evidence — ${formatCompact(totalValue)} USD unproved.`,
      ts: now,
    });
  }

  /* 6) Failed movement. */
  const failed = payments.filter((p) => p.movement_status === "failed");
  if (failed.length >= 1) {
    const totalValue = failed.reduce((s, p) => s + paymentValue(p), 0);
    out.push({
      key: stableId(["payment-failed"]),
      source: "payment",
      kind: "failed_payment",
      severity: failed.length >= 3 ? "risk" : "watch",
      magnitude: failed.length,
      amount: totalValue,
      label: `${failed.length} failed payment${failed.length === 1 ? "" : "s"}`,
      detail: `${failed.length} payment${failed.length === 1 ? " has" : "s have"} failed at the bank — ${formatCompact(totalValue)} USD blocked.`,
      ts: now,
    });
  }

  /* 7) Duplicate-payment risk — same party + same amount + close dates. */
  const seen = new Map<string, FinancePayment>();
  const duplicates: FinancePayment[] = [];
  for (const p of payments) {
    const value = paymentValue(p);
    if (value < 500) continue; // ignore trivia
    const key = `${p.direction}::${p.party_id ?? p.party_name}::${Math.round(value)}`;
    const prev = seen.get(key);
    if (prev) {
      /* Same party + amount within 7 days? Flag as risk. */
      const d = daysFromToday(p.payment_date);
      const dp = daysFromToday(prev.payment_date);
      if (d != null && dp != null && Math.abs(d - dp) <= 7) {
        duplicates.push(p);
      }
    } else {
      seen.set(key, p);
    }
  }
  if (duplicates.length >= 1) {
    const totalValue = duplicates.reduce((s, p) => s + paymentValue(p), 0);
    out.push({
      key: stableId(["payment-duplicate-risk"]),
      source: "payment",
      kind: "duplicate_payment_risk",
      severity: "watch",
      magnitude: duplicates.length,
      amount: totalValue,
      label: `${duplicates.length} possible duplicate payment${duplicates.length === 1 ? "" : "s"}`,
      detail: `${duplicates.length} payment${duplicates.length === 1 ? " matches" : "s match"} another within 7 days at the same amount and party — ${formatCompact(totalValue)} USD at risk of double-spending.`,
      ts: now,
    });
  }

  return out;
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
  if (abs >= 1_000)     return sign + (abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2) + "K";
  return sign + abs.toFixed(0);
}

/* ---------------------------------------------------------------------------
   Health
   --------------------------------------------------------------------------- */

function scoreFromSummary(args: {
  pendingCount: number;
  pendingValue: number;
  oldestPendingWait: number;
  unreconciledCount: number;
  unreconciledValue: number;
  mismatchCount: number;
  mismatchValue: number;
  missingEvidenceCount: number;
  failedCount: number;
  duplicateCount: number;
}): { score: number; pressure: Pressure } {
  let score = 100;
  if (args.pendingCount >= 20) score -= 14;
  else if (args.pendingCount >= 10) score -= 8;
  else if (args.pendingCount >= 5)  score -= 4;
  if (args.oldestPendingWait >= 14) score -= 12;
  else if (args.oldestPendingWait >= 7) score -= 6;
  if (args.pendingValue >= 100_000) score -= 10;
  else if (args.pendingValue >= 25_000) score -= 5;
  if (args.unreconciledCount >= 5) score -= 14;
  else if (args.unreconciledCount >= 2) score -= 7;
  if (args.unreconciledValue >= 100_000) score -= 8;
  if (args.mismatchCount >= 3) score -= 14;
  else if (args.mismatchCount >= 1) score -= 6;
  if (args.mismatchValue >= 5_000) score -= 6;
  if (args.missingEvidenceCount >= 5) score -= 10;
  else if (args.missingEvidenceCount >= 2) score -= 4;
  if (args.failedCount >= 1) score -= 8 * Math.min(3, args.failedCount);
  if (args.duplicateCount >= 1) score -= 6 * Math.min(2, args.duplicateCount);
  score = clamp01(score);
  const pressure: Pressure =
    score < 40 ? "critical"
    : score < 60 ? "risk"
    : score < 80 ? "watch"
    : "calm";
  return { score: Math.round(score), pressure };
}

/* ---------------------------------------------------------------------------
   Public API
   --------------------------------------------------------------------------- */

export function buildPaymentControlSnapshot(
  payments: FinancePayment[],
): PaymentControlSnapshot {
  /* ── Pending approval ──────────────────────────────────────── */
  const pendingApproval = payments.filter((p) =>
    PENDING_APPROVAL.has((p.approval_status ?? "draft") as ApprovalStatus));
  const pendingTotalValue = pendingApproval.reduce((s, p) => s + paymentValue(p), 0);
  const pendingLargest = pendingApproval.reduce((m, p) => Math.max(m, paymentValue(p)), 0);
  const oldestPendingWait = pendingApproval.reduce((m, p) => Math.max(m, waitingDays(p)), 0);

  /* ── Reconciliation ───────────────────────────────────────── */
  const unreconciled = payments.filter((p) => {
    const rec = p.reconciliation_status ?? "unreconciled";
    const movement = (p.movement_status ?? null) as string | null;
    const movementTerminal = movement != null && TERMINAL_MOVEMENT.has(movement);
    const legacyTerminal = movement == null && p.status === "completed";
    return rec === "unreconciled" && (movementTerminal || legacyTerminal)
      && daysSincePayment(p) >= UNRECONCILED_GRACE_DAYS;
  });
  const mismatches = payments.filter((p) => (p.reconciliation_status ?? "unreconciled") === "mismatch");
  const disputed   = payments.filter((p) => (p.reconciliation_status ?? "unreconciled") === "disputed");
  const unreconciledValue = unreconciled.reduce((s, p) => s + paymentValue(p), 0);
  const mismatchValue = mismatches.reduce((s, p) => {
    if (p.actual_amount != null && p.expected_amount != null) {
      return s + Math.abs((p.actual_amount as number) - (p.expected_amount as number));
    }
    return s;
  }, 0);

  /* ── Evidence ────────────────────────────────────────────── */
  const missingEvidence = payments.filter((p) => {
    const movement = (p.movement_status ?? null) as string | null;
    const movementTerminal = movement != null && TERMINAL_MOVEMENT.has(movement);
    const legacyTerminal = movement == null && p.status === "completed";
    if (!movementTerminal && !legacyTerminal) return false;
    if (p.has_payment_evidence) return false;
    return daysSincePayment(p) >= UNRECONCILED_GRACE_DAYS;
  });
  const missingEvidenceValue = missingEvidence.reduce((s, p) => s + paymentValue(p), 0);

  /* ── Failed ──────────────────────────────────────────────── */
  const failedCount = payments.filter((p) => p.movement_status === "failed").length;

  /* ── Duplicate-risk count (recompute via the same pass as the
        event synthesiser, but only for the counter). */
  let duplicateCount = 0;
  {
    const seen = new Map<string, FinancePayment>();
    for (const p of payments) {
      const value = paymentValue(p);
      if (value < 500) continue;
      const key = `${p.direction}::${p.party_id ?? p.party_name}::${Math.round(value)}`;
      const prev = seen.get(key);
      if (prev) {
        const d = daysFromToday(p.payment_date);
        const dp = daysFromToday(prev.payment_date);
        if (d != null && dp != null && Math.abs(d - dp) <= 7) duplicateCount += 1;
      } else {
        seen.set(key, p);
      }
    }
  }

  /* ── Health ──────────────────────────────────────────────── */
  const { score, pressure } = scoreFromSummary({
    pendingCount: pendingApproval.length,
    pendingValue: pendingTotalValue,
    oldestPendingWait,
    unreconciledCount: unreconciled.length,
    unreconciledValue,
    mismatchCount: mismatches.length,
    mismatchValue,
    missingEvidenceCount: missingEvidence.length,
    failedCount,
    duplicateCount,
  });

  /* ── Events ──────────────────────────────────────────────── */
  const events = buildEvents(payments);

  /* ── Read narrative ──────────────────────────────────────── */
  const read = (() => {
    const bits: string[] = [];
    if (pendingApproval.length > 0) {
      bits.push(`${pendingApproval.length} pending approval (${formatCompact(pendingTotalValue)} USD).`);
    }
    if (unreconciled.length > 0) {
      bits.push(`${unreconciled.length} unreconciled (${formatCompact(unreconciledValue)} USD).`);
    }
    if (mismatches.length > 0) {
      bits.push(`${mismatches.length} mismatch${mismatches.length === 1 ? "" : "es"} totalling ${formatCompact(mismatchValue)} USD.`);
    }
    if (missingEvidence.length >= 2) {
      bits.push(`${missingEvidence.length} settled payments missing evidence.`);
    }
    if (failedCount > 0) {
      bits.push(`${failedCount} failed at the bank.`);
    }
    return bits.join(" ");
  })();

  return {
    events,
    pendingApproval: {
      count: pendingApproval.length,
      totalValue: Math.round(pendingTotalValue),
      largestValue: Math.round(pendingLargest),
      oldestDays: Math.round(oldestPendingWait),
    },
    reconciliation: {
      unreconciledCount: unreconciled.length,
      unreconciledValue: Math.round(unreconciledValue),
      mismatchCount: mismatches.length,
      mismatchValue: Math.round(mismatchValue),
      disputedCount: disputed.length,
    },
    evidence: {
      missingCount: missingEvidence.length,
      missingValue: Math.round(missingEvidenceValue),
    },
    failedCount,
    healthScore: score,
    pressure,
    read,
  };
}
