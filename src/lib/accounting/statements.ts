import "server-only";

/* ===========================================================================
   Phase A.3 — Financial Statements & Accounting Reporting.

   Pure read functions powering the four statement views:
     · buildProfitLoss          revenue → gross → operating → net
     · buildCashFlow            direct-method operating / investing / financing
     · buildEquityStatement     opening → contributions → CYE → closing
     · buildFinancialRatios     current/quick/cash/debt/margin/runway

   HARD RULES (the brief is emphatic):
     · every number comes from POSTED journal lines only
       (status='posted', tenant-scoped)
     · never read operational tables directly
     · never include drafted/failed/voided entries
     · cross-statement consistency: TB net = P&L net = Equity CYE

   Account-section mapping uses the COA seeded in A.1 (the 16-account
   default set). The classification matrix lives in one place at the
   top of this file so future COA edits land in a single spot.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { AccountingAccount } from "./types";

/* ─── Account classification ──────────────────────────────────── */

/* Direct-cost expense accounts. With no COGS module yet, freight +
   customs are the closest direct-cost analogue in the Hub COA. */
const DIRECT_COST_CODES = new Set(["5200", "5300"]);

/* Current-asset codes — excludes 1400-1999 (would be fixed assets
   when those accounts are added in a later phase). */
const CURRENT_ASSET_CODES = new Set(["1000", "1010", "1100", "1200", "1300"]);

/* Current-liability codes — AP + Taxes Payable. Loans Payable
   (2100) sits in long-term liabilities. */
const CURRENT_LIABILITY_CODES = new Set(["2000", "2200"]);

/* Cash-equivalent codes — used by cash flow + cash ratio. */
const CASH_CODES = new Set(["1000", "1010"]);

/* Liability codes that flow through financing activities (loans). */
const FINANCING_LIABILITY_CODES = new Set(["2100"]);

/* ─── Shared period type + helper ─────────────────────────────── */

export interface Period {
  from: string;   // ISO yyyy-mm-dd inclusive
  to: string;     // ISO yyyy-mm-dd inclusive
}

/** Returns the immediately-prior period of equal length. */
export function priorPeriod(period: Period): Period {
  const from = new Date(period.from);
  const to = new Date(period.to);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  const priorTo = new Date(from);
  priorTo.setDate(priorTo.getDate() - 1);
  const priorFrom = new Date(priorTo);
  priorFrom.setDate(priorFrom.getDate() - days + 1);
  return {
    from: priorFrom.toISOString().slice(0, 10),
    to:   priorTo.toISOString().slice(0, 10),
  };
}

/* ─── Core helper: posted-lines aggregator ────────────────────── */

interface AggRow {
  account_id: string;
  code: string;
  name: string;
  type: AccountingAccount["type"];
  normal_balance: AccountingAccount["normal_balance"];
  debit_total: number;
  credit_total: number;
}

async function aggregatePostedLines(tenantId: string, period?: Period): Promise<AggRow[]> {
  /* All accounts loaded once so empty-period statements still render
     every section header (even if the amount is zero). */
  const { data: accountsRaw } = await supabaseServer
    .from("accounting_accounts")
    .select("id, code, name, type, normal_balance")
    .eq("tenant_id", tenantId);
  const accounts = (accountsRaw ?? []) as Array<Pick<AccountingAccount, "id" | "code" | "name" | "type" | "normal_balance">>;
  const acctById = new Map(accounts.map((a) => [a.id, a]));

  let q = supabaseServer
    .from("accounting_journal_lines")
    .select("account_id, debit, credit, accounting_journal_entries!inner(entry_date, status, tenant_id)")
    .eq("tenant_id", tenantId)
    .eq("accounting_journal_entries.tenant_id", tenantId)
    .eq("accounting_journal_entries.status", "posted");
  if (period) {
    q = q.gte("accounting_journal_entries.entry_date", period.from)
         .lte("accounting_journal_entries.entry_date", period.to);
  }
  const { data } = await q;

  const aggMap = new Map<string, AggRow>();
  for (const a of accounts) {
    aggMap.set(a.id, { account_id: a.id, code: a.code, name: a.name, type: a.type, normal_balance: a.normal_balance, debit_total: 0, credit_total: 0 });
  }
  for (const row of (data ?? []) as Array<{ account_id: string; debit: number | string; credit: number | string }>) {
    const cur = aggMap.get(row.account_id);
    if (!cur) continue;
    cur.debit_total  += Number(row.debit)  || 0;
    cur.credit_total += Number(row.credit) || 0;
  }
  /* Preserve account_id even on accounts that the period skipped. */
  void acctById;
  return Array.from(aggMap.values());
}

