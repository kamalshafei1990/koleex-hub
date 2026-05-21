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
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ErpPage, ErpPanel } from "@/components/ui/erp/ErpUi";
import RrIcon from "@/components/ui/RrIcon";
import { AngleLeftIcon, AngleRightIcon, CrossIcon } from "@/components/icons/ui";
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
  income: ProfitLoss; income_compare?: ProfitLoss;
  compare_period?: { from: string; to: string };
  balance: BalanceSheet; cash_flow: CashFlow;
  cash_flow_compare?: CashFlow;
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

/* ── Client-side period navigation helpers ─────────────────────────────
   Lightweight twins of the server-side helpers in visual-statements.ts.
   We only need to compute a NEW anchor date (period_end) to send to the
   API — the server takes it from there and computes the full window. */

function toIso(d: Date): string {
  /* UTC slice — matches the server's todayIso() convention. */
  return d.toISOString().slice(0, 10);
}
function todayIso(): string {
  return toIso(new Date());
}
/** Return a sensible "anchor" date for the granularity — the end of
 *  the current calendar bucket, capped at today. */
function defaultAnchorForGranularity(g: Granularity): string {
  const today = new Date(`${todayIso()}T00:00:00Z`);
  if (g === "year") {
    /* End of current year, but never beyond today. */
    const end = new Date(Date.UTC(today.getUTCFullYear(), 11, 31));
    return end > today ? toIso(today) : toIso(end);
  }
  if (g === "quarter") {
    const q = Math.floor(today.getUTCMonth() / 3);
    const end = new Date(Date.UTC(today.getUTCFullYear(), q * 3 + 3, 0));
    return end > today ? toIso(today) : toIso(end);
  }
  if (g === "month") {
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    return end > today ? toIso(today) : toIso(end);
  }
  /* week — last 7 days ending today */
  return toIso(today);
}
function shiftAnchor(iso: string, g: Granularity, direction: 1 | -1): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (g === "week")    d.setUTCDate(d.getUTCDate() + direction * 7);
  if (g === "month")   d.setUTCMonth(d.getUTCMonth() + direction);
  if (g === "quarter") d.setUTCMonth(d.getUTCMonth() + direction * 3);
  if (g === "year")    d.setUTCFullYear(d.getUTCFullYear() + direction);
  return toIso(d);
}
/** Once we navigate, the anchor may sit mid-period. Clamp to today so
 *  ▶ can't drift the user into the future. Returns null when the next
 *  step would clearly cross "today" by a full bucket. */
function isAtOrAfterToday(iso: string, g: Granularity): boolean {
  const t = todayIso();
  if (g === "year") return iso.slice(0, 4) >= t.slice(0, 4);
  if (g === "quarter") {
    const a = new Date(`${iso}T00:00:00Z`);
    const b = new Date(`${t}T00:00:00Z`);
    const aQ = a.getUTCFullYear() * 4 + Math.floor(a.getUTCMonth() / 3);
    const bQ = b.getUTCFullYear() * 4 + Math.floor(b.getUTCMonth() / 3);
    return aQ >= bQ;
  }
  if (g === "month") return iso.slice(0, 7) >= t.slice(0, 7);
  return iso >= t;
}

/* ── Chromeless body — used by FinanceHome (/finance) ────────────────── */

