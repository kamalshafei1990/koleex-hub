"use client";

/* ---------------------------------------------------------------------------
   CompleteSetConfigurator — ST-3.

   The machine-side complete-set configurator. Pulls the Stands & Tables catalog
   (each product + base cost + configurable option values), lets the operator
   pick a Table and a Stand and configure each one's options. Configured cost =
   base + Σ selected option deltas → priced through the SAME engine (via
   /api/products/price-preview) → summed with the head's Base FOB.

   Each component is priced on its own cost (own level/band) per the
   sum-of-components rule. Templates (ST-4) plug in here later.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import BoxIcon from "@/components/icons/ui/BoxIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

interface OptionValue { axis: string; value: string; priceDelta: number; affectsPrice: boolean; isDefault: boolean; sortOrder: number; }
interface AccessoryProduct { productId: string; name: string; baseCostCny: number | null; options: OptionValue[]; }

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function priceFobUsd(costCny: number, country: string | null): Promise<number | null> {
  if (!costCny || costCny <= 0) return null;
  const qs = new URLSearchParams({ cost_cny: String(costCny), qty: "1" });
  if (country) qs.set("country", country);
  try {
    const r = await fetch(`/api/products/price-preview?${qs.toString()}`, { credentials: "include" });
    const j = (await r.json().catch(() => ({}))) as { market?: { regionalFobUsd?: number | null }; base?: { globalFobUsd?: number | null } };
    return j?.market?.regionalFobUsd ?? j?.base?.globalFobUsd ?? null;
  } catch { return null; }
}

/* One side (Table or Stand): product picker + per-axis option selects.
   Reports its configured cost (CNY) and priced FOB (USD) up to the parent. */
