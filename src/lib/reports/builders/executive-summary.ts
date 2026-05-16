import "server-only";

/* ===========================================================================
   Executive Finance Summary — INTERNAL.
   Single-page exec briefing pulling from orders, expenses, payments,
   bank accounts. Shows the profit picture, cash picture, treasury
   position. The most internal of the seven reports — never share.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  ReportBuildContext,
  ReportColumn,
  ReportPayload,
  ReportRowValue,
  ReportSection,
} from "../types";
import { generateReportNo, loadTenant, normalisePeriod } from "../shared";
import { fxRate, REPORTING_CURRENCY } from "@/lib/finance/fx";
import type { BankAccount } from "@/lib/finance/types";

export async function buildExecutiveSummary(ctx: ReportBuildContext): Promise<ReportPayload> {
  const period = normalisePeriod(ctx.filters.date_from, ctx.filters.date_to);
  const tenant = await loadTenant(ctx.tenantId);

  const [ordersRes, expensesRes, paymentsRes, accountsRes] = await Promise.all([
    supabaseServer
      .from("finance_orders")
      .select("id, order_no, customer_name, order_date, selling_price, currency, status, payment_status")
      .eq("tenant_id", ctx.tenantId)
      .gte("order_date", period.from)
      .lte("order_date", period.to),
    supabaseServer
      .from("finance_expenses")
      .select("amount, currency, payment_status, expense_date")
      .eq("tenant_id", ctx.tenantId)
      .gte("expense_date", period.from)
      .lte("expense_date", period.to),
    supabaseServer
      .from("finance_payments")
      .select("amount, currency, direction, status, payment_date")
      .eq("tenant_id", ctx.tenantId)
      .gte("payment_date", period.from)
      .lte("payment_date", period.to),
    supabaseServer
      .from("finance_bank_accounts")
      .select("*")
      .eq("tenant_id", ctx.tenantId),
  ]);

  const orders = ordersRes.data ?? [];
  const expenses = (expensesRes.data ?? []) as Array<{ amount: number | string; currency: string; payment_status: string }>;
  const payments = (paymentsRes.data ?? []) as Array<{ amount: number | string; currency: string; direction: string; status: string }>;
  const accounts = (accountsRes.data ?? []) as BankAccount[];

  /* USD-equivalent aggregates so the headline numbers are comparable
     across multi-currency operations. */
  const revenue = sumInReporting(orders.map((o) => ({ amount: Number((o as { selling_price: number | string }).selling_price) || 0, currency: (o as { currency: string }).currency })));
  const expensesTotal = sumInReporting(expenses.map((e) => ({ amount: Number(e.amount) || 0, currency: e.currency })));
  const cashIn = sumInReporting(
    payments.filter((p) => p.direction === "in" && p.status === "completed").map((p) => ({ amount: Number(p.amount) || 0, currency: p.currency })),
  );
  const cashOut = sumInReporting(
    payments.filter((p) => p.direction === "out" && p.status === "completed").map((p) => ({ amount: Number(p.amount) || 0, currency: p.currency })),
  );

  let treasury = 0;
  for (const a of accounts) treasury += (Number(a.current_balance) || 0) * fxRate(a.currency);

  const netCash = cashIn - cashOut;

  /* Top 5 orders by selling price (in their local currency for
     readability — the table shows the raw currency code). */
  const topOrders = orders
    .map((o) => ({
      order_no: (o as { order_no: string }).order_no,
      customer_name: (o as { customer_name: string }).customer_name,
      selling_price: Number((o as { selling_price: number | string }).selling_price) || 0,
      currency: (o as { currency: string }).currency,
      status: (o as { status: string }).status,
      payment_status: (o as { payment_status: string }).payment_status,
    }))
    .sort((a, b) => b.selling_price * fxRate(b.currency) - a.selling_price * fxRate(a.currency))
    .slice(0, 5);

  const orderCols: ReportColumn[] = [
    { key: "order_no", label: "Order", width: "110px" },
    { key: "customer_name", label: "Customer" },
    { key: "status", label: "Status", width: "100px" },
    { key: "payment_status", label: "Payment", width: "100px" },
    { key: "selling_price", label: "Amount", align: "right", format: "money", width: "120px" },
    { key: "currency", label: "Ccy", width: "44px" },
  ];
  const topOrderRows: Array<Record<string, ReportRowValue>> = topOrders.map((o) => ({
    order_no: o.order_no,
    customer_name: o.customer_name,
    status: o.status,
    payment_status: o.payment_status,
    selling_price: o.selling_price,
    currency: o.currency,
  }));

  const accountCols: ReportColumn[] = [
    { key: "bank_name", label: "Bank" },
    { key: "currency", label: "Ccy", width: "44px" },
    { key: "current_balance", label: "Balance", align: "right", format: "money", width: "120px" },
    { key: "status", label: "Status", width: "80px" },
  ];
  const accountRows: Array<Record<string, ReportRowValue>> = accounts
    .filter((a) => a.status === "active")
    .map((a) => ({
      bank_name: `${a.bank_name} — ${a.account_name}`,
      currency: a.currency,
      current_balance: Number(a.current_balance) || 0,
      status: a.status,
    }));

  const sections: ReportSection[] = [
    { kind: "table", title: "Top Orders (period)", columns: orderCols, rows: topOrderRows, empty_state: "No orders in window." },
    { kind: "spacer" },
    { kind: "table", title: "Active Bank Accounts", columns: accountCols, rows: accountRows, empty_state: "No active accounts." },
  ];

  return {
    meta: {
      report_type: "executive_summary",
      visibility: "internal",
      title: "Executive Finance Summary",
      subtitle: `${period.from} → ${period.to}`,
      generated_at: new Date().toISOString(),
      generated_by_name: ctx.generatedByName,
      period,
      currency: REPORTING_CURRENCY,
      report_no: generateReportNo("KX-EXEC"),
      tenant_name: tenant.name,
      locale: "en-US",
    },
    summary: [
      { label: `Revenue (${REPORTING_CURRENCY})`, value: revenue, format: "money", tone: "positive" },
      { label: `Expenses (${REPORTING_CURRENCY})`, value: expensesTotal, format: "money", tone: "negative" },
      { label: `Net Cash (${REPORTING_CURRENCY})`, value: netCash, format: "money", tone: netCash >= 0 ? "positive" : "negative" },
      { label: `Treasury (${REPORTING_CURRENCY})`, value: treasury, format: "money", tone: treasury >= 0 ? "positive" : "negative" },
    ],
    sections,
    internal_warning: "INTERNAL — EXECUTIVE BRIEFING — DO NOT DISTRIBUTE",
    row_count: orders.length + accounts.length,
    total_amount: revenue,
  };
}

function sumInReporting(items: Array<{ amount: number; currency: string }>): number {
  let s = 0;
  for (const i of items) s += i.amount * fxRate(i.currency);
  return s;
}
