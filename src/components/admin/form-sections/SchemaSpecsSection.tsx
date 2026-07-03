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

  /* select — single choice dropdown */
  if (ft === "select") {
    return (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onSet(e.target.value || undefined)}
        className={inputCls}
      >
        <option value="">— Select —</option>
        {(field.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
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

  /* number / unit_number — numeric with unit suffix */
  if (ft === "number" || ft === "unit_number") {
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

  /* text / dimension / url / fallback — single line */
  return (
    <div className="relative">
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onSet(e.target.value || undefined)}
        placeholder={
          ft === "dimension" ? "L × W × H" : field.unit ? `value (${field.unit})` : ""
        }
        className={`${inputCls} ${field.unit && ft !== "dimension" ? "pe-14" : ""}`}
      />
      {field.unit && ft !== "dimension" ? (
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
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-[var(--border-subtle)]">
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
  const setField = (key: string, v: unknown) => {
    const next = { ...values };
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
      delete next[key];
    } else {
      next[key] = v;
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
    <div className="space-y-3">
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
