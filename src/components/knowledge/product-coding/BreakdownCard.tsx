"use client";

/* ---------------------------------------------------------------------------
   BreakdownCard — v17.

   Visual grammar is now identical to the Live SKU builder:

     · rounded-2xl outer shell, border-[var(--border-subtle)]
     · header with the radial-gradient bg, an eyebrow label (uppercase
       tracking), and the example code in big monospace bold (22/28px)
     · body is a vertical stack of axis blocks — each block has the
       same hover bg-swap + number-circle + UPPERCASE label header +
       wrap-flow of code/meaning pill buttons that the builder uses.

   The card stays interactive on the formula row: hovering a numbered
   axis pill OR an axis block highlights the matching axis everywhere
   on the card. Click to lock.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import type { CodingBreakdownDef } from "./data";

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
  prefix?: boolean;
  active?: boolean;
  dimmed?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
}) {
  if (prefix) {
    return (
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="flex items-center justify-center min-w-[54px] h-11 px-3 rounded-lg border border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)] text-[14px] font-bold tracking-wider font-mono">
          {value}
        </div>
        <div className="h-5" aria-hidden />
      </div>
    );
  }
  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={onClick}
      aria-pressed={active ? "true" : "false"}
      className="flex flex-col items-center gap-2 shrink-0 outline-none"
    >
      <div
        className={`flex items-center justify-center min-w-[54px] h-11 px-3 rounded-lg border text-[14px] font-bold tracking-wider font-mono transition-colors duration-150 ${
          empty
            ? "border-dashed border-[var(--border-subtle)] text-[var(--text-dim)] bg-[var(--bg-surface)]"
            : active
              ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
              : "border-[var(--text-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
        } ${dimmed ? "opacity-40" : ""}`}
      >
        {empty ? "" : value}
      </div>
      {typeof index === "number" && (
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold leading-none bg-[var(--text-primary)] text-[var(--bg-primary)] ${
            dimmed ? "opacity-40" : ""
          }`}
        >
          {index}
        </div>
      )}
    </button>
  );
}

function Dash() {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="flex items-center justify-center h-11 px-1 text-[var(--text-dim)] text-[16px] font-bold">
        —
      </div>
      <div className="h-5" aria-hidden />
    </div>
  );
}

export default function BreakdownCard({ def }: { def: CodingBreakdownDef }) {
  const [active, setActive] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const effective = hover ?? active;

  function toggle(idx: number) {
    setActive((cur) => (cur === idx ? null : idx));
  }

  return (
    <article
      id={def.id}
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden"
    >
      {/* ── Header — same shell as the Live SKU builder ─────────── */}
      <div
        className="px-5 sm:px-7 py-5 border-b border-[var(--border-faint)] flex flex-wrap items-center justify-between gap-4"
        style={{
          background:
            "radial-gradient(120% 80% at 20% 0%, var(--bg-surface-hover) 0%, transparent 60%), var(--bg-secondary)",
        }}
      >
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
            {def.title.split(" · ")[0]} · Reference card
          </div>
          <div className="mt-2 font-mono text-[22px] sm:text-[28px] font-bold tracking-wider text-[var(--text-primary)] truncate">
            {def.example}
          </div>
        </div>
        <div className="px-3 h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center font-mono text-[12px] font-bold tracking-wider text-[var(--text-primary)] shrink-0">
          {def.prefix}
        </div>
      </div>

      {/* ── Subtitle ───────────────────────────────────────────── */}
      <div className="px-5 sm:px-7 pt-5 text-[12.5px] text-[var(--text-faint)] leading-relaxed max-w-3xl">
        {def.subtitle}
      </div>

      {/* ── Formula anatomy strip ───────────────────────────────── */}
      <div className="px-5 sm:px-7 pt-5 pb-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-3">
          Code anatomy
        </div>
        <div className="rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] p-4 overflow-x-auto">
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
      </div>

      {/* ── Axis selector list — IDENTICAL to SKU builder ──────── */}
      <div className="p-5 sm:p-7 pt-3 space-y-4">
        {def.tables.map((t) => {
          const isActive = effective === t.segmentNumber;
          const isDimmed = effective !== null && !isActive;
          return (
            <div
              key={t.segmentNumber}
              onMouseEnter={() => setHover(t.segmentNumber)}
              onMouseLeave={() => setHover(null)}
              onClick={() => toggle(t.segmentNumber)}
              className={`rounded-lg p-3 transition-colors cursor-pointer ${
                isActive
                  ? "bg-[var(--bg-surface-subtle)]"
                  : "hover:bg-[var(--bg-surface-subtle)]"
              } ${isDimmed ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-bold leading-none">
                  {t.segmentNumber}
                </div>
                <div className="text-[11.5px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                  {t.title}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.rows.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    title={r.meaning}
                    className="h-7 px-2.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[11px] font-mono text-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors flex items-center"
                  >
                    <span className="font-bold text-[var(--text-primary)]">
                      {r.code}
                    </span>
                    <span className="ml-1.5 hidden sm:inline opacity-80 font-sans font-medium">
                      {r.meaning}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
