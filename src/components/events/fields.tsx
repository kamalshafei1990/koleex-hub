"use client";

/* ---------------------------------------------------------------------------
   events/fields — the Events app's field primitives, on the kds in-app form
   shape (the Todo/ProductPicker convention): h-9 controls, 12px text,
   surface fill, focus ring on the focus token, uppercase 10px labels.

   The card/selected recipes stay re-exported from travel/fields (surface
   recipes, identical everywhere) — but the FIELD primitives are this app's
   own: the visa-letter form deliberately uses the taller travel shape, and
   sharing it made every Events form read oversized against the other apps.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import { CARD, SELECTED, SELECTED_CHIP } from "@/components/travel/fields";

export { CARD, SELECTED, SELECTED_CHIP };

const LABEL =
  "block text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)] mb-1.5";
const CONTROL =
  "h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] " +
  "px-3 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] " +
  "outline-none transition-colors focus:border-[var(--border-focus)]";
const CONTROL_AREA = CONTROL.replace("h-9", "min-h-[64px] py-2");

/** Labelled field with a fixed hint slot — a hint appearing never shifts
 *  the rows below it. */
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
      <p className="mt-1 min-h-[0.85rem] text-[10px] leading-[0.85rem] text-[var(--text-dim)]">
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <Field label={label} hint={hint} wide={wide}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={CONTROL}
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
        className={`${CONTROL} cursor-pointer appearance-none`}
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
        className={`${CONTROL_AREA} resize-y`}
      />
    </Field>
  );
}

/** ISO instant → the datetime-local input's value (the viewer's own zone).
 *  An invalid/empty value becomes "" — the field simply shows empty. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** A native datetime-local field bound to an ISO string (or null). */
export function DateTimeField({
  label,
  value,
  onChange,
  hint,
  wide,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <Field label={label} hint={hint} wide={wide}>
      <input
        type="datetime-local"
        value={isoToLocalInput(value)}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return onChange(null);
          const d = new Date(v);
          onChange(Number.isNaN(d.getTime()) ? null : d.toISOString());
        }}
        className={CONTROL}
      />
    </Field>
  );
}
