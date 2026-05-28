"use client";

/* ---------------------------------------------------------------------------
   BreakdownCard — v11.

   One self-contained, interactive AND print-friendly card for a single
   subcategory (XSL / XSO / XSI). The visual grammar mirrors the printed
   reference cards Kimo uses:

     · Big formula row across the top — bordered boxes per axis with
       a numbered circle below each. Hovering / clicking a box highlights
       the matching value table below.
     · Bilingual label strip (Chinese 中 + English) under the formula —
       same layout as the printed cards.
     · Value tables in a column grid, one per axis. Code cell on the
       left (dark), meaning on the right (subtle bg).
     · Print: each card forces a page break before, and the interactive
       chrome (hover hints, copy button) is hidden via @media print.

   Used as a stack of three on the knowledge page — NOT as tabs.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import type { CodingBreakdownDef } from "./data";

/* ── Single bordered formula cell with optional numbered circle. ────── */
function FormulaCell({
  value,
  index,
  empty,
  prefix,
  active,
  dimmed,
  onEnter,
  onLeave,
  onClick,
}: {
  value: string;
  index?: number;
  empty?: boolean;
  /** Render as the leading prefix block (XSL / XSO / XSI). No number circle, no interaction. */
  prefix?: boolean;
  active?: boolean;
  dimmed?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
}) {
  const Box = prefix ? "div" : "button";
  return (
    <Box
      type={prefix ? undefined : "button"}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={onClick}
      aria-pressed={!prefix ? (active ? "true" : "false") : undefined}
      className="group flex flex-col items-center gap-2 shrink-0 outline-none"
    >
      <div
        className={`relative flex items-center justify-center min-w-[60px] h-12 sm:h-14 px-3 rounded-md border-2 text-[16px] sm:text-[18px] font-bold tracking-wider font-mono transition-all duration-200 ${
          empty
            ? "border-dashed border-[var(--border-subtle)] text-[var(--text-dim)] bg-[var(--bg-surface)] print:border-gray-400 print:text-gray-400 print:bg-white"
            : prefix
              ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)] print:bg-black print:text-white print:border-black"
              : active
                ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)] scale-[1.05] print:bg-black print:text-white print:border-black"
                : "border-[var(--text-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] group-hover:bg-[var(--bg-surface-hover)] print:bg-white print:text-black print:border-black"
        } ${dimmed ? "opacity-40 print:opacity-100" : "opacity-100"}`}
      >
        {empty ? "" : value || (prefix ? "" : "")}
      </div>
      {!prefix && typeof index === "number" && (
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold leading-none transition-all duration-200 bg-[var(--text-primary)] text-[var(--bg-primary)] print:bg-black print:text-white ${
            active ? "scale-110 ring-2 ring-[var(--text-primary)]/30 print:ring-0" : ""
          } ${dimmed ? "opacity-40 print:opacity-100" : ""}`}
        >
          {index}
        </div>
      )}
      {prefix && <div className="h-6" />}
    </Box>
  );
}

function Dash() {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="flex items-center justify-center h-12 sm:h-14 px-1 text-[var(--text-dim)] text-[18px] font-bold print:text-black">
        —
      </div>
      <div className="h-6" />
    </div>
  );
}

export default function BreakdownCard({ def }: { def: CodingBreakdownDef }) {
  /* active = locked (click); hover = transient. Effective = hover ?? active. */
  const [active, setActive] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const effective = hover ?? active;

  function toggle(idx: number) {
    setActive((cur) => (cur === idx ? null : idx));
  }

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <article
      id={def.id}
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden print:bg-white print:border-black print:rounded-none print:break-inside-avoid print:break-before-page"
    >
      {/* ── Card header ────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-7 sm:py-5 border-b border-[var(--border-faint)] bg-[var(--bg-surface)] print:bg-white print:border-black">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)] font-mono font-bold text-[15px] tracking-wider print:bg-black print:text-white print:border-black">
            {def.prefix}
          </div>
          <div className="min-w-0">
            <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[var(--text-primary)] print:text-black">
              {def.title}
            </h3>
            <p className="mt-0.5 text-[12px] text-[var(--text-faint)] max-w-2xl leading-relaxed print:text-gray-700">
              {def.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-faint)] font-mono text-[11px] text-[var(--text-dim)]">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
            {def.example}
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="h-8 px-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            aria-label={`Print ${def.title} card`}
          >
            Print ⎙
          </button>
        </div>
      </header>

      {/* ── Formula row ────────────────────────────────────────────── */}
      <div className="px-5 sm:px-7 pt-6 print:pt-4">
        <div className="overflow-x-auto -mx-2 px-2 pb-2 print:overflow-visible">
          <div className="flex items-end gap-1.5 min-w-max justify-center">
            <FormulaCell value={def.prefix} prefix />
            <Dash />
            {def.segments.map((s, i) => (
              <span key={i} className="flex items-end gap-1.5">
                {s.sep === "before" && <Dash />}
                <FormulaCell
                  value={s.value}
                  index={s.index}
                  empty={s.empty}
                  active={effective === s.index}
                  dimmed={effective !== null && effective !== s.index}
                  onEnter={() => setHover(s.index)}
                  onLeave={() => setHover(null)}
                  onClick={() => toggle(s.index)}
                />
              </span>
            ))}
          </div>
        </div>

        {/* Bilingual labels strip — Chinese on top, English below */}
        <div
          className="mt-4 grid gap-px"
          style={{
            gridTemplateColumns: `repeat(${def.segments.length}, minmax(0, 1fr))`,
          }}
        >
          {def.segments.map((s) => {
            const isActive = effective === s.index;
            const isDimmed = effective !== null && !isActive;
            return (
              <button
                key={s.index}
                type="button"
                onMouseEnter={() => setHover(s.index)}
                onMouseLeave={() => setHover(null)}
                onClick={() => toggle(s.index)}
                className={`px-1.5 py-2 rounded-md border text-center transition-all duration-200 ${
                  isActive
                    ? "border-[var(--text-primary)] bg-[var(--bg-surface-active)] print:bg-gray-100 print:border-black"
                    : "border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] print:bg-white print:border-gray-400"
                } ${isDimmed ? "opacity-50 print:opacity-100" : "opacity-100"}`}
              >
                {s.sub && (
                  <div className="text-[10px] text-[var(--text-faint)] leading-tight print:text-gray-700">
                    {s.sub}
                  </div>
                )}
                <div className="text-[10.5px] font-semibold text-[var(--text-primary)] leading-tight mt-0.5 print:text-black">
                  {s.header}
                </div>
              </button>
            );
          })}
        </div>

        {/* Hover hint — interactive only, hidden in print */}
        <div className="mt-4 text-[10.5px] font-medium tracking-[0.18em] uppercase text-[var(--text-faint)] text-center print:hidden">
          {active !== null
            ? `Segment ${String(active).padStart(2, "0")} locked · click again to release`
            : effective !== null
              ? `Hovering segment ${String(effective).padStart(2, "0")} · click to lock`
              : "Hover or click any segment to see its allowed values"}
        </div>
      </div>

      {/* ── Value tables grid ──────────────────────────────────────── */}
      <div className="px-5 sm:px-7 py-6 print:py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
          {def.tables.map((t) => {
            const isActive = effective === t.segmentNumber;
            const isDimmed = effective !== null && !isActive;
            return (
              <div
                key={t.segmentNumber}
                onMouseEnter={() => setHover(t.segmentNumber)}
                onMouseLeave={() => setHover(null)}
                onClick={() => toggle(t.segmentNumber)}
                className={`rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer print:break-inside-avoid print:rounded-md ${
                  isActive
                    ? "border-[var(--text-primary)] bg-[var(--bg-surface)] shadow-[0_0_0_1px_var(--text-primary)] print:shadow-none print:border-black print:bg-white"
                    : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] print:bg-white print:border-gray-400"
                } ${isDimmed ? "opacity-50 print:opacity-100" : "opacity-100"}`}
              >
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] print:bg-black print:text-white">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--bg-primary)] text-[var(--text-primary)] text-[10px] font-bold print:bg-white print:text-black">
                    {t.segmentNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] truncate">
                      {t.title}
                    </div>
                    {t.sub && (
                      <div className="text-[10px] opacity-75 truncate">{t.sub}</div>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-[var(--border-faint)] print:divide-gray-300">
                  {t.rows.map((r) => (
                    <div
                      key={r.code}
                      className="grid grid-cols-[80px_1fr] gap-2 print:grid-cols-[64px_1fr]"
                    >
                      <div className="px-3 py-2 text-[12px] font-bold text-[var(--text-primary)] font-mono tracking-wider bg-[var(--bg-surface-subtle)] border-r border-[var(--border-faint)] print:bg-gray-100 print:text-black print:border-gray-300">
                        {r.code}
                      </div>
                      <div className="px-3 py-2 text-[12px] text-[var(--text-faint)] leading-snug print:text-black">
                        {r.meaning}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
