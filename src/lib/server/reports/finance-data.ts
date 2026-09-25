import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the Finance numbers (Phase 5C, owner's picks 26 Sep
   2026). The door is the one every company-wide finance number outside the
   Finance app passes (requireFinanceNumbers: internal accounts with the
   Finance module); bank balances, cash and profit also need «Bank & Profit»
   (the Finance app's own row).

     expense_categories  the company's spending per category in the days, in
                         each currency (never mixed) — the budget is typed
                         beside it (templates.ts DataInputDef)
     company_expenses    the expenses themselves (not rejected)
     cash_position       each bank account's balance in the books, now
     cash_flow           the ledger's cash flow over the days (base currency)
     profit_loss         the profit and loss over the days (base currency)
     ar_aging / ap_aging what customers owe us / we owe suppliers, by age, in
                         each currency
     month_close         what still stands between the books and a closed
                         month: drafts, entries waiting for approval,
                         expenses not posted, the lock, the closing entry
   Nothing here writes.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import { canSeeBankAndProfit, requireFinanceNumbers } from "@/lib/experience";
import { buildCashFlow, buildProfitLoss } from "@/lib/accounting/statements";
import { bankLedgerBalances } from "@/lib/finance/bank";
import type { ReportDataRow } from "@/lib/reports/templates";
import { isBankProfitSource, type FinanceSource } from "@/lib/reports/report-data";
import { agingRows, categoryRows } from "@/lib/reports/numbers-5c";

export interface FinanceCtx { auth: ServerAuthContext; start: string; end: string; today: string }
type Answer = { rows: ReportDataRow[] } | "denied";

const day = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const num = (v: unknown): number | null => { if (v === null || v === undefined || v === "") return null; const x = Number(v); return Number.isFinite(x) ? Math.round(x * 100) / 100 : null; };
function listOf<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? []) as T[];
}
const memo = <T,>(f: () => Promise<T>): (() => Promise<T>) => { let p: Promise<T> | null = null; return () => (p ??= f()); };

export interface FinanceShared { door: () => Promise<boolean>; bank: () => Promise<boolean> }
export function financeShared(auth: ServerAuthContext): FinanceShared {
  return {
    door: memo(async () => (await requireFinanceNumbers(auth)) === null),
    bank: memo(() => canSeeBankAndProfit(auth)),
  };
}

