import "server-only";

/* ===========================================================================
   Reconciliation Report — INTERNAL audit-style.

   Phase R.2 expansion. The report now answers three questions a real
   audit asks:
     1. State of the cash-movement ledger for the period
        (matched / partial / mismatch / disputed / unreconciled).
     2. State of the reconciliation engine itself
        (suggested / confirmed / rejected / expired / duplicate_risk
        candidate counts).
     3. Variance summary — magnitude of the unreconciled +
        partial/mismatch buckets.

   The detail table lists every movement with its matched payment
   (when any) so an auditor can re-trace by eye.
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
  related_payment_id: string | null;
}

interface CandidateRow {
  status: string;
  candidate_type: string;
  confidence_level: string;
}

interface PaymentLite {
  id: string;
  amount: number | string;
  reference_no: string | null;
  party_name: string | null;
}

interface BankLite {
  id: string;
  bank_name: string;
  account_name: string;
}

export async function buildReconciliationReport(ctx: ReportBuildContext): Promise<ReportPayload> {
  const period = normalisePeriod(ctx.filters.date_from, ctx.filters.date_to);
  const tenant = await loadTenant(ctx.tenantId);
  const currency = ctx.filters.currency ?? tenant.currency;

  let movQ = supabaseServer
    .from("finance_cash_movements")
    .select(
      "id, bank_account_id, movement_date, direction, amount, currency, counterparty_name, " +
      "bank_reference, reconciliation_status, movement_type, related_payment_id",
    )
    .eq("tenant_id", ctx.tenantId)
    .gte("movement_date", period.from)
    .lte("movement_date", period.to)
    .order("movement_date", { ascending: false });
  if (ctx.filters.bank_account_id) movQ = movQ.eq("bank_account_id", ctx.filters.bank_account_id);

  const [movRes, candRes, bankRes] = await Promise.all([
    movQ,
    /* Engine-state view — every active candidate in the tenant. */
    supabaseServer
      .from("finance_reconciliation_candidates")
      .select("status, candidate_type, confidence_level")
      .eq("tenant_id", ctx.tenantId),
    supabaseServer
      .from("finance_bank_accounts")
      .select("id, bank_name, account_name")
      .eq("tenant_id", ctx.tenantId),
  ]);

  const rows = (movRes.data ?? []) as unknown as MovementRow[];
  const candidates = (candRes.data ?? []) as unknown as CandidateRow[];
  const banks = (bankRes.data ?? []) as unknown as BankLite[];
  const bankById = new Map(banks.map((b) => [b.id, b]));

  /* Pull matched payments in one batch so the detail table can show
     a real party + reference instead of just an id. */
  const matchedIds = Array.from(new Set(rows.map((r) => r.related_payment_id).filter((x): x is string => !!x)));
  let payMap = new Map<string, PaymentLite>();
  if (matchedIds.length > 0) {
    const { data: payData } = await supabaseServer
      .from("finance_payments")
      .select("id, amount, reference_no, party_name")
      .eq("tenant_id", ctx.tenantId)
      .in("id", matchedIds);
    payMap = new Map(((payData ?? []) as PaymentLite[]).map((p) => [p.id, p]));
  }

  /* ── Movement-level counts + variance ─────────────────────────── */
  const matched      = rows.filter((r) => r.reconciliation_status === "matched" || r.reconciliation_status === "verified");
  const unmatched    = rows.filter((r) => r.reconciliation_status === "unreconciled");
  const partial      = rows.filter((r) => r.reconciliation_status === "partially_matched");
  const mismatch     = rows.filter((r) => r.reconciliation_status === "mismatch");
  const disputed     = rows.filter((r) => r.reconciliation_status === "disputed");

  const matchedTotal     = sumNumeric(matched, "amount");
  const unmatchedTotal   = sumNumeric(unmatched, "amount");
  const partialTotal     = sumNumeric(partial, "amount");
  const mismatchTotal    = sumNumeric(mismatch, "amount");
  const disputedTotal    = sumNumeric(disputed, "amount");
  const variance         = unmatchedTotal + partialTotal + mismatchTotal + disputedTotal;

  /* ── Candidate-state counts ───────────────────────────────────── */
  const candByStatus = countBy(candidates, "status");
  const candByType   = countBy(candidates, "candidate_type");

  /* ── Detail table ─────────────────────────────────────────────── */
  const detailColumns: ReportColumn[] = [
    { key: "movement_date",  label: "Date",       format: "date", width: "92px" },
    { key: "bank",           label: "Bank Account",                width: "150px" },
    { key: "direction",      label: "Dir",                          width: "60px" },
    { key: "counterparty_name", label: "Counterparty" },
    { key: "bank_reference", label: "Bank Ref",                     width: "110px" },
    { key: "amount",         label: "Amount",      align: "right", format: "money", width: "110px" },
    { key: "matched_party",  label: "Matched Payment" },
    { key: "difference",     label: "Diff",        align: "right", format: "money", width: "80px" },
    { key: "reconciliation_status", label: "Status",                width: "110px" },
  ];

  const detailRows: Array<Record<string, ReportRowValue>> = rows.map((r) => {
    const bank = bankById.get(r.bank_account_id);
    const matchedPay = r.related_payment_id ? payMap.get(r.related_payment_id) : undefined;
    const movAmt = Number(r.amount) || 0;
    const payAmt = matchedPay ? Number(matchedPay.amount) || 0 : null;
    const diff = payAmt !== null ? movAmt - payAmt : null;
    return {
      movement_date: r.movement_date,
      bank: bank ? `${bank.bank_name} — ${bank.account_name}` : "—",
      direction: r.direction === "inflow" ? "IN" : "OUT",
      counterparty_name: r.counterparty_name ?? "—",
      bank_reference:    r.bank_reference ?? "—",
      amount:            movAmt,
      matched_party:     matchedPay ? `${matchedPay.party_name ?? "—"}${matchedPay.reference_no ? ` (ref ${matchedPay.reference_no})` : ""}` : "—",
      difference:        diff,
      reconciliation_status: r.reconciliation_status,
    };
  });

  const sections: ReportSection[] = [
    {
      kind: "kv",
      title: "Engine Candidate State",
      pairs: [
        { label: "Suggested",       value: String(candByStatus.suggested ?? 0) },
        { label: "Confirmed",       value: String(candByStatus.confirmed ?? 0) },
        { label: "Rejected",        value: String(candByStatus.rejected ?? 0) },
        { label: "Expired",         value: String(candByStatus.expired ?? 0) },
        { label: "Duplicate Risk",  value: String(candByType.duplicate_risk ?? 0) },
      ],
    },
    {
      kind: "kv",
      title: "Movement Totals (this period)",
      pairs: [
        { label: "Matched",       value: fmtMoney(matchedTotal) },
        { label: "Partial",       value: fmtMoney(partialTotal) },
        { label: "Mismatch",      value: fmtMoney(mismatchTotal) },
        { label: "Disputed",      value: fmtMoney(disputedTotal) },
        { label: "Unreconciled",  value: fmtMoney(unmatchedTotal) },
        { label: "Variance",      value: fmtMoney(variance) },
      ],
    },
    {
      kind: "table",
      title: `Movement Detail — ${period.from} → ${period.to}`,
      columns: detailColumns,
      rows: detailRows,
      empty_state: "No cash movements in this window.",
    },
    {
      kind: "note",
      title: "Audit note",
      body:
        "Variance represents the absolute total of movements that are not yet matched, partially matched, mismatched, or disputed. " +
        "A reconciliation is considered clean when this number is zero. Items in 'partial' or 'mismatch' require operator intervention; " +
        "items in 'disputed' should be triaged with the counterparty before re-classification.",
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
      { label: "Matched",       value: matched.length,    format: "count", tone: "positive", hint: fmtMoney(matchedTotal) },
      { label: "Unreconciled",  value: unmatched.length,  format: "count", tone: "warning",  hint: fmtMoney(unmatchedTotal) },
      { label: "Mismatch/Partial", value: partial.length + mismatch.length, format: "count", tone: "warning", hint: fmtMoney(partialTotal + mismatchTotal) },
      { label: "Variance",      value: variance,          format: "money", tone: variance > 0 ? "warning" : "positive" },
    ],
    sections,
    totals: [
      { label: "Total Movements", value: rows.length, format: "count" },
      { label: "Unmatched Variance", value: variance, format: "money", emphasized: true },
    ],
    internal_warning: "INTERNAL — NOT FOR DISTRIBUTION",
    row_count: rows.length,
    total_amount: variance,
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

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
