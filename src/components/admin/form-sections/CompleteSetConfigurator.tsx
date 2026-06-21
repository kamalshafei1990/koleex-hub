"use client";

/* ---------------------------------------------------------------------------
   CompleteSetConfigurator — ST-3 + ST-4.

   The machine-side complete-set configurator. Pulls the Stands & Tables catalog
   (each product + base cost + configurable option values), lets the operator
   pick a Table and a Stand and configure each one's options. Configured cost =
   base + Σ selected option deltas → priced through the SAME engine (via
   /api/products/price-preview) → summed with the head's Base FOB.

   ST-4: named set templates (Economy / Standard / Premium) per machine
   subcategory store the full configuration (product + its option selections)
   and apply with one click. "Save selection as set" captures the current pick.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import BoxIcon from "@/components/icons/ui/BoxIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

interface OptionValue { axis: string; value: string; priceDelta: number; affectsPrice: boolean; isDefault: boolean; sortOrder: number; }
interface AccessoryProduct { productId: string; name: string; baseCostCny: number | null; options: OptionValue[]; }
interface Applied { productId: string | null; options: Record<string, string>; }
interface SideState { productId: string | null; options: Record<string, string>; fobUsd: number | null; }
interface TemplateItem { accessory_product_id: string; role: string; selected_options: Record<string, string>; }
interface SetTemplate { id?: string; name: string; tier: string; items: TemplateItem[]; }

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

function AccessorySide({ label, products, country, applied, applyNonce, onChange }: {
  label: string; products: AccessoryProduct[]; country: string | null;
  applied?: Applied | null; applyNonce: number;
  onChange: (s: SideState) => void;
}) {
  const [productId, setProductId] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [fob, setFob] = useState<number | null>(null);
  const [pricing, setPricing] = useState(false);

  const product = products.find((p) => p.productId === productId) ?? null;

  const axes = useMemo(() => {
    if (!product) return [] as { axis: string; values: OptionValue[] }[];
    const by = new Map<string, OptionValue[]>();
    for (const o of product.options) { if (!by.has(o.axis)) by.set(o.axis, []); by.get(o.axis)!.push(o); }
    return [...by.entries()].map(([axis, values]) => ({ axis, values }));
  }, [product]);

  // First product default.
  useEffect(() => { if (!productId && products.length) setProductId(products[0].productId); }, [products, productId]);

  // Seed default option selections when the product changes.
  useEffect(() => {
    if (!product) { setSel({}); return; }
    const d: Record<string, string> = {};
    for (const o of product.options) { if (!(o.axis in d)) d[o.axis] = o.value; if (o.isDefault) d[o.axis] = o.value; }
    setSel(d);
  }, [product]);

  // Apply a template selection (productId + options) when the nonce bumps.
  useEffect(() => {
    if (!applied) return;
    setProductId(applied.productId);
    if (applied.options && Object.keys(applied.options).length) setSel(applied.options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyNonce]);

  const costCny = useMemo(() => {
    if (!product || product.baseCostCny == null) return null;
    let c = product.baseCostCny;
    for (const o of product.options) if (o.affectsPrice && sel[o.axis] === o.value) c += o.priceDelta;
    return c;
  }, [product, sel]);

  useEffect(() => {
    if (costCny == null) { setFob(null); onChange({ productId, options: sel, fobUsd: null }); return; }
    setPricing(true);
    const t = setTimeout(async () => {
      const f = await priceFobUsd(costCny, country);
      setFob(f); setPricing(false);
      onChange({ productId, options: sel, fobUsd: f });
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

export default function CompleteSetConfigurator({ country, headFobUsd, machineSubcategory }: { country: string | null; headFobUsd: number | null; machineSubcategory?: string | null }) {
  const [catalog, setCatalog] = useState<{ tables: AccessoryProduct[]; stands: AccessoryProduct[] }>({ tables: [], stands: [] });
  const [loading, setLoading] = useState(false);
  const [table, setTable] = useState<SideState>({ productId: null, options: {}, fobUsd: null });
  const [stand, setStand] = useState<SideState>({ productId: null, options: {}, fobUsd: null });

  // Template application — push a saved config into the two sides.
  const [appliedTable, setAppliedTable] = useState<Applied | null>(null);
  const [appliedStand, setAppliedStand] = useState<Applied | null>(null);
  const [applyNonce, setApplyNonce] = useState(0);

  const [templates, setTemplates] = useState<SetTemplate[]>([]);
  const [newName, setNewName] = useState("");
  const [newTier, setNewTier] = useState("standard");
  const [savingTpl, setSavingTpl] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/products/accessory-catalog", { credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as { tables?: AccessoryProduct[]; stands?: AccessoryProduct[] };
      setCatalog({ tables: j.tables ?? [], stands: j.stands ?? [] });
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadTemplates = useCallback(async () => {
    if (!machineSubcategory) { setTemplates([]); return; }
    try {
      const r = await fetch(`/api/product-set-templates?subcategory=${encodeURIComponent(machineSubcategory)}`, { credentials: "include" });
      const j = (await r.json().catch(() => ({}))) as { templates?: SetTemplate[] };
      setTemplates(j.templates ?? []);
    } catch { setTemplates([]); }
  }, [machineSubcategory]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const applyTemplate = (tpl: SetTemplate) => {
    const t = tpl.items.find((i) => i.role === "table");
    const s = tpl.items.find((i) => i.role === "stand");
    setAppliedTable({ productId: t?.accessory_product_id ?? null, options: t?.selected_options ?? {} });
    setAppliedStand({ productId: s?.accessory_product_id ?? null, options: s?.selected_options ?? {} });
    setApplyNonce((n) => n + 1);
  };

  const saveCurrentAsTemplate = async () => {
    if (!machineSubcategory || !newName.trim()) return;
    const items: TemplateItem[] = [];
    if (table.productId) items.push({ accessory_product_id: table.productId, role: "table", selected_options: table.options });
    if (stand.productId) items.push({ accessory_product_id: stand.productId, role: "stand", selected_options: stand.options });
    setSavingTpl(true);
    try {
      const next = [...templates.map((t) => ({ name: t.name, tier: t.tier, items: t.items })), { name: newName.trim(), tier: newTier, items }];
      await fetch("/api/product-set-templates", {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subcategory: machineSubcategory, templates: next.map((t, i) => ({ ...t, sort_order: i })) }),
      });
      setNewName("");
      await loadTemplates();
    } finally { setSavingTpl(false); }
  };

  const removeTemplate = async (idx: number) => {
    if (!machineSubcategory) return;
    const next = templates.filter((_, i) => i !== idx);
    await fetch("/api/product-set-templates", {
      method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subcategory: machineSubcategory, templates: next.map((t, i) => ({ name: t.name, tier: t.tier, items: t.items, sort_order: i })) }),
    });
    await loadTemplates();
  };

  const total = headFobUsd != null ? headFobUsd + (table.fobUsd ?? 0) + (stand.fobUsd ?? 0) : null;
  const empty = catalog.tables.length === 0 && catalog.stands.length === 0;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <BoxIcon className="h-4 w-4 text-[var(--text-dim)]" />
        <h4 className="text-[12px] font-semibold text-[var(--text-primary)]">Complete set</h4>
        <span className="text-[10px] text-[var(--text-ghost)]">head + table + stand, each configured &amp; priced separately</span>
        {loading && <SpinnerIcon className="ms-auto h-3.5 w-3.5 animate-spin text-[var(--text-dim)]" />}
      </div>

      {empty ? (
        <p className="text-[11px] text-[var(--text-dim)]">
          No Stand/Table products yet. Add products under the <b>Stands &amp; Tables</b> category (Tables / Stands) with their options &amp; price add-ons, and they&apos;ll appear here to configure.
        </p>
      ) : (
        <>
          {/* One-click set templates */}
          {templates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">Sets</span>
              {templates.map((tpl, ti) => (
                <span key={tpl.id ?? ti} className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 overflow-hidden">
                  <button type="button" onClick={() => applyTemplate(tpl)}
                    className="px-2.5 py-1 text-[11px] font-medium hover:text-[var(--accent)]">
                    {tpl.name} <span className="text-[9px] uppercase text-[var(--text-ghost)]">{tpl.tier}</span>
                  </button>
                  <button type="button" onClick={() => removeTemplate(ti)} title="Remove set"
                    className="px-1.5 text-[var(--text-ghost)] hover:text-[var(--accent)] border-s border-[var(--border-subtle)]">×</button>
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <AccessorySide label="Table" products={catalog.tables} country={country} applied={appliedTable} applyNonce={applyNonce} onChange={setTable} />
            <AccessorySide label="Stand" products={catalog.stands} country={country} applied={appliedStand} applyNonce={applyNonce} onChange={setStand} />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-[var(--accent)]/[0.06] border border-[var(--accent)]/30 px-3 py-2">
            <div className="text-[11px] text-[var(--text-secondary)]">
              Complete-set Base FOB
              <span className="text-[var(--text-ghost)]"> · head {usd(headFobUsd)}{table.fobUsd ? ` + table ${usd(table.fobUsd)}` : ""}{stand.fobUsd ? ` + stand ${usd(stand.fobUsd)}` : ""}</span>
            </div>
            <div className="text-[15px] font-bold tabular-nums text-[var(--accent)]">{usd(total)}</div>
          </div>

          {/* Save current configuration as a named set */}
          {machineSubcategory && (table.productId || stand.productId) && (
            <div className="flex items-center gap-1.5">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Save this as a set (e.g. Standard)"
                className="flex-1 h-7 px-2 rounded-md bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[11.5px] outline-none focus:border-[var(--border-focus)]" />
              <select value={newTier} onChange={(e) => setNewTier(e.target.value)}
                className="h-7 px-1.5 rounded-md bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[11px]">
                <option value="economy">economy</option>
                <option value="standard">standard</option>
                <option value="premium">premium</option>
              </select>
              <button type="button" onClick={saveCurrentAsTemplate} disabled={savingTpl || !newName.trim()}
                className="text-[10.5px] px-2 py-1 rounded border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40">
                Save set
              </button>
            </div>
          )}

          <p className="text-[10px] text-[var(--text-ghost)]">Each item is priced on its own configured cost (base + options) through the engine, then summed. Preview only — the customer-facing configurator is quote-time.</p>
        </>
      )}
    </div>
  );
}
