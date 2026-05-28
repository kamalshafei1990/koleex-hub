/* ---------------------------------------------------------------------------
   primitives — small reusable building blocks for the Product Coding
   System knowledge document.

   v28: adds <HeaderShell>, the unified header strip used by the live
   BreakdownCard / CodeBuilder / AIParseFlow components.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";

/* ── HeaderShell — unified gradient bar at the top of every primary
      panel on the page (BreakdownCard / CodeBuilder / AIParseFlow). One
      gradient, one padding rhythm, one border treatment. */
export function HeaderShell({
  eyebrow,
  primary,
  trailing,
}: {
  eyebrow: ReactNode;
  primary: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div
      className="px-5 sm:px-7 py-5 border-b border-[var(--border-faint)] flex flex-wrap items-center justify-between gap-4"
      style={{
        background:
          "radial-gradient(120% 80% at 20% 0%, var(--bg-surface-hover) 0%, transparent 60%), var(--bg-secondary)",
      }}
    >
      <div className="min-w-0">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] flex items-center gap-2">
          {eyebrow}
        </div>
        <div className="mt-2">{primary}</div>
      </div>
      {trailing && <div className="flex items-center gap-2 shrink-0">{trailing}</div>}
    </div>
  );
}

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
