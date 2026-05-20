"use client";

/* ===========================================================================
   FinanceUiX  —  Phase 1.4 premium executive visual primitives.

   Design language pulled from Apple + Linear + Bloomberg + Stripe:

     · 90 % monochrome surface, 10 % accent (accent only for direction,
       state, or the single hero number on a card)
     · large tabular-nums numerals with tight tracking
     · soft gradients on hero surfaces, plain on secondary
     · no chunky borders — hairlines and subtle shadows instead
     · charts use gradient fills + smooth Bezier curves + a soft glow
     · multiple card types so the page reads as a story, not a grid

   The old FinanceUi.tsx primitives stay for back-compat with pages
   that haven't been migrated yet; this file is the new standard.
   ========================================================================== */

import { type ReactNode } from "react";
import { fmtMoney, fmtPct } from "@/lib/finance/calc";
import GuidanceTip from "@/components/ui/GuidanceTip";
import RrIcon from "@/components/ui/RrIcon";
import { type Tone, TONE_TEXT, TONE_CHIP_BG } from "@/components/finance/tone";
/* Phase Fix #3 — chart primitives + formatCompact extracted to
   ./charts.tsx so this file no longer drags 540 lines of SVG math
   along with its card / aging / timeline components. The
   internal-use imports below feed the surviving cards; the public
   surface is re-exported on the next line so existing callers
   (`import { BarChart, … } from "FinanceUiX"`) keep working
   unchanged. */
import {
  AreaChart, AreaChartMini, BarChart, DonutChart, formatCompact,
} from "@/components/finance/charts";
export { AreaChart, AreaChartMini, BarChart, DonutChart, formatCompact };

/* ---------------------------------------------------------------------------
   1. Tokens (re-exported for back-compat — see ./tone.ts for the canonical
      home).
   --------------------------------------------------------------------------- */

export type { Tone };

/* ---------------------------------------------------------------------------
   2. HeroKpiCard — the dominating top metric.
      Used at most 1–2 per page. Bigger surface, very large number,
      optional inline AreaChart, subtle gradient background.
   --------------------------------------------------------------------------- */

