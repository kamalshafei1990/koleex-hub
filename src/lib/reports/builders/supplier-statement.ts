import "server-only";

/* ===========================================================================
   Supplier Account Statement — EXTERNAL report.

   HARD VISIBILITY RULES:
     ❌ NEVER expose order-level margin, our selling price, profit,
        downstream customer info, intelligence signals, internal
        approval history, bank-account numbers, FX adapter state.
     ✅ Show only: supplier-cost amounts per linked order line, our
        payments to the supplier, running balance, currency, dates,
        public references.

   Movements list = (supplier-cost debits + supplier-payment credits)
   ordered by date with a running balance. Same shape as the customer
   statement so customers and suppliers receive visually identical
   documents.
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
  loadSupplierHeader,
  loadTenant,
  normalisePeriod,
  sumNumeric,
} from "../shared";

interface SupplierLineRow {
  id: string;
  order_id: string;
  supplier_id: string | null;
  supplier_cost: number | string;
  currency: string;
  created_at: string;
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

export async function buildSupplierStatement(ctx: ReportBuildContext): Promise<ReportPayload> {
  const supplierId = ctx.filters.supplier_id!;
  const period = normalisePeriod(ctx.filters.date_from, ctx.filters.date_to);

  const [tenant, supplier, linesRes, paymentsRes] = await Promise.all([
    loadTenant(ctx.tenantId),
    loadSupplierHeader(ctx.tenantId, supplierId),
    supabaseServer
      .from("finance_order_suppliers")
      .select("id, order_id, supplier_id, supplier_cost, currency, created_at")
      .eq("tenant_id", ctx.tenantId)
      .eq("supplier_id", supplierId),
    supabaseServer
      .from("finance_payments")
      .select("id, payment_date, amount, currency, reference_no, status, direction, party_id, party_type")
      .eq("tenant_id", ctx.tenantId)
      .eq("party_type", "supplier")
      .eq("party_id", supplierId),
  ]);

  const lines = (linesRes.data ?? []) as SupplierLineRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];

  const explicitCurrency = ctx.filters.currency;
  const currency = explicitCurrency ?? pickCurrency(lines, payments) ?? tenant.currency;
  const linesCur = lines.filter((l) => l.currency === currency);
  const paymentsCur = payments.filter((p) => p.currency === currency && p.status === "completed");

  type Movement = { date: string; ref: string; description: string; debit: number; credit: number };
  const all: Movement[] = [];

  /* Pull order_no for each linked line in a single batch so the
     statement shows "Purchase against Order KX-2025-0014" instead of
     the internal UUID. Aggregating the ids first keeps it one round-
     trip total. */
  const orderIds = Array.from(new Set(linesCur.map((l) => l.order_id)));
  let orderNoMap = new Map<string, { order_no: string; date: string }>();
  if (orderIds.length > 0) {
    const { data: ordersData } = await supabaseServer
      .from("finance_orders")
      .select("id, order_no, order_date")
      .eq("tenant_id", ctx.tenantId)
      .in("id", orderIds);
    orderNoMap = new Map(
      ((ordersData ?? []) as Array<{ id: string; order_no: string; order_date: string }>).map((r) => [r.id, { order_no: r.order_no, date: r.order_date }]),
    );
  }

  for (const l of linesCur) {
    const ord = orderNoMap.get(l.order_id);
    const date = ord?.date ?? (l.created_at ?? "").slice(0, 10);
    const orderNo = ord?.order_no ?? l.order_id.slice(0, 8);
    all.push({
      date,
      ref: orderNo,
      description: `Purchase against Order ${orderNo}`,
      debit: Number(l.supplier_cost) || 0,
      credit: 0,
    });
  }
  for (const p of paymentsCur) {
    all.push({
      date: p.payment_date,
      ref: p.reference_no ?? "",
      description: p.reference_no ? `Payment sent — ref ${p.reference_no}` : "Payment sent",
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

  const purchased = sumNumeric(inPeriod, "debit");
  const paid = sumNumeric(inPeriod, "credit");

  const columns: ReportColumn[] = [
    { key: "date", label: "Date", format: "date", width: "90px" },
    { key: "ref", label: "Reference", width: "110px" },
    { key: "description", label: "Description" },
    { key: "debit", label: "Purchases", align: "right", format: "money", width: "110px" },
    { key: "credit", label: "Payments", align: "right", format: "money", width: "110px" },
    { key: "balance", label: "Balance", align: "right", format: "money", width: "120px" },
  ];

  const sections: ReportSection[] = [
    {
      kind: "table",
      title: "Account Activity",
      columns,
      rows: movementRows,
      empty_state: "No activity in the selected period.",
    },
  ];

  return {
    meta: {
      report_type: "supplier_statement",
      visibility: "external",
      title: "Supplier Account Statement",
      subtitle: supplier?.name ?? "Supplier",
      generated_at: new Date().toISOString(),
      generated_by_name: ctx.generatedByName,
      period,
      currency,
      report_no: generateReportNo("KX-SS"),
      tenant_name: tenant.name,
      locale: "en-US",
    },
    recipient: supplier
      ? {
          label: "Supplier",
          name: supplier.name,
          address: supplier.address,
          contact: supplier.contact,
          account_no: supplier.id.slice(0, 8).toUpperCase(),
        }
      : undefined,
    summary: [
      { label: "Opening Balance", value: openingBalance, format: "money", tone: "neutral" },
      { label: "Purchases", value: purchased, format: "money", tone: "neutral" },
      { label: "Payments Made", value: paid, format: "money", tone: "positive" },
      { label: "Closing Balance", value: closingBalance, format: "money", tone: closingBalance > 0 ? "warning" : "positive" },
    ],
    sections,
    totals: [
      { label: "Amount Outstanding", value: Math.max(0, closingBalance), format: "money", emphasized: true },
    ],
    notes: [
      "Please confirm this statement against your records and raise any discrepancy within 14 days.",
    ],
    row_count: movementRows.length,
    total_amount: closingBalance,
  };
}

function pickCurrency(lines: SupplierLineRow[], payments: PaymentRow[]): string | null {
  const counts = new Map<string, number>();
  for (const l of lines) counts.set(l.currency, (counts.get(l.currency) ?? 0) + 1);
  for (const p of payments) counts.set(p.currency, (counts.get(p.currency) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = -1;
  for (const [c, n] of counts) {
    if (n > bestCount) { best = c; bestCount = n; }
  }
  return best;
}
