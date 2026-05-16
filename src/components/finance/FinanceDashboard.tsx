"use client";

/* ===========================================================================
   Finance Dashboard  —  Phase 1.7 operational-intelligence rebuild.

   Two coexisting views inside one page, switched by ModeToggle:

     OPERATIONAL  (default)
       0. Header (title · health · period · mode)
       1. Prioritised WorkflowRail (most-pressure first)
       2. Hero KPIs · secondary metrics
       3. Trend chart
       4. Incoming-cash + Supplier-due timelines + Liquidity meter
       5. AR + AP aging buckets
       6. Intelligence cards + anomaly signals
       7. Profit flow waterfall
       8. Top orders + top categories

     EXECUTIVE
       0. Header (same)
       1. Liquidity / Pressure / CCC strip
       2. Hero KPIs (compact stat row)
       3. AR + AP aging
       4. Concentration exposure (customer + supplier)
       5. Margin trend + anomaly callouts
       6. Trend chart (for context, smaller)
       7. Profit flow waterfall

   No backend, schema, or calc changes — every new surface is derived
   from data the existing endpoints already return.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import {
  AgingTable,
  AnomalyChip,
  AreaChart,
  ChartCard,
  ConcentrationBar,
  HeroKpiCard,
  InsightCard,
  LiquidityMeter,
  MetricCard,
  ModeToggle,
  SectionTitle,
  StatRow,
  TimelineStrip,
  WorkflowRail,
  formatCompact,
  type FinanceMode,
  type InsightSeverity,
  type Tone,
  type WorkflowItem,
} from "@/components/finance/FinanceUiX";
import { PeriodTabs } from "@/components/finance/FinanceUi";
import { fmtMoney, fmtPct } from "@/lib/finance/calc";
import { styleForCategory } from "@/components/finance/categoryStyles";
/* Phase 2.5 — operational guidance layer. */
import GuidanceTip from "@/components/ui/GuidanceTip";
import type {
  BankAccount,
  CashMovement,
  DashboardKpi,
  DashboardPeriod,
  FinanceExpense,
  FinanceOrder,
  FinancePayment,
} from "@/lib/finance/types";
import {
  buildIncomingTimeline,
  buildOutgoingTimeline,
  computeApAging,
  computeArAging,
  computeCCC,
  computeConcentration,
  detectAnomalies,
  prioritiseWorkflow,
  projectLiquidity,
  overallPressure,
  type Pressure,
  type WorkflowKey,
} from "@/lib/finance/intelligence";
/* Phase 2.0 — cross-module operational intelligence.
   Phase 2.0.1 — adds the memory-aware pipeline (materiality gate,
   noise suppression, persistence annotation, executive digest). */
import {
  buildIntelligence as buildBusinessIntelligence,
  loadMemory,
  saveMemory,
  type MemoryState,
} from "@/lib/intelligence";

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "week",    label: "Week" },
  { value: "quarter", label: "Quarter" },
  { value: "year",    label: "Year" },
];

const MODE_STORAGE_KEY = "koleex-finance-mode";

export default function FinanceDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>("quarter");
  const [mode, setMode] = useState<FinanceMode>("operational");
  const [kpi, setKpi] = useState<DashboardKpi | null>(null);
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  /* Phase 2.0: pull payments + expenses so the cross-module intelligence
     layer can build customer behavior, supplier dependency, logistics
     buckets, and event correlations. All from existing endpoints. */
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  /* Phase 2.4 — treasury inputs (bank accounts + cash movements). */
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);

  /* Restore last-used mode from localStorage on mount (client only). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (saved === "operational" || saved === "executive") setMode(saved);
  }, []);
  const setModePersist = useCallback((m: FinanceMode) => {
    setMode(m);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MODE_STORAGE_KEY, m);
    }
  }, []);

  const load = useCallback(async (p: DashboardPeriod) => {
    setLoading(true);
    try {
      const [dashRes, ordersRes, paymentsRes, expensesRes, treasuryRes] = await Promise.all([
        fetch(`/api/finance/dashboard?period=${p}`, { cache: "no-store" }),
        fetch(`/api/finance/orders`, { cache: "no-store" }),
        fetch(`/api/finance/payments`, { cache: "no-store" }),
        fetch(`/api/finance/expenses`, { cache: "no-store" }),
        fetch(`/api/finance/treasury`,  { cache: "no-store" }),
      ]);
      const j = (await dashRes.json()) as { kpi?: DashboardKpi };
      setKpi(j.kpi ?? null);
      const ordersBody = (await ordersRes.json().catch(() => ({}))) as { orders?: FinanceOrder[] };
      setOrders(Array.isArray(ordersBody.orders) ? ordersBody.orders : []);
      const paymentsBody = (await paymentsRes.json().catch(() => ({}))) as { payments?: FinancePayment[] };
      setPayments(Array.isArray(paymentsBody.payments) ? paymentsBody.payments : []);
      const expensesBody = (await expensesRes.json().catch(() => ({}))) as { expenses?: FinanceExpense[] };
      setExpenses(Array.isArray(expensesBody.expenses) ? expensesBody.expenses : []);
      const treasuryBody = (await treasuryRes.json().catch(() => ({}))) as { accounts?: BankAccount[]; movements?: CashMovement[] };
      setBankAccounts(Array.isArray(treasuryBody.accounts) ? treasuryBody.accounts : []);
      setCashMovements(Array.isArray(treasuryBody.movements) ? treasuryBody.movements : []);
    } catch {
      setKpi(null);
      setOrders([]);
      setPayments([]);
      setExpenses([]);
      setBankAccounts([]);
      setCashMovements([]);
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

  /* Intelligence layer */
  const intelligence    = useMemo(() => buildIntelligence(kpi, period), [kpi, period]);
  const arAging         = useMemo(() => computeArAging(orders), [orders]);
  const apAging         = useMemo(() => computeApAging(orders), [orders]);
  const incomingTimeline = useMemo(() => buildIncomingTimeline(orders), [orders]);
  const outgoingTimeline = useMemo(() => buildOutgoingTimeline(orders), [orders]);
  const liquidity       = useMemo(
    () => projectLiquidity(kpi, period, incomingTimeline, outgoingTimeline),
    [kpi, period, incomingTimeline, outgoingTimeline],
  );
  const anomalies       = useMemo(() => detectAnomalies(kpi), [kpi]);
  const concentration   = useMemo(() => computeConcentration(kpi, orders), [kpi, orders]);
  const ccc             = useMemo(() => computeCCC(kpi, period), [kpi, period]);
  const pressure        = useMemo(() => overallPressure(kpi), [kpi]);

  /* Dynamic workflow rail — sorted by current pressure */
  const workflowItems   = useMemo(
    () => buildWorkflowItems(kpi, prioritiseWorkflow(kpi)),
    [kpi],
  );

  /* ── Phase 2.0 cross-module operational intelligence.
     Phase 2.0.1 wires the calibration pipeline: load prior memory →
     build picture (materiality + suppression + priority + persistence
     annotation + correlation confidence + EMA-smoothed health +
     executive digest) → persist memory for the next run. */
  const periodDays = period === "week" ? 7 : period === "quarter" ? 90 : 365;
  const memoryRef = useMemo<MemoryState | null>(() => loadMemory(), []);
  const businessIntelligence = useMemo(
    () => buildBusinessIntelligence({
      kpi,
      orders,
      payments,
      expenses,
      bankAccounts,
      cashMovements,
      periodDays,
      memory: memoryRef,
    }),
    [kpi, orders, payments, expenses, bankAccounts, cashMovements, periodDays, memoryRef],
  );
  useEffect(() => {
    /* Persist the next-memory snapshot after each successful build so
       the next run can reason about persistence + smooth the health. */
    if (!loading) saveMemory(businessIntelligence.nextMemory);
  }, [businessIntelligence, loading]);

  /* Publish proactive Copilot context whenever the operational picture
     changes. FloatingPanel listens and renders these as suggestion
     chips in the empty-state, so the Copilot feels situationally aware
     before the operator types anything. Phase 2.0: hints now come from
     the cross-module intelligence — correlations first, then events. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hints = businessIntelligence.copilotHints.map((h) => ({
      key: h.key,
      text: h.text,
      severity: h.severity === "critical" ? "risk" : h.severity === "info" ? "info" : h.severity,
    }));
    window.dispatchEvent(new CustomEvent("koleex:copilot-context", { detail: { hints } }));
    return () => {
      window.dispatchEvent(new CustomEvent("koleex:copilot-context", { detail: { hints: [] } }));
    };
  }, [businessIntelligence]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        <FinanceHeader
          title="Financial Intelligence"
          subtitle={pressureHeadline(pressure, intelligence.headline)}
          health={kpi?.health_status}
          controls={
            <div className="flex flex-wrap items-center gap-2.5">
              <PeriodTabs<DashboardPeriod> value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
              <ModeToggle value={mode} onChange={setModePersist} />
            </div>
          }
        />

        {/* ── Phase 2.0 — Cross-module pressure narrative.
           Calm one-block panel showing business health pulse + the
           top correlation. Sits in both modes so the operator always
           sees the connected-system reading first. */}
        <CrossModulePressurePanel intel={businessIntelligence} />
        <ApprovalOperationsPanel intel={businessIntelligence} />
        <PaymentOperationsPanel intel={businessIntelligence} />
        <TreasuryOperationsPanel intel={businessIntelligence} />

        {mode === "operational" ? (
          <OperationalView
            kpi={kpi}
            loading={loading}
            currency={currency}
            sparklines={sparklines}
            period={period}
            intelligence={intelligence}
            anomalies={anomalies}
            workflowItems={workflowItems}
            arAging={arAging}
            apAging={apAging}
            incomingTimeline={incomingTimeline}
            outgoingTimeline={outgoingTimeline}
            liquidity={liquidity}
          />
        ) : (
          <ExecutiveView
            kpi={kpi}
            loading={loading}
            currency={currency}
            sparklines={sparklines}
            period={period}
            anomalies={anomalies}
            arAging={arAging}
            apAging={apAging}
            liquidity={liquidity}
            concentration={concentration}
            ccc={ccc}
            pressure={pressure}
          />
        )}
      </div>
    </div>
  );
}

