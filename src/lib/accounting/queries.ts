import "server-only";

/* ===========================================================================
   Phase A.1 — Accounting query layer.

   Pure read functions powering trial balance, general ledger, and the
   balance-sheet foundation. All three:
     · run against POSTED journal lines only (status = 'posted')
     · respect a tenant_id filter on every query
     · accept an optional period window (from, to)
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  AccountingAccount,
  BalanceSheetSummary,
  GeneralLedger,
  GeneralLedgerRow,
  TrialBalance,
  TrialBalanceRow,
} from "./types";

interface AggRow {
  account_id: string;
  debit_total: number;
  credit_total: number;
}

interface PeriodOpts {
  from?: string;
  to?: string;
}

/* ─── Aggregate posted lines per account ────────────────────────── */

async function aggregateByAccount(tenantId: string, period: PeriodOpts): Promise<AggRow[]> {
  /* The query is "join journal_entries to journal_lines and group by
     account_id" — Postgres handles this in a single statement. We
     express it with a left join + filtered aggregation through the
     Supabase client by pulling the slim line projection joined to
     entries and rolling up in JS. For the sandbox-sized data we
     ship (mid-hundreds of entries) this is well under 100 ms. A
     materialised view + SQL function would be the production fix
     once volume grows. */
  let q = supabaseServer
    .from("accounting_journal_lines")
    .select("account_id, debit, credit, accounting_journal_entries!inner(entry_date, status, tenant_id)")
    .eq("tenant_id", tenantId)
    .eq("accounting_journal_entries.tenant_id", tenantId)
    .eq("accounting_journal_entries.status", "posted");
  if (period.from) q = q.gte("accounting_journal_entries.entry_date", period.from);
  if (period.to)   q = q.lte("accounting_journal_entries.entry_date", period.to);
  const { data } = await q;
  const out = new Map<string, AggRow>();
  for (const row of (data ?? []) as Array<{ account_id: string; debit: number | string; credit: number | string }>) {
    const id = row.account_id;
    const cur = out.get(id) ?? { account_id: id, debit_total: 0, credit_total: 0 };
    cur.debit_total  += Number(row.debit)  || 0;
    cur.credit_total += Number(row.credit) || 0;
    out.set(id, cur);
  }
  return Array.from(out.values());
}

/* ─── Trial balance ─────────────────────────────────────────────── */

export async function buildTrialBalance(tenantId: string, period: PeriodOpts = {}): Promise<TrialBalance> {
  const [accountsRes, aggs] = await Promise.all([
    supabaseServer
      .from("accounting_accounts")
      .select("id, code, name, type, normal_balance, is_active")
      .eq("tenant_id", tenantId)
      .order("code", { ascending: true }),
    aggregateByAccount(tenantId, period),
  ]);
  const accounts = (accountsRes.data ?? []) as Array<Pick<AccountingAccount, "id" | "code" | "name" | "type" | "normal_balance" | "is_active">>;
  const aggById = new Map(aggs.map((a) => [a.account_id, a]));

  const rows: TrialBalanceRow[] = accounts.map((a) => {
    const agg = aggById.get(a.id) ?? { debit_total: 0, credit_total: 0 };
    /* Signed balance: assets/expenses positive on Dr side, the rest
       positive on Cr side. */
    const balance = a.normal_balance === "debit"
      ? agg.debit_total - agg.credit_total
      : agg.credit_total - agg.debit_total;
    return {
      account_id:     a.id,
      code:           a.code,
      name:           a.name,
      type:           a.type,
      normal_balance: a.normal_balance,
      debit_total:    agg.debit_total,
      credit_total:   agg.credit_total,
      balance,
    };
  });

  const totalDebit  = rows.reduce((s, r) => s + r.debit_total,  0);
  const totalCredit = rows.reduce((s, r) => s + r.credit_total, 0);
  return {
    as_of: period.to ?? new Date().toISOString().slice(0, 10),
    rows,
    totals: { debit: totalDebit, credit: totalCredit, difference: totalDebit - totalCredit },
  };
}

/* ─── General ledger (one account) ──────────────────────────────── */

