import "server-only";

/* ===========================================================================
   Executive Finance Summary — INTERNAL · EXECUTIVE · DO NOT DISTRIBUTE.

   Phase R.2 board-room rebuild. The renderer treats `EXECUTIVE` in
   the internal_warning as a third classification tier (navy accent).

   Layout:
     1. Executive headline strip — Revenue · Net Profit · Treasury · Runway
     2. Profitability block (kv) — Gross profit, Gross margin, Net profit,
        Net margin, Tax refund, Financial charges
     3. Liquidity block (kv)     — Cash in, Cash out, AR, AP, Treasury,
        Collection ratio, Supplier exposure
     4. Top customers table      — by revenue in the window (USD eqv)
     5. Top suppliers table      — by purchase volume in the window
     6. Top profitable orders    — by net profit in the window
     7. Key risks                — heuristic flags (concentration, AR
        overdue, runway, low cash)
     8. Operational observations — single-paragraph note
     9. Management notes         — placeholder for manual annotation

   All math reuses existing calc helpers — no new business logic.
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
import { computeOrderProfit } from "@/lib/finance/calc";
import type { BankAccount } from "@/lib/finance/types";

interface OrderRow {
  id: string;
  order_no: string;
  customer_id: string | null;
  customer_name: string;
  order_date: string;
  selling_price: number | string;
  tax_refund_value: number | string;
  financial_charges: number | string;
  currency: string;
  status: string;
  payment_status: string;
}

interface SupplierLine {
  order_id: string;
  supplier_id: string | null;
  supplier_name: string;
  supplier_cost: number | string;
  paid_amount: number | string;
  payment_status: string;
  due_date: string | null;
}

interface ExpenseLite {
  amount: number | string;
  currency: string;
  payment_status: string;
  expense_date: string;
  linked_order_id: string | null;
  linked_supplier_id: string | null;
}

interface PaymentLite {
  amount: number | string;
  currency: string;
  direction: string;
  status: string;
  party_type: string;
  party_id: string | null;
  payment_date: string;
}

export async function buildExecutiveSummary(ctx: ReportBuildContext): Promise<ReportPayload> {
  const period = normalisePeriod(ctx.filters.date_from, ctx.filters.date_to);
  const tenant = await loadTenant(ctx.tenantId);

  const [ordersRes, supplierLinesRes, expensesRes, paymentsRes, accountsRes] = await Promise.all([
    supabaseServer
      .from("finance_orders")
      .select("id, order_no, customer_id, customer_name, order_date, selling_price, tax_refund_value, financial_charges, currency, status, payment_status")
      .eq("tenant_id", ctx.tenantId)
      .gte("order_date", period.from)
      .lte("order_date", period.to)
      .limit(2000),
    /* Supplier lines for orders in the window — pulled by order id
       after we know the order set. */
    Promise.resolve({ data: [] as SupplierLine[] }),
    supabaseServer
      .from("finance_expenses")
      .select("amount, currency, payment_status, expense_date, linked_order_id, linked_supplier_id")
      .eq("tenant_id", ctx.tenantId)
      .gte("expense_date", period.from)
      .lte("expense_date", period.to)
      .limit(2000),
    supabaseServer
      .from("finance_payments")
      .select("amount, currency, direction, status, party_type, party_id, payment_date")
      .eq("tenant_id", ctx.tenantId)
      .gte("payment_date", period.from)
      .lte("payment_date", period.to)
      .limit(2000),
    supabaseServer
      .from("finance_bank_accounts")
      .select("*")
      .eq("tenant_id", ctx.tenantId),
  ]);

  const orders   = (ordersRes.data ?? []) as OrderRow[];
  const expenses = (expensesRes.data ?? []) as ExpenseLite[];
  const payments = (paymentsRes.data ?? []) as PaymentLite[];
  const accounts = (accountsRes.data ?? []) as BankAccount[];

  /* Second hop — supplier lines for the orders in the window. */
  let supplierLines: SupplierLine[] = [];
  if (orders.length > 0) {
    const { data: slData } = await supabaseServer
      .from("finance_order_suppliers")
      .select("order_id, supplier_id, supplier_name, supplier_cost, paid_amount, payment_status, due_date")
      .eq("tenant_id", ctx.tenantId)
      .in("order_id", orders.map((o) => o.id));
    supplierLines = (slData ?? []) as SupplierLine[];
  }
  void supplierLinesRes;

  /* ── USD-equivalent aggregates ─────────────────────────────────── */
  let revenueUsd = 0;
  let supplierCostUsd = 0;
  let expensesUsd = 0;
  let taxRefundUsd = 0;
  let financialChargesUsd = 0;
  let cashInUsd  = 0;
  let cashOutUsd = 0;

  for (const o of orders) {
    const r = fxRate(o.currency);
    revenueUsd          += (Number(o.selling_price)     || 0) * r;
    taxRefundUsd        += (Number(o.tax_refund_value)  || 0) * r;
    financialChargesUsd += (Number(o.financial_charges) || 0) * r;
  }
  for (const e of expenses) {
    expensesUsd += (Number(e.amount) || 0) * fxRate(e.currency);
  }
  /* Aggregate supplier cost from supplier_lines (period-bound by
     order_id). */
  const linesByOrder = groupBy(supplierLines, (l) => l.order_id);
  for (const o of orders) {
    const lines = linesByOrder.get(o.id) ?? [];
    const cost = lines.reduce((s, l) => s + (Number(l.supplier_cost) || 0), 0);
    supplierCostUsd += cost * fxRate(o.currency);
  }
  /* Cash in / out — completed payments only. */
  for (const p of payments.filter((p) => p.status === "completed")) {
    const v = (Number(p.amount) || 0) * fxRate(p.currency);
    if (p.direction === "in") cashInUsd += v;
    else if (p.direction === "out") cashOutUsd += v;
  }

  const grossProfit = revenueUsd - supplierCostUsd;
  /* Net profit follows the standard Hub formula:
       net = gross - expenses + taxRefund - financialCharges
     Same formula as computeOrderProfit; here we aggregate USD-eqv. */
  const netProfit   = grossProfit - expensesUsd + taxRefundUsd - financialChargesUsd;
  const grossMargin = revenueUsd > 0 ? (grossProfit / revenueUsd) * 100 : 0;
  const netMargin   = revenueUsd > 0 ? (netProfit / revenueUsd) * 100 : 0;

  /* ── AR / AP (period-anchored) ────────────────────────────────── */
  const ar = Math.max(0, revenueUsd - cashInUsd);
  const ap = Math.max(0, supplierCostUsd + expensesUsd - cashOutUsd);

  /* Treasury — all active accounts in USD eqv. */
  const activeAccounts = accounts.filter((a) => a.status === "active");
  let treasuryUsd = 0;
  for (const a of activeAccounts) treasuryUsd += (Number(a.current_balance) || 0) * fxRate(a.currency);

  /* Runway estimate (months) — treasury / average monthly net outflow
     over the period. If net cash flow is positive (we're net cash
     generative), runway is reported as "infinite" via null. */
  const periodDays = Math.max(1, daysBetween(period.from, period.to));
  const netOutPerDay = Math.max(0, (cashOutUsd - cashInUsd) / periodDays);
  const runwayDays = netOutPerDay > 0 ? Math.floor(treasuryUsd / netOutPerDay) : null;

  /* Collection ratio — cash_in / revenue. */
  const collectionRatio = revenueUsd > 0 ? (cashInUsd / revenueUsd) * 100 : 0;

  /* Supplier exposure — outstanding to top supplier in USD eqv. */
  const bySupplier = new Map<string, { name: string; outstanding: number }>();
  for (const l of supplierLines) {
    if (!l.supplier_id) continue;
    const r = orders.find((o) => o.id === l.order_id);
    const rate = r ? fxRate(r.currency) : 1;
    const remaining = ((Number(l.supplier_cost) || 0) - (Number(l.paid_amount) || 0)) * rate;
    const cur = bySupplier.get(l.supplier_id) ?? { name: l.supplier_name, outstanding: 0 };
    cur.outstanding += Math.max(0, remaining);
    bySupplier.set(l.supplier_id, cur);
  }
  const supplierExposureRows = Array.from(bySupplier.values())
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 5);
  const topSupplierExposure = supplierExposureRows[0]?.outstanding ?? 0;
  const supplierConcentration = ap > 0 ? (topSupplierExposure / ap) * 100 : 0;

  /* ── Top lists ────────────────────────────────────────────────── */
  /* Top customers by revenue (USD eqv) in the window. */
  const byCustomer = new Map<string, { name: string; revenue: number }>();
  for (const o of orders) {
    if (!o.customer_id) continue;
    const r = fxRate(o.currency);
    const cur = byCustomer.get(o.customer_id) ?? { name: o.customer_name, revenue: 0 };
    cur.revenue += (Number(o.selling_price) || 0) * r;
    byCustomer.set(o.customer_id, cur);
  }
  const topCustomerRows = Array.from(byCustomer.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const topCustomerRevenue = topCustomerRows[0]?.revenue ?? 0;
  const customerConcentration = revenueUsd > 0 ? (topCustomerRevenue / revenueUsd) * 100 : 0;

  /* Top profitable orders — compute per-order net via existing calc helper. */
  const expensesByOrder = groupBy(expenses, (e) => e.linked_order_id ?? "");
  const profitable = orders.map((o) => {
    const lines = linesByOrder.get(o.id) ?? [];
    const linkedExp = expensesByOrder.get(o.id) ?? [];
    const cashIn = payments
      .filter((p) => p.direction === "in" && p.status === "completed" && p.party_type === "customer" && p.party_id === o.customer_id)
      .reduce((s, p) => s + ((Number(p.amount) || 0) * fxRate(p.currency)), 0);
    const profit = computeOrderProfit({
      selling_price: Number(o.selling_price) || 0,
      tax_refund_value: Number(o.tax_refund_value) || 0,
      financial_charges: Number(o.financial_charges) || 0,
      suppliers: lines.map((l) => ({ supplier_cost: Number(l.supplier_cost) || 0, paid_amount: Number(l.paid_amount) || 0 })),
      linked_expenses: linkedExp.map((e) => ({ amount: Number(e.amount) || 0, payment_status: e.payment_status as never })),
      customer_payments_total: cashIn / fxRate(o.currency),
    });
    return {
      order_no: o.order_no,
      customer_name: o.customer_name,
      currency: o.currency,
      net_profit: profit.net_profit,
      net_profit_pct: profit.net_profit_pct,
      net_profit_usd: profit.net_profit * fxRate(o.currency),
    };
  }).sort((a, b) => b.net_profit_usd - a.net_profit_usd).slice(0, 5);

  /* ── Risk flags ───────────────────────────────────────────────── */
  const risks: string[] = [];
  if (runwayDays !== null && runwayDays < 60) risks.push(`Runway is ${runwayDays} days — below the 60-day safety threshold.`);
  if (collectionRatio < 50 && revenueUsd > 0) risks.push(`Collection ratio is ${collectionRatio.toFixed(0)}% — under half of recognised revenue is in the bank.`);
  if (customerConcentration > 40) risks.push(`Customer concentration: ${customerConcentration.toFixed(0)}% of revenue from a single buyer (${topCustomerRows[0]?.name}).`);
  if (supplierConcentration > 40) risks.push(`Supplier exposure: ${supplierConcentration.toFixed(0)}% of payables owed to a single supplier (${supplierExposureRows[0]?.name}).`);
  if (treasuryUsd < 0) risks.push("Treasury is negative — accounts overdrawn or settled into deficit.");
  if (netProfit < 0) risks.push("Net profit is negative across the period.");
  if (risks.length === 0) risks.push("No headline risks detected on the standard checks for this period.");

  /* ── Top tables ───────────────────────────────────────────────── */
  const topCustomerColumns: ReportColumn[] = [
    { key: "name",    label: "Customer" },
    { key: "revenue", label: "Revenue (USD eqv)", align: "right", format: "money", width: "150px" },
    { key: "share",   label: "Share",             align: "right", format: "percent", width: "80px" },
  ];
  const topCustomerTable: Array<Record<string, ReportRowValue>> = topCustomerRows.map((c) => ({
    name: c.name,
    revenue: c.revenue,
    share: revenueUsd > 0 ? (c.revenue / revenueUsd) * 100 : 0,
  }));

  const topSupplierColumns: ReportColumn[] = [
    { key: "name",        label: "Supplier" },
    { key: "outstanding", label: "Outstanding (USD eqv)", align: "right", format: "money", width: "180px" },
    { key: "share",       label: "Share of AP",            align: "right", format: "percent", width: "100px" },
  ];
  const topSupplierTable: Array<Record<string, ReportRowValue>> = supplierExposureRows.map((s) => ({
    name: s.name,
    outstanding: s.outstanding,
    share: ap > 0 ? (s.outstanding / ap) * 100 : 0,
  }));

  const topOrderColumns: ReportColumn[] = [
    { key: "order_no",       label: "Order",      width: "110px" },
    { key: "customer_name",  label: "Customer" },
    { key: "net_profit_usd", label: "Net Profit (USD eqv)", align: "right", format: "money", width: "160px" },
    { key: "net_profit_pct", label: "Margin %",   align: "right", format: "percent", width: "80px" },
  ];
  const topOrderTable: Array<Record<string, ReportRowValue>> = profitable.map((o) => ({
    order_no: o.order_no,
    customer_name: o.customer_name,
    net_profit_usd: o.net_profit_usd,
    net_profit_pct: o.net_profit_pct,
  }));

  /* ── Operational observation note (data-driven, short). */
  const obs = [
    `Revenue of ${fmtMoney(revenueUsd)} USD against ${fmtMoney(supplierCostUsd)} USD of supplier cost — gross margin ${grossMargin.toFixed(1)}%.`,
    cashInUsd > 0 ? `${fmtMoney(cashInUsd)} USD collected versus ${fmtMoney(cashOutUsd)} USD disbursed.` : `No customer payments recognised in this window.`,
    treasuryUsd > 0 ? `Treasury closes at ${fmtMoney(treasuryUsd)} USD across ${activeAccounts.length} active accounts.` : `Treasury is empty or negative — review bank balances.`,
    runwayDays !== null ? `At current run-rate, treasury covers ${runwayDays} days of net outflow.` : `Period is net cash-generative — no immediate runway concern.`,
  ].join(" ");

  const sections: ReportSection[] = [
    {
      kind: "kv",
      title: "Profitability",
      pairs: [
        { label: "Revenue",            value: fmtMoney(revenueUsd) },
        { label: "Supplier cost",      value: fmtMoney(supplierCostUsd) },
        { label: "Gross profit",       value: fmtMoney(grossProfit) },
        { label: "Gross margin",       value: `${grossMargin.toFixed(1)}%` },
        { label: "Operating expenses", value: fmtMoney(expensesUsd) },
        { label: "Tax refund",         value: fmtMoney(taxRefundUsd) },
        { label: "Financial charges",  value: fmtMoney(financialChargesUsd) },
        { label: "Net profit",         value: fmtMoney(netProfit) },
        { label: "Net margin",         value: `${netMargin.toFixed(1)}%` },
      ],
    },
    {
      kind: "kv",
      title: "Liquidity",
      pairs: [
        { label: "Cash in",                  value: fmtMoney(cashInUsd) },
        { label: "Cash out",                 value: fmtMoney(cashOutUsd) },
        { label: "Accounts receivable",      value: fmtMoney(ar) },
        { label: "Accounts payable",         value: fmtMoney(ap) },
        { label: "Treasury",                 value: fmtMoney(treasuryUsd) },
        { label: "Runway",                   value: runwayDays === null ? "Net cash-generative" : `${runwayDays} days` },
        { label: "Collection ratio",         value: `${collectionRatio.toFixed(0)}%` },
        { label: "Top supplier exposure",    value: `${supplierConcentration.toFixed(0)}% of AP` },
      ],
    },
    { kind: "table", title: "Top Customers (period)",     columns: topCustomerColumns, rows: topCustomerTable, empty_state: "No customer revenue in window." },
    { kind: "table", title: "Top Supplier Exposure",      columns: topSupplierColumns, rows: topSupplierTable, empty_state: "No open supplier balances." },
    { kind: "table", title: "Top Profitable Orders",      columns: topOrderColumns,    rows: topOrderTable,    empty_state: "No orders in window." },
    {
      kind: "note",
      title: "Key risks",
      body: risks.map((r, i) => `${i + 1}. ${r}`).join("  "),
    },
    {
      kind: "note",
      title: "Operational observations",
      body: obs,
    },
    {
      kind: "note",
      title: "Management notes",
      body: "—  (use this space for the operator's hand-written annotation when the document is distributed for board review)",
    },
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
      { label: `Revenue (${REPORTING_CURRENCY})`,    value: revenueUsd,  format: "money", tone: "positive" },
      { label: `Net Profit (${REPORTING_CURRENCY})`, value: netProfit,   format: "money", tone: netProfit >= 0 ? "positive" : "negative" },
      { label: `Treasury (${REPORTING_CURRENCY})`,   value: treasuryUsd, format: "money", tone: treasuryUsd >= 0 ? "positive" : "negative" },
      { label: "Runway",                              value: runwayDays === null ? "—" : `${runwayDays} d`, format: "text", tone: runwayDays !== null && runwayDays < 60 ? "warning" : "neutral" },
    ],
    sections,
    totals: [
      { label: "Net Profit (period, USD eqv)", value: netProfit, format: "money", emphasized: true },
    ],
    internal_warning: "EXECUTIVE — DO NOT DISTRIBUTE",
    row_count: orders.length + activeAccounts.length,
    total_amount: netProfit,
  };
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysBetween(fromIso: string, toIso: string): number {
  const f = new Date(fromIso).getTime();
  const t = new Date(toIso).getTime();
  return Math.max(0, Math.floor((t - f) / 86_400_000) + 1);
}

function groupBy<T, K extends string | number | symbol>(arr: T[], key: (x: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const x of arr) {
    const k = key(x);
    const cur = out.get(k);
    if (cur) cur.push(x);
    else out.set(k, [x]);
  }
  return out;
}
