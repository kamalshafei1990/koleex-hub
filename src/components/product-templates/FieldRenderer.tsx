"use client";

/* ---------------------------------------------------------------------------
   FieldRenderer — switches on field.field_type to render the right input.

   Phase 1 foundation. Each branch is intentionally simple (native HTML
   inputs styled with Tailwind) — the goal is to prove the template
   engine end-to-end, not to ship a polished design-system. Future phases
   can swap individual branches for richer components without touching
   the engine plumbing.

   value/onChange is the universal contract: the parent owns state keyed
   by field.field_key. value can be any JSON-serializable shape; each
   field_type knows what to expect.
   --------------------------------------------------------------------------- */

import { useId } from "react";
import {
  getFieldOptions,
  getRepeaterSchema,
  type ProductTemplateField,
  type RepeaterItemSchema,
} from "@/lib/product-templates/types";

interface Props {
  field: ProductTemplateField;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}

export default function FieldRenderer({ field, value, onChange, disabled }: Props) {
  const id = useId();
  const labelEl = (
    <label
      htmlFor={id}
      className="block text-[12px] font-semibold text-black/75 dark:text-white/80 mb-1.5"
    >
      {field.field_label}
      {field.is_required && (
        <span className="ml-1 text-red-500" aria-label="required">
          *
        </span>
      )}
      {field.unit && (
        <span className="ml-1 text-[10.5px] font-normal text-black/40 dark:text-white/40">
          ({field.unit})
        </span>
      )}
    </label>
  );
  const helpEl = field.help_text ? (
    <p className="mt-1 text-[10.5px] text-black/45 dark:text-white/40">
      {field.help_text}
    </p>
  ) : null;

  /* Reusable Tailwind input style — kept inline so a future variant
     swap stays localized. */
  const inputCls =
    "w-full h-9 px-3 rounded-lg border text-[12.5px] outline-none transition-colors " +
    "bg-white dark:bg-white/[0.04] " +
    "border-black/10 dark:border-white/[0.08] " +
    "text-black dark:text-white " +
    "placeholder:text-black/35 dark:placeholder:text-white/30 " +
    "focus:border-black/30 dark:focus:border-white/30 " +
    "disabled:opacity-50";

  /* --------- branches by field_type --------- */
  switch (field.field_type) {
    case "text":
      return (
        <div>
          {labelEl}
          <input
            id={id}
            type="text"
            className={inputCls}
            value={typeof value === "string" ? value : ""}
            placeholder={field.placeholder ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
          />
          {helpEl}
        </div>
      );

    case "rich_text":
      /* Phase 1: textarea. Phase 2 can replace with a real rich editor. */
      return (
        <div>
          {labelEl}
          <textarea
            id={id}
            className={`${inputCls} h-24 py-2 leading-snug resize-y`}
            value={typeof value === "string" ? value : ""}
            placeholder={field.placeholder ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
          />
          {helpEl}
        </div>
      );

    case "number":
    case "measurement":
      return (
        <div>
          {labelEl}
          <div className="relative">
            <input
              id={id}
              type="number"
              className={inputCls + (field.unit ? " pr-12" : "")}
              value={
                typeof value === "number"
                  ? value
                  : typeof value === "string" && value
                    ? value
                    : ""
              }
              placeholder={field.placeholder ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") return onChange(null);
                const n = Number(raw);
                onChange(Number.isFinite(n) ? n : null);
              }}
              disabled={disabled}
            />
            {field.unit && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10.5px] font-medium text-black/40 dark:text-white/40">
                {field.unit}
              </span>
            )}
          </div>
          {helpEl}
        </div>
      );

    case "boolean":
      return (
        <div>
          {labelEl}
          <button
            type="button"
            role="switch"
            aria-checked={value === true}
            disabled={disabled}
            onClick={() => onChange(value === true ? false : true)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value === true
                ? "bg-emerald-500"
                : "bg-black/10 dark:bg-white/[0.12]"
            } disabled:opacity-50`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                value === true ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          {helpEl}
        </div>
      );

    case "select": {
      const options = getFieldOptions(field);
      return (
        <div>
          {labelEl}
          <select
            id={id}
            className={inputCls}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
          >
            <option value="">{field.placeholder ?? "Select…"}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {helpEl}
        </div>
      );
    }

    case "multi_select": {
      const options = getFieldOptions(field);
      const selected = new Set<string>(
        Array.isArray(value) ? (value as string[]).filter((v) => typeof v === "string") : [],
      );
      function toggle(v: string) {
        const next = new Set(selected);
        if (next.has(v)) next.delete(v);
        else next.add(v);
        onChange(next.size === 0 ? null : Array.from(next));
      }
      return (
        <div>
          {labelEl}
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const active = selected.has(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(o.value)}
                  className={`px-2.5 h-7 rounded-full border text-[11.5px] font-medium transition-colors ${
                    active
                      ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                      : "bg-white dark:bg-white/[0.04] border-black/10 dark:border-white/[0.08] text-black/70 dark:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
                  } disabled:opacity-50`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {helpEl}
        </div>
      );
    }

    case "icon_select":
    case "image_select":
    case "color_select": {
      /* All three are pick-one visual selectors. Phase 1 renders them as
         tiles with a marker for the chosen swatch — the data shape is
         the same as `select` (string value). */
      const options = getFieldOptions(field);
      const current = typeof value === "string" ? value : "";
      return (
        <div>
          {labelEl}
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {options.map((o) => {
              const active = current === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(active ? null : o.value)}
                  className={`h-16 rounded-lg border flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-all ${
                    active
                      ? "border-black ring-1 ring-black dark:border-white dark:ring-white"
                      : "border-black/10 dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  } disabled:opacity-50`}
                  title={o.label}
                >
                  {field.field_type === "color_select" ? (
                    <span
                      className="block w-6 h-6 rounded-full border border-black/10"
                      style={{ backgroundColor: o.color ?? o.value }}
                    />
                  ) : field.field_type === "image_select" && o.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={o.image} alt={o.label} className="w-8 h-8 object-cover rounded" />
                  ) : (
                    <span className="text-[15px]">{o.icon ?? "•"}</span>
                  )}
                  <span className="truncate w-full text-center text-black/70 dark:text-white/65">
                    {o.label}
                  </span>
                </button>
              );
            })}
          </div>
          {helpEl}
        </div>
      );
    }

    case "media":
    case "file": {
      /* Phase 1: store the URL as a string. A future phase wires the
         existing /api/uploads → storage pipeline so the field becomes
         a full upload dropzone. */
      return (
        <div>
          {labelEl}
          <input
            id={id}
            type="url"
            className={inputCls}
            value={typeof value === "string" ? value : ""}
            placeholder={
              field.placeholder ??
              (field.field_type === "media" ? "https://…image-or-video" : "https://…file")
            }
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
          />
          <p className="mt-1 text-[10.5px] text-black/40 dark:text-white/35">
            Phase 1: paste a URL. Upload UI lands in Phase 2.
          </p>
          {helpEl}
        </div>
      );
    }

    case "repeater": {
      const schema = getRepeaterSchema(field);
      const rows: Array<Record<string, unknown>> = Array.isArray(value)
        ? (value as Array<Record<string, unknown>>)
        : [];
      function update(rowIdx: number, key: string, v: unknown) {
        const next = rows.map((r, i) => (i === rowIdx ? { ...r, [key]: v } : r));
        onChange(next);
      }
      function addRow() {
        onChange([...rows, {}]);
      }
      function removeRow(idx: number) {
        const next = rows.filter((_, i) => i !== idx);
        onChange(next.length === 0 ? null : next);
      }
      return (
        <div>
          {labelEl}
          <div className="rounded-lg border border-black/[0.08] dark:border-white/[0.08] divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {rows.length === 0 && (
              <div className="px-3 py-4 text-[11.5px] text-black/40 dark:text-white/40">
                No rows yet — click "Add row" below.
              </div>
            )}
            {rows.map((row, idx) => (
              <RepeaterRow
                key={idx}
                schema={schema}
                row={row}
                disabled={disabled}
                onChange={(key, v) => update(idx, key, v)}
                onRemove={() => removeRow(idx)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addRow}
            disabled={disabled}
            className="mt-2 px-3 h-8 rounded-md border border-black/10 dark:border-white/[0.08] text-[11.5px] font-semibold text-black/70 dark:text-white/75 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] disabled:opacity-50"
          >
            + Add row
          </button>
          {helpEl}
        </div>
      );
    }

    case "feature_cards": {
      /* Same shape as `repeater` but laid out as cards. Phase 1 reuses
         the repeater UI to avoid duplication — phase 2 can drop a
         dedicated card layout in here. */
      const schema = getRepeaterSchema(field);
      const rows: Array<Record<string, unknown>> = Array.isArray(value)
        ? (value as Array<Record<string, unknown>>)
        : [];
      function update(rowIdx: number, key: string, v: unknown) {
        const next = rows.map((r, i) => (i === rowIdx ? { ...r, [key]: v } : r));
        onChange(next);
      }
      function addRow() {
        onChange([...rows, {}]);
      }
      function removeRow(idx: number) {
        const next = rows.filter((_, i) => i !== idx);
        onChange(next.length === 0 ? null : next);
      }
      return (
        <div>
          {labelEl}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rows.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed border-black/[0.12] dark:border-white/[0.12] px-3 py-6 text-[11.5px] text-black/40 dark:text-white/40 text-center">
                No cards yet.
              </div>
            )}
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-black/[0.08] dark:border-white/[0.08] p-3 space-y-2"
              >
                {schema.map((s) => (
                  <RepeaterCell
                    key={s.key}
                    schema={s}
                    value={row[s.key]}
                    disabled={disabled}
                    onChange={(v) => update(idx, s.key, v)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  disabled={disabled}
                  className="text-[11px] text-red-500 hover:text-red-600 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addRow}
            disabled={disabled}
            className="mt-2 px-3 h-8 rounded-md border border-black/10 dark:border-white/[0.08] text-[11.5px] font-semibold text-black/70 dark:text-white/75 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] disabled:opacity-50"
          >
            + Add card
          </button>
          {helpEl}
        </div>
      );
    }

    default:
      /* Defensive fallback — TypeScript will catch missing branches at
         compile time, but if a future migration introduces a new type
         before this file is updated, fail gracefully. */
      return (
        <div className="text-[11.5px] text-red-500">
          Unsupported field type: {String(field.field_type)}
        </div>
      );
  }
}

/* ── Repeater helpers ─────────────────────────────────────────────────── */

function RepeaterRow({
  schema,
  row,
  onChange,
  onRemove,
  disabled,
}: {
  schema: RepeaterItemSchema[];
  row: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="px-3 py-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${schema.length + 1}, minmax(0, 1fr))` }}>
      {schema.map((s) => (
        <RepeaterCell
          key={s.key}
          schema={s}
          value={row[s.key]}
          disabled={disabled}
          onChange={(v) => onChange(s.key, v)}
        />
      ))}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="self-center justify-self-end text-[11px] text-red-500 hover:text-red-600 disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}

function RepeaterCell({
  schema,
  value,
  onChange,
  disabled,
}: {
  schema: RepeaterItemSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const cellCls =
    "w-full h-8 px-2 rounded-md border text-[12px] outline-none " +
    "bg-white dark:bg-white/[0.04] " +
    "border-black/10 dark:border-white/[0.08] " +
    "text-black dark:text-white " +
    "placeholder:text-black/35 dark:placeholder:text-white/30 " +
    "disabled:opacity-50";

  if (schema.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-[11.5px] text-black/70 dark:text-white/70">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        {schema.label}
      </label>
    );
  }
  if (schema.type === "number") {
    return (
      <input
        type="number"
        className={cellCls}
        placeholder={schema.label}
        value={typeof value === "number" ? value : typeof value === "string" ? value : ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(null);
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : null);
        }}
        disabled={disabled}
      />
    );
  }
  return (
    <input
      type="text"
      className={cellCls}
      placeholder={schema.label}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
    />
  );
}
