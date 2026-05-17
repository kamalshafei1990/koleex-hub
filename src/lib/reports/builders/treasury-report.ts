import "server-only";

/* ===========================================================================
   Treasury Position Report — INTERNAL · CFO-ready.

   Phase R.2 expansion. Layout:
     · headline summary: total liquidity (USD eqv), available, pending,
                         restricted
     · bank-account ledger: per-account balances + status + primary
                            indicator + last reconciliation
     · FX exposure table:   by currency — total balance, USD eqv, share
     · account concentration: top accounts by share of total liquidity
     · frozen / closed:     separate listing
     · recent cash movements summary (last 30 days)
     · treasury notes
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
import { fxRate, REPORTING_CURRENCY } from "@/lib/finance/fx";
import type { BankAccount, CashMovement } from "@/lib/finance/types";

export async function buildTreasuryReport(ctx: ReportBuildContext): Promise<ReportPayload> {
  const tenant = await loadTenant(ctx.tenantId);
  const period = ctx.filters.date_from && ctx.filters.date_to
    ? normalisePeriod(ctx.filters.date_from, ctx.filters.date_to)
    : undefined;

  const recentSince = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const [accountsRes, movementsRes] = await Promise.all([
    supabaseServer
      .from("finance_bank_accounts")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .order("is_primary", { ascending: false })
      .order("current_balance", { ascending: false }),
    supabaseServer
      .from("finance_cash_movements")
      .select("id, direction, amount, currency, movement_date")
      .eq("tenant_id", ctx.tenantId)
      .gte("movement_date", recentSince)
      .limit(2000),
  ]);

  const accounts = (accountsRes.data ?? []) as BankAccount[];
  const movements = (movementsRes.data ?? []) as Pick<CashMovement, "id" | "direction" | "amount" | "currency" | "movement_date">[];

  const active = accounts.filter((a) => a.status === "active");
  const frozen = accounts.filter((a) => a.status === "frozen" || a.status === "closed" || a.status === "archived");

  /* ── Total liquidity in reporting currency ─────────────────────── */
  let totalUsd = 0;
  let availableUsd = 0;
  let pendingUsd = 0;
  let restrictedUsd = 0;
  for (const a of active) {
    const r = fxRate(a.currency);
    totalUsd      += (Number(a.current_balance)    || 0) * r;
    availableUsd  += (Number(a.available_balance)  || 0) * r;
    pendingUsd    += (Number(a.pending_balance)    || 0) * r;
    restrictedUsd += (Number(a.restricted_balance) || 0) * r;
  }

  /* ── Account ledger ─────────────────────────────────────────── */
  const accountColumns: ReportColumn[] = [
    { key: "primary",         label: "",                                       width: "14px" },
    { key: "bank",            label: "Bank · Account" },
    { key: "currency",        label: "Ccy",                                    width: "44px" },
    { key: "current_balance",  label: "Current",     align: "right", format: "money", width: "120px" },
    { key: "available_balance",label: "Available",   align: "right", format: "money", width: "120px" },
    { key: "pending_balance",  label: "Pending",     align: "right", format: "money", width: "100px" },
    { key: "restricted_balance",label: "Restricted", align: "right", format: "money", width: "100px" },
    { key: "status",          label: "Status",                                 width: "76px" },
    { key: "last_reconciled_at", label: "Last Recon", format: "date",          width: "92px" },
  ];
  const accountRows = active.map((a) => ({
    primary:            a.is_primary ? "★" : "",
    bank:               `${a.bank_name} — ${a.account_name}`,
    currency:           a.currency,
    current_balance:    Number(a.current_balance) || 0,
    available_balance:  Number(a.available_balance) || 0,
    pending_balance:    Number(a.pending_balance) || 0,
    restricted_balance: Number(a.restricted_balance) || 0,
    status:             a.status,
    last_reconciled_at: a.last_reconciled_at ?? null,
  }));

  /* ── FX exposure by currency ──────────────────────────────────── */
  const byCurrency = new Map<string, { native: number; usd: number }>();
  for (const a of active) {
    const c = a.currency;
    const cur = byCurrency.get(c) ?? { native: 0, usd: 0 };
    const r = fxRate(c);
    cur.native += Number(a.current_balance) || 0;
    cur.usd    += (Number(a.current_balance) || 0) * r;
    byCurrency.set(c, cur);
  }
  const fxColumns: ReportColumn[] = [
    { key: "currency", label: "Ccy",                                       width: "70px" },
    { key: "rate",     label: "Rate (→USD)",   align: "right", format: "money", width: "120px" },
    { key: "native",   label: "Native Balance", align: "right", format: "money", width: "150px" },
    { key: "usd",      label: "USD eqv",       align: "right", format: "money", width: "150px" },
    { key: "share",    label: "Share",         align: "right", format: "percent", width: "70px" },
  ];
  const fxRows: Array<Record<string, ReportRowValue>> = Array.from(byCurrency.entries())
    .sort((a, b) => b[1].usd - a[1].usd)
    .map(([c, v]) => ({
      currency: c,
      rate:     fxRate(c),
      native:   v.native,
      usd:      v.usd,
      share:    totalUsd > 0 ? (v.usd / totalUsd) * 100 : 0,
    }));

  /* ── Account concentration ────────────────────────────────────── */
  const concentrationRows: Array<Record<string, ReportRowValue>> = active
    .map((a) => ({
      bank:  `${a.bank_name} — ${a.account_name}`,
      currency: a.currency,
      usd: (Number(a.current_balance) || 0) * fxRate(a.currency),
    }))
    .sort((a, b) => Number(b.usd) - Number(a.usd))
    .slice(0, 8)
    .map((r) => ({
      ...r,
      share: totalUsd > 0 ? (Number(r.usd) / totalUsd) * 100 : 0,
    }));
  const concentrationColumns: ReportColumn[] = [
    { key: "bank",     label: "Bank · Account" },
    { key: "currency", label: "Ccy", width: "44px" },
    { key: "usd",      label: "USD eqv", align: "right", format: "money", width: "130px" },
    { key: "share",    label: "Share",   align: "right", format: "percent", width: "80px" },
  ];

  /* ── Frozen / closed accounts ─────────────────────────────────── */
  const frozenColumns: ReportColumn[] = [
    { key: "bank",     label: "Bank · Account" },
    { key: "currency", label: "Ccy", width: "44px" },
    { key: "current_balance", label: "Last Balance", align: "right", format: "money", width: "130px" },
    { key: "status",   label: "Status", width: "90px" },
  ];
  const frozenRows: Array<Record<string, ReportRowValue>> = frozen.map((a) => ({
    bank:    `${a.bank_name} — ${a.account_name}`,
    currency: a.currency,
    current_balance: Number(a.current_balance) || 0,
    status:  a.status,
  }));

  /* ── Recent cash movements (last 30 days) summary ─────────────── */
  const inflows  = movements.filter((m) => m.direction === "inflow");
  const outflows = movements.filter((m) => m.direction === "outflow");
  let inflowUsd = 0, outflowUsd = 0;
  for (const m of inflows)  inflowUsd  += (Number(m.amount) || 0) * fxRate(m.currency);
  for (const m of outflows) outflowUsd += (Number(m.amount) || 0) * fxRate(m.currency);

  const sections: ReportSection[] = [
    { kind: "table", title: "Active Bank Accounts", columns: accountColumns, rows: accountRows, empty_state: "No active bank accounts." },
    { kind: "table", title: "FX Exposure by Currency", columns: fxColumns, rows: fxRows, empty_state: "—" },
    { kind: "table", title: "Account Concentration", columns: concentrationColumns, rows: concentrationRows, empty_state: "—" },
    ...(frozenRows.length > 0
      ? [{ kind: "table" as const, title: "Frozen / Closed / Archived", columns: frozenColumns, rows: frozenRows, empty_state: "—" }]
      : []),
    {
      kind: "kv",
      title: "Last 30 Days Cash Movements",
      pairs: [
        { label: "Inflow count",       value: String(inflows.length) },
        { label: "Outflow count",      value: String(outflows.length) },
        { label: "Inflow (USD eqv)",   value: fmtMoney(inflowUsd) },
        { label: "Outflow (USD eqv)",  value: fmtMoney(outflowUsd) },
        { label: "Net (USD eqv)",      value: fmtMoney(inflowUsd - outflowUsd) },
      ],
    },
    {
      kind: "note",
      title: "Treasury notes",
      body:
        "Balances are taken as of the report timestamp shown above. FX rates are sourced from the canonical Hub FX adapter and are not " +
        "guaranteed to match the bank's settlement rate at the moment of conversion. Restricted balances reflect amounts ring-fenced for " +
        "collateral, escrow, or pending settlement and are NOT counted toward available liquidity.",
    },
  ];

  return {
    meta: {
      report_type: "treasury_report",
      visibility: "internal",
      title: "Treasury Position Report",
      subtitle: `${active.length} active · ${frozen.length} frozen / closed`,
      generated_at: new Date().toISOString(),
      generated_by_name: ctx.generatedByName,
      period,
      currency: REPORTING_CURRENCY,
      report_no: generateReportNo("KX-TRES"),
      tenant_name: tenant.name,
      locale: "en-US",
    },
    summary: [
      { label: "Total Liquidity (USD eqv)", value: totalUsd,      format: "money", tone: totalUsd >= 0 ? "positive" : "negative" },
      { label: "Available",                 value: availableUsd,  format: "money", tone: "neutral" },
      { label: "Pending",                   value: pendingUsd,    format: "money", tone: pendingUsd > 0 ? "warning" : "neutral" },
      { label: "Restricted",                value: restrictedUsd, format: "money", tone: restrictedUsd > 0 ? "warning" : "neutral" },
    ],
    sections,
    totals: [
      { label: "Total Liquidity (USD eqv)", value: totalUsd, format: "money", emphasized: true },
    ],
    internal_warning: "INTERNAL — NOT FOR DISTRIBUTION",
    row_count: accounts.length,
    total_amount: totalUsd,
  };
  /* suppress unused-import on sumNumeric — kept as a re-export hint
     for future deepening (e.g. period totals across accounts). */
  void sumNumeric;
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
