"use client";

/* ---------------------------------------------------------------------------
   VisualStatements — Coffee-Inc-2-style financial statements dashboard.

   Operator feedback was the FInance app should match the simple, dense
   dashboard layout the founder is used to from Coffee Inc 2:

     • Two centered hero KPIs (Total Revenue · Net Income) with deltas
     • A wide twin-bar trend chart with period labels (5 buckets)
     • Income · Balance Sheet · Cash Flow toggle (pill)
     • Week · Quarter · Year toggle (pill)
     • Two-period side-by-side tables with PERIOD COLUMN HEADERS, a
       calm row stack, and a clear hierarchy of totals:
         Total Revenues / Total Expenses  (medium)
         Operating Income / Income Before Taxes  (stronger)
         Net Income  (strongest, accent colour)

   The component now exports two flavours:
     · default export  VisualStatements           — full page with chrome
                                                    (kept for /finance/visual)
     · named export    StatementsDashboard        — chromeless body suitable
                                                    for embedding inside
                                                    FinanceHome (/finance).

   Both flavours render exactly the same dashboard body.  All colours come
   from the Hub design-system tokens (var(--bg-primary), var(--text-primary),
   ErpPanel hairlines) so the page sits visually inside the rest of the Hub.
   --------------------------------------------------------------------------- */

import { humanizeError } from "@/lib/ui/humanize-error";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErpPage, ErpPanel } from "@/components/ui/erp/ErpUi";
import RrIcon from "@/components/ui/RrIcon";

type Tab = "income" | "balance" | "cashflow";
type Granularity = "week" | "quarter" | "year";

interface PLAccountLine { account_id: string; code: string; name: string; amount: number }
interface PLSection { label: string; amount: number; accounts: PLAccountLine[] }
interface ProfitLoss {
  period: { from: string; to: string };
  currency: string;
  revenue: PLSection; cost_of_sales: PLSection;
  gross_profit: number; gross_margin_pct: number;
  operating_expenses: PLSection;
  operating_profit: number; operating_margin_pct: number;
  net_profit: number; net_margin_pct: number;
}
interface BalanceLine { code: string; name: string; amount: number }
interface BalanceSection { label: string; amount: number; accounts: BalanceLine[] }
interface BalanceSheet {
  as_of: string; currency: string;
  assets: BalanceSection; liabilities: BalanceSection; equity: BalanceSection;
  total_assets: number; total_liab_eq: number; reconciled: boolean;
}
interface CashFlowLine { label: string; amount: number }
interface CashFlowSection { label: string; amount: number; lines: CashFlowLine[] }
interface CashFlow {
  period: { from: string; to: string };
  currency: string;
  opening_cash: number;
  operating: CashFlowSection; investing: CashFlowSection; financing: CashFlowSection;
  net_change: number; closing_cash: number; reconciled: boolean;
}
interface TrendBucket { label: string; from: string; to: string; revenue: number; net_income: number }
interface Snapshot {
  base_currency: string; granularity: Granularity;
  period: { from: string; to: string };
  income: ProfitLoss; income_prior: ProfitLoss;
  balance: BalanceSheet; cash_flow: CashFlow;
  trend: TrendBucket[];
}

function fmtFull(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtSigned(n: number) {
  const abs = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n < 0 ? `(${abs})` : abs;
}
function fmtPeriodLabel(iso: string): string {
  /* "2026-08-13" → "Aug 13" */
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return iso; }
}

/* ── Chromeless body — used by FinanceHome (/finance) ────────────────── */