export async function financeData(src: FinanceSource, x: FinanceCtx, sh: FinanceShared): Promise<Answer> {
  if (!(await sh.door())) return "denied";
  if (isBankProfitSource(src) && !(await sh.bank())) return "denied";
  const tenant = x.auth.tenant_id;
  const { start: from, end: to, today } = x;

  switch (src) {
    case "expense_categories": case "company_expenses": {
      let q = supabaseServer.from("finance_expenses").select("id, title, category_id, expense_date, amount, currency, approval_status")
        .neq("approval_status", "rejected").gte("expense_date", from).lte("expense_date", to).order("expense_date", { ascending: true }).limit(src === "company_expenses" ? 101 : 5000);
      if (tenant) q = q.eq("tenant_id", tenant);
      const list = listOf<{ id: string; title: string | null; category_id: string | null; expense_date: string | null; amount: unknown; currency: string | null; approval_status: string | null }>(await q, "expenses");
      const catIds = Array.from(new Set(list.map((e) => e.category_id).filter((c): c is string => !!c)));
      const cats = catIds.length ? new Map(listOf<{ id: string; name: string | null }>(await supabaseServer.from("finance_expense_categories").select("id, name").in("id", catIds.slice(0, 500)), "expense categories").map((c) => [c.id, c.name ?? ""])) : new Map<string, string>();
      if (src === "company_expenses") {
        return { rows: list.map((e) => ({ key: e.id, currency: e.currency ?? undefined, cells: { title: e.title || "—", category: (e.category_id && cats.get(e.category_id)) || "", date: day(e.expense_date), amount: num(e.amount), status: e.approval_status } })) };
      }
      /* "—" names the expenses with no category. */
      return { rows: categoryRows(list.map((e) => ({ categoryId: e.category_id, category: (e.category_id && cats.get(e.category_id)) || "", amount: Number(e.amount) || 0, currency: e.currency ?? "USD" })), "—") };
    }
    case "cash_position": {
      let q = supabaseServer.from("finance_bank_accounts").select("id, bank_name, account_name, currency, current_balance, status").is("deleted_at", null).limit(200);
      if (tenant) q = q.eq("tenant_id", tenant);
      const accounts = listOf<{ id: string; bank_name: string | null; account_name: string | null; currency: string | null; current_balance: unknown; status: string | null }>(await q, "bank accounts")
        .filter((a) => a.status !== "closed" && a.status !== "archived");
      const ledger = tenant ? await bankLedgerBalances(tenant).catch(() => new Map()) : new Map();
      return { rows: accounts.map((a) => {
        const l = ledger.get(a.id);
        return { key: a.id, currency: (l?.currency ?? a.currency) || undefined, cells: { account: a.account_name || "—", bank: a.bank_name || "", balance: l ? num(l.ledger_native) : num(a.current_balance) } };
      }) };
    }
    case "cash_flow": {
      if (!tenant) return { rows: [] };
      const cf = await buildCashFlow(tenant, { from, to });
      const line = (k: string, v: number) => ({ key: k, currency: cf.currency, cells: { line: k, amount: num(v) } });
      return { rows: [line("opening_cash", cf.opening_cash), line("operating", cf.operating.amount), line("investing", cf.investing.amount), line("financing", cf.financing.amount), line("net_cash", cf.net_change), line("closing_cash", cf.closing_cash)] };
    }
    case "profit_loss": {
      if (!tenant) return { rows: [] };
      const pl = await buildProfitLoss(tenant, { from, to });
      const line = (k: string, v: number) => ({ key: k, currency: pl.currency, cells: { line: k, amount: num(v) } });
      return { rows: [line("revenue", pl.revenue.amount), line("cost_of_sales", pl.cost_of_sales.amount), line("gross_profit", pl.gross_profit), line("operating_expenses", pl.operating_expenses.amount), line("net_profit", pl.net_profit)] };
    }
    case "ar_aging": case "ap_aging": {
      /* ⚠️ The status columns are ENUMS: only real values in the filter. */
      let q = src === "ar_aging"
        ? supabaseServer.from("invoices").select("due_date, balance, currency").not("status", "in", "(draft,void,cancelled)").is("cancelled_at", null).gt("balance", 0).limit(5000)
        : supabaseServer.from("vendor_bills").select("due_date, balance, currency").not("status", "in", "(draft,cancelled,paid)").gt("balance", 0).limit(5000);
      if (tenant) q = q.eq("tenant_id", tenant);
      const list = listOf<{ due_date: string | null; balance: unknown; currency: string | null }>(await q, src === "ar_aging" ? "receivables" : "payables");
      return { rows: agingRows(list.map((r) => ({ due: day(r.due_date), balance: Number(r.balance) || 0, currency: (r.currency || "").toUpperCase() })), today) };
    }
    case "month_close": {
      const within = <Q extends { gte: (c: string, v: string) => Q; lte: (c: string, v: string) => Q }>(q: Q, col: string) => q.gte(col, from).lte(col, to);
      const count = async (build: () => PromiseLike<{ count: number | null; error: { message: string } | null }>, what: string) => { const r = await build(); if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.count ?? 0; };
      const je = () => { let q = supabaseServer.from("accounting_journal_entries").select("id", { count: "exact", head: true }); if (tenant) q = q.eq("tenant_id", tenant); return q; };
      const [drafts, waiting, posted, closing, unposted, lock] = await Promise.all([
        count(() => within(je().eq("status", "draft"), "entry_date"), "draft entries"),
        count(() => within(je().eq("approval_status", "pending"), "entry_date"), "entries waiting"),
        count(() => within(je().eq("status", "posted"), "entry_date"), "posted entries"),
        count(() => within(je().eq("source_type", "closing").neq("status", "voided"), "entry_date"), "closing entry"),
        count(() => { let q = supabaseServer.from("finance_expenses").select("id", { count: "exact", head: true }).eq("approval_status", "approved").neq("accounting_status", "posted"); if (tenant) q = q.eq("tenant_id", tenant); return within(q, "expense_date"); }, "unposted expenses"),
        (async () => { let q = supabaseServer.from("accounting_period_locks").select("locked_through"); if (tenant) q = q.eq("tenant_id", tenant); const r = await q.maybeSingle(); if (r.error) throw new Error(`period lock: ${r.error.message}`); return (r.data as { locked_through: string | null } | null)?.locked_through ?? null; })(),
      ]);
      const row = (check: string, n: number | null, ok: boolean): ReportDataRow => ({ key: check, cells: { check, count: n, state: ok ? "completed" : "pending" } });
      return { rows: [
        row("draft_entries", drafts, drafts === 0),
        row("entries_waiting", waiting, waiting === 0),
        row("expenses_unposted", unposted, unposted === 0),
        row("posted_entries", posted, true),
        row("closing_entry", closing, closing > 0),
        row("period_locked", null, !!lock && lock.slice(0, 10) >= to),
      ] };
    }
  }
}
