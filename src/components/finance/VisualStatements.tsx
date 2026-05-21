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
import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErpPage, ErpPanel } from "@/components/ui/erp/ErpUi";
import RrIcon from "@/components/ui/RrIcon";
import { useTranslation, type Lang } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";

type Tab = "income" | "balance" | "cashflow";
type Granularity = "week" | "month" | "quarter" | "year";

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
function localeOf(lang: Lang): string {
  return lang === "zh" ? "zh-CN" : lang === "ar" ? "ar" : "en-US";
}
function fmtPeriodLabel(iso: string, lang: Lang, granularity: Granularity = "year"): string {
  /* Granularity-aware period label so the two comparison columns show
     a meaningful tag instead of two identical "Dec 31" strings:
       · year     → "2026"
       · quarter  → "Q4 2026"
       · month    → "May 2026"
       · week     → "May 20"
     All localized via toLocaleDateString. */
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const loc = localeOf(lang);
    if (granularity === "year") {
      return d.toLocaleDateString(loc, { year: "numeric" });
    }
    if (granularity === "quarter") {
      const q = Math.floor(d.getUTCMonth() / 3) + 1;
      const year = d.toLocaleDateString(loc, { year: "numeric" });
      return `Q${q} ${year}`;
    }
    if (granularity === "month") {
      return d.toLocaleDateString(loc, { month: "short", year: "numeric" });
    }
    /* week */
    return d.toLocaleDateString(loc, { month: "short", day: "numeric" });
  } catch { return iso; }
}

/* ── Chromeless body — used by FinanceHome (/finance) ────────────────── */