export function StatementsDashboard() {
  const [tab, setTab] = useState<Tab>("income");
  const [granularity, setGranularity] = useState<Granularity>("year");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchSnap = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/finance/visual-statements?granularity=${granularity}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error || `HTTP ${r.status}`));
      setSnap(j.snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [granularity]);

  useEffect(() => { fetchSnap(); }, [fetchSnap]);

  const ccy = snap?.base_currency ?? "";
  const totalRevenue = snap?.income.revenue.amount ?? 0;
  const netIncome    = snap?.income.net_profit ?? 0;
  const priorRevenue = snap?.income_prior.revenue.amount ?? 0;
  const priorNet     = snap?.income_prior.net_profit ?? 0;
  const revDelta = priorRevenue !== 0 ? (totalRevenue - priorRevenue) : null;
  const revPct   = priorRevenue !== 0 ? ((totalRevenue - priorRevenue) / Math.abs(priorRevenue)) * 100 : null;
  const niDelta  = priorNet !== 0 ? (netIncome - priorNet) : null;
  const niPct    = priorNet !== 0 ? ((netIncome - priorNet) / Math.abs(priorNet)) * 100 : null;

  const curLabel   = snap ? fmtPeriodLabel(snap.income.period.to)       : "";
  const priorLabel = snap ? fmtPeriodLabel(snap.income_prior.period.to) : "";

  return (
    <div className="space-y-5">
      {error && (
        <ErpPanel className="px-5 py-3">
          <div className="text-[13px] text-rose-300">{error}</div>
        </ErpPanel>
      )}

      {/* ── Hero KPIs + trend bars ───────────────────────────────────── */}
      {snap && (
        <ErpPanel className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <KpiHero label="TOTAL REVENUE" ccy={ccy} value={totalRevenue}
                     delta={revDelta} pct={revPct} tone="neutral" />
            <KpiHero label="NET INCOME"    ccy={ccy} value={netIncome}
                     delta={niDelta}  pct={niPct}  tone={netIncome >= 0 ? "positive" : "warning"} />
          </div>
          <TrendChart trend={snap.trend} />
        </ErpPanel>
      )}

      {/* ── Toggles ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <PillToggle
          options={[
            { k: "income"  , label: "Income" },
            { k: "balance" , label: "Balance Sheet" },
            { k: "cashflow", label: "Cash Flow" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
        <PillToggle
          size="sm"
          options={[
            { k: "week",    label: "Week" },
            { k: "quarter", label: "Quarter" },
            { k: "year",    label: "Year" },
          ]}
          value={granularity}
          onChange={(v) => setGranularity(v as Granularity)}
        />
      </div>

      {loading && (
        <div className="text-center text-[12px] text-gray-500">Loading statements…</div>
      )}

      {/* ── Statement body ──────────────────────────────────────────── */}
      {snap && !loading && (
        <ErpPanel className="px-5 py-6 sm:px-8">
          {tab === "income"   && <IncomeView pl={snap.income} prior={snap.income_prior} ccy={ccy} curLabel={curLabel} priorLabel={priorLabel} />}
          {tab === "balance"  && <BalanceView bs={snap.balance} ccy={ccy} curLabel={curLabel} />}
          {tab === "cashflow" && <CashFlowView cf={snap.cash_flow} ccy={ccy} curLabel={curLabel} />}
        </ErpPanel>
      )}
    </div>
  );
}

/* ── Full page wrapper — used by /finance/visual + /finance/overview ── */

export default function VisualStatements() {
  return (
    <ErpPage
      title="Overview"
      subtitle="Income · Balance Sheet · Cash Flow"
      icon="balance-scale-left"
      backHref="/finance"
      action={
        <Link href="/reports/statements" className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]">
          <RrIcon name="newspaper" size={12} /> Print version
        </Link>
      }
    >
      <StatementsDashboard />
    </ErpPage>
  );
}

/* ───── KPI Hero (centered, large, Coffee-Inc-2 style) ───── */

function KpiHero({
  label, ccy, value, delta, pct, tone,
}: {
  label: string; ccy: string; value: number;
  delta: number | null; pct: number | null;
  tone: "neutral" | "positive" | "warning";
}) {
  const main =
    tone === "positive" ? "text-emerald-200" :
    tone === "warning"  ? "text-amber-200"   :
                          "text-[var(--text-primary)]";
  const deltaUp = (delta ?? 0) >= 0;
  const deltaTone = deltaUp ? "text-emerald-300" : "text-rose-300";

  return (
    <div className="text-center">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">{label}</div>
      <div className={`mt-3 font-mono text-[34px] leading-none tabular-nums tracking-[-0.01em] sm:text-[42px] ${main}`}>
        {ccy && <span className="mr-1 text-[16px] text-gray-500">{ccy}</span>}
        {fmtFull(value)}
      </div>
      {delta !== null && pct !== null && (
        <div className={`mt-2 text-[12px] ${deltaTone}`}>
          {deltaUp ? "▲" : "▼"} {ccy ? ccy + " " : ""}{fmtFull(Math.abs(delta))} ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
        </div>
      )}
    </div>
  );
}

/* ───── Trend chart (twin bars) ───── */

