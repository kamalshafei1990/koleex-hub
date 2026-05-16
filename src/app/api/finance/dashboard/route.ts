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
      .select("id, selling_price, tax_refund_value, order_date, payment_status")
      .eq("tenant_id", auth.tenant_id)
      .gte("order_date", startISO)
      .lte("order_date", endISO),
    supabaseServer
      .from("finance_orders")
      .select("selling_price")
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

  const gross_profit = total_revenue - total_supplier_cost;
  const net_profit = gross_profit - total_expenses;

  const cash_in = payments
    .filter((p) => p.direction === "in")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const cash_in_prev = paymentsPrev
    .filter((p) => p.direction === "in")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const cash_out = payments
    .filter((p) => p.direction === "out")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const cash_out_prev = paymentsPrev
    .filter((p) => p.direction === "out")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  /* Accounts receivable / payable are point-in-time, not window-based.
     AR = sum of selling prices on orders that aren't fully paid.
     AP = sum of (supplier_cost - paid_amount) across all suppliers
          + unpaid expense amounts. */
  const [arRes, apOrderSuppliersRes, apExpensesRes] = await Promise.all([
    supabaseServer
      .from("finance_orders")
      .select("selling_price, payment_status")
      .eq("tenant_id", auth.tenant_id)
      .neq("payment_status", "paid"),
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

  const accounts_receivable = (arRes.data ?? []).reduce(
    (s, o) => s + (Number(o.selling_price) || 0),
    0,
  );
  const accounts_payable =
    (apOrderSuppliersRes.data ?? []).reduce(
      (s, x) => s + Math.max(0, (Number(x.supplier_cost) || 0) - (Number(x.paid_amount) || 0)),
      0,
    ) +
    (apExpensesRes.data ?? []).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  /* TREND series. Build buckets — 7 daily / ~13 weekly / 12 monthly. */
  const trend = buildTrend(period, start, end, orders, expenses, total_supplier_cost);

  const out: DashboardKpi = {
    total_revenue: round2(total_revenue),
    total_expenses: round2(total_expenses),
    gross_profit: round2(gross_profit),
    net_profit: round2(net_profit),
    cash_in: round2(cash_in),
    cash_out: round2(cash_out),
    accounts_receivable: round2(accounts_receivable),
    accounts_payable: round2(accounts_payable),
    delta: {
      revenue_pct: pctDelta(total_revenue, total_revenue_prev),
      expenses_pct: pctDelta(total_expenses, total_expenses_prev),
      gross_profit_pct: pctDelta(gross_profit, total_revenue_prev - 0),
      net_profit_pct: pctDelta(net_profit, total_revenue_prev - total_expenses_prev),
      cash_in_pct: pctDelta(cash_in, cash_in_prev),
      cash_out_pct: pctDelta(cash_out, cash_out_prev),
    },
    delta_value: {
      revenue: round2(total_revenue - total_revenue_prev),
      expenses: round2(total_expenses - total_expenses_prev),
      gross_profit: round2(gross_profit - (total_revenue_prev - 0)),
      net_profit: round2(net_profit - (total_revenue_prev - total_expenses_prev)),
      cash_in: round2(cash_in - cash_in_prev),
      cash_out: round2(cash_out - cash_out_prev),
    },
    trend,
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
