import "server-only";

/* ===========================================================================
   Financial statements — pure reads over the ledger.

     · buildProfitLoss        revenue → gross → operating → net
     · buildCashFlow          direct method: operating / investing / financing
     · buildEquityStatement   opening → contributions → earnings → closing
     · buildFinancialRatios   liquidity / solvency / margins / runway

   HARD RULES
     · every number comes from the ledger's effective lines (posted, plus
       voided originals that net against their reversal), through the SQL
       aggregates in lib/accounting/queries.ts — in the tenant base currency
     · never read operational tables here
     · cross-statement consistency: TB net = P&L net = equity earnings

   Classification is by account TYPE and SUBTYPE (what fn_accounting_ensure_coa
   seeds), not by hard-coded code lists, so a tenant that adds accounts
   still gets a correct statement.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import { resolveBaseCurrency } from "@/lib/finance/currency";
import { accountBalances, signedBalance } from "./queries";
import type { AccountingAccount } from "./types";

/* ─── Classification ─────────────────────────────────────────── */

/** Direct-cost subtypes: cost of goods, freight and customs. */
const DIRECT_COST_SUBTYPES = new Set(["cogs", "shipping", "customs"]);
/** Assets that are not current: fixed assets and their depreciation. */
const NON_CURRENT_ASSET_SUBTYPES = new Set(["fixed", "accum_dep"]);
/** Liabilities that are financing, not operating. */
const FINANCING_LIABILITY_SUBTYPES = new Set(["loan"]);
/** Cash and cash equivalents. */
const CASH_SUBTYPES = new Set(["cash", "bank"]);

type Acct = Pick<AccountingAccount, "id" | "code" | "name" | "type" | "subtype" | "normal_balance">;

interface AggRow extends Acct {
  debit_total: number;
  credit_total: number;
}

/** Every account of the tenant with its base-currency totals over the
 *  period (zero for accounts the period did not touch, so empty sections
 *  still render). */
async function aggregateLines(tenantId: string, period?: Period): Promise<AggRow[]> {
  const [{ data: accountsRaw }, balances] = await Promise.all([
    supabaseServer
      .from("accounting_accounts")
      .select("id, code, name, type, subtype, normal_balance")
      .eq("tenant_id", tenantId),
    accountBalances(tenantId, period ?? {}),
  ]);
  const byId = new Map(balances.map((b) => [b.account_id, b]));
  return ((accountsRaw ?? []) as Acct[]).map((a) => {
    const b = byId.get(a.id);
    return { ...a, debit_total: b?.debit_total ?? 0, credit_total: b?.credit_total ?? 0 };
  });
}

function balanceFor(row: AggRow): number {
  return signedBalance(row.normal_balance, row.debit_total, row.credit_total);
}

/** A contra account reduces its section. */
function sectionValue(row: AggRow): number {
  return row.type.startsWith("contra_") ? -balanceFor(row) : balanceFor(row);
}

const isRevenue   = (r: Acct) => r.type === "revenue" || r.type === "contra_revenue";
const isExpense   = (r: Acct) => r.type === "expense" || r.type === "contra_expense";
const isAsset     = (r: Acct) => r.type === "asset" || r.type === "contra_asset";
const isLiability = (r: Acct) => r.type === "liability" || r.type === "contra_liability";
const isEquity    = (r: Acct) => r.type === "equity" || r.type === "contra_equity";
const isCash      = (r: Acct) => r.type === "asset" && CASH_SUBTYPES.has(r.subtype ?? "");

/* ─── Period helpers ─────────────────────────────────────────── */

