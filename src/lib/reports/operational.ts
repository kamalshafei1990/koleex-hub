import "server-only";

/* ===========================================================================
   Operational reports — read-only aggregations for /reports/operational.

     · buildSalesReport       issued invoices by customer
     · buildPurchasesReport   vendor bills by supplier
     · buildExpensesReport    finance_expenses by category
     · buildInventoryReport   on-hand + value by warehouse
     · buildCustomersReport   every customer: sales + what is still open
     · buildSuppliersReport   every supplier: purchases + what we still owe

   No new accounting logic. Uses tables already populated by the
   transactional modules.

   AMOUNTS ARE KEPT PER CURRENCY (Reports 6C, 26/09/2026). A document's
   figure is its `base_amount` in the company's base currency when Finance
   has converted it, otherwise its own `total` in its own currency — and two
   currencies are never added together (the Reports rule: totals per
   currency). Measured before this: every invoice and 39 of 42 expenses had
   no base_amount, in CNY and USD, and each report summed them as one number.
   What is still OPEN (customers / suppliers) is the document's own balance,
   so it is always in the document's own currency.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import { resolveBaseCurrency } from "@/lib/finance/currency";

export interface DateRange { from: string; to: string }

/** Amounts by currency code — never summed across codes. */
export type Money = Record<string, number>;

export interface ReportRow {
  key: string;
  /** null = the documents name no customer / supplier / category, or the
   *  record is gone — the page names that in the reader's language. */
  label: string | null;
  count: number;
  amounts: Money;
  /** customers / suppliers: what is still open, per currency. */
  open?: Money;
  /** inventory: units on hand. */
  qty?: number;
  meta?: Record<string, string | number | null>;
}

export interface OperationalReport {
  rows: ReportRow[];
  totals: { count: number; amounts: Money; open?: Money; qty?: number };
  /** The company's base currency — the one a converted `base_amount` is in. */
  base: string;
}

const ccyOf = (c: string | null | undefined, fallback: string) => (c || fallback).trim().toUpperCase() || fallback;

/** A document's figure: converted by Finance → base currency; else its own. */
function docAmount(baseAmount: number | null, total: number, currency: string | null, base: string): [string, number] {
  const b = baseAmount == null ? NaN : Number(baseAmount);
  if (Number.isFinite(b) && b !== 0) return [base, b];
  return [ccyOf(currency, base), Number(total) || 0];
}

function add(m: Money, ccy: string, n: number) {
  if (!n) return;
  m[ccy] = (m[ccy] ?? 0) + n;
}

function round2(m: Money): Money {
  const out: Money = {};
  for (const [c, v] of Object.entries(m)) out[c] = Math.round(v * 100) / 100;
  return out;
}

/** Biggest first, currency by currency: the base currency decides, then the
 *  others in code order — a ranking that never needs an exchange rate. */
function byAmounts(base: string, pick: (r: ReportRow) => Money) {
  return (a: ReportRow, b: ReportRow) => {
    const ma = pick(a), mb = pick(b);
    const codes = [base, ...[...new Set([...Object.keys(ma), ...Object.keys(mb)])].filter((c) => c !== base).sort()];
    for (const c of codes) {
      const d = (mb[c] ?? 0) - (ma[c] ?? 0);
      if (Math.abs(d) > 0.005) return d;
    }
    return b.count - a.count || String(a.label ?? "").localeCompare(String(b.label ?? ""));
  };
}

function sumRows(rows: ReportRow[], field: "amounts" | "open"): Money {
  const out: Money = {};
  for (const r of rows) for (const [c, v] of Object.entries(r[field] ?? {})) add(out, c, v);
  return round2(out);
}

/* ─── Sales report ────────────────────────────────────────── */

