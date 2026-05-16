"use client";

/* ===========================================================================
   Finance Dashboard  —  Phase 1.4 executive rebuild.

   Visual story (top → bottom):

     0. HERO STRIP        Title + period selector + Executive Summary
                          one-liner (financial-health narrative).
     1. PRIMARY HEROES    Two huge KPI cards side-by-side — Revenue
                          and Net Profit — each with inline area chart.
     2. SECONDARY METRICS Compact row: Cash In · Cash Out · Money to
                          Collect · Money to Pay · Gross Margin.
     3. CHART CARD        Full Revenue-vs-Expenses area chart.
     4. INTELLIGENCE      Insight cards: health, cash velocity,
                          collection risk, expense pressure.
     5. PROFIT FLOW       Visual storytelling waterfall.
     6. TOP INSIGHTS      Top profitable orders + top expense
                          categories.

   The page is intentionally monochrome-first; accent colour appears
   only on delta indicators, the single most-important number on each
   card, and status chips.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import {
  AreaChart,
  ChartCard,
  HeroKpiCard,
  InsightCard,
  MetricCard,
  SectionTitle,
  WorkflowRail,
  formatCompact,
  type InsightSeverity,
  type Tone,
  type WorkflowItem,
} from "@/components/finance/FinanceUiX";
import { PeriodTabs } from "@/components/finance/FinanceUi";
import { fmtMoney, fmtPct } from "@/lib/finance/calc";
import { styleForCategory } from "@/components/finance/categoryStyles";
import type { DashboardKpi, DashboardPeriod } from "@/lib/finance/types";

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "week",    label: "Week" },
  { value: "quarter", label: "Quarter" },
  { value: "year",    label: "Year" },
];

export default function FinanceDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>("quarter");
  const [kpi, setKpi] = useState<DashboardKpi | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: DashboardPeriod) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/dashboard?period=${p}`, { cache: "no-store" });
      const j = (await res.json()) as { kpi?: DashboardKpi };
      setKpi(j.kpi ?? null);
    } catch {
      setKpi(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(period); }, [period, load]);

  const currency = "USD";

  /* Inline sparklines from the period's trend series */
  const sparklines = useMemo(() => {
    const t = kpi?.trend ?? [];
    return {
      revenue: t.map((d) => d.revenue),
      expenses: t.map((d) => d.expenses),
      net_profit: t.map((d) => d.net_profit),
      labels: t.map((d) => d.label),
    };
  }, [kpi]);

  /* Intelligence layer — generate narrative insights from the raw KPIs */
  const intelligence = useMemo(() => buildIntelligence(kpi, period), [kpi, period]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Financial Intelligence"
          subtitle={intelligence.headline}
          health={kpi?.health_status}
          controls={<PeriodTabs<DashboardPeriod> value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />}
        />

        {/* ── 0. WORKFLOW RAIL — operate the business, don't just watch */}
        <div className="mt-5">
          <WorkflowRail items={buildWorkflowItems(kpi)} />
        </div>

        {/* ── 1. PRIMARY HEROES ────────────────────────────────── */}
        <SectionTitle eyebrow="At a glance" title="Performance this period" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <HeroKpiCard
            label="Revenue"
            value={kpi?.total_revenue ?? 0}
            unit={currency}
            delta={kpi?.delta.revenue_pct ?? null}
            deltaValue={kpi?.delta_value.revenue}
            hint="Across all orders in this window"
            tone="positive"
            trend={sparklines.revenue}
            trendCurrency={currency}
            loading={loading}
          />
          <HeroKpiCard
            label="Net Profit"
            value={kpi?.net_profit ?? 0}
            unit={currency}
            delta={kpi?.delta.net_profit_pct ?? null}
            deltaValue={kpi?.delta_value.net_profit}
            hint="Gross − Expenses + Tax refund − Bank"
            tone={(kpi?.net_profit ?? 0) >= 0 ? "info" : "negative"}
            trend={sparklines.net_profit}
            trendCurrency={currency}
            loading={loading}
          />
        </div>

        {/* ── 2. SECONDARY METRICS ────────────────────────────── */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Cash In"
            value={kpi?.cash_in ?? 0}
            unit={currency}
            delta={kpi?.delta.cash_in_pct ?? null}
            hint="Customer payments received"
            loading={loading}
          />
          <MetricCard
            label="Cash Out"
            value={kpi?.cash_out ?? 0}
            unit={currency}
            delta={kpi?.delta.cash_out_pct ?? null}
            hint="Suppliers + expenses paid"
            loading={loading}
          />
          <MetricCard
            label="Money to Collect"
            value={kpi?.accounts_receivable ?? 0}
            unit={currency}
            tone="warning"
            hint="Outstanding receivables"
            loading={loading}
          />
          <MetricCard
            label="Money to Pay"
            value={kpi?.accounts_payable ?? 0}
            unit={currency}
            tone="warning"
            hint="Suppliers + unpaid bills"
            loading={loading}
          />
          <MetricCard
            label="Gross Margin"
            value={kpi ? `${(kpi.gross_margin_pct ?? 0).toFixed(1)}` : "—"}
            unit="%"
            hint="Gross profit ÷ revenue"
            tone={
              (kpi?.gross_margin_pct ?? 0) >= 30 ? "positive"
              : (kpi?.gross_margin_pct ?? 0) >= 15 ? "warning"
              : (kpi?.gross_margin_pct ?? 0) < 0 ? "negative"
              : "neutral"
            }
            loading={loading}
          />
        </div>

        {/* ── 3. CHART CARD ────────────────────────────────────── */}
        <SectionTitle
          eyebrow="Trend"
          title="Revenue vs Costs"
          description={
            period === "week"
              ? "Daily breakdown — last 7 days"
              : period === "quarter"
                ? "Weekly breakdown — last 90 days"
                : "Monthly breakdown — last 12 months"
          }
        />
        <ChartCard title="Cash flow over time" subtitle="Revenue is the inflow line; costs + expenses combine into the outflow line.">
          <AreaChart
            currency={currency}
            labels={sparklines.labels}
            height={300}
            series={[
              { name: "Revenue",            values: sparklines.revenue,    tone: "positive" },
              { name: "Costs + Expenses",   values: sparklines.expenses,   tone: "negative" },
              { name: "Net profit",         values: sparklines.net_profit, tone: "info" },
            ]}
          />
        </ChartCard>

        {/* ── 4. INTELLIGENCE LAYER ───────────────────────────── */}
        <SectionTitle eyebrow="Intelligence" title="What the numbers mean" description="Automatic interpretations of this period's signal." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {intelligence.cards.map((c, i) => (
            <InsightCard
              key={i}
              icon={c.icon}
              title={c.title}
              description={c.description}
              chip={c.chip}
              severity={c.severity}
            />
          ))}
        </div>

        {/* ── 5. PROFIT FLOW STORY ────────────────────────────── */}
        <SectionTitle
          eyebrow="Profit flow"
          title="From revenue to net profit"
          description="Gross profit excludes tax refund; refund is added back separately before net profit."
        />
        <ProfitFlow
          revenue={kpi?.total_revenue ?? 0}
          supplierCost={kpi?.total_supplier_cost ?? 0}
          expenses={kpi?.total_expenses ?? 0}
          taxRefund={kpi?.total_tax_refund ?? 0}
          finCharges={kpi?.total_financial_charges ?? 0}
          gross={kpi?.gross_profit ?? 0}
          net={kpi?.net_profit ?? 0}
          currency={currency}
        />

        {/* ── 6. TOP INSIGHTS ────────────────────────────────── */}
        <SectionTitle eyebrow="Top insights" title="Where profit is being made — and where it's leaking" />
        <div className="grid gap-3 lg:grid-cols-2">
          <TopOrdersCard kpi={kpi} currency={currency} />
          <TopCategoriesCard kpi={kpi} currency={currency} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Intelligence layer  —  takes the raw KPI payload and produces a
   short narrative headline + 3-6 InsightCards explaining the business
   state in plain language. Pure function; easy to evolve.

   Phase 1.6: each card now carries an InsightSeverity (positive /
   neutral / watch / risk / critical) so the InsightCard can render
   subtle left-rail tint + (on critical) a slow edge pulse.
   --------------------------------------------------------------------------- */
type IntelligenceCard = {
  title: string;
  description: string;
  chip?: string;
  severity: InsightSeverity;
  icon: string;
};

function buildIntelligence(kpi: DashboardKpi | null, period: DashboardPeriod) {
  if (!kpi) {
    return {
      headline: "Loading executive view…",
      cards: [] as IntelligenceCard[],
    };
  }
  const periodLabel = period === "week" ? "this week" : period === "quarter" ? "this quarter" : "this year";
  const hasActivity = (kpi.total_revenue ?? 0) > 0 || (kpi.total_expenses ?? 0) > 0;

  /* Headline */
  let headline: string;
  if (!hasActivity) {
    headline = "No financial activity recorded yet — start logging orders, expenses, and payments to see the executive view.";
  } else if (kpi.health_status === "stress") {
    headline = `Business is under stress ${periodLabel}. ${kpi.health_reasons[0] ?? ""}`.trim();
  } else if (kpi.health_status === "watch") {
    headline = `Mixed signals ${periodLabel}. ${kpi.health_reasons[0] ?? ""}`.trim();
  } else {
    const margin = kpi.gross_margin_pct ?? 0;
    headline = `Healthy ${periodLabel} · Net profit ${formatCompact(kpi.net_profit)} USD · Gross margin ${margin.toFixed(1)}%.`;
  }

  const cards: IntelligenceCard[] = [];
  const cashNet = (kpi.cash_in ?? 0) - (kpi.cash_out ?? 0);
  const collectionPct = kpi.total_revenue > 0 ? ((kpi.cash_in ?? 0) / kpi.total_revenue) * 100 : 0;

  /* Cash velocity */
  cards.push({
    icon: "◐",
    title: "Cash velocity",
    description:
      cashNet >= 0
        ? `Cash in exceeds cash out by ${fmtMoney(cashNet, "USD", { compact: true })} ${periodLabel}.`
        : `Cash out exceeds cash in by ${fmtMoney(Math.abs(cashNet), "USD", { compact: true })} ${periodLabel} — watch the bank balance.`,
    chip: cashNet >= 0 ? "Positive" : "Negative",
    severity: cashNet >= 0 ? "positive" : "risk",
  });

  /* Collections */
  if (kpi.accounts_receivable > 0 || kpi.total_revenue > 0) {
    cards.push({
      icon: "↘",
      title: "Collections on track",
      description: kpi.accounts_receivable > 0
        ? `${fmtMoney(kpi.accounts_receivable, "USD", { compact: true })} still to collect from customers. Customer payments cover ${collectionPct.toFixed(0)}% of revenue so far.`
        : "All issued orders have been fully collected.",
      chip: kpi.accounts_receivable === 0 ? "Clear" : collectionPct >= 70 ? "On track" : "Lagging",
      severity: kpi.accounts_receivable === 0
        ? "positive"
        : collectionPct >= 70 ? "neutral"
        : collectionPct >= 40 ? "watch"
        : "risk",
    });
  }

  /* Supplier exposure */
  if (kpi.accounts_payable > 0) {
    const apHeavy = kpi.accounts_receivable > 0 && kpi.accounts_payable > kpi.accounts_receivable * 1.2;
    const apSevere = kpi.accounts_receivable > 0 && kpi.accounts_payable > kpi.accounts_receivable * 2;
    cards.push({
      icon: "↗",
      title: "Supplier liabilities",
      description: apHeavy
        ? `${fmtMoney(kpi.accounts_payable, "USD", { compact: true })} owed to suppliers — exceeds outstanding receivables.`
        : `${fmtMoney(kpi.accounts_payable, "USD", { compact: true })} owed to suppliers + unpaid bills.`,
      chip: apSevere ? "Critical" : apHeavy ? "Heavy" : "Manageable",
      severity: apSevere ? "critical" : apHeavy ? "watch" : "neutral",
    });
  }

  /* Margin pressure */
  const margin = kpi.gross_margin_pct ?? 0;
  cards.push({
    icon: "▲",
    title: "Margin",
    description:
      margin >= 30 ? `Gross margin of ${margin.toFixed(1)}% is comfortably above the 30% benchmark.`
      : margin >= 15 ? `Gross margin of ${margin.toFixed(1)}% is healthy but leaves room to improve.`
      : margin > 0 ? `Gross margin compressed to ${margin.toFixed(1)}% — review supplier costs.`
      : `Gross margin is negative this period — revenue isn't covering supplier costs.`,
    chip: margin >= 30 ? "Strong" : margin >= 15 ? "Healthy" : margin > 0 ? "Compressed" : "Loss",
    severity: margin >= 30 ? "positive" : margin >= 15 ? "neutral" : margin > 0 ? "watch" : "risk",
  });

  /* Top order concentration risk */
  const topOrder = kpi.top_orders?.[0];
  if (topOrder && kpi.total_revenue > 0) {
    const share = (topOrder.selling_price / kpi.total_revenue) * 100;
    if (share >= 40) {
      cards.push({
        icon: "◆",
        title: "Revenue concentration",
        description: `${topOrder.customer_name || "Top customer"} accounts for ${share.toFixed(0)}% of revenue ${periodLabel}.`,
        chip: share >= 60 ? "Critical concentration" : "Concentration risk",
        severity: share >= 60 ? "risk" : "watch",
      });
    }
  }

  /* Expense spike */
  const topCat = kpi.top_expense_categories?.[0];
  if (topCat && topCat.share_pct >= 50) {
    cards.push({
      icon: "▽",
      title: "Expense concentration",
      description: `${topCat.name} is ${topCat.share_pct.toFixed(0)}% of all operating spend ${periodLabel}.`,
      chip: "Watch",
      severity: "watch",
    });
  }

  return { headline, cards };
}

/* ---------------------------------------------------------------------------
   Workflow builder — turns the dashboard KPI snapshot into operational
   action shortcuts. This is the bridge from "I can observe the
   business" to "I can OPERATE the business" without leaving the
   dashboard. Each tile routes the user to the appropriate sub-page
   pre-filtered, and shows a badge count where there's something to act on.
   --------------------------------------------------------------------------- */
function buildWorkflowItems(kpi: DashboardKpi | null): WorkflowItem[] {
  const arAmount = kpi?.accounts_receivable ?? 0;
  const apAmount = kpi?.accounts_payable ?? 0;
  const items: WorkflowItem[] = [
    {
      key: "new-order",
      label: "New order",
      hint: "Start a profit run",
      icon: <span aria-hidden>＋</span>,
      href: "/finance/orders",
    },
    {
      key: "record-payment",
      label: "Record payment",
      hint: "Customer or supplier",
      icon: <span aria-hidden>≡</span>,
      href: "/finance/payments",
    },
    {
      key: "add-expense",
      label: "Add expense",
      hint: "Fast operational entry",
      icon: <span aria-hidden>△</span>,
      href: "/expenses",
    },
    {
      key: "follow-up",
      label: "Follow up collection",
      hint: arAmount > 0 ? "AR still open" : "All cleared",
      icon: <span aria-hidden>↘</span>,
      href: "/finance/customers",
      badge: arAmount > 0
        ? { text: formatCompact(arAmount), tone: "warning" }
        : { text: "Clear", tone: "positive" },
    },
    {
      key: "pay-suppliers",
      label: "Pay suppliers",
      hint: apAmount > 0 ? "AP outstanding" : "Nothing pending",
      icon: <span aria-hidden>↗</span>,
      href: "/finance/suppliers",
      badge: apAmount > 0
        ? { text: formatCompact(apAmount), tone: "warning" }
        : { text: "Clear", tone: "positive" },
    },
    {
      key: "reminders",
      label: "Reminders",
      hint: "Severity-sorted center",
      icon: <span aria-hidden>○</span>,
      href: "/finance/notifications",
    },
  ];
  return items;
}

/* ---------------------------------------------------------------------------
   ProfitFlow — visual storytelling waterfall.
   Each step is a card linked by a soft connector. Single accent only
   on the totals (Gross profit + Net profit) so the eye lands there.
   --------------------------------------------------------------------------- */
function ProfitFlow({
  revenue, supplierCost, expenses, taxRefund, finCharges, gross, net, currency,
}: {
  revenue: number; supplierCost: number; expenses: number; taxRefund: number;
  finCharges: number; gross: number; net: number; currency: string;
}) {
  const steps: { label: string; value: number; sign: 1 | -1; total?: boolean; tone: Tone }[] = [
    { label: "Revenue",        value: revenue,      sign: 1,  tone: "positive" },
    { label: "Supplier cost",  value: supplierCost, sign: -1, tone: "neutral" },
    { label: "Gross profit",   value: gross,        sign: 1,  total: true, tone: gross >= 0 ? "info" : "negative" },
    { label: "Order expenses", value: expenses,     sign: -1, tone: "neutral" },
    { label: "Tax refund",     value: taxRefund,    sign: 1,  tone: "neutral" },
    { label: "Bank charges",   value: finCharges,   sign: -1, tone: "neutral" },
    { label: "Net profit",     value: net,          sign: 1,  total: true, tone: net >= 0 ? "info" : "negative" },
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
          <div key={i} className={`rounded-2xl border ${surface} p-4`}>
            <div className="flex items-baseline justify-between gap-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">{s.label}</div>
              {s.sign === -1 && !isTotal && (
                <span className="text-[10px] text-gray-600">−</span>
              )}
            </div>
            <div className={`mt-2 text-[18px] font-medium tabular-nums tracking-tight ${valueCls}`}>
              {s.sign === -1 && s.value !== 0 ? "−" : ""}{formatCompact(Math.abs(s.value))}
              <span className="ml-1 text-[11px] text-gray-500">{currency}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   TopOrdersCard / TopCategoriesCard — list cards used at the bottom.
   Monochrome surfaces, accent only on the headline number.
   --------------------------------------------------------------------------- */
function TopOrdersCard({ kpi, currency }: { kpi: DashboardKpi | null; currency: string }) {
  const rows = kpi?.top_orders ?? [];
  return (
    <ChartCard title="Top profitable orders" subtitle="Ranked by net profit this period.">
      {rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500">No orders yet for this period.</div>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((o, idx) => (
            <li key={o.id} className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.015] px-4 py-3 transition hover:border-white/[0.08]">
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

function TopCategoriesCard({ kpi, currency }: { kpi: DashboardKpi | null; currency: string }) {
  const rows = kpi?.top_expense_categories ?? [];
  return (
    <ChartCard title="Top expense categories" subtitle="Biggest spend buckets this period.">
      {rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500">No expenses recorded for this period.</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((c) => {
            const style = styleForCategory(c.name);
            return (
              <li key={c.name} className="rounded-xl border border-white/[0.04] bg-white/[0.015] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-base opacity-80">{style.glyph}</span>
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