export interface Period {
  from: string;   // YYYY-MM-DD inclusive
  to: string;     // YYYY-MM-DD inclusive
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The same-length period immediately before `period`. */
export function priorPeriod(period: Period): Period {
  const from = new Date(`${period.from}T00:00:00Z`);
  const to = new Date(`${period.to}T00:00:00Z`);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  const prevTo = shiftDay(period.from, -1);
  const prevFrom = shiftDay(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}

/* ─── Profit & Loss ──────────────────────────────────────────── */

export interface PLAccountLine {
  account_id: string;
  code: string;
  name: string;
  amount: number;        // positive value in the section's natural direction
}

export interface PLSection {
  label: string;
  amount: number;
  accounts: PLAccountLine[];
}

export interface ProfitLoss {
  period: Period;
  currency: string;
  revenue:            PLSection;
  cost_of_sales:      PLSection;
  gross_profit:       number;
  gross_margin_pct:   number;
  operating_expenses: PLSection;
  operating_profit:   number;
  operating_margin_pct: number;
  net_profit:         number;
  net_margin_pct:     number;
  /** Optional same-shape comparison period. */
  comparison?: ProfitLoss;
}

interface PLBuildOpts {
  comparePrior?: boolean;
  currency?: string;
}

function section(label: string, rows: AggRow[]): PLSection {
  const accounts = rows
    .map((r) => ({ account_id: r.id, code: r.code, name: r.name, amount: sectionValue(r) }))
    .filter((a) => Math.abs(a.amount) > 0.005)
    .sort((a, b) => a.code.localeCompare(b.code));
  return { label, amount: accounts.reduce((s, a) => s + a.amount, 0), accounts };
}

export async function buildProfitLoss(tenantId: string, period: Period, opts: PLBuildOpts = {}): Promise<ProfitLoss> {
  const [rows, currency] = await Promise.all([
    aggregateLines(tenantId, period),
    opts.currency ? Promise.resolve(opts.currency) : resolveBaseCurrency(tenantId),
  ]);
  const revenue = section("Revenue", rows.filter(isRevenue));
  const expenseRows = rows.filter(isExpense);
  const cost_of_sales = section("Cost of sales", expenseRows.filter((r) => DIRECT_COST_SUBTYPES.has(r.subtype ?? "")));
  const operating_expenses = section("Operating expenses", expenseRows.filter((r) => !DIRECT_COST_SUBTYPES.has(r.subtype ?? "")));

  const gross_profit = revenue.amount - cost_of_sales.amount;
  const operating_profit = gross_profit - operating_expenses.amount;
  const net_profit = operating_profit;
  const pct = (n: number) => (revenue.amount > 0 ? (n / revenue.amount) * 100 : 0);

  const result: ProfitLoss = {
    period, currency,
    revenue, cost_of_sales, gross_profit, gross_margin_pct: pct(gross_profit),
    operating_expenses, operating_profit, operating_margin_pct: pct(operating_profit),
    net_profit, net_margin_pct: pct(net_profit),
  };
  if (opts.comparePrior) result.comparison = await buildProfitLoss(tenantId, priorPeriod(period), { currency });
  return result;
}

/* ─── Cash Flow (direct method) ──────────────────────────────── */

export interface CashFlowLine {
  label: string;
  amount: number;        // signed: positive = inflow, negative = outflow
  detail?: string;
}

export interface CashFlowSection {
  label: string;
  amount: number;
  lines: CashFlowLine[];
}

export interface CashFlowStatement {
  period: Period;
  currency: string;
  opening_cash:   number;
  operating:      CashFlowSection;
  investing:      CashFlowSection;
  financing:      CashFlowSection;
  net_change:     number;
  closing_cash:   number;
  /** True when opening + net = closing cash on the trial balance. */
  reconciled:     boolean;
}

const CASH_FLOW_LABELS: Record<string, (inflow: boolean) => string> = {
  payment:           (i) => (i ? "Customer collections" : "Supplier payments"),
  expense:           () => "Operating disbursements",
  cash_movement:     (i) => (i ? "Unclassified bank inflow" : "Unclassified bank outflow"),
  opening_balance:   () => "Opening / capital movements",
  payroll:           () => "Salaries paid",
  fx_exchange:       () => "Currency exchange",
  void:              () => "Reversals",
  manual:            () => "Manual entries",
};

export async function buildCashFlow(tenantId: string, period: Period): Promise<CashFlowStatement> {
  const [{ data, error }, currency, beforeRows, endRows] = await Promise.all([
    supabaseServer.rpc("fn_accounting_cash_flow_lines", { p_tenant_id: tenantId, p_from: period.from, p_to: period.to }),
    resolveBaseCurrency(tenantId),
    aggregateLines(tenantId, { from: "1900-01-01", to: shiftDay(period.from, -1) }),
    aggregateLines(tenantId, { from: "1900-01-01", to: period.to }),
  ]);
  if (error) throw new Error(`fn_accounting_cash_flow_lines: ${error.message}`);

  type Row = { entry_id: string; entry_date: string; source_type: string; impact: number | string; contra_codes: string[] | null; contra_types: string[] | null };
  const operating = new Map<string, number>();
  const investing = new Map<string, number>();
  const financing = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

  /* The subtype of every contra account decides the section: equity or a
     loan is financing, a fixed asset is investing, everything else operates. */
  const { data: acctsRaw } = await supabaseServer
    .from("accounting_accounts").select("code, subtype").eq("tenant_id", tenantId);
  const subtypeByCode = new Map(((acctsRaw ?? []) as Array<{ code: string; subtype: string | null }>).map((a) => [a.code, a.subtype ?? ""]));

  for (const r of (data ?? []) as Row[]) {
    const impact = Number(r.impact) || 0;
    if (Math.abs(impact) < 0.005) continue;
    const contraTypes = r.contra_types ?? [];
    const contraSubtypes = (r.contra_codes ?? []).map((c) => subtypeByCode.get(c) ?? "");
    /* A transfer between two cash accounts has no contra — it is not a flow. */
    if (contraTypes.length === 0 && r.source_type !== "fx_exchange") continue;
    const isFinancing = r.source_type === "opening_balance" || contraTypes.some((t) => t === "equity" || t === "contra_equity") || contraSubtypes.some((s) => FINANCING_LIABILITY_SUBTYPES.has(s));
    const isInvesting = !isFinancing && contraSubtypes.some((s) => NON_CURRENT_ASSET_SUBTYPES.has(s));
    const label = (CASH_FLOW_LABELS[r.source_type] ?? (() => "Other"))(impact > 0);
    add(isFinancing ? financing : isInvesting ? investing : operating, label, impact);
  }

  const collapse = (label: string, m: Map<string, number>): CashFlowSection => {
    const lines = Array.from(m.entries())
      .map(([l, amount]) => ({ label: l, amount }))
      .filter((x) => Math.abs(x.amount) > 0.005)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    return { label, amount: lines.reduce((s, x) => s + x.amount, 0), lines };
  };
  const opSection = collapse("Operating activities", operating);
  const invSection = collapse("Investing activities", investing);
  const finSection = collapse("Financing activities", financing);

  const cashOf = (rows: AggRow[]) => rows.filter(isCash).reduce((s, r) => s + balanceFor(r), 0);
  const opening_cash = cashOf(beforeRows);
  const net_change = opSection.amount + invSection.amount + finSection.amount;
  const closing_cash = opening_cash + net_change;
  const tbCash = cashOf(endRows);

  return {
    period, currency, opening_cash,
    operating: opSection, investing: invSection, financing: finSection,
    net_change, closing_cash,
    reconciled: Math.abs(closing_cash - tbCash) < 0.01,
  };
}

/* ─── Equity ─────────────────────────────────────────────────── */

export interface EquityMovement {
  label: string;
  amount: number;     // signed: positive increases equity
  detail?: string;
}

export interface EquityStatement {
  period: Period;
  currency: string;
  opening_equity: number;
  contributions:  number;
  current_year_earnings: number;
  closing_equity: number;
  movements:      EquityMovement[];
  /** Retained earnings standing balance at period end. */
  retained_earnings: number;
}

/** Book equity plus the earnings not yet closed to retained earnings. */
function economicEquity(rows: AggRow[]): number {
  const book = rows.filter(isEquity).reduce((s, r) => s + sectionValue(r), 0);
  const revenue = rows.filter(isRevenue).reduce((s, r) => s + sectionValue(r), 0);
  const expense = rows.filter(isExpense).reduce((s, r) => s + sectionValue(r), 0);
  return book + revenue - expense;
}

export async function buildEquityStatement(tenantId: string, period: Period): Promise<EquityStatement> {
  const [beforeRows, periodRows, endRows, currency] = await Promise.all([
    aggregateLines(tenantId, { from: "1900-01-01", to: shiftDay(period.from, -1) }),
    aggregateLines(tenantId, period),
    aggregateLines(tenantId, { from: "1900-01-01", to: period.to }),
    resolveBaseCurrency(tenantId),
  ]);
  const opening_equity = economicEquity(beforeRows);
  const closing_equity = economicEquity(endRows);
  const contributions = periodRows.filter((r) => isEquity(r) && r.subtype === "capital").reduce((s, r) => s + sectionValue(r), 0);
  const revenue = periodRows.filter(isRevenue).reduce((s, r) => s + sectionValue(r), 0);
  const expense = periodRows.filter(isExpense).reduce((s, r) => s + sectionValue(r), 0);
  const current_year_earnings = revenue - expense;
  const retained_earnings = endRows.filter((r) => r.subtype === "retained").reduce((s, r) => s + sectionValue(r), 0);
  const other = closing_equity - opening_equity - contributions - current_year_earnings;

  const movements: EquityMovement[] = [
    { label: "Owner contributions / withdrawals", amount: contributions },
    { label: "Earnings for the period", amount: current_year_earnings },
    { label: "Other equity movements", amount: other },
  ].filter((m) => Math.abs(m.amount) > 0.005);

  return { period, currency, opening_equity, contributions, current_year_earnings, closing_equity, movements, retained_earnings };
}

/* ─── Ratios ─────────────────────────────────────────────────── */

export interface FinancialRatios {
  as_of: string;
  currency: string;
  current_ratio:        number;
  quick_ratio:          number;
  cash_ratio:           number;
  debt_to_equity:       number;
  gross_margin_pct:     number;
  operating_margin_pct: number;
  net_margin_pct:       number;
  /** Months of cash at the current burn (negative net only). */
  runway_months:        number | null;
  receivables_balance:  number;
  payables_balance:     number;
}

export async function buildFinancialRatios(tenantId: string, asOf: string): Promise<FinancialRatios> {
  const ytdPeriod: Period = { from: `${asOf.slice(0, 4)}-01-01`, to: asOf };
  const [snapshot, pl] = await Promise.all([
    aggregateLines(tenantId, { from: "1900-01-01", to: asOf }),
    buildProfitLoss(tenantId, ytdPeriod),
  ]);

  let cash = 0, currentAssets = 0, currentLiabilities = 0, receivables = 0, payables = 0, totalLiabilities = 0;
  for (const r of snapshot) {
    const v = sectionValue(r);
    if (isCash(r)) cash += v;
    if (isAsset(r) && !NON_CURRENT_ASSET_SUBTYPES.has(r.subtype ?? "")) currentAssets += v;
    if (isLiability(r) && !FINANCING_LIABILITY_SUBTYPES.has(r.subtype ?? "")) currentLiabilities += v;
    if (isLiability(r)) totalLiabilities += v;
    if (r.subtype === "receivable") receivables += v;
    if (r.subtype === "payable" || r.subtype === "grni") payables += v;
  }
  const totalEquity = economicEquity(snapshot);
  const monthsInYtd = Math.max(1, Math.round(daysBetween(ytdPeriod.from, ytdPeriod.to) / 30));
  const burnPerMonth = pl.net_profit < 0 ? Math.abs(pl.net_profit) / monthsInYtd : 0;

  return {
    as_of: asOf,
    currency: pl.currency,
    current_ratio:        currentLiabilities > 0 ? currentAssets / currentLiabilities : 0,
    quick_ratio:          currentLiabilities > 0 ? (cash + receivables) / currentLiabilities : 0,
    cash_ratio:           currentLiabilities > 0 ? cash / currentLiabilities : 0,
    debt_to_equity:       totalEquity > 0 ? totalLiabilities / totalEquity : 0,
    gross_margin_pct:     pl.gross_margin_pct,
    operating_margin_pct: pl.operating_margin_pct,
    net_margin_pct:       pl.net_margin_pct,
    runway_months:        burnPerMonth > 0 ? cash / burnPerMonth : null,
    receivables_balance:  receivables,
    payables_balance:     payables,
  };
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(1, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000) + 1);
}

/* ─── Balance sheet (per account, for the visual statements) ─── */

export interface BalanceLine { code: string; name: string; amount: number }
export interface BalanceSection { label: string; amount: number; accounts: BalanceLine[] }
export interface BalanceSheet {
  as_of: string;
  currency: string;
  assets: BalanceSection;
  liabilities: BalanceSection;
  equity: BalanceSection;
  total_assets: number;
  total_liab_eq: number;
  reconciled: boolean;
}

export async function buildBalanceSheet(tenantId: string, asOf: string, currency?: string): Promise<BalanceSheet> {
  const [rows, ccy] = await Promise.all([
    aggregateLines(tenantId, { from: "1900-01-01", to: asOf }),
    currency ? Promise.resolve(currency) : resolveBaseCurrency(tenantId),
  ]);
  const build = (label: string, group: AggRow[]): BalanceSection => {
    const accounts = group
      .map((a) => ({ code: a.code, name: a.name, amount: sectionValue(a) }))
      .filter((x) => Math.abs(x.amount) > 0.005)
      .sort((a, b) => a.code.localeCompare(b.code));
    return { label, amount: accounts.reduce((s, l) => s + l.amount, 0), accounts };
  };
  const assets = build("Assets", rows.filter(isAsset));
  const liabilities = build("Liabilities", rows.filter(isLiability));
  const equity = build("Equity", rows.filter(isEquity));

  /* Earnings not yet closed to retained earnings — inception to date, so
     the identity holds in every year, not only the first. */
  const revenue = rows.filter(isRevenue).reduce((s, r) => s + sectionValue(r), 0);
  const expense = rows.filter(isExpense).reduce((s, r) => s + sectionValue(r), 0);
  const earnings = revenue - expense;
  if (Math.abs(earnings) > 0.005) {
    equity.accounts.push({ code: "3200", name: "Current Year Earnings", amount: earnings });
    equity.amount += earnings;
  }
  const total_assets = assets.amount;
  const total_liab_eq = liabilities.amount + equity.amount;
  return {
    as_of: asOf, currency: ccy, assets, liabilities, equity,
    total_assets, total_liab_eq,
    reconciled: Math.abs(total_assets - total_liab_eq) < 0.05,
  };
}
