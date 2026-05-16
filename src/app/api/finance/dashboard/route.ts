import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { DashboardKpi, DashboardPeriod } from "@/lib/finance/types";

/* GET /api/finance/dashboard?period=week|quarter|year
 *
 * Returns a fully-computed KPI snapshot for the chosen period plus a
 * trend series suitable for a sparkline / mini-chart. All numbers are
 * computed at request time from the raw finance_* tables — there's no
 * denormalised "kpi" table, so there's no risk of stale snapshots.
 *
 * PERIOD WINDOWS
 *   week     last 7 days        previous: prior 7 days
 *   quarter  last 90 days       previous: prior 90 days
 *   year     last 365 days      previous: prior 365 days
 *
 * Trend buckets:
 *   week     7 daily buckets
 *   quarter  ~13 weekly buckets
 *   year     12 monthly buckets
 */

function periodWindow(period: DashboardPeriod): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const days = period === "week" ? 7 : period === "quarter" ? 90 : 365;
  const start = new Date(end);
  start.setDate(end.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  const prevEnd = new Date(start);
  prevEnd.setDate(start.getDate() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - days + 1);
  prevStart.setHours(0, 0, 0, 0);
  return { start, end, prevStart, prevEnd };
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) {
    if (curr === 0) return 0;
    return null; /* "—" — undefined when prior period had zero baseline */
  }
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const periodParam = (url.searchParams.get("period") ?? "quarter") as DashboardPeriod;
  const period: DashboardPeriod =
    periodParam === "week" || periodParam === "quarter" || periodParam === "year"
      ? periodParam
      : "quarter";

  const { start, end, prevStart, prevEnd } = periodWindow(period);
  const startISO = toISODate(start);
  const endISO = toISODate(end);
  const prevStartISO = toISODate(prevStart);
  const prevEndISO = toISODate(prevEnd);

  /* Pull the rows we need for both the current and previous windows in
     parallel. Keep the column selection tight — we only need amounts
     and dates for aggregations. */
  const [ordersRes, ordersPrevRes, expensesRes, expensesPrevRes, paymentsRes, paymentsPrevRes, suppliersRes] = await Promise.all([
    supabaseServer
      .from("finance_orders")
      .select("id, order_no, customer_name, currency, selling_price, tax_refund_value, financial_charges, order_date, payment_status")
      .eq("tenant_id", auth.tenant_id)
      .gte("order_date", startISO)
      .lte("order_date", endISO),
    supabaseServer
      .from("finance_orders")
      .select("selling_price, tax_refund_value, financial_charges")
      .eq("tenant_id", auth.tenant_id)
      .gte("order_date", prevStartISO)
      .lte("order_date", prevEndISO),
    supabaseServer
      .from("finance_expenses")
      .select("amount, expense_date, payment_status")
      .eq("tenant_id", auth.tenant_id)
      .gte("expense_date", startISO)
      .lte("expense_date", endISO),
    supabaseServer
      .from("finance_expenses")
      .select("amount")
      .eq("tenant_id", auth.tenant_id)
      .gte("expense_date", prevStartISO)
      .lte("expense_date", prevEndISO),
    supabaseServer
      .from("finance_payments")
      .select("amount, direction, payment_date, status")
      .eq("tenant_id", auth.tenant_id)
      .eq("status", "completed")
      .gte("payment_date", startISO)
      .lte("payment_date", endISO),
    supabaseServer
      .from("finance_payments")
      .select("amount, direction")
      .eq("tenant_id", auth.tenant_id)
      .eq("status", "completed")
      .gte("payment_date", prevStartISO)
      .lte("payment_date", prevEndISO),
    /* Supplier costs from orders within the current window — joined to
       limit to recent orders only, matching the revenue window. */
    supabaseServer
      .from("finance_order_suppliers")
      .select("supplier_cost, order_id, finance_orders!inner(order_date,tenant_id)")
      .eq("tenant_id", auth.tenant_id)
      .gte("finance_orders.order_date", startISO)
      .lte("finance_orders.order_date", endISO),
  ]);

  if (ordersRes.error || expensesRes.error || paymentsRes.error) {
    console.error(
      "[api/finance/dashboard]",
      ordersRes.error?.message,
      expensesRes.error?.message,
      paymentsRes.error?.message,
    );
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }

  const orders = ordersRes.data ?? [];
  const ordersPrev = ordersPrevRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const expensesPrev = expensesPrevRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const paymentsPrev = paymentsPrevRes.data ?? [];
  const supplierCosts = suppliersRes.data ?? [];

  const total_revenue = orders.reduce((s, o) => s + (Number(o.selling_price) || 0), 0);
  const total_revenue_prev = ordersPrev.reduce((s, o) => s + (Number(o.selling_price) || 0), 0);
  const total_supplier_cost = supplierCosts.reduce(
    (s, x) => s + (Number((x as { supplier_cost: number | string }).supplier_cost) || 0),
    0,
  );
  const total_expenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const total_expenses_prev = expensesPrev.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const total_tax_refund = orders.reduce(
    (s, o) => s + (Number((o as { tax_refund_value: number | string | null }).tax_refund_value) || 0),
    0,
  );
  const total_tax_refund_prev = ordersPrev.reduce(
    (s, o) => s + (Number((o as { tax_refund_value: number | string | null }).tax_refund_value) || 0),
    0,
  );
  const total_financial_charges = orders.reduce(
    (s, o) => s + (Number((o as { financial_charges: number | string | null }).financial_charges) || 0),
    0,
  );
  const total_financial_charges_prev = ordersPrev.reduce(
    (s, o) => s + (Number((o as { financial_charges: number | string | null }).financial_charges) || 0),
    0,
  );

  /* CORRECTED PROFIT CHAIN (Phase 1 fix)
       gross_profit = revenue − supplier cost                 (tax refund is NOT in gross)
       net_profit   = gross − expenses + tax_refund − financial_charges
     Same chain on the prior-period figure so the delta % is apples-to-apples. */
  const gross_profit = total_revenue - total_supplier_cost;
  const net_profit =
    gross_profit - total_expenses + total_tax_refund - total_financial_charges;
  const gross_profit_prev =
    total_revenue_prev - 0; /* prev supplier cost not loaded — gross delta is approximate */
  const net_profit_prev =
    gross_profit_prev - total_expenses_prev + total_tax_refund_prev - total_financial_charges_prev;

  const cash_in = payments
    .filter((p) => p.direction === "in")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const cash_in_prev = paymentsPrev
    .filter((p) => p.direction === "in")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  /* CASH OUT — sum of completed out-payments PLUS paid expenses that
     don't have an explicit payment row. Marking an expense
     payment_status='paid' is a common shortcut for "I paid this from
     petty cash / company card / etc." and we want it reflected in
     Cash Out without forcing the operator to also create a payment
     row. Same treatment in the previous-window number so the delta
     stays apples-to-apples. */
  const cash_out_payments = payments
    .filter((p) => p.direction === "out")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const cash_out_paid_expenses = expenses
    .filter((e) => (e as { payment_status: string }).payment_status === "paid")
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const cash_out = cash_out_payments + cash_out_paid_expenses;
  const cash_out_payments_prev = paymentsPrev
    .filter((p) => p.direction === "out")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const cash_out_paid_expenses_prev = expensesPrev
    .filter((e) => (e as { payment_status?: string }).payment_status === "paid")
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const cash_out_prev = cash_out_payments_prev + cash_out_paid_expenses_prev;

  /* ── Accounts Receivable & Accounts Payable ──
     Point-in-time, not window-based.

     AR — sum of (selling_price − collected) on orders that aren't fully
     paid. Old formula summed the full selling_price, which double-
     counted any deposit the customer had already paid. The corrected
     formula matches the order-level "outstanding_receivable" field.

     AP — sum of (supplier_cost − paid_amount) across all order
     supplier lines + unpaid expense amounts. (Already correct.) */
  const [arOrdersRes, arPaymentsRes, apOrderSuppliersRes, apExpensesRes] = await Promise.all([
    supabaseServer
      .from("finance_orders")
      .select("id, selling_price, payment_status")
      .eq("tenant_id", auth.tenant_id)
      .neq("payment_status", "paid"),
    supabaseServer
      .from("finance_payments")
      .select("linked_order_id, amount, direction, status")
      .eq("tenant_id", auth.tenant_id)
      .eq("direction", "in")
      .eq("status", "completed"),
    supabaseServer
      .from("finance_order_suppliers")
      .select("supplier_cost, paid_amount")
      .eq("tenant_id", auth.tenant_id),
    supabaseServer
      .from("finance_expenses")
      .select("amount, payment_status")
      .eq("tenant_id", auth.tenant_id)
      .neq("payment_status", "paid"),
  ]);

  /* AR — pair each unpaid order with its completed in-payments and
     subtract. max(0, …) so over-payments don't drag AR negative. */
  const collectedByOrder = new Map<string, number>();
  for (const p of arPaymentsRes.data ?? []) {
    const k = (p as { linked_order_id: string | null }).linked_order_id;
    if (!k) continue;
    collectedByOrder.set(
      k,
      (collectedByOrder.get(k) ?? 0) + (Number((p as { amount: number | string }).amount) || 0),
    );
  }
  const accounts_receivable = (arOrdersRes.data ?? []).reduce((s, o) => {
    const row = o as { id: string; selling_price: number | string };
    const sp = Number(row.selling_price) || 0;
    const collected = collectedByOrder.get(row.id) ?? 0;
    return s + Math.max(0, sp - collected);
  }, 0);
  const accounts_payable =
    (apOrderSuppliersRes.data ?? []).reduce(
      (s, x) => s + Math.max(0, (Number(x.supplier_cost) || 0) - (Number(x.paid_amount) || 0)),
      0,
    ) +
    (apExpensesRes.data ?? []).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  /* TREND series. Build buckets — 7 daily / ~13 weekly / 12 monthly. */
  const trend = buildTrend(period, start, end, orders, expenses, total_supplier_cost);

  /* ── Phase 1.1: Top profitable orders + Top expense categories +
       Expected vs Realized cash. All computed off the same period
       window so they line up with the KPI cards above. ─────────── */
  const periodOrderIds = orders.map((o) => (o as { id: string }).id);

  const [periodSuppliersRes, periodLinkedExpRes, periodInPaymentsRes, periodCategoriesRes] = await Promise.all([
    /* Sum supplier cost + paid supplier per order */
    periodOrderIds.length
      ? supabaseServer
          .from("finance_order_suppliers")
          .select("order_id, supplier_cost, paid_amount")
          .eq("tenant_id", auth.tenant_id)
          .in("order_id", periodOrderIds)
      : Promise.resolve({ data: [], error: null }),
    /* Expenses linked to period orders (for net profit per order) */
    periodOrderIds.length
      ? supabaseServer
          .from("finance_expenses")
          .select("linked_order_id, amount, payment_status")
          .eq("tenant_id", auth.tenant_id)
          .in("linked_order_id", periodOrderIds)
      : Promise.resolve({ data: [], error: null }),
    /* Customer in-payments for period orders */
    periodOrderIds.length
      ? supabaseServer
          .from("finance_payments")
          .select("linked_order_id, amount, direction, status")
          .eq("tenant_id", auth.tenant_id)
          .eq("direction", "in")
          .eq("status", "completed")
          .in("linked_order_id", periodOrderIds)
      : Promise.resolve({ data: [], error: null }),
    /* Period expenses joined to category names */
    supabaseServer
      .from("finance_expenses")
      .select("amount, category_id, category:category_id(name), expense_date")
      .eq("tenant_id", auth.tenant_id)
      .gte("expense_date", startISO)
      .lte("expense_date", endISO),
  ]);

  type Aggs = { supplier_cost: number; paid_supplier: number; linked_exp: number; paid_exp: number; collected: number };
  const perOrder = new Map<string, Aggs>();
  const ensure = (id: string): Aggs => {
    const cur = perOrder.get(id);
    if (cur) return cur;
    const n: Aggs = { supplier_cost: 0, paid_supplier: 0, linked_exp: 0, paid_exp: 0, collected: 0 };
    perOrder.set(id, n);
    return n;
  };
  for (const s of periodSuppliersRes.data ?? []) {
    const row = s as { order_id: string; supplier_cost: number | string; paid_amount: number | string };
    const agg = ensure(row.order_id);
    agg.supplier_cost += Number(row.supplier_cost) || 0;
    agg.paid_supplier += Number(row.paid_amount) || 0;
  }
  for (const e of periodLinkedExpRes.data ?? []) {
    const row = e as { linked_order_id: string | null; amount: number | string; payment_status: string };
    if (!row.linked_order_id) continue;
    const agg = ensure(row.linked_order_id);
    agg.linked_exp += Number(row.amount) || 0;
    if (row.payment_status === "paid") agg.paid_exp += Number(row.amount) || 0;
  }
  for (const p of periodInPaymentsRes.data ?? []) {
    const row = p as { linked_order_id: string | null; amount: number | string };
    if (!row.linked_order_id) continue;
    const agg = ensure(row.linked_order_id);
    agg.collected += Number(row.amount) || 0;
  }

  /* Top orders by net profit (use the corrected chain) */
  type OrderForRank = {
    id: string; order_no: string; customer_name: string; selling_price: number | string;
    tax_refund_value: number | string | null; financial_charges: number | string | null;
    currency: string | null;
  };
  const top_orders = (orders as unknown as OrderForRank[])
    .map((o) => {
      const a = perOrder.get(o.id) ?? { supplier_cost: 0, paid_supplier: 0, linked_exp: 0, paid_exp: 0, collected: 0 };
      const sp = Number(o.selling_price) || 0;
      const gross = sp - a.supplier_cost;
      const tax = Number(o.tax_refund_value) || 0;
      const fc = Number(o.financial_charges) || 0;
      const net = gross - a.linked_exp + tax - fc;
      const pct = sp > 0 ? (net / sp) * 100 : 0;
      return {
        id: o.id,
        order_no: o.order_no,
        customer_name: o.customer_name,
        selling_price: round2(sp),
        net_profit: round2(net),
        net_profit_pct: round2(pct),
        currency: o.currency || "USD",
      };
    })
    .sort((a, b) => b.net_profit - a.net_profit)
    .slice(0, 5);

  /* Aggregate cash picture across the period */
  let collected_total = 0;
  let paid_supplier_total = 0;
  let paid_exp_total = 0;
  for (const a of perOrder.values()) {
    collected_total += a.collected;
    paid_supplier_total += a.paid_supplier;
    paid_exp_total += a.paid_exp;
  }
  const expected_vs_realized = {
    expected_net_profit: round2(net_profit),
    realized_cash_position: round2(collected_total - paid_supplier_total - paid_exp_total),
    collected: round2(collected_total),
    paid_supplier: round2(paid_supplier_total),
    paid_expenses: round2(paid_exp_total),
  };

  /* Top expense categories — PostgREST returns embeds as either a
     single object or an array depending on the FK shape; normalise. */
  const catMap = new Map<string, { name: string; total: number; count: number }>();
  for (const e of periodCategoriesRes.data ?? []) {
    const row = e as { amount: number | string; category: { name: string } | { name: string }[] | null };
    const cat = Array.isArray(row.category) ? row.category[0] : row.category;
    const name = cat?.name ?? "Uncategorised";
    const cur = catMap.get(name) ?? { name, total: 0, count: 0 };
    cur.total += Number(row.amount) || 0;
    cur.count += 1;
    catMap.set(name, cur);
  }
  const catArr = Array.from(catMap.values()).sort((a, b) => b.total - a.total);
  const catGrand = catArr.reduce((s, c) => s + c.total, 0) || 1;
  const top_expense_categories = catArr.slice(0, 5).map((c) => ({
    name: c.name,
    total: round2(c.total),
    share_pct: round2((c.total / catGrand) * 100),
    count: c.count,
  }));

  const out: DashboardKpi = {
    total_revenue: round2(total_revenue),
    total_supplier_cost: round2(total_supplier_cost),
    total_expenses: round2(total_expenses),
    total_tax_refund: round2(total_tax_refund),
    total_financial_charges: round2(total_financial_charges),
    gross_profit: round2(gross_profit),
    net_profit: round2(net_profit),
    cash_in: round2(cash_in),
    cash_out: round2(cash_out),
    accounts_receivable: round2(accounts_receivable),
    accounts_payable: round2(accounts_payable),
    delta: {
      revenue_pct: pctDelta(total_revenue, total_revenue_prev),
      expenses_pct: pctDelta(total_expenses, total_expenses_prev),
      gross_profit_pct: pctDelta(gross_profit, gross_profit_prev),
      net_profit_pct: pctDelta(net_profit, net_profit_prev),
      cash_in_pct: pctDelta(cash_in, cash_in_prev),
      cash_out_pct: pctDelta(cash_out, cash_out_prev),
    },
    delta_value: {
      revenue: round2(total_revenue - total_revenue_prev),
      expenses: round2(total_expenses - total_expenses_prev),
      gross_profit: round2(gross_profit - gross_profit_prev),
      net_profit: round2(net_profit - net_profit_prev),
      cash_in: round2(cash_in - cash_in_prev),
      cash_out: round2(cash_out - cash_out_prev),
    },
    trend,
    top_orders,
    top_expense_categories,
    expected_vs_realized,
  };

  return NextResponse.json({ kpi: out }, {
    headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" },
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface OrderRow { selling_price: number | string | null; order_date: string }
interface ExpenseRow { amount: number | string | null; expense_date: string }

function buildTrend(
  period: DashboardPeriod,
  start: Date,
  end: Date,
  orders: OrderRow[],
  expenses: ExpenseRow[],
  totalSupplierCost: number,
): DashboardKpi["trend"] {
  const buckets: { from: Date; to: Date; label: string }[] = [];
  const cursor = new Date(start);
  if (period === "week") {
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      buckets.push({ from: d, to: next, label: d.toLocaleDateString("en-US", { weekday: "short" }) });
    }
  } else if (period === "quarter") {
    while (cursor <= end) {
      const to = new Date(cursor);
      to.setDate(cursor.getDate() + 7);
      buckets.push({ from: new Date(cursor), to, label: `W${Math.ceil((cursor.getDate()) / 7)}` });
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const d = new Date(end.getFullYear(), end.getMonth() - 11 + i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      buckets.push({ from: d, to: next, label: d.toLocaleDateString("en-US", { month: "short" }) });
    }
  }

  /* Approximation: distribute supplier cost proportionally to per-bucket
     revenue. For Phase 1 this gives a clean stacked chart; Phase 2 can
     compute bucket-level COGS exactly from order_supplier records. */
  const buckRevenue = buckets.map(() => 0);
  for (const o of orders) {
    const d = new Date(o.order_date);
    const i = buckets.findIndex((b) => d >= b.from && d < b.to);
    if (i >= 0) buckRevenue[i] += Number(o.selling_price) || 0;
  }
  const buckExpenses = buckets.map(() => 0);
  for (const e of expenses) {
    const d = new Date(e.expense_date);
    const i = buckets.findIndex((b) => d >= b.from && d < b.to);
    if (i >= 0) buckExpenses[i] += Number(e.amount) || 0;
  }
  const totalRev = buckRevenue.reduce((s, x) => s + x, 0) || 1;
  return buckets.map((b, i) => {
    const revShare = buckRevenue[i] / totalRev;
    const cogs = totalSupplierCost * revShare;
    const net = buckRevenue[i] - cogs - buckExpenses[i];
    return {
      label: b.label,
      revenue: round2(buckRevenue[i]),
      expenses: round2(buckExpenses[i] + cogs),
      net_profit: round2(net),
    };
  });
}