export async function buildSalesReport(tenantId: string, range: DateRange): Promise<OperationalReport> {
  const [{ data: invs }, base] = await Promise.all([
    supabaseServer
      .from("invoices")
      .select("id, customer_id, total, base_amount, currency, status, cancelled_at, issue_date")
      .eq("tenant_id", tenantId)
      .gte("issue_date", range.from)
      .lte("issue_date", range.to),
    resolveBaseCurrency(tenantId),
  ]);
  const docs = ((invs ?? []) as Array<{
    id: string; customer_id: string | null; total: number; base_amount: number | null;
    currency: string | null; status: string; cancelled_at: string | null; issue_date: string;
  }>).filter((i) => !i.cancelled_at && i.status !== "cancelled" && i.status !== "void" && i.status !== "draft");

  const custIds = Array.from(new Set(docs.map((r) => r.customer_id).filter(Boolean) as string[]));
  const custRes = custIds.length
    ? await supabaseServer.from("customers").select("id, name, company_name, country").in("id", custIds)
    : { data: [] as Array<{ id: string; name: string; company_name: string | null; country: string | null }> };
  const custMap = new Map<string, { name: string; country: string | null }>();
  for (const c of (custRes.data ?? [])) custMap.set(c.id, { name: c.company_name ?? c.name, country: c.country });

  const byCustomer = new Map<string, ReportRow>();
  for (const r of docs) {
    const key = r.customer_id ?? "—";
    const info = r.customer_id ? custMap.get(r.customer_id) : null;
    const row = byCustomer.get(key) ?? { key, label: info?.name ?? null, count: 0, amounts: {}, meta: { country: info?.country ?? null } };
    const [ccy, amt] = docAmount(r.base_amount, r.total, r.currency, base);
    row.count += 1;
    add(row.amounts, ccy, amt);
    byCustomer.set(key, row);
  }
  const rows = [...byCustomer.values()].map((r) => ({ ...r, amounts: round2(r.amounts) })).sort(byAmounts(base, (r) => r.amounts));
  return { rows, totals: { count: docs.length, amounts: sumRows(rows, "amounts") }, base };
}

/* ─── Purchases report ────────────────────────────────────── */

export async function buildPurchasesReport(tenantId: string, range: DateRange): Promise<OperationalReport> {
  const [{ data: bills }, base] = await Promise.all([
    supabaseServer
      .from("vendor_bills")
      .select("id, supplier_id, total, base_amount, currency, status, bill_date")
      .eq("tenant_id", tenantId)
      .gte("bill_date", range.from)
      .lte("bill_date", range.to),
    resolveBaseCurrency(tenantId),
  ]);
  type Bill = {
    id: string; supplier_id: string | null; total: number; base_amount: number | null;
    currency: string | null; status: string; bill_date: string;
  };
  const docs = ((bills ?? []) as Bill[]).filter((b) => b.status !== "cancelled" && b.status !== "draft");

  const supIds = Array.from(new Set(docs.map((r) => r.supplier_id).filter(Boolean) as string[]));
  const supRes = supIds.length
    ? await supabaseServer.from("contacts").select("id, display_name, company_name").in("id", supIds)
    : { data: [] as Array<{ id: string; display_name: string | null; company_name: string | null }> };
  const supMap = new Map<string, string>();
  for (const s of (supRes.data ?? [])) supMap.set(s.id, s.company_name ?? s.display_name ?? s.id.slice(0, 8));

  const bySupplier = new Map<string, ReportRow>();
  for (const r of docs) {
    const key = r.supplier_id ?? "—";
    const row = bySupplier.get(key) ?? { key, label: r.supplier_id ? supMap.get(r.supplier_id) ?? null : null, count: 0, amounts: {} };
    const [ccy, amt] = docAmount(r.base_amount, r.total, r.currency, base);
    row.count += 1;
    add(row.amounts, ccy, amt);
    bySupplier.set(key, row);
  }
  const rows = [...bySupplier.values()].map((r) => ({ ...r, amounts: round2(r.amounts) })).sort(byAmounts(base, (r) => r.amounts));
  return { rows, totals: { count: docs.length, amounts: sumRows(rows, "amounts") }, base };
}

/* ─── Expenses report ─────────────────────────────────────── */