export function HeroKpiCard({
  label,
  value,
  unit,
  delta,
  deltaValue,
  hint,
  tone = "neutral",
  trend,
  trendCurrency,
  loading,
  helpId,
}: {
  label: string;
  value: number | string;
  /* e.g. "USD", "%", or undefined */
  unit?: string;
  delta?: number | null;
  deltaValue?: number;
  hint?: string;
  tone?: Tone;
  /* Inline area chart points along the top edge */
  trend?: number[];
  trendCurrency?: string;
  loading?: boolean;
  /** Optional guidance-registry id — renders a ? next to the label. */
  helpId?: string;
}) {
  const display = typeof value === "string" ? value : formatCompact(value);
  const deltaSign = delta == null ? 0 : delta > 0 ? 1 : delta < 0 ? -1 : 0;

  return (
    /* Phase UI.2 — de-glowed HeroKpiCard. The blur-3xl coloured halo,
       the gradient background, the hover y-lift, and the drop shadow
       all removed. The card now reads as data printed on dark paper:
       a hairline border, a flat surface, typography that breathes. */
    <div className="group relative isolate overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.012] p-5 transition-colors duration-200 hover:border-white/[0.09]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            <span>{label}</span>
            {helpId && <GuidanceTip guidanceId={helpId} />}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {loading ? (
              <span className="inline-block h-8 w-40 animate-pulse rounded bg-white/5" />
            ) : (
              <>
                <span className={`text-[32px] leading-none font-medium tracking-tight tabular-nums ${TONE_TEXT[tone]}`}>
                  {display}
                </span>
                {unit && <span className="text-sm font-medium text-gray-500">{unit}</span>}
              </>
            )}
          </div>
          {(delta != null || hint) && (
            <div className="mt-2.5 flex items-center gap-2 text-[11px]">
              {delta != null && (
                <span
                  className={
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium " +
                    (deltaSign === 0
                      ? TONE_CHIP_BG.neutral
                      : deltaSign > 0 && tone !== "negative"
                        ? TONE_CHIP_BG.positive
                        : deltaSign < 0 && tone !== "negative"
                          ? TONE_CHIP_BG.negative
                          : deltaSign > 0 && tone === "negative"
                            ? TONE_CHIP_BG.negative
                            : TONE_CHIP_BG.positive)
                  }
                  title={deltaValue != null ? `${deltaValue > 0 ? "+" : ""}${formatCompact(deltaValue)} vs previous` : undefined}
                >
                  {deltaSign === 0 ? "—" : deltaSign > 0 ? "↑" : "↓"} {fmtPct(delta)}
                </span>
              )}
              {hint && <span className="text-gray-500">{hint}</span>}
            </div>
          )}
        </div>
      </div>

      {trend && trend.length > 1 && (
        <div className="mt-3.5 -mx-0.5">
          <AreaChartMini data={trend} tone={tone} currency={trendCurrency} height={52} />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   3. MetricCard — compact secondary metric.
      Monochrome. Two lines: label + value. Tiny delta if provided.
      Used in clusters of 3-4 below the hero cards.
   --------------------------------------------------------------------------- */

export function MetricCard({
  label,
  value,
  unit,
  delta,
  hint,
  tone = "neutral",
  loading,
  helpId,
}: {
  label: string;
  value: number | string;
  unit?: string;
  delta?: number | null;
  hint?: string;
  tone?: Tone;
  loading?: boolean;
  helpId?: string;
}) {
  const display = typeof value === "string" ? value : formatCompact(value);
  const deltaSign = delta == null ? 0 : delta > 0 ? 1 : delta < 0 ? -1 : 0;
  return (
    <div className="rounded-xl border border-white/[0.04] bg-white/[0.018] p-3.5 transition hover:border-white/[0.08]">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
        <span>{label}</span>
        {helpId && <GuidanceTip guidanceId={helpId} />}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        {loading ? (
          <span className="inline-block h-5 w-20 animate-pulse rounded bg-white/5" />
        ) : (
          <>
            <span className={`text-[18px] leading-none font-medium tracking-tight tabular-nums ${TONE_TEXT[tone]}`}>{display}</span>
            {unit && <span className="text-[11px] text-gray-500">{unit}</span>}
          </>
        )}
      </div>
      {(delta != null || hint) && (
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          {delta != null && (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium ${
              deltaSign === 0 ? TONE_CHIP_BG.neutral : deltaSign > 0 ? TONE_CHIP_BG.positive : TONE_CHIP_BG.negative
            }`}>
              {deltaSign === 0 ? "—" : deltaSign > 0 ? "↑" : "↓"} {fmtPct(delta)}
            </span>
          )}
          {hint && <span className="text-gray-500">{hint}</span>}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   4. InsightCard — narrative + small chip + optional CTA.
      The "this is the business state" voice of the dashboard.
   --------------------------------------------------------------------------- */

export type InsightSeverity = "positive" | "neutral" | "watch" | "risk" | "critical";

/* Phase UI.2 — InsightCard severity frame. Halos + pulse keyframe
   removed. The card now communicates severity through a thin tinted
   left rail and a subtly tinted border only — no "lit from inside"
   glow, no edge pulse. */
const SEVERITY_FRAME: Record<InsightSeverity, { border: string; bg: string; rail: string }> = {
  positive: {
    border: "border-white/[0.05]",
    bg:     "bg-white/[0.02]",
    rail:   "bg-emerald-300/55",
  },
  neutral: {
    border: "border-white/[0.04]",
    bg:     "bg-white/[0.018]",
    rail:   "bg-white/[0.10]",
  },
  watch: {
    border: "border-amber-500/[0.18]",
    bg:     "bg-white/[0.018]",
    rail:   "bg-amber-300/65",
  },
  risk: {
    border: "border-rose-500/[0.22]",
    bg:     "bg-white/[0.018]",
    rail:   "bg-rose-300/65",
  },
  critical: {
    border: "border-rose-500/[0.30]",
    bg:     "bg-white/[0.020]",
    rail:   "bg-rose-300/80",
  },
};

const SEVERITY_TO_CHIP_TONE: Record<InsightSeverity, Tone> = {
  positive: "positive",
  neutral:  "neutral",
  watch:    "warning",
  risk:     "negative",
  critical: "negative",
};

export function InsightCard({
  icon,
  title,
  description,
  chip,
  chipTone,
  severity = "neutral",
  cta,
  onCta,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  chip?: string;
  /* If omitted, derived from severity so callers can use either prop. */
  chipTone?: Tone;
  severity?: InsightSeverity;
  cta?: string;
  onCta?: () => void;
}) {
  const sev = SEVERITY_FRAME[severity];
  const tone = chipTone ?? SEVERITY_TO_CHIP_TONE[severity];
  return (
    <div
      className={`relative isolate flex items-start gap-3 overflow-hidden rounded-2xl border p-4 ${sev.border} ${sev.bg}`}
    >
      {/* Left severity rail — 2 px tinted strip. Communicates urgency
          without colouring the whole card. */}
      <div aria-hidden className={`absolute left-0 top-3 bottom-3 w-[2px] rounded-r ${sev.rail}`} />
      {icon && (
        <div className="ml-1.5 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-base">
          {icon}
        </div>
      )}
      <div className={`min-w-0 flex-1 ${icon ? "" : "ml-1.5"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
          {chip && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TONE_CHIP_BG[tone]}`}>
              {chip}
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-gray-400">{description}</p>
        {cta && (
          <button
            type="button"
            onClick={onCta}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-sky-300 hover:text-sky-200"
          >
            {cta} <RrIcon name="arrow-up-right" size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   5. ChartCard — wrapper used for the main analytics chart.
      Has its own subtle gradient frame so it reads as the "live data"
      surface of the dashboard.
   --------------------------------------------------------------------------- */

export function ChartCard({
  title,
  subtitle,
  controls,
  children,
  helpId,
}: {
  title: string;
  subtitle?: string;
  controls?: ReactNode;
  children: ReactNode;
  helpId?: string;
}) {
  return (
    /* Phase UI.2 — ChartCard frame de-glowed.
       Lost: the diagonal gradient, the rounded-3xl curve. Kept: a
       single hairline border on a flat slightly-tinted surface, so
       the chart-data inside reads as the loud element, not the
       wrapper. */
    <div className="relative isolate overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.012] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
            <span>{title}</span>
            {helpId && <GuidanceTip guidanceId={helpId} />}
          </h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-gray-500">{subtitle}</p>}
        </div>
        {controls}
      </div>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

/* Chart primitives previously lived here (AreaChartMini, AreaChart,
   palette + helpers, DonutChart, BarChart) — extracted to
   ./charts.tsx in Fix #3. They're re-exported at the top of this file
   so the call signature for existing imports is unchanged. */


/* ---------------------------------------------------------------------------
   7d. WorkflowRail — operational action shortcut rail.

       The strip the user uses to OPERATE the business from the
       dashboard, not just observe it. Small icon + label + optional
       badge count. Click → opens the relevant entry surface.

       Visual: a horizontally-scrollable row of compact tiles. Same
       monochrome surface as the rest of the system; the badge count
       carries the urgency.
   --------------------------------------------------------------------------- */

export interface WorkflowItem {
  key: string;
  label: string;
  hint?: string;
  /* badge: small chip on the right of the tile (e.g. "3 due", "Overdue") */
  badge?: { text: string; tone: Tone };
  icon?: ReactNode;
  /* If href is set the tile renders as a link; otherwise the parent
     supplies an onClick via the onActivate callback. */
  href?: string;
  disabled?: boolean;
}

export function WorkflowRail({
  items,
  onActivate,
}: {
  items: WorkflowItem[];
  onActivate?: (key: string) => void;
}) {
  /* Each card lays out as a 2-row tile: top row carries icon + badge,
     bottom row carries label + hint. Predictable height regardless of
     whether a card has a badge or how long its hint is.

     Container is a horizontal scroller on mobile (one swipe to scan
     everything) and a tidy responsive grid on desktop so 6 items don't
     cram themselves into a too-narrow rail. */
  return (
    <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:overflow-x-visible sm:px-0">
      <div className="flex items-stretch gap-2 sm:grid sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-6">
        {items.map((it) => {
          const accent = it.badge ? TONE_CHIP_BG[it.badge.tone] : "";
          const inner = (
            <>
              {/* Top row — icon left, badge right. Always present so
                  the layout matches across cards with/without badges. */}
              <div className="flex items-center justify-between gap-2">
                {it.icon ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-gray-300 transition-colors group-hover:bg-white/[0.10] group-hover:text-gray-100">
                    {it.icon}
                  </span>
                ) : (
                  <span aria-hidden className="h-8 w-8" />
                )}
                {it.badge ? (
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${accent}`}
                    title={it.badge.text}
                  >
                    {it.badge.text}
                  </span>
                ) : (
                  <span aria-hidden className="h-[18px]" />
                )}
              </div>

              {/* Bottom row — label + hint. Label allowed to wrap to 2
                  lines so 'Follow up collection' doesn't get truncated.
                  Hint clamps to 2 lines so the card height stays bounded. */}
              <div className="mt-2 min-w-0">
                <div className="line-clamp-2 text-[12.5px] font-semibold leading-tight text-gray-100 group-hover:text-white">
                  {it.label}
                </div>
                {it.hint && (
                  <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-gray-500">
                    {it.hint}
                  </div>
                )}
              </div>
            </>
          );

          const cls =
            "group flex w-[200px] shrink-0 flex-col rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 transition-all duration-200 hover:-translate-y-[1px] hover:border-white/[0.12] hover:bg-white/[0.04] sm:w-auto " +
            (it.disabled ? "pointer-events-none opacity-50" : "");

          if (it.href) {
            return (
              <a key={it.key} href={it.href} className={cls}>
                {inner}
              </a>
            );
          }
          return (
            <button key={it.key} type="button" onClick={() => onActivate?.(it.key)} className={cls}>
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   8. SegmentedNav — premium glass nav used by FinanceTabs / ExpensesTabs.
   --------------------------------------------------------------------------- */

export function SegmentedNav({
  items,
  activeKey,
  onChange,
}: {
  items: { key: string; label: string; href?: string; count?: number; icon?: ReactNode }[];
  activeKey: string;
  onChange?: (key: string) => void;
}) {
  return (
    <nav aria-label="Section navigation" className="overflow-x-auto">
      <div className="relative inline-flex items-center gap-0.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1 backdrop-blur-md">
        {items.map((it) => {
          const active = it.key === activeKey;
          const cls =
            "relative flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors " +
            (active
              ? "text-[var(--text-primary)]"
              : "text-gray-400 hover:text-gray-100");
          const inner = (
            <>
              {active && (
                <span aria-hidden className="absolute inset-0 -z-10 rounded-xl bg-white/[0.07] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)]" />
              )}
              {it.icon && <span className="opacity-80">{it.icon}</span>}
              <span>{it.label}</span>
              {it.count != null && (
                <span className={
                  "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums " +
                  (active ? "bg-white/[0.10] text-gray-200" : "bg-white/[0.04] text-gray-500")
                }>
                  {it.count}
                </span>
              )}
            </>
          );
          if (it.href) {
            return (
              <a key={it.key} href={it.href} className={cls}>
                {inner}
              </a>
            );
          }
          return (
            <button key={it.key} type="button" className={cls} onClick={() => onChange?.(it.key)}>
              {inner}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------------------------
   9. Section primitives — Stack, SectionTitle, Divider — used to group
      content with proper rhythm and reduce border noise.
   --------------------------------------------------------------------------- */

export function SectionTitle({
  eyebrow,
  title,
  description,
  helpId,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  helpId?: string;
}) {
  /* Phase 1.7: tightened from mt-10/mb-4 → mt-7/mb-3.
     The dashboard now has ~10 sections; the previous spacing wasted
     vertical budget. This keeps the rhythm without losing readability. */
  return (
    <div className="mt-7 mb-3">
      {eyebrow && (
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{eyebrow}</div>
      )}
      <h2 className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
        <span>{title}</span>
        {helpId && <GuidanceTip guidanceId={helpId} size="sm" />}
      </h2>
      {description && <p className="mt-0.5 text-[11.5px] text-gray-500">{description}</p>}
    </div>
  );
}


/* formatCompact lives in ./charts.tsx now (Fix #3); it's re-exported
   above so existing callers stay green. fmtMoney is re-exported here
   for the same reason. */
export { fmtMoney };

/* ---------------------------------------------------------------------------
   ░░░  PHASE 1.7  ░░░  Operational-intelligence primitives.

   These read like the rest of FinanceUiX — monochrome surfaces, single
   accent strokes, tight typographic rhythm. They are the visual
   vocabulary the dashboard uses to communicate pressure, timing, and
   anomaly without raising its voice.
   --------------------------------------------------------------------------- */

/* ─────────────────────────────────────────────────────────────────────────
   ModeToggle — top-level Operational ↔ Executive switch.

   Two-position segmented control. Lives in the page header. State is
   owned by the parent (the dashboard) and persisted to localStorage.
   ───────────────────────────────────────────────────────────────────────── */

export type FinanceMode = "operational" | "executive";

export function ModeToggle({
  value,
  onChange,
}: {
  value: FinanceMode;
  onChange: (v: FinanceMode) => void;
}) {
  const opts: { key: FinanceMode; label: string; hint: string }[] = [
    { key: "operational", label: "Operational", hint: "Daily ops" },
    { key: "executive",   label: "Executive",   hint: "Strategy"  },
  ];
  return (
    <div
      role="tablist"
      aria-label="Finance view mode"
      className="relative inline-flex items-center gap-0.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 backdrop-blur-md"
    >
      {opts.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={
              "relative rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors " +
              (active ? "text-[var(--text-primary)]" : "text-gray-400 hover:text-gray-200")
            }
            title={o.hint}
          >
            {active && (
              <span aria-hidden className="absolute inset-0 -z-10 rounded-lg bg-white/[0.07] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)]" />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   AnomalyChip — inline period-over-period spike indicator.

   Tiny pill rendered next to a metric, a chart, or a list label.
   Two tones: subtle info, or amber/rose when it's a concerning move.
   ───────────────────────────────────────────────────────────────────────── */

export function AnomalyChip({
  text,
  severity = "info",
  direction,
}: {
  text: string;
  severity?: "info" | "watch" | "risk";
  direction?: "up" | "down";
}) {
  const cls =
    severity === "risk"  ? "bg-rose-500/[0.12] text-rose-300 border border-rose-500/[0.18]"
  : severity === "watch" ? "bg-amber-500/[0.12] text-amber-300 border border-amber-500/[0.18]"
  :                        "bg-white/[0.05] text-gray-300 border border-white/[0.06]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${cls}`}>
      {direction === "up" ? "▲" : direction === "down" ? "▼" : "•"}
      <span className="tracking-tight">{text}</span>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   LiquidityMeter — single horizontal pressure bar.

   Visualises 7/30/60-day cash projection vs. zero. Calm by default,
   amber/rose if any window dips negative. Compact — designed to live
   inside an IntelligenceCard sibling on the dashboard.
   ───────────────────────────────────────────────────────────────────────── */

export function LiquidityMeter({
  d7,
  d30,
  d60,
  inflowShare,
}: {
  d7: number;
  d30: number;
  d60: number;
  inflowShare: number;     // 0..1 — share of inflow vs outflow
}) {
  const inflowPct = Math.max(4, Math.min(96, inflowShare * 100));
  /* Tone per window */
  const tone = (v: number): string =>
    v >= 0 ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.018] p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Liquidity pressure</div>
        <div className="text-[10px] text-gray-500">Inflow {inflowPct.toFixed(0)}%</div>
      </div>
      {/* Inflow-vs-outflow ratio bar */}
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-rose-500/[0.18]">
        <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${inflowPct}%` }} />
      </div>
      {/* 7/30/60 windows */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {([
          { d: "7 d",  v: d7  },
          { d: "30 d", v: d30 },
          { d: "60 d", v: d60 },
        ] as const).map((w) => (
          <div key={w.d} className="rounded-lg border border-white/[0.04] bg-white/[0.01] py-2">
            <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500">{w.d}</div>
            <div className={`mt-0.5 text-[14px] font-medium tabular-nums tracking-tight ${tone(w.v)}`}>
              {w.v >= 0 ? "+" : "−"}{formatCompact(Math.abs(w.v))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   AgingTable — 5-bucket AR / AP aging.

   Calm executive view, NOT a 2007 ERP grid. Each bucket is a column
   with: label · count · amount · subtle horizontal bar (share of total).
   Critical buckets (61–90, 90+) get a soft rose tint only on the bar.
   ───────────────────────────────────────────────────────────────────────── */

export interface AgingBucketView {
  key: "current" | "1_30" | "31_60" | "61_90" | "90_plus";
  label: string;
  amount: number;
  count: number;
}

export function AgingTable({
  title,
  totalLabel,
  buckets,
  currency = "USD",
}: {
  title: string;
  totalLabel?: string;
  buckets: AgingBucketView[];
  currency?: string;
}) {
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  const totalCount = buckets.reduce((s, b) => s + b.count, 0);
  const max = Math.max(1, ...buckets.map((b) => b.amount));
  /* Critical bucket flags for subtle tint */
  const critical = (k: AgingBucketView["key"]) => k === "61_90" || k === "90_plus";
  const watch    = (k: AgingBucketView["key"]) => k === "31_60";
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.018] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{title}</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-[20px] font-medium tabular-nums tracking-tight text-[var(--text-primary)]">{formatCompact(total)}</span>
            <span className="text-[11px] text-gray-500">{currency} · {totalCount} {totalCount === 1 ? "line" : "lines"}</span>
          </div>
        </div>
        {totalLabel && <span className="text-[10px] text-gray-600">{totalLabel}</span>}
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {buckets.map((b) => {
          const share = total > 0 ? (b.amount / total) * 100 : 0;
          const barCls = critical(b.key) ? "bg-rose-300/60"
                       : watch(b.key)    ? "bg-amber-300/60"
                       : "bg-white/40";
          const valueCls = critical(b.key) ? "text-rose-300"
                         : watch(b.key)    ? "text-amber-200"
                         : "text-gray-200";
          return (
            <div key={b.key} className="rounded-lg border border-white/[0.04] bg-white/[0.01] px-2 py-2">
              <div className="text-[9px] uppercase tracking-[0.16em] text-gray-500">{b.label}</div>
              <div className={`mt-1 text-[13px] font-medium tabular-nums tracking-tight ${valueCls}`}>{formatCompact(b.amount)}</div>
              <div className="mt-1 text-[9px] text-gray-600">{b.count} {b.count === 1 ? "line" : "lines"} · {share.toFixed(0)}%</div>
              <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                <div className={`h-full ${barCls}`} style={{ width: `${Math.max(3, (b.amount / max) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   TimelineStrip — horizontal compressed list of upcoming events.

   Each event is one row: state-dot + days-label + party + amount.
   Calm, scannable, NOT a calendar. Limited to top N to stay light.
   ───────────────────────────────────────────────────────────────────────── */

export interface TimelineEventView {
  key: string;
  daysFromNow: number;        // negative = overdue
  party: string;
  amount: number;
  state: "upcoming" | "due_soon" | "overdue" | "settled";
  reference?: string;
}

export function TimelineStrip({
  title,
  events,
  direction,
  currency = "USD",
  max = 5,
}: {
  title: string;
  events: TimelineEventView[];
  direction: "incoming" | "outgoing";
  currency?: string;
  max?: number;
}) {
  const top = events.slice(0, max);
  const overdueCount = events.filter((e) => e.state === "overdue").length;
  const dueSoonCount = events.filter((e) => e.state === "due_soon").length;
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.018] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{title}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">
            {overdueCount > 0 && (
              <span className="mr-2 text-rose-300/90">{overdueCount} overdue</span>
            )}
            {dueSoonCount > 0 && (
              <span className="mr-2 text-amber-300/90">{dueSoonCount} due ≤ 7d</span>
            )}
            <span className="text-gray-600">{events.length} {events.length === 1 ? "line" : "lines"} on radar</span>
          </div>
        </div>
        <span className="text-[10px] text-gray-600">{direction === "incoming" ? "AR" : "AP"}</span>
      </div>
      {top.length === 0 ? (
        <div className="mt-3 flex h-20 items-center justify-center text-[11px] text-gray-500">
          Nothing scheduled on this horizon.
        </div>
      ) : (
        <ul className="mt-2.5 divide-y divide-white/[0.04]">
          {top.map((e) => {
            const stateCls =
              e.state === "overdue"  ? { dot: "bg-rose-400",  text: "text-rose-300/90",  label: "Overdue" }
            : e.state === "due_soon" ? { dot: "bg-amber-300", text: "text-amber-200/90", label: "≤ 7 d"   }
            : e.state === "settled"  ? { dot: "bg-white/30",  text: "text-gray-400",     label: "Settled" }
            :                          { dot: "bg-white/50",  text: "text-gray-300",     label: e.daysFromNow >= 9_000 ? "Unscheduled" : `${e.daysFromNow}d` };
            return (
              <li key={e.key} className="flex items-center gap-3 py-2 transition-colors hover:bg-white/[0.02]">
                <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${stateCls.dot}`} />
                <span className={`w-14 shrink-0 text-[10px] tabular-nums ${stateCls.text}`}>{stateCls.label}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] text-gray-200">{e.party}</span>
                  {e.reference && <span className="block truncate font-mono text-[9px] text-gray-600">{e.reference}</span>}
                </span>
                <span className={`shrink-0 text-[12px] font-medium tabular-nums ${direction === "incoming" ? "text-emerald-300/90" : "text-rose-300/90"}`}>
                  {direction === "incoming" ? "+" : "−"}{formatCompact(e.amount)}
                  <span className="ml-1 text-[9px] text-gray-600">{currency}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ConcentrationBar — single-row exposure visual.

   "X represents 42 % of revenue." Compact, monochrome with a single
   tint at the bar fill. Used for customer and supplier concentration.
   ───────────────────────────────────────────────────────────────────────── */

export function ConcentrationBar({
  label,
  party,
  share,
  hint,
  severity = "info",
}: {
  label: string;
  party: string;
  share: number;          // 0..100
  hint?: string;
  severity?: "info" | "watch" | "risk";
}) {
  const fillCls =
    severity === "risk"  ? "bg-rose-300/65"
  : severity === "watch" ? "bg-amber-300/65"
  :                        "bg-white/45";
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.018] p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</div>
        <div className={
          "text-[10px] tabular-nums " +
          (severity === "risk" ? "text-rose-300" : severity === "watch" ? "text-amber-300" : "text-gray-500")
        }>{share.toFixed(0)}%</div>
      </div>
      <div className="mt-2 truncate text-[13px] font-medium text-[var(--text-primary)]">{party}</div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div className={`h-full ${fillCls}`} style={{ width: `${Math.max(2, Math.min(100, share))}%` }} />
      </div>
      {hint && <div className="mt-2 text-[10px] text-gray-500">{hint}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   StatRow — three-up KPI strip used in Executive mode header.

   Calmer than HeroKpiCard. Numeric-first, label below, single accent
   on the value. Designed to be informational, not dominating.
   ───────────────────────────────────────────────────────────────────────── */

export function StatRow({
  stats,
}: {
  stats: { label: string; value: string; hint?: string; tone?: Tone; helpId?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {stats.map((s, i) => (
        <div key={i} className="rounded-xl border border-white/[0.04] bg-white/[0.012] p-3">
          <div className={`text-[16px] font-medium tabular-nums tracking-tight ${TONE_TEXT[s.tone ?? "neutral"]}`}>
            {s.value}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-gray-500">
            <span>{s.label}</span>
            {s.helpId && <GuidanceTip guidanceId={s.helpId} />}
          </div>
          {s.hint && <div className="mt-1 text-[10px] text-gray-600">{s.hint}</div>}
        </div>
      ))}
    </div>
  );
}
