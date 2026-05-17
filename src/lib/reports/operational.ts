import "server-only";

/* ===========================================================================
   Operational reports — read-only aggregations for /reports.

     · buildSalesReport       posted invoices grouped by month / customer
     · buildPurchasesReport   vendor bills grouped by month / supplier
     · buildInventoryReport   on-hand + value rollup by warehouse / type
     · buildExpensesReport    finance_expenses by category / month
     · buildCustomersReport   customers ranked by AR + recent activity
     · buildSuppliersReport   suppliers ranked by AP + recent activity

   No new accounting logic. Uses tables already populated by the
   transactional modules.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";

export interface DateRange { from: string; to: string }

export interface ReportRow {
  key: string;
  label: string;
  count?: number;
  amount: number;
  currency?: string;
  meta?: Record<string, string | number | null>;
}

export interface OperationalReport {
  title: string;
  rows: ReportRow[];
  totals: { count: number; amount: number };
  meta?: Record<string, string | number | null>;
}

/* ─── Sales report ────────────────────────────────────────── */

export async function buildSalesReport(tenantId: string, range: DateRange): Promise<OperationalReport> {
  const { data: invs } = await supabaseServer
    .from("invoices")
    .select("id, customer_id, total, base_amount, currency, status, cancelled_at, issue_date")
    .eq("tenant_id", tenantId)
    .gte("issue_date", range.from)
    .lte("issue_date", range.to);
  const rows = ((invs ?? []) as Array<{
    id: string; customer_id: string | null; total: number; base_amount: number | null;
    currency: string; status: string; cancelled_at: string | null; issue_date: string;
  }>).filter((i) => !i.cancelled_at && i.status !== "cancelled" && i.status !== "void" && i.status !== "draft");

  const custIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean) as string[]));
  const custRes = custIds.length
    ? await supabaseServer.from("customers").select("id, name, company_name, country").in("id", custIds)
    : { data: [] as Array<{ id: string; name: string; company_name: string | null; country: string | null }> };
  const custMap = new Map<string, { name: string; country: string | null }>();
  for (const c of (custRes.data ?? [])) custMap.set(c.id, { name: c.company_name ?? c.name, country: c.country });

  const byCustomer = new Map<string, { label: string; count: number; amount: number; country: string | null }>();
  let totalAmount = 0;
  for (const r of rows) {
    const cid = r.customer_id ?? "—";
    const info = r.customer_id ? custMap.get(r.customer_id) : null;
    const cur = byCustomer.get(cid) ?? {
      label: info?.name ?? "Unassigned",
      count: 0, amount: 0, country: info?.country ?? null,
    };
    const amt = Number(r.base_amount) || Number(r.total) || 0;
    cur.count += 1; cur.amount += amt;
    byCustomer.set(cid, cur);
    totalAmount += amt;
  }
  const out: ReportRow[] = Array.from(byCustomer.entries()).map(([key, v]) => ({
    key, label: v.label, count: v.count, amount: v.amount,
    meta: { country: v.country },
  })).sort((a, b) => b.amount - a.amount);
  return { title: "Sales by Customer", rows: out, totals: { count: rows.length, amount: totalAmount } };
}

/* ─── Purchases report ────────────────────────────────────── */

export async function buildPurchasesReport(tenantId: string, range: DateRange): Promise<OperationalReport> {
  const { data: bills } = await supabaseServer
    .from("vendor_bills")
    .select("id, supplier_id, total, base_amount, currency, status, bill_date")
    .eq("tenant_id", tenantId)
    .gte("bill_date", range.from)
    .lte("bill_date", range.to);
  type Bill = {
    id: string; supplier_id: string; total: number; base_amount: number | null;
    currency: string; status: string; bill_date: string;
  };
  const rows = ((bills ?? []) as Bill[])
    .filter((b) => b.status !== "cancelled" && b.status !== "draft");

  const supIds = Array.from(new Set(rows.map((r) => r.supplier_id).filter(Boolean)));
  const supRes = supIds.length
    ? await supabaseServer.from("contacts").select("id, display_name, company_name").in("id", supIds)
    : { data: [] as Array<{ id: string; display_name: string | null; company_name: string | null }> };
  const supMap = new Map<string, string>();
  for (const s of (supRes.data ?? [])) supMap.set(s.id, s.company_name ?? s.display_name ?? s.id.slice(0, 8));

  const bySupplier = new Map<string, { label: string; count: number; amount: number }>();
  let totalAmount = 0;
  for (const r of rows) {
    const cur = bySupplier.get(r.supplier_id) ?? {
      label: supMap.get(r.supplier_id) ?? "Unknown", count: 0, amount: 0,
    };
    const amt = Number(r.base_amount) || Number(r.total) || 0;
    cur.count += 1; cur.amount += amt;
    bySupplier.set(r.supplier_id, cur);
    totalAmount += amt;
  }
  const out: ReportRow[] = Array.from(bySupplier.entries()).map(([key, v]) => ({
    key, label: v.label, count: v.count, amount: v.amount,
  })).sort((a, b) => b.amount - a.amount);
  return { title: "Purchases by Supplier", rows: out, totals: { count: rows.length, amount: totalAmount } };
}