export function StatementsDashboard() {
  const { t, lang } = useTranslation(financeT);
  const [tab, setTab] = useState<Tab>("income");
  const [granularity, setGranularity] = useState<Granularity>("year");
  const [periodEnd, setPeriodEnd] = useState<string>(() => defaultAnchorForGranularity("year"));
  const [compareEnd, setCompareEnd] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchSnap = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ granularity, period_end: periodEnd });
      if (compareEnd) qs.set("compare_end", compareEnd);
      const r = await fetch(`/api/finance/visual-statements?${qs.toString()}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error || `HTTP ${r.status}`));
      setSnap(j.snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [granularity, periodEnd, compareEnd]);

  useEffect(() => { fetchSnap(); }, [fetchSnap]);

  /* When granularity changes: snap periodEnd to a sensible boundary
     and clear the comparison — the operator opts back in if they want
     to compare in the new granularity. */
  const handleGranularityChange = useCallback((g: Granularity) => {
    setGranularity(g);
    setPeriodEnd(defaultAnchorForGranularity(g));
    setCompareEnd(null);
  }, []);

  const handleAddCompare = useCallback(() => {
    /* Pre-fill with the previous period so the comparison is meaningful
       out of the box. */
    setCompareEnd(shiftAnchor(periodEnd, granularity, -1));
  }, [periodEnd, granularity]);

  const showCompare = !!snap?.income_compare;
  const ccy = snap?.base_currency ?? "";
  const totalRevenue = snap?.income.revenue.amount ?? 0;
  const netIncome    = snap?.income.net_profit ?? 0;
  const cmpRevenue   = snap?.income_compare?.revenue.amount ?? 0;
  const cmpNet       = snap?.income_compare?.net_profit ?? 0;
  const revDelta = showCompare && cmpRevenue !== 0 ? (totalRevenue - cmpRevenue) : null;
  const revPct   = showCompare && cmpRevenue !== 0 ? ((totalRevenue - cmpRevenue) / Math.abs(cmpRevenue)) * 100 : null;
  const niDelta  = showCompare && cmpNet !== 0 ? (netIncome - cmpNet) : null;
  const niPct    = showCompare && cmpNet !== 0 ? ((netIncome - cmpNet) / Math.abs(cmpNet)) * 100 : null;

  const curLabel   = snap ? fmtPeriodLabel(snap.income.period.to, lang, snap.granularity) : "";
  const cmpLabel   = snap?.income_compare ? fmtPeriodLabel(snap.income_compare.period.to, lang, snap.granularity) : "";

  /* Period-chip label uses the current period_end, computed live so
     the chip updates immediately while a fetch is in flight. */
  const periodChipLabel = useMemo(
    () => fmtPeriodLabel(periodEnd, lang, granularity),
    [periodEnd, lang, granularity],
  );
  const compareChipLabel = useMemo(
    () => (compareEnd ? fmtPeriodLabel(compareEnd, lang, granularity) : ""),
    [compareEnd, lang, granularity],
  );

  const nextDisabled = isAtOrAfterToday(periodEnd, granularity);

  return (
    <div className="space-y-5">
      {error && (
        <ErpPanel className="px-5 py-3">
          <div className="text-[13px] text-rose-600 dark:text-rose-300">{error}</div>
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

      {/* ── Control bar — all toggles + period nav in ONE panel ─────
           Two visually-grouped rows inside a single ErpPanel-style
           container so the operator sees "Statement view" and
           "Period selection" as related controls instead of three
           floating centered groups. */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 sm:px-5 sm:py-4">
        {/* Row 1 — Statement view (left) + Granularity (right) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
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
            onChange={(v) => handleGranularityChange(v as Granularity)}
          />
        </div>

        {/* Thin hairline between the two control rows */}
        <div aria-hidden className="my-3 h-px w-full bg-[var(--border-subtle)]" />

        {/* Row 2 — Period chip + Compare */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
            {t("visual.period.label", "Period")}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <PeriodChip
              label={periodChipLabel}
              onPrev={() => setPeriodEnd(shiftAnchor(periodEnd, granularity, -1))}
              onNext={() => setPeriodEnd(shiftAnchor(periodEnd, granularity, 1))}
              nextDisabled={nextDisabled}
              ariaPrev={t("visual.period.prev", "Previous period")}
              ariaNext={t("visual.period.next", "Next period")}
            />
            {compareEnd ? (
              <>
                <span className="text-[11px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                  {t("visual.compare.vs", "vs")}
                </span>
                <PeriodChip
                  label={compareChipLabel}
                  onPrev={() => setCompareEnd(shiftAnchor(compareEnd, granularity, -1))}
                  onNext={() => setCompareEnd(shiftAnchor(compareEnd, granularity, 1))}
                  nextDisabled={false}
                  ariaPrev={t("visual.period.prev", "Previous period")}
                  ariaNext={t("visual.period.next", "Next period")}
                  tone="compare"
                />
                <button
                  type="button"
                  onClick={() => setCompareEnd(null)}
                  aria-label={t("visual.compare.remove", "Remove comparison")}
                  title={t("visual.compare.remove", "Remove comparison")}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-highlight)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <CrossIcon size={10} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleAddCompare}
                className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-1.5 text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--text-highlight)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                {t("visual.compare.add", "+ Compare")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Statement body ──────────────────────────────────────────────
          We DON'T unmount during loading — that caused the page height
          to collapse and the browser to scroll to the top when the new
          snapshot arrived. Instead we keep the previous snap visible,
          fade it slightly, and overlay a subtle loading badge in the
          corner. The min-height also reserves space on the first ever
          load so the page chrome doesn't bounce. */}
      <div className="relative min-h-[300px]">
        {loading && (
          <div className="pointer-events-none absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1 text-[11px] text-[var(--text-dim)] shadow-sm">
            <span aria-hidden className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--border-color)] border-t-[var(--text-primary)]" />
            {t("visual.loading", "Loading statements…")}
          </div>
        )}
        {snap && (
        <ErpPanel className={`px-5 py-6 sm:px-8 transition-opacity duration-200 ${loading ? "opacity-60" : "opacity-100"}`}>
          {tab === "income"   && (
            <IncomeView
              pl={snap.income}
              compare={snap.income_compare}
              ccy={ccy}
              curLabel={curLabel}
              compareLabel={cmpLabel}
            />
          )}
          {tab === "balance"  && <BalanceView bs={snap.balance} ccy={ccy} curLabel={curLabel} />}
          {tab === "cashflow" && (
            <CashFlowView
              cf={snap.cash_flow}
              compare={snap.cash_flow_compare}
              ccy={ccy}
              curLabel={curLabel}
              compareLabel={cmpLabel}
            />
          )}
        </ErpPanel>
      )}
      </div>
    </div>
  );
}

/* ───── Period chip — prev / label / next with chevrons ─────
   Compact pill matching the granularity PillToggle visual family.
   The chevron buttons are h-7 w-7 (tap-friendly on mobile per the
   Hub mobile parity rules). When `nextDisabled` is true the ▶ button
   stops accepting clicks AND tones down so the operator can see why
   nothing happened (avoids "broken button" anxiety). */
function PeriodChip({
  label, onPrev, onNext, nextDisabled, ariaPrev, ariaNext, tone = "current",
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  ariaPrev: string;
  ariaNext: string;
  tone?: "current" | "compare";
}) {
  const labelTone =
    tone === "compare"
      ? "text-[var(--text-secondary)]"
      : "text-[var(--text-primary)] font-medium";
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1 py-0.5">
      <button
        type="button"
        onClick={onPrev}
        aria-label={ariaPrev}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-highlight)] hover:bg-[var(--bg-surface-hover)] transition-colors"
      >
        <AngleLeftIcon size={11} />
      </button>
      <span className={`px-2 text-[12.5px] tabular-nums ${labelTone}`}>{label}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={ariaNext}
        aria-disabled={nextDisabled}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
          nextDisabled
            ? "text-[var(--text-dim)] opacity-50 cursor-not-allowed"
            : "text-[var(--text-secondary)] hover:text-[var(--text-highlight)] hover:bg-[var(--bg-surface-hover)]"
        }`}
      >
        <AngleRightIcon size={11} />
      </button>
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
    tone === "positive" ? "text-emerald-700 dark:text-emerald-200" :
    tone === "warning"  ? "text-amber-700 dark:text-amber-200"   :
                          "text-[var(--text-primary)]";
  const deltaUp = (delta ?? 0) >= 0;
  const deltaTone = deltaUp ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";

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

  /* SVG fills can't read CSS variables directly, so we use Tailwind
     `fill-*` / `stroke-*` utilities with dark: variants. Light mode
     gets dark grays (visible on white); dark mode keeps the existing
     white-on-black palette. */
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-6 w-full" role="img" aria-label={ariaLabel}>
      <line
        x1={padL} x2={w - padR} y1={padT + innerH} y2={padT + innerH}
        className="stroke-black/[0.10] dark:stroke-white/[0.08]"
      />
      {buckets.map((tt, i) => {
        const xSlot = padL + i * slot;
        const xRev = xSlot + slot / 2 - barW - 2;
        const xNi  = xSlot + slot / 2 + 2;
        const showRev = Math.abs(tt.revenue)    > 0;
        const showNi  = Math.abs(tt.net_income) > 0;
        const hRev = Math.max(2, (Math.abs(tt.revenue)    / maxY) * innerH);
        const hNi  = Math.max(2, (Math.abs(tt.net_income) / maxY) * innerH);
        /* Net-income shade differs by sign — slightly muted for
           negative, slightly stronger for positive — and adapts to
           theme. */
        const niCls = tt.net_income >= 0
          ? "fill-gray-500/85 dark:fill-white/45"
          : "fill-gray-400/75 dark:fill-white/30";
        return (
          <g key={`${tt.label}-${i}`}>
            {showRev && (
              <rect
                x={xRev} y={padT + innerH - hRev} width={barW} height={hRev} rx={2}
                className="fill-gray-800/85 dark:fill-white/85"
              />
            )}
            {showNi && (
              <rect
                x={xNi} y={padT + innerH - hNi} width={barW} height={hNi} rx={2}
                className={niCls}
              />
            )}
            <text
              x={xSlot + slot / 2} y={h - 6} fontSize={11} textAnchor="middle"
              className="fill-gray-600 dark:fill-white/45"
            >
              {tt.label}
            </text>
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
    tone === "positive" ? "text-emerald-700 dark:text-emerald-200" :
    tone === "warning"  ? "text-rose-700 dark:text-rose-200"    :
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

   Spans the full grid width as ONE wrapper element with a single
   continuous border, so the rounded corners are guaranteed to form
   a clean closed shape. Inside the wrapper a nested grid uses the
   same column template as the parent statement, so the value column
   still lines up with everything above:

       ╭───────────────────────────────────────────────────────╮
       │  NET INCOME                47,550        (5,850)      │
       ╰───────────────────────────────────────────────────────╯

   Border colour follows the value tone (emerald positive / rose
   negative). Generous rounded-2xl curve so the row feels like a
   distinct callout, not just a heavier table row. */
function HeadlineCells({ label, prior, cur, showPrior, tone }: { label: string; prior?: number; cur: number; showPrior: boolean; tone: StatementTone }) {
  const valueTone =
    tone === "positive" ? "text-emerald-700 dark:text-emerald-200" :
    tone === "warning"  ? "text-rose-700 dark:text-rose-200"    :
                          "text-[var(--text-primary)]";
  const borderTone =
    tone === "positive" ? "border-emerald-500/60 dark:border-emerald-300/40" :
    tone === "warning"  ? "border-rose-500/60 dark:border-rose-300/40"    :
                          "border-[var(--border-color)]";

  const span = showPrior ? "col-span-3" : "col-span-2";
  const innerGrid = showPrior
    ? "grid grid-cols-[1fr_8rem_8rem] items-baseline"
    : "grid grid-cols-[1fr_8rem] items-baseline";

  return (
    <>
      {/* Breathing space above the framed row */}
      <div aria-hidden className={`${span} h-5`} />

      {/* ONE wrapper carries the border + the curve. Mirrors the
          outer panel's chrome (border + rounded-xl) so it reads as a
          contained sub-panel — same visual family as ErpPanel, just
          one notch smaller. */}
      <div className={`${span} rounded-2xl border ${borderTone} px-1.5 py-3 sm:px-2.5`}>
        <div className={innerGrid}>
          <div className="py-1 text-[15px] font-bold uppercase tracking-[0.06em] text-[var(--text-primary)] ps-3 sm:ps-4">
            {label}
          </div>
          {showPrior && (
            <div className="py-1 text-[16px] font-bold font-mono tabular-nums text-[var(--text-secondary)] text-right pe-3 sm:pe-4">
              {fmtSigned(prior ?? 0)}
            </div>
          )}
          <div className={`py-1 text-[18px] font-bold font-mono tabular-nums text-right pe-3 sm:pe-4 ${valueTone}`}>
            {fmtSigned(cur)}
          </div>
        </div>
      </div>
    </>
  );
}

/* ───── Income view ───── */

function IncomeView({ pl, compare, ccy, curLabel, compareLabel }: { pl: ProfitLoss; compare?: ProfitLoss; ccy: string; curLabel: string; compareLabel: string }) {
  const { t } = useTranslation(financeT);
  void ccy;
  const showCompare = !!compare;
  const cols: 2 | 3 = showCompare ? 3 : 2;
  return (
    <div className={showCompare ? STATEMENT_GRID_2COL : STATEMENT_GRID_1COL}>
      <HeaderCells priorLabel={compareLabel} curLabel={curLabel} showPrior={showCompare} />

      <SectionTitleRow label={t("visual.section.revenues", "Revenues")} cols={cols} />
      {pl.revenue.accounts.length === 0 && <MutedRowSpan label={t("visual.emptyRev", "No revenue posted yet.")} cols={cols} />}
      {pl.revenue.accounts.map((a) => (
        <DataCells key={a.account_id} label={a.name} prior={compare ? priorAccount(compare.revenue, a.code) : undefined} cur={a.amount} showPrior={showCompare} />
      ))}
      <SubtotalCells label={t("visual.row.totalRev", "Total Revenues")} prior={compare?.revenue.amount} cur={pl.revenue.amount} showPrior={showCompare} />

      <SectionTitleRow label={t("visual.section.expenses", "Expenses")} cols={cols} />
      {pl.cost_of_sales.accounts.map((a) => (
        <DataCells key={a.account_id} label={a.name} prior={compare ? priorAccount(compare.cost_of_sales, a.code) : undefined} cur={a.amount} showPrior={showCompare} />
      ))}
      {pl.operating_expenses.accounts.map((a) => (
        <DataCells key={a.account_id} label={a.name} prior={compare ? priorAccount(compare.operating_expenses, a.code) : undefined} cur={a.amount} showPrior={showCompare} />
      ))}
      <SubtotalCells
        label={t("visual.row.totalExp", "Total Expenses")}
        prior={compare ? compare.cost_of_sales.amount + compare.operating_expenses.amount : undefined}
        cur={pl.cost_of_sales.amount + pl.operating_expenses.amount}
        showPrior={showCompare}
      />

      <TotalCells label={t("visual.row.opIncome", "Operating Income")}
                  prior={compare?.operating_profit} cur={pl.operating_profit}
                  showPrior={showCompare}
                  tone={pl.operating_profit >= 0 ? "positive" : "warning"} />

      <HeadlineCells label={t("visual.row.netIncome", "Net Income")}
                     prior={compare?.net_profit} cur={pl.net_profit}
                     showPrior={showCompare}
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
        <div className="col-span-2 mt-2 text-[11px] text-rose-600 dark:text-rose-300">{t("visual.bsMismatch", "⚠ Balance sheet does not reconcile.")}</div>
      )}
    </div>
  );
}

/* ───── Cash flow ───── */

function CashFlowView({ cf, compare, ccy, curLabel, compareLabel }: { cf: CashFlow; compare?: CashFlow; ccy: string; curLabel: string; compareLabel: string }) {
  const { t } = useTranslation(financeT);
  void ccy;
  const showCompare = !!compare;
  const cols: 2 | 3 = showCompare ? 3 : 2;

  /* Build paired sections from cur + compare, keyed by section label.
     We look up compare lines by label (the server-side cash-flow
     builder uses stable labels per section). Missing lines collapse
     to 0 on the missing side. */
  const sections = [
    { cur: cf.operating, cmp: compare?.operating },
    { cur: cf.investing, cmp: compare?.investing },
    { cur: cf.financing, cmp: compare?.financing },
  ];
  function compareLineAmount(cmpSection: CashFlowSection | undefined, label: string): number | undefined {
    if (!cmpSection) return undefined;
    return cmpSection.lines.find((l) => l.label === label)?.amount ?? 0;
  }

  return (
    <div className={showCompare ? STATEMENT_GRID_2COL : STATEMENT_GRID_1COL}>
      <HeaderCells priorLabel={compareLabel} curLabel={curLabel} showPrior={showCompare} />

      <DataCells label={t("visual.row.openingCash", "Opening cash")} prior={compare?.opening_cash} cur={cf.opening_cash} showPrior={showCompare} />

      {sections.map(({ cur, cmp }) => (
        <Fragment key={cur.label}>
          <SectionTitleRow label={cur.label} cols={cols} />
          {cur.lines.length === 0 && <MutedRowSpan label="—" cols={cols} />}
          {cur.lines.map((l, i) => (
            <DataCells
              key={`${cur.label}-${i}`}
              label={l.label}
              prior={compareLineAmount(cmp, l.label)}
              cur={l.amount}
              showPrior={showCompare}
            />
          ))}
          <SubtotalCells
            label={t("visual.row.subtotal", "{name} subtotal").replace("{name}", cur.label)}
            prior={cmp?.amount}
            cur={cur.amount}
            showPrior={showCompare}
          />
        </Fragment>
      ))}

      <TotalCells label={t("visual.row.netChange", "Net change in cash")}
                  prior={compare?.net_change} cur={cf.net_change}
                  showPrior={showCompare}
                  tone="neutral" />

      <HeadlineCells label={t("visual.row.closingCash", "Closing cash")}
                     prior={compare?.closing_cash}
                     cur={cf.closing_cash}
                     showPrior={showCompare}
                     tone={cf.reconciled ? "positive" : "warning"} />
    </div>
  );
}
