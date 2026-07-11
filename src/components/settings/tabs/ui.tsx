"use client";

/* Shared iOS-style building blocks for the Settings detail tabs. Monochrome
   per brand; the accent (blue) only marks the selected segment / on-toggle. */

import type { ReactNode } from "react";

export function SettingsCard({ title, subtitle, children }: {
  title: string; subtitle?: string; children: ReactNode;
}) {
  return (
    <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
      <h2 className="text-[14px] font-bold text-[var(--text-primary)]">{title}</h2>
      {subtitle && <p className="text-[12px] text-[var(--text-dim)] mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      <div className="space-y-1">{children}</div>
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

/** iOS-style segmented control. */
export function Segmented<T extends string | number>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-3 h-7 rounded-md text-[12px] font-medium transition-colors ${
              active
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
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

/** iOS-style on/off switch row. */
export function SwitchRow({ label, hint, checked, onChange, last }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${last ? "" : "border-b border-[var(--border-faint)]"}`}>
      <div className="min-w-0">
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
          checked ? "bg-[var(--accent-blue,#0066FF)]" : "bg-[var(--border-color,#6b7280)]"
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
