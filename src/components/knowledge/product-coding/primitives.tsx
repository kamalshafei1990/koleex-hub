"use client";

/* ---------------------------------------------------------------------------
   primitives — small, monochrome, reusable building blocks for the
   Product Coding System knowledge document.

   All blocks consume Hub design tokens directly (--bg-*, --text-*,
   --border-*) so they inherit dark / light mode automatically. None of
   these components own state beyond what's needed for their own
   visuals; parent components own interactive state.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";

/* ── CodeSegment ────────────────────────────────────────────────────────
   The boxed value-with-number-bubble. When active OR linked-to-active,
   the box ramps up its contrast and a soft glow appears underneath. */
export function CodeSegment({
  value,
  index,
  empty,
  active,
  linked,
  onEnter,
  onLeave,
  onClick,
}: {
  value: string;
  /** 1-based axis index. */
  index: number;
  empty?: boolean;
  /** True when THIS segment is the one being hovered/clicked. */
  active?: boolean;
  /** True when ANY segment is active and this one isn't (faded). */
  linked?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
}) {
  const dim = !active && linked === true;

  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={onClick}
      className="group flex flex-col items-center gap-2 shrink-0 outline-none"
      aria-pressed={active ? "true" : "false"}
    >
      <div className="relative">
        {/* Soft glow when active */}
        {active && (
          <div
            aria-hidden
            className="absolute inset-0 -m-3 rounded-2xl pointer-events-none"
            style={{
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.18), 0 14px 42px -8px rgba(255,255,255,0.15)",
            }}
          />
        )}
        <div
          className={`relative flex items-center justify-center min-w-[60px] h-12 px-3 rounded-lg border text-[15px] font-bold tracking-wider transition-all duration-300 ${
            empty
              ? "border-dashed border-[var(--border-subtle)] text-[var(--text-dim)]"
              : active
                ? "border-[var(--text-primary)] bg-[var(--bg-surface-active)] text-[var(--text-primary)] scale-[1.04]"
                : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] group-hover:bg-[var(--bg-surface-hover)]"
          } ${dim ? "opacity-45" : "opacity-100"}`}
        >
          {empty ? "□" : value}
        </div>
      </div>
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold leading-none transition-all duration-300 ${
          active
            ? "bg-[var(--text-primary)] text-[var(--bg-primary)] scale-110"
            : "bg-[var(--text-primary)] text-[var(--bg-primary)]"
        } ${dim ? "opacity-45" : "opacity-100"}`}
      >
        {index}
      </div>
    </button>
  );
}

export function CodePrefix({ value }: { value: string }) {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="flex items-center justify-center min-w-[60px] h-12 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[15px] font-bold tracking-wider text-[var(--text-primary)]">
        {value}
      </div>
      <div className="h-5" />
    </div>
  );
}

export function Dash() {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="flex items-center justify-center h-12 px-1 text-[var(--text-dim)] text-[15px] font-bold">
        —
      </div>
      <div className="h-5" />
    </div>
  );
}

/* ── Bilingual column header strip ────────────────────────────────────── */
export function ColumnHeaderRow({
  cells,
  activeIndex,
}: {
  cells: Array<{ label: string; sub?: string; index: number }>;
  activeIndex: number | null;
}) {
  return (
    <div
      className="grid gap-px mt-3"
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((c) => {
        const active = activeIndex === c.index;
        return (
          <div
            key={c.index}
            className={`px-2 py-2 rounded border text-center transition-all duration-300 ${
              active
                ? "border-[var(--text-primary)] bg-[var(--bg-surface-hover)]"
                : "border-[var(--border-faint)] bg-[var(--bg-surface-subtle)]"
            }`}
          >
            <div className="text-[10.5px] font-semibold text-[var(--text-primary)] leading-tight">
              {c.label}
            </div>
            {c.sub && (
              <div className="text-[9.5px] text-[var(--text-faint)] mt-0.5 leading-tight">
                {c.sub}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── ConfigCard — one axis with its allowed values ────────────────────── */
export function ConfigCard({
  segmentNumber,
  title,
  sub,
  rows,
  active,
  faded,
  onEnter,
  onLeave,
}: {
  segmentNumber: number;
  title: string;
  sub?: string;
  rows: Array<{ code: string; meaning: string }>;
  active?: boolean;
  faded?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
}) {
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`rounded-xl border bg-[var(--bg-secondary)] overflow-hidden transition-all duration-300 ${
        active
          ? "border-[var(--text-primary)] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_64px_-16px_rgba(0,0,0,0.5)]"
          : "border-[var(--border-subtle)]"
      } ${faded ? "opacity-40" : "opacity-100"}`}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-faint)]">
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none transition-colors ${
            active
              ? "bg-[var(--text-primary)] text-[var(--bg-primary)] ring-2 ring-[var(--text-primary)]/30"
              : "bg-[var(--text-primary)] text-[var(--bg-primary)]"
          }`}
        >
          {segmentNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)] truncate">
            {title}
          </div>
          {sub && (
            <div className="text-[10px] text-[var(--text-faint)] truncate">
              {sub}
            </div>
          )}
        </div>
      </div>
      <div className="divide-y divide-[var(--border-faint)]">
        {rows.map((r) => (
          <div
            key={r.code}
            className="grid grid-cols-[72px_1fr] gap-3 px-3.5 py-2"
          >
            <div className="text-[12px] font-bold text-[var(--text-primary)] font-mono tracking-wider">
              {r.code}
            </div>
            <div className="text-[12px] text-[var(--text-faint)] leading-snug">
              {r.meaning}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── SystemStatus — terminal-style status pill ────────────────────────── */
export function SystemStatus({
  label,
  value,
  pulse,
}: {
  label: string;
  value: string;
  /** Show a subtle pulsing dot on the left to imply "live". */
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
      <span
        aria-hidden
        className={`relative flex h-1.5 w-1.5 shrink-0 ${
          pulse ? "" : "opacity-50"
        }`}
      >
        {pulse && (
          <span className="absolute inset-0 rounded-full bg-emerald-500/60 animate-ping" />
        )}
        <span
          className={`relative rounded-full h-1.5 w-1.5 ${
            pulse ? "bg-emerald-500" : "bg-[var(--text-dim)]"
          }`}
        />
      </span>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-faint)] leading-tight">
          {label}
        </div>
        <div className="text-[11px] font-semibold text-[var(--text-primary)] leading-tight truncate">
          {value}
        </div>
      </div>
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
