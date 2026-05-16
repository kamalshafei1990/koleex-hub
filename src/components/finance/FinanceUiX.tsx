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

import { useId, type ReactNode } from "react";
import { fmtMoney, fmtPct } from "@/lib/finance/calc";

/* ---------------------------------------------------------------------------
   1. Tokens
   --------------------------------------------------------------------------- */

export type Tone = "neutral" | "positive" | "negative" | "warning" | "info";

const TONE_TEXT: Record<Tone, string> = {
  neutral:  "text-[var(--text-primary)]",
  positive: "text-emerald-300",
  negative: "text-rose-300",
  warning:  "text-amber-300",
  info:     "text-sky-300",
};

const TONE_CHIP_BG: Record<Tone, string> = {
  neutral:  "bg-white/[0.06] text-gray-300",
  positive: "bg-emerald-500/15 text-emerald-300",
  negative: "bg-rose-500/15 text-rose-300",
  warning:  "bg-amber-500/15 text-amber-300",
  info:     "bg-sky-500/15 text-sky-300",
};

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
}) {
  const display = typeof value === "string" ? value : formatCompact(value);
  const deltaSign = delta == null ? 0 : delta > 0 ? 1 : delta < 0 ? -1 : 0;

  return (
    <div className="group relative isolate overflow-hidden rounded-2xl border border-white/[0.05] bg-gradient-to-br from-white/[0.035] via-white/[0.01] to-transparent p-5 transition-all duration-300 ease-out hover:-translate-y-[1px] hover:border-white/[0.10] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      {/* Soft directional glow — calmer than Phase 1.5 to suit the
          tighter card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-6 -z-10 h-36 w-36 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-80"
        style={{
          background:
            tone === "positive" ? "rgba(52,211,153,0.09)"
            : tone === "negative" ? "rgba(251,113,133,0.09)"
            : tone === "warning"  ? "rgba(251,191,36,0.07)"
            : tone === "info"     ? "rgba(56,189,248,0.07)"
            : "rgba(255,255,255,0.04)",
        }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</div>
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
}: {
  label: string;
  value: number | string;
  unit?: string;
  delta?: number | null;
  hint?: string;
  tone?: Tone;
  loading?: boolean;
}) {
  const display = typeof value === "string" ? value : formatCompact(value);
  const deltaSign = delta == null ? 0 : delta > 0 ? 1 : delta < 0 ? -1 : 0;
  return (
    <div className="rounded-xl border border-white/[0.04] bg-white/[0.018] p-3.5 transition hover:border-white/[0.08]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</div>
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

const SEVERITY_FRAME: Record<InsightSeverity, { border: string; bg: string; rail: string; glow: string; pulse?: string }> = {
  positive: {
    border: "border-white/[0.05]",
    bg:     "bg-white/[0.02]",
    rail:   "bg-gradient-to-b from-emerald-400/55 to-emerald-500/10",
    glow:   "rgba(52,211,153,0.06)",
  },
  neutral: {
    border: "border-white/[0.04]",
    bg:     "bg-white/[0.018]",
    rail:   "bg-white/[0.10]",
    glow:   "rgba(255,255,255,0.02)",
  },
  watch: {
    border: "border-amber-500/[0.22]",
    bg:     "bg-amber-500/[0.025]",
    rail:   "bg-gradient-to-b from-amber-300/60 to-amber-500/10",
    glow:   "rgba(251,191,36,0.07)",
  },
  risk: {
    border: "border-rose-500/[0.30]",
    bg:     "bg-rose-500/[0.025]",
    rail:   "bg-gradient-to-b from-rose-300/60 to-rose-500/15",
    glow:   "rgba(251,113,133,0.10)",
  },
  critical: {
    border: "border-rose-500/[0.45]",
    bg:     "bg-rose-500/[0.035]",
    rail:   "bg-gradient-to-b from-rose-300/80 to-rose-500/20",
    glow:   "rgba(251,113,133,0.16)",
    pulse:  "animate-koleex-edge-pulse",
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
      className={`group relative isolate flex items-start gap-3 overflow-hidden rounded-2xl border p-4 transition-colors duration-300 ${sev.border} ${sev.bg} ${sev.pulse ?? ""}`}
    >
      {/* Left severity rail — 2 px tinted strip. Communicates urgency
          without colouring the whole card. */}
      <div aria-hidden className={`absolute left-0 top-3 bottom-3 w-[2px] rounded-r ${sev.rail}`} />
      {/* Subtle directional glow keyed to severity. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-6 -z-10 h-28 w-28 rounded-full blur-3xl"
        style={{ background: sev.glow }}
      />
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
            className="mt-2 text-[11px] font-medium text-sky-300 hover:text-sky-200"
          >
            {cta} →
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
}: {
  title: string;
  subtitle?: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.03] via-transparent to-transparent p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-gray-500">{subtitle}</p>}
        </div>
        {controls}
      </div>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   6. AreaChartMini  —  small inline area chart used inside HeroKpiCard.
      Just gradient fill + smooth path + monochrome.
   --------------------------------------------------------------------------- */

export function AreaChartMini({
  data,
  tone = "neutral",
  height = 64,
  currency,
}: {
  data: number[];
  tone?: Tone;
  height?: number;
  currency?: string;
}) {
  /* All hooks must run on every render. Compute the per-instance id
     BEFORE any early-return so React's hook order stays stable. */
  const reactId = useId();
  const W = 100; /* viewBox units — actual width fills container */
  const H = height;
  if (!data.length) return null;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const range = max - min || 1;
  const stepX = W / Math.max(1, data.length - 1);

  /* Smooth path via Catmull-Rom → Bezier curve. */
  const points = data.map((v, i) => ({
    x: i * stepX,
    y: H - ((v - min) / range) * H,
  }));
  const path = buildSmoothPath(points);
  const areaPath = `${path} L ${(data.length - 1) * stepX},${H} L 0,${H} Z`;

  const stroke =
    tone === "positive" ? "#34d399"
    : tone === "negative" ? "#fb7185"
    : tone === "warning"  ? "#fbbf24"
    : tone === "info"     ? "#38bdf8"
    : "rgba(255,255,255,0.55)";
  /* Stable per-instance id so React-19 react-hooks/purity is satisfied
     and two AreaChartMini components in the same view don't share a
     gradient by accident. */
  const gradId = `mini-${tone}-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={stroke} stopOpacity="0.32" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last-point dot */}
      {points.length > 0 && (
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="1.6" fill={stroke} />
      )}
      <title>{currency ? `${data.length} points · ${currency}` : `${data.length} data points`}</title>
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   7. AreaChart — full-size area chart used by the dashboard.
      Gradient fill + smooth curves + axis grid + hover tooltips.
   --------------------------------------------------------------------------- */

export function AreaChart({
  series,
  labels,
  height = 280,
  currency = "USD",
}: {
  series: { name: string; values: number[]; tone: Tone }[];
  labels: string[];
  height?: number;
  currency?: string;
}) {
  /* Empty-state takes precedence — show a tasteful nothing-here panel
     rather than rendering a 0-height chart that visually crashes. */
  const allValues = series.flatMap((s) => s.values);
  const hasAnyValue = allValues.some((v) => v !== 0);
  if (!series.length || !labels.length || !hasAnyValue) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] text-sm text-gray-500">
        <span className="text-[11px] uppercase tracking-[0.18em] text-gray-600">No activity</span>
        <span>Once orders and expenses flow in, the trend chart appears here.</span>
      </div>
    );
  }

  const W = 800;
  const padX = 16;
  const padY = 24;
  const innerW = W - padX * 2;
  const innerH = height - padY * 2;

  /* Adaptive log-style smoothing.
     Sparse demo data often has ONE giant spike with the rest near
     zero, which makes a linear scale look broken (everything glued
     to the baseline except the spike). To stay readable while
     preserving drama:

       1. Detect "spike outlier" — a max that is >5× the median
          of non-zero values.
       2. When detected, compress the range with a soft sqrt curve
          via the displayValue() helper below.
       3. Always pad the resulting range so the curve breathes.

     For normal data the curve is untouched. */
  const nonZero = allValues.filter((v) => v !== 0);
  const median = (() => {
    if (nonZero.length === 0) return 0;
    const s = [...nonZero].map(Math.abs).sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  })();
  const rawMin = Math.min(...allValues, 0);
  const rawMax = Math.max(...allValues, 1);
  const compress = median > 0 && rawMax > median * 5;
  /* sqrt-based soft compression keeps zero at zero and large values
     visible without dominating. Sign-preserving so net-profit lines
     can dip below the axis. */
  const displayValue = (v: number): number => {
    if (!compress) return v;
    const sign = v < 0 ? -1 : 1;
    return sign * Math.sqrt(Math.abs(v));
  };
  const compMin = compress ? displayValue(rawMin) : rawMin;
  const compMax = compress ? displayValue(rawMax) : rawMax;
  const span = Math.max(1, compMax - compMin);
  const min = compMin === 0 ? 0 : compMin - span * 0.06;
  const max = compMax + span * 0.12;
  const range = max - min || 1;
  const stepX = innerW / Math.max(1, labels.length - 1);

  const ticks = 4; /* horizontal grid lines */
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => min + (range * i) / ticks);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{
          /* Subtle fade-in reveal so charts feel alive when loaded */
          animation: "koleex-fade-in 480ms ease-out both",
        }}
      >
        <defs>
          {series.map((s, i) => {
            const stroke = toneToStroke(s.tone);
            return (
              <linearGradient key={i} id={`area-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor={stroke} stopOpacity="0.30" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            );
          })}
        </defs>

        {/* Horizontal grid — labels show the un-compressed value so
            the axis still reads in real units even when the curve is
            soft-compressed for readability. */}
        {tickValues.map((tv, i) => {
          const y = padY + innerH - ((tv - min) / range) * innerH;
          /* Invert the sqrt compression when rendering tick labels so
             the operator sees real numbers, not the compressed proxy. */
          const realValue = compress
            ? (tv < 0 ? -1 : 1) * Math.pow(Math.abs(tv), 2)
            : tv;
          return (
            <g key={i}>
              <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <text
                x={W - padX} y={y - 3}
                fill="rgba(255,255,255,0.30)"
                fontSize="9"
                textAnchor="end"
                fontFamily="ui-sans-serif, system-ui"
              >
                {formatCompact(realValue)}
              </text>
            </g>
          );
        })}

        {/* Series */}
        {series.map((s, i) => {
          const stroke = toneToStroke(s.tone);
          const pts = s.values.map((v, idx) => ({
            x: padX + idx * stepX,
            y: padY + innerH - ((displayValue(v) - min) / range) * innerH,
          }));
          const path = buildSmoothPath(pts);
          const areaPath = `${path} L ${padX + (s.values.length - 1) * stepX},${padY + innerH} L ${padX},${padY + innerH} Z`;
          return (
            <g key={i}>
              <path d={areaPath} fill={`url(#area-grad-${i})`} />
              <path d={path} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              {/* Last-point pulse */}
              {pts.length > 0 && (
                <>
                  <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3.5" fill={stroke} opacity="0.30" />
                  <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2"   fill={stroke} />
                </>
              )}
            </g>
          );
        })}

        {/* X labels — show every Nth label so we don't crowd */}
        {labels.map((lab, i) => {
          const stride = Math.ceil(labels.length / 8);
          if (i % stride !== 0 && i !== labels.length - 1) return null;
          const x = padX + i * stepX;
          return (
            <text key={i} x={x} y={height - 4} fontSize="9" fill="rgba(255,255,255,0.30)" textAnchor="middle" fontFamily="ui-sans-serif, system-ui">
              {lab}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-gray-400">
        {series.map((s, i) => {
          const stroke = toneToStroke(s.tone);
          return (
            <span key={i} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: stroke }} />
              {s.name}
            </span>
          );
        })}
        <span className="ml-auto text-gray-600">{currency}</span>
      </div>
    </div>
  );
}

function toneToStroke(t: Tone): string {
  switch (t) {
    case "positive": return "#34d399";
    case "negative": return "#fb7185";
    case "warning":  return "#fbbf24";
    case "info":     return "#38bdf8";
    default:         return "rgba(255,255,255,0.65)";
  }
}

/* Catmull-Rom → SVG cubic Bezier for smooth path interpolation. */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  const d: string[] = [`M ${points[0].x},${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const tension = 0.18;
    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = p1.y + (p2.y - p0.y) * tension;
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = p2.y - (p3.y - p1.y) * tension;
    d.push(`C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`);
  }
  return d.join(" ");
}

/* ---------------------------------------------------------------------------
   7b. DonutChart — monochrome category-share donut.
       Used by the Expense Analytics page for "spend by category".
       Each segment renders in a soft white tint at varying intensity
       so the chart stays calm, the largest segment naturally reads
       brightest, and there's no rainbow.
   --------------------------------------------------------------------------- */

export function DonutChart({
  segments,
  size = 168,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  segments: { name: string; value: number }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] text-sm text-gray-500"
        style={{ width: size, height: size }}
      >
        <span className="text-[10px] uppercase tracking-[0.18em] text-gray-600">No spend</span>
      </div>
    );
  }
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  /* Precompute cumulative offsets in an IIFE so the local `let` is
     contained outside render-state semantics (satisfies React-19
     react-hooks/immutability rule). */
  const cumOffsets: number[] = (() => {
    const result: number[] = [];
    let running = 0;
    for (const s of segments) {
      result.push(running);
      running += (s.value / total) * c;
    }
    return result;
  })();
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <title>{segments.map((s) => `${s.name}: ${formatCompact(s.value)}`).join(" · ")}</title>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const share = s.value / total;
        const dash = share * c;
        const gap = c - dash;
        /* Brightness scales with share so the eye lands on the
           largest segment first. Each subsequent segment dims. */
        const opacity = 0.30 + 0.45 * (1 - i / Math.max(1, segments.length));
        const stroke = `rgba(255,255,255,${opacity.toFixed(2)})`;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-cumOffsets[i]}
            strokeLinecap="butt"
          />
        );
      })}
      {/* Centre label (rotated back so it reads horizontally). */}
      <g transform={`rotate(90 ${cx} ${cy})`}>
        {centerValue && (
          <text
            x={cx} y={cy + 2}
            textAnchor="middle"
            fontSize="18"
            fontWeight="500"
            fill="rgba(255,255,255,0.85)"
            fontFamily="ui-sans-serif, system-ui"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x={cx} y={cy + 18}
            textAnchor="middle"
            fontSize="9"
            fill="rgba(255,255,255,0.35)"
            letterSpacing="0.18em"
            fontFamily="ui-sans-serif, system-ui"
          >
            {centerLabel.toUpperCase()}
          </text>
        )}
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   7c. BarChart — compact monochrome vertical bar chart used for
       monthly spend / period histograms. Each bar is a thin pill with
       a soft top accent on the largest one. Same calm vocabulary as
       the rest of the system.
   --------------------------------------------------------------------------- */

export function BarChart({
  data,
  height = 132,
  highlightLast = true,
}: {
  data: { label: string; value: number }[];
  height?: number;
  highlightLast?: boolean;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] text-sm text-gray-500">
        No data yet.
      </div>
    );
  }
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const pct = (Math.abs(d.value) / max) * 100;
          const isMax = max > 0 && Math.abs(d.value) === max;
          const isLast = i === data.length - 1;
          const tone =
            isMax
              ? "bg-gradient-to-t from-white/30 to-white/70"
              : "bg-white/[0.10]";
          const ring =
            highlightLast && isLast
              ? "ring-1 ring-white/[0.08]"
              : "";
          return (
            <div
              key={i}
              className={`group flex-1 cursor-default rounded-md transition-colors duration-200 hover:bg-white/[0.20] ${tone} ${ring}`}
              style={{ height: `${Math.max(3, pct)}%`, minHeight: 3 }}
              title={`${d.label} · ${formatCompact(d.value)}`}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9px] tracking-wide text-gray-500">{d.label}</div>
        ))}
      </div>
    </div>
  );
}

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
  return (
    <div className="overflow-x-auto">
      <div className="flex items-stretch gap-2 sm:gap-2.5">
        {items.map((it) => {
          const inner = (
            <>
              {it.icon && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-[12px] text-gray-300 transition-colors group-hover:bg-white/[0.08] group-hover:text-gray-100">
                  {it.icon}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[12px] font-medium leading-tight text-gray-200 group-hover:text-white">{it.label}</span>
                {it.hint && (
                  <span className="truncate text-[10px] leading-tight text-gray-500">{it.hint}</span>
                )}
              </span>
              {it.badge && (
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${TONE_CHIP_BG[it.badge.tone]}`}>
                  {it.badge.text}
                </span>
              )}
            </>
          );
          const cls =
            "group flex min-w-[180px] items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 transition-all duration-200 hover:-translate-y-[1px] hover:border-white/[0.10] hover:bg-white/[0.04] " +
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
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  /* Phase 1.7: tightened from mt-10/mb-4 → mt-7/mb-3.
     The dashboard now has ~10 sections; the previous spacing wasted
     vertical budget. This keeps the rhythm without losing readability. */
  return (
    <div className="mt-7 mb-3">
      {eyebrow && (
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{eyebrow}</div>
      )}
      <h2 className="mt-1 text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
      {description && <p className="mt-0.5 text-[11.5px] text-gray-500">{description}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Number formatter shared by the cards. Compact for thousands+, fixed
   2dp for sub-thousand. Different from fmtMoney (no currency tail) so
   the unit can be rendered separately for typography control.
   --------------------------------------------------------------------------- */

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2) + "B";
  if (abs >= 1_000_000)     return sign + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
  if (abs >= 1_000)         return sign + (abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2) + "K";
  return sign + abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/* Re-export for callers that still want a currency-style label */
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
  stats: { label: string; value: string; hint?: string; tone?: Tone }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {stats.map((s, i) => (
        <div key={i} className="rounded-xl border border-white/[0.04] bg-white/[0.012] p-3">
          <div className={`text-[16px] font-medium tabular-nums tracking-tight ${TONE_TEXT[s.tone ?? "neutral"]}`}>
            {s.value}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-gray-500">{s.label}</div>
          {s.hint && <div className="mt-1 text-[10px] text-gray-600">{s.hint}</div>}
        </div>
      ))}
    </div>
  );
}
