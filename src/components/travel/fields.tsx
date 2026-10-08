"use client";

/* ---------------------------------------------------------------------------
   Small field primitives for the invitation form.

   Plain <input>/<select>/<textarea> on purpose: Aurora's recessed-well
   form-field rules already match every bare field inside a `kx-app` scope, so
   these get the right surface with no per-field styling to drift.

   Every field reserves the space its label, control and hint occupy, so
   showing a hint or an error never shifts the rows below it.
   --------------------------------------------------------------------------- */

import { useRef, useState } from "react";
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

/* ── dates are ALWAYS Day/Month/Year — the owner's standing rule ──
   A native <input type="date"> renders in the BROWSER'S locale: en-US Chrome
   shows mm/dd/yyyy and no attribute can override it, which is exactly what
   the owner saw on six fields. On a visa document 03/12 vs 12/03 is a
   different day, so the visible control is OURS: a dd/mm/yyyy text field.
   State and API stay ISO (yyyy-mm-dd); only the display is day-first. The
   native input survives HIDDEN behind the calendar button, so the picker is
   still one tap away — and whatever it returns is re-displayed as DMY. */

function isoToDmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function dmyToIso(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  /* Reject 31/02 etc. by round-tripping through a real calendar. */
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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
  /* While the user types, `draft` holds their raw text; when they leave the
     field (or a valid date lands), display derives from the ISO value again —
     so autofill from the customer record or a passport scan always shows. */
  const [draft, setDraft] = useState<string | null>(null);
  const nativeRef = useRef<HTMLInputElement>(null);
  const shown = draft ?? isoToDmy(value);

  const commit = (text: string) => {
    setDraft(text);
    const iso = dmyToIso(text);
    if (iso) onChange(iso);
    else if (text.trim() === "") onChange("");
  };

  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          value={shown}
          onChange={(e) => {
            /* Auto-insert the slashes as digits arrive, so typing 12031985
               lands as 12/03/1985 — but never fight a user who is deleting. */
            let t = e.target.value;
            if (t.length > (draft ?? shown).length && /^\d{2}$/.test(t)) t += "/";
            else if (t.length > (draft ?? shown).length && /^\d{2}\/\d{2}$/.test(t)) t += "/";
            commit(t);
          }}
          onBlur={() => setDraft(null)}
          className={`${CONTROL} pe-10 tabular-nums`}
        />
        <button
          type="button"
          aria-label={`${label} — open calendar`}
          onClick={() => {
            const el = nativeRef.current;
            if (!el) return;
            try {
              el.showPicker();
            } catch {
              el.focus();
              el.click();
            }
          }}
          className="absolute inset-y-0 end-2 my-auto flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)]"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
            <path d="M3.5 9.5h17M8 3v4M16 3v4" />
          </svg>
        </button>
        {/* The native input, hidden but functional: it powers the picker and
            nothing else. Its locale-formatted text is never visible. */}
        <input
          ref={nativeRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          onChange={(e) => {
            setDraft(null);
            onChange(e.target.value);
          }}
          className="pointer-events-none absolute bottom-0 end-2 h-0 w-0 opacity-0"
        />
      </div>
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
  /** value = the canonical (stored/printed) name; label = the display name
   *  in the active language — dropdown/chip contents are translated, the
   *  owner's standing rule. */
  options: { value: string; label: string }[];
  onToggle: (v: string) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint} wide>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                on ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
              }`}
            >
              {o.label}
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