/* Signed balance respecting normal_balance direction. */
function balanceFor(row: AggRow): number {
  return row.normal_balance === "debit"
    ? row.debit_total - row.credit_total
    : row.credit_total - row.debit_total;
}

/* ─── Profit & Loss ───────────────────────────────────────────── */

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
  /** Optional same-shape comparison period (caller passes
   *  compare_prior=1 → builder fills in priorPeriod(...)). */
  comparison?: ProfitLoss;
}

interface PLBuildOpts {
  comparePrior?: boolean;
  currency?: string;
}

export async function buildProfitLoss(
  tenantId: string,
  period: Period,
  opts: PLBuildOpts = {},
): Promise<ProfitLoss> {
  const rows = await aggregatePostedLines(tenantId, period);

  const revenueRows = rows.filter((r) => r.type === "revenue" || r.type === "contra_revenue");
  const expenseRows = rows.filter((r) => r.type === "expense" || r.type === "contra_expense");

  const revenue: PLSection = {
    label: "Revenue",
    amount: revenueRows.reduce((s, r) => s + balanceFor(r), 0),
    accounts: revenueRows
      .map((r) => ({ account_id: r.account_id, code: r.code, name: r.name, amount: balanceFor(r) }))
      .filter((a) => Math.abs(a.amount) > 0.005)
      .sort((a, b) => a.code.localeCompare(b.code)),
  };

  const costRows = expenseRows.filter((r) => DIRECT_COST_CODES.has(r.code));
  const opexRows = expenseRows.filter((r) => !DIRECT_COST_CODES.has(r.code));

  const cost_of_sales: PLSection = {
    label: "Cost of sales",
    amount: costRows.reduce((s, r) => s + balanceFor(r), 0),
    accounts: costRows
      .map((r) => ({ account_id: r.account_id, code: r.code, name: r.name, amount: balanceFor(r) }))
      .filter((a) => Math.abs(a.amount) > 0.005)
      .sort((a, b) => a.code.localeCompare(b.code)),
  };

  const operating_expenses: PLSection = {
    label: "Operating expenses",
    amount: opexRows.reduce((s, r) => s + balanceFor(r), 0),
    accounts: opexRows
      .map((r) => ({ account_id: r.account_id, code: r.code, name: r.name, amount: balanceFor(r) }))
      .filter((a) => Math.abs(a.amount) > 0.005)
      .sort((a, b) => a.code.localeCompare(b.code)),
  };

  const gross_profit     = revenue.amount - cost_of_sales.amount;
  const operating_profit = gross_profit - operating_expenses.amount;
  /* Net = operating; tax + financial charges are handled inside opex
     until the tax engine ships (A.4). */
  const net_profit       = operating_profit;

  const gross_margin_pct     = revenue.amount > 0 ? (gross_profit / revenue.amount) * 100 : 0;
  const operating_margin_pct = revenue.amount > 0 ? (operating_profit / revenue.amount) * 100 : 0;
  const net_margin_pct       = revenue.amount > 0 ? (net_profit / revenue.amount) * 100 : 0;

  const result: ProfitLoss = {
    period,
    currency: opts.currency ?? "USD",
    revenue,
    cost_of_sales,
    gross_profit,
    gross_margin_pct,
    operating_expenses,
    operating_profit,
    operating_margin_pct,
    net_profit,
    net_margin_pct,
  };

  if (opts.comparePrior) {
    result.comparison = await buildProfitLoss(tenantId, priorPeriod(period), { currency: opts.currency });
  }

  return result;
}

/* ─── Cash Flow (direct method) ───────────────────────────────── */

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
  /** True when opening + net = closing (within rounding). */
  reconciled:     boolean;
}

