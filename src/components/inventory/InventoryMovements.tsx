"use client";

/* ---------------------------------------------------------------------------
   /inventory/movements — Movement ledger + new-movement form.

   Two regions on desktop, stacked on mobile:
     - left:  paged ledger with filters
     - right: form to draft + post a new movement

   Movement type strings (opening_balance, sales_shipment, …) are
   humanised via the shared `movementLabel` helper so the UI never
   shows raw enums. Form defaults pull the tenant's default warehouse.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import type { MovementStatus, MovementType } from "@/lib/inventory/types";
import {
  DirectionDelta,
  InventoryEmpty,
  LocationTypeChip,
  Panel,
  StatusBadge,
  movementLabel,
} from "@/components/inventory/InventoryUi";
import RrIcon from "@/components/ui/RrIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation, type Translations } from "@/lib/i18n";
import Link from "next/link";

/* INV-H1 — Movement form selects Products and resolves to inventory_item_id
   on the server. */
interface ProductOption {
  product_id: string;
  product_name: string;
  slug: string;
  brand: string | null;
  sku: string | null;
  model_name: string | null;
  image_url: string | null;
  stock_profile: {
    inventory_item_id: string;
    item_code: string;
    unit_of_measure: string;
    default_warehouse_id: string | null;
  } | null;
}

const MV_T: Translations = {
  "mv.title":       { en: "Stock Movements", zh: "库存移动",   ar: "حركات المخزون" },
  "mv.subtitle":    { en: "Append-only ledger. Posted movements are immutable; void via reversal.", zh: "仅追加分录。已过账的移动不可变；通过反向冲销作废。", ar: "سجل لا يقبل الإلحاق فقط. الحركات المرحلة غير قابلة للتعديل؛ يمكن إلغاؤها بحركة عكسية." },
  "mv.new":         { en: "New Movement",    zh: "新建移动",   ar: "حركة جديدة" },
  "mv.product":     { en: "Product",         zh: "产品",       ar: "المنتج" },
  "mv.product_hint":{ en: "Search by name, SKU or brand", zh: "按名称、SKU 或品牌搜索", ar: "ابحث بالاسم أو SKU أو العلامة التجارية" },
  "mv.no_profile":  { en: "This product is not tracked in inventory.", zh: "此产品不在库存中跟踪。", ar: "هذا المنتج غير مُتتبَّع في المخزون." },
  "mv.create_profile_cta": { en: "Open product to create a Stock Profile →", zh: "打开产品以创建库存档案 →", ar: "افتح المنتج لإنشاء ملف مخزون ←" },
  "mv.location":    { en: "Location",        zh: "位置",       ar: "الموقع" },
  "mv.type":        { en: "Type",            zh: "类型",       ar: "النوع" },
  "mv.direction":   { en: "Direction",       zh: "方向",       ar: "الاتجاه" },
  "mv.qty":         { en: "Quantity",        zh: "数量",       ar: "الكمية" },
  "mv.unit":        { en: "Unit",            zh: "单位",       ar: "الوحدة" },
  "mv.reference":   { en: "Reference",       zh: "参考",       ar: "المرجع" },
  "mv.notes":       { en: "Notes",           zh: "备注",       ar: "ملاحظات" },
  "mv.post":        { en: "Post Movement",   zh: "过账",       ar: "ترحيل الحركة" },
  "mv.posting":     { en: "Posting…",        zh: "过账中…",     ar: "جارٍ الترحيل…" },
};

interface Item { id: string; item_code: string; item_name: string }
interface Warehouse {
  id: string; code: string; name: string;
  is_default: boolean;
  location_type?: string | null;
}
interface MovementRow {
  id: string;
  movement_no: string;
  movement_date: string;
  inventory_item_id: string;
  warehouse_id: string;
  movement_type: MovementType;
  direction: "in" | "out";
  quantity: number;
  unit: string;
  reference: string | null;
  status: MovementStatus;
  posted_at: string | null;
  voided_at: string | null;
}

