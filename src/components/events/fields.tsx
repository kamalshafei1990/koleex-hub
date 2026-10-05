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
import DatePicker from "@/components/ui/DatePicker";
import SearchCombobox, { type ComboOption } from "@/components/shipping/SearchCombobox";
import { COUNTRIES } from "@/lib/commercial-policy/countries";
import { getCitiesOfCountrySync, useStateCity } from "@/lib/geo/state-city-lazy";

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

/** ISO instant → the viewer-local date and time parts. */
function isoToLocalParts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

/** Date and time as ONE instant, on the platform's own controls: the brand
 *  DatePicker calendar (not the unthemeable native datetime-local) plus a
 *  small native time input. Clearing the date clears the value. */
export function DateTimeField({
  label,
  value,
  onChange,
  hint,
  wide,
  lang = "en",
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  hint?: string;
  wide?: boolean;
  lang?: string;
}) {
  const parts = isoToLocalParts(value);
  const commit = (date: string, time: string) => {
    if (!date) return onChange(null);
    const d = new Date(`${date}T${time || "00:00"}`);
    onChange(Number.isNaN(d.getTime()) ? null : d.toISOString());
  };
  return (
    <Field label={label} hint={hint} wide={wide}>
      <div className="flex gap-2">
        {/* DatePicker's className lands on its inner button, not the wrapper —
            so the stretch wrapper lives here and the button fills it. */}
        <div className="min-w-0 flex-1">
          <DatePicker
            value={parts.date}
            onChange={(iso) => commit(iso, parts.time)}
            lang={lang}
            floating
            heightCls="h-9"
            className="w-full"
          />
        </div>
        <input
          type="time"
          value={parts.time}
          onChange={(e) => commit(parts.date, e.target.value)}
          disabled={!parts.date}
          aria-label={`${label} — time`}
          /* CONTROL carries w-full — replacing it, not appending, or the two
             widths fight and the date picker collapses to zero. */
          className={`${CONTROL.replace("w-full", "w-24 shrink-0")} disabled:opacity-40`}
        />
      </div>
    </Field>
  );
}

/* ── Country / city pickers ─────────────────────────────────────────────────
   The platform already carries the full data: COUNTRIES (249 entries with
   flag emoji) and the lazy world city dataset behind useStateCity. Both
   render through SearchCombobox — type to filter, flags as leading glyphs,
   cities cascade off the picked country (scopeKey re-browses on change). */

function countryOption(c: (typeof COUNTRIES)[number]): ComboOption<string> {
  return { key: c.code, value: c.name, label: c.name, sublabel: c.region, glyph: c.flag };
}

export function CountryField({
  label,
  value,
  onChange,
  hint,
  wide,
  placeholder,
  searchPlaceholder,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (name: string) => void;
  hint?: string;
  wide?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  const search = (rawTerm: string): Promise<ComboOption<string>[]> => {
    const term = rawTerm.trim().toLowerCase();
    const rows = COUNTRIES.filter(
      (c) => !term || c.name.toLowerCase().includes(term) || c.code.toLowerCase() === term,
    );
    /* Browse (empty term) shows ALL 249 — a capped browse with no hint read
     * as "not all the countries". Typed searches stay capped at 80. */
    return Promise.resolve((term ? rows.slice(0, 80) : rows).map(countryOption));
  };
  const selected = COUNTRIES.find((c) => c.name === value) ?? null;
  return (
    <Field label={label} hint={hint} wide={wide}>
      <SearchCombobox<string>
        value={selected ? countryOption(selected) : null}
        onChange={(o) => onChange(o?.value ?? "")}
        search={search}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={emptyLabel}
        loadingLabel=""
        icon={selected?.flag}
        ariaLabel={label}
        triggerClassName={`${CONTROL} flex items-center justify-between text-start`}
      />
    </Field>
  );
}

export function CityField({
  label,
  value,
  onChange,
  countryCode,
  hint,
  wide,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
}: {
  label: string;
  value: string;
  onChange: (name: string) => void;
  countryCode: string | null;
  hint?: string;
  wide?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  loadingLabel: string;
}) {
  /* The 8 MB world dataset loads lazily, gated on the field being on screen. */
  const ready = useStateCity(!!countryCode);
  const search = (term: string): Promise<ComboOption<string>[]> => {
    if (!countryCode || !ready) return Promise.resolve([]);
    const t = term.trim().toLowerCase();
    const rows = getCitiesOfCountrySync(countryCode)
      .filter((c) => !t || c.name.toLowerCase().includes(t))
      .slice(0, 20);
    return Promise.resolve(
      rows.map((c) => ({ key: c.name, value: c.name, label: c.name })),
    );
  };
  return (
    <Field label={label} hint={hint} wide={wide}>
      <SearchCombobox<string>
        value={value ? { key: value, value, label: value } : null}
        onChange={(o) => onChange(o?.value ?? "")}
        search={search}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={ready ? emptyLabel : loadingLabel}
        loadingLabel={loadingLabel}
        disabled={!countryCode}
        disabledHint={!countryCode ? hint : undefined}
        scopeKey={`${countryCode}:${ready ? 1 : 0}`}
        ariaLabel={label}
        triggerClassName={`${CONTROL} flex items-center justify-between text-start`}
      />
    </Field>
  );
}
