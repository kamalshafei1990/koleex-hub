import "server-only";

/* ===========================================================================
   Treasury Position Report — INTERNAL.
   One-page snapshot of every active bank account: balances, currency,
   status, last reconciliation timestamp. Plus an aggregate line in
   the reporting currency (USD) via the shared FX adapter.
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
import type { BankAccount } from "@/lib/finance/types";

export async function buildTreasuryReport(ctx: ReportBuildContext): Promise<ReportPayload> {
  const tenant = await loadTenant(ctx.tenantId);
  const period = ctx.filters.date_from && ctx.filters.date_to
    ? normalisePeriod(ctx.filters.date_from, ctx.filters.date_to)
    : undefined;

  const { data: accountsRaw } = await supabaseServer
    .from("finance_bank_accounts")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("is_primary", { ascending: false });

  const accounts = (accountsRaw ?? []) as BankAccount[];

  /* USD-equivalent aggregate across all currencies via the shared FX
     adapter. Keeps every report consistent with the dashboards. */
  let totalInReporting = 0;
  for (const a of accounts) {
    const rate = fxRate(a.currency);
    totalInReporting += (Number(a.current_balance) || 0) * rate;
  }

  const columns: ReportColumn[] = [
    { key: "bank_name", label: "Bank" },
    { key: "account_name", label: "Account Name" },
    { key: "currency", label: "Ccy", width: "50px" },
    { key: "current_balance", label: "Current", align: "right", format: "money", width: "120px" },
    { key: "available_balance", label: "Available", align: "right", format: "money", width: "120px" },
    { key: "status", label: "Status", width: "80px" },
    { key: "last_reconciled_at", label: "Last Recon", format: "date", width: "100px" },
  ];

  const tableRows: Array<Record<string, ReportRowValue>> = accounts.map((a) => ({
    bank_name: a.bank_name,
    account_name: a.account_name,
    currency: a.currency,
    current_balance: Number(a.current_balance) || 0,
    available_balance: Number(a.available_balance) || 0,
    status: a.status,
    last_reconciled_at: a.last_reconciled_at ? a.last_reconciled_at.slice(0, 10) : "—",
  }));

  const sections: ReportSection[] = [
    {
      kind: "table",
      title: "Bank Accounts",
      columns,
      rows: tableRows,
      empty_state: "No bank accounts configured.",
    },
  ];

  const activeCount = accounts.filter((a) => a.status === "active").length;
  const frozenCount = accounts.filter((a) => a.status === "frozen" || a.status === "closed").length;

  return {
    meta: {
      report_type: "treasury_report",
      visibility: "internal",
      title: "Treasury Position Report",
      subtitle: `${activeCount} active · ${frozenCount} frozen/closed`,
      generated_at: new Date().toISOString(),
      generated_by_name: ctx.generatedByName,
      period,
      currency: REPORTING_CURRENCY,
      report_no: generateReportNo("KX-TRES"),
      tenant_name: tenant.name,
      locale: "en-US",
    },
    summary: [
      { label: `Total (${REPORTING_CURRENCY} eqv.)`, value: totalInReporting, format: "money", tone: totalInReporting >= 0 ? "positive" : "negative" },
      { label: "Active Accounts", value: activeCount, format: "count", tone: "neutral" },
      { label: "Frozen / Closed", value: frozenCount, format: "count", tone: frozenCount > 0 ? "warning" : "neutral" },
      { label: "Total Accounts", value: accounts.length, format: "count", tone: "neutral" },
    ],
    sections,
    internal_warning: "INTERNAL — NOT FOR DISTRIBUTION",
    row_count: accounts.length,
    total_amount: totalInReporting,
  };
}
