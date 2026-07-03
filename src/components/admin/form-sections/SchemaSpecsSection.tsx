"use client";

/* ---------------------------------------------------------------------------
   SchemaSpecsSection — the schema-driven specs editor.

   Renders a resolved ProductSchemaDefinition as grouped, collapsible cards of
   typed inputs and writes a flat Record<string, unknown> into the product's
   schema_specs JSONB. This is the canonical surface that fills the data
   powering the public product page, quotes, brochures, and the AI layer —
   every field carries its own visibility flags so the same value lands on the
   right surfaces automatically.

   Pure presentation + local input logic: no Supabase, no fetch. The parent
   owns the values object and persistence.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import type {
  ProductSchemaDefinition,
  SpecField,
  SpecGroup,
} from "@/types/product-schema";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";

interface Props {
  schema: ProductSchemaDefinition | null;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** Hide the "{name} — structured specs" intro + required-progress header.
   *  Used when a single schema group is rendered under another tab (e.g. the
   *  Packing & Shipping group on the Logistics tab) where that intro — which
   *  talks about the public product page — is out of context. */
  hideHeader?: boolean;
}

/* ── value helpers ─────────────────────────────────────────────── */

const isFilled = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "boolean") return true; // an explicit true/false is a decision
  return true;
};

const asStringArray = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.map((x) => String(x)) : [];

/* ── computed fields ───────────────────────────────────────────────
   Derive one field's value from another (e.g. CBM from packing L×W×H). */

/* Parse an "L×W×H" string in mm (any separator: × x * , space) → m³, or null
   when fewer than three positive numbers are present. Rounded to 3 dp. */
const cbmFromMmDimensions = (raw: unknown): number | null => {
  if (typeof raw !== "string") return null;
  const nums = (raw.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0);
  if (nums.length < 3) return null;
  const [l, w, h] = nums;
  const cbm = (l * w * h) / 1_000_000_000;
  if (!Number.isFinite(cbm) || cbm <= 0) return null;
  return Math.round(cbm * 1000) / 1000;
};

const computeDerivedValue = (
  formula: NonNullable<SpecField["computed"]>["formula"],
  sourceRaw: unknown,
): number | null => {
  switch (formula) {
    case "cbm_m3_from_mm_dimensions":
      return cbmFromMmDimensions(sourceRaw);
    default:
      return null;
  }
};

/* Required-completeness counts a required boolean as "answered" only when the
   operator has explicitly toggled it (true OR false), never when undefined. */
const requiredFilled = (f: SpecField, v: unknown): boolean => {
  if (f.fieldType === "boolean") return v === true || v === false;
  return isFilled(v);
};

/* ── visibility chips ──────────────────────────────────────────── */

const VisBadge = ({ label, tone }: { label: string; tone: "public" | "internal" | "ai" }) => {
  const cls =
    tone === "public"
      ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-300"
      : tone === "ai"
        ? "border-[var(--border-subtle)] text-[var(--text-secondary)]"
        : "border-amber-500/40 text-amber-600 dark:text-amber-300";
  return (
    <span
      className={`text-[8.5px] font-bold uppercase tracking-[0.12em] px-1.5 py-px rounded-full border ${cls}`}
    >
      {label}
    </span>
  );
};

const FieldBadges = ({ f }: { f: SpecField }) => (
  <span className="inline-flex items-center gap-1">
    {f.internalOnly ? (
      <VisBadge label="Internal" tone="internal" />
    ) : f.publicVisible ? (
      <VisBadge label="Public" tone="public" />
    ) : null}
    {f.aiReadable ? <VisBadge label="AI" tone="ai" /> : null}
  </span>
);

/* ── the per-field input ───────────────────────────────────────── */

const inputCls =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] transition-colors";

/* Numeric field with a suggested-value dropdown that shows the unit inside each
   row (e.g. "1900 mm"). Free-type is always allowed — the dropdown only offers
   common values and filters as you type; picking one fills the field. */
