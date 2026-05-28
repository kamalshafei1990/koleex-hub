/* ---------------------------------------------------------------------------
   primitives — small reusable building blocks for the Product Coding
   System knowledge document.

   v26: stripped down to the only primitive the live page still uses.
   The earlier CodeSegment / CodePrefix / Dash / ColumnHeaderRow /
   ConfigCard / SystemStatus exports were consumed only by the
   now-deleted CodingBreakdown / BreakdownTabs / EcosystemMap.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";

/* ── Section header with eyebrow + number ─────────────────────────────── */
export function SectionHeader({
  number,
  eyebrow,
  title,
  sub,
  trailing,
}: {
  number: string;
  eyebrow: string;
  title: string;
  sub?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-baseline gap-3 text-[10px] font-bold tracking-[0.22em] text-[var(--text-faint)]">
          <span className="text-[var(--text-dim)]">{number}</span>
          <span>{eyebrow}</span>
        </div>
        <h2 className="mt-1 text-[20px] sm:text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">
          {title}
        </h2>
        {sub && (
          <p className="mt-1.5 text-[12.5px] text-[var(--text-faint)] max-w-2xl leading-relaxed">
            {sub}
          </p>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
