import "server-only";

/* ===========================================================================
   Payment Activity Report — INTERNAL.

   Phase R.2 deepening: same data source as before (no math changes),
   but the document now lays out:
     · headline summary: total inflow / outflow / net
     · status breakdown:    completed / pending / failed / cancelled
     · reconciliation roll-up: matched / unreconciled / partial / mismatch
     · two ledger tables: "Money In" + "Money Out"
       columns: date, party, method, reference, amount, currency, status,
                approval, reconciliation, evidence

   Operational view — everything the operator needs to triage in one
   sweep. Marked internal_warning so the renderer paints the magenta
   classification line.
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
  approval_status: string | null;
  linked_order_id: string | null;
  /* Phase 2.3 evidence columns surfaced for the report. */
  has_payment_evidence: boolean | null;
  payment_evidence_count: number | null;
  primary_payment_evidence_url: string | null;
}

const COLUMNS: ReportColumn[] = [
  { key: "payment_date",        label: "Date",       format: "date", width: "92px" },
  { key: "party_name",          label: "Party" },
  { key: "payment_method",      label: "Method",     width: "100px" },
  { key: "reference_no",        label: "Reference",  width: "110px" },
  { key: "amount",              label: "Amount",     align: "right", format: "money", width: "110px" },
  { key: "currency",            label: "Ccy",        width: "44px" },
  { key: "status",              label: "Status",     width: "80px" },
  { key: "approval_status",     label: "Approval",   width: "90px" },
  { key: "reconciliation_status", label: "Recon",    width: "82px" },
  { key: "evidence",            label: "Evidence",   width: "78px" },
];

export async function buildPaymentReport(ctx: ReportBuildContext): Promise<ReportPayload> {
  const period = normalisePeriod(ctx.filters.date_from, ctx.filters.date_to);
  const tenant = await loadTenant(ctx.tenantId);
  const currency = ctx.filters.currency ?? tenant.currency;

  let q = supabaseServer
    .from("finance_payments")
    .select(
      "id, direction, party_type, party_name, amount, currency, payment_date, payment_method, " +
      "reference_no, status, reconciliation_status, approval_status, linked_order_id, " +
      "has_payment_evidence, payment_evidence_count, primary_payment_evidence_url",
    )
    .eq("tenant_id", ctx.tenantId)
    .gte("payment_date", period.from)
    .lte("payment_date", period.to)
    .order("payment_date", { ascending: false });
  if (ctx.filters.currency) q = q.eq("currency", ctx.filters.currency);

  const { data } = await q;
  const rows = (data ?? []) as unknown as PaymentRow[];

  /* ── Aggregates ────────────────────────────────────────────────── */

  const inflows  = rows.filter((p) => p.direction === "in");
  const outflows = rows.filter((p) => p.direction === "out");
  const inflowTotal  = sumNumeric(inflows, "amount");
  const outflowTotal = sumNumeric(outflows, "amount");
  const net = inflowTotal - outflowTotal;

  const byStatus = countBy(rows, "status");
  const byRecon  = countBy(rows, "reconciliation_status");

  /* ── Table rows ────────────────────────────────────────────────── */

  const rowFor = (p: PaymentRow): Record<string, ReportRowValue> => ({
    payment_date: p.payment_date,
    party_name:   p.party_name ?? "",
    payment_method: p.payment_method ?? "—",
    reference_no: p.reference_no ?? "—",
    amount:       Number(p.amount) || 0,
    currency:     p.currency,
    status:       p.status,
    approval_status: p.approval_status ?? "—",
    reconciliation_status: p.reconciliation_status ?? "—",
    evidence:     p.has_payment_evidence ? "Attached" : (p.payment_evidence_count && p.payment_evidence_count > 0 ? "Attached" : "Missing"),
  });

  const sections: ReportSection[] = [
    /* Status + reconciliation breakdowns presented as kv blocks —
       compact at the top, no card padding, just labels + counts. */
    {
      kind: "kv",
      title: "Status Breakdown",
      pairs: [
        { label: "Completed", value: String(byStatus.completed ?? 0) },
        { label: "Pending",   value: String(byStatus.pending ?? 0) },
        { label: "Failed",    value: String(byStatus.failed ?? 0) },
        { label: "Cancelled", value: String(byStatus.cancelled ?? 0) },
        { label: "Bounced",   value: String(byStatus.bounced ?? 0) },
      ],
    },
    {
      kind: "kv",
      title: "Reconciliation",
      pairs: [
        { label: "Matched",       value: String(byRecon.matched ?? 0) },
        { label: "Verified",      value: String(byRecon.verified ?? 0) },
        { label: "Partial",       value: String(byRecon.partially_matched ?? 0) },
        { label: "Mismatch",      value: String(byRecon.mismatch ?? 0) },
        { label: "Disputed",      value: String(byRecon.disputed ?? 0) },
        { label: "Unreconciled",  value: String(byRecon.unreconciled ?? 0) },
      ],
    },
    {
      kind: "table",
      title: `Money In — ${period.from} → ${period.to}`,
      columns: COLUMNS,
      rows: inflows.map(rowFor),
      empty_state: "No inflows in this window.",
    },
    {
      kind: "table",
      title: `Money Out — ${period.from} → ${period.to}`,
      columns: COLUMNS,
      rows: outflows.map(rowFor),
      empty_state: "No outflows in this window.",
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
      { label: "Total Inflow",  value: inflowTotal,  format: "money", tone: "positive" },
      { label: "Total Outflow", value: outflowTotal, format: "money", tone: "negative" },
      { label: "Net Cash Flow", value: net,          format: "money", tone: net >= 0 ? "positive" : "negative" },
      { label: "Transactions",  value: rows.length,  format: "count", tone: "neutral" },
    ],
    sections,
    totals: [
      { label: "Inflows",  value: inflowTotal,  format: "money" },
      { label: "Outflows", value: outflowTotal, format: "money" },
      { label: "Net Position", value: net, format: "money", emphasized: true },
    ],
    notes: [
      "All amounts are shown in their native currency. The summary above is per-currency only when a currency filter is applied.",
      "Reconciliation status reflects state at report generation; rerun after a reconciliation rescan to refresh.",
    ],
    internal_warning: "INTERNAL — NOT FOR DISTRIBUTION",
    row_count: rows.length,
    total_amount: net,
  };
}

function countBy<T>(rows: ReadonlyArray<T>, key: keyof T & string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = (r as Record<string, unknown>)[key];
    const k = String((v ?? "—") as string);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