export async function buildExpensesReport(tenantId: string, range: DateRange): Promise<OperationalReport> {
  const [{ data }, base] = await Promise.all([
    supabaseServer
      .from("finance_expenses")
      .select("id, category_id, amount, base_amount, currency, expense_date")
      .eq("tenant_id", tenantId)
      .gte("expense_date", range.from)
      .lte("expense_date", range.to),
    resolveBaseCurrency(tenantId),
  ]);
  type Row = {
    id: string; category_id: string | null; amount: number; base_amount: number | null;
    currency: string | null; expense_date: string;
  };
  const docs = (data ?? []) as Row[];

  const catIds = Array.from(new Set(docs.map((r) => r.category_id).filter(Boolean) as string[]));
  const catRes = catIds.length
    ? await supabaseServer.from("finance_expense_categories").select("id, name").in("id", catIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const catMap = new Map<string, string>();
  for (const c of (catRes.data ?? [])) catMap.set(c.id, c.name);

  const byCat = new Map<string, ReportRow>();
  for (const r of docs) {
    const key = r.category_id ?? "—";
    const row = byCat.get(key) ?? { key, label: r.category_id ? catMap.get(r.category_id) ?? null : null, count: 0, amounts: {} };
    const [ccy, amt] = docAmount(r.base_amount, r.amount, r.currency, base);
    row.count += 1;
    add(row.amounts, ccy, amt);
    byCat.set(key, row);
  }
  const rows = [...byCat.values()].map((r) => ({ ...r, amounts: round2(r.amounts) })).sort(byAmounts(base, (r) => r.amounts));
  return { rows, totals: { count: docs.length, amounts: sumRows(rows, "amounts") }, base };
}

/* ─── Inventory report ────────────────────────────────────── */

export async function buildInventoryReport(tenantId: string): Promise<OperationalReport> {
  const [{ data: vals }, base] = await Promise.all([
    supabaseServer
      .from("inventory_valuation").select("inventory_item_id, warehouse_id, qty_on_hand, inventory_value, currency")
      .eq("tenant_id", tenantId),
    resolveBaseCurrency(tenantId),
  ]);
  type Val = { inventory_item_id: string; warehouse_id: string; qty_on_hand: number; inventory_value: number; currency: string | null };
  const docs = (vals ?? []) as Val[];
  if (docs.length === 0) return { rows: [], totals: { count: 0, amounts: {}, qty: 0 }, base };

  const whIds = Array.from(new Set(docs.map((r) => r.warehouse_id)));
  const whRes = whIds.length
    ? await supabaseServer.from("inventory_warehouses").select("id, code, name").in("id", whIds)
    : { data: [] as Array<{ id: string; code: string; name: string }> };
  const whMap = new Map<string, string>();
  for (const w of (whRes.data ?? [])) whMap.set(w.id, `${w.code} · ${w.name}`);

  const byWh = new Map<string, ReportRow & { qty: number }>();
  for (const r of docs) {
    const row = byWh.get(r.warehouse_id) ?? { key: r.warehouse_id, label: whMap.get(r.warehouse_id) ?? null, count: 0, amounts: {}, qty: 0 };
    row.count += 1;
    add(row.amounts, ccyOf(r.currency, base), Number(r.inventory_value) || 0);
    row.qty += Number(r.qty_on_hand) || 0;
    byWh.set(r.warehouse_id, row);
  }
  const rows = [...byWh.values()].map((r) => ({ ...r, amounts: round2(r.amounts) })).sort(byAmounts(base, (r) => r.amounts));
  return { rows, totals: { count: docs.length, amounts: sumRows(rows, "amounts"), qty: rows.reduce((s, r) => s + (r.qty ?? 0), 0) }, base };
}

/* ─── Customers / Suppliers ───────────────────────────────── */

export async function buildCustomersReport(tenantId: string): Promise<OperationalReport> {
  const [custRes, invRes, base] = await Promise.all([
    supabaseServer.from("customers").select("id, name, company_name, country").eq("tenant_id", tenantId),
    supabaseServer.from("invoices")
      .select("customer_id, total, base_amount, balance, amount_paid, currency, status, cancelled_at")
      .eq("tenant_id", tenantId),
    resolveBaseCurrency(tenantId),
  ]);
  type Cust = { id: string; name: string; company_name: string | null; country: string | null };
  type Inv  = { customer_id: string | null; total: number; base_amount: number | null; balance: number; amount_paid: number; currency: string | null; status: string; cancelled_at: string | null };
  const custs = (custRes.data ?? []) as Cust[];
  const custIds = new Set(custs.map((c) => c.id));
  const invs  = ((invRes.data  ?? []) as Inv[])
    .filter((i) => !i.cancelled_at && i.status !== "cancelled" && i.status !== "void" && i.status !== "draft");

  const totals = new Map<string, { sales: Money; open: Money; invoices: number }>();
  for (const i of invs) {
    const cid = i.customer_id && custIds.has(i.customer_id) ? i.customer_id : "—";
    const cur = totals.get(cid) ?? { sales: {}, open: {}, invoices: 0 };
    const [ccy, amt] = docAmount(i.base_amount, i.total, i.currency, base);
    add(cur.sales, ccy, amt);
    const open = Number(i.balance) > 0 ? Number(i.balance) : Number(i.total) - Number(i.amount_paid);
    add(cur.open, ccyOf(i.currency, base), Math.max(0, open));
    cur.invoices += 1;
    totals.set(cid, cur);
  }
  const rows: ReportRow[] = custs.map((c) => {
    const t = totals.get(c.id) ?? { sales: {}, open: {}, invoices: 0 };
    return { key: c.id, label: c.company_name ?? c.name, count: t.invoices, amounts: round2(t.sales), open: round2(t.open), meta: { country: c.country } };
  });
  /* Invoices that name no customer are sales too — their own row, so the
     total is the sum of what the table shows (they were counted in the
     total and shown in no row). */
  const none = totals.get("—");
  if (none) rows.push({ key: "—", label: null, count: none.invoices, amounts: round2(none.sales), open: round2(none.open), meta: { country: null } });
  rows.sort(byAmounts(base, (r) => r.amounts));
  return { rows, totals: { count: invs.length, amounts: sumRows(rows, "amounts"), open: sumRows(rows, "open") }, base };
}

export async function buildSuppliersReport(tenantId: string): Promise<OperationalReport> {
  const [supRes, billRes, base] = await Promise.all([
    supabaseServer.from("contacts").select("id, display_name, company_name").eq("tenant_id", tenantId).eq("contact_type", "supplier"),
    supabaseServer.from("vendor_bills")
      .select("supplier_id, total, base_amount, balance, amount_paid, currency, status").eq("tenant_id", tenantId),
    resolveBaseCurrency(tenantId),
  ]);
  type Sup  = { id: string; display_name: string | null; company_name: string | null };
  type Bill = { supplier_id: string; total: number; base_amount: number | null; balance: number; amount_paid: number; currency: string | null; status: string };
  const sups  = (supRes.data ?? []) as Sup[];
  const bills = ((billRes.data ?? []) as Bill[]).filter((b) => b.status !== "cancelled" && b.status !== "draft");

  const totals = new Map<string, { spend: Money; open: Money; bills: number }>();
  for (const b of bills) {
    const cur = totals.get(b.supplier_id) ?? { spend: {}, open: {}, bills: 0 };
    const [ccy, amt] = docAmount(b.base_amount, b.total, b.currency, base);
    add(cur.spend, ccy, amt);
    const open = Number(b.balance) > 0 ? Number(b.balance) : Number(b.total) - Number(b.amount_paid);
    add(cur.open, ccyOf(b.currency, base), Math.max(0, open));
    cur.bills += 1;
    totals.set(b.supplier_id, cur);
  }
  const known = new Set(sups.map((s) => s.id));
  const rows: ReportRow[] = sups.map((s) => {
    const t = totals.get(s.id) ?? { spend: {}, open: {}, bills: 0 };
    return { key: s.id, label: s.company_name ?? s.display_name ?? null, count: t.bills, amounts: round2(t.spend), open: round2(t.open) };
  });
  /* Bills whose supplier is not a supplier contact (gone, or never named)
     are purchases too — one row, so the total is what the table shows. */
  const orphan = { spend: {} as Money, open: {} as Money, bills: 0 };
  for (const [id, t] of totals) if (!known.has(id)) {
    for (const [c, v] of Object.entries(t.spend)) add(orphan.spend, c, v);
    for (const [c, v] of Object.entries(t.open)) add(orphan.open, c, v);
    orphan.bills += t.bills;
  }
  if (orphan.bills) rows.push({ key: "—", label: null, count: orphan.bills, amounts: round2(orphan.spend), open: round2(orphan.open) });
  rows.sort(byAmounts(base, (r) => r.amounts));
  return { rows, totals: { count: bills.length, amounts: sumRows(rows, "amounts"), open: sumRows(rows, "open") }, base };
}