/** Cash-impact of a single line on a cash account:
 *  Dr cash = inflow (positive), Cr cash = outflow (negative). */
function cashImpactDr(row: { debit: number | string; credit: number | string }): number {
  return (Number(row.debit) || 0) - (Number(row.credit) || 0);
}

export async function buildCashFlow(tenantId: string, period: Period): Promise<CashFlowStatement> {
  /* Resolve cash account ids for this tenant. */
  const { data: cashAccts } = await supabaseServer
    .from("accounting_accounts")
    .select("id, code")
    .eq("tenant_id", tenantId)
    .in("code", Array.from(CASH_CODES));
  const cashIds = new Set(((cashAccts ?? []) as Array<{ id: string; code: string }>).map((a) => a.id));
  if (cashIds.size === 0) {
    /* No cash accounts seeded — return a zeroed statement, never crash. */
    return zeroedCashFlow(tenantId, period);
  }

  /* Pull every posted line that hits a cash account in the period
     PLUS the contra account info on the same journal so we can
     classify Operating / Investing / Financing. */
  const { data: cashLines } = await supabaseServer
    .from("accounting_journal_lines")
    .select(
      "id, entry_id, account_id, debit, credit, accounting_journal_entries!inner(id, entry_date, status, source_type, tenant_id)",
    )
    .eq("tenant_id", tenantId)
    .in("account_id", Array.from(cashIds))
    .eq("accounting_journal_entries.tenant_id", tenantId)
    .eq("accounting_journal_entries.status", "posted")
    .gte("accounting_journal_entries.entry_date", period.from)
    .lte("accounting_journal_entries.entry_date", period.to);

  type CashLineRow = {
    id: string; entry_id: string; account_id: string;
    debit: number | string; credit: number | string;
    accounting_journal_entries: { id: string; entry_date: string; status: string; source_type: string };
  };
  const lines = (cashLines ?? []) as unknown as CashLineRow[];

  /* For each cash line we also need to know the contra account
     (the OTHER side of the journal) so financing/investing can be
     identified. Pull all sibling lines in a single batch. */
  const entryIds = Array.from(new Set(lines.map((l) => l.entry_id)));
  let contraMap = new Map<string, Array<{ account_id: string; debit: number; credit: number; account_code: string; account_type: string }>>();
  if (entryIds.length > 0) {
    const { data: siblings } = await supabaseServer
      .from("accounting_journal_lines")
      .select("entry_id, account_id, debit, credit, account:account_id(code, type)")
      .eq("tenant_id", tenantId)
      .in("entry_id", entryIds);
    contraMap = new Map();
    /* Supabase types the embedded relation as an array even on a 1:1 FK,
       so we widen via `unknown` and assert the runtime shape. */
    for (const s of (siblings ?? []) as unknown as Array<{
      entry_id: string; account_id: string; debit: number | string; credit: number | string;
      account: { code: string; type: string } | null;
    }>) {
      if (cashIds.has(s.account_id)) continue; /* skip the cash side itself */
      const list = contraMap.get(s.entry_id) ?? [];
      list.push({
        account_id: s.account_id,
        debit:  Number(s.debit) || 0,
        credit: Number(s.credit) || 0,
        account_code: s.account?.code ?? "",
        account_type: s.account?.type ?? "",
      });
      contraMap.set(s.entry_id, list);
    }
  }

  /* Classify each cash line by source_type + contra account. */
  const operating: CashFlowLine[] = [];
  const investing: CashFlowLine[] = [];
  const financing: CashFlowLine[] = [];

  for (const l of lines) {
    const impact = cashImpactDr(l);
    if (Math.abs(impact) < 0.005) continue;
    const e = l.accounting_journal_entries;
    const contra = contraMap.get(l.entry_id) ?? [];
    const equityContra = contra.some((c) => c.account_type === "equity");
    const loanContra   = contra.some((c) => FINANCING_LIABILITY_CODES.has(c.account_code));

    const isFinancing =
      e.source_type === "opening_balance" || equityContra || loanContra;
    const isInvesting = false; /* no investing-class accounts seeded yet */

    const label =
      e.source_type === "payment"          ? (impact > 0 ? "Customer collections" : "Supplier payments")
      : e.source_type === "expense"        ? "Operating disbursements"
      : e.source_type === "cash_movement"  ? (impact > 0 ? "Unclassified cash inflow" : "Unclassified cash outflow")
      : e.source_type === "opening_balance" ? "Opening / capital movements"
      : "Manual entry";

    const dest = isFinancing ? financing : isInvesting ? investing : operating;
    dest.push({ label, amount: impact, detail: e.entry_date });
  }

  /* Collapse the per-line list into one row per label for readability. */
  const collapse = (arr: CashFlowLine[]): CashFlowSection => {
    const m = new Map<string, number>();
    for (const x of arr) m.set(x.label, (m.get(x.label) ?? 0) + x.amount);
    const grouped: CashFlowLine[] = Array.from(m.entries())
      .map(([label, amount]) => ({ label, amount }))
      .filter((x) => Math.abs(x.amount) > 0.005)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    return {
      label: "",
      amount: grouped.reduce((s, x) => s + x.amount, 0),
      lines: grouped,
    };
  };

  const opSection = { ...collapse(operating), label: "Operating activities" };
  const invSection = { ...collapse(investing), label: "Investing activities" };
  const finSection = { ...collapse(financing), label: "Financing activities" };

  /* Opening cash = cash balance at start of period (period-prior
     aggregate). Closing cash = opening + net. */
  const beforeRows = await aggregatePostedLines(tenantId, { from: "1900-01-01", to: shiftDateBackOneDay(period.from) });
  let opening_cash = 0;
  for (const r of beforeRows) {
    if (CASH_CODES.has(r.code)) opening_cash += balanceFor(r);
  }
  const net_change = opSection.amount + invSection.amount + finSection.amount;
  const closing_cash = opening_cash + net_change;

  /* Sanity check: closing cash from CF should equal closing cash
     from the TB. Drift means a posted-but-not-classified line. */
  const periodEnd = await aggregatePostedLines(tenantId, { from: "1900-01-01", to: period.to });
  let tbCash = 0;
  for (const r of periodEnd) {
    if (CASH_CODES.has(r.code)) tbCash += balanceFor(r);
  }
  const reconciled = Math.abs(closing_cash - tbCash) < 0.01;

  return {
    period,
    currency: "USD",
    opening_cash,
    operating: opSection,
    investing: invSection,
    financing: finSection,
    net_change,
    closing_cash,
    reconciled,
  };
}

