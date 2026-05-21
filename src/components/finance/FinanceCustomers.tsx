"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { EmptyState, ProgressBar, StatusBadge } from "@/components/finance/FinanceUi";
import { formatCompact } from "@/components/finance/FinanceUiX";
import {
  DashboardSection,
  DisplayKpi,
} from "@/components/finance/FinanceDashboardUi";
import { fmtMoney } from "@/lib/finance/calc";
import RrIcon from "@/components/ui/RrIcon";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import type { FinanceCustomerAccount } from "@/lib/finance/types";

export default function FinanceCustomers() {
  const { t } = useTranslation(financeT);
  const [rows, setRows] = useState<FinanceCustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/finance/customers", { cache: "no-store" });
      const j = (await r.json()) as { customers?: FinanceCustomerAccount[] };
      setRows(j.customers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  /* Phase R.1 — generate an external account statement for one
     customer. Calls the print export endpoint to record the audit
     row, then opens the chrome-less print view in a new tab so the
     browser's own Save-as-PDF dialog appears. */
  const [generating, setGenerating] = useState<string | null>(null);
  const generateStatement = useCallback(async (customerId: string) => {
    setGenerating(customerId);
    try {
      const res = await fetch("/api/reports/export/print", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "customer_statement", filters: { customer_id: customerId } }),
      });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? t("customers.exportFailed", "Failed ({n})").replace("{n}", String(res.status))); return; }
      window.open(`/finance/reports/${encodeURIComponent(j.export_id)}/print?auto=1`, "_blank");
    } finally {
      setGenerating(null);
    }
  }, []);

  const kpi = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + (r.total_revenue ?? 0), 0);
    const collected = rows.reduce((s, r) => s + (r.paid_amount ?? 0), 0);
    const outstanding = rows.reduce((s, r) => s + (r.outstanding_balance ?? 0), 0);
    const overdue = rows.reduce((s, r) => s + (r.overdue_amount ?? 0), 0);
    return { revenue, collected, outstanding, overdue };
  }, [rows]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("customers.title", "Customer Accounts")}
          subtitle={t("customers.subtitle", "Revenue, money collected, and money still owed — for every customer you sell to.")}
        />

        <DashboardSection eyebrow={t("customers.section.eyebrow", "Customer accounts")} title={t("customers.section.title", "Total exposure across every customer")}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-7 lg:grid-cols-4">
            <DisplayKpi label={t("customers.kpi.revenue",     "Total Revenue")} value={formatCompact(kpi.revenue)}     hint={`USD · ${t("customers.kpi.allCustomers", "all customers")}`} tone="positive" loading={loading} />
            <DisplayKpi label={t("customers.kpi.outstanding", "Outstanding")}   value={formatCompact(kpi.outstanding)} hint={`USD · ${t("customers.kpi.toCollect",    "still to collect")}`} tone="warning" loading={loading} />
            <DisplayKpi label={t("customers.kpi.collected",   "Collected")}     value={formatCompact(kpi.collected)}   hint={`USD · ${t("customers.kpi.banked",       "banked")}`} tone="info" loading={loading} />
            <DisplayKpi label={t("customers.kpi.overdue",     "Overdue")}       value={formatCompact(kpi.overdue)}     hint={`USD · ${t("customers.kpi.pastDue",      "past due")}`} tone={kpi.overdue > 0 ? "negative" : "info"} loading={loading} />
          </div>
        </DashboardSection>

        <div className="mt-6">
          {loading ? (
            <div className="py-8 text-center text-sm text-[var(--text-dim)]">{t("customers.loading", "Loading customers…")}</div>
          ) : rows.length === 0 ? (
            <EmptyState title={t("customers.emptyTitle", "No customers yet")} hint={t("customers.emptyHint", "Customers appear here as soon as you create an order for them on the Orders page.")} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((r) => (
                <div key={r.customer_id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 transition hover:border-[var(--border-color)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">{r.customer_name || "—"}</div>
                      <div className="mt-1 text-[11px] text-[var(--text-dim)]">
                        {r.payment_terms ?? t("customers.noTerms", "No payment terms set")}
                      </div>
                    </div>
                    <StatusBadge status={r.credit_status} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Mini label={t("customers.mini.revenue",     "Revenue")}     value={fmtMoney(r.total_revenue ?? 0,        r.default_currency, { compact: true })} accent="emerald" />
                    <Mini label={t("customers.mini.collected",   "Collected")}   value={fmtMoney(r.paid_amount ?? 0,          r.default_currency, { compact: true })} accent="emerald" />
                    <Mini label={t("customers.mini.outstanding", "Outstanding")} value={fmtMoney(r.outstanding_balance ?? 0, r.default_currency, { compact: true })} accent="amber" />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)]">
                      <span>{t("customers.collectionProgress", "Collection progress")}</span>
                      <span>{r.total_revenue ? (((r.paid_amount ?? 0) / r.total_revenue) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="mt-1">
                      <ProgressBar value={r.paid_amount ?? 0} max={r.total_revenue ?? 0} color={r.overdue_amount && r.overdue_amount > 0 ? "rose" : "emerald"} />
                    </div>
                  </div>
                  {(r.overdue_amount ?? 0) > 0 && (
                    <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-300">
                      ⚠ {t("customers.overdueAmount", "{amt} overdue — past due date.").replace("{amt}", fmtMoney(r.overdue_amount ?? 0, r.default_currency, { compact: true }))}
                    </div>
                  )}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => void generateStatement(r.customer_id)}
                      disabled={generating === r.customer_id}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] font-semibold transition hover:border-[var(--border-strong)] disabled:opacity-50"
                    >
                      <RrIcon name="file-invoice" size={12} />
                      {generating === r.customer_id ? t("customers.preparing", "Preparing…") : t("customers.generate", "Generate Account Statement")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent: "emerald" | "rose" | "amber" }) {
  const color = accent === "emerald" ? "text-emerald-600 dark:text-emerald-400" : accent === "rose" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400";
  return (
    <div className="rounded-lg border border-[var(--border-faint)] bg-[var(--bg-primary)] p-2">
      <div className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      <div className={`mt-1 text-sm font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