/* ===========================================================================
   Operational view  —  workflows first, queues, then narrative.
   ========================================================================== */

function OperationalView({
  kpi, loading, currency, sparklines, period, intelligence, anomalies,
  workflowItems, arAging, apAging, incomingTimeline, outgoingTimeline, liquidity,
}: {
  kpi: DashboardKpi | null;
  loading: boolean;
  currency: string;
  sparklines: { revenue: number[]; expenses: number[]; net_profit: number[]; labels: string[] };
  period: DashboardPeriod;
  intelligence: ReturnType<typeof buildIntelligence>;
  anomalies: ReturnType<typeof detectAnomalies>;
  workflowItems: WorkflowItem[];
  arAging: ReturnType<typeof computeArAging>;
  apAging: ReturnType<typeof computeApAging>;
  incomingTimeline: ReturnType<typeof buildIncomingTimeline>;
  outgoingTimeline: ReturnType<typeof buildOutgoingTimeline>;
  liquidity: ReturnType<typeof projectLiquidity>;
}) {
  /* Top anomalies surfaced inline above the WorkflowRail when meaningful */
  const topAnomalies = anomalies.filter((a) => a.severity !== "info").slice(0, 3);

  /* Find revenue / net_profit anomalies for inline KPI chips */
  const revenueAnomaly = anomalies.find((a) => a.key === "delta-revenue");
  const netProfitAnomaly = anomalies.find((a) => a.key === "delta-net_profit");

  return (
    <>
      {/* ── 0. WORKFLOW QUEUE — prioritised by current pressure ─── */}
      <div className="mt-4">
        <WorkflowRail items={workflowItems} />
      </div>

      {/* ── Pressure callout strip (only if material anomalies) ── */}
      {topAnomalies.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.012] px-3 py-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Pressure</span>
          {topAnomalies.map((a) => (
            <AnomalyChip
              key={a.key}
              text={a.label}
              severity={a.severity}
              direction={a.direction === "up" ? "up" : a.direction === "down" ? "down" : undefined}
            />
          ))}
        </div>
      )}

      {/* ── 1. PRIMARY HEROES ────────────────────────────────── */}
      <SectionTitle eyebrow="At a glance" title="Performance this period" helpId="finance.section.atGlance" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="relative">
          <HeroKpiCard
            label="Revenue"
            helpId="finance.revenue"
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
          {revenueAnomaly && revenueAnomaly.severity !== "info" && (
            <div className="absolute right-4 top-4">
              <AnomalyChip text={revenueAnomaly.label} severity={revenueAnomaly.severity} direction={revenueAnomaly.direction === "up" ? "up" : "down"} />
            </div>
          )}
        </div>
        <div className="relative">
          <HeroKpiCard
            label="Net Profit"
            helpId="finance.netProfit"
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
          {netProfitAnomaly && netProfitAnomaly.severity !== "info" && (
            <div className="absolute right-4 top-4">
              <AnomalyChip text={netProfitAnomaly.label} severity={netProfitAnomaly.severity} direction={netProfitAnomaly.direction === "up" ? "up" : "down"} />
            </div>
          )}
        </div>
      </div>

      {/* ── 2. SECONDARY METRICS ────────────────────────────── */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Cash In"  helpId="finance.cashIn"  value={kpi?.cash_in  ?? 0} unit={currency} delta={kpi?.delta.cash_in_pct  ?? null} hint="Customer payments received" loading={loading} />
        <MetricCard label="Cash Out" helpId="finance.cashOut" value={kpi?.cash_out ?? 0} unit={currency} delta={kpi?.delta.cash_out_pct ?? null} hint="Suppliers + expenses paid" loading={loading} />
        <MetricCard label="Money to Collect" helpId="finance.accountsReceivable" value={kpi?.accounts_receivable ?? 0} unit={currency} tone="warning" hint="Outstanding receivables" loading={loading} />
        <MetricCard label="Money to Pay"     helpId="finance.accountsPayable"    value={kpi?.accounts_payable    ?? 0} unit={currency} tone="warning" hint="Suppliers + unpaid bills"   loading={loading} />
        <MetricCard
          label="Gross Margin"
          helpId="finance.grossMargin"
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

      {/* ── 3. TIMELINES + LIQUIDITY ──────────────────────── */}
      <SectionTitle eyebrow="Cash radar" title="What's moving in the next 45 days" description="Incoming collections, supplier dues, and forward liquidity." helpId="finance.section.cashRadar" />
      <div className="grid gap-3 lg:grid-cols-3">
        <TimelineStrip
          title="Incoming cash"
          direction="incoming"
          currency={currency}
          events={incomingTimeline}
        />
        <TimelineStrip
          title="Supplier dues"
          direction="outgoing"
          currency={currency}
          events={outgoingTimeline}
        />
        <LiquidityMeter
          d7={liquidity.d7}
          d30={liquidity.d30}
          d60={liquidity.d60}
          inflowShare={liquidity.inflowShare}
        />
      </div>

      {/* ── 4. AGING ─────────────────────────────────────── */}
      <SectionTitle eyebrow="Aging" title="Receivables and payables by age" description="Anything past 30 days is silently flagged." helpId="finance.section.aging" />
      <div className="grid gap-3 lg:grid-cols-2">
        <AgingTable title="AR aging" buckets={arAging} currency={currency} totalLabel="Customer side" />
        <AgingTable title="AP aging" buckets={apAging} currency={currency} totalLabel="Supplier side" />
      </div>

      {/* ── 5. CHART CARD ────────────────────────────────── */}
      <SectionTitle
        eyebrow="Trend"
        title="Revenue vs Costs"
        description={
          period === "week"   ? "Daily breakdown — last 7 days"
          : period === "quarter" ? "Weekly breakdown — last 90 days"
          : "Monthly breakdown — last 12 months"
        }
      />
      <ChartCard title="Cash flow over time" subtitle="Revenue is the inflow line; costs + expenses combine into the outflow line.">
        <AreaChart
          currency={currency}
          labels={sparklines.labels}
          height={280}
          series={[
            { name: "Revenue",          values: sparklines.revenue,    tone: "positive" },
            { name: "Costs + Expenses", values: sparklines.expenses,   tone: "negative" },
            { name: "Net profit",       values: sparklines.net_profit, tone: "info" },
          ]}
        />
      </ChartCard>

      {/* ── 6. INTELLIGENCE LAYER ───────────────────────── */}
      <SectionTitle eyebrow="Intelligence" title="What the numbers mean" description="Automatic interpretations of this period's signal." helpId="finance.section.intelligence" />
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

      {/* ── 7. PROFIT FLOW STORY ────────────────────────── */}
      <SectionTitle eyebrow="Profit flow" title="From revenue to net profit" description="Gross profit excludes tax refund; refund is added back separately before net profit." helpId="finance.section.profitFlow" />
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

      {/* ── 8. TOP INSIGHTS ────────────────────────────── */}
      <SectionTitle eyebrow="Top insights" title="Where profit is being made — and where it's leaking" helpId="finance.section.topInsights" />
      <div className="grid gap-3 lg:grid-cols-2">
        <TopOrdersCard kpi={kpi} currency={currency} />
        <TopCategoriesCard kpi={kpi} currency={currency} />
      </div>
    </>
  );
}

