import "server-only";

/* ===========================================================================
   VAT return — INTERNAL · the figures for the period's filing.

   Everything comes from account 2200 (Taxes Payable) in the ledger:
     output tax   — what issued invoices charged            (credits)
     input tax    — what vendor bills and expenses carried  (debits)
     settlements  — payments to / refunds from the authority
   Net payable = output − input. Months are listed so a quarterly filing
   can be split; a reversal counts against its original's kind.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ReportBuildContext, ReportColumn, ReportPayload, ReportRowValue } from "../types";
import { generateReportNo, loadTenant, normalisePeriod } from "../shared";

interface VatRow { month: string; kind: "output" | "input" | "settlement" | "other"; amount_base: number | string; entries: number }

export async function buildVatReturn(ctx: ReportBuildContext): Promise<ReportPayload> {
  const period = normalisePeriod(ctx.filters.date_from, ctx.filters.date_to);
  const tenant = await loadTenant(ctx.tenantId);
  const { data, error } = await supabaseServer.rpc("fn_accounting_vat", { p_tenant_id: ctx.tenantId, p_from: period.from, p_to: period.to });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as VatRow[];

  const byMonth = new Map<string, { output: number; input: number; settlement: number; other: number; entries: number }>();
  const tot = { output: 0, input: 0, settlement: 0, other: 0 };
  for (const r of rows) {
    const m = byMonth.get(r.month) ?? { output: 0, input: 0, settlement: 0, other: 0, entries: 0 };
    const v = Number(r.amount_base) || 0;
    m[r.kind] += v;
    m.entries += r.entries;
    tot[r.kind] += v;
    byMonth.set(r.month, m);
  }
  const net = +(tot.output - tot.input).toFixed(2);

  const columns: ReportColumn[] = [
    { key: "month",   label: "Month", width: "110px" },
    { key: "output",  label: "Output tax", align: "right", format: "money", width: "130px" },
    { key: "input",   label: "Input tax",  align: "right", format: "money", width: "130px" },
    { key: "net",     label: "Net",        align: "right", format: "money", width: "130px" },
    { key: "settlement", label: "Settled", align: "right", format: "money", width: "120px" },
    { key: "entries", label: "Entries",    align: "right", format: "count", width: "80px" },
  ];
  const tableRows: Array<Record<string, ReportRowValue>> = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({
      month: `${month.slice(5, 7)}/${month.slice(0, 4)}`,
      output: +m.output.toFixed(2), input: +m.input.toFixed(2), net: +(m.output - m.input).toFixed(2),
      settlement: +m.settlement.toFixed(2), entries: m.entries,
    }));

  return {
    meta: {
      report_type: "vat_return",
      visibility: "internal",
      title: "VAT Return",
      subtitle: `Account 2200 · ${period.from.split("-").reverse().join("/")} – ${period.to.split("-").reverse().join("/")} · ${tenant.currency}`,
      generated_at: new Date().toISOString(),
      generated_by_name: ctx.generatedByName,
      period,
      currency: tenant.currency,
      report_no: generateReportNo("KX-VAT"),
      tenant_name: tenant.name,
      locale: "en-US",
    },
    summary: [
      { label: "Output tax (sales)", value: +tot.output.toFixed(2), format: "money", tone: "neutral" },
      { label: "Input tax (purchases)", value: +tot.input.toFixed(2), format: "money", tone: "neutral" },
      { label: net >= 0 ? "Net payable" : "Net refundable", value: Math.abs(net), format: "money", tone: net >= 0 ? "warning" : "positive" },
      { label: "Settled in period", value: +tot.settlement.toFixed(2), format: "money", tone: "neutral" },
    ],
    sections: [
      { kind: "table", title: "By month", columns, rows: tableRows, empty_state: "No tax movements in this period." },
      ...(Math.abs(tot.other) >= 0.01
        ? [{ kind: "note" as const, title: "Unattributed", body: `Movements of ${tot.other.toFixed(2)} ${tenant.currency} on 2200 came from manual or opening entries and are not classified as output or input tax. Review them in the General Ledger before filing.` }]
        : []),
      { kind: "note", title: "Method", body: "Output tax is the credit side of 2200 from issued invoices; input tax is the debit side from vendor bills, expenses and goods receipts; settlements are payments and bank movements against the account. A voided document is counted against its own kind, so the figures agree with the ledger balance of 2200 for the period." },
    ],
    totals: [
      { label: "Output tax", value: +tot.output.toFixed(2), format: "money" },
      { label: "Input tax", value: +tot.input.toFixed(2), format: "money" },
      { label: "Net", value: net, format: "money", emphasized: true },
    ],
    internal_warning: "INTERNAL — figures for the tax filing; check before submission",
    row_count: tableRows.length,
  };
}
