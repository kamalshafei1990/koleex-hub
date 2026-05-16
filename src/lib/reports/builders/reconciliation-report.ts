import "server-only";

/* ===========================================================================
   Reconciliation Report — INTERNAL.
   Reconciled vs unreconciled cash movements in a window. Optionally
   scoped to a single bank account. Exposes:
     · per-movement reconciliation_status
     · matched_cash_movement_id linkage
     · which payments are still floating
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  ReportBuildContext,
  ReportColumn,
  ReportPayload,
  ReportRowValue,
  ReportSection,
} from "../types";
import { generateReportNo, loadTenant, normalisePeriod, sumNumeric } from "../shared";

interface MovementRow {
  id: string;
  bank_account_id: string;
  movement_date: string;
  direction: string;
  amount: number | string;
  currency: string;
  counterparty_name: string | null;
  bank_reference: string | null;
  reconciliation_status: string;
  movement_type: string;
}

export async function buildReconciliationReport(ctx: ReportBuildContext): Promise<ReportPayload> {
  const period = normalisePeriod(ctx.filters.date_from, ctx.filters.date_to);
  const tenant = await loadTenant(ctx.tenantId);
  const currency = ctx.filters.currency ?? tenant.currency;

  let q = supabaseServer
    .from("finance_cash_movements")
    .select("id, bank_account_id, movement_date, direction, amount, currency, counterparty_name, bank_reference, reconciliation_status, movement_type")
    .eq("tenant_id", ctx.tenantId)
    .gte("movement_date", period.from)
    .lte("movement_date", period.to)
    .order("movement_date", { ascending: false });
  if (ctx.filters.bank_account_id) q = q.eq("bank_account_id", ctx.filters.bank_account_id);

  const { data } = await q;
  const rows = (data ?? []) as MovementRow[];

  const matched = rows.filter((r) => r.reconciliation_status === "matched" || r.reconciliation_status === "verified");
  const unmatched = rows.filter((r) => r.reconciliation_status === "unreconciled");
  const partial = rows.filter((r) => r.reconciliation_status === "partially_matched" || r.reconciliation_status === "mismatch");

  const matchedTotal = sumNumeric(matched, "amount");
  const unmatchedTotal = sumNumeric(unmatched, "amount");
  const partialTotal = sumNumeric(partial, "amount");

  const columns: ReportColumn[] = [
    { key: "movement_date", label: "Date", format: "date", width: "92px" },
    { key: "direction", label: "Dir", width: "60px" },
    { key: "counterparty_name", label: "Counterparty" },
    { key: "bank_reference", label: "Bank Ref", width: "120px" },
    { key: "amount", label: "Amount", align: "right", format: "money", width: "110px" },
    { key: "currency", label: "Ccy", width: "44px" },
    { key: "reconciliation_status", label: "Status", width: "110px" },
  ];

  const tableRows: Array<Record<string, ReportRowValue>> = rows.map((r) => ({
    movement_date: r.movement_date,
    direction: r.direction === "inflow" ? "IN" : "OUT",
    counterparty_name: r.counterparty_name ?? "—",
    bank_reference: r.bank_reference ?? "—",
    amount: Number(r.amount) || 0,
    currency: r.currency,
    reconciliation_status: r.reconciliation_status,
  }));

  const sections: ReportSection[] = [
    {
      kind: "table",
      title: `Cash Movements — ${period.from} → ${period.to}`,
      columns,
      rows: tableRows,
      empty_state: "No cash movements in this window.",
    },
  ];

  return {
    meta: {
      report_type: "reconciliation_report",
      visibility: "internal",
      title: "Reconciliation Report",
      generated_at: new Date().toISOString(),
      generated_by_name: ctx.generatedByName,
      period,
      currency,
      report_no: generateReportNo("KX-REC"),
      tenant_name: tenant.name,
      locale: "en-US",
    },
    summary: [
      { label: "Matched", value: matched.length, format: "count", tone: "positive", hint: formatMoney(matchedTotal) },
      { label: "Unreconciled", value: unmatched.length, format: "count", tone: "warning", hint: formatMoney(unmatchedTotal) },
      { label: "Partial / Mismatch", value: partial.length, format: "count", tone: "warning", hint: formatMoney(partialTotal) },
      { label: "Total Movements", value: rows.length, format: "count", tone: "neutral" },
    ],
    sections,
    internal_warning: "INTERNAL — NOT FOR DISTRIBUTION",
    row_count: rows.length,
    total_amount: unmatchedTotal,
  };
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