function TrendChart({ trend }: { trend: TrendBucket[] }) {
  const buckets = trend.slice(-5);
  const w = 920; const h = 170; const padL = 16; const padR = 16; const padT = 8; const padB = 26;
  const innerW = w - padL - padR; const innerH = h - padT - padB;
  const maxY = Math.max(1, ...buckets.flatMap((t) => [Math.abs(t.revenue), Math.abs(t.net_income)]));
  const gap = 14;
  const slot = innerW / Math.max(1, buckets.length);
  const barW = Math.max(8, (slot - gap) / 2);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-6 w-full" role="img" aria-label="Revenue and net income trend">
      <line x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH} stroke="rgba(255,255,255,0.08)" />
      {buckets.map((t, i) => {
        const xSlot = padL + i * slot;
        const xRev = xSlot + slot / 2 - barW - 2;
        const xNi  = xSlot + slot / 2 + 2;
        const hRev = Math.max(2, (Math.abs(t.revenue)    / maxY) * innerH);
        const hNi  = Math.max(2, (Math.abs(t.net_income) / maxY) * innerH);
        const niColor = t.net_income >= 0 ? "rgba(180, 92, 60, 0.9)" : "rgba(229, 115, 115, 0.7)";
        return (
          <g key={`${t.label}-${i}`}>
            <rect x={xRev} y={padT + innerH - hRev} width={barW} height={hRev} fill="rgba(255,255,255,0.88)" rx={2} />
            <rect x={xNi}  y={padT + innerH - hNi}  width={barW} height={hNi}  fill={niColor} rx={2} />
            <text x={xSlot + slot / 2} y={h - 6} fill="rgba(255,255,255,0.55)"
                  fontSize={11} textAnchor="middle">{t.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ───── Pill toggle ───── */

function PillToggle<T extends string>({
  options, value, onChange, size = "md",
}: {
  options: Array<{ k: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-3 py-1 text-[11.5px]" : "px-4 py-1.5 text-[12.5px]";
  return (
    <div className="flex gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
      {options.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onChange(o.k)}
          className={`rounded-full transition-colors ${pad} ${
            o.k === value
              ? "bg-white/[0.12] text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───── Two-period table primitives (with column headers) ───── */

function PeriodHeaders({ curLabel, priorLabel }: { curLabel: string; priorLabel: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-8 border-b border-white/[0.08] pb-1.5 text-[10px] uppercase tracking-[0.16em] text-gray-500">
      <span />
      <span className="text-right">{priorLabel || "Prior"}</span>
      <span className="text-right">{curLabel || "Current"}</span>
    </div>
  );
}

function SingleColHeader({ curLabel }: { curLabel: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-8 border-b border-white/[0.08] pb-1.5 text-[10px] uppercase tracking-[0.16em] text-gray-500">
      <span />
      <span className="text-right">{curLabel || "Current"}</span>
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="mt-6 mb-2 first:mt-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</div>
  );
}

function TwoColRow({ label, prior, cur }: { label: string; prior: number; cur: number }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-8 border-b border-white/[0.04] py-1.5 text-[12.5px] last:border-b-0">
      <span className="text-gray-200">{label}</span>
      <span className="font-mono tabular-nums text-gray-400">{fmtSigned(prior)}</span>
      <span className="font-mono tabular-nums text-[var(--text-primary)]">{fmtSigned(cur)}</span>
    </div>
  );
}

function SingleRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-8 border-b border-white/[0.04] py-1.5 text-[12.5px] last:border-b-0">
      <span className="text-gray-200">{label}</span>
      <span className="font-mono tabular-nums text-[var(--text-primary)]">{fmtSigned(amount)}</span>
    </div>
  );
}

type Strength = "subtotal" | "total" | "headline";

function TotalRow({
  label, prior, cur, strength = "subtotal", tone = "neutral", showPrior = true,
}: {
  label: string; prior?: number; cur: number;
  strength?: Strength;
  tone?: "neutral" | "positive" | "warning";
  showPrior?: boolean;
}) {
  const text =
    strength === "headline" ? "text-[15px] font-semibold" :
    strength === "total"    ? "text-[14px] font-semibold" :
                              "text-[13px] font-medium";
  const valueTone =
    tone === "positive" ? "text-emerald-200" :
    tone === "warning"  ? "text-amber-200"   :
                          "text-[var(--text-primary)]";
  const border =
    strength === "headline" ? "border-t-2 border-white/[0.20]" :
    strength === "total"    ? "border-t border-white/[0.14]" :
                              "border-t border-white/[0.08]";

  return (
    <div className={`mt-2 grid items-baseline gap-x-8 py-2 ${border} ${text} ${showPrior ? "grid-cols-[1fr_auto_auto]" : "grid-cols-[1fr_auto]"}`}>
      <span className="uppercase tracking-[0.04em] text-gray-300">{label}</span>
      {showPrior && (
        <span className="font-mono tabular-nums text-gray-500">{prior !== undefined ? fmtSigned(prior) : ""}</span>
      )}
      <span className={`font-mono tabular-nums ${valueTone}`}>{fmtSigned(cur)}</span>
    </div>
  );
}

function MutedRow({ label }: { label: string }) {
  return <div className="border-b border-white/[0.04] py-1.5 text-[11px] text-gray-500 last:border-b-0">{label}</div>;
}

/* ───── Income view ───── */

function IncomeView({ pl, prior, ccy, curLabel, priorLabel }: { pl: ProfitLoss; prior: ProfitLoss; ccy: string; curLabel: string; priorLabel: string }) {
  void ccy;
  return (
    <div>
      <PeriodHeaders curLabel={curLabel} priorLabel={priorLabel} />

      <SectionTitle label="Revenues" />
      {pl.revenue.accounts.length === 0 && <MutedRow label="No revenue posted yet." />}
      {pl.revenue.accounts.map((a) => (
        <TwoColRow key={a.account_id} label={a.name} prior={priorAccount(prior.revenue, a.code)} cur={a.amount} />
      ))}
      <TotalRow label="Total Revenues" prior={prior.revenue.amount} cur={pl.revenue.amount} strength="subtotal" />

      <SectionTitle label="Expenses" />
      {pl.cost_of_sales.accounts.map((a) => (
        <TwoColRow key={a.account_id} label={a.name} prior={priorAccount(prior.cost_of_sales, a.code)} cur={a.amount} />
      ))}
      {pl.operating_expenses.accounts.map((a) => (
        <TwoColRow key={a.account_id} label={a.name} prior={priorAccount(prior.operating_expenses, a.code)} cur={a.amount} />
      ))}
      <TotalRow
        label="Total Expenses"
        prior={prior.cost_of_sales.amount + prior.operating_expenses.amount}
        cur={pl.cost_of_sales.amount + pl.operating_expenses.amount}
        strength="subtotal"
      />

      <TotalRow label="Operating Income"
                prior={prior.operating_profit} cur={pl.operating_profit}
                strength="total"
                tone={pl.operating_profit >= 0 ? "positive" : "warning"} />

      <div className="mt-4" />
      <TotalRow label="Net Income"
                prior={prior.net_profit} cur={pl.net_profit}
                strength="headline"
                tone={pl.net_profit >= 0 ? "positive" : "warning"} />
    </div>
  );
}
function priorAccount(section: PLSection, code: string) {
  return section.accounts.find((a) => a.code === code)?.amount ?? 0;
}

/* ───── Balance sheet ───── */

function BalanceView({ bs, ccy, curLabel }: { bs: BalanceSheet; ccy: string; curLabel: string }) {
  void ccy;
  return (
    <div>
      <SingleColHeader curLabel={curLabel || bs.as_of} />

      <SectionTitle label="Assets" />
      {bs.assets.accounts.map((a) => (
        <SingleRow key={a.code} label={a.name} amount={a.amount} />
      ))}
      <TotalRow label="Total Assets" cur={bs.total_assets} strength="total" showPrior={false} />

      <SectionTitle label="Liabilities" />
      {bs.liabilities.accounts.length === 0 && <MutedRow label="No liabilities posted." />}
      {bs.liabilities.accounts.map((a) => (
        <SingleRow key={a.code} label={a.name} amount={a.amount} />
      ))}
      <TotalRow label="Total Liabilities" cur={bs.liabilities.amount} strength="subtotal" showPrior={false} />

      <SectionTitle label="Equity" />
      {bs.equity.accounts.map((a) => (
        <SingleRow key={a.code} label={a.name} amount={a.amount} />
      ))}
      <TotalRow label="Total Equity" cur={bs.equity.amount} strength="subtotal" showPrior={false} />

      <div className="mt-4" />
      <TotalRow label="Total Liabilities & Equity" cur={bs.total_liab_eq}
                strength="headline"
                tone={bs.reconciled ? "positive" : "warning"}
                showPrior={false} />
      {!bs.reconciled && (
        <div className="mt-2 text-[11px] text-rose-300">⚠ Balance sheet does not reconcile.</div>
      )}
    </div>
  );
}

/* ───── Cash flow ───── */

function CashFlowView({ cf, ccy, curLabel }: { cf: CashFlow; ccy: string; curLabel: string }) {
  void ccy;
  return (
    <div>
      <SingleColHeader curLabel={curLabel} />

      <SingleRow label="Opening cash" amount={cf.opening_cash} />

      {[cf.operating, cf.investing, cf.financing].map((s) => (
        <div key={s.label}>
          <SectionTitle label={s.label} />
          {s.lines.length === 0 && <MutedRow label="—" />}
          {s.lines.map((l, i) => (
            <SingleRow key={`${s.label}-${i}`} label={l.label} amount={l.amount} />
          ))}
          <TotalRow label={`${s.label} subtotal`} cur={s.amount} strength="subtotal" showPrior={false} />
        </div>
      ))}

      <TotalRow label="Net change in cash" cur={cf.net_change} strength="total" showPrior={false} />

      <div className="mt-4" />
      <TotalRow label="Closing cash" cur={cf.closing_cash}
                strength="headline"
                tone={cf.reconciled ? "positive" : "warning"}
                showPrior={false} />
    </div>
  );
}
