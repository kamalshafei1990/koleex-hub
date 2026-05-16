"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import {
  KpiCard,
  PeriodTabs,
  SectionCard,
  TrendChart,
} from "@/components/finance/FinanceUi";
import { accentBgClass, accentSolidBg, styleForCategory } from "@/components/finance/categoryStyles";
import { fmtMoney, fmtPct } from "@/lib/finance/calc";
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

  /* Build mini-sparkline arrays from the trend series so the KPI
     cards can render a tiny line graph. */
  const sparklines = useMemo(() => {
    const t = kpi?.trend ?? [];
    return {
      revenue: t.map((d) => d.revenue),
      expenses: t.map((d) => d.expenses),
      net_profit: t.map((d) => d.net_profit),
    };
  }, [kpi]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Financial Intelligence"
          subtitle="Executive view of revenue, profit, cash and outstanding balances."
          health={kpi?.health_status}
          controls={<PeriodTabs<DashboardPeriod> value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />}
        />

        {/* ═══════════════════════════════════════════════════════════════
            SECTION A — Executive KPI row
            8 KPIs in two responsive rows. Each card carries its OWN
            unique accent colour (no duplicates within the page) so
            the eye can lock onto the right metric instantly. The
            mapping is also semantic: green-family for inflows /
            health, red/orange for outflows / risk, blue/violet for
            booked numbers, cyan for derived ratios. */}
        <SectionLabel index="A" title="Executive KPIs" hint="The numbers you read first in a board meeting." />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Revenue"
            value={kpi?.total_revenue ?? 0}
            delta={kpi?.delta.revenue_pct ?? null}
            deltaValue={kpi?.delta_value.revenue}
            currency={currency}
            accent="emerald"
            loading={loading}
            hint="vs previous period"
            sparkline={sparklines.revenue}
          />
          <KpiCard
            label="Net Profit"
            value={kpi?.net_profit ?? 0}
            delta={kpi?.delta.net_profit_pct ?? null}
            deltaValue={kpi?.delta_value.net_profit}
            currency={currency}
            accent="violet"
            loading={loading}
            hint="Gross − Exp + Tax − Bank"
            sparkline={sparklines.net_profit}
          />
          <KpiCard
            label="Cash In"
            value={kpi?.cash_in ?? 0}
            delta={kpi?.delta.cash_in_pct ?? null}
            currency={currency}
            accent="teal"
            loading={loading}
            hint="Customer payments received"
          />
          <KpiCard
            label="Cash Out"
            value={kpi?.cash_out ?? 0}
            delta={kpi?.delta.cash_out_pct ?? null}
            currency={currency}
            accent="rose"
            invertDelta
            loading={loading}
            hint="Supplier + expense payments"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Money to Collect"
            value={kpi?.accounts_receivable ?? 0}
            currency={currency}
            accent="amber"
            loading={loading}
            hint="Outstanding from customers"
          />
          <KpiCard
            label="Money to Pay"
            value={kpi?.accounts_payable ?? 0}
            currency={currency}
            accent="orange"
            loading={loading}
            hint="Suppliers + unpaid bills"
          />
          <KpiCard
            label="Gross Margin"
            value={kpi ? `${(kpi.gross_margin_pct ?? 0).toFixed(1)}%` : "—"}
            accent="cyan"
            loading={loading}
            hint="Gross profit ÷ revenue"
          />
          <KpiCard
            label="Financial Health"
            value={kpi?.health_status === "healthy" ? "Healthy" : kpi?.health_status === "watch" ? "Watch" : kpi?.health_status === "stress" ? "Stress" : "—"}
            accent="lime"
            loading={loading}
            hint={kpi?.health_reasons?.[0] ?? "Composite signal"}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION B — Profit Story
            Visual waterfall from Revenue to Net Profit. */}
        <SectionLabel index="B" title="Profit Story" hint="How revenue becomes net profit, step by step." />
        <div className="mt-3">
          <SectionCard
            subtitle="Gross profit excludes tax refund — refund is added back separately after expenses."
          >
            <ProfitWaterfall
              revenue={kpi?.total_revenue ?? 0}
              supplierCost={kpi?.total_supplier_cost ?? 0}
              expenses={kpi?.total_expenses ?? 0}
              taxRefund={kpi?.total_tax_refund ?? 0}
              finCharges={kpi?.total_financial_charges ?? 0}
              gross={kpi?.gross_profit ?? 0}
              net={kpi?.net_profit ?? 0}
              currency={currency}
            />
            <p className="mt-3 rounded-md bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-gray-400">
              <strong className="text-gray-300">Expected profit</strong> is the booked number on every order.
              <strong className="text-gray-300"> Realized cash</strong> is what&apos;s actually banked so far (Collected − Paid supplier − Paid expenses).
              <strong className="text-gray-300"> Cash Flow</strong> below tracks money in vs out across the whole business this period.
            </p>
          </SectionCard>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION C — Cash Position
            Trend chart + cash bars + expected vs realized. */}
        <SectionLabel index="C" title="Cash Position" hint="What's moving in, what's moving out, what's actually banked." />
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionCard
              title="Revenue vs Costs"
              subtitle={
                period === "week"
                  ? "Daily breakdown — last 7 days"
                  : period === "quarter"
                    ? "Weekly breakdown — last 90 days"
                    : "Monthly breakdown — last 12 months"
              }
            >
              {kpi && kpi.trend.length > 0 ? (
                <TrendChart data={kpi.trend} currency={currency} />
              ) : (
                <div className="flex h-44 items-center justify-center text-sm text-gray-500">
                  {loading ? "Loading trend…" : "No data yet for this period."}
                </div>
              )}
            </SectionCard>
          </div>
          <div className="grid grid-rows-2 gap-3">
            <SectionCard title="Cash Flow" subtitle="Money in vs money out">
              <div className="space-y-3.5">
                <CashRow label="Money In" value={kpi?.cash_in ?? 0} max={Math.max(kpi?.cash_in ?? 0, kpi?.cash_out ?? 0, 1)} color="emerald" />
                <CashRow label="Money Out" value={kpi?.cash_out ?? 0} max={Math.max(kpi?.cash_in ?? 0, kpi?.cash_out ?? 0, 1)} color="rose" />
                <div className="mt-2 border-t border-white/5 pt-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">Net cash this period</div>
                  <div className={`mt-0.5 text-xl font-semibold tabular-nums ${(kpi?.cash_in ?? 0) - (kpi?.cash_out ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {fmtMoney((kpi?.cash_in ?? 0) - (kpi?.cash_out ?? 0), currency, { compact: true })}
                  </div>
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Expected vs Realized" subtitle="Booked profit vs cash actually banked.">
              <div className="grid grid-cols-2 gap-2">
                <SmallStat
                  label="Expected Net"
                  value={kpi?.expected_vs_realized?.expected_net_profit ?? 0}
                  currency={currency}
                  accent={(kpi?.expected_vs_realized?.expected_net_profit ?? 0) >= 0 ? "violet" : "rose"}
                />
                <SmallStat
                  label="Realized Cash"
                  value={kpi?.expected_vs_realized?.realized_cash_position ?? 0}
                  currency={currency}
                  accent={(kpi?.expected_vs_realized?.realized_cash_position ?? 0) >= 0 ? "teal" : "rose"}
                />
                <SmallStat label="Collected" value={kpi?.expected_vs_realized?.collected ?? 0} currency={currency} accent="emerald" />
                <SmallStat label="Paid out"  value={(kpi?.expected_vs_realized?.paid_supplier ?? 0) + (kpi?.expected_vs_realized?.paid_expenses ?? 0)} currency={currency} accent="orange" />
              </div>
            </SectionCard>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION D — Risk & Alerts
            Live health reasons + AR/AP tile to focus operator attention. */}
        <SectionLabel index="D" title="Risk & Alerts" hint="Where to look first today." />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <RiskTile
            tone="amber"
            title="Money to Collect"
            value={kpi?.accounts_receivable ?? 0}
            currency={currency}
            note="Across all unpaid orders"
          />
          <RiskTile
            tone="orange"
            title="Money to Pay"
            value={kpi?.accounts_payable ?? 0}
            currency={currency}
            note="Suppliers + unpaid bills"
          />
          <RiskTile
            tone={kpi?.health_status === "stress" ? "rose" : kpi?.health_status === "watch" ? "fuchsia" : "emerald"}
            title="Health Signal"
            valueString={kpi?.health_status === "healthy" ? "Healthy" : kpi?.health_status === "watch" ? "Watch" : kpi?.health_status === "stress" ? "Stress" : "—"}
            note={kpi?.health_reasons?.[0] ?? "Composite read of profit + cash + overdue."}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION E — Top Insights
            Top profitable orders and biggest expense buckets. */}
        <SectionLabel index="E" title="Top Insights" hint="Where profit is being made — and where it's leaking." />
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <SectionCard title="Top Profitable Orders" subtitle="Ranked by net profit in this period.">
            {(kpi?.top_orders ?? []).length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">No orders yet for this period.</div>
            ) : (
              <ol className="space-y-2">
                {(kpi?.top_orders ?? []).map((o, idx) => (
                  <li key={o.id} className="group flex items-center justify-between rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] px-3 py-2.5 transition hover:border-white/[0.10]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-semibold text-emerald-300">{idx + 1}</span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{o.customer_name || "—"}</div>
                        <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-gray-500">
                          <span>{o.order_no}</span>
                          <span>·</span>
                          <span>{fmtMoney(o.selling_price, o.currency, { compact: true })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold tabular-nums ${o.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtMoney(o.net_profit, o.currency, { compact: true })}</div>
                      <div className={`text-[10px] ${o.net_profit_pct >= 15 ? "text-emerald-400" : o.net_profit_pct >= 0 ? "text-amber-400" : "text-rose-400"}`}>{fmtPct(o.net_profit_pct)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard title="Top Expense Categories" subtitle="Biggest spend buckets in this period.">
            {(kpi?.top_expense_categories ?? []).length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">No expenses recorded for this period.</div>
            ) : (
              <ul className="space-y-2">
                {(kpi?.top_expense_categories ?? []).map((c) => {
                  const style = styleForCategory(c.name);
                  return (
                    <li key={c.name} className={`rounded-lg border ${accentBgClass(style.accent)} bg-[var(--bg-primary)]/50 px-3 py-2.5`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{style.glyph}</span>
                          <div>
                            <div className="text-sm font-medium">{c.name}</div>
                            <div className="text-[10px] text-gray-500">{c.count} {c.count === 1 ? "item" : "items"}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold tabular-nums">{fmtMoney(c.total, currency, { compact: true })}</div>
                          <div className="text-[10px] text-gray-500">{c.share_pct.toFixed(0)}% of spend</div>
                        </div>
                      </div>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
                        <div className={`h-full ${accentSolidBg(style.accent)}`} style={{ width: `${Math.max(3, c.share_pct)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/* ── Section label — a small letter + title row that separates the
   dashboard into named blocks. Matches the way executive dashboards
   in finance apps usually structure content. */
function SectionLabel({ index, title, hint }: { index: string; title: string; hint?: string }) {
  return (
    <div className="mt-8 flex items-end justify-between gap-3 border-b border-white/[0.04] pb-2">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.06] bg-[var(--bg-secondary)] text-[10px] font-semibold text-gray-400">
          {index}
        </span>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-gray-300">{title}</h2>
      </div>
      {hint && <p className="hidden text-[11px] text-gray-500 sm:block">{hint}</p>}
    </div>
  );
}

function SmallStat({ label, value, currency, accent }: {
  label: string;
  value: number;
  currency: string;
  accent: "emerald" | "rose" | "amber" | "sky" | "violet" | "teal" | "orange" | "fuchsia" | "lime" | "cyan" | "indigo" | "blue";
}) {
  const color =
    accent === "emerald" ? "text-emerald-400"
    : accent === "rose"  ? "text-rose-400"
    : accent === "amber" ? "text-amber-400"
    : accent === "sky"   ? "text-sky-400"
    : accent === "teal"  ? "text-teal-400"
    : accent === "orange"? "text-orange-400"
    : accent === "fuchsia"? "text-fuchsia-400"
    : accent === "lime"  ? "text-lime-400"
    : accent === "cyan"  ? "text-cyan-400"
    : accent === "indigo"? "text-indigo-400"
    : accent === "blue"  ? "text-blue-400"
    : "text-violet-400";
  return (
    <div className="rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] p-2.5">
      <div className="text-[9px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold tabular-nums ${color}`}>{fmtMoney(value, currency, { compact: true })}</div>
    </div>
  );
}

function CashRow({ label, value, max, color }: { label: string; value: number; max: number; color: "emerald" | "rose" }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  const bg = color === "emerald" ? "bg-emerald-500" : "bg-rose-500";
  const txt = color === "emerald" ? "text-emerald-400" : "text-rose-400";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-400">{label}</span>
        <span className={`font-semibold tabular-nums ${txt}`}>{fmtMoney(value, "USD", { compact: true })}</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* RiskTile — used by the "Risk & Alerts" row. Tone drives the
   border + bg so the operator can scan at a glance. Each of the
   three tiles in that row uses a different tone so no two cards
   on the page share a colour. */
function RiskTile({
  tone, title, value, valueString, currency, note,
}: {
  tone: "emerald" | "amber" | "orange" | "rose" | "fuchsia" | "neutral";
  title: string;
  value?: number;
  valueString?: string;
  currency?: string;
  note?: string;
}) {
  const cls =
    tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/[0.05]"
    : tone === "amber"  ? "border-amber-500/30 bg-amber-500/[0.05]"
    : tone === "orange" ? "border-orange-500/30 bg-orange-500/[0.05]"
    : tone === "fuchsia"? "border-fuchsia-500/30 bg-fuchsia-500/[0.05]"
    : tone === "rose"   ? "border-rose-500/40 bg-rose-500/[0.06]"
    : "border-white/[0.06] bg-[var(--bg-secondary)]";
  const valueClass =
    tone === "emerald" ? "text-emerald-300"
    : tone === "amber"  ? "text-amber-300"
    : tone === "orange" ? "text-orange-300"
    : tone === "fuchsia"? "text-fuchsia-300"
    : tone === "rose"   ? "text-rose-300"
    : "text-gray-300";
  return (
    <div className={`rounded-2xl border p-5 ${cls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">{title}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${valueClass}`}>
        {valueString ?? fmtMoney(value ?? 0, currency ?? "USD", { compact: true })}
      </div>
      {note && <p className="mt-1.5 text-[11px] text-gray-400">{note}</p>}
    </div>
  );
}

function ProfitWaterfall({
  revenue, supplierCost, expenses, taxRefund, finCharges, gross, net, currency,
}: {
  revenue: number; supplierCost: number; expenses: number; taxRefund: number;
  finCharges: number; gross: number; net: number; currency: string;
}) {
  const steps = [
    { label: "Revenue",         value: revenue,      sign: 1,  color: "emerald" as const },
    { label: "− Supplier cost", value: supplierCost, sign: -1, color: "rose"    as const },
    { label: "= Gross profit",  value: gross,        sign: 1,  color: "sky"     as const, total: true },
    { label: "− Order expenses",value: expenses,     sign: -1, color: "rose"    as const },
    { label: "+ Tax refund",    value: taxRefund,    sign: 1,  color: "emerald" as const },
    { label: "− Bank charges",  value: finCharges,   sign: -1, color: "rose"    as const },
    { label: "= Net profit",    value: net,          sign: 1,  color: "violet"  as const, total: true },
  ];
  const max = Math.max(
    1, revenue,
    Math.abs(supplierCost), Math.abs(expenses), Math.abs(taxRefund),
    Math.abs(finCharges), Math.abs(gross), Math.abs(net),
  );
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {steps.map((s, i) => {
        const pct = (Math.abs(s.value) / max) * 100;
        const bg =
          s.color === "emerald" ? "bg-emerald-500/30 border-emerald-500/30"
          : s.color === "rose"  ? "bg-rose-500/30 border-rose-500/30"
          : s.color === "sky"   ? "bg-sky-500/30 border-sky-500/30"
          : "bg-violet-500/30 border-violet-500/30";
        const txt =
          s.color === "emerald" ? "text-emerald-400"
          : s.color === "rose"  ? "text-rose-400"
          : s.color === "sky"   ? "text-sky-400"
          : "text-violet-400";
        return (
          <div key={i} className={`relative rounded-xl border border-white/[0.06] bg-[var(--bg-primary)] p-4 ${s.total ? "ring-1 ring-white/10" : ""}`}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">{s.label}</div>
            <div className={`mt-2 text-lg font-semibold tabular-nums ${txt}`}>
              {s.sign < 0 ? "−" : ""}{fmtMoney(Math.abs(s.value), currency, { compact: true })}
            </div>
            <div className={`mt-3 h-1.5 w-full rounded-full border ${bg}`}>
              <div className={`h-full rounded-full ${bg.split(" ")[0]}`} style={{ width: `${Math.max(pct, 4)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
