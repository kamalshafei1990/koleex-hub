import "server-only";

/* ===========================================================================
   Customer Account Statement — EXTERNAL report.

   HARD VISIBILITY RULES:
     ❌ NEVER expose profit, margin, supplier cost, expense breakdowns,
        bank account numbers, reconciliation state, intelligence
        signals, approval history, internal notes, or any other
        operator-only field.
     ✅ Show only: invoiced totals per order, payments received, running
        balance, currency, dates, public references.

   Movements list = (order debits + customer payment credits) ordered by
   date, with a running balance per row. Opening balance is computed
   from all activity prior to the period; closing balance equals
   opening + net activity in the period.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  ReportBuildContext,
  ReportPayload,
  ReportSection,
  ReportRowValue,
  ReportColumn,
} from "../types";
import {
  generateReportNo,
  loadCustomerHeader,
  loadTenant,
  normalisePeriod,
  sumNumeric,
} from "../shared";

interface OrderRow {
  id: string;
  order_no: string;
  customer_id: string | null;
  order_date: string;
  selling_price: number | string;
  currency: string;
}

interface PaymentRow {
  id: string;
  payment_date: string;
  amount: number | string;
  currency: string;
  reference_no: string | null;
  status: string;
  direction: string;
  party_id: string | null;
  party_type: string;
}

export async function buildCustomerStatement(ctx: ReportBuildContext): Promise<ReportPayload> {
  const customerId = ctx.filters.customer_id!;
  const period = normalisePeriod(ctx.filters.date_from, ctx.filters.date_to);

  const [tenant, customer, accountRes, ordersRes, paymentsRes] = await Promise.all([
    loadTenant(ctx.tenantId),
    loadCustomerHeader(ctx.tenantId, customerId),
    /* Phase R.2 — pull the per-customer finance account so we can
       show payment_terms + credit_status on the document header.
       Both columns are typed-safe on `FinanceCustomerAccount`. */
    supabaseServer
      .from("finance_customer_accounts")
      .select("payment_terms, default_currency, credit_status")
      .eq("tenant_id", ctx.tenantId)
      .eq("customer_id", customerId)
      .maybeSingle(),
    supabaseServer
      .from("finance_orders")
      .select("id, order_no, customer_id, order_date, selling_price, currency")
      .eq("tenant_id", ctx.tenantId)
      .eq("customer_id", customerId),
    supabaseServer
      .from("finance_payments")
      .select("id, payment_date, amount, currency, reference_no, status, direction, party_id, party_type")
      .eq("tenant_id", ctx.tenantId)
      .eq("party_type", "customer")
      .eq("party_id", customerId),
  ]);

  const account = (accountRes.data ?? null) as { payment_terms: string | null; default_currency: string | null; credit_status: string | null } | null;

  const orders = (ordersRes.data ?? []) as OrderRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];

  /* Pick the dominant currency. If the operator passed a currency
     filter we use that; otherwise pick the most-frequent currency
     across orders, defaulting to tenant currency. */
  const explicitCurrency = ctx.filters.currency;
  const currency = explicitCurrency ?? pickCurrency(orders, payments) ?? tenant.currency;

  /* Constrain to the chosen currency so the running balance is
     coherent. Customers with multi-currency activity need separate
     statements per currency — that's also the standard banking
     convention. */
  const ordersCur = orders.filter((o) => o.currency === currency);
  const paymentsCur = payments.filter((p) => p.currency === currency && p.status === "completed");

  /* Build the movements ledger. Orders = debit; payments = credit. */
  type Movement = { date: string; ref: string; description: string; debit: number; credit: number };
  const all: Movement[] = [];
  for (const o of ordersCur) {
    all.push({
      date: o.order_date,
      ref: o.order_no,
      description: `Order ${o.order_no}`,
      debit: Number(o.selling_price) || 0,
      credit: 0,
    });
  }
  for (const p of paymentsCur) {
    all.push({
      date: p.payment_date,
      ref: p.reference_no ?? "",
      description: p.reference_no ? `Payment received — ref ${p.reference_no}` : "Payment received",
      debit: 0,
      credit: Number(p.amount) || 0,
    });
  }
  all.sort((a, b) => a.date.localeCompare(b.date));

  const inPeriod = all.filter((m) => m.date >= period.from && m.date <= period.to);
  const before = all.filter((m) => m.date < period.from);

  const openingBalance = before.reduce((s, m) => s + m.debit - m.credit, 0);

  let running = openingBalance;
  const movementRows: Array<Record<string, ReportRowValue>> = [];
  /* Opening balance row sits at the top of the table so the reader
     sees where the period started. */
  movementRows.push({
    date: period.from,
    ref: "",
    description: "Opening balance",
    debit: null,
    credit: null,
    balance: openingBalance,
  });
  for (const m of inPeriod) {
    running += m.debit - m.credit;
    movementRows.push({
      date: m.date,
      ref: m.ref,
      description: m.description,
      debit: m.debit > 0 ? m.debit : null,
      credit: m.credit > 0 ? m.credit : null,
      balance: running,
    });
  }
  const closingBalance = running;

  const invoiced = sumNumeric(inPeriod, "debit");
  const received = sumNumeric(inPeriod, "credit");

  const columns: ReportColumn[] = [
    { key: "date", label: "Date", format: "date", width: "90px" },
    { key: "ref", label: "Reference", width: "110px" },
    { key: "description", label: "Description" },
    { key: "debit", label: "Debit", align: "right", format: "money", width: "110px" },
    { key: "credit", label: "Credit", align: "right", format: "money", width: "110px" },
    { key: "balance", label: "Balance", align: "right", format: "money", width: "120px" },
  ];

  /* Phase R — aging buckets for the outstanding invoice schedule.
     Uses FIFO allocation: payments consume the oldest open order
     first. Whatever's left on each order at the end is bucketed by
     (today - order_date) days. Standard AR aging convention. */
  const todayMs = Date.now();
  const sortedOrders = [...ordersCur].sort((a, b) => a.order_date.localeCompare(b.order_date));
  const sortedPaymentsAll = [...payments]
    .filter((p) => p.currency === currency && p.status === "completed")
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date));
  let paymentPool = sortedPaymentsAll.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const aging = { current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0 };
  for (const o of sortedOrders) {
    const due = Number(o.selling_price) || 0;
    const consumed = Math.min(due, paymentPool);
    paymentPool -= consumed;
    const remainder = due - consumed;
    if (remainder <= 0.01) continue;
    const ageDays = Math.floor((todayMs - new Date(o.order_date).getTime()) / 86_400_000);
    if (ageDays <= 30) aging.current += remainder;
    else if (ageDays <= 60) aging.b30 += remainder;
    else if (ageDays <= 90) aging.b60 += remainder;
    else if (ageDays <= 180) aging.b90 += remainder;
    else aging.b90plus += remainder;
  }
  const overdue = aging.b30 + aging.b60 + aging.b90 + aging.b90plus;

  const agingColumns: ReportColumn[] = [
    { key: "bucket", label: "Bucket" },
    { key: "range",  label: "Days outstanding", width: "140px" },
    { key: "amount", label: "Balance", align: "right", format: "money", width: "140px" },
  ];
  const agingRows: Array<Record<string, ReportRowValue>> = [
    { bucket: "Current",   range: "0 – 30 days",   amount: aging.current },
    { bucket: "31 – 60",   range: "31 – 60 days",  amount: aging.b30 },
    { bucket: "61 – 90",   range: "61 – 90 days",  amount: aging.b60 },
    { bucket: "91 – 180",  range: "91 – 180 days", amount: aging.b90 },
    { bucket: "Over 180",  range: "> 180 days",    amount: aging.b90plus },
  ];

  /* Phase R.2 — contract-context block. The payment_terms come from
     the operator's per-customer finance account configuration; if no
     terms were set we omit the row rather than make one up. */
  const contextPairs: Array<{ label: string; value: string }> = [];
  if (account?.payment_terms) contextPairs.push({ label: "Payment Terms", value: account.payment_terms });
  contextPairs.push({ label: "Statement Period", value: `${period.from}  to  ${period.to}` });
  contextPairs.push({ label: "Currency", value: currency });

  const sections: ReportSection[] = [
    {
      kind: "kv",
      title: "Statement Context",
      pairs: contextPairs,
    },
    {
      kind: "table",
      title: "Account Activity",
      columns,
      rows: movementRows,
      empty_state: "No activity in the selected period.",
    },
    {
      kind: "table",
      title: "Outstanding by Age",
      columns: agingColumns,
      rows: agingRows,
      empty_state: "No outstanding balance.",
    },
  ];

  return {
    meta: {
      report_type: "customer_statement",
      visibility: "external",
      title: "Customer Account Statement",
      subtitle: customer?.name ?? "Customer",
      generated_at: new Date().toISOString(),
      generated_by_name: ctx.generatedByName,
      period,
      currency,
      report_no: generateReportNo("KX-CS"),
      tenant_name: tenant.name,
      locale: "en-US",
    },
    recipient: customer
      ? {
          label: "Customer",
          name: customer.name,
          address: customer.address,
          contact: customer.contact,
          account_no: customer.id.slice(0, 8).toUpperCase(),
        }
      : undefined,
    summary: [
      { label: "Opening Balance", value: openingBalance, format: "money", tone: openingBalance > 0 ? "warning" : "neutral" },
      { label: "Invoiced", value: invoiced, format: "money", tone: "neutral" },
      { label: "Payments Received", value: received, format: "money", tone: "positive" },
      { label: "Overdue", value: overdue, format: "money", tone: overdue > 0 ? "warning" : "neutral" },
    ],
    sections,
    totals: [
      { label: "Closing Balance", value: closingBalance, format: "money" },
      { label: "Balance Due", value: Math.max(0, closingBalance), format: "money", emphasized: true },
    ],
    notes: [
      "Payment instructions — Please remit any outstanding balance by wire transfer to the bank details on file. For bank coordinates, contact our finance team or refer to your master agreement.",
      "Always quote the reference number shown against each item when paying so we can allocate the funds accurately.",
      "Items appear in date order. The running balance after each line is shown in the right-most column; this statement is settled when that final balance is zero.",
      "Statement reflects activity up to the period end date. Items posted afterwards will appear on the next statement.",
      "Please review and reconcile this statement against your records. Raise any discrepancy in writing within 14 days of receipt; in the absence of objection the statement is deemed accepted.",
    ],
    row_count: movementRows.length,
    total_amount: closingBalance,
  };
}

function pickCurrency(orders: OrderRow[], payments: PaymentRow[]): string | null {
  const counts = new Map<string, number>();
  for (const o of orders) counts.set(o.currency, (counts.get(o.currency) ?? 0) + 1);
  for (const p of payments) counts.set(p.currency, (counts.get(p.currency) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = -1;
  for (const [c, n] of counts) {
    if (n > bestCount) { best = c; bestCount = n; }
  }
  return best;
}