export async function buildGeneralLedger(
  tenantId: string,
  accountId: string,
  period: PeriodOpts = {},
): Promise<GeneralLedger | null> {
  const { data: acctData } = await supabaseServer
    .from("accounting_accounts")
    .select("id, code, name, type, normal_balance")
    .eq("id", accountId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!acctData) return null;
  const account = acctData as Pick<AccountingAccount, "id" | "code" | "name" | "type" | "normal_balance">;

  const from = period.from ?? "1900-01-01";
  const to   = period.to   ?? "9999-12-31";

  /* Two queries:
       1. lines BEFORE the period → opening balance
       2. lines IN the period      → ledger detail */
  const [beforeRes, inRes] = await Promise.all([
    supabaseServer
      .from("accounting_journal_lines")
      .select("debit, credit, accounting_journal_entries!inner(entry_date, status, tenant_id)")
      .eq("tenant_id", tenantId)
      .eq("account_id", accountId)
      .eq("accounting_journal_entries.tenant_id", tenantId)
      .eq("accounting_journal_entries.status", "posted")
      .lt("accounting_journal_entries.entry_date", from),
    supabaseServer
      .from("accounting_journal_lines")
      .select("id, debit, credit, description, party_id, party_type, reference, accounting_journal_entries!inner(id, journal_no, entry_date, description, source_type, status, tenant_id)")
      .eq("tenant_id", tenantId)
      .eq("account_id", accountId)
      .eq("accounting_journal_entries.tenant_id", tenantId)
      .eq("accounting_journal_entries.status", "posted")
      .gte("accounting_journal_entries.entry_date", from)
      .lte("accounting_journal_entries.entry_date", to)
      .order("entry_date", { foreignTable: "accounting_journal_entries", ascending: true }),
  ]);

  /* Opening balance — sign by the account's normal direction. */
  let openingBalance = 0;
  for (const row of (beforeRes.data ?? []) as Array<{ debit: number | string; credit: number | string }>) {
    const d = Number(row.debit)  || 0;
    const c = Number(row.credit) || 0;
    openingBalance += account.normal_balance === "debit" ? d - c : c - d;
  }

  let running = openingBalance;
  /* Supabase types the embedded relation as an array even on a 1:1
     parent FK, so we widen via `unknown` and then assert the runtime
     shape we know the join produces. */
  const rows: GeneralLedgerRow[] = ((inRes.data ?? []) as unknown as Array<{
    id: string; debit: number | string; credit: number | string; description: string | null;
    party_id: string | null; party_type: "customer" | "supplier" | null; reference: string | null;
    accounting_journal_entries: { id: string; journal_no: string; entry_date: string; description: string | null; source_type: string; status: string };
  }>).map((row) => {
    const d = Number(row.debit) || 0;
    const c = Number(row.credit) || 0;
    running += account.normal_balance === "debit" ? d - c : c - d;
    return {
      entry_id:       row.accounting_journal_entries.id,
      journal_no:     row.accounting_journal_entries.journal_no,
      entry_date:     row.accounting_journal_entries.entry_date,
      description:    row.description ?? row.accounting_journal_entries.description,
      debit:          d,
      credit:         c,
      running_balance: running,
      reference:      row.reference,
      party_id:       row.party_id,
      party_type:     row.party_type,
      source_type:    row.accounting_journal_entries.source_type as GeneralLedgerRow["source_type"],
      status:         row.accounting_journal_entries.status as GeneralLedgerRow["status"],
    };
  });

  return {
    account,
    opening_balance: openingBalance,
    rows,
    closing_balance: running,
    period: {
      from: period.from ?? "1900-01-01",
      to:   period.to   ?? "9999-12-31",
    },
  };
}

/* ─── Balance-sheet summary ─────────────────────────────────────── */

export async function buildBalanceSheetSummary(tenantId: string, asOf?: string): Promise<BalanceSheetSummary> {
  const tb = await buildTrialBalance(tenantId, { to: asOf });
  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  let revenue = 0;
  let expense = 0;
  for (const r of tb.rows) {
    if (r.type === "asset" || r.type === "contra_asset") {
      assets += r.balance;
    } else if (r.type === "liability" || r.type === "contra_liability") {
      liabilities += r.balance;
    } else if (r.type === "equity" || r.type === "contra_equity") {
      equity += r.balance;
    } else if (r.type === "revenue" || r.type === "contra_revenue") {
      revenue += r.balance;
    } else if (r.type === "expense" || r.type === "contra_expense") {
      expense += r.balance;
    }
  }
  const currentYearEarnings = revenue - expense;
  /* Accounting identity: Assets = Liabilities + Equity + current-year earnings.
     Any drift is the balanced_difference — clean ledgers post zero. */
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
