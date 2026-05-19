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
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import {
  AgingTable,
  AreaChart,
  ChartCard,
  ConcentrationBar,
  InsightCard,
  LiquidityMeter,
  ModeToggle,
  TimelineStrip,
  WorkflowRail,
  formatCompact,
  type FinanceMode,
  type InsightSeverity,
  type Tone,
  type WorkflowItem,
} from "@/components/finance/FinanceUiX";
import { PeriodTabs } from "@/components/finance/FinanceUi";
/* Phase UI.1 — new dashboard-only primitives.
   The HeroKpiCard / MetricCard / SectionTitle / StatRow chrome from
   FinanceUiX is replaced on the dashboard by these typographic
   primitives. The legacy primitives remain available for other
   Finance pages — only the dashboard switches. */
import {
  DashboardSection,
  DisplayKpi,
  HealthRail,
  IntelligenceLine,
  OperationalKpi,
  OperationsDigest,
  type OpsPillData,
} from "@/components/finance/FinanceDashboardUi";
import { fmtMoney, fmtPct } from "@/lib/finance/calc";
import { useBaseCurrency } from "@/lib/hooks/useBaseCurrency";
import { styleForCategory } from "@/components/finance/categoryStyles";
/* Phase 2.5 — operational guidance layer. */
import GuidanceTip from "@/components/ui/GuidanceTip";
import RrIcon from "@/components/ui/RrIcon";
import type {
  BankAccount,
  BankStatementImport,
  CashMovement,
  DashboardKpi,
  DashboardPeriod,
  FinanceExpense,
  FinanceOrder,
  FinancePayment,
  FinanceReconciliationCandidate,
  TreasuryPlan,
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
  /* Phase 2.5 — reconciliation queue feeds the new intelligence signals. */
  const [reconciliationCandidates, setReconciliationCandidates] = useState<FinanceReconciliationCandidate[]>([]);
  /* Phase 2.6 — bank-statement imports feed 4 new intelligence signals. */
  const [bankStatementImports, setBankStatementImports] = useState<BankStatementImport[]>([]);
  /* Phase 2.9 — treasury plans feed 4 governance signals. */
  const [treasuryPlans, setTreasuryPlans] = useState<TreasuryPlan[]>([]);
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
      const [dashRes, ordersRes, paymentsRes, expensesRes, treasuryRes, reconRes, importsRes, plansRes] = await Promise.all([
        fetch(`/api/finance/dashboard?period=${p}`, { cache: "no-store" }),
        fetch(`/api/finance/orders`, { cache: "no-store" }),
        fetch(`/api/finance/payments`, { cache: "no-store" }),
        fetch(`/api/finance/expenses`, { cache: "no-store" }),
        fetch(`/api/finance/treasury`,  { cache: "no-store" }),
        fetch(`/api/finance/reconciliation/candidates?status=suggested,rejected&limit=200`, { cache: "no-store" }),
        fetch(`/api/finance/bank-imports`, { cache: "no-store" }),
        fetch(`/api/finance/treasury-plans`, { cache: "no-store" }),
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
      const reconBody = (await reconRes.json().catch(() => ({}))) as { candidates?: FinanceReconciliationCandidate[] };
      setReconciliationCandidates(Array.isArray(reconBody.candidates) ? reconBody.candidates : []);
      const importsBody = (await importsRes.json().catch(() => ({}))) as { imports?: BankStatementImport[] };
      setBankStatementImports(Array.isArray(importsBody.imports) ? importsBody.imports : []);
      const plansBody = (await plansRes.json().catch(() => ({}))) as { plans?: TreasuryPlan[] };
      setTreasuryPlans(Array.isArray(plansBody.plans) ? plansBody.plans : []);
    } catch {
      setKpi(null);
      setOrders([]);
      setPayments([]);
      setExpenses([]);
      setBankAccounts([]);
      setCashMovements([]);
      setReconciliationCandidates([]);
      setBankStatementImports([]);
      setTreasuryPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(period); }, [period, load]);

  /* Currency stabilization — read tenant base currency dynamically. */
  const currency = useBaseCurrency();

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
  const intelligence    = useMemo(() => buildIntelligence(kpi, period, currency), [kpi, period, currency]);
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
      reconciliationCandidates,
      bankStatementImports,
      treasuryPlans,
      periodDays,
      memory: memoryRef,
    }),
    [kpi, orders, payments, expenses, bankAccounts, cashMovements, reconciliationCandidates, bankStatementImports, treasuryPlans, periodDays, memoryRef],
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

        {/* "What do you want to do?" — two clean tiles under the page
            header. The Finance app does many things; an operator
            entering it shouldn't have to scan the whole dashboard to
            find their next click. Two paths only:
              1. ADD data   → /finance/data-entry
              2. READ data  → /finance/visual (statements)
            Everything else stays on the dashboard below. */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/finance/data-entry"
            className="group flex items-center gap-3 rounded-xl border border-emerald-300/30 bg-emerald-300/[0.04] px-4 py-3.5 transition-colors hover:bg-emerald-300/[0.08]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-300/40 bg-emerald-300/[0.10] text-emerald-100">
              <RrIcon name="pencil" size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">Add data</div>
              <div className="text-[13.5px] font-semibold text-emerald-50">Enter finance data</div>
              <div className="mt-0.5 text-[11px] text-emerald-200/80">
                Assets · opening balances · customers · suppliers · FX rates · expenses · invoices
              </div>
            </div>
            <RrIcon name="arrow-up-right" size={12} className="text-emerald-200 group-hover:text-emerald-100" />
          </Link>
          <Link
            href="/finance/visual"
            className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.012] px-4 py-3.5 transition-colors hover:bg-white/[0.04]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.10] bg-white/[0.04] text-gray-200">
              <RrIcon name="balance-scale-left" size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Read data</div>
              <div className="text-[13.5px] font-semibold text-gray-100">Read financial statements</div>
              <div className="mt-0.5 text-[11px] text-gray-400">
                Income · balance sheet · cash flow · AR/AP aging · inventory valuation · gross profit
              </div>
            </div>
            <RrIcon name="arrow-up-right" size={12} className="text-gray-400 group-hover:text-gray-200" />
          </Link>
        </div>

        {/* ── Phase UI.1 — System Health rail.
           Replaces the four stacked CrossModule + Approval + Payment +
           Treasury panels. One typographic strip carrying the composite
           health number, the dimension bars, and the headline narrative.
           No box, no border — spacing + a single hairline rule above. */}
        <SystemHealth intel={businessIntelligence} />

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
   Phase UI.1 — SystemHealth.

   The single opening surface that replaces the four stacked
   CrossModule + Approval + Payment + Treasury panels. Renders:
     · the composite health number (display-sized, tonal)
     · the pressure tier (eyebrow caption)
     · the cross-module headline
     · a 5-bar per-module strip
     · a single Operations Digest line with three pills below the
       module bars: Approvals · Payments · Treasury (only when any of
       the three carries non-calm pressure)

   No box, no card — just typography on a hairline-separated band.
   ========================================================================== */

