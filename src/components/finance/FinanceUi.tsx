"use client";

/* ---------------------------------------------------------------------------
   Finance App — page-level visual primitives.

   This file owns the small composable building blocks used by every
   Finance list / detail page: KpiCard, StatusBadge, EmptyState,
   SectionCard, PageHeader, PeriodTabs, TrendChart, ProgressBar.

   Where the boundary sits (Fix #3 / Fix #5):
     · FinanceUi.tsx        — page-level primitives (this file).
     · FinanceUiX.tsx       — analytics-heavy cards + aging + timeline.
     · FinanceDashboardUi.tsx — typography + dashboard-specific
                                 lockups (DisplayKpi, HealthRail, …).
     · charts.tsx            — SVG chart primitives only.
     · tone.ts               — shared Tone semantic tokens.

   All five files lean on Koleex Hub theme tokens (--bg-secondary,
   --border-subtle, etc.) so they auto-adapt to dark/light without
   hardcoded colors.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import { commonT } from "@/lib/translations/common";
import { fmtMoney, fmtPct } from "@/lib/finance/calc";
import GuidanceTip from "@/components/ui/GuidanceTip";

/* ── KpiCard ──────────────────────────────────────────────────────
   Premium statistic card. Adds a subtle left accent bar, optional
   trend sparkline, and a refined delta presentation. Used on the
   dashboard and at the top of every Finance list page.

   The accent palette is intentionally wide (12 colours) so every
   KPI on a page can carry its own visual identity — no two cards
   on the same screen should share a colour. */
export type KpiAccent =
  | "emerald"
  | "rose"
  | "amber"
  | "sky"
  | "violet"
  | "blue"
  | "teal"
  | "orange"
  | "fuchsia"
  | "lime"
  | "cyan"
  | "indigo"
  | "default";

const ACCENT_TEXT: Record<KpiAccent, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose:    "text-rose-600 dark:text-rose-400",
  amber:   "text-amber-600 dark:text-amber-400",
  sky:     "text-sky-600 dark:text-sky-400",
  violet:  "text-violet-600 dark:text-violet-400",
  blue:    "text-blue-600 dark:text-blue-400",
  teal:    "text-teal-600 dark:text-teal-400",
  orange:  "text-orange-600 dark:text-orange-400",
  fuchsia: "text-fuchsia-600 dark:text-fuchsia-400",
  lime:    "text-lime-600 dark:text-lime-400",
  cyan:    "text-cyan-600 dark:text-cyan-400",
  indigo:  "text-indigo-600 dark:text-indigo-400",
  default: "text-[var(--text-primary)]",
};
const ACCENT_BAR: Record<KpiAccent, string> = {
  emerald: "bg-gradient-to-b from-emerald-400/80 to-emerald-600/30",
  rose:    "bg-gradient-to-b from-rose-400/80 to-rose-600/30",
  amber:   "bg-gradient-to-b from-amber-400/80 to-amber-600/30",
  sky:     "bg-gradient-to-b from-sky-400/80 to-sky-600/30",
  violet:  "bg-gradient-to-b from-violet-400/80 to-violet-600/30",
  blue:    "bg-gradient-to-b from-blue-400/80 to-blue-600/30",
  teal:    "bg-gradient-to-b from-teal-400/80 to-teal-600/30",
  orange:  "bg-gradient-to-b from-orange-400/80 to-orange-600/30",
  fuchsia: "bg-gradient-to-b from-fuchsia-400/80 to-fuchsia-600/30",
  lime:    "bg-gradient-to-b from-lime-400/80 to-lime-600/30",
  cyan:    "bg-gradient-to-b from-cyan-400/80 to-cyan-600/30",
  indigo:  "bg-gradient-to-b from-indigo-400/80 to-indigo-600/30",
  default: "bg-gradient-to-b from-white/30 to-white/10",
};

/* kx-glass on the three card recipes is the whole surface conversion for this
   app: seventeen files import them, so one edit each frosts every card on all
   twenty-nine finance routes. Safe unconditionally — the class is DEFINED only
   under [data-kx-skin="aurora"], so Core matches nothing and these keep the
   solid --bg-secondary they always had. The remap alone would leave their text
   sitting on the moving ground: remap and frost are two steps, not one. */
