"use client";

/* ---------------------------------------------------------------------------
   /finance/visual — Income / Balance / Cash Flow tabs, big KPI strip,
   bar-chart trend, clean tables. Inspired by simple operator-friendly
   financial views: minimal chrome, calm colours, one screen.

   Currency labels respect the tenant base currency (no hard-coded USD).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ErpEyebrow, ErpHairline, ErpPage, ErpPanel,
} from "@/components/ui/erp/ErpUi";
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

export default function VisualStatements() {
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
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSnap(j.snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [granularity]);

  useEffect(() => { fetchSnap(); }, [fetchSnap]);

  const ccy = snap?.base_currency ?? "CNY";
  const totalRevenue = snap?.income.revenue.amount ?? 0;
  const netIncome    = snap?.income.net_profit ?? 0;
  const priorRevenue = snap?.income_prior.revenue.amount ?? 0;
  const priorNet     = snap?.income_prior.net_profit ?? 0;
  const revDelta = priorRevenue !== 0 ? (totalRevenue - priorRevenue) : null;
  const revPct   = priorRevenue !== 0 ? ((totalRevenue - priorRevenue) / Math.abs(priorRevenue)) * 100 : null;
  const niDelta  = priorNet !== 0 ? (netIncome - priorNet) : null;
  const niPct    = priorNet !== 0 ? ((netIncome - priorNet) / Math.abs(priorNet)) * 100 : null;

  return (
    <ErpPage
      title="Statements"
      subtitle="Income · Balance Sheet · Cash Flow"
      icon="balance-scale-left"
      backHref="/finance/workspace"
      action={
        <Link href="/reports/statements" className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]">
          <RrIcon name="newspaper" size={12} /> Print version
        </Link>
      }
    >
      {error && <div className="text-sm text-rose-300">{error}</div>}

      {/* Hero KPI strip + trend bars */}
      {snap && (
        <ErpPanel className="px-5 py-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <KpiHeader
              label="Total Revenue"
              ccy={ccy} value={totalRevenue}
              delta={revDelta} pct={revPct}
            />
            <KpiHeader
              label="Net Income"
              ccy={ccy} value={netIncome}
              delta={niDelta} pct={niPct}
              tone={netIncome >= 0 ? "positive" : "warning"}
            />
          </div>
          {/* Trend bar chart — 5 buckets, twin bars (revenue + net income) */}
          <TrendChart trend={snap.trend} />
        </ErpPanel>
      )}

      {/* Tab + period controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
          {[
            { k: "income"   as Tab, label: "Income" },
            { k: "balance"  as Tab, label: "Balance Sheet" },
            { k: "cashflow" as Tab, label: "Cash Flow" },
          ].map((t) => (
            <button key={t.k} type="button" onClick={() => setTab(t.k)}
                    className={`rounded-full px-3.5 py-1.5 text-[12px] transition-colors ${
                      t.k === tab ? "bg-white/[0.10] text-white" : "text-gray-400 hover:text-gray-200"
                    }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
          {[
            { k: "week"    as Granularity, label: "Week" },
            { k: "quarter" as Granularity, label: "Quarter" },
            { k: "year"    as Granularity, label: "Year" },
          ].map((g) => (
            <button key={g.k} type="button" onClick={() => setGranularity(g.k)}
                    className={`rounded-full px-3 py-1 text-[11.5px] transition-colors ${
                      g.k === granularity ? "bg-white/[0.10] text-white" : "text-gray-400 hover:text-gray-200"
                    }`}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-[12px] text-gray-500">Loading statements…</div>}

      {/* Body */}
      {snap && !loading && (
        <ErpPanel className="px-5 py-5">
          {tab === "income"   && <IncomeView pl={snap.income} priorLabel={snap.granularity === "year" ? "Prior year" : snap.granularity === "quarter" ? "Prior quarter" : "Prior week"} prior={snap.income_prior} ccy={ccy} />}
          {tab === "balance"  && <BalanceView bs={snap.balance} ccy={ccy} />}
          {tab === "cashflow" && <CashFlowView cf={snap.cash_flow} ccy={ccy} />}
        </ErpPanel>
      )}
    </ErpPage>
  );
}

/* ─── Hero KPI header ─── */

