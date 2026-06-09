/* Sparkline — tiny inline trend (Phase 2A · A2).
   Dependency-free SVG, deterministic, no animation. Monochrome by default
   (calm → neutral). Accessible: role="img" + aria-label. RSC-safe. */

import type { Tone } from "@/lib/security/view-model";
import { TONE_STROKE } from "./tokens";

export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  tone?: Tone;
  filled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export default function Sparkline({
  values,
  width = 96,
  height = 28,
  tone = "calm",
  filled = true,
  ariaLabel = "Trend",
  className = "",
}: SparklineProps) {
  if (!values || values.length === 0) return null;

  const pad = 1.5;
  const h = height - pad * 2;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const n = values.length;

  const pts =
    n < 2
      ? [`0,${(height / 2).toFixed(2)}`, `${width},${(height / 2).toFixed(2)}`]
      : values.map((v, i) => {
          const x = (i / (n - 1)) * width;
          const y = pad + (h - ((v - min) / range) * h);
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        });

  const stroke = TONE_STROKE[tone];
  const areaPts = `0,${height} ${pts.join(" ")} ${width},${height}`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
    >
      {filled && n >= 2 && <polygon points={areaPts} fill={stroke} fillOpacity={0.08} stroke="none" />}
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
