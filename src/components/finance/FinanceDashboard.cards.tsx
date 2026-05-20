"use client";

/* ===========================================================================
   FinanceDashboard · leaf cards.

   Extracted from FinanceDashboard.tsx (Fix #6) — the three "leaf"
   visual cards that the Operational + Executive views both render
   near the bottom of the page. They depend only on props (no closures
   into the parent's state), so they're a clean cut.

     · ProfitFlow         — 7-step waterfall: revenue → … → net profit
     · TopOrdersCard      — ranked list of most-profitable orders
     · TopCategoriesCard  — biggest expense buckets with share-bar
   ========================================================================== */

import { ChartCard, formatCompact, type Tone } from "@/components/finance/FinanceUiX";
import { styleForCategory } from "@/components/finance/categoryStyles";
import { fmtPct } from "@/lib/finance/calc";
import GuidanceTip from "@/components/ui/GuidanceTip";
import RrIcon from "@/components/ui/RrIcon";
import type { DashboardKpi } from "@/lib/finance/types";

export function ProfitFlow({
  revenue, supplierCost, expenses, taxRefund, finCharges, gross, net, currency,
}: {
  revenue: number; supplierCost: number; expenses: number; taxRefund: number;
  finCharges: number; gross: number; net: number; currency: string;
}) {
  const steps: { label: string; value: number; sign: 1 | -1; total?: boolean; tone: Tone; helpId: string }[] = [
    { label: "Revenue",        helpId: "finance.revenue",        value: revenue,      sign: 1,  tone: "positive" },
    { label: "Supplier cost",  helpId: "finance.supplierCost",   value: supplierCost, sign: -1, tone: "neutral" },
    { label: "Gross profit",   helpId: "finance.grossProfit",    value: gross,        sign: 1,  total: true, tone: gross >= 0 ? "info" : "negative" },
    { label: "Order expenses", helpId: "finance.orderExpenses",  value: expenses,     sign: -1, tone: "neutral" },
    { label: "Tax refund",     helpId: "finance.taxRefund",      value: taxRefund,    sign: 1,  tone: "neutral" },
    { label: "Bank charges",   helpId: "finance.bankCharges",    value: finCharges,   sign: -1, tone: "neutral" },
    { label: "Net profit",     helpId: "finance.netProfit",      value: net,          sign: 1,  total: true, tone: net >= 0 ? "info" : "negative" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {steps.map((s, i) => {
        const isTotal = !!s.total;
        const valueCls =
          isTotal && s.tone === "info"     ? "text-sky-300"
          : isTotal && s.tone === "negative" ? "text-rose-300"
          : "text-gray-200";
        const surface =
          isTotal
            ? "border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent"
            : "border-white/[0.04] bg-white/[0.015]";
        return (
          <div key={i} className={`rounded-2xl border ${surface} p-3.5`}>
            <div className="flex items-baseline justify-between gap-1.5">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                <span>{s.label}</span>
                <GuidanceTip guidanceId={s.helpId} />
              </div>
              {s.sign === -1 && !isTotal && (
                <span className="text-[10px] text-gray-600">−</span>
              )}
            </div>
            <div className={`mt-1.5 text-[17px] font-medium tabular-nums tracking-tight ${valueCls}`}>
              {s.sign === -1 && s.value !== 0 ? "−" : ""}{formatCompact(Math.abs(s.value))}
              <span className="ml-1 text-[11px] text-gray-500">{currency}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TopOrdersCard({ kpi, currency }: { kpi: DashboardKpi | null; currency: string }) {
  const rows = kpi?.top_orders ?? [];
  return (
    <ChartCard title="Top profitable orders" subtitle="Ranked by net profit this period." helpId="finance.topOrders">
      {rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500">No orders yet for this period.</div>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((o, idx) => (
            <li key={o.id} className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.015] px-4 py-2.5 transition hover:border-white/[0.08]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-medium text-gray-300">{idx + 1}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{o.customer_name || "—"}</div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-gray-500">
                    <span>{o.order_no}</span><span>·</span><span>{formatCompact(o.selling_price)} {currency}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium tabular-nums ${o.net_profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {formatCompact(o.net_profit)} {currency}
                </div>
                <div className={`text-[10px] ${o.net_profit_pct >= 15 ? "text-emerald-400" : o.net_profit_pct >= 0 ? "text-amber-400" : "text-rose-400"}`}>
                  {fmtPct(o.net_profit_pct)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </ChartCard>
  );
}

export function TopCategoriesCard({ kpi, currency }: { kpi: DashboardKpi | null; currency: string }) {
  const rows = kpi?.top_expense_categories ?? [];
  return (
    <ChartCard title="Top expense categories" subtitle="Biggest spend buckets this period." helpId="finance.topCategories">
      {rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500">No expenses recorded for this period.</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((c) => {
            const style = styleForCategory(c.name);
            return (
              <li key={c.name} className="rounded-xl border border-white/[0.04] bg-white/[0.015] px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <RrIcon name={style.icon} size={14} className="opacity-80" />
                    <span className="text-sm font-medium">{c.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium tabular-nums">{formatCompact(c.total)} {currency}</div>
                    <div className="text-[10px] text-gray-500">{c.share_pct.toFixed(0)}% · {c.count} {c.count === 1 ? "item" : "items"}</div>
                  </div>
                </div>
                <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                  <div className="h-full bg-white/40" style={{ width: `${Math.max(3, c.share_pct)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}