function SuggestNumberInput({
  field,
  value,
  onSet,
}: {
  field: SpecField;
  value: unknown;
  onSet: (v: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const strVal = value === null || value === undefined ? "" : String(value);
  const all = field.suggestions ?? [];
  const q = strVal.trim();
  const filtered = q === "" ? all : all.filter((s) => String(s).startsWith(q));
  const show = filtered.length ? filtered : all;
  return (
    <div className="relative">
      <input
        type="number"
        value={strVal}
        onChange={(e) => onSet(e.target.value === "" ? undefined : Number(e.target.value))}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="0"
        className={`${inputCls} pe-[4.75rem]`}
      />
      {field.unit ? (
        <span className="absolute end-9 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[var(--text-ghost)] pointer-events-none">
          {field.unit}
        </span>
      ) : null}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show suggestions"
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="absolute end-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-ghost)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
      >
        <AngleDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && show.length ? (
        <div className="absolute z-30 mt-1 left-0 right-0 max-h-52 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-1 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
          {show.map((s) => {
            const active = String(s) === strVal;
            return (
              <button
                key={String(s)}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSet(Number(s)); setOpen(false); }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-start text-[13px] transition-colors hover:bg-[var(--bg-surface-hover)] ${
                  active ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <span>{String(s)}</span>
                {field.unit ? <span className="text-[11px] text-[var(--text-ghost)]">{field.unit}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* Custom single-choice dropdown — same styling grammar as SuggestNumberInput
   (styled trigger + panel) so every dropdown in the specs editor looks the
   same, instead of the browser's native <select>. Closed set: no free typing. */
function SelectDropdown({
  field,
  value,
  onSet,
}: {
  field: SpecField;
  value: unknown;
  onSet: (v: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const opts = field.options ?? [];
  const selected = opts.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className={`${inputCls} flex items-center justify-between gap-2 text-start`}
      >
        <span className={`truncate ${selected ? "" : "text-[var(--text-ghost)]"}`}>
          {selected ? selected.label : "— Select —"}
        </span>
        <AngleDownIcon className={`h-3.5 w-3.5 shrink-0 text-[var(--text-ghost)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 left-0 right-0 max-h-60 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-1 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onSet(undefined); setOpen(false); }}
            className="flex w-full items-center px-3 py-1.5 text-start text-[13px] text-[var(--text-ghost)] transition-colors hover:bg-[var(--bg-surface-hover)]"
          >
            — Select —
          </button>
          {opts.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSet(o.value); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start text-[13px] transition-colors hover:bg-[var(--bg-surface-hover)] ${
                  active ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {active ? <CheckIcon className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onSet,
}: {
  field: SpecField;
  value: unknown;
  onSet: (v: unknown) => void;
}) {
  const ft = field.fieldType;

  /* boolean — tri-state segmented (Yes / No / —) */
  if (ft === "boolean") {
    const opts: { label: string; val: boolean | undefined }[] = [
      { label: "Yes", val: true },
      { label: "No", val: false },
      { label: "—", val: undefined },
    ];
    return (
      <div className="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
        {opts.map((o) => {
          const active = value === o.val || (o.val === undefined && value === undefined);
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => onSet(o.val)}
              className={`h-9 px-3 text-[12px] font-semibold transition-colors ${
                active
                  ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                  : "bg-[var(--bg-surface-subtle)]/60 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  /* select — single choice dropdown (custom, styled to match the editor) */
  if (ft === "select") {
    return <SelectDropdown field={field} value={value} onSet={onSet} />;
  }

  /* multi-choice — chips toggled on/off */
  if (ft === "multi_select" || ft === "chips" || ft === "icon_chips" || ft === "image_chips") {
    const selected = asStringArray(value);
    const toggle = (v: string) => {
      const next = selected.includes(v)
        ? selected.filter((x) => x !== v)
        : [...selected, v];
      onSet(next.length ? next : undefined);
    };
    return (
      <div className="flex flex-wrap gap-1.5">
        {(field.options ?? []).map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-full border text-[12px] font-medium transition-colors ${
                on
                  ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/60 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
              }`}
            >
              {on ? <CheckIcon className="h-3 w-3" /> : null}
              {o.label}
            </button>
          );
        })}
        {(field.options ?? []).length === 0 ? (
          <span className="text-[11px] text-[var(--text-faint)]">No options defined.</span>
        ) : null}
      </div>
    );
  }

  /* number / unit_number — numeric with unit suffix. When `suggestions` are
     present, render the combobox (dropdown of common values, still free-type). */
  if (ft === "number" || ft === "unit_number") {
    if (field.suggestions?.length) {
      return <SuggestNumberInput field={field} value={value} onSet={onSet} />;
    }
    return (
      <div className="relative">
        <input
          type="number"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            onSet(raw === "" ? undefined : Number(raw));
          }}
          placeholder="0"
          className={`${inputCls} ${field.unit ? "pe-14" : ""}`}
        />
        {field.unit ? (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[var(--text-ghost)] pointer-events-none">
            {field.unit}
          </span>
        ) : null}
      </div>
    );
  }

  /* range — two numbers composed into "min–max" (+ unit) */
  if (ft === "range") {
    const parts = typeof value === "string" ? value.split("–") : ["", ""];
    const min = parts[0] ?? "";
    const max = parts[1] ?? "";
    const compose = (lo: string, hi: string) => {
      if (!lo && !hi) return undefined;
      return `${lo}–${hi}`;
    };
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={min}
          onChange={(e) => onSet(compose(e.target.value, max))}
          placeholder="min"
          className={`${inputCls} w-24`}
        />
        <span className="text-[var(--text-ghost)]">–</span>
        <input
          type="number"
          value={max}
          onChange={(e) => onSet(compose(min, e.target.value))}
          placeholder="max"
          className={`${inputCls} w-24`}
        />
        {field.unit ? (
          <span className="text-[11px] text-[var(--text-ghost)]">{field.unit}</span>
        ) : null}
      </div>
    );
  }

  /* dimension — three numbers (L × W × H) composed into an "L×W×H" string
     (+ unit). Any separator is accepted on read so legacy free-text values
     still populate the three boxes. */
  if (ft === "dimension") {
    const parts = typeof value === "string" ? value.split(/[×xX*,]/).map((s) => s.trim()) : [];
    const [l, w, h] = [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
    const compose = (a: string, b: string, c: string) =>
      !a && !b && !c ? undefined : `${a}×${b}×${c}`;
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={l}
          onChange={(e) => onSet(compose(e.target.value, w, h))}
          placeholder="L"
          className={`${inputCls} min-w-0 flex-1`}
        />
        <span className="text-[var(--text-ghost)] shrink-0">×</span>
        <input
          type="number"
          value={w}
          onChange={(e) => onSet(compose(l, e.target.value, h))}
          placeholder="W"
          className={`${inputCls} min-w-0 flex-1`}
        />
        <span className="text-[var(--text-ghost)] shrink-0">×</span>
        <input
          type="number"
          value={h}
          onChange={(e) => onSet(compose(l, w, e.target.value))}
          placeholder="H"
          className={`${inputCls} min-w-0 flex-1`}
        />
        {field.unit ? (
          <span className="text-[11px] font-medium text-[var(--text-ghost)] shrink-0">{field.unit}</span>
        ) : null}
      </div>
    );
  }

  /* long_text — textarea */
  if (ft === "long_text" || ft === "rich_text") {
    return (
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onSet(e.target.value || undefined)}
        rows={3}
        className={`${inputCls} h-auto py-2 resize-y`}
      />
    );
  }

  /* text / url / fallback — single line (+ optional suggestions datalist) */
  const textDlId = field.suggestions?.length ? `dl-${field.key}` : undefined;
  return (
    <div className="relative">
      <input
        type="text"
        list={textDlId}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onSet(e.target.value || undefined)}
        placeholder={field.unit ? `value (${field.unit})` : ""}
        className={`${inputCls} ${field.unit ? "pe-14" : ""}`}
      />
      {textDlId ? (
        <datalist id={textDlId}>
          {field.suggestions!.map((s) => <option key={String(s)} value={String(s)} />)}
        </datalist>
      ) : null}
      {field.unit ? (
        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[var(--text-ghost)] pointer-events-none">
          {field.unit}
        </span>
      ) : null}
    </div>
  );
}

/* ── group card ────────────────────────────────────────────────── */

function GroupCard({
  group,
  values,
  setField,
}: {
  group: SpecGroup;
  values: Record<string, unknown>;
  setField: (key: string, v: unknown) => void;
}) {
  const [open, setOpen] = useState(true);

  const fields = useMemo(
    () => [...group.fields].sort((a, b) => a.order - b.order),
    [group.fields],
  );
  const filled = fields.filter((f) => isFilled(values[f.key])).length;
  const total = fields.length;
  const pct = total ? Math.round((filled / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-surface-hover)] transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
            {group.title}
          </span>
          <span className="text-[10px] font-mono text-[var(--text-ghost)] shrink-0">
            {filled}/{total}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block w-20 h-1.5 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--text-primary)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <AngleDownIcon
            className={`h-4 w-4 text-[var(--text-ghost)] transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open ? (
        <div className="px-4 pb-4 pt-4 space-y-5 border-t border-[var(--border-subtle)]">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] inline-flex items-center gap-1.5">
                  {f.label}
                  {f.required ? <span className="text-red-500">*</span> : null}
                </label>
                <FieldBadges f={f} />
              </div>
              <FieldInput
                field={f}
                value={values[f.key]}
                onSet={(v) => setField(f.key, v)}
              />
              {f.computed ? (
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed inline-flex items-center gap-1">
                  <span aria-hidden>↻</span> Auto-fills from{" "}
                  {group.fields.find((x) => x.key === f.computed!.from)?.label ?? "the linked field"} — you can also type it manually.
                </p>
              ) : null}
              {f.description ? (
                <p className="text-[10px] text-[var(--text-ghost)] leading-relaxed">
                  {f.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── main editor ───────────────────────────────────────────────── */

export default function SchemaSpecsSection({ schema, values, onChange, hideHeader }: Props) {
  /* source field key → the computed fields that derive from it. Lets a single
     edit (e.g. Packing Dimensions) recompute its dependants (e.g. CBM). */
  const derivedBySource = useMemo(() => {
    const map: Record<string, { target: string; formula: NonNullable<SpecField["computed"]>["formula"] }[]> = {};
    for (const g of schema?.groups ?? []) {
      for (const f of g.fields) {
        if (f.computed) (map[f.computed.from] ??= []).push({ target: f.key, formula: f.computed.formula });
      }
    }
    return map;
  }, [schema]);

  const setField = (key: string, v: unknown) => {
    const next = { ...values };
    const setOne = (k: string, val: unknown) => {
      if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
        delete next[k];
      } else {
        next[k] = val;
      }
    };
    setOne(key, v);
    // Recompute any fields derived from the one just edited.
    for (const d of derivedBySource[key] ?? []) {
      setOne(d.target, computeDerivedValue(d.formula, next[key]));
    }
    onChange(next);
  };

  const groups = useMemo(
    () => (schema ? [...schema.groups].sort((a, b) => a.order - b.order) : []),
    [schema],
  );

  const { reqTotal, reqFilled } = useMemo(() => {
    let t = 0;
    let f = 0;
    for (const g of groups) {
      for (const fl of g.fields) {
        if (fl.required) {
          t += 1;
          if (requiredFilled(fl, values[fl.key])) f += 1;
        }
      }
    }
    return { reqTotal: t, reqFilled: f };
  }, [groups, values]);

  if (!schema) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-5">
        <p className="text-[12px] text-[var(--text-secondary)]">
          No structured schema is registered for this classification yet. Pick a
          subcategory with a published schema (e.g. Lockstitch Machines) to edit
          its specs here. Until then, use the free-form fields below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header — what this is + required progress */}
      {!hideHeader ? (
        <div className="flex items-start justify-between gap-3 flex-wrap rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">
              {schema.name} — structured specs
            </p>
            <p className="text-[10px] text-[var(--text-ghost)] mt-0.5 leading-relaxed max-w-xl">
              These power the public product page, quotations, brochures, and the AI
              layer. Each field shows where it appears (Public / Internal / AI).
              Choices over free text wherever possible.
            </p>
          </div>
          {reqTotal > 0 ? (
            <div className="text-right shrink-0">
              <div className="text-[18px] font-bold font-mono text-[var(--text-primary)]">
                {reqFilled}/{reqTotal}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-[var(--text-ghost)]">
                Required
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {groups.map((g) => (
        <GroupCard key={g.id} group={g} values={values} setField={setField} />
      ))}
    </div>
  );
}
