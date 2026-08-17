"use client";

/* ---------------------------------------------------------------------------
   Small field primitives for the invitation form.

   Plain <input>/<select>/<textarea> on purpose: Aurora's recessed-well
   form-field rules already match every bare field inside a `kx-app` scope, so
   these get the right surface with no per-field styling to drift.

   Every field reserves the space its label, control and hint occupy, so
   showing a hint or an error never shifts the rows below it.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";

/* ── THE CARD RECIPE ──
   `kx-glass` is defined ONLY under [data-kx-skin="aurora"]. On its own it is
   the whole surface in Aurora and NOTHING in Core — which is exactly what the
   owner saw: cards with no ground and no rim, floating on flat black.

   So every card carries BOTH: explicit token surface + rim (which Core paints
   solid, and which `kx-app` remaps to translucent under Aurora), and
   `kx-glass` on top for the blur Aurora adds. One constant, so the two skins
   cannot drift apart card by card. */
export const CARD =
  "kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]";

/* ── SELECTED STATE ──
   Same trap as CARD, but worse: `kx-seg-on` and `kx-chip-on` are also
   Aurora-only, so in Core the chosen Male/Female — and every chosen city —
   looked identical to the unchosen ones. That is not a cosmetic gap, it is
   the control failing to say what it is set to.

   Token surface + rim carries Core; the Aurora class adds its Hub-Blue ring
   on top. `--bg-surface-active` and `--border-strong` are what the other
   converted apps use for an active control, so this matches them. */
export const SELECTED =
  "kx-seg-on border-[var(--border-strong)] bg-[var(--bg-surface-active)] text-[var(--text-highlight)]";

export const SELECTED_CHIP =
  "kx-chip-on border-[var(--border-strong)] bg-[var(--bg-surface-active)] text-[var(--text-highlight)]";

const LABEL = "block text-xs font-medium text-[var(--text-secondary)]";
const CONTROL =
  "mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] " +
  "px-3 py-2 text-sm text-[var(--text-primary)] outline-none";

export function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <span className={LABEL}>{label}</span>
      {children}
      {/* The hint slot is always rendered so a field that gains a hint on
          focus does not push the grid down by a line. */}
      <p className="mt-1 min-h-[1rem] text-[11px] leading-4 text-[var(--text-dim)]">
        {hint ?? ""}
      </p>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  wide,
  uppercase,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  wide?: boolean;
  /** Passport fields are printed in capitals; the letter should match. */
  uppercase?: boolean;
}) {
  return (
    <Field label={label} hint={hint} wide={wide}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
        className={`${CONTROL}${uppercase ? " uppercase" : ""}`}
      />
    </Field>
  );
}

export function DateField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL} tabular-nums`}
      />
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  wide,
}: {
  label: string;
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
  wide?: boolean;
}) {
  return (
    <Field label={label} hint={hint} wide={wide}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={CONTROL}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint} wide>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL} resize-y`}
      />
    </Field>
  );
}

/** A two-way choice rendered as a segmented control (gender, visa type). */
export function SegmentField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="mt-1 flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              value === o.value ? SELECTED : "text-[var(--text-secondary)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

/** Multi-select chips (cities). Free additions are handled by the caller. */
export function ChipsField({
  label,
  selected,
  options,
  onToggle,
  hint,
}: {
  label: string;
  selected: string[];
  options: string[];
  onToggle: (v: string) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint} wide>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                on ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

/** Section wrapper — one glass card per group of fields.
 *
 *  gap-y-4, not gap-y-1. Measured: with a 4 px row gap, the distance from a
 *  field to its OWN hint (mt-1 = 4 px) was identical to the distance from that
 *  hint to the NEXT field — so a hint read as though it belonged to the field
 *  below it. Proximity is the only thing that binds a caption to its control,
 *  so the between-field gap has to be clearly larger than the within-field one. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${CARD} p-4 sm:p-5`}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
