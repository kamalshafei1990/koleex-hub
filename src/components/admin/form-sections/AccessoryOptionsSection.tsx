"use client";

/* ---------------------------------------------------------------------------
   AccessoryOptionsSection — ST-2.

   Shown only for Stand / Table products (subcategory `stands` / `tables`).
   Lets the operator define the configurable option values per axis and the
   price add-on (delta CNY) for each. The complete-set configurator later sums:
   base cost + Σ selected deltas → engine price.

   Self-persisting: loads + saves via /api/products/[id]/options (needs a saved
   product). Descriptive axes (shape/type) carry no price; priced axes show a
   ¥ delta input.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

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

interface Row { _k: string; axis: string; value: string; price_delta_cny: number; affects_price: boolean; is_default: boolean; }

const inp = "h-8 px-2.5 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";

export default function AccessoryOptionsSection({ productId, subcategorySlug }: { productId?: string | null; subcategorySlug?: string | null }) {
  const kind = subcategorySlug === "tables" ? "table" : subcategorySlug === "stands" ? "stand" : null;
  const axes = kind === "table" ? TABLE_AXES : kind === "stand" ? STAND_AXES : [];

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/products/${productId}/options`, { credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as { options?: Array<Omit<Row, "_k">> };
      setRows((j.options ?? []).map((o, i) => ({ ...o, _k: `${o.axis}-${i}-${Math.round(o.price_delta_cny)}` })));
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [productId]);
  useEffect(() => { load(); }, [load]);

  if (!kind) return null;

  if (!productId) {
    return (
      <p className="text-[12px] text-[var(--text-dim)]">
        Save the product first, then come back here to add its configurable options (size, quality, wheels…) and their price add-ons.
      </p>
    );
  }

  const axisRows = (axis: string) => rows.filter((r) => r.axis === axis);
  const addValue = (a: Axis) =>
    setRows((p) => [...p, { _k: `${a.key}-${p.length}-${Date.now() % 100000}`, axis: a.key, value: "", price_delta_cny: 0, affects_price: a.priced, is_default: !p.some((r) => r.axis === a.key) }]);
  const patch = (k: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r._k === k ? { ...r, ...p } : r)));
  const remove = (k: string) => setRows((rs) => rs.filter((r) => r._k !== k));
  const setDefault = (axis: string, k: string) => setRows((rs) => rs.map((r) => (r.axis === axis ? { ...r, is_default: r._k === k } : r)));

  async function save() {
    if (!productId) return;
    setSaving(true); setSavedMsg(null);
    try {
      const payload = rows.filter((r) => r.value.trim()).map((r, i) => ({ axis: r.axis, value: r.value.trim(), price_delta_cny: r.affects_price ? r.price_delta_cny : 0, affects_price: r.affects_price, is_default: r.is_default, sort_order: i }));
      const r = await fetch(`/api/products/${productId}/options`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ options: payload }) });
      const j = await r.json().catch(() => ({}));
      setSavedMsg(r.ok ? `Saved ${j.count} option${j.count === 1 ? "" : "s"}` : (j.error || "Save failed"));
      if (r.ok) await load();
    } catch { setSavedMsg("Network error"); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-[var(--text-dim)]">
        These options appear in the <b>complete-set</b> configurator. Priced options add their <b>¥ delta</b> to the base cost; shape/type are descriptive (no price).
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

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving || loading}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-medium disabled:opacity-50">
          {saving ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : null} Save options
        </button>
        {savedMsg && <span className="text-[11px] text-[var(--text-dim)]">{savedMsg}</span>}
      </div>
    </div>
  );
}