function AccessorySide({ label, products, country, onChange }: {
  label: string; products: AccessoryProduct[]; country: string | null;
  onChange: (s: { productId: string | null; costCny: number | null; fobUsd: number | null }) => void;
}) {
  const [productId, setProductId] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [fob, setFob] = useState<number | null>(null);
  const [pricing, setPricing] = useState(false);

  const product = products.find((p) => p.productId === productId) ?? null;

  // Axes (ordered) for the chosen product.
  const axes = useMemo(() => {
    if (!product) return [] as { axis: string; values: OptionValue[] }[];
    const by = new Map<string, OptionValue[]>();
    for (const o of product.options) { if (!by.has(o.axis)) by.set(o.axis, []); by.get(o.axis)!.push(o); }
    return [...by.entries()].map(([axis, values]) => ({ axis, values }));
  }, [product]);

  // Pick first product + seed defaults when the list arrives.
  useEffect(() => {
    if (!productId && products.length) setProductId(products[0].productId);
  }, [products, productId]);
  useEffect(() => {
    if (!product) { setSel({}); return; }
    const d: Record<string, string> = {};
    for (const o of product.options) { if (!(o.axis in d)) d[o.axis] = o.value; if (o.isDefault) d[o.axis] = o.value; }
    setSel(d);
  }, [product]);

  const costCny = useMemo(() => {
    if (!product || product.baseCostCny == null) return null;
    let c = product.baseCostCny;
    for (const o of product.options) if (o.affectsPrice && sel[o.axis] === o.value) c += o.priceDelta;
    return c;
  }, [product, sel]);

  // Re-price (debounced) whenever the configured cost changes.
  useEffect(() => {
    if (costCny == null) { setFob(null); onChange({ productId, costCny: null, fobUsd: null }); return; }
    setPricing(true);
    const t = setTimeout(async () => {
      const f = await priceFobUsd(costCny, country);
      setFob(f); setPricing(false);
      onChange({ productId, costCny, fobUsd: f });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costCny, country, productId]);

  const ctl = "h-8 px-2 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">{label}</span>
        <span className="text-[12px] font-semibold tabular-nums text-[var(--text-primary)] inline-flex items-center gap-1">
          {pricing ? <SpinnerIcon className="h-3 w-3 animate-spin text-[var(--text-dim)]" /> : null}
          {fob != null ? `+${usd(fob)}` : (product?.baseCostCny == null ? "cost —" : "—")}
        </span>
      </div>
      <select className={`${ctl} w-full`} value={productId ?? ""} onChange={(e) => setProductId(e.target.value || null)}>
        <option value="">— none —</option>
        {products.map((p) => <option key={p.productId} value={p.productId}>{p.name}</option>)}
      </select>
      {axes.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {axes.map(({ axis, values }) => (
            <label key={axis} className="block">
              <span className="block text-[9px] uppercase tracking-wider text-[var(--text-ghost)] mb-0.5">
                {axis.replace("_", " ")}{values.some((v) => v.affectsPrice) ? " 💰" : ""}
              </span>
              <select className={`${ctl} w-full`} value={sel[axis] ?? ""} onChange={(e) => setSel((s) => ({ ...s, [axis]: e.target.value }))}>
                {values.map((v) => (
                  <option key={v.value} value={v.value}>{v.value}{v.affectsPrice && v.priceDelta ? ` (+¥${v.priceDelta})` : ""}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompleteSetConfigurator({ country, headFobUsd }: { country: string | null; headFobUsd: number | null }) {
  const [catalog, setCatalog] = useState<{ tables: AccessoryProduct[]; stands: AccessoryProduct[] }>({ tables: [], stands: [] });
  const [loading, setLoading] = useState(false);
  const [tableSel, setTableSel] = useState<{ fobUsd: number | null }>({ fobUsd: null });
  const [standSel, setStandSel] = useState<{ fobUsd: number | null }>({ fobUsd: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/products/accessory-catalog", { credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as { tables?: AccessoryProduct[]; stands?: AccessoryProduct[] };
      setCatalog({ tables: j.tables ?? [], stands: j.stands ?? [] });
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const total = headFobUsd != null ? headFobUsd + (tableSel.fobUsd ?? 0) + (standSel.fobUsd ?? 0) : null;
  const empty = catalog.tables.length === 0 && catalog.stands.length === 0;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <BoxIcon className="h-4 w-4 text-[var(--text-dim)]" />
        <h4 className="text-[12px] font-semibold text-[var(--text-primary)]">Complete set</h4>
        <span className="text-[10px] text-[var(--text-ghost)]">head + table + stand, each configured & priced separately</span>
        {loading && <SpinnerIcon className="ms-auto h-3.5 w-3.5 animate-spin text-[var(--text-dim)]" />}
      </div>

      {empty ? (
        <p className="text-[11px] text-[var(--text-dim)]">
          No Stand/Table products yet. Add products under the <b>Stands &amp; Tables</b> category (Tables / Stands) with their options &amp; price add-ons, and they&apos;ll appear here to configure.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <AccessorySide label="Table" products={catalog.tables} country={country} onChange={(s) => setTableSel({ fobUsd: s.fobUsd })} />
            <AccessorySide label="Stand" products={catalog.stands} country={country} onChange={(s) => setStandSel({ fobUsd: s.fobUsd })} />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[var(--accent)]/[0.06] border border-[var(--accent)]/30 px-3 py-2">
            <div className="text-[11px] text-[var(--text-secondary)]">
              Complete-set Base FOB
              <span className="text-[var(--text-ghost)]"> · head {usd(headFobUsd)}{tableSel.fobUsd ? ` + table ${usd(tableSel.fobUsd)}` : ""}{standSel.fobUsd ? ` + stand ${usd(standSel.fobUsd)}` : ""}</span>
            </div>
            <div className="text-[15px] font-bold tabular-nums text-[var(--accent)]">{usd(total)}</div>
          </div>
          <p className="text-[10px] text-[var(--text-ghost)]">Each item is priced on its own configured cost (base + options) through the engine, then summed. Preview only — the customer-facing configurator is quote-time.</p>
        </>
      )}
    </div>
  );
}
