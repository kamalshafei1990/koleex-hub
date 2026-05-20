"use client";

/* ===========================================================================
   Finance · chart primitives.

   Carved out of FinanceUiX.tsx (Fix #3 — 1459 → ~900 lines). Everything
   that draws an SVG plus the small palette + math helpers that feed it
   lives here. The visual language follows the same Bloomberg /
   institutional-finance rules as the rest of the dashboard:

     · monochrome ink by default
     · accent only for direction (positive / negative)
     · soft area fills, thin strokes, non-scaling-stroke so curves stay
       crisp under preserveAspectRatio="none"
     · sqrt soft-compression in AreaChart so a single outlier doesn't
       flatten the rest of the curve
     · empty-state panels render in place rather than collapsing to a
       0-height container

   The chart palette + math helpers (chartStrokeFor, toneToStroke,
   buildSmoothPath) are internal — they're only re-exported where a
   caller outside this file genuinely needs them (none, today).
   ========================================================================== */

import { useId } from "react";
import type { Tone } from "@/components/finance/tone";

/* ─── Phase UI.2 — restrained chart palette ───────────────────────
   The dashboard's chart system used to speak in 5 hues (emerald /
   rose / amber / sky / default). This collapses to 3 functional
   tones:
     · CHART_INK     — neutral / info, ~88% white (the default)
     · CHART_GAIN    — positive, muted emerald @ 70%
     · CHART_LOSS    — negative, muted rose @ 70%
   "warning" and "info" both render as ink — the surrounding context
   (chip, tile rail, narrative) already carries the tone. */
const CHART_INK   = "rgba(255,255,255,0.88)";
const CHART_GAIN  = "rgba(134,239,172,0.70)";
const CHART_LOSS  = "rgba(253,164,175,0.70)";

function chartStrokeFor(t: Tone): string {
  if (t === "positive") return CHART_GAIN;
  if (t === "negative") return CHART_LOSS;
  return CHART_INK;
}
function toneToStroke(t: Tone): string {
  return chartStrokeFor(t);
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
   formatCompact — typography-aware compact numerals.

   "1.2K" / "3.4M" / "1.0B" with a Unicode minus instead of hyphen for
   negatives. 2 dp for sub-thousand. Different from fmtMoney (no
   currency tail) so the unit can be rendered separately for layout
   control.
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

/* ---------------------------------------------------------------------------
   AreaChartMini — small inline area chart used inside HeroKpiCard.
   Gradient fill + smooth path + monochrome.
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
  const reactId = useId();
  const W = 100;
  const H = height;
  if (!data.length) return null;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const range = max - min || 1;
  const stepX = W / Math.max(1, data.length - 1);

  const points = data.map((v, i) => ({
    x: i * stepX,
    y: H - ((v - min) / range) * H,
  }));
  const path = buildSmoothPath(points);
  const areaPath = `${path} L ${(data.length - 1) * stepX},${H} L 0,${H} Z`;

  const stroke = chartStrokeFor(tone);
  const gradId = `mini-${tone}-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const lastPoint = points[points.length - 1];
  const lastXPct = (lastPoint.x / W) * 100;
  const lastYPct = (lastPoint.y / H) * 100;

  return (
    <div className="relative w-full" style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={stroke} stopOpacity="0.06" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <title>{currency ? `${data.length} points · ${currency}` : `${data.length} data points`}</title>
      </svg>
      <span
        aria-hidden
        className="pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${lastXPct}%`,
          top: `${lastYPct}%`,
          background: stroke,
        }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   AreaChart — full-size area chart used by the dashboard.
   Gradient fill + smooth curves + axis grid + tick labels.

   Includes adaptive sqrt soft-compression when a single outlier would
   otherwise flatten the rest of the curve. The ticks invert the
   compression so the axis labels still read in real units.
   --------------------------------------------------------------------------- */

export function AreaChart({
  series,
  labels,
  height = 220,
  currency = "USD",
}: {
  series: { name: string; values: number[]; tone: Tone }[];
  labels: string[];
  height?: number;
  currency?: string;
}) {
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

  const ticks = 3;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => min + (range * i) / ticks);

  const seriesLastPoints = series.map((s) => {
    const lastIdx = s.values.length - 1;
    if (lastIdx < 0) return null;
    const xVB = padX + lastIdx * stepX;
    const yVB = padY + innerH - ((displayValue(s.values[lastIdx]) - min) / range) * innerH;
    return {
      xPct: (xVB / W) * 100,
      yPct: (yVB / height) * 100,
      stroke: toneToStroke(s.tone),
    };
  });

  return (
    <div>
      <div className="relative w-full" style={{ height }}>
        <svg
          viewBox={`0 0 ${W} ${height}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
        >
          <defs>
            {series.map((s, i) => {
              const stroke = toneToStroke(s.tone);
              return (
                <linearGradient key={i} id={`area-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={stroke} stopOpacity="0.06" />
                  <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                </linearGradient>
              );
            })}
          </defs>

          {tickValues.map((tv, i) => {
            const y = padY + innerH - ((tv - min) / range) * innerH;
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

          {series.map((s, i) => {
            const stroke = toneToStroke(s.tone);
            const pts = s.values.map((v, idx) => ({
              x: padX + idx * stepX,
              y: padY + innerH - ((displayValue(v) - min) / range) * innerH,
            }));
            const path = buildSmoothPath(pts);
            const areaPath = `${path} L ${padX + (s.values.length - 1) * stepX},${padY + innerH} L ${padX},${padY + innerH} Z`;
            const isPrimary = i === 0;
            return (
              <g key={i}>
                <path d={areaPath} fill={`url(#area-grad-${i})`} />
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isPrimary ? "1.1" : "0.9"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}

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

        {seriesLastPoints.map((p, i) =>
          p ? (
            <span
              key={i}
              aria-hidden
              className="pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${p.xPct}%`, top: `${p.yPct}%`, background: p.stroke }}
            />
          ) : null
        )}
      </div>

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

/* ---------------------------------------------------------------------------
   DonutChart — monochrome category-share donut.
   Used by the Expense Analytics page for "spend by category".
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
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const share = s.value / total;
        const dash = share * c;
        const gap = c - dash;
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
   BarChart — compact monochrome vertical bar chart used for monthly
   spend / period histograms.
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
          const tone = isMax ? "bg-white/[0.45]" : "bg-white/[0.10]";
          const ring =
            highlightLast && isLast
              ? "ring-1 ring-white/[0.08]"
              : "";
          return (
            <div
              key={i}
              className={`group flex-1 cursor-default rounded-sm transition-colors duration-200 hover:bg-white/[0.20] ${tone} ${ring}`}
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
