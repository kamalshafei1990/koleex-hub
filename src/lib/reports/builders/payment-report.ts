import "server-only";

/* ===========================================================================
   Payment Activity Report — INTERNAL.
   Operator-only view of every payment in a window. Includes internal
   fields the external statements deliberately omit:
     · party type/name
     · payment method
     · status (incl. failed, bounced)
     · reconciliation status
     · linked order id
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  ReportBuildContext,
  ReportPayload,
  ReportColumn,
  ReportRowValue,
  ReportSection,
} from "../types";
import {
  generateReportNo,
  loadTenant,
  normalisePeriod,
  sumNumeric,
} from "../shared";

interface PaymentRow {
  id: string;
  direction: string;
  party_type: string;
  party_name: string | null;
  amount: number | string;
  currency: string;
  payment_date: string;
  payment_method: string | null;
  reference_no: string | null;
  status: string;
  reconciliation_status: string | null;
  linked_order_id: string | null;
}

export async function buildPaymentReport(ctx: ReportBuildContext): Promise<ReportPayload> {
  const period = normalisePeriod(ctx.filters.date_from, ctx.filters.date_to);
  const tenant = await loadTenant(ctx.tenantId);
  const currency = ctx.filters.currency ?? tenant.currency;

  let q = supabaseServer
    .from("finance_payments")
    .select("id, direction, party_type, party_name, amount, currency, payment_date, payment_method, reference_no, status, reconciliation_status, linked_order_id")
    .eq("tenant_id", ctx.tenantId)
    .gte("payment_date", period.from)
    .lte("payment_date", period.to)
    .order("payment_date", { ascending: false });
  if (ctx.filters.currency) q = q.eq("currency", ctx.filters.currency);

  const { data } = await q;
  const rows = (data ?? []) as PaymentRow[];

  const inflows = rows.filter((p) => p.direction === "in");
  const outflows = rows.filter((p) => p.direction === "out");
  const inflowTotal = sumNumeric(inflows, "amount");
  const outflowTotal = sumNumeric(outflows, "amount");
  const net = inflowTotal - outflowTotal;

  const columns: ReportColumn[] = [
    { key: "payment_date", label: "Date", format: "date", width: "92px" },
    { key: "direction", label: "Direction", width: "70px" },
    { key: "party_type", label: "Party", width: "80px" },
    { key: "party_name", label: "Name" },
    { key: "payment_method", label: "Method", width: "100px" },
    { key: "reference_no", label: "Reference", width: "110px" },
    { key: "amount", label: "Amount", align: "right", format: "money", width: "110px" },
    { key: "currency", label: "Ccy", width: "44px" },
    { key: "status", label: "Status", width: "80px" },
    { key: "reconciliation_status", label: "Recon", width: "82px" },
  ];

  const tableRows: Array<Record<string, ReportRowValue>> = rows.map((p) => ({
    payment_date: p.payment_date,
    direction: p.direction === "in" ? "IN" : "OUT",
    party_type: p.party_type,
    party_name: p.party_name ?? "",
    payment_method: p.payment_method ?? "",
    reference_no: p.reference_no ?? "",
    amount: Number(p.amount) || 0,
    currency: p.currency,
    status: p.status,
    reconciliation_status: p.reconciliation_status ?? "—",
  }));

  const sections: ReportSection[] = [
    {
      kind: "table",
      title: `Payments — ${period.from} → ${period.to}`,
      columns,
      rows: tableRows,
      empty_state: "No payments recorded in this window.",
    },
  ];

  return {
    meta: {
      report_type: "payment_report",
      visibility: "internal",
      title: "Payment Activity Report",
      generated_at: new Date().toISOString(),
      generated_by_name: ctx.generatedByName,
      period,
      currency,
      report_no: generateReportNo("KX-PAY"),
      tenant_name: tenant.name,
      locale: "en-US",
    },
    summary: [
      { label: "Total Inflow", value: inflowTotal, format: "money", tone: "positive" },
      { label: "Total Outflow", value: outflowTotal, format: "money", tone: "negative" },
      { label: "Net Cash Flow", value: net, format: "money", tone: net >= 0 ? "positive" : "negative" },
      { label: "Transactions", value: rows.length, format: "count", tone: "neutral" },
    ],
    sections,
    internal_warning: "INTERNAL — NOT FOR DISTRIBUTION",
    row_count: rows.length,
    total_amount: net,
  };
}
