/* ===========================================================================
   Phase 2.6 — Bank-Statement Duplicate Detection
   ----------------------------------------------------------------------------
   Pure function that compares a freshly-parsed statement row against
   the existing finance_cash_movements pool. The output is one
   duplicate_status per row:

     · new                — nothing close
     · possible_duplicate — same account + amount + direction within 5 d,
                            reference / description partially overlaps
     · duplicate          — same account + same amount + same direction
                            + same date OR matching bank reference

   The detector deliberately runs BEFORE auto-reconciliation. A movement
   only enters the reconciliation queue once it lands in
   finance_cash_movements. Skipping duplicates at import time means the
   queue stays honest.
   ========================================================================== */

import type { CashMovement } from "@/lib/finance/types";
import type { ParsedStatementRow } from "@/lib/finance/bank-statement-parser";
import type { BankStatementRowDuplicateStatus } from "@/lib/finance/types";

const REF_NORMALIZE = /[^a-z0-9]/gi;

function normaliseRef(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(REF_NORMALIZE, "");
}

function tokens(s: string | null | undefined): Set<string> {
  if (!s) return new Set();
  return new Set(s.toLowerCase().split(/\s+/).filter((t) => t.length >= 3));
}

function tokenOverlap(a: string | null | undefined, b: string | null | undefined): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n += 1;
  return n / Math.max(A.size, B.size);
}

function daysApart(aIso: string | null, bIso: string | null): number {
  if (!aIso || !bIso) return Number.POSITIVE_INFINITY;
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.abs((a - b) / 86_400_000);
}

export interface DuplicateClassificationInput {
  parsedRow: ParsedStatementRow;
  bankAccountId: string;
  /** Existing cash movements for the same bank account, scoped to a
   *  recent window by the caller. The detector won't re-window for
   *  perf; callers should pass at most ~500 rows. */
  existingMovements: CashMovement[];
  /** Other rows in the same import — used to flag intra-import dups. */
  siblingRows?: ParsedStatementRow[];
}

export interface DuplicateClassification {
  status: BankStatementRowDuplicateStatus;
  matchedMovementId: string | null;
  reasons: string[];
}

export function classifyDuplicate(input: DuplicateClassificationInput): DuplicateClassification {
  const { parsedRow, bankAccountId, existingMovements, siblingRows = [] } = input;
  if (parsedRow.amount == null || !parsedRow.direction) {
    return { status: "new", matchedMovementId: null, reasons: [] };
  }

  /* Loop over existing movements first — they're the authoritative
     "this already happened" pool. */
  let strongest: { status: BankStatementRowDuplicateStatus; movementId: string | null; reasons: string[] } = {
    status: "new",
    movementId: null,
    reasons: [],
  };

  for (const m of existingMovements) {
    if (m.bank_account_id !== bankAccountId) continue;
    if (m.direction !== parsedRow.direction) continue;
    if (parsedRow.currency && m.currency && parsedRow.currency !== m.currency) continue;

    const amountDiff = Math.abs(Number(m.amount) - Number(parsedRow.amount));
    if (amountDiff / Math.max(Number(m.amount), Number(parsedRow.amount)) > 0.01) continue;

    const refMatch =
      normaliseRef(m.bank_reference) &&
      normaliseRef(parsedRow.reference) &&
      normaliseRef(m.bank_reference) === normaliseRef(parsedRow.reference);

    const dDays = daysApart(parsedRow.movement_date, m.movement_date);

    /* Hard duplicate — same date OR matching reference. */
    if (dDays === 0 || refMatch) {
      strongest = {
        status: "duplicate",
        movementId: m.id,
        reasons: [
          "same amount",
          "same direction",
          dDays === 0 ? "same date" : `${Math.round(dDays)}d apart`,
          refMatch ? "reference match" : "no reference",
        ],
      };
      break;
    }

    /* Possible — within 5 days, partial description overlap. */
    if (dDays <= 5) {
      const overlap = tokenOverlap(
        m.counterparty_name ?? m.bank_reference ?? "",
        parsedRow.counterparty_name ?? parsedRow.description ?? "",
      );
      if (strongest.status !== "duplicate") {
        strongest = {
          status: "possible_duplicate",
          movementId: m.id,
          reasons: [
            "same amount",
            "same direction",
            `${Math.round(dDays)}d apart`,
            overlap > 0 ? `description overlap ${(overlap * 100).toFixed(0)}%` : "no description overlap",
          ],
        };
      }
    }
  }

  /* If still not a hard duplicate against existing movements, look at
     intra-import siblings (two CSV rows that are the same line). */
  if (strongest.status !== "duplicate") {
    for (const sib of siblingRows) {
      if (sib.row_index === parsedRow.row_index) continue;
      if (sib.direction !== parsedRow.direction) continue;
      if (sib.amount == null || parsedRow.amount == null) continue;
      const amountDiff = Math.abs(sib.amount - parsedRow.amount);
      if (amountDiff > 0.01) continue;
      if (sib.movement_date !== parsedRow.movement_date) continue;
      if (normaliseRef(sib.reference) !== normaliseRef(parsedRow.reference)) continue;
      strongest = {
        status: "duplicate",
        movementId: null,
        reasons: ["intra-import duplicate row"],
      };
      break;
    }
  }

  return {
    status: strongest.status,
    matchedMovementId: strongest.movementId,
    reasons: strongest.reasons,
  };
}