/* ===========================================================================
   Executive view  —  strategic surfaces only. No workflow rail. Calmer.
   ========================================================================== */

function ExecutiveView({
  kpi, loading, currency, sparklines, period,
  anomalies, arAging, apAging, liquidity, concentration, ccc, pressure,
}: {
  kpi: DashboardKpi | null;
  loading: boolean;
  currency: string;
  sparklines: { revenue: number[]; expenses: number[]; net_profit: number[]; labels: string[] };
  period: DashboardPeriod;
  anomalies: ReturnType<typeof detectAnomalies>;
  arAging: ReturnType<typeof computeArAging>;
  apAging: ReturnType<typeof computeApAging>;
  liquidity: ReturnType<typeof projectLiquidity>;
  concentration: ReturnType<typeof computeConcentration>;
  ccc: ReturnType<typeof computeCCC>;
  pressure: Pressure;
}) {
  /* Stat row — six executive-grade numbers, compressed. */
  const stats: { label: string; value: string; hint?: string; tone?: Tone; helpId?: string }[] = [
    {
      label: "Revenue",
      helpId: "finance.revenue",
      value: formatCompact(kpi?.total_revenue ?? 0),
      hint: `${currency} · ${period}`,
      tone: "positive",
    },
    {
      label: "Net profit",
      helpId: "finance.netProfit",
      value: formatCompact(kpi?.net_profit ?? 0),
      hint: `Margin ${(kpi?.gross_margin_pct ?? 0).toFixed(1)}%`,
      tone: (kpi?.net_profit ?? 0) >= 0 ? "info" : "negative",
    },
    {
      label: "AR exposure",
      helpId: "finance.accountsReceivable",
      value: formatCompact(kpi?.accounts_receivable ?? 0),
      hint: `${arAging.reduce((s, b) => s + b.count, 0)} open`,
      tone: "warning",
    },
    {
      label: "AP exposure",
      helpId: "finance.accountsPayable",
      value: formatCompact(kpi?.accounts_payable ?? 0),
      hint: `${apAging.reduce((s, b) => s + b.count, 0)} open`,
      tone: "warning",
    },
    {
      label: "DSO",
      helpId: "finance.dso",
      value: `${ccc.dso.toFixed(0)} d`,
      hint: "Days sales outstanding",
    },
    {
      label: "CCC",
      helpId: "finance.ccc",
      value: `${ccc.ccc.toFixed(0)} d`,
      hint: ccc.ccc >= 0 ? "Cash cycle gap" : "Cash cycle surplus",
      tone: ccc.ccc <= 30 ? "positive" : ccc.ccc <= 60 ? "warning" : "negative",
    },
  ];

  return (
    <>
      {/* ── 0. Pressure narrative ───────────────────── */}
      <div className="mt-4 rounded-2xl border border-white/[0.05] bg-white/[0.018] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Executive read</div>
            <div className="mt-1 text-[14px] text-gray-200">{liquidity.narrative}</div>
          </div>
          <PressurePill pressure={pressure} />
        </div>
      </div>

      {/* ── 1. STAT ROW — exec KPIs ──────────────── */}
      <div className="mt-3">
        <StatRow stats={loading ? stats.map((s) => ({ ...s, value: "—" })) : stats} />
      </div>

      {/* ── 2. LIQUIDITY + AGING ─────────────────── */}
      <SectionTitle eyebrow="Liquidity" title="Forward cash window + aging exposure" description="Projection blends steady-state trajectory with scheduled AR/AP." helpId="finance.liquidity" />
      <div className="grid gap-3 lg:grid-cols-3">
        <LiquidityMeter
          d7={liquidity.d7}
          d30={liquidity.d30}
          d60={liquidity.d60}
          inflowShare={liquidity.inflowShare}
        />
        <AgingTable title="AR aging" buckets={arAging} currency={currency} />
        <AgingTable title="AP aging" buckets={apAging} currency={currency} />
      </div>

      {/* ── 3. CONCENTRATION ─────────────────────── */}
      <SectionTitle eyebrow="Concentration" title="Revenue + cost-of-goods dependency" description="How exposed the business is to a single counterparty." helpId="finance.concentration" />
      <div className="grid gap-3 sm:grid-cols-2">
        <ConcentrationBar
          label="Top customer share"
          party={concentration.topCustomer?.name ?? "—"}
          share={concentration.topCustomer?.share ?? 0}
          hint={
            (concentration.topCustomer?.share ?? 0) >= 60 ? "Critical concentration — single counterparty risk."
            : (concentration.topCustomer?.share ?? 0) >= 40 ? "Material concentration."
            : "Healthy distribution."
          }
          severity={(concentration.topCustomer?.share ?? 0) >= 60 ? "risk" : (concentration.topCustomer?.share ?? 0) >= 40 ? "watch" : "info"}
        />
        <ConcentrationBar
          label="Top supplier share"
          party={concentration.topSupplier?.name ?? "—"}
          share={concentration.topSupplier?.share ?? 0}
          hint={
            (concentration.topSupplier?.share ?? 0) >= 70 ? "Critical dependency — single source of goods."
            : (concentration.topSupplier?.share ?? 0) >= 50 ? "Significant supplier dependency."
            : "Diversified supplier base."
          }
          severity={(concentration.topSupplier?.share ?? 0) >= 70 ? "risk" : (concentration.topSupplier?.share ?? 0) >= 50 ? "watch" : "info"}
        />
      </div>

      {/* ── 4. ANOMALY DIGEST ─────────────────────── */}
      {anomalies.length > 0 && (
        <>
          <SectionTitle eyebrow="Anomaly digest" title="Period-over-period deviations" description="Material movements worth a second look." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {anomalies.slice(0, 6).map((a) => (
              <InsightCard
                key={a.key}
                title={a.label}
                description={a.detail}
                severity={a.severity === "risk" ? "risk" : a.severity === "watch" ? "watch" : "neutral"}
              />
            ))}
          </div>
        </>
      )}

      {/* ── 5. TREND CHART — contextual, smaller ─── */}
      <SectionTitle eyebrow="Trend" title="Cash flow over time" />
      <ChartCard title="Revenue · costs · net profit" subtitle="Compressed for adaptive readability when spikes dominate.">
        <AreaChart
          currency={currency}
          labels={sparklines.labels}
          height={240}
          series={[
            { name: "Revenue",          values: sparklines.revenue,    tone: "positive" },
            { name: "Costs + Expenses", values: sparklines.expenses,   tone: "negative" },
            { name: "Net profit",       values: sparklines.net_profit, tone: "info" },
          ]}
        />
      </ChartCard>

      {/* ── 6. PROFIT FLOW ──────────────────────── */}
      <SectionTitle eyebrow="Profit flow" title="From revenue to net profit" />
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
    </>
  );
}

