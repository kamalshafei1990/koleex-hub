"use client";

/* ===========================================================================
   FinanceDashboard · leaf cards.

   Extracted from FinanceDashboard.tsx (Fix #6) — the three "leaf"
   visual cards that the Operational + Executive views both render
   near the bottom of the page. They depend only on props (no closures
   into the parent's state), so they're a clean cut — and a clean
   React.memo target: the dashboard re-renders on every period toggle,
   intelligence rebuild, and copilot-context effect, but these cards
   only need to re-render when their own props change.

     · ProfitFlow         — 7-step waterfall: revenue → … → net profit
     · TopOrdersCard      — ranked list of most-profitable orders
     · TopCategoriesCard  — biggest expense buckets with share-bar
   ========================================================================== */

import { memo } from "react";
import { ChartCard, formatCompact, type Tone } from "@/components/finance/FinanceUiX";
import { styleForCategory } from "@/components/finance/categoryStyles";
import { fmtPct } from "@/lib/finance/calc";
import GuidanceTip from "@/components/ui/GuidanceTip";
import RrIcon from "@/components/ui/RrIcon";
import type { DashboardKpi } from "@/lib/finance/types";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";

export const ProfitFlow = memo(function ProfitFlow({
  revenue, supplierCost, expenses, taxRefund, finCharges, gross, net, currency,
}: {
  revenue: number; supplierCost: number; expenses: number; taxRefund: number;
  finCharges: number; gross: number; net: number; currency: string;
}) {
  const { t } = useTranslation(financeT);
  const steps: { label: string; value: number; sign: 1 | -1; total?: boolean; tone: Tone; helpId: string }[] = [
    { label: t("profitFlow.revenue", "Revenue"),        helpId: "finance.revenue",        value: revenue,      sign: 1,  tone: "positive" },
    { label: t("profitFlow.supplierCost", "Supplier cost"),  helpId: "finance.supplierCost",   value: supplierCost, sign: -1, tone: "neutral" },
    { label: t("profitFlow.grossProfit", "Gross profit"),   helpId: "finance.grossProfit",    value: gross,        sign: 1,  total: true, tone: gross >= 0 ? "info" : "negative" },
    { label: t("profitFlow.orderExpenses", "Order expenses"), helpId: "finance.orderExpenses",  value: expenses,     sign: -1, tone: "neutral" },
    { label: t("profitFlow.taxRefund", "Tax refund"),     helpId: "finance.taxRefund",      value: taxRefund,    sign: 1,  tone: "neutral" },
    { label: t("profitFlow.bankCharges", "Bank charges"),   helpId: "finance.bankCharges",    value: finCharges,   sign: -1, tone: "neutral" },
    { label: t("profitFlow.netProfit", "Net profit"),     helpId: "finance.netProfit",      value: net,          sign: 1,  total: true, tone: net >= 0 ? "info" : "negative" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {steps.map((s, i) => {
        const isTotal = !!s.total;
        const valueCls =
          isTotal && s.tone === "info"     ? "text-sky-600 dark:text-sky-300"
          : isTotal && s.tone === "negative" ? "text-rose-600 dark:text-rose-300"
          : "text-[var(--text-highlight)]";
        const surface =
          isTotal
            ? "border-[var(--border-subtle)] bg-gradient-to-br from-white/[0.04] to-transparent"
            : "border-[var(--border-faint)] bg-[var(--bg-secondary)]";
        return (
          <div key={i} className={`rounded-2xl border ${surface} p-3.5`}>
            <div className="flex items-baseline justify-between gap-1.5">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
                <span>{s.label}</span>
                <GuidanceTip guidanceId={s.helpId} />
              </div>
              {s.sign === -1 && !isTotal && (
                <span className="text-[10px] text-[var(--text-ghost)]">−</span>
              )}
            </div>
            <div className={`mt-1.5 text-[17px] font-medium tabular-nums tracking-tight ${valueCls}`}>
              {s.sign === -1 && s.value !== 0 ? "−" : ""}{formatCompact(Math.abs(s.value))}
              <span className="ml-1 text-[11px] text-[var(--text-dim)]">{currency}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export const TopOrdersCard = memo(function TopOrdersCard({ kpi, currency }: { kpi: DashboardKpi | null; currency: string }) {
  const { t } = useTranslation(financeT);
  const rows = kpi?.top_orders ?? [];
  return (
    <ChartCard title={t("topOrders.title", "Top profitable orders")} subtitle={t("topOrders.subtitle", "Ranked by net profit this period.")} helpId="finance.topOrders">
      {rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-[var(--text-dim)]">{t("topOrders.empty", "No orders yet for this period.")}</div>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((o, idx) => (
            <li key={o.id} className="flex items-center justify-between rounded-xl border border-[var(--border-faint)] bg-[var(--bg-secondary)] px-4 py-2.5 transition hover:border-[var(--border-subtle)]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-[11px] font-medium text-[var(--text-highlight)]">{idx + 1}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{o.customer_name || "—"}</div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-[var(--text-dim)]">
                    <span>{o.order_no}</span><span>·</span><span>{formatCompact(o.selling_price)} {currency}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium tabular-nums ${o.net_profit >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
                  {formatCompact(o.net_profit)} {currency}
                </div>
                <div className={`text-[10px] ${o.net_profit_pct >= 15 ? "text-emerald-600 dark:text-emerald-400" : o.net_profit_pct >= 0 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {fmtPct(o.net_profit_pct)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </ChartCard>
  );
});

export const TopCategoriesCard = memo(function TopCategoriesCard({ kpi, currency }: { kpi: DashboardKpi | null; currency: string }) {
  const { t } = useTranslation(financeT);
  const rows = kpi?.top_expense_categories ?? [];
  return (
    <ChartCard title={t("topCategories.title", "Top expense categories")} subtitle={t("topCategories.subtitle", "Biggest spend buckets this period.")} helpId="finance.topCategories">
      {rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-[var(--text-dim)]">{t("topCategories.empty", "No expenses recorded for this period.")}</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((c) => {
            const style = styleForCategory(c.name);
            return (
              <li key={c.name} className="rounded-xl border border-[var(--border-faint)] bg-[var(--bg-secondary)] px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <RrIcon name={style.icon} size={14} className="opacity-80" />
                    <span className="text-sm font-medium">{c.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium tabular-nums">{formatCompact(c.total)} {currency}</div>
                    <div className="text-[10px] text-[var(--text-dim)]">{c.share_pct.toFixed(0)}% · {c.count} {c.count === 1 ? t("topCategories.itemOne", "item") : t("topCategories.itemMany", "items")}</div>
                  </div>
                </div>
                <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                  <div className="h-full bg-white/40" style={{ width: `${Math.max(3, c.share_pct)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
});
