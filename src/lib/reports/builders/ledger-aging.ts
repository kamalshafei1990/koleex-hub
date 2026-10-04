import "server-only";

/* ===========================================================================
   AR / AP aging from the ledger — INTERNAL.

   The operational aging (Statements → AR / AP) reads the invoice and bill
   tables. This report reads the control accounts, so it is the one to
   reconcile against the trial balance: its total IS the account balance.
   ========================================================================== */

import type { ReportBuildContext, ReportColumn, ReportPayload, ReportRowValue } from "../types";
import { generateReportNo, loadTenant } from "../shared";
import { buildLedgerAging, LEDGER_BUCKETS, type LedgerAgingSide } from "@/lib/accounting/ledger-aging";

function builder(side: LedgerAgingSide) {
  return async function build(ctx: ReportBuildContext): Promise<ReportPayload> {
    const tenant = await loadTenant(ctx.tenantId);
    const aging = await buildLedgerAging(ctx.tenantId, side, ctx.filters.date_to);
    const isAr = side === "ar";
    const title = isAr ? "Receivables Aging (Ledger)" : "Payables Aging (Ledger)";

    const columns: ReportColumn[] = [
      { key: "party", label: isAr ? "Customer" : "Supplier" },
      { key: "b0",    label: "0–30 days",  align: "right", format: "money", width: "110px" },
      { key: "b1",    label: "31–60",      align: "right", format: "money", width: "100px" },
      { key: "b2",    label: "61–90",      align: "right", format: "money", width: "100px" },
      { key: "b3",    label: "90+",        align: "right", format: "money", width: "100px" },
      { key: "open",  label: "Open",       align: "right", format: "money", width: "120px" },
      { key: "unapplied", label: "Unapplied", align: "right", format: "money", width: "110px" },
      { key: "balance", label: "Balance",  align: "right", format: "money", width: "120px" },
    ];
    const rows: Array<Record<string, ReportRowValue>> = aging.parties.map((p) => ({
      party: p.party_name,
      b0: p.buckets["0-30"], b1: p.buckets["31-60"], b2: p.buckets["61-90"], b3: p.buckets["90+"],
      open: p.open, unapplied: -p.unapplied, balance: p.balance,
    }));
    const over60 = aging.totals.buckets["61-90"] + aging.totals.buckets["90+"];

    return {
      meta: {
        report_type: isAr ? "ar_aging_ledger" : "ap_aging_ledger",
        visibility: "internal",
        title,
        subtitle: `Account ${aging.account_code} · as of ${aging.as_of.split("-").reverse().join("/")} · ${aging.currency}`,
        generated_at: new Date().toISOString(),
        generated_by_name: ctx.generatedByName,
        currency: aging.currency,
        report_no: generateReportNo(isAr ? "KX-ARL" : "KX-APL"),
        tenant_name: tenant.name,
        locale: "en-US",
      },
      summary: [
        { label: "Control balance", value: aging.control_balance, format: "money", tone: "neutral" },
        { label: "Open items", value: aging.totals.open, format: "money", tone: "neutral" },
        { label: "Over 60 days", value: over60, format: "money", tone: over60 > 0 ? "warning" : "positive" },
        { label: "Unapplied", value: aging.totals.unapplied, format: "money", tone: aging.totals.unapplied > 0 ? "warning" : "neutral" },
        { label: "Parties", value: aging.parties.length, format: "count", tone: "neutral" },
      ],
      sections: [
        { kind: "table", title: "By party", columns, rows, empty_state: "No open items in the ledger." },
        { kind: "note", title: "Method", body: `Charges are ${isAr ? "debits" : "credits"} on ${aging.account_code}; settlements are cleared against the oldest charge first. What remains is aged by the charge's entry date. Unapplied settlements are shown negative so every party sums to its ledger balance, and the report total equals the account balance in the trial balance.` },
      ],
      totals: LEDGER_BUCKETS.map((b) => ({ label: b === "0-30" ? "0–30 days" : b, value: aging.totals.buckets[b], format: "money" as const }))
        .concat([{ label: "Total balance", value: aging.totals.balance, format: "money" as const, emphasized: true } as { label: string; value: number; format: "money"; emphasized: boolean }]),
      internal_warning: "INTERNAL — ledger control report",
      row_count: rows.length,
    };
  };
}

export const buildArAgingLedger = builder("ar");
export const buildApAgingLedger = builder("ap");