function KpiHeader({
  label, ccy, value, delta, pct, tone = "neutral",
}: {
  label: string; ccy: string; value: number;
  delta: number | null; pct: number | null;
  tone?: "neutral" | "positive" | "warning";
}) {
  const main =
    tone === "positive" ? "text-emerald-200" :
    tone === "warning"  ? "text-amber-200"   :
                          "text-white";
  const deltaTone = (delta ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{label}</div>
      <div className={`mt-1 font-mono text-[34px] leading-none tabular-nums tracking-[-0.01em] ${main}`}>
        {ccy} {fmtFull(value)}
      </div>
      {delta !== null && pct !== null && (
        <div className={`mt-1.5 text-[11px] ${deltaTone}`}>
          {delta >= 0 ? "▲" : "▼"} {ccy} {fmtFull(Math.abs(delta))} ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
        </div>
      )}
    </div>
  );
}

/* ─── Trend chart ─── */

function TrendChart({ trend }: { trend: TrendBucket[] }) {
  const w = 720; const h = 130; const padL = 14; const padR = 14; const padT = 12; const padB = 22;
  const innerW = w - padL - padR; const innerH = h - padT - padB;
  const maxY = Math.max(1, ...trend.flatMap((t) => [Math.abs(t.revenue), Math.abs(t.net_income)]));
  const gap = 10;
  const slot = innerW / trend.length;
  const barW = (slot - gap) / 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full" role="img" aria-label="Revenue and net income trend">
      <line x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH} stroke="rgba(255,255,255,0.08)" />
      {trend.map((t, i) => {
        const xSlot = padL + i * slot;
        const xRev = xSlot + slot / 2 - barW - 1;
        const xNi  = xSlot + slot / 2 + 1;
        const hRev = Math.max(2, (Math.abs(t.revenue)    / maxY) * innerH);
        const hNi  = Math.max(2, (Math.abs(t.net_income) / maxY) * innerH);
        const niColor = t.net_income >= 0 ? "rgba(180, 92, 60, 0.85)" : "rgba(229, 115, 115, 0.7)";
        return (
          <g key={t.label}>
            <rect x={xRev} y={padT + innerH - hRev} width={barW} height={hRev} fill="rgba(255,255,255,0.85)" rx={2} />
            <rect x={xNi}  y={padT + innerH - hNi}  width={barW} height={hNi}  fill={niColor} rx={2} />
            <text x={xSlot + slot / 2} y={h - 4} fill="rgba(255,255,255,0.5)"
                  fontSize={10} textAnchor="middle">{t.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Income view ─── */

function IncomeView({ pl, prior, priorLabel, ccy }: { pl: ProfitLoss; prior: ProfitLoss; priorLabel: string; ccy: string }) {
  const cur = pl;
  return (
    <div>
      <SectionTitle label="Revenues" />
      {cur.revenue.accounts.length === 0 && <MutedRow label="No revenue posted yet." />}
      {cur.revenue.accounts.map((a) => (
        <TwoColRow key={a.account_id} label={a.name} a={a.amount} b={priorAccount(prior.revenue, a.code)} ccy={ccy} />
      ))}
      <TotalRow label="Total Revenues" a={cur.revenue.amount} b={prior.revenue.amount} ccy={ccy} />

      <SectionTitle label="Expenses" />
      {cur.cost_of_sales.accounts.map((a) => (
        <TwoColRow key={a.account_id} label={a.name} a={a.amount} b={priorAccount(prior.cost_of_sales, a.code)} ccy={ccy} />
      ))}
      {cur.operating_expenses.accounts.map((a) => (
        <TwoColRow key={a.account_id} label={a.name} a={a.amount} b={priorAccount(prior.operating_expenses, a.code)} ccy={ccy} />
      ))}
      <TotalRow
        label="Total Expenses"
        a={cur.cost_of_sales.amount + cur.operating_expenses.amount}
        b={prior.cost_of_sales.amount + prior.operating_expenses.amount}
        ccy={ccy}
      />

      <TotalRow label="Operating Income"
                a={cur.operating_profit} b={prior.operating_profit} ccy={ccy} bold />
      <TotalRow label="Net Income"
                a={cur.net_profit} b={prior.net_profit} ccy={ccy} bold tone={cur.net_profit >= 0 ? "positive" : "warning"} />

      <div className="mt-3 text-right text-[10px] text-gray-500">vs. {priorLabel}</div>
    </div>
  );
}
function priorAccount(section: PLSection, code: string) {
  return section.accounts.find((a) => a.code === code)?.amount ?? 0;
}

/* ─── Balance sheet view ─── */

function BalanceView({ bs, ccy }: { bs: BalanceSheet; ccy: string }) {
  return (
    <div>
      <SectionTitle label="Assets" />
      {bs.assets.accounts.map((a) => (
        <SingleRow key={a.code} label={a.name} amount={a.amount} ccy={ccy} />
      ))}
      <TotalRow label="Total Assets" a={bs.total_assets} ccy={ccy} bold />

      <SectionTitle label="Liabilities" />
      {bs.liabilities.accounts.length === 0 && <MutedRow label="No liabilities posted." />}
      {bs.liabilities.accounts.map((a) => (
        <SingleRow key={a.code} label={a.name} amount={a.amount} ccy={ccy} />
      ))}
      <TotalRow label="Total Liabilities" a={bs.liabilities.amount} ccy={ccy} />

      <SectionTitle label="Equity" />
      {bs.equity.accounts.map((a) => (
        <SingleRow key={a.code} label={a.name} amount={a.amount} ccy={ccy} />
      ))}
      <TotalRow label="Total Equity" a={bs.equity.amount} ccy={ccy} />

      <TotalRow label="Total Liabilities + Equity" a={bs.total_liab_eq} ccy={ccy} bold
                tone={bs.reconciled ? "positive" : "warning"} />
      {!bs.reconciled && (
        <div className="mt-2 text-[11px] text-rose-300">⚠ Balance sheet does not reconcile.</div>
      )}
      <div className="mt-3 text-right text-[10px] text-gray-500">As of {bs.as_of}</div>
    </div>
  );
}

/* ─── Cash flow view ─── */

function CashFlowView({ cf, ccy }: { cf: CashFlow; ccy: string }) {
  return (
    <div>
      <SingleRow label="Opening cash" amount={cf.opening_cash} ccy={ccy} muted />
      {[cf.operating, cf.investing, cf.financing].map((s) => (
        <div key={s.label}>
          <SectionTitle label={s.label} />
          {s.lines.length === 0 && <MutedRow label="—" />}
          {s.lines.map((l, i) => (
            <SingleRow key={`${s.label}-${i}`} label={l.label} amount={l.amount} ccy={ccy} />
          ))}
          <TotalRow label={`${s.label} subtotal`} a={s.amount} ccy={ccy} />
        </div>
      ))}
      <TotalRow label="Net change in cash" a={cf.net_change} ccy={ccy} />
      <TotalRow label="Closing cash" a={cf.closing_cash} ccy={ccy} bold
                tone={cf.reconciled ? "positive" : "warning"} />
    </div>
  );
}

/* ─── Row primitives ─── */

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="mb-1 mt-5 first:mt-0 text-[10px] uppercase tracking-[0.16em] text-gray-500">{label}</div>
  );
}
function SingleRow({ label, amount, ccy, muted = false }: { label: string; amount: number; ccy: string; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between border-b border-white/[0.04] py-1.5 text-[12.5px] last:border-b-0 ${muted ? "text-gray-500" : ""}`}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">{ccy} {fmtSigned(amount)}</span>
    </div>
  );
}
function TwoColRow({ label, a, b, ccy }: { label: string; a: number; b: number; ccy: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-6 border-b border-white/[0.04] py-1.5 text-[12.5px] last:border-b-0">
      <span>{label}</span>
      <span className="font-mono tabular-nums">{fmtSigned(a)}</span>
      <span className="font-mono tabular-nums text-gray-500">{fmtSigned(b)}</span>
      <span className="hidden">{ccy}</span>
    </div>
  );
}
function TotalRow({
  label, a, b, ccy, bold = false, tone = "neutral",
}: {
  label: string; a: number; b?: number; ccy: string;
  bold?: boolean; tone?: "neutral" | "positive" | "warning";
}) {
  const cls =
    tone === "positive" ? "border-emerald-300/40 bg-emerald-300/[0.04] text-emerald-100" :
    tone === "warning"  ? "border-amber-300/40 bg-amber-300/[0.04] text-amber-100" :
                          "border-white/[0.08] bg-white/[0.02]";
  const inner = (
    <div className={`mt-2 grid grid-cols-[1fr_auto${b !== undefined ? "_auto" : ""}] items-baseline gap-6 rounded-md border ${cls} px-3 py-2 text-[13px] ${bold ? "font-semibold" : "font-medium"}`}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">{ccy} {fmtSigned(a)}</span>
      {b !== undefined && <span className="font-mono tabular-nums text-gray-500">{fmtSigned(b)}</span>}
    </div>
  );
  return inner;
}
function MutedRow({ label }: { label: string }) {
  return <div className="border-b border-white/[0.04] py-1.5 text-[11px] text-gray-500 last:border-b-0">{label}</div>;
}