function PressurePill({ pressure }: { pressure: Pressure }) {
  const cls =
    pressure === "critical" ? "bg-rose-500/[0.14] text-rose-300 border-rose-500/[0.25]"
  : pressure === "risk"     ? "bg-rose-500/[0.10] text-rose-300/90 border-rose-500/[0.18]"
  : pressure === "watch"    ? "bg-amber-500/[0.10] text-amber-300 border-amber-500/[0.18]"
  :                           "bg-emerald-500/[0.08] text-emerald-300 border-emerald-500/[0.16]";
  const label =
    pressure === "critical" ? "Critical pressure"
  : pressure === "risk"     ? "Elevated pressure"
  : pressure === "watch"    ? "Mild pressure"
  :                           "Calm";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${cls}`}>
      <span aria-hidden className={"h-1.5 w-1.5 rounded-full " + (
        pressure === "critical" ? "bg-rose-400"
      : pressure === "risk"     ? "bg-rose-400"
      : pressure === "watch"    ? "bg-amber-300"
      :                           "bg-emerald-400"
      )} />
      {label}
    </span>
  );
}

function pressureHeadline(pressure: Pressure, fallback: string): string {
  if (pressure === "critical") return "Critical pressure across multiple dimensions — collection and payment cadence need attention.";
  if (pressure === "risk")     return "Elevated pressure on cash and exposure. " + fallback;
  if (pressure === "watch")    return "Mixed signals — minor pressure on at least one financial dimension. " + fallback;
  return fallback;
}

/* ---------------------------------------------------------------------------
   Intelligence layer  —  unchanged from Phase 1.6 (still pure).
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
   WorkflowRail builder  —  prioritised by current financial pressure.

   Each WorkflowKey from prioritiseWorkflow() maps to a tile with icon
   + label + hint + amount-badge. The tiles render in pressure order,
   so the most-urgent operation is always first.
   --------------------------------------------------------------------------- */
function buildWorkflowItems(
  kpi: DashboardKpi | null,
  priorities: ReturnType<typeof prioritiseWorkflow>,
): WorkflowItem[] {
  const arAmount = kpi?.accounts_receivable ?? 0;
  const apAmount = kpi?.accounts_payable ?? 0;

  const make = (key: WorkflowKey, pressureLabel: string): WorkflowItem => {
    switch (key) {
      case "follow-up": {
        const pressureTone: Tone =
          arAmount === 0 ? "positive"
          : arAmount > 0 && pressureLabel.startsWith("Severe") ? "negative"
          : arAmount > 0 && pressureLabel.startsWith("Material") ? "negative"
          : "warning";
        return {
          key,
          label: "Follow up collection",
          hint: pressureLabel,
          icon: <span aria-hidden>↘</span>,
          href: "/finance/customers",
          badge: arAmount > 0
            ? { text: formatCompact(arAmount), tone: pressureTone }
            : { text: "Clear", tone: "positive" },
        };
      }
      case "pay-suppliers": {
        const pressureTone: Tone =
          apAmount === 0 ? "positive"
          : pressureLabel.startsWith("AP exceeds AR materially") ? "negative"
          : pressureLabel.startsWith("AP exceeds AR margin") ? "negative"
          : "warning";
        return {
          key,
          label: "Pay suppliers",
          hint: pressureLabel,
          icon: <span aria-hidden>↗</span>,
          href: "/finance/suppliers",
          badge: apAmount > 0
            ? { text: formatCompact(apAmount), tone: pressureTone }
            : { text: "Clear", tone: "positive" },
        };
      }
      case "record-payment":
        return {
          key, label: "Record payment", hint: pressureLabel,
          icon: <span aria-hidden>≡</span>, href: "/finance/payments",
        };
      case "add-expense":
        return {
          key, label: "Add expense", hint: pressureLabel,
          icon: <span aria-hidden>△</span>, href: "/expenses",
        };
      case "new-order":
        return {
          key, label: "New order", hint: pressureLabel,
          icon: <span aria-hidden>＋</span>, href: "/finance/orders",
        };
      case "reminders":
        return {
          key, label: "Reminders", hint: pressureLabel,
          icon: <span aria-hidden>○</span>, href: "/finance/notifications",
        };
    }
  };

  return priorities.map((p) => make(p.key, p.reason));
}

/* ---------------------------------------------------------------------------
   ProfitFlow / TopOrdersCard / TopCategoriesCard — unchanged from 1.6.
   --------------------------------------------------------------------------- */
function ProfitFlow({
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

function TopOrdersCard({ kpi, currency }: { kpi: DashboardKpi | null; currency: string }) {
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

function TopCategoriesCard({ kpi, currency }: { kpi: DashboardKpi | null; currency: string }) {
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

/* ===========================================================================
   Cross-Module Pressure Panel  —  Phase 2.0

   The "business nervous system" surface. Renders three things:

     1. A composite health number (0..100) + pressure pill.
     2. A per-module health strip (Finance · Customer · Supplier ·
        Logistics · Inventory).
     3. The top cross-module correlation narrative if any — the
        causal story spanning modules, e.g. "Logistics costs
        compressing margin." Calm, single sentence.

   Designed to read like a Bloomberg ribbon: dense, monochrome,
   actionable in 1.5 seconds.
   ========================================================================== */

function CrossModulePressurePanel({ intel }: { intel: ReturnType<typeof buildBusinessIntelligence> }) {
  const { health, correlations, digest } = intel;
  const top = correlations[0];

  /* Quiet state when there's no real signal yet. */
  if (!intel.events.length && !top && digest.length === 0 && health.composite >= 95) {
    return null;
  }

  const compositeCls =
    health.pressure === "critical" ? "text-rose-300"
    : health.pressure === "risk"   ? "text-rose-300/90"
    : health.pressure === "watch"  ? "text-amber-300"
    :                                "text-emerald-300";

  const pressureChipCls =
    health.pressure === "critical" ? "bg-rose-500/[0.14] text-rose-300 border-rose-500/[0.25]"
    : health.pressure === "risk"   ? "bg-rose-500/[0.10] text-rose-300/90 border-rose-500/[0.18]"
    : health.pressure === "watch"  ? "bg-amber-500/[0.10] text-amber-300 border-amber-500/[0.18]"
    :                                "bg-emerald-500/[0.08] text-emerald-300 border-emerald-500/[0.16]";

  const pressureLabel =
    health.pressure === "critical" ? "Critical"
    : health.pressure === "risk"   ? "Risk"
    : health.pressure === "watch"  ? "Watch"
    :                                "Calm";

  return (
    <div className="mt-4 rounded-2xl border border-white/[0.05] bg-white/[0.018] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            <span>Business nervous system</span>
            <GuidanceTip guidanceId="intelligence.businessHealth" />
          </div>
          <div className="mt-1 text-[12px] text-gray-300">{health.headline}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${pressureChipCls}`}>
            <span aria-hidden className={
              "h-1.5 w-1.5 rounded-full " + (
                health.pressure === "critical" ? "bg-rose-400"
                : health.pressure === "risk"   ? "bg-rose-400"
                : health.pressure === "watch"  ? "bg-amber-300"
                :                                "bg-emerald-400"
              )
            } />
            {pressureLabel} pressure
          </span>
          <div className={`text-[22px] font-medium tabular-nums tracking-tight ${compositeCls}`}>
            {health.composite}
            <span className="ml-1 text-[10px] uppercase tracking-[0.18em] text-gray-500">health</span>
          </div>
        </div>
      </div>

      {/* Per-module strip */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {health.dimensions.map((d) => {
          const tone =
            d.pressure === "critical" ? "bg-rose-300/55"
            : d.pressure === "risk"   ? "bg-rose-300/40"
            : d.pressure === "watch"  ? "bg-amber-300/45"
            :                           "bg-emerald-300/40";
          const label =
            d.module === "finance"   ? "Finance"
          : d.module === "customer"  ? "Customer"
          : d.module === "supplier"  ? "Supplier"
          : d.module === "logistics" ? "Logistics"
          : d.module === "inventory" ? "Inventory"
          : d.module === "crm"       ? "Pipeline"
          : d.module;
          return (
            <div key={d.module} className="rounded-lg border border-white/[0.04] bg-white/[0.012] px-2.5 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{label}</span>
                <span className="text-[12px] font-medium tabular-nums text-gray-200">{d.score}</span>
              </div>
              <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <div className={`h-full ${tone}`} style={{ width: `${Math.max(3, Math.min(100, d.score))}%` }} />
              </div>
              <div className="mt-1 truncate text-[10px] text-gray-500">{d.driver}</div>
            </div>
          );
        })}
      </div>

      {/* Executive digest — 3-5 curated narratives.
         Phase 2.0.1: each digest item carries a kind chip
         (PRESSURE / RISK / DEPENDENCY / IMPROVEMENT / OPPORTUNITY)
         and a confidence/state marker when relevant. The system stays
         silent if nothing material is happening — no padding hints. */}
      {digest.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {digest.map((d) => {
            const sevDot =
              d.severity === "critical" ? "bg-rose-400"
              : d.severity === "risk"   ? "bg-rose-400"
              : d.severity === "watch"  ? "bg-amber-300"
              :                           "bg-white/40";
            const kindLabel =
              d.kind === "biggest_pressure"    ? "Pressure"
              : d.kind === "biggest_risk"       ? "Risk"
              : d.kind === "biggest_dependency" ? "Dependency"
              : d.kind === "biggest_improvement"? "Improving"
              :                                    "Opportunity";
            const kindCls =
              d.kind === "biggest_improvement"  ? "bg-emerald-500/[0.10] text-emerald-300/90 border-emerald-500/[0.18]"
              : d.kind === "biggest_opportunity" ? "bg-white/[0.05] text-gray-300 border-white/[0.06]"
              : d.severity === "risk" || d.severity === "critical"
                ? "bg-rose-500/[0.10] text-rose-300/90 border-rose-500/[0.18]"
                : "bg-amber-500/[0.10] text-amber-300 border-amber-500/[0.18]";
            return (
              <li key={d.key} className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.012] px-3 py-2.5">
                <span aria-hidden className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${sevDot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] ${kindCls}`}>
                      {kindLabel}
                    </span>
                    {d.state === "worsening" && (
                      <span className="rounded-full bg-rose-500/[0.10] px-1.5 py-0.5 text-[9px] font-medium text-rose-300/90">Worsening</span>
                    )}
                    {d.state === "recurring" && (
                      <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-gray-400">Persisting</span>
                    )}
                    {d.confidence != null && d.confidence >= 0.85 && (
                      <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-gray-500">
                        {Math.round(d.confidence * 100)}% conf
                      </span>
                    )}
                    <span className="text-[11px] font-semibold tracking-tight text-gray-200">{d.headline}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{d.narrative}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Top cross-module correlation when no curated digest, as a fallback. */}
      {digest.length === 0 && top && (
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.012] px-3 py-2.5">
          <span aria-hidden className={
            "mt-1 h-1.5 w-1.5 shrink-0 rounded-full " + (
              top.severity === "critical" ? "bg-rose-400"
              : top.severity === "risk"   ? "bg-rose-400"
              : top.severity === "watch"  ? "bg-amber-300"
              :                             "bg-white/40"
            )
          } />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-tight text-gray-200">{top.headline}</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{top.narrative}</div>
          </div>
          {correlations.length > 1 && (
            <span className="shrink-0 rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[10px] tabular-nums text-gray-400">
              +{correlations.length - 1} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
   ApprovalOperationsPanel  —  Phase 2.2.1

   Calm one-block panel that surfaces approval-operations state on the
   dashboard. Mirrors the CrossModulePressurePanel vocabulary:

     · header: title + approval-health number + pressure pill
     · backlog stat row (count · value · oldest · cycle time)
     · 5-bucket aging mini-table
     · top reviewer line (only when material concentration exists)

   The panel **renders nothing** when there's no operational pressure
   and no backlog — keeps the dashboard quiet by default.
   ========================================================================== */

function ApprovalOperationsPanel({ intel }: { intel: ReturnType<typeof buildBusinessIntelligence> }) {
  const a = intel.approval;
  /* UX-validation pass: avoid surfacing a dedicated panel for trivial
     backlogs. The events stream + Copilot already carry small backlog
     signals where they belong (digest / Copilot hints); the panel
     surfaces only when there's something a CFO would actually scan
     for — backlog ≥ 3 OR an item ≥ 7 days old OR non-calm pressure. */
  const meaningful =
    a.backlog.count >= 3 ||
    a.backlog.oldestDays >= 7 ||
    a.pressure !== "calm";
  if (!meaningful) return null;

  const pressureCls =
    a.pressure === "critical" ? "bg-rose-500/[0.14] text-rose-300 border-rose-500/[0.25]"
    : a.pressure === "risk"   ? "bg-rose-500/[0.10] text-rose-300/90 border-rose-500/[0.18]"
    : a.pressure === "watch"  ? "bg-amber-500/[0.10] text-amber-300 border-amber-500/[0.18]"
    :                           "bg-emerald-500/[0.08] text-emerald-300 border-emerald-500/[0.16]";
  const pressureDot =
    a.pressure === "critical" ? "bg-rose-400"
    : a.pressure === "risk"   ? "bg-rose-400"
    : a.pressure === "watch"  ? "bg-amber-300"
    :                           "bg-emerald-400";
  const scoreCls =
    a.pressure === "critical" ? "text-rose-300"
    : a.pressure === "risk"   ? "text-rose-300/90"
    : a.pressure === "watch"  ? "text-amber-300"
    :                           "text-emerald-300";

  /* Top reviewer is only meaningful when at least 5 are pending. */
  const top = a.workload[0];
  const showTopReviewer = !!top && top.reviewerName !== "Unassigned" && a.backlog.count >= 5;

  return (
    <div className="mt-3 rounded-2xl border border-white/[0.05] bg-white/[0.018] p-4">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            <span>Approval operations</span>
            <GuidanceTip guidanceId="approval.health" />
          </div>
          {a.read && <div className="mt-1 text-[12px] text-gray-300">{a.read}</div>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${pressureCls}`}>
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${pressureDot}`} />
            {a.pressure === "calm" ? "Calm" : a.pressure === "watch" ? "Watch" : a.pressure === "risk" ? "Risk" : "Critical"}
          </span>
          <div className={`text-[22px] font-medium tabular-nums tracking-tight ${scoreCls}`}>
            {a.healthScore}
            <span className="ml-1 text-[10px] uppercase tracking-[0.18em] text-gray-500">health</span>
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Pending" value={a.backlog.count.toString()} />
        <StatTile label="Held value" value={formatCompactUsd(a.backlog.totalValue)} unit="USD" />
        <StatTile
          label="Oldest"
          value={a.backlog.oldestDays > 0 ? `${a.backlog.oldestDays}d` : "—"}
          tone={a.backlog.oldestDays >= 14 ? "rose" : a.backlog.oldestDays >= 7 ? "amber" : "neutral"}
        />
        <StatTile
          label="Cycle"
          value={a.cycle.avgCycleDays > 0 ? `${a.cycle.avgCycleDays.toFixed(1)}d` : "—"}
          hint={a.cycle.trendPct >= 8 ? `↑ ${a.cycle.trendPct.toFixed(0)}% vs prior` : undefined}
          tone={a.cycle.trendPct >= 50 ? "amber" : "neutral"}
        />
      </div>

      {/* Aging mini-grid */}
      {a.backlog.count > 0 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {a.aging.map((b) => {
            const critical = b.key === "14_plus" || b.key === "8_14d";
            const watch    = b.key === "4_7d";
            const valueCls = critical ? "text-rose-300" : watch ? "text-amber-200" : "text-gray-200";
            const barCls   = critical ? "bg-rose-300/60" : watch ? "bg-amber-300/60" : "bg-white/40";
            const maxValue = Math.max(1, ...a.aging.map((x) => x.totalValue));
            return (
              <div key={b.key} className="rounded-lg border border-white/[0.04] bg-white/[0.01] px-2 py-1.5">
                <div className="text-[9px] uppercase tracking-[0.16em] text-gray-500">{b.label}</div>
                <div className={`mt-0.5 text-[13px] font-medium tabular-nums tracking-tight ${valueCls}`}>
                  {b.count}
                </div>
                <div className="mt-0.5 text-[9px] text-gray-600 tabular-nums">{formatCompactUsd(b.totalValue)}</div>
                <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                  <div className={`h-full ${barCls}`} style={{ width: `${Math.max(3, (b.totalValue / maxValue) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top reviewer concentration line */}
      {showTopReviewer && top && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.012] px-3 py-2">
          <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${(top.backlogShare ?? 0) >= 0.8 ? "bg-rose-400" : (top.backlogShare ?? 0) >= 0.6 ? "bg-amber-300" : "bg-white/40"}`} />
          <div className="min-w-0 flex-1 text-[11px] text-gray-300">
            <span className="font-medium">{top.reviewerName}</span>
            <span className="text-gray-500"> · </span>
            <span className="tabular-nums">{top.pendingCount} pending</span>
            <span className="text-gray-500"> · </span>
            <span className="tabular-nums">{Math.round((top.backlogShare ?? 0) * 100)}% of queue</span>
            {top.avgLatencyDays > 0 && (
              <>
                <span className="text-gray-500"> · </span>
                <span className="tabular-nums">avg {top.avgLatencyDays.toFixed(1)}d</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({
  label, value, unit, hint, tone = "neutral", helpId,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: "neutral" | "amber" | "rose";
  /** Phase 2.5 — optional guidance-registry id for a "?" affordance
   *  next to the tile label. Off by default so existing tiles stay
   *  visually untouched. */
  helpId?: string;
}) {
  const valueCls =
    tone === "rose"  ? "text-rose-300"
    : tone === "amber" ? "text-amber-200"
    :                    "text-gray-200";
  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.012] px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-gray-500">
        <span>{label}</span>
        {helpId && <GuidanceTip guidanceId={helpId} />}
      </div>
      <div className={`mt-1 text-[15px] font-medium tabular-nums tracking-tight ${valueCls}`}>
        {value}
        {unit && <span className="ml-1 text-[10px] text-gray-500">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-gray-500">{hint}</div>}
    </div>
  );
}

function formatCompactUsd(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
  if (abs >= 1_000)     return (n / 1_000).toFixed(abs >= 10_000 ? 1 : 2) + "K";
  return n.toFixed(0);
}

/* ===========================================================================
   PaymentOperationsPanel  —  Phase 2.3

   Calm one-block panel that surfaces payment-control state on the
   dashboard. Mirrors ApprovalOperationsPanel.

     · header: pressure pill + composite health
     · 4-tile stat row (pending approval · unreconciled · mismatches · missing evidence)
     · narrative read

   Renders nothing when everything is calm — quiet by default.
   ========================================================================== */

function PaymentOperationsPanel({ intel }: { intel: ReturnType<typeof buildBusinessIntelligence> }) {
  const p = intel.payment;
  const meaningful =
    p.pendingApproval.count >= 1 && p.pendingApproval.totalValue >= 10_000 ||
    p.reconciliation.unreconciledCount >= 1 ||
    p.reconciliation.mismatchCount >= 1 ||
    p.evidence.missingCount >= 2 ||
    p.failedCount >= 1 ||
    p.pressure !== "calm";
  if (!meaningful) return null;

  const pressureCls =
    p.pressure === "critical" ? "bg-rose-500/[0.14] text-rose-300 border-rose-500/[0.25]"
    : p.pressure === "risk"   ? "bg-rose-500/[0.10] text-rose-300/90 border-rose-500/[0.18]"
    : p.pressure === "watch"  ? "bg-amber-500/[0.10] text-amber-300 border-amber-500/[0.18]"
    :                           "bg-emerald-500/[0.08] text-emerald-300 border-emerald-500/[0.16]";
  const pressureDot =
    p.pressure === "critical" ? "bg-rose-400"
    : p.pressure === "risk"   ? "bg-rose-400"
    : p.pressure === "watch"  ? "bg-amber-300"
    :                           "bg-emerald-400";
  const scoreCls =
    p.pressure === "critical" ? "text-rose-300"
    : p.pressure === "risk"   ? "text-rose-300/90"
    : p.pressure === "watch"  ? "text-amber-300"
    :                           "text-emerald-300";

  return (
    <div className="mt-3 rounded-2xl border border-white/[0.05] bg-white/[0.018] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            <span>Payment operations</span>
            <GuidanceTip guidanceId="payment.health" />
          </div>
          {p.read && <div className="mt-1 text-[12px] text-gray-300">{p.read}</div>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${pressureCls}`}>
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${pressureDot}`} />
            {p.pressure === "calm" ? "Calm" : p.pressure === "watch" ? "Watch" : p.pressure === "risk" ? "Risk" : "Critical"}
          </span>
          <div className={`text-[22px] font-medium tabular-nums tracking-tight ${scoreCls}`}>
            {p.healthScore}
            <span className="ml-1 text-[10px] uppercase tracking-[0.18em] text-gray-500">health</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="Pending approval"
          value={p.pendingApproval.count > 0 ? p.pendingApproval.count.toString() : "0"}
          hint={p.pendingApproval.totalValue > 0 ? `${formatCompactUsd(p.pendingApproval.totalValue)} USD` : undefined}
          tone={p.pendingApproval.oldestDays >= 14 ? "rose" : p.pendingApproval.oldestDays >= 7 ? "amber" : "neutral"}
        />
        <StatTile
          label="Unreconciled"
          value={p.reconciliation.unreconciledCount.toString()}
          hint={p.reconciliation.unreconciledValue > 0 ? `${formatCompactUsd(p.reconciliation.unreconciledValue)} USD` : undefined}
          tone={p.reconciliation.unreconciledCount >= 5 ? "rose" : p.reconciliation.unreconciledCount >= 1 ? "amber" : "neutral"}
        />
        <StatTile
          label="Mismatches"
          value={p.reconciliation.mismatchCount.toString()}
          hint={p.reconciliation.mismatchValue > 0 ? `${formatCompactUsd(p.reconciliation.mismatchValue)} USD diff` : undefined}
          tone={p.reconciliation.mismatchCount >= 1 ? "rose" : "neutral"}
        />
        <StatTile
          label="Missing evidence"
          value={p.evidence.missingCount.toString()}
          hint={p.evidence.missingValue > 0 ? `${formatCompactUsd(p.evidence.missingValue)} USD` : undefined}
          tone={p.evidence.missingCount >= 5 ? "rose" : p.evidence.missingCount >= 2 ? "amber" : "neutral"}
        />
      </div>

      {p.failedCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/[0.20] bg-rose-500/[0.04] px-3 py-2 text-[11px] text-rose-200">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
          <span><span className="font-medium">{p.failedCount}</span> payment{p.failedCount === 1 ? "" : "s"} failed at the bank — recovery required.</span>
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
   TreasuryOperationsPanel  —  Phase 2.4

   The calm "real cash" surface. Mirrors PaymentOperationsPanel's
   visual language exactly so the operator's eye can move across the
   four control panels (cross-module pressure → approval → payment →
   treasury) without re-orienting.

   Renders nothing when there are no bank accounts (dormant) AND
   nothing material is happening. Once connected, surfaces only when
   the snapshot reports meaningful pressure — quiet by default.

     · header: pressure pill + composite health
     · 4-tile stat row (available cash · 7d · 30d · runway)
     · currency exposure bar + bank concentration line
   ========================================================================== */

function TreasuryOperationsPanel({ intel }: { intel: ReturnType<typeof buildBusinessIntelligence> }) {
  const t = intel.treasury;
  if (t.accounts.length === 0) return null;
  const meaningful =
    t.pressure !== "calm" ||
    t.projection.runwayDays != null ||
    t.unreconciledMovements >= 3 ||
    t.events.length > 0;
  if (!meaningful) return null;

  const pressureCls =
    t.pressure === "critical" ? "bg-rose-500/[0.14] text-rose-300 border-rose-500/[0.25]"
    : t.pressure === "risk"   ? "bg-rose-500/[0.10] text-rose-300/90 border-rose-500/[0.18]"
    : t.pressure === "watch"  ? "bg-amber-500/[0.10] text-amber-300 border-amber-500/[0.18]"
    :                           "bg-emerald-500/[0.08] text-emerald-300 border-emerald-500/[0.16]";
  const pressureDot =
    t.pressure === "critical" ? "bg-rose-400"
    : t.pressure === "risk"   ? "bg-rose-400"
    : t.pressure === "watch"  ? "bg-amber-300"
    :                           "bg-emerald-400";
  const scoreCls =
    t.pressure === "critical" ? "text-rose-300"
    : t.pressure === "risk"   ? "text-rose-300/90"
    : t.pressure === "watch"  ? "text-amber-300"
    :                           "text-emerald-300";

  /* Runway formatting + tone. */
  const runwayLabel = t.projection.runwayDays == null ? "—" : `${t.projection.runwayDays}d`;
  const runwayTone =
    t.projection.runwayDays == null ? "neutral"
    : t.projection.runwayDays <= 14 ? "rose"
    : t.projection.runwayDays <= 30 ? "amber"
    :                                 "neutral";

  /* Top non-reporting currency exposure for the dependency line. */
  const topNonReporting = t.currencyExposure.find((c) => !c.isReporting);
  const topAccount = t.accounts[0];

  return (
    <div className="mt-3 rounded-2xl border border-white/[0.05] bg-white/[0.018] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            <span>Treasury operations</span>
            <GuidanceTip guidanceId="treasury.health" />
          </div>
          {t.read && <div className="mt-1 text-[12px] text-gray-300">{t.read}</div>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${pressureCls}`}>
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${pressureDot}`} />
            {t.pressure === "calm" ? "Calm" : t.pressure === "watch" ? "Watch" : t.pressure === "risk" ? "Risk" : "Critical"}
          </span>
          <div className={`text-[22px] font-medium tabular-nums tracking-tight ${scoreCls}`}>
            {t.healthScore}
            <span className="ml-1 text-[10px] uppercase tracking-[0.18em] text-gray-500">health</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="Available"
          helpId="treasury.available"
          value={formatCompactUsd(t.availableCash)}
          unit="USD"
          tone={t.availableCash < 25_000 ? "amber" : "neutral"}
        />
        <StatTile
          label="7-day projection"
          helpId="treasury.projected"
          value={`${t.projection.d7 >= 0 ? "+" : "−"}${formatCompactUsd(Math.abs(t.projection.d7))}`}
          tone={t.projection.d7 < 0 ? "rose" : "neutral"}
        />
        <StatTile
          label="30-day projection"
          helpId="treasury.liquidityGap"
          value={`${t.projection.d30 >= 0 ? "+" : "−"}${formatCompactUsd(Math.abs(t.projection.d30))}`}
          tone={t.projection.d30 < 0 ? "rose" : "neutral"}
        />
        <StatTile
          label="Runway"
          helpId="treasury.runway"
          value={runwayLabel}
          hint={t.projection.runwayDays == null ? "Beyond horizon" : "Until cash crosses zero"}
          tone={runwayTone}
        />
      </div>

      {/* Concentration + FX line — only when there's something to say. */}
      {(topAccount && topAccount.share >= 0.6) || (topNonReporting && topNonReporting.share >= 0.3) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.012] px-3 py-2 text-[11px]">
          {topAccount && topAccount.share >= 0.6 && (
            <span className="text-gray-300">
              <span className="text-gray-500">Top account · </span>
              {topAccount.accountName} <span className="text-gray-500">·</span> {(topAccount.share * 100).toFixed(0)}%
            </span>
          )}
          {topNonReporting && topNonReporting.share >= 0.3 && (
            <>
              <span className="text-gray-600">·</span>
              <span className={topNonReporting.share >= 0.6 ? "text-amber-200" : "text-gray-300"}>
                <span className="text-gray-500">FX · </span>
                {(topNonReporting.share * 100).toFixed(0)}% in {topNonReporting.currency}
              </span>
              <GuidanceTip guidanceId="treasury.fxExposure" />
            </>
          )}
        </div>
      ) : null}

      {/* Bank-failure or overdraft callouts. */}
      {t.events.some((e) => e.kind === "overdraft_risk" || e.kind === "transfer_failure") && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/[0.20] bg-rose-500/[0.04] px-3 py-2 text-[11px] text-rose-200">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
          <span>
            {t.events.find((e) => e.kind === "overdraft_risk")?.label
              ?? t.events.find((e) => e.kind === "transfer_failure")?.label}
            <span className="text-rose-200/70"> — recovery action required.</span>
          </span>
        </div>
      )}
    </div>
  );
}
