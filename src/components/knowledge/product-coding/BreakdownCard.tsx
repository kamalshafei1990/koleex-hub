"use client";

/* ---------------------------------------------------------------------------
   BreakdownCard — v13.

   English-only, rounded edges, brand-aligned. One self-contained card
   per subcategory (XSL / XSO / XSI):

     · Black rounded header bar — prefix + title + example code.
     · Subtitle paragraph.
     · Formula row — rounded bordered axis cells with numbered circles.
     · English label strip (Chinese sub fields are intentionally not
       rendered — the page is English-only).
     · Value-table grid — one rounded card per axis. Hover/click any
       axis to highlight its matching table (and vice versa).
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
  const interactive = !prefix;

  if (!interactive) {
    return (
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="flex items-center justify-center min-w-[60px] h-12 px-3 rounded-lg border border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)] text-[16px] font-bold tracking-wider font-mono">
          {value}
        </div>
        <div className="h-6" aria-hidden />
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
        className={`flex items-center justify-center min-w-[60px] h-12 px-3 rounded-lg border text-[16px] font-bold tracking-wider font-mono transition-colors duration-150 ${
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
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold leading-none bg-[var(--text-primary)] text-[var(--bg-primary)] ${
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
      <div className="flex items-center justify-center h-12 px-1 text-[var(--text-dim)] text-[18px] font-bold">
        —
      </div>
      <div className="h-6" aria-hidden />
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
      className="rounded-2xl border border-[var(--text-primary)] bg-[var(--bg-secondary)] overflow-hidden"
    >
      {/* ── Header — black bar with prefix · title · example ─────── */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-[var(--text-primary)] text-[var(--bg-primary)]">
        <div className="flex items-baseline gap-4 min-w-0">
          <div className="font-mono font-bold text-[18px] tracking-[0.06em] shrink-0">
            {def.prefix}
          </div>
          <div className="h-5 w-px bg-[var(--bg-primary)]/40 shrink-0" aria-hidden />
          <h3 className="text-[15px] font-semibold tracking-tight truncate">
            {def.title.split(" · ")[0]}
          </h3>
        </div>
        <div className="font-mono text-[11.5px] tracking-wider opacity-80 shrink-0">
          {def.example}
        </div>
      </header>

      {/* ── Subtitle ─────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-1 text-[12.5px] text-[var(--text-faint)] leading-relaxed max-w-3xl">
        {def.subtitle}
      </div>

      {/* ── Formula row ──────────────────────────────────────────── */}
      <div className="px-6 pt-4">
        <div className="overflow-x-auto -mx-2 px-2 pb-2">
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

        {/* English-only label strip */}
        <div
          className="mt-4 grid gap-1.5"
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
                className={`px-2 py-2 rounded-md border text-center transition-colors duration-150 ${
                  isActive
                    ? "border-[var(--text-primary)] bg-[var(--bg-surface-active)]"
                    : "border-[var(--border-faint)] bg-[var(--bg-surface-subtle)]"
                } ${isDimmed ? "opacity-50" : ""}`}
              >
                <div className="text-[11px] font-semibold text-[var(--text-primary)] leading-tight">
                  {s.header}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Value tables grid ────────────────────────────────────── */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {def.tables.map((t) => {
            const isActive = effective === t.segmentNumber;
            const isDimmed = effective !== null && !isActive;
            return (
              <div
                key={t.segmentNumber}
                onMouseEnter={() => setHover(t.segmentNumber)}
                onMouseLeave={() => setHover(null)}
                onClick={() => toggle(t.segmentNumber)}
                className={`rounded-xl overflow-hidden border transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? "border-[var(--text-primary)] bg-[var(--bg-surface)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
                } ${isDimmed ? "opacity-50" : ""}`}
              >
                <div
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 ${
                    isActive
                      ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                      : "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
                        : "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                    }`}
                  >
                    {t.segmentNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] truncate">
                      {t.title}
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-[var(--border-faint)]">
                  {t.rows.map((r) => (
                    <div
                      key={r.code}
                      className="grid grid-cols-[68px_1fr]"
                    >
                      <div className="px-3 py-2 text-[12px] font-bold text-[var(--text-primary)] font-mono tracking-wider bg-[var(--bg-surface-subtle)] border-r border-[var(--border-faint)]">
                        {r.code}
                      </div>
                      <div className="px-3 py-2 text-[12px] text-[var(--text-faint)] leading-snug">
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
