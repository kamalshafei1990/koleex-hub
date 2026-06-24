"use client";

/* ---------------------------------------------------------------------------
   AccessoryOptionsSection — ST-2 (controlled).

   Shown only for Stand / Table products (subcategory `stands` / `tables`).
   Each axis comes pre-loaded with the standard allowed values as one-click
   preset chips, so the operator picks from a managed list instead of typing
   every value from scratch — and can still add a custom value. Priced axes
   carry a ¥ delta per value; the complete-set configurator later sums:
   base cost + Σ selected deltas → engine price.

   CONTROLLED: the parent (ProductForm) owns the rows and persists them with
   the product on Save (options can be entered before first save).
   --------------------------------------------------------------------------- */

import PlusIcon from "@/components/icons/ui/PlusIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";

type Axis = { key: string; label: string; priced: boolean };

const TABLE_AXES: Axis[] = [
  { key: "shape", label: "Shape", priced: false },
  { key: "type", label: "Type", priced: false },
  { key: "size", label: "Size", priced: true },
  { key: "quality", label: "Quality", priced: true },
];
const STAND_AXES: Axis[] = [
  { key: "type", label: "Type", priced: false },
  { key: "shape", label: "Shape", priced: false },
  { key: "thickness", label: "Thickness", priced: true },
  { key: "lifting", label: "Lifting (height adjustable)", priced: true },
  { key: "wheels", label: "Wheels", priced: true },
  { key: "wheel_size", label: "Wheel size", priced: true },
];

/* Standard allowed values per axis — the managed list shown as preset chips.
   Operators add them in one click and can still type a custom value. */
const PRESETS: Record<"stand" | "table", Record<string, string[]>> = {
  stand: {
    type: ["Standard", "Heavy-duty", "Foldable", "Fixed"],
    shape: ["Rectangular", "Square", "L-shape"],
    thickness: ["Standard", "Thick", "Extra-thick"],
    lifting: ["Fixed height", "Manual adjustable", "Pneumatic / Electric"],
    wheels: ["No wheels", "With wheels", "With brake wheels"],
    wheel_size: ['2"', '3"', '4"', '5"'],
  },
  table: {
    shape: ["Rectangular", "Square", "Round", "L-shape"],
    type: ["Standard", "Oil-pan", "Cabinet", "Open"],
    size: ["1200×600", "1500×700", "1800×800"],
    quality: ["Standard", "Premium"],
  },
};

export interface AccessoryOptionRow {
  _k: string;
  axis: string;
  value: string;
  price_delta_cny: number;
  affects_price: boolean;
  is_default: boolean;
}

export function axesForSubcategory(subcategorySlug?: string | null): Axis[] {
  return subcategorySlug === "tables" ? TABLE_AXES : subcategorySlug === "stands" ? STAND_AXES : [];
}

const inp = "h-8 px-2.5 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";

let _kSeq = 0;
const nextKey = (axis: string) => `${axis}-${Date.now().toString(36)}-${(_kSeq++).toString(36)}`;

export default function AccessoryOptionsSection({
  rows,
  onChange,
  subcategorySlug,
}: {
  rows: AccessoryOptionRow[];
  onChange: (rows: AccessoryOptionRow[]) => void;
  subcategorySlug?: string | null;
}) {
  const kind = subcategorySlug === "tables" ? "table" : subcategorySlug === "stands" ? "stand" : null;
  const axes = axesForSubcategory(subcategorySlug);
  if (!kind) return null;

  const axisRows = (axis: string) => rows.filter((r) => r.axis === axis);
  const patch = (k: string, p: Partial<AccessoryOptionRow>) => onChange(rows.map((r) => (r._k === k ? { ...r, ...p } : r)));
  const remove = (k: string) => onChange(rows.filter((r) => r._k !== k));
  const setDefault = (axis: string, k: string) => onChange(rows.map((r) => (r.axis === axis ? { ...r, is_default: r._k === k } : r)));

  /** Add a value to an axis (preset or blank custom). */
  const addValue = (a: Axis, value = "") =>
    onChange([
      ...rows,
      {
        _k: nextKey(a.key),
        axis: a.key,
        value,
        price_delta_cny: 0,
        affects_price: a.priced,
        is_default: !rows.some((r) => r.axis === a.key),
      },
    ]);

  const norm = (s: string) => s.trim().toLowerCase();

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-[var(--text-dim)]">
        Each axis is pre-loaded with the standard values — click a chip to add it, or add a custom one. These are this product&apos;s variants &amp; appear in the <b>complete-set</b> configurator. Priced options add their <b>¥ delta</b> to the base cost; shape/type are descriptive (no price). Saved with the product.
      </p>

      {axes.map((a) => {
        const used = axisRows(a.key);
        const usedValues = new Set(used.map((r) => norm(r.value)).filter(Boolean));
        const presets = (PRESETS[kind][a.key] || []).filter((p) => !usedValues.has(norm(p)));
        return (
          <div key={a.key} className="rounded-xl border border-[var(--border-subtle)] p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">{a.label}</span>
              {a.priced
                ? <span className="text-[9px] uppercase tracking-wider text-[#0066FF]">affects price</span>
                : <span className="text-[9px] uppercase tracking-wider text-[var(--text-ghost)]">descriptive</span>}
              <button type="button" onClick={() => addValue(a)} className="ms-auto inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <PlusIcon className="h-3 w-3" /> Custom
              </button>
            </div>

            {/* Preset chips — one-click add from the managed list. */}
            {presets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => addValue(a, p)}
                    className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    <PlusIcon className="h-2.5 w-2.5" /> {p}
                  </button>
                ))}
              </div>
            )}

            {/* Selected values. */}
            {used.length === 0 ? (
              <p className="text-[10.5px] text-[var(--text-ghost)]">No values selected — pick from the chips above or add a custom one.</p>
            ) : (
              <div className="space-y-1.5">
                {used.map((r) => (
                  <div key={r._k} className="flex items-center gap-2">
                    <CheckIcon className="h-3 w-3 text-[#00CC66] shrink-0" />
                    <input className={`${inp} flex-1 min-w-0`} value={r.value} placeholder={a.priced ? "e.g. 75mm / Heavy / Yes" : "e.g. Rectangular"} onChange={(e) => patch(r._k, { value: e.target.value })} />
                    {a.priced && (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-[var(--text-dim)]">¥</span>
                        <input className={`${inp} w-[84px]`} inputMode="decimal" value={r.price_delta_cny} onChange={(e) => patch(r._k, { price_delta_cny: Number(e.target.value.replace(/[^0-9.-]/g, "")) || 0 })} />
                      </div>
                    )}
                    <label className="flex items-center gap-1 text-[10.5px] text-[var(--text-dim)] shrink-0 cursor-pointer" title="Default selection in the configurator">
                      <input type="radio" checked={r.is_default} onChange={() => setDefault(a.key, r._k)} /> default
                    </label>
                    <button type="button" onClick={() => remove(r._k)} className="text-[var(--text-ghost)] hover:text-red-400 text-[14px] leading-none px-1 shrink-0" title="Remove">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
