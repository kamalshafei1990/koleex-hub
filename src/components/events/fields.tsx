"use client";

/* ---------------------------------------------------------------------------
   events/fields — the Events app's field primitives.

   REUSE, not duplication: the generic pieces (card recipe, selected-state
   recipe, labelled field, text/select/textarea) live in travel/fields and
   are re-exported here so the Events app never grows a second styling
   dialect. Only the datetime field is new — agenda sessions and event
   windows are instants, so a native datetime-local control is right here
   (unlike the visa letters, where dates on a DOCUMENT are always DMY).
   --------------------------------------------------------------------------- */

export {
  CARD,
  SELECTED,
  SELECTED_CHIP,
  Field,
  TextField,
  SelectField,
  TextAreaField,
} from "@/components/travel/fields";

import { Field } from "@/components/travel/fields";

const CONTROL =
  "mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] " +
  "px-3 py-2 text-sm text-[var(--text-primary)] outline-none tabular-nums";

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