function SystemHealth({ intel }: { intel: ReturnType<typeof buildBusinessIntelligence> }) {
  const { health, approval, payment, treasury, correlations, digest } = intel;

  /* Quiet state — nothing to say, calm pressure, no events. */
  if (!intel.events.length && correlations.length === 0 && digest.length === 0 && health.composite >= 95) {
    return null;
  }

  const topCorrelation = correlations[0];

  /* Build the Operations Digest pills only when the underlying
     surface is meaningfully active. The old 4-panel stack rendered
     every panel; the new rail surfaces a pill only when its
     pressure exits "calm" or its backlog is material. */
  const pills: OpsPillData[] = [];
  if (approval.pressure !== "calm" || approval.backlog.count >= 3) {
    pills.push({
      label: "Approvals",
      score: approval.healthScore,
      pressure: approval.pressure,
      hint: approval.backlog.count > 0 ? `${approval.backlog.count} pending · ${approval.backlog.oldestDays}d oldest` : undefined,
    });
  }
  if (payment.pressure !== "calm") {
    pills.push({
      label: "Payments",
      score: payment.healthScore,
      pressure: payment.pressure,
      hint: payment.read,
    });
  }
  if (treasury.pressure !== "calm") {
    pills.push({
      label: "Treasury",
      score: treasury.healthScore,
      pressure: treasury.pressure,
      hint: treasury.read,
    });
  }

  return (
    <div className="mt-6">
      <HealthRail
        headline={health.headline}
        composite={health.composite}
        pressure={health.pressure}
        modules={health.dimensions.map((d) => ({
          key: d.module,
          /* Short capitalised label for each module key. */
          label: d.module[0].toUpperCase() + d.module.slice(1),
          score: d.score,
          pressure: d.pressure,
        }))}
        helpId="intelligence.businessHealth"
      />

      {(pills.length > 0 || topCorrelation) && (
        <div className="mt-8">
          <OperationsDigest
            pills={pills}
            note={topCorrelation?.narrative ?? topCorrelation?.headline}
          />
        </div>
      )}
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
  /* Pressure-anomaly chips were duplicated by the HealthPill in the
     header and the SystemHealth rail above — Phase UI.1 removes the
     standalone strip. Anomalies still surface inside the Intelligence
     section below as IntelligenceLine items. */

  /* ── Hierarchy values ────────────────────────────────────────────
     L1 (Display): Net Profit · Revenue · Cash Position · Gross Margin
     L2 (Headline): Cash In · Cash Out · AR · AP
     Cash Position = realized_cash_position when available, else
     cash_in − cash_out. No new math. */
  const cashPosition =
    kpi?.expected_vs_realized?.realized_cash_position ?? ((kpi?.cash_in ?? 0) - (kpi?.cash_out ?? 0));
  const netProfitTone: Tone = (kpi?.net_profit ?? 0) >= 0 ? "info" : "negative";
  const marginValue = kpi ? `${(kpi.gross_margin_pct ?? 0).toFixed(1)}%` : "—";
  const marginTone: Tone =
    (kpi?.gross_margin_pct ?? 0) >= 30 ? "positive"
    : (kpi?.gross_margin_pct ?? 0) >= 15 ? "warning"
    : (kpi?.gross_margin_pct ?? 0) < 0 ? "negative"
    : "info";
  const cashPositionTone: Tone = cashPosition >= 0 ? "positive" : "negative";

  return (
    <>
      {/* ── 1. FINANCIAL PERFORMANCE — L1 then L2 row.
            Display-sized hero quartet leads, supporting metrics row
            beneath. No card chrome — typography only with a tonal
            accent rule on top of each L1 number. */}
      <DashboardSection
        eyebrow="Financial performance"
        title="Where the business stands this period"
        helpId="finance.section.atGlance"
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          <DisplayKpi
            label="Net Profit"
            value={formatCompact(kpi?.net_profit ?? 0)}
            hint={`${currency} · ${fmtPct(kpi?.delta.net_profit_pct ?? null, 1)} vs prior`}
            tone={netProfitTone}
            helpId="finance.netProfit"
            loading={loading}
          />
          <DisplayKpi
            label="Revenue"
            value={formatCompact(kpi?.total_revenue ?? 0)}
            hint={`${currency} · ${fmtPct(kpi?.delta.revenue_pct ?? null, 1)} vs prior`}
            tone="positive"
            helpId="finance.revenue"
            loading={loading}
          />
          <DisplayKpi
            label="Cash position"
            value={formatCompact(cashPosition)}
            hint={cashPosition >= 0 ? "Inflow heavy" : "Outflow heavy"}
            tone={cashPositionTone}
            loading={loading}
          />
          <DisplayKpi
            label="Gross margin"
            value={marginValue}
            hint="Gross profit ÷ revenue"
            tone={marginTone}
            helpId="finance.grossMargin"
            loading={loading}
          />
        </div>

        {/* L2 supporting metrics row — calmer, smaller, no chrome. */}
        <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          <OperationalKpi
            label="Cash in"
            value={formatCompact(kpi?.cash_in ?? 0)}
            hint={`${currency} · tap for bank movements`}
            tone="positive"
            helpId="finance.cashIn"
            loading={loading}
            deltaPct={kpi?.delta.cash_in_pct ?? null}
            href="/finance/payments?direction=in"
          />
          <OperationalKpi
            label="Cash out"
            value={formatCompact(kpi?.cash_out ?? 0)}
            hint={`${currency} · tap for bank movements`}
            tone="negative"
            helpId="finance.cashOut"
            loading={loading}
            deltaPct={kpi?.delta.cash_out_pct ?? null}
            href="/finance/payments?direction=out"
          />
          <OperationalKpi
            label="Money to Collect"
            value={formatCompact(kpi?.accounts_receivable ?? 0)}
            hint="Outstanding AR · tap for aging"
            tone="warning"
            helpId="finance.accountsReceivable"
            loading={loading}
            href="/reports/statements?tab=ar"
          />
          <OperationalKpi
            label="Money to Pay"
            value={formatCompact(kpi?.accounts_payable ?? 0)}
            hint="Suppliers + bills · tap for aging"
            tone="warning"
            helpId="finance.accountsPayable"
            loading={loading}
            href="/reports/statements?tab=ap"
          />
        </div>
      </DashboardSection>

      {/* ── 2. LIQUIDITY & TREASURY — Timelines + LiquidityMeter.
            The three existing widgets share a row; the section heading
            replaces the in-card title each carries. */}
      <DashboardSection
        eyebrow="Liquidity"
        title="What's moving in the next 45 days"
        description="Incoming collections, supplier dues, and forward liquidity."
        helpId="finance.section.cashRadar"
      >
        <div className="grid gap-x-6 gap-y-5 lg:grid-cols-3">
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
      </DashboardSection>

      {/* ── 3. RISKS & PRESSURE — AR/AP aging side-by-side.
            Aging tables retain their internal chrome but the section
            framing is typographic. Anomaly digest is now surfaced
            inside the Intelligence section below to avoid duplication
            with the SystemHealth narrative. */}
      <DashboardSection
        eyebrow="Risks"
        title="Receivables and payables by age"
        description="Anything past 30 days is silently flagged."
        helpId="finance.section.aging"
      >
        <div className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
          <AgingTable title="AR aging" buckets={arAging} currency={currency} totalLabel="Customer side" />
          <AgingTable title="AP aging" buckets={apAging} currency={currency} totalLabel="Supplier side" />
        </div>
      </DashboardSection>

      {/* ── 4. OPERATIONAL ACTIONS — WorkflowRail.
            The action queue lives here in the narrative (after the
            user has read the company's condition + risks). */}
      <DashboardSection
        eyebrow="Actions"
        title="Operational queue, prioritised"
        description="Items most likely to need a decision this week, ordered by current pressure."
      >
        <WorkflowRail items={workflowItems} />
      </DashboardSection>

      {/* ── 5. INTELLIGENCE — interpretations + meaningful anomalies. */}
      <DashboardSection
        eyebrow="Intelligence"
        title="What the numbers mean"
        description="Automatic interpretation of this period's signal."
        helpId="finance.section.intelligence"
      >
        {/* Anomaly call-outs collapsed into a single quiet stack —
            no boxed chip strip. Each meaningful anomaly becomes one
            IntelligenceLine, the same typographic treatment as a
            narrative observation. */}
        {anomalies.filter((a) => a.severity !== "info").length > 0 && (
          <div className="mb-6 space-y-2">
            {anomalies.filter((a) => a.severity !== "info").slice(0, 3).map((a) => (
              <IntelligenceLine
                key={a.key}
                prefix={a.label}
                text={a.detail}
                severity={a.severity === "risk" ? "risk" : "watch"}
              />
            ))}
          </div>
        )}
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
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
      </DashboardSection>

      {/* ── 6. DEEP ANALYTICS — Trend chart + Profit flow + Top lists.
            The most data-dense surfaces live at the end of the page,
            after the operator has absorbed the narrative above. */}
      <DashboardSection
        eyebrow="Analytics"
        title="Cash flow over time"
        description={
          period === "week"      ? "Daily breakdown — last 7 days"
          : period === "quarter" ? "Weekly breakdown — last 90 days"
          :                        "Monthly breakdown — last 12 months"
        }
      >
        <ChartCard title="Revenue · costs · net profit" subtitle="Revenue is the inflow line; costs + expenses combine into the outflow line.">
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
      </DashboardSection>

      <DashboardSection
        eyebrow="Profit flow"
        title="From revenue to net profit"
        description="Gross profit excludes tax refund; refund is added back separately before net profit."
        helpId="finance.section.profitFlow"
        tight
      >
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
      </DashboardSection>

      <DashboardSection
        eyebrow="Detail"
        title="Where profit is being made — and where it's leaking"
        helpId="finance.section.topInsights"
        tight
      >
        <div className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
          <TopOrdersCard kpi={kpi} currency={currency} />
          <TopCategoriesCard kpi={kpi} currency={currency} />
        </div>
      </DashboardSection>

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
  /* Phase UI.1 — ExecutiveView mirrors the Operational narrative
     order (Financial performance → Liquidity → Risks → Intelligence
     → Analytics) but stays calmer: no WorkflowRail, no anomaly chips.
     Hierarchy:
       L1: Net Profit · Revenue · AR exposure · AP exposure
       L2: DSO · CCC · margin · cash position */
  const netProfitTone: Tone = (kpi?.net_profit ?? 0) >= 0 ? "info" : "negative";
  const marginValue = kpi ? `${(kpi.gross_margin_pct ?? 0).toFixed(1)}%` : "—";
  const cccTone: Tone = ccc.ccc <= 30 ? "positive" : ccc.ccc <= 60 ? "warning" : "negative";
  const arOpen = arAging.reduce((s, b) => s + b.count, 0);
  const apOpen = apAging.reduce((s, b) => s + b.count, 0);
  const cashPosition =
    kpi?.expected_vs_realized?.realized_cash_position ?? ((kpi?.cash_in ?? 0) - (kpi?.cash_out ?? 0));

  return (
    <>
      {/* ── 1. Executive read — a single narrative line below the
            SystemHealth rail. No box; just typography. */}
      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="max-w-[820px] text-[13px] leading-[1.55] text-gray-300">{liquidity.narrative}</p>
        <PressurePill pressure={pressure} />
      </div>

      {/* ── 2. FINANCIAL PERFORMANCE — L1 quartet. */}
      <DashboardSection
        eyebrow="Financial performance"
        title={`Executive read · ${currency} · ${period}`}
        helpId="finance.section.atGlance"
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          <DisplayKpi
            label="Net profit"
            value={formatCompact(kpi?.net_profit ?? 0)}
            hint={`Margin ${marginValue}`}
            tone={netProfitTone}
            helpId="finance.netProfit"
            loading={loading}
          />
          <DisplayKpi
            label="Revenue"
            value={formatCompact(kpi?.total_revenue ?? 0)}
            hint={`${currency} · ${period}`}
            tone="positive"
            helpId="finance.revenue"
            loading={loading}
          />
          <DisplayKpi
            label="Money to Collect"
            value={formatCompact(kpi?.accounts_receivable ?? 0)}
            hint={`${arOpen} open AR`}
            tone="warning"
            helpId="finance.accountsReceivable"
            loading={loading}
          />
          <DisplayKpi
            label="Money to Pay"
            value={formatCompact(kpi?.accounts_payable ?? 0)}
            hint={`${apOpen} open AP`}
            tone="warning"
            helpId="finance.accountsPayable"
            loading={loading}
          />
        </div>

        {/* L2 supporting row — DSO · CCC · margin · cash position. */}
        <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          <OperationalKpi
            label="DSO"
            value={`${ccc.dso.toFixed(0)} d`}
            hint="Days sales outstanding"
            tone="info"
            helpId="finance.dso"
            loading={loading}
          />
          <OperationalKpi
            label="CCC"
            value={`${ccc.ccc.toFixed(0)} d`}
            hint={ccc.ccc >= 0 ? "Cash cycle gap" : "Cash cycle surplus"}
            tone={cccTone}
            helpId="finance.ccc"
            loading={loading}
          />
          <OperationalKpi
            label="Gross margin"
            value={marginValue}
            hint="Profit ÷ revenue"
            tone={
              (kpi?.gross_margin_pct ?? 0) >= 30 ? "positive"
              : (kpi?.gross_margin_pct ?? 0) >= 15 ? "warning"
              : (kpi?.gross_margin_pct ?? 0) < 0 ? "negative"
              : "info"
            }
            helpId="finance.grossMargin"
            loading={loading}
          />
          <OperationalKpi
            label="Cash position"
            value={formatCompact(cashPosition)}
            hint={cashPosition >= 0 ? "Inflow heavy" : "Outflow heavy"}
            tone={cashPosition >= 0 ? "positive" : "negative"}
            loading={loading}
          />
        </div>
      </DashboardSection>

      {/* ── 3. LIQUIDITY & TREASURY. */}
      <DashboardSection
        eyebrow="Liquidity"
        title="Forward cash window + aging exposure"
        description="Projection blends steady-state trajectory with scheduled AR/AP."
        helpId="finance.liquidity"
      >
        <div className="grid gap-x-6 gap-y-5 lg:grid-cols-3">
          <LiquidityMeter
            d7={liquidity.d7}
            d30={liquidity.d30}
            d60={liquidity.d60}
            inflowShare={liquidity.inflowShare}
          />
          <AgingTable title="AR aging" buckets={arAging} currency={currency} />
          <AgingTable title="AP aging" buckets={apAging} currency={currency} />
        </div>
      </DashboardSection>

      {/* ── 4. RISKS — concentration. */}
      <DashboardSection
        eyebrow="Risks"
        title="Counterparty concentration"
        description="How exposed the business is to a single counterparty."
        helpId="finance.concentration"
      >
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
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
      </DashboardSection>

      {/* ── 5. INTELLIGENCE — anomaly digest as InsightCards. */}
      {anomalies.length > 0 && (
        <DashboardSection
          eyebrow="Intelligence"
          title="Period-over-period deviations"
          description="Material movements worth a second look."
        >
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {anomalies.slice(0, 6).map((a) => (
              <InsightCard
                key={a.key}
                title={a.label}
                description={a.detail}
                severity={a.severity === "risk" ? "risk" : a.severity === "watch" ? "watch" : "neutral"}
              />
            ))}
          </div>
        </DashboardSection>
      )}

      {/* ── 6. DEEP ANALYTICS — Trend + Profit flow. */}
      <DashboardSection
        eyebrow="Analytics"
        title="Cash flow over time"
      >
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
      </DashboardSection>

      <DashboardSection
        eyebrow="Profit flow"
        title="From revenue to net profit"
        tight
      >
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
      </DashboardSection>
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
  icon: React.ReactNode;
};

function buildIntelligence(kpi: DashboardKpi | null, period: DashboardPeriod, currency: string) {
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
    headline = `Healthy ${periodLabel} · Net profit ${formatCompact(kpi.net_profit)} ${currency} · Gross margin ${margin.toFixed(1)}%.`;
  }

  const cards: IntelligenceCard[] = [];
  const cashNet = (kpi.cash_in ?? 0) - (kpi.cash_out ?? 0);
  const collectionPct = kpi.total_revenue > 0 ? ((kpi.cash_in ?? 0) / kpi.total_revenue) * 100 : 0;

  cards.push({
    icon: <RrIcon name="wallet" size={16} />,
    title: "Cash velocity",
    description:
      cashNet >= 0
        ? `Cash in exceeds cash out by ${fmtMoney(cashNet, currency, { compact: true })} ${periodLabel}.`
        : `Cash out exceeds cash in by ${fmtMoney(Math.abs(cashNet), currency, { compact: true })} ${periodLabel} — watch the bank balance.`,
    chip: cashNet >= 0 ? "Positive" : "Negative",
    severity: cashNet >= 0 ? "positive" : "risk",
  });

  if (kpi.accounts_receivable > 0 || kpi.total_revenue > 0) {
    cards.push({
      icon: <RrIcon name="arrow-down-left" size={16} />,
      title: "Collections on track",
      description: kpi.accounts_receivable > 0
        ? `${fmtMoney(kpi.accounts_receivable, currency, { compact: true })} still to collect from customers. Customer payments cover ${collectionPct.toFixed(0)}% of revenue so far.`
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
      icon: <RrIcon name="arrow-up-right" size={16} />,
      title: "Supplier liabilities",
      description: apHeavy
        ? `${fmtMoney(kpi.accounts_payable, currency, { compact: true })} owed to suppliers — exceeds outstanding receivables.`
        : `${fmtMoney(kpi.accounts_payable, currency, { compact: true })} owed to suppliers + unpaid bills.`,
      chip: apSevere ? "Critical" : apHeavy ? "Heavy" : "Manageable",
      severity: apSevere ? "critical" : apHeavy ? "watch" : "neutral",
    });
  }

  const margin = kpi.gross_margin_pct ?? 0;
  cards.push({
    icon: <RrIcon name="shield-check" size={16} />,
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
        icon: <RrIcon name="info" size={16} />,
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
      icon: <RrIcon name="receipt" size={16} />,
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
          icon: <RrIcon name="arrow-down-left" size={13} />,
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
          icon: <RrIcon name="arrow-up-right" size={13} />,
          href: "/finance/suppliers",
          badge: apAmount > 0
            ? { text: formatCompact(apAmount), tone: pressureTone }
            : { text: "Clear", tone: "positive" },
        };
      }
      case "record-payment":
        return {
          key, label: "Record payment", hint: pressureLabel,
          icon: <RrIcon name="wallet" size={13} />, href: "/finance/payments",
        };
      case "add-expense":
        return {
          key, label: "Add expense", hint: pressureLabel,
          icon: <RrIcon name="receipt" size={13} />, href: "/expenses",
        };
      case "new-order":
        return {
          key, label: "New order", hint: pressureLabel,
          icon: <RrIcon name="plus" size={13} />, href: "/finance/orders",
        };
      case "reminders":
        return {
          key, label: "Reminders", hint: pressureLabel,
          icon: <RrIcon name="clock" size={13} />, href: "/finance/notifications",
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