/* ─── Expenses report ─────────────────────────────────────── */

export async function buildExpensesReport(tenantId: string, range: DateRange): Promise<OperationalReport> {
  const { data } = await supabaseServer
    .from("finance_expenses")
    .select("id, category_id, amount, base_amount, currency, expense_date")
    .eq("tenant_id", tenantId)
    .gte("expense_date", range.from)
    .lte("expense_date", range.to);
  type Row = {
    id: string; category_id: string | null; amount: number; base_amount: number | null;
    currency: string; expense_date: string;
  };
  const rows = (data ?? []) as Row[];

  const catIds = Array.from(new Set(rows.map((r) => r.category_id).filter(Boolean) as string[]));
  const catRes = catIds.length
    ? await supabaseServer.from("finance_expense_categories").select("id, name").in("id", catIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const catMap = new Map<string, string>();
  for (const c of (catRes.data ?? [])) catMap.set(c.id, c.name);

  const byCat = new Map<string, { label: string; count: number; amount: number }>();
  let totalAmount = 0;
  for (const r of rows) {
    const key = r.category_id ?? "—";
    const label = r.category_id ? catMap.get(r.category_id) ?? "Uncategorized" : "Uncategorized";
    const cur = byCat.get(key) ?? { label, count: 0, amount: 0 };
    const amt = Number(r.base_amount) || Number(r.amount) || 0;
    cur.count += 1; cur.amount += amt;
    byCat.set(key, cur);
    totalAmount += amt;
  }
  const out: ReportRow[] = Array.from(byCat.entries()).map(([key, v]) => ({
    key, label: v.label, count: v.count, amount: v.amount,
  })).sort((a, b) => b.amount - a.amount);
  return { title: "Expenses by Category", rows: out, totals: { count: rows.length, amount: totalAmount } };
}

/* ─── Inventory report ────────────────────────────────────── */

export async function buildInventoryReport(tenantId: string): Promise<OperationalReport> {
  const { data: vals } = await supabaseServer
    .from("inventory_valuation").select("inventory_item_id, warehouse_id, qty_on_hand, inventory_value, currency")
    .eq("tenant_id", tenantId);
  type Val = { inventory_item_id: string; warehouse_id: string; qty_on_hand: number; inventory_value: number; currency: string };
  const rows = (vals ?? []) as Val[];
  if (rows.length === 0) return { title: "Inventory by Warehouse", rows: [], totals: { count: 0, amount: 0 } };

  const whIds = Array.from(new Set(rows.map((r) => r.warehouse_id)));
  const whRes = whIds.length
    ? await supabaseServer.from("inventory_warehouses").select("id, code, name").in("id", whIds)
    : { data: [] as Array<{ id: string; code: string; name: string }> };
  const whMap = new Map<string, string>();
  for (const w of (whRes.data ?? [])) whMap.set(w.id, `${w.code} · ${w.name}`);

  const byWh = new Map<string, { label: string; count: number; amount: number; qty: number; ccy: string }>();
  let totalAmount = 0;
  for (const r of rows) {
    const cur = byWh.get(r.warehouse_id) ?? {
      label: whMap.get(r.warehouse_id) ?? r.warehouse_id.slice(0, 8),
      count: 0, amount: 0, qty: 0, ccy: r.currency || "USD",
    };
    cur.count += 1;
    cur.amount += Number(r.inventory_value) || 0;
    cur.qty   += Number(r.qty_on_hand) || 0;
    byWh.set(r.warehouse_id, cur);
    totalAmount += Number(r.inventory_value) || 0;
  }
  const out: ReportRow[] = Array.from(byWh.entries()).map(([key, v]) => ({
    key, label: v.label, count: v.count, amount: v.amount, currency: v.ccy,
    meta: { qty: v.qty },
  })).sort((a, b) => b.amount - a.amount);
  return { title: "Inventory by Warehouse", rows: out, totals: { count: rows.length, amount: totalAmount } };
}

/* ─── Customers / Suppliers ───────────────────────────────── */

export async function buildCustomersReport(tenantId: string): Promise<OperationalReport> {
  const [custRes, invRes] = await Promise.all([
    supabaseServer.from("customers").select("id, name, company_name, country").eq("tenant_id", tenantId),
    supabaseServer.from("invoices")
      .select("customer_id, total, base_amount, balance, amount_paid, status, cancelled_at")
      .eq("tenant_id", tenantId),
  ]);
  type Cust = { id: string; name: string; company_name: string | null; country: string | null };
  type Inv  = { customer_id: string | null; total: number; base_amount: number | null; balance: number; amount_paid: number; status: string; cancelled_at: string | null };
  const custs = (custRes.data ?? []) as Cust[];
  const invs  = ((invRes.data  ?? []) as Inv[])
    .filter((i) => !i.cancelled_at && i.status !== "cancelled" && i.status !== "void" && i.status !== "draft");

  const totals = new Map<string, { revenue: number; openAr: number; invoices: number }>();
  for (const i of invs) {
    const cid = i.customer_id ?? "—";
    const cur = totals.get(cid) ?? { revenue: 0, openAr: 0, invoices: 0 };
    const amt = Number(i.base_amount) || Number(i.total) || 0;
    const open = Number(i.balance) > 0 ? Number(i.balance) : Number(i.total) - Number(i.amount_paid);
    cur.revenue += amt;
    cur.openAr  += Math.max(0, open);
    cur.invoices += 1;
    totals.set(cid, cur);
  }
  const out: ReportRow[] = custs.map((c) => {
    const t = totals.get(c.id) ?? { revenue: 0, openAr: 0, invoices: 0 };
    return {
      key: c.id, label: c.company_name ?? c.name, count: t.invoices,
      amount: t.revenue,
      meta: { country: c.country, open_ar: Number(t.openAr.toFixed(2)) },
    };
  }).sort((a, b) => b.amount - a.amount);
  let totalAmount = 0;
  for (const r of out) totalAmount += r.amount;
  return { title: "Customer Ledger", rows: out, totals: { count: invs.length, amount: totalAmount } };
}

export async function buildSuppliersReport(tenantId: string): Promise<OperationalReport> {
  const [supRes, billRes] = await Promise.all([
    supabaseServer.from("contacts").select("id, display_name, company_name").eq("tenant_id", tenantId).eq("contact_type", "supplier"),
    supabaseServer.from("vendor_bills")
      .select("supplier_id, total, base_amount, balance, amount_paid, status").eq("tenant_id", tenantId),
  ]);
  type Sup  = { id: string; display_name: string | null; company_name: string | null };
  type Bill = { supplier_id: string; total: number; base_amount: number | null; balance: number; amount_paid: number; status: string };
  const sups  = (supRes.data ?? []) as Sup[];
  const bills = ((billRes.data ?? []) as Bill[]).filter((b) => b.status !== "cancelled" && b.status !== "draft");

  const totals = new Map<string, { spend: number; openAp: number; bills: number }>();
  for (const b of bills) {
    const cur = totals.get(b.supplier_id) ?? { spend: 0, openAp: 0, bills: 0 };
    const amt = Number(b.base_amount) || Number(b.total) || 0;
    const open = Number(b.balance) > 0 ? Number(b.balance) : Number(b.total) - Number(b.amount_paid);
    cur.spend += amt;
    cur.openAp += Math.max(0, open);
    cur.bills += 1;
    totals.set(b.supplier_id, cur);
  }
  const out: ReportRow[] = sups.map((s) => {
    const t = totals.get(s.id) ?? { spend: 0, openAp: 0, bills: 0 };
    return {
      key: s.id, label: s.company_name ?? s.display_name ?? s.id.slice(0, 8),
      count: t.bills, amount: t.spend,
      meta: { open_ap: Number(t.openAp.toFixed(2)) },
    };
  }).sort((a, b) => b.amount - a.amount);
  let totalAmount = 0;
  for (const r of out) totalAmount += r.amount;
  return { title: "Supplier Ledger", rows: out, totals: { count: bills.length, amount: totalAmount } };
}
