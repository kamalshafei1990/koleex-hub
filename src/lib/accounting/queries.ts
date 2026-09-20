import "server-only";

/* ===========================================================================
   Ledger reads — trial balance, general ledger, balance-sheet summary.

   Every number comes from the SQL functions in the accounting migration:
     · fn_accounting_account_balances — per-account totals in the tenant
       BASE currency (amount × exchange_rate), over effective entries
       (posted + voided originals, which net against their reversal)
     · fn_accounting_gl_page          — one account's lines, paged

   Aggregating in SQL removed two silent faults: mixed currencies added as
   if equal, and PostgREST's 1000-row cap truncating the lines a statement
   was built from once the ledger grew.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  AccountingAccount,
  TrialBalance,
  TrialBalanceRow,
  GeneralLedger,
  GeneralLedgerRow,
  BalanceSheetSummary,
} from "./types";

export interface PeriodOpts {
  from?: string;
  to?: string;
}

export interface AccountBalance {
  account_id: string;
  debit_total: number;
  credit_total: number;
}

/** Base-currency debit/credit totals per account over [from, to]. */
export async function accountBalances(tenantId: string, period: PeriodOpts = {}): Promise<AccountBalance[]> {
  const { data, error } = await supabaseServer.rpc("fn_accounting_account_balances", {
    p_tenant_id: tenantId,
    p_from: period.from ?? null,
    p_to: period.to ?? null,
  });
  if (error) throw new Error(`fn_accounting_account_balances: ${error.message}`);
  return ((data ?? []) as Array<{ account_id: string; debit_total: number | string; credit_total: number | string }>).map((r) => ({
    account_id: r.account_id,
    debit_total: Number(r.debit_total) || 0,
    credit_total: Number(r.credit_total) || 0,
  }));
}

/** Signed balance in the account's normal direction. */
export function signedBalance(normal: "debit" | "credit", debit: number, credit: number): number {
  return normal === "debit" ? debit - credit : credit - debit;
}

/* ─── Trial balance ─────────────────────────────────────────────── */

export async function buildTrialBalance(tenantId: string, period: PeriodOpts = {}): Promise<TrialBalance> {
  const [accountsRes, aggs] = await Promise.all([
    supabaseServer
      .from("accounting_accounts")
      .select("id, code, name, type, normal_balance, is_active")
      .eq("tenant_id", tenantId)
      .order("code", { ascending: true }),
    accountBalances(tenantId, period),
  ]);
  const accounts = (accountsRes.data ?? []) as Array<Pick<AccountingAccount, "id" | "code" | "name" | "type" | "normal_balance" | "is_active">>;
  const aggById = new Map(aggs.map((a) => [a.account_id, a]));

  const rows: TrialBalanceRow[] = accounts.map((a) => {
    const agg = aggById.get(a.id) ?? { debit_total: 0, credit_total: 0 };
    return {
      account_id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      normal_balance: a.normal_balance,
      debit_total: agg.debit_total,
      credit_total: agg.credit_total,
      balance: signedBalance(a.normal_balance, agg.debit_total, agg.credit_total),
    };
  });

  const totalDebit = rows.reduce((s, r) => s + r.debit_total, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit_total, 0);
  return {
    as_of: period.to ?? new Date().toISOString().slice(0, 10),
    rows,
    totals: { debit: totalDebit, credit: totalCredit, difference: totalDebit - totalCredit },
  };
}

/* ─── General ledger (one account, paged) ───────────────────────── */

