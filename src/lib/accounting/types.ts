/* ===========================================================================
   Phase A.1 — Accounting Core types

   Shared TypeScript shapes for the chart of accounts + journal layer.
   The accounting layer SITS ABOVE the operational finance layer:
     · operational tables (finance_payments, finance_expenses,
       finance_cash_movements) record what happened in the business
     · the accounting layer POSTS those events as balanced
       double-entry journal lines against the chart of accounts

   Posting is semi-automatic — operator-driven calls to the posting
   engine (src/lib/accounting/posting.ts) translate one source row
   into one balanced journal entry. Legacy rows are NOT auto-posted
   at migration time; the operator decides when each event hits the
   ledger.
   ========================================================================== */

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense"
  | "contra_asset"
  | "contra_liability"
  | "contra_equity"
  | "contra_revenue"
  | "contra_expense";

export type NormalBalance = "debit" | "credit";

export interface AccountingAccount {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string | null;
  normal_balance: NormalBalance;
  parent_id: string | null;
  is_active: boolean;
  system_account: boolean;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type JournalSourceType =
  | "payment"
  | "expense"
  | "cash_movement"
  | "opening_balance"
  | "manual"
  | "void";

export type JournalStatus = "draft" | "posted" | "voided";

export interface JournalEntry {
  id: string;
  tenant_id: string;
  journal_no: string;
  entry_date: string;              // YYYY-MM-DD
  source_type: JournalSourceType;
  source_id: string | null;
  status: JournalStatus;
  description: string | null;
  posted_by: string | null;
  posted_at: string | null;
  voided_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  reverses_entry_id: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Optional joined lines for the GL viewer. */
  lines?: JournalLine[];
}

export interface JournalLine {
  id: string;
  tenant_id: string;
  entry_id: string;
  line_index: number;
  account_id: string;
  debit: number;
  credit: number;
  currency: string;
  exchange_rate: number;
  description: string | null;
  party_id: string | null;
  party_type: "customer" | "supplier" | null;
  reference: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  /** Optional joined account row for ledger views. */
  account?: Pick<AccountingAccount, "id" | "code" | "name" | "type" | "normal_balance">;
}

/* ── Trial balance + GL view shapes ─────────────────────────────── */

export interface TrialBalanceRow {
  account_id: string;
  code: string;
  name: string;
  type: AccountType;
  normal_balance: NormalBalance;
  debit_total: number;
  credit_total: number;
  /** Signed balance in the account's normal direction:
      assets/expenses positive on debit, liabilities/equity/revenue
      positive on credit. */
  balance: number;
}

export interface TrialBalance {
  as_of: string;                   // ISO date
  rows: TrialBalanceRow[];
  totals: { debit: number; credit: number; difference: number };
}

export interface GeneralLedgerRow {
  entry_id: string;
  journal_no: string;
  entry_date: string;
  description: string | null;
  debit: number;
  credit: number;
  running_balance: number;
  reference: string | null;
  party_id: string | null;
  party_type: "customer" | "supplier" | null;
  source_type: JournalSourceType;
  status: JournalStatus;
}

export interface GeneralLedger {
  account: Pick<AccountingAccount, "id" | "code" | "name" | "type" | "normal_balance">;
  opening_balance: number;
  rows: GeneralLedgerRow[];
  closing_balance: number;
  period: { from: string; to: string };
}

export interface BalanceSheetSummary {
  as_of: string;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  /** Sum of revenue − expenses across the year-to-date (current year
   *  earnings — folds into equity for the basic accounting equation). */
  current_year_earnings: number;
  /** total_assets − (total_liabilities + total_equity + current_year_earnings).
   *  Must be near zero for a balanced ledger. */
  balanced_difference: number;
}

/* ── Posting engine input shapes ────────────────────────────────── */

export interface PostingContext {
  tenantId: string;
  postedByAccountId: string | null;
}

export interface PostingResult {
  ok: true;
  entry_id: string;
  journal_no: string;
  status: JournalStatus;
}

export interface PostingError {
  ok: false;
  error: string;
  code?: number;
  details?: unknown;
}

export type PostingOutcome = PostingResult | PostingError;