function shiftDateBackOneDay(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function zeroedCashFlow(_tenantId: string, period: Period): CashFlowStatement {
  return {
    period,
    currency: "USD",
    opening_cash: 0,
    operating: { label: "Operating activities", amount: 0, lines: [] },
    investing: { label: "Investing activities", amount: 0, lines: [] },
    financing: { label: "Financing activities", amount: 0, lines: [] },
    net_change: 0,
    closing_cash: 0,
    reconciled: true,
  };
}

/* ─── Statement of Equity ────────────────────────────────────── */

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
  /** Retained earnings standing balance at period end (3100). */
  retained_earnings: number;
}

export async function buildEquityStatement(tenantId: string, period: Period): Promise<EquityStatement> {
  /* Opening equity = sum of equity-type accounts at period start. */
  const beforeRows = await aggregatePostedLines(tenantId, { from: "1900-01-01", to: shiftDateBackOneDay(period.from) });
  let opening_equity = 0;
  for (const r of beforeRows) {
    if (r.type === "equity" || r.type === "contra_equity") opening_equity += balanceFor(r);
  }

  /* Period movements — split into owner contributions (Owner Capital
     account 3000) and current-year earnings (revenue - expense for
     the period, which is the standard P&L → equity rollup). */
  const periodRows = await aggregatePostedLines(tenantId, period);
  let contributions = 0;
  for (const r of periodRows) {
    if (r.code === "3000") contributions += balanceFor(r);
  }
  /* Current year earnings comes from the P&L (revenue - expenses). */
  const pl = await buildProfitLoss(tenantId, period);
  const current_year_earnings = pl.net_profit;

  /* Closing equity = sum of equity-type accounts at period end. */
  const periodEnd = await aggregatePostedLines(tenantId, { from: "1900-01-01", to: period.to });
  let closing_equity_balance = 0;
  let retained_earnings = 0;
  for (const r of periodEnd) {
    if (r.type === "equity" || r.type === "contra_equity") closing_equity_balance += balanceFor(r);
    if (r.code === "3100") retained_earnings += balanceFor(r);
  }
  /* Add the unrealised current-year earnings (revenue - expense not
     yet rolled into retained) so closing reflects economic equity. */
  const closing_equity = closing_equity_balance + current_year_earnings;

  const movements: EquityMovement[] = [
    { label: "Owner contributions / withdrawals", amount: contributions },
    { label: "Current year earnings",             amount: current_year_earnings },
  ].filter((m) => Math.abs(m.amount) > 0.005);

  return {
    period,
    currency: "USD",
    opening_equity,
    contributions,
    current_year_earnings,
    closing_equity,
    movements,
    retained_earnings,
  };
}