export async function buildGeneralLedger(
  tenantId: string,
  accountId: string,
  period: PeriodOpts = {},
  page: { limit?: number; offset?: number } = {},
): Promise<(GeneralLedger & { total_rows: number; limit: number; offset: number }) | null> {
  const { data: acctData } = await supabaseServer
    .from("accounting_accounts")
    .select("id, code, name, type, normal_balance")
    .eq("id", accountId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!acctData) return null;
  const account = acctData as Pick<AccountingAccount, "id" | "code" | "name" | "type" | "normal_balance">;

  const from = period.from ?? "1900-01-01";
  const to = period.to ?? "9999-12-31";
  const limit = Math.min(Math.max(page.limit ?? 200, 1), 1000);
  const offset = Math.max(page.offset ?? 0, 0);

  /* Opening balance = everything before the window; the page's own
     running balance starts from opening + the rows before this page. */
  const [beforeAgg, pageRes, priorRes] = await Promise.all([
    period.from ? accountBalances(tenantId, { to: shiftDay(from, -1) }) : Promise.resolve([] as AccountBalance[]),
    supabaseServer.rpc("fn_accounting_gl_page", {
      p_tenant_id: tenantId, p_account_id: accountId, p_from: from, p_to: to, p_limit: limit, p_offset: offset,
    }),
    offset > 0
      ? supabaseServer.rpc("fn_accounting_gl_page", {
          p_tenant_id: tenantId, p_account_id: accountId, p_from: from, p_to: to, p_limit: offset, p_offset: 0,
        })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (pageRes.error) throw new Error(`fn_accounting_gl_page: ${pageRes.error.message}`);

  type PageRow = {
    entry_id: string; journal_no: string; entry_date: string; entry_description: string | null; source_type: string; status: string;
    line_description: string | null; debit: number | string; credit: number | string; currency: string; exchange_rate: number | string;
    reference: string | null; party_id: string | null; party_type: "customer" | "supplier" | null; total_count: number | string;
  };
  const before = beforeAgg.find((b) => b.account_id === accountId);
  const openingBalance = before ? signedBalance(account.normal_balance, before.debit_total, before.credit_total) : 0;

  let running = openingBalance;
  for (const r of (priorRes.data ?? []) as PageRow[]) {
    running += signedBalance(account.normal_balance, Number(r.debit) || 0, Number(r.credit) || 0);
  }
  const pageRows = (pageRes.data ?? []) as PageRow[];
  const rows: GeneralLedgerRow[] = pageRows.map((r) => {
    const d = Number(r.debit) || 0;
    const c = Number(r.credit) || 0;
    running += signedBalance(account.normal_balance, d, c);
    return {
      entry_id: r.entry_id,
      journal_no: r.journal_no,
      entry_date: r.entry_date,
      description: r.line_description ?? r.entry_description,
      debit: d,
      credit: c,
      running_balance: running,
      reference: r.reference,
      party_id: r.party_id,
      party_type: r.party_type,
      source_type: r.source_type as GeneralLedgerRow["source_type"],
      status: r.status as GeneralLedgerRow["status"],
      currency: r.currency,
      exchange_rate: Number(r.exchange_rate) || 1,
    };
  });

  /* Closing balance covers the WHOLE window, not just this page. */
  const total_rows = Number(pageRows[0]?.total_count ?? 0);
  let closing = running;
  if (offset + pageRows.length < total_rows) {
    const [windowAgg] = await Promise.all([accountBalances(tenantId, { from, to })]);
    const w = windowAgg.find((b) => b.account_id === accountId);
    closing = openingBalance + (w ? signedBalance(account.normal_balance, w.debit_total, w.credit_total) : 0);
  }

  return {
    account,
    opening_balance: openingBalance,
    rows,
    closing_balance: closing,
    period: { from, to },
    total_rows,
    limit,
    offset,
  };
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ─── Balance-sheet summary ─────────────────────────────────────── */

export async function buildBalanceSheetSummary(tenantId: string, asOf?: string): Promise<BalanceSheetSummary> {
  const tb = await buildTrialBalance(tenantId, { to: asOf });
  let assets = 0, liabilities = 0, equity = 0, revenue = 0, expense = 0;
  for (const r of tb.rows) {
    /* A contra account carries the opposite normal balance, so its signed
       balance is subtracted from its section (accumulated depreciation
       reduces assets, a sales return reduces revenue). */
    switch (r.type) {
      case "asset":            assets += r.balance; break;
      case "contra_asset":     assets -= r.balance; break;
      case "liability":        liabilities += r.balance; break;
      case "contra_liability": liabilities -= r.balance; break;
      case "equity":           equity += r.balance; break;
      case "contra_equity":    equity -= r.balance; break;
      case "revenue":          revenue += r.balance; break;
      case "contra_revenue":   revenue -= r.balance; break;
      case "expense":          expense += r.balance; break;
      case "contra_expense":   expense -= r.balance; break;
    }
  }
  /* Earnings not yet closed to retained earnings. After a period close the
     P&L accounts stand at zero through the close date, so this is exactly
     the post-close result. */
  const currentYearEarnings = revenue - expense;
  const balancedDifference = assets - (liabilities + equity + currentYearEarnings);
  return {
    as_of: tb.as_of,
    total_assets: assets,
    total_liabilities: liabilities,
    total_equity: equity,
    current_year_earnings: currentYearEarnings,
    balanced_difference: balancedDifference,
  };
}
