"use client";

/* Shared iOS-style building blocks for the Settings detail tabs. Monochrome
   per brand; the accent (blue) only marks the selected segment / on-toggle.
   Dual-skin: Aurora selection = kx-seg-on (Hub-Blue ring + 10% fill), Core
   keeps the original inverted pill. */

import type { ReactNode } from "react";
import { useSkin } from "@/lib/appearance";

/** The ONE disclosure chevron for the Settings app — the master list, the
 *  admin link rows and the push link all draw this, so they can never drift
 *  apart (they used to mix this glyph with a literal "›" character).
 *
 *  Direction is baked in, because a chevron is a DIRECTION, not decoration:
 *  the default points the way the reader is going and mirrors itself under
 *  RTL (it used to keep pointing right in Arabic, away from the row it
 *  opens); `back` is the return arrow and mirrors the other way. */
export function Chevron({ className = "", back = false }: { className?: string; back?: boolean }) {
  const facing = back ? "rotate-180 rtl:rotate-0" : "rtl:rotate-180";
  return (
    <svg className={`${facing} ${className}`} width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SettingsCard({ title, subtitle, children, flush }: {
  title?: string; subtitle?: string; children: ReactNode; flush?: boolean;
}) {
  return (
    /* kx-glass: detail cards are LEAF tiles — nothing inside a settings tab
       renders a fixed-without-portal child, so they can carry true frost
       (a translucent panel with no blur would show the moving ground
       straight through the text). Core: the solid card is untouched. */
    <section className="kx-glass bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
      {title && <h2 className="text-[14px] font-bold text-[var(--text-primary)]">{title}</h2>}
      {subtitle && <p className="text-[12px] text-[var(--text-dim)] mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && title && <div className="mb-4" />}
      {/* `flush` = list semantics: rows sit edge-to-edge so each row's
          bottom border IS the divider to the next one. The default 4px
          space-y detaches that line from the following row, which reads as
          a floating hairline once rows also have a hover highlight. */}
      <div className={flush ? "" : "space-y-1"}>{children}</div>
    </section>
  );
}

/** A labeled row that hosts a control on the right (segmented / select). */
export function ControlRow({ label, hint, children, last }: {
  label: string; hint?: string; children: ReactNode; last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${last ? "" : "border-b border-[var(--border-faint)]"}`}>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{label}</p>
        {hint && <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** iOS-style segmented control. The shell is PADDED (p-0.5) so the Aurora
 *  seg-on ring renders free of the container edge — a ring inside an
 *  overflow-hidden joined pair clips at the corners (burned on the PD view
 *  toggle; this shell was never joined, so both skins share the markup). */
export function Segmented<T extends string | number>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const aurora = useSkin() === "aurora";
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`px-3 h-7 rounded-md text-[12px] font-medium transition-colors ${
              active
                ? aurora
                  ? "kx-seg-on text-[var(--text-primary)]"
                  : "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** iOS-style on/off switch row. ON = emerald green with a white knob — the
 *  ONE toggle design for the whole system (standing rule): green track when
 *  on, neutral track when off, white circle always. */
export function SwitchRow({ label, hint, checked, onChange, last, icon }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; last?: boolean;
  /** Optional leading glyph (Semantic Icon Registry). */
  icon?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${last ? "" : "border-b border-[var(--border-faint)]"}`}>
      {icon && (
        <span className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{label}</p>
        {hint && <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full shrink-0 transition-colors duration-200 ${
          checked ? "bg-emerald-500" : "bg-[var(--border-color,#6b7280)]"
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

/** Native select styled to match, for longer option lists. */
export function SelectControl<T extends string | number>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        const match = options.find((o) => String(o.value) === raw);
        if (match) onChange(match.value);
      }}
      className="h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
      ))}
    </select>
  );
}
