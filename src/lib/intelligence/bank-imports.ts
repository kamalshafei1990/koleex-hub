/* ===========================================================================
   Bank-Import Intelligence — Phase 2.6
   ----------------------------------------------------------------------------
   Reads the imports table + the most-recently-created cash movements
   from each import and produces operational events. Pure function;
   the API caller supplies the data.

   Discipline:
     · A failed import is always material — operator must hear about it.
     · "Duplicate statement rows" only fires when a single import
       produced ≥3 duplicates AND ≥30% of its rows.
     · "Large unreconciled import" requires ≥10 unreconciled movements
       from a confirmed import within the last 7 days.
     · "Bank statement import gap" only fires when the account is
       actively used (movements exist) AND last import is ≥21 days old.
   ========================================================================== */

import type {
  BankAccount,
  BankStatementImport,
  CashMovement,
} from "@/lib/finance/types";
import type { OperationalEvent, Severity } from "./types";
import { stableId } from "./behavior";

const NOW = () => Date.now();

export interface BankImportIntelligenceInput {
  imports: BankStatementImport[];
  /** Cash movements created by recent imports (used for "large unreconciled"). */
  recentImportMovements: CashMovement[];
  accounts: BankAccount[];
}

export interface BankImportSnapshot {
  events: OperationalEvent[];
  /** Most-recent imports per account, sorted newest first. */
  recentImports: BankStatementImport[];
  failedImportCount: number;
  duplicateHeavyImportCount: number;
  largeUnreconciledImportCount: number;
  importGapAccounts: number;
  daysSinceLastImport: number | null;
}

function daysAgo(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (NOW() - t) / 86_400_000);
}