export function KpiCard({
  label,
  value,
  delta,
  deltaValue,
  currency,
  accent = "default",
  hint,
  loading,
  invertDelta,
  sparkline,
}: {
  label: string;
  value: number | string;
  delta?: number | null;
  deltaValue?: number;
  currency?: string;
  accent?: KpiAccent;
  hint?: string;
  loading?: boolean;
  /* For expenses-style metrics where a DROP is good and a RISE is bad */
  invertDelta?: boolean;
  /* Optional small sparkline drawn on the right side of the value row */
  sparkline?: number[];
}) {
  const { t } = useTranslation(commonT);
  const numericValue = typeof value === "number" ? value : null;
  const display =
    typeof value === "string"
      ? value
      : fmtMoney(numericValue ?? 0, currency || "CNY", { compact: true });
  const deltaSign = delta == null ? 0 : delta > 0 ? 1 : delta < 0 ? -1 : 0;
  const goodDirection = invertDelta ? deltaSign < 0 : deltaSign > 0;
  const neutralDelta = deltaSign === 0;
  return (
    <div className="kx-glass group relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 transition hover:border-[var(--border-color)] hover:bg-[var(--bg-secondary)]/90">
      {/* Left accent bar — subtle visual cue for the metric family */}
      <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r ${ACCENT_BAR[accent]}`} />
      <div className="ml-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">{label}</div>
          {sparkline && sparkline.length > 1 && (
            <Sparkline data={sparkline} accent={accent} />
          )}
        </div>
        <div className={`mt-2.5 text-[26px] leading-tight font-semibold tabular-nums ${ACCENT_TEXT[accent]}`}>
          {loading ? <span className="inline-block h-7 w-32 animate-pulse rounded bg-white/5" /> : display}
        </div>
        {(delta != null || hint) && (
          <div className="mt-2.5 flex items-center gap-2 text-[11px]">
            {delta != null && (
              <span
                className={
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold " +
                  (neutralDelta
                    ? "bg-white/5 text-[var(--text-secondary)]"
                    : goodDirection
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/15 text-rose-600 dark:text-rose-400")
                }
                title={
                  deltaValue != null && currency
                    ? `${deltaValue > 0 ? "+" : ""}${fmtMoney(deltaValue, currency, { compact: true })} vs previous period`
                    : undefined
                }
              >
                {neutralDelta ? "—" : deltaSign > 0 ? "▲" : "▼"} {fmtPct(delta)}
              </span>
            )}
            {hint && <span className="text-[var(--text-dim)]">{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* Phase UI.2 — restrained Sparkline.
   The 12-hue rainbow palette is replaced by a 3-tone chart language:
     · default ink (most accents → ink)
     · muted gain  (emerald / lime / teal / cyan)
     · muted loss  (rose / orange / fuchsia)
   Stroke width 1.5 → 1.0. Opacity wrapper removed; the colour does
   the work. The KPI_ACCENTS map outside this function is intact so
   the chip strip on legacy KpiCard still uses the original accent
   palette — only the sparkline goes monochrome. */
const CHART_INK_INLINE  = "rgba(255,255,255,0.88)";
const CHART_GAIN_INLINE = "rgba(134,239,172,0.70)";
const CHART_LOSS_INLINE = "rgba(253,164,175,0.70)";

function Sparkline({ data, accent }: { data: number[]; accent: KpiAccent }) {
  const { t } = useTranslation(commonT);
  const W = 64;
  const H = 22;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = W / Math.max(1, data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`)
    .join(" ");
  const stroke =
    accent === "emerald" || accent === "lime" || accent === "teal" || accent === "cyan"
      ? CHART_GAIN_INLINE
      : accent === "rose" || accent === "orange" || accent === "fuchsia"
        ? CHART_LOSS_INLINE
        : CHART_INK_INLINE;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <polyline
        points={points}
        stroke={stroke}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/* ── StatusBadge ─────────────────────────────────────────────────── */
/* PILL-1 tone classes (KDS StatusPill palette). */
const PILL_NEUTRAL = "bg-[var(--bg-inverted)]/[0.06] text-[var(--text-muted)] border-[var(--border-subtle)]";
const PILL_BRAND   = "bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40";
const PILL_SUCCESS = "bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35";
const PILL_WARNING = "bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/35";
const PILL_ERROR   = "bg-[#FF3333]/12 text-[#FF3333] border-[#FF3333]/35";

/* `labelKey` rather than a translated string: this map is module scope, so it
   cannot call t(). StatusBadge translates at render, falling back to `label`.
   (Pattern 8 — a string as an object property in a config map.) */
const STATUS_PALETTE: Record<string, { cls: string; label?: string; labelKey?: string }> = {
  paid:           { cls: PILL_SUCCESS },
  partial:        { cls: PILL_WARNING },
  unpaid:         { cls: PILL_NEUTRAL },
  overdue:        { cls: PILL_ERROR },
  open:           { cls: PILL_BRAND },
  in_production:  { cls: PILL_BRAND, labelKey: "status.inProduction", label: "In production" },
  shipped:        { cls: PILL_BRAND },
  delivered:      { cls: PILL_SUCCESS },
  closed:         { cls: PILL_NEUTRAL },
  cancelled:      { cls: PILL_ERROR },
  good:           { cls: PILL_SUCCESS },
  watch:          { cls: PILL_WARNING },
  hold:           { cls: PILL_WARNING },
  blocked:        { cls: PILL_ERROR },
  scheduled:      { cls: PILL_BRAND },
  sent:           { cls: PILL_SUCCESS },
  done:           { cls: PILL_SUCCESS },
  snoozed:        { cls: PILL_WARNING },
  completed:      { cls: PILL_SUCCESS },
  pending:        { cls: PILL_WARNING },
  bounced:        { cls: PILL_ERROR },
  collect:        { cls: PILL_SUCCESS, labelKey: "status.moneyToCollect", label: "Money to collect" },
  pay:            { cls: PILL_ERROR, labelKey: "status.moneyToPay", label: "Money to pay" },
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation(commonT);
  const p = STATUS_PALETTE[status] ?? { cls: PILL_NEUTRAL };
  const label = p.labelKey ? t(p.labelKey, p.label ?? status) : (p.label ?? status.replace(/_/g, " "));
  return (
    <span
      className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap ${p.cls}`}
    >
      {label}
    </span>
  );
}

/* ── EmptyState ─────────────────────────────────────────────────── */
export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="kx-glass flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[var(--bg-secondary)] py-16 text-center">
      <div className="mb-4 opacity-50">{icon}</div>
      <p className="text-base font-medium text-[var(--text-primary)]">{title}</p>
      {hint && <p className="mt-1 text-sm text-[var(--text-dim)]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── SectionCard ────────────────────────────────────────────────── */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  helpId,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  helpId?: string;
  /** Extra classes from the CALLING app. This is how a converted app gives the
   *  card its Aurora glass without dragging every other Finance screen along:
   *  the default is empty, so callers that pass nothing render exactly as
   *  before. */
  className?: string;
}) {
  return (
    <div className={`kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
                <span>{title}</span>
                {helpId && <GuidanceTip guidanceId={helpId} />}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── PageHeader ─────────────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--text-dim)]">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

/* ── PeriodTabs ─────────────────────────────────────────────────── */
export function PeriodTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={
            "rounded-md px-3 py-1.5 text-xs font-medium transition " +
            (o.value === value
              ? "bg-white/10 text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-highlight)]")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── TrendChart — paired bars (revenue vs expenses).
   Phase UI.2 — saturated emerald/rose 70% pills replaced by the same
   3-tone chart palette as Sparkline + AreaChart. Bars are flat fills
   (no gradient, no hue shift on hover — opacity-only). Used by the
   legacy KpiCard surface on Customers / Suppliers / Expense pages;
   no consumer needs the loud original. */
export function TrendChart({
  data,
  currency,
}: {
  data: { label: string; revenue: number; expenses: number; net_profit: number }[];
  currency: string;
}) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => Math.max(d.revenue, d.expenses)));
  return (
    <div>
      <div className="flex h-44 items-end gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-full w-full items-end gap-0.5">
              <div
                className="flex-1 rounded-t-sm transition-opacity duration-200 hover:opacity-90"
                style={{
                  height: `${(d.revenue / max) * 100}%`,
                  minHeight: d.revenue > 0 ? 4 : 0,
                  background: CHART_GAIN_INLINE,
                }}
                title={`Revenue: ${fmtMoney(d.revenue, currency, { compact: true })}`}
              />
              <div
                className="flex-1 rounded-t-sm transition-opacity duration-200 hover:opacity-90"
                style={{
                  height: `${(d.expenses / max) * 100}%`,
                  minHeight: d.expenses > 0 ? 4 : 0,
                  background: CHART_LOSS_INLINE,
                }}
                title={`Costs + Expenses: ${fmtMoney(d.expenses, currency, { compact: true })}`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 px-0.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-[var(--text-dim)]">{d.label}</div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: CHART_GAIN_INLINE }} /> Revenue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: CHART_LOSS_INLINE }} /> Costs + Expenses
        </span>
      </div>
    </div>
  );
}

/* ── ProgressBar — used for "X% of selling price collected" etc. ── */
export function ProgressBar({
  value,
  max,
  color = "emerald",
}: {
  value: number;
  max: number;
  color?: "emerald" | "amber" | "rose" | "sky";
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const bg =
    color === "emerald" ? "bg-emerald-500"
    : color === "amber" ? "bg-amber-500"
    : color === "rose"  ? "bg-rose-500"
    : "bg-sky-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
      <div className={`h-full rounded-full ${bg} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}