export function StatementsDashboard() {
  const { t, lang } = useTranslation(financeT);
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

  const curLabel   = snap ? fmtPeriodLabel(snap.income.period.to,       lang, snap.granularity) : "";
  const priorLabel = snap ? fmtPeriodLabel(snap.income_prior.period.to, lang, snap.granularity) : "";

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
            <KpiHero label={t("visual.totalRevenue", "TOTAL REVENUE")} ccy={ccy} value={totalRevenue}
                     delta={revDelta} pct={revPct} tone="neutral" />
            <KpiHero label={t("visual.netIncome", "NET INCOME")}    ccy={ccy} value={netIncome}
                     delta={niDelta}  pct={niPct}  tone={netIncome >= 0 ? "positive" : "warning"} />
          </div>
          <TrendChart trend={snap.trend} />
        </ErpPanel>
      )}

      {/* ── Toggles ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <PillToggle
          options={[
            { k: "income"  , label: t("visual.tab.income", "Income") },
            { k: "balance" , label: t("visual.tab.balance", "Balance Sheet") },
            { k: "cashflow", label: t("visual.tab.cashflow", "Cash Flow") },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
        <PillToggle
          size="sm"
          options={[
            { k: "week",    label: t("visual.gran.week",    "Week") },
            { k: "month",   label: t("visual.gran.month",   "Month") },
            { k: "quarter", label: t("visual.gran.quarter", "Quarter") },
            { k: "year",    label: t("visual.gran.year",    "Year") },
          ]}
          value={granularity}
          onChange={(v) => setGranularity(v as Granularity)}
        />
      </div>

      {loading && (
        <div className="text-center text-[12px] text-[var(--text-dim)]">{t("visual.loading", "Loading statements…")}</div>
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
  const { t } = useTranslation(financeT);
  return (
    <ErpPage
      title={t("visual.pageTitle", "Overview")}
      subtitle={t("visual.pageSubtitle", "Income · Balance Sheet · Cash Flow")}
      icon="balance-scale-left"
      backHref="/finance"
      action={
        <Link href="/reports/statements" className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-surface-hover)]">
          <RrIcon name="newspaper" size={12} /> {t("visual.printVersion", "Print version")}
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">{label}</div>
      <div className={`mt-3 font-mono text-[34px] leading-none tabular-nums tracking-[-0.01em] sm:text-[42px] ${main}`}>
        {ccy && <span className="mr-1 text-[16px] text-[var(--text-dim)]">{ccy}</span>}
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
  const { t } = useTranslation(financeT);
  const buckets = trend.slice(-5);
  const w = 920; const h = 170; const padL = 16; const padR = 16; const padT = 8; const padB = 26;
  const innerW = w - padL - padR; const innerH = h - padT - padB;
  const maxY = Math.max(1, ...buckets.flatMap((tt) => [Math.abs(tt.revenue), Math.abs(tt.net_income)]));
  const gap = 14;
  const slot = innerW / Math.max(1, buckets.length);
  const barW = Math.max(8, (slot - gap) / 2);
  const ariaLabel = `${t("visual.totalRevenue", "TOTAL REVENUE")} · ${t("visual.netIncome", "NET INCOME")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-6 w-full" role="img" aria-label={ariaLabel}>
      <line x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH} stroke="rgba(255,255,255,0.08)" />
      {buckets.map((tt, i) => {
        const xSlot = padL + i * slot;
        const xRev = xSlot + slot / 2 - barW - 2;
        const xNi  = xSlot + slot / 2 + 2;
        /* Zero-data buckets render nothing so an empty tenant doesn't show
           5 phantom hairlines along the baseline. */
        const showRev = Math.abs(tt.revenue)    > 0;
        const showNi  = Math.abs(tt.net_income) > 0;
        const hRev = Math.max(2, (Math.abs(tt.revenue)    / maxY) * innerH);
        const hNi  = Math.max(2, (Math.abs(tt.net_income) / maxY) * innerH);
        /* Monochrome palette: white = revenue, dim white = net income.
           Negative net income is hinted with a slightly warmer dim — but
           still neutral so the chart matches the rest of the Hub's
           grayscale chrome. Positive vs negative is read from the KPI
           tone above, not from the bar colour. */
        const niColor = tt.net_income >= 0 ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.30)";
        return (
          <g key={`${tt.label}-${i}`}>
            {showRev && <rect x={xRev} y={padT + innerH - hRev} width={barW} height={hRev} fill="rgba(255,255,255,0.85)" rx={2} />}
            {showNi  && <rect x={xNi}  y={padT + innerH - hNi}  width={barW} height={hNi}  fill={niColor}              rx={2} />}
            <text x={xSlot + slot / 2} y={h - 6} fill="rgba(255,255,255,0.45)"
                  fontSize={11} textAnchor="middle">{tt.label}</text>
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
    <div className="flex gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1">
      {options.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onChange(o.k)}
          className={`rounded-full transition-colors ${pad} ${
            o.k === value
              ? "bg-[var(--bg-surface-active)] text-white"
              : "text-[var(--text-secondary)] hover:text-[var(--text-highlight)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───── Two-period table primitives (with column headers) ───── */

/* ───── Statement table — shared-grid architecture ─────
   Each statement view (Income / Balance / Cash Flow) wraps its rows in
   ONE grid container. Row "components" return Fragments of cells that
   land directly in the parent grid, so every column track is computed
   once and all rows share identical widths. This is what fixes the
   "numbers in different rows don't sit in the same column" problem
   the operator pointed out — the previous design used per-row grids,
   each computing its own max-content for the value columns. */

/* Fixed 8 rem value columns hold up to ~11-digit numbers with thousand
   separators ("999,999,999") at the current font, with breathing room.
   Label column flexes; the gap is part of the grid template so we don't
   need separate gap utilities (which would land on every grid item). */
const STATEMENT_GRID_2COL = "grid grid-cols-[1fr_8rem_8rem] items-baseline";
const STATEMENT_GRID_1COL = "grid grid-cols-[1fr_8rem] items-baseline";

type StatementTone = "neutral" | "positive" | "warning";

/* ───── Hierarchy ──────────────────────────────────────────────
   Five distinct row treatments so the operator can tell at a glance
   what they're looking at:

     1. Period column header  — tiny uppercase eyebrow + hairline.
     2. Section title         — 13 px BOLD, full-width hairline below.
                                LARGER than data rows so it actually
                                reads as a header.
     3. Data row              — 13 px regular, label INDENTED 24 px so
                                you can see it belongs to the section.
     4. Subtotal              — 13.5 px semibold, hairline above, label
                                NOT indented so it visually sits at the
                                section level (Total Revenues / Total
                                Expenses).
     5. Total                 — 14.5 px bold, stronger border, tonal
                                value (Operating Income).
     6. Headline              — 16 px bold, tinted bar with accent
                                stripe (Net Income / Closing Cash).
   ────────────────────────────────────────────────────────────── */

/* Single-element divider that spans all the grid columns. Replaces
   per-cell border-t / border-b — when each row's three cells each
   carried their own border, sub-pixel baseline differences between
   the label and number cells made the line look broken at the cell
   boundaries. A col-span div is ONE element → guaranteed continuous. */
function Divider({
  showPrior, weight = "subtle", className = "",
}: {
  showPrior: boolean;
  weight?: "faint" | "subtle" | "color" | "strong";
  className?: string;
}) {
  const span = showPrior ? "col-span-3" : "col-span-2";
  const tone =
    weight === "strong" ? "bg-[var(--border-strong)] h-[1.5px]" :
    weight === "color"  ? "bg-[var(--border-color)] h-px"       :
    weight === "subtle" ? "bg-[var(--border-subtle)] h-px"      :
                          "bg-[var(--border-faint)] h-px";
  return <div aria-hidden className={`${span} ${tone} ${className}`} />;
}

function HeaderCells({ priorLabel, curLabel, showPrior }: { priorLabel?: string; curLabel: string; showPrior: boolean }) {
  const { t } = useTranslation(financeT);
  /* Bumped from 10.5 px → 14 px so the period tags ("May 14" /
     "May 21", "2025" / "2026", "Q4 2026") read clearly on first
     glance — they're the orientation cue for the whole table. Kept
     uppercase + tracking for typographic continuity with the rest of
     the eyebrow labels in the Hub. */
  const baseCls = "pb-3 text-[14px] font-semibold uppercase tracking-[0.10em]";
  return (
    <>
      <div className={`${baseCls} text-[var(--text-dim)]`} />
      {showPrior && (
        <div className={`${baseCls} text-right text-[var(--text-secondary)] pe-4`}>
          {priorLabel || t("visual.prior", "Prior")}
        </div>
      )}
      <div className={`${baseCls} text-right text-[var(--text-primary)] pe-4`}>
        {curLabel || t("visual.current", "Current")}
      </div>
      <Divider showPrior={showPrior} weight="color" />
    </>
  );
}

function SectionTitleRow({ label, cols }: { label: string; cols: 2 | 3 }) {
  /* Label and hairline are SEPARATE col-span items (not nested) so the
     hairline is guaranteed to be one full-width element. */
  const showPrior = cols === 3;
  const span = showPrior ? "col-span-3" : "col-span-2";
  return (
    <>
      <div className={`${span} mt-6 first:mt-4 text-[13px] font-bold uppercase tracking-[0.10em] text-[var(--text-primary)]`}>
        {label}
      </div>
      <Divider showPrior={showPrior} weight="subtle" className="mt-1.5 mb-1" />
    </>
  );
}

function MutedRowSpan({ label, cols }: { label: string; cols: 2 | 3 }) {
  const span = cols === 3 ? "col-span-3" : "col-span-2";
  return <div className={`${span} ps-6 py-2 text-[11.5px] text-[var(--text-dim)] italic`}>{label}</div>;
}

/* Data row — labels indented 24px (ps-6) so they read as children of
   the section header. No border between rows — the indent + section
   hairline are enough separation; horizontal hairlines made the table
   feel like a grid of cells instead of a section of related rows. */
function DataCells({ label, prior, cur, showPrior }: { label: string; prior?: number; cur: number; showPrior: boolean }) {
  const baseCls = "py-1.5 text-[12.5px]";
  return (
    <>
      <div className={`${baseCls} ps-6 text-[var(--text-secondary)]`}>{label}</div>
      {showPrior && (
        <div className={`${baseCls} text-right font-mono tabular-nums text-[var(--text-dim)] pe-4`}>{fmtSigned(prior ?? 0)}</div>
      )}
      <div className={`${baseCls} text-right font-mono tabular-nums text-[var(--text-primary)] pe-4`}>{fmtSigned(cur)}</div>
    </>
  );
}

/* Subtotal — semibold, hairline above (rendered as a separate
   col-span divider, NOT per-cell borders, so the line is guaranteed
   to be one continuous element). Label NOT indented. */
function SubtotalCells({ label, prior, cur, showPrior }: { label: string; prior?: number; cur: number; showPrior: boolean }) {
  const baseCls = "pt-2 pb-1 text-[13px] font-semibold";
  return (
    <>
      <Divider showPrior={showPrior} weight="subtle" className="mt-2" />
      <div className={`${baseCls} text-[var(--text-primary)]`}>{label}</div>
      {showPrior && (
        <div className={`${baseCls} text-right font-mono tabular-nums text-[var(--text-secondary)] pe-4`}>{fmtSigned(prior ?? 0)}</div>
      )}
      <div className={`${baseCls} text-right font-mono tabular-nums text-[var(--text-primary)] pe-4`}>{fmtSigned(cur)}</div>
    </>
  );
}

/* Total — bold uppercase, stronger top divider, tonal value. */
function TotalCells({ label, prior, cur, showPrior, tone }: { label: string; prior?: number; cur: number; showPrior: boolean; tone: StatementTone }) {
  const valueTone =
    tone === "positive" ? "text-emerald-200" :
    tone === "warning"  ? "text-rose-200"    :
                          "text-[var(--text-primary)]";
  const baseCls = "pt-3 pb-2 text-[14px] font-bold uppercase tracking-[0.06em]";
  return (
    <>
      <Divider showPrior={showPrior} weight="color" className="mt-4" />
      <div className={`${baseCls} text-[var(--text-primary)]`}>{label}</div>
      {showPrior && (
        <div className={`${baseCls} text-right font-mono tabular-nums text-[var(--text-secondary)] pe-4`}>{fmtSigned(prior ?? 0)}</div>
      )}
      <div className={`${baseCls} text-right font-mono tabular-nums ${valueTone} pe-4`}>{fmtSigned(cur)}</div>
    </>
  );
}

/* Headline — Net Income / Closing cash.

   Standalone summary card treatment so the bottom line reads as a
   genuinely distinct element rather than just another row with a
   different border weight. Three adjacent grid cells share an
   elevated bg (darker than the surrounding panel — panel-in-panel
   effect, the same depth pattern used by Hub stat cards in Sales /
   Inventory), a tonal hairline ring all the way around, and rounded
   corners on the leading and trailing cells.

   Value typography is 24 px font-mono tabular-nums — the largest
   number on the page so the eye naturally lands here. Label is
   compact uppercase 13 px so it doesn't compete with the figure.

   A small delta line (▲ +CNY 437,467  +1.2%) renders underneath the
   value when a prior figure exists, giving the operator the change
   reading without needing to compute it from two columns. */
function HeadlineCells({ label, prior, cur, showPrior, tone }: { label: string; prior?: number; cur: number; showPrior: boolean; tone: StatementTone }) {
  /* Tonal palette — the value carries the signal; the chrome stays
     calm so the card doesn't look like a status banner. */
  const valueTone =
    tone === "positive" ? "text-emerald-200" :
    tone === "warning"  ? "text-rose-200"    :
                          "text-[var(--text-primary)]";
  const ringTone =
    tone === "positive" ? "ring-emerald-300/25" :
    tone === "warning"  ? "ring-rose-300/25"    :
                          "ring-[var(--border-color)]";
  const accentBar =
    tone === "positive" ? "bg-emerald-300/80" :
    tone === "warning"  ? "bg-rose-300/80"    :
                          "bg-[var(--text-highlight)]";

  /* Each cell carries the same bg + ring so they read as one card.
     Rounded corners go on the leading + trailing cells only. */
  const cellShell =
    "bg-[var(--bg-primary)] ring-1 " + ringTone + " py-5 sm:py-6";

  /* Delta line — only when comparing periods AND there's a meaningful
     change to show. */
  const deltaValue = showPrior && prior !== undefined ? cur - (prior ?? 0) : null;
  const deltaPct   = showPrior && prior !== undefined && Math.abs(prior) > 0.5
    ? ((cur - prior) / Math.abs(prior)) * 100
    : null;
  const deltaUp    = (deltaValue ?? 0) >= 0;
  const deltaTone  = deltaValue == null
    ? "text-[var(--text-dim)]"
    : deltaUp ? "text-emerald-300/80" : "text-rose-300/80";

  return (
    <>
      {/* Breathing space above the card */}
      <div aria-hidden className={`${showPrior ? "col-span-3" : "col-span-2"} mt-5`} />

      {/* Leading cell — label + accent stripe at the leading edge */}
      <div className={`${cellShell} relative ps-6 pe-3 rounded-s-xl flex flex-col justify-center`}>
        <span aria-hidden className={`absolute start-0 top-5 bottom-5 w-[3px] rounded-full ${accentBar}`} />
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.20em] text-[var(--text-dim)]">
          {label}
        </div>
        {deltaValue !== null && (
          <div className={`mt-2 text-[12px] font-medium tabular-nums ${deltaTone}`}>
            {deltaUp ? "▲" : "▼"} {fmtSigned(Math.abs(deltaValue))}
            {deltaPct !== null && ` · ${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`}
          </div>
        )}
      </div>

      {showPrior && (
        <div className={`${cellShell} px-3 text-right flex flex-col justify-center`}>
          <div className="text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-dim)] mb-1">
            Prior
          </div>
          <div className="text-[18px] font-bold font-mono tabular-nums text-[var(--text-secondary)]">
            {fmtSigned(prior ?? 0)}
          </div>
        </div>
      )}

      <div className={`${cellShell} ps-3 pe-6 rounded-e-xl text-right flex flex-col justify-center`}>
        {showPrior && (
          <div className="text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-dim)] mb-1">
            Current
          </div>
        )}
        <div className={`text-[24px] font-bold font-mono tabular-nums leading-none tracking-[-0.01em] ${valueTone}`}>
          {fmtSigned(cur)}
        </div>
      </div>
    </>
  );
}

/* ───── Income view ───── */

function IncomeView({ pl, prior, ccy, curLabel, priorLabel }: { pl: ProfitLoss; prior: ProfitLoss; ccy: string; curLabel: string; priorLabel: string }) {
  const { t } = useTranslation(financeT);
  void ccy;
  return (
    <div className={STATEMENT_GRID_2COL}>
      <HeaderCells priorLabel={priorLabel} curLabel={curLabel} showPrior />

      <SectionTitleRow label={t("visual.section.revenues", "Revenues")} cols={3} />
      {pl.revenue.accounts.length === 0 && <MutedRowSpan label={t("visual.emptyRev", "No revenue posted yet.")} cols={3} />}
      {pl.revenue.accounts.map((a) => (
        <DataCells key={a.account_id} label={a.name} prior={priorAccount(prior.revenue, a.code)} cur={a.amount} showPrior />
      ))}
      <SubtotalCells label={t("visual.row.totalRev", "Total Revenues")} prior={prior.revenue.amount} cur={pl.revenue.amount} showPrior />

      <SectionTitleRow label={t("visual.section.expenses", "Expenses")} cols={3} />
      {pl.cost_of_sales.accounts.map((a) => (
        <DataCells key={a.account_id} label={a.name} prior={priorAccount(prior.cost_of_sales, a.code)} cur={a.amount} showPrior />
      ))}
      {pl.operating_expenses.accounts.map((a) => (
        <DataCells key={a.account_id} label={a.name} prior={priorAccount(prior.operating_expenses, a.code)} cur={a.amount} showPrior />
      ))}
      <SubtotalCells
        label={t("visual.row.totalExp", "Total Expenses")}
        prior={prior.cost_of_sales.amount + prior.operating_expenses.amount}
        cur={pl.cost_of_sales.amount + pl.operating_expenses.amount}
        showPrior
      />

      <TotalCells label={t("visual.row.opIncome", "Operating Income")}
                  prior={prior.operating_profit} cur={pl.operating_profit}
                  showPrior
                  tone={pl.operating_profit >= 0 ? "positive" : "warning"} />

      <HeadlineCells label={t("visual.row.netIncome", "Net Income")}
                     prior={prior.net_profit} cur={pl.net_profit}
                     showPrior
                     tone={pl.net_profit >= 0 ? "positive" : "warning"} />
    </div>
  );
}
function priorAccount(section: PLSection, code: string) {
  return section.accounts.find((a) => a.code === code)?.amount ?? 0;
}

/* ───── Balance sheet ───── */

function BalanceView({ bs, ccy, curLabel }: { bs: BalanceSheet; ccy: string; curLabel: string }) {
  const { t } = useTranslation(financeT);
  void ccy;
  return (
    <div className={STATEMENT_GRID_1COL}>
      <HeaderCells curLabel={curLabel || bs.as_of} showPrior={false} />

      <SectionTitleRow label={t("visual.section.assets", "Assets")} cols={2} />
      {bs.assets.accounts.map((a) => (
        <DataCells key={a.code} label={a.name} cur={a.amount} showPrior={false} />
      ))}
      <TotalCells label={t("visual.row.totalAssets", "Total Assets")} cur={bs.total_assets} showPrior={false} tone="neutral" />

      <SectionTitleRow label={t("visual.section.liabilities", "Liabilities")} cols={2} />
      {bs.liabilities.accounts.length === 0 && <MutedRowSpan label={t("visual.emptyLiab", "No liabilities posted.")} cols={2} />}
      {bs.liabilities.accounts.map((a) => (
        <DataCells key={a.code} label={a.name} cur={a.amount} showPrior={false} />
      ))}
      <SubtotalCells label={t("visual.row.totalLiab", "Total Liabilities")} cur={bs.liabilities.amount} showPrior={false} />

      <SectionTitleRow label={t("visual.section.equity", "Equity")} cols={2} />
      {bs.equity.accounts.map((a) => (
        <DataCells key={a.code} label={a.name} cur={a.amount} showPrior={false} />
      ))}
      <SubtotalCells label={t("visual.row.totalEquity", "Total Equity")} cur={bs.equity.amount} showPrior={false} />

      <HeadlineCells label={t("visual.row.totalLiabEq", "Total Liabilities & Equity")}
                     cur={bs.total_liab_eq}
                     showPrior={false}
                     tone={bs.reconciled ? "positive" : "warning"} />
      {!bs.reconciled && (
        <div className="col-span-2 mt-2 text-[11px] text-rose-300">{t("visual.bsMismatch", "⚠ Balance sheet does not reconcile.")}</div>
      )}
    </div>
  );
}

/* ───── Cash flow ───── */

function CashFlowView({ cf, ccy, curLabel }: { cf: CashFlow; ccy: string; curLabel: string }) {
  const { t } = useTranslation(financeT);
  void ccy;
  return (
    <div className={STATEMENT_GRID_1COL}>
      <HeaderCells curLabel={curLabel} showPrior={false} />

      <DataCells label={t("visual.row.openingCash", "Opening cash")} cur={cf.opening_cash} showPrior={false} />

      {[cf.operating, cf.investing, cf.financing].map((s) => (
        <Fragment key={s.label}>
          <SectionTitleRow label={s.label} cols={2} />
          {s.lines.length === 0 && <MutedRowSpan label="—" cols={2} />}
          {s.lines.map((l, i) => (
            <DataCells key={`${s.label}-${i}`} label={l.label} cur={l.amount} showPrior={false} />
          ))}
          <SubtotalCells label={t("visual.row.subtotal", "{name} subtotal").replace("{name}", s.label)} cur={s.amount} showPrior={false} />
        </Fragment>
      ))}

      <TotalCells label={t("visual.row.netChange", "Net change in cash")} cur={cf.net_change} showPrior={false} tone="neutral" />

      <HeadlineCells label={t("visual.row.closingCash", "Closing cash")}
                     cur={cf.closing_cash}
                     showPrior={false}
                     tone={cf.reconciled ? "positive" : "warning"} />
    </div>
  );
}
