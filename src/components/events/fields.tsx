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
import { useRef, useState } from "react";
import { CARD, SELECTED, SELECTED_CHIP } from "@/components/travel/fields";
import DatePicker from "@/components/ui/DatePicker";
import SearchCombobox, { type ComboOption } from "@/components/shipping/SearchCombobox";
import PopoverPanel from "@/components/kds/PopoverPanel";
import { COUNTRIES } from "@/lib/commercial-policy/countries";
import { getCitiesOfCountrySync, useStateCity } from "@/lib/geo/state-city-lazy";
import ClockIcon from "@/components/icons/ui/ClockIcon";

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

/** A time picker wearing the DatePicker's clothes: same trigger field, a
 *  popover with two scrollable columns (hours, minutes). The native
 *  <input type=time> renders an unthemeable OS popup, which is exactly what
 *  the brand DatePicker exists to replace. */
export function TimePicker({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  /** "HH:mm" or "". */
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [h, m] = value ? value.split(":") : ["", ""];
  const cell = (v: string, selected: boolean) =>
    `h-7 w-full rounded-md text-[12px] tabular-nums transition-colors ${
      selected
        ? "bg-[var(--accent)]/[0.14] font-semibold text-[var(--text-primary)]"
        : "text-[var(--text-secondary)] hover:bg-[var(--bg-inverted)]/[0.06]"
    }`;
  const col = (list: string[], cur: string, set: (v: string) => void) => (
    <div className="max-h-44 flex-1 overflow-y-auto py-1 pe-1">
      {list.map((v) => (
        <button
          key={v}
          type="button"
          tabIndex={-1}
          onClick={() => {
            set(v);
          }}
          className={cell(v, cur === v)}
        >
          {v}
        </button>
      ))}
    </div>
  );

  return (
    <div ref={wrapRef} className="relative w-24 shrink-0">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`${CONTROL} flex items-center justify-between gap-1 px-2.5 disabled:opacity-40 ${
          open ? "border-[var(--border-focus)]" : ""
        }`}
      >
        <span className={value ? "text-[var(--text-primary)]" : "text-[var(--text-ghost)]"}>
          {value || "--:--"}
        </span>
        <ClockIcon size={13} className="shrink-0 text-[var(--text-dim)]" />
      </button>
      {/* Portalled like SearchCombobox's panel: inside the scrollable modal
          body the panel clipped against the footer and painted over the rows
          below; the portal anchors it to the trigger with edge detection. */}
      <PopoverPanel
        anchorRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        scrim={false}
        matchAnchorWidth={false}
        align="start"
        className="w-40"
      >
        <div className="flex p-1">
          {col(
            Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")),
            h,
            (v) => onChange(`${v}:${m || "00"}`),
          )}
          {col(
            Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")),
            m,
            (v) => onChange(`${h || "00"}:${v}`),
          )}
        </div>
      </PopoverPanel>
    </div>
  );
}

/** Date and time as ONE instant, on the platform's own controls: the brand
 *  DatePicker calendar (not the unthemeable native datetime-local) plus a
 *  matching TimePicker. Clearing the date clears the value. */
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
        <TimePicker
          value={parts.time}
          onChange={(time) => commit(parts.date, time)}
          disabled={!parts.date}
          ariaLabel={`${label} — time`}
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