export function buildBankImportSnapshot(
  input: BankImportIntelligenceInput,
): BankImportSnapshot {
  const imports = input.imports ?? [];
  const movements = input.recentImportMovements ?? [];
  const accounts = input.accounts ?? [];

  if (imports.length === 0 && accounts.length === 0) {
    return {
      events: [],
      recentImports: [],
      failedImportCount: 0,
      duplicateHeavyImportCount: 0,
      largeUnreconciledImportCount: 0,
      importGapAccounts: 0,
      daysSinceLastImport: null,
    };
  }

  /* Sort newest first. */
  const sorted = [...imports].sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
  );

  /* Failures within the last 30 days. */
  const failureCutoff = Date.now() - 30 * 86_400_000;
  const failed = sorted.filter(
    (i) => i.status === "failed" && new Date(i.uploaded_at).getTime() >= failureCutoff,
  );

  /* Duplicate-heavy imports: ≥3 duplicates AND ≥30% of rows. */
  const dupHeavy = sorted.filter(
    (i) =>
      i.duplicate_count >= 3 &&
      i.row_count > 0 &&
      i.duplicate_count / i.row_count >= 0.3,
  );

  /* Large unreconciled import: a confirmed import within the last 7
     days whose movements still have reconciliation_status='unreconciled'
     and the count is ≥10. */
  let largeUnreconciled = 0;
  const recentConfirmed = sorted.filter((i) => {
    if (i.status !== "confirmed" || !i.confirmed_at) return false;
    return daysAgo(i.confirmed_at) <= 7;
  });
  for (const imp of recentConfirmed) {
    const importMovements = movements.filter(
      (m) =>
        m.bank_account_id === imp.bank_account_id &&
        (m.metadata as Record<string, unknown> | null)?.["bank_import_id"] === imp.id,
    );
    const unreconciled = importMovements.filter((m) => m.reconciliation_status === "unreconciled");
    if (unreconciled.length >= 10) largeUnreconciled += 1;
  }

  /* Import gap — accounts that have movements but no import in the
     last 21 days. */
  const lastImportPerAccount = new Map<string, number>();
  for (const i of sorted) {
    const t = new Date(i.uploaded_at).getTime();
    const prior = lastImportPerAccount.get(i.bank_account_id) ?? 0;
    if (t > prior) lastImportPerAccount.set(i.bank_account_id, t);
  }
  let importGapAccounts = 0;
  for (const a of accounts) {
    /* Only flag accounts that are clearly in use — proxy: any movement
       in the recent window OR a previous import within the year. */
    const hasMovement = movements.some((m) => m.bank_account_id === a.id);
    const hasEverImported = lastImportPerAccount.has(a.id);
    if (!hasMovement && !hasEverImported) continue;
    const lastImportMs = lastImportPerAccount.get(a.id);
    if (!lastImportMs) {
      importGapAccounts += 1;
      continue;
    }
    const days = (NOW() - lastImportMs) / 86_400_000;
    if (days >= 21) importGapAccounts += 1;
  }

  const lastImportIso = sorted[0]?.uploaded_at ?? null;
  const daysSinceLastImport = lastImportIso ? Math.floor(daysAgo(lastImportIso)) : null;

  const events: OperationalEvent[] = [];
  const now = NOW();

  /* bank_import_failed — high-priority operator alert. */
  if (failed.length > 0) {
    const severity: Severity = failed.length >= 3 ? "risk" : "watch";
    events.push({
      key: stableId(["bank-import-failed"]),
      source: "treasury",
      kind: "bank_import_failed",
      severity,
      magnitude: failed.length,
      label: `${failed.length} bank import${failed.length === 1 ? "" : "s"} failed`,
      detail: `${failed.length} bank statement import${failed.length === 1 ? "" : "s"} failed to parse in the last 30 days — review the file format or column mapping.`,
      ts: now,
    });
  }

  /* duplicate_statement_rows — non-critical but worth investigating. */
  if (dupHeavy.length > 0) {
    const severity: Severity = dupHeavy.length >= 3 ? "watch" : "watch";
    events.push({
      key: stableId(["bank-import-duplicates"]),
      source: "treasury",
      kind: "duplicate_statement_rows",
      severity,
      magnitude: dupHeavy.length,
      label: `${dupHeavy.length} duplicate-heavy import${dupHeavy.length === 1 ? "" : "s"}`,
      detail: `${dupHeavy.length} recent import${dupHeavy.length === 1 ? "" : "s"} produced 30%+ duplicate rows — the file may have been re-uploaded or overlaps a prior period.`,
      ts: now,
    });
  }

  /* large_unreconciled_import — bank import landed but reconciliation
     hasn't caught up. */
  if (largeUnreconciled > 0) {
    const severity: Severity = largeUnreconciled >= 2 ? "risk" : "watch";
    events.push({
      key: stableId(["bank-import-large-unreconciled"]),
      source: "treasury",
      kind: "large_unreconciled_import",
      severity,
      magnitude: largeUnreconciled,
      label: `Recent import with 10+ unreconciled movements`,
      detail: `${largeUnreconciled} recent bank import${largeUnreconciled === 1 ? "" : "s"} produced ≥10 unreconciled cash movements — open the reconciliation queue to clear them.`,
      ts: now,
    });
  }

  /* bank_statement_import_gap — no recent import on an active account. */
  if (importGapAccounts > 0) {
    const severity: Severity = importGapAccounts >= 2 ? "watch" : "watch";
    events.push({
      key: stableId(["bank-import-gap"]),
      source: "treasury",
      kind: "bank_statement_import_gap",
      severity,
      magnitude: importGapAccounts,
      label: `${importGapAccounts} account${importGapAccounts === 1 ? "" : "s"} without recent import`,
      detail: `${importGapAccounts} bank account${importGapAccounts === 1 ? " has" : "s have"} not received a statement import in the last 21 days — cash position may drift from bank reality.`,
      ts: now,
    });
  }

  return {
    events,
    recentImports: sorted.slice(0, 10),
    failedImportCount: failed.length,
    duplicateHeavyImportCount: dupHeavy.length,
    largeUnreconciledImportCount: largeUnreconciled,
    importGapAccounts,
    daysSinceLastImport,
  };
}
