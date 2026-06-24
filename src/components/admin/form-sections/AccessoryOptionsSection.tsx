"use client";

/* ---------------------------------------------------------------------------
   AccessoryOptionsSection — ST-2 (controlled).

   Shown only for Stand / Table products (subcategory `stands` / `tables`).
   Lets the operator define the configurable option values per axis and the
   price add-on (delta CNY) for each. These ARE the accessory's specs &
   variants. The complete-set configurator later sums: base cost + Σ selected
   deltas → engine price.

   CONTROLLED: the parent (ProductForm) owns the rows and persists them with
   the rest of the product on Save — so options can be entered BEFORE the
   product's first save (no "save first" requirement). Descriptive axes
   (shape/type) carry no price; priced axes show a ¥ delta input.
   --------------------------------------------------------------------------- */

import PlusIcon from "@/components/icons/ui/PlusIcon";

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
  const addValue = (a: Axis) =>
    onChange([...rows, { _k: `${a.key}-${rows.length}-${rows.reduce((n, r) => n + r.value.length, 0)}`, axis: a.key, value: "", price_delta_cny: 0, affects_price: a.priced, is_default: !rows.some((r) => r.axis === a.key) }]);
  const patch = (k: string, p: Partial<AccessoryOptionRow>) => onChange(rows.map((r) => (r._k === k ? { ...r, ...p } : r)));
  const remove = (k: string) => onChange(rows.filter((r) => r._k !== k));
  const setDefault = (axis: string, k: string) => onChange(rows.map((r) => (r.axis === axis ? { ...r, is_default: r._k === k } : r)));

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-[var(--text-dim)]">
        These options are this product&apos;s variants &amp; appear in the <b>complete-set</b> configurator. Priced options add their <b>¥ delta</b> to the base cost; shape/type are descriptive (no price). Saved together with the product.
      </p>

      {axes.map((a) => (
        <div key={a.key} className="rounded-xl border border-[var(--border-subtle)] p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-semibold text-[var(--text-primary)]">{a.label}</span>
            {a.priced
              ? <span className="text-[9px] uppercase tracking-wider text-[var(--accent)]">affects price</span>
              : <span className="text-[9px] uppercase tracking-wider text-[var(--text-ghost)]">descriptive</span>}
            <button type="button" onClick={() => addValue(a)} className="ms-auto inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline">
              <PlusIcon className="h-3 w-3" /> Add value
            </button>
          </div>
          {axisRows(a.key).length === 0 ? (
            <p className="text-[10.5px] text-[var(--text-ghost)]">No values yet.</p>
          ) : (
            <div className="space-y-1.5">
              {axisRows(a.key).map((r) => (
                <div key={r._k} className="flex items-center gap-2">
                  <input className={`${inp} flex-1 min-w-0`} value={r.value} placeholder={a.priced ? "e.g. 75mm / Heavy / Yes" : "e.g. Rectangular"} onChange={(e) => patch(r._k, { value: e.target.value })} />
                  {a.priced && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-[var(--text-dim)]">¥</span>
                      <input className={`${inp} w-[84px]`} inputMode="decimal" value={r.price_delta_cny} onChange={(e) => patch(r._k, { price_delta_cny: Number(e.target.value.replace(/[^0-9.-]/g, "")) || 0 })} />
                    </div>
                  )}
                  <label className="flex items-center gap-1 text-[10.5px] text-[var(--text-dim)] shrink-0" title="Default selection">
                    <input type="radio" checked={r.is_default} onChange={() => setDefault(a.key, r._k)} /> def
                  </label>
                  <button type="button" onClick={() => remove(r._k)} className="text-[var(--text-ghost)] hover:text-[var(--accent)] text-[14px] leading-none px-1 shrink-0">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
