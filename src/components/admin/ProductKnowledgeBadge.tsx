"use client";

/* ---------------------------------------------------------------------------
   ProductKnowledgeBadge — Phase 1 first-visible Product Knowledge UX.

   A compact completeness ring (donut) + maturity tier chip, driven entirely
   by the data-presence signal in product-knowledge-signal.ts. No new data.

   Two pieces:
     <KnowledgeRing pct tone size />   — the donut for the card image corner
     <MaturityChip level code label /> — the L1/L2/L3 pill for the meta row
   --------------------------------------------------------------------------- */

import type { ProductSignal } from "@/lib/product-knowledge-signal";

const TONE: Record<ProductSignal["tone"], string> = {
  // functional completeness tone — calm, single-step
  low: "var(--text-dim)",
  mid: "#FFB020",
  high: "#00CC66",
};

export function KnowledgeRing({
  pct,
  tone,
  size = 30,
}: {
  pct: number;
  tone: ProductSignal["tone"];
  size?: number;
}) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  const color = TONE[tone];
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full bg-[var(--bg-primary)]/70 backdrop-blur-sm"
      style={{ width: size + 6, height: size + 6 }}
      title={`Knowledge completeness ${pct}%`}
      aria-label={`Knowledge completeness ${pct}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums"
        style={{ color }}
      >
        {pct}
      </span>
    </span>
  );
}

export function MaturityChip({ signal }: { signal: ProductSignal }) {
  const color = TONE[signal.tone];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border"
      style={{ borderColor: "var(--border-subtle)", color }}
      title={`Maturity ${signal.levelCode} · ${signal.levelLabel}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {signal.levelCode} {signal.levelLabel}
    </span>
  );
}