/* ─── Financial Ratios ─────────────────────────────────────────── */

export interface FinancialRatios {
  as_of: string;
  currency: string;
  /* Liquidity */
  current_ratio:        number;
  quick_ratio:          number;
  cash_ratio:           number;
  /* Solvency */
  debt_to_equity:       number;
  /* Profitability — computed from the trailing YTD P&L */
  gross_margin_pct:     number;
  operating_margin_pct: number;
  net_margin_pct:       number;
  /* Runway — months of cash at current burn (negative net only). */
  runway_months:        number | null;
  /* Concentration — placeholder, no operational join. */
  receivables_balance:  number;
  payables_balance:     number;
}

export async function buildFinancialRatios(tenantId: string, asOf: string): Promise<FinancialRatios> {
  const ytdFrom = `${new Date(asOf).getUTCFullYear()}-01-01`;
  const ytdPeriod: Period = { from: ytdFrom, to: asOf };

  const [snapshot, pl] = await Promise.all([
    aggregatePostedLines(tenantId, { from: "1900-01-01", to: asOf }),
    buildProfitLoss(tenantId, ytdPeriod),
  ]);

  let cash = 0;
  let currentAssets = 0;
  let currentLiabilities = 0;
  let receivablesBalance = 0;
  let payablesBalance = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  for (const r of snapshot) {
    const b = balanceFor(r);
    if (CASH_CODES.has(r.code)) cash += b;
    if (CURRENT_ASSET_CODES.has(r.code)) currentAssets += b;
    if (CURRENT_LIABILITY_CODES.has(r.code)) currentLiabilities += b;
    if (r.code === "1100") receivablesBalance += b;
    if (r.code === "2000") payablesBalance += b;
    if (r.type === "liability" || r.type === "contra_liability") totalLiabilities += b;
    if (r.type === "equity" || r.type === "contra_equity") totalEquity += b;
  }
  /* Add CYE into equity for the runway / D/E calc — economic equity
     reflects unrolled earnings. */
  totalEquity += pl.net_profit;

  const monthsInYtd = Math.max(1, Math.round(daysBetween(ytdPeriod.from, ytdPeriod.to) / 30));
  const burnPerMonth = pl.net_profit < 0 ? Math.abs(pl.net_profit) / monthsInYtd : 0;
  const runwayMonths = burnPerMonth > 0 ? cash / burnPerMonth : null;

  return {
    as_of: asOf,
    currency: "USD",
    current_ratio:        currentLiabilities > 0 ? currentAssets / currentLiabilities : 0,
    quick_ratio:          currentLiabilities > 0 ? (cash + receivablesBalance) / currentLiabilities : 0,
    cash_ratio:           currentLiabilities > 0 ? cash / currentLiabilities : 0,
    debt_to_equity:       totalEquity > 0 ? totalLiabilities / totalEquity : 0,
    gross_margin_pct:     pl.gross_margin_pct,
    operating_margin_pct: pl.operating_margin_pct,
    net_margin_pct:       pl.net_margin_pct,
    runway_months:        runwayMonths,
    receivables_balance:  receivablesBalance,
    payables_balance:     payablesBalance,
  };
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(1, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000) + 1);
}