const MOVEMENT_TYPES: Array<{ value: MovementType; label: string; direction: "in" | "out" | "either" }> = [
  { value: "opening_balance",  label: "Opening Balance",  direction: "in" },
  { value: "purchase_receipt", label: "Purchase Receipt", direction: "in" },
  { value: "sales_shipment",   label: "Sales Shipment",   direction: "out" },
  { value: "adjustment_in",    label: "Adjustment IN",    direction: "in" },
  { value: "adjustment_out",   label: "Adjustment OUT",   direction: "out" },
  { value: "transfer_in",      label: "Transfer IN",      direction: "in" },
  { value: "transfer_out",     label: "Transfer OUT",     direction: "out" },
  { value: "return_in",        label: "Return IN",        direction: "in" },
  { value: "return_out",       label: "Return OUT",       direction: "out" },
  { value: "manual",           label: "Manual",           direction: "either" },
];

export default function InventoryMovements() {
  const { t } = useTranslation(MV_T);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  /* INV-H1 — product picker: list of products + their resolved profile. */
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Ledger filters */
  const [filterStatus, setFilterStatus] = useState<"" | "draft" | "posted" | "voided">("");
  const [filterType, setFilterType] = useState<string>("");

  /* Form */
  const [productQuery, setProductQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [itemQuery, setItemQuery] = useState("");
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [type, setType] = useState<MovementType>("adjustment_in");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const itemMap = useMemo(() => {
    const m = new Map<string, { code: string; name: string; product_name?: string; sku?: string | null; image_url?: string | null }>();
    for (const i of items) m.set(i.id, { code: i.item_code, name: i.item_name });
    /* Overlay product identity for items that have a stock profile. */
    for (const p of products) {
      if (p.stock_profile) {
        m.set(p.stock_profile.inventory_item_id, {
          code: p.stock_profile.item_code,
          name: p.product_name,
          product_name: p.product_name,
          sku: p.sku,
          image_url: p.image_url,
        });
      }
    }
    return m;
  }, [items, products]);
  const warehouseMap = useMemo(() => {
    const m = new Map<string, Warehouse>();
    for (const w of warehouses) m.set(w.id, w);
    return m;
  }, [warehouses]);

  /* Initial dictionaries — items + warehouses — load once and don't
     refetch when filters change. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [itemRes, whRes, prodRes] = await Promise.all([
          fetch("/api/inventory/items?status=active&limit=500", { cache: "no-store", credentials: "include" }),
          fetch("/api/inventory/warehouses", { cache: "no-store", credentials: "include" }),
          fetch("/api/products/with-stock-profile?limit=500", { cache: "no-store", credentials: "include" }),
        ]);
        const itemJ = await itemRes.json();
        const whJ = await whRes.json();
        const prodJ = await prodRes.json();
        if (cancelled) return;
        setItems(((itemJ.items ?? []) as Array<{ id: string; item_code: string; item_name: string }>)
          .map((i) => ({ id: i.id, item_code: i.item_code, item_name: i.item_name })));
        setProducts((prodJ.products ?? []) as ProductOption[]);
        const whList = ((whJ.warehouses ?? []) as Warehouse[]);
        setWarehouses(whList);
        const def = whList.find((w) => w.is_default) ?? whList.find((w) => (w.location_type ?? "warehouse") === "warehouse") ?? whList[0];
        if (def) setWarehouseId(def.id);
      } catch {
        /* errors will surface from the movements query path */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Movements list — refetched whenever filters change. */
  const loadMovements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "100");
      if (filterStatus) qs.set("status", filterStatus);
      if (filterType) qs.set("movement_type", filterType);
      const r = await fetch(`/api/inventory/movements?${qs.toString()}`, { cache: "no-store", credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      setMovements((j.movements ?? []) as MovementRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType]);

  useEffect(() => { void loadMovements(); }, [loadMovements]);

  const onTypeChange = (next: MovementType) => {
    setType(next);
    const def = MOVEMENT_TYPES.find((t) => t.value === next);
    if (def && def.direction !== "either") setDirection(def.direction);
  };

  const resolveItemFromQuery = (q: string) => {
    if (!q) return "";
    const exactPair = items.find((i) => `${i.item_code} · ${i.item_name}` === q);
    if (exactPair) return exactPair.id;
    const code = items.find((i) => i.item_code === q || i.item_code === q.trim());
    if (code) return code.id;
    return "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFlash(null);
    const qty = Number(quantity);
    /* INV-H1 — prefer product_id (resolved on server). Fall back to
       legacy inventory_item_id for legacy / admin paths. */
    const useProduct = !!selectedProduct?.product_id;
    const resolvedItemId = useProduct
      ? selectedProduct?.stock_profile?.inventory_item_id ?? ""
      : itemId || resolveItemFromQuery(itemQuery);
    if (useProduct && !selectedProduct?.stock_profile) {
      setSubmitError(t("mv.no_profile"));
      return;
    }
    if (!useProduct && !resolvedItemId) { setSubmitError("Pick a product or legacy item"); return; }
    if (!warehouseId) { setSubmitError("Pick a warehouse / location"); return; }
    if (!Number.isFinite(qty) || qty <= 0) { setSubmitError("Quantity must be > 0"); return; }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        warehouse_id: warehouseId,
        movement_type: type,
        direction,
        quantity: qty,
        unit,
        reference: reference || null,
        notes: notes || null,
        post: true,
      };
      if (useProduct) body.product_id = selectedProduct!.product_id;
      else body.inventory_item_id = resolvedItemId;
      const r = await fetch("/api/inventory/movements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) { setSubmitError(humanizeError(j.error ?? `HTTP ${r.status}`)); return; }
      setQuantity(""); setReference(""); setNotes("");
      setFlash(`Posted ${movementLabel(type)} · ${qty} ${unit}`);
      window.setTimeout(() => setFlash(null), 2500);
      await loadMovements();
    } finally {
      setSubmitting(false);
    }
  };

  const voidMovement = async (id: string) => {
    if (!confirm("Void this movement? A reversing entry will be posted.")) return;
    const reason = prompt("Reason (optional):") ?? null;
    const r = await fetch(`/api/inventory/movements/${id}/void`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const j = await r.json();
    if (!r.ok) { alert(humanizeError(j.error ?? `HTTP ${r.status}`)); return; }
    await loadMovements();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader title={t("mv.title")} subtitle={t("mv.subtitle")} />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr,360px]">
          {/* LEDGER */}
          <div className="space-y-3">
            {/* Filter chips */}
            <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
              {(["", "draft", "posted", "voided"] as const).map((s) => (
                <button
                  key={s || "all"}
                  onClick={() => setFilterStatus(s)}
                  className={`rounded-md border px-2.5 py-1 transition-colors ${
                    filterStatus === s ? "border-white/[0.14] bg-white/[0.06] text-[var(--text-primary)]" : "border-white/[0.06] text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {s ? s : "All"}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-white/[0.06]" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1 text-[11.5px]"
              >
                <option value="">All types</option>
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <div className="ml-auto text-[11px] text-gray-500 tabular-nums">
                {loading ? "…" : `${movements.length} movement${movements.length === 1 ? "" : "s"}`}
              </div>
            </div>

            <Panel>
              <table className="min-w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Movement #</th>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && movements.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
                  ) : movements.length === 0 ? (
                    <tr><td colSpan={8} className="px-0 py-0">
                      <InventoryEmpty
                        title={filterStatus || filterType ? "No movements match the filters" : "No movements yet"}
                        hint={filterStatus || filterType ? "Try clearing filters." : "Use the form on the right to record an opening balance or an adjustment."}
                      />
                    </td></tr>
                  ) : (
                    movements.map((m) => {
                      const item = itemMap.get(m.inventory_item_id);
                      const wh = warehouseMap.get(m.warehouse_id);
                      return (
                        <tr key={m.id} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]">
                          <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">{m.movement_date}</td>
                          <td className="px-3 py-1.5 font-mono text-[11.5px] text-gray-300 whitespace-nowrap">{m.movement_no}</td>
                          <td className="px-3 py-1.5 text-gray-200">
                            {item ? (
                              <span className="inline-flex items-center gap-2">
                                {item.image_url && (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={item.image_url} alt="" className="h-7 w-7 rounded object-cover bg-[var(--bg-surface)] shrink-0" />
                                )}
                                <span className="inline-flex flex-col min-w-0">
                                  <span className="text-[12px] truncate">{item.name}</span>
                                  <span className="font-mono text-[10.5px] text-gray-500">
                                    {item.sku ? <>{item.sku} · </> : null}{item.code}
                                  </span>
                                </span>
                              </span>
                            ) : <span className="text-gray-500">—</span>}
                          </td>
                          <td className="px-3 py-1.5">
                            {wh ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-[11.5px] text-gray-300">{wh.code}</span>
                                <LocationTypeChip type={wh.location_type} />
                              </span>
                            ) : <span className="text-gray-500">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-[11.5px] text-gray-300 whitespace-nowrap">{movementLabel(m.movement_type)}</td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">
                            <DirectionDelta direction={m.direction} quantity={m.quantity} unit={m.unit} />
                          </td>
                          <td className="px-3 py-1.5"><StatusBadge status={m.status} /></td>
                          <td className="px-3 py-1.5 text-right">
                            {m.status === "posted" && (
                              <button onClick={() => voidMovement(m.id)} className="text-[11px] text-rose-300 hover:text-rose-200">
                                Void
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </Panel>
          </div>

          {/* NEW MOVEMENT */}
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-white/[0.05] bg-white/[0.012] p-4 self-start">
            <div className="flex items-center gap-2">
              <RrIcon name="plus" size={12} />
              <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500">New Movement</div>
            </div>

            {/* INV-H1 — Operators select a Product. The server resolves
                product → inventory_item_id; the legacy item picker
                stays available as a fallback for legacy items only. */}
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">{t("mv.product")}</div>
              <input
                list="inv-product-list"
                value={productQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setProductQuery(v);
                  /* Match the full "Name · Brand · SKU" display value. */
                  const match = products.find((p) =>
                    [p.product_name, p.brand, p.sku, p.model_name].filter(Boolean).join(" · ") === v
                    || p.product_name === v,
                  );
                  setSelectedProduct(match ?? null);
                  if (match) setItemQuery("");
                }}
                placeholder={t("mv.product_hint")}
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] text-[var(--text-primary)]"
              />
              <datalist id="inv-product-list">
                {products.slice(0, 500).map((p) => (
                  <option
                    key={p.product_id}
                    value={[p.product_name, p.brand, p.sku, p.model_name].filter(Boolean).join(" · ")}
                  />
                ))}
              </datalist>
              {selectedProduct && (
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
                  {selectedProduct.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={selectedProduct.image_url} alt="" className="h-6 w-6 rounded object-cover bg-[var(--bg-surface)]" />
                  )}
                  <span className="truncate">
                    <span className="text-[var(--text-secondary)]">{selectedProduct.product_name}</span>
                    {selectedProduct.sku ? <span className="ml-1 font-mono text-[10px]">{selectedProduct.sku}</span> : null}
                  </span>
                  {selectedProduct.stock_profile ? (
                    <span className="ml-auto font-mono text-[10px] text-[var(--text-ghost)]">
                      {selectedProduct.stock_profile.item_code}
                    </span>
                  ) : (
                    <span className="ml-auto text-[10.5px] text-amber-300/80">{t("mv.no_profile")}</span>
                  )}
                </div>
              )}
              {selectedProduct && !selectedProduct.stock_profile && (
                <Link
                  href={`/products/${selectedProduct.slug || selectedProduct.product_id}/edit#stock-profile`}
                  className="mt-1 inline-block text-[10.5px] text-[var(--accent-primary,#3b82f6)] hover:underline"
                >
                  {t("mv.create_profile_cta")}
                </Link>
              )}
            </label>

            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Location</div>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]">
                {warehouses.length === 0 && <option value="">No locations yet</option>}
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Type</div>
              <select value={type} onChange={(e) => onTypeChange(e.target.value as MovementType)} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]">
                {MOVEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>

            {type === "manual" && (
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Direction</div>
                <select value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]">
                  <option value="in">IN (+)</option>
                  <option value="out">OUT (−)</option>
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Quantity</div>
                <input type="number" min="0" step="0.0001" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
              </label>
              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Unit</div>
                <input value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
              </label>
            </div>

            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Reference</div>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="GR-…, PO-…, ticket #…" className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </label>

            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Notes</div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </label>

            {submitError && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{submitError}</div>
            )}
            {flash && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-200">{flash}</div>
            )}

            <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50">
              {!submitting && <RrIcon name="check" size={12} />}
              {submitting ? "Posting…" : "Post Movement"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
