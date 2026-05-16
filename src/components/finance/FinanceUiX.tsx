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
    <div className="relative isolate overflow-hidden rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.04] via-transparent to-transparent p-7 transition hover:border-white/[0.08]">
      {/* Soft directional glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-10 -z-10 h-48 w-48 rounded-full blur-3xl"
        style={{
          background:
            tone === "positive" ? "rgba(52,211,153,0.10)"
            : tone === "negative" ? "rgba(251,113,133,0.10)"
            : tone === "warning"  ? "rgba(251,191,36,0.08)"
            : tone === "info"     ? "rgba(56,189,248,0.08)"
            : "rgba(255,255,255,0.04)",
        }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</div>
          <div className="mt-3 flex items-baseline gap-2.5">
            {loading ? (
              <span className="inline-block h-9 w-44 animate-pulse rounded bg-white/5" />
            ) : (
              <>
                <span className={`text-[40px] leading-none font-medium tracking-tight tabular-nums ${TONE_TEXT[tone]}`}>
                  {display}
                </span>
                {unit && <span className="text-base font-medium text-gray-500">{unit}</span>}
              </>
            )}
          </div>
          {(delta != null || hint) && (
            <div className="mt-4 flex items-center gap-2.5 text-[12px]">
              {delta != null && (
                <span
                  className={
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium " +
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
        <div className="mt-5 -mx-1">
          <AreaChartMini data={trend} tone={tone} currency={trendCurrency} height={64} />
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
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 transition hover:border-white/[0.08]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        {loading ? (
          <span className="inline-block h-6 w-24 animate-pulse rounded bg-white/5" />
        ) : (
          <>
            <span className={`text-[20px] leading-none font-medium tracking-tight tabular-nums ${TONE_TEXT[tone]}`}>{display}</span>
            {unit && <span className="text-[11px] text-gray-500">{unit}</span>}
          </>
        )}
      </div>
      {(delta != null || hint) && (
        <div className="mt-2.5 flex items-center gap-2 text-[11px]">
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

export function InsightCard({
  icon,
  title,
  description,
  chip,
  chipTone = "neutral",
  cta,
  onCta,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  chip?: string;
  chipTone?: Tone;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4">
      {icon && (
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-base">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
          {chip && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TONE_CHIP_BG[chipTone]}`}>
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
    <div className="relative isolate overflow-hidden rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.03] via-transparent to-transparent p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-gray-500">{subtitle}</p>}
        </div>
        {controls}
      </div>
      <div className="mt-4">{children}</div>
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
  if (!series.length || !labels.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No data yet for this period.
      </div>
    );
  }
  const W = 800;
  const padX = 16;
  const padY = 24;
  const innerW = W - padX * 2;
  const innerH = height - padY * 2;

  const allValues = series.flatMap((s) => s.values);
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 1);
  const range = max - min || 1;
  const stepX = innerW / Math.max(1, labels.length - 1);

  const ticks = 4; /* horizontal grid lines */
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => min + (range * i) / ticks);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" preserveAspectRatio="none">
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

        {/* Horizontal grid */}
        {tickValues.map((tv, i) => {
          const y = padY + innerH - ((tv - min) / range) * innerH;
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
                {formatCompact(tv)}
              </text>
            </g>
          );
        })}

        {/* Series */}
        {series.map((s, i) => {
          const stroke = toneToStroke(s.tone);
          const pts = s.values.map((v, idx) => ({
            x: padX + idx * stepX,
            y: padY + innerH - ((v - min) / range) * innerH,
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
  return (
    <div className="mt-10 mb-4">
      {eyebrow && (
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">{eyebrow}</div>
      )}
      <h2 className="mt-1 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
      {description && <p className="mt-1 text-[12px] text-gray-500">{description}</p>}
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
