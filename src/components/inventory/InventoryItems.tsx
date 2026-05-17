"use client";

/* ---------------------------------------------------------------------------
   /inventory/items — Universal Inventory Item master.

   - List of inventory items with type badge, brand, on-hand, status.
   - Filters by type, status, search.
   - Quick Add drawer with item name, type, unit, initial qty/warehouse.
   - Advanced details toggle for cost, supplier, reorder points, etc.
   - "Manage Types" panel: list system + custom types, create custom.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import type { ColorToken, IconName, UnitOfMeasure } from "@/lib/inventory/types";
import { ALLOWED_COLORS, ALLOWED_ICONS, ALLOWED_UNITS } from "@/lib/inventory/types";

interface ItemRow {
  id: string;
  item_code: string;
  item_name: string;
  brand: string | null;
  unit_of_measure: string;
  status: "active" | "inactive" | "archived";
  type_key: string;
  type_name: string;
  icon: IconName;
  color: ColorToken;
  qty_on_hand: number;
  cost_price: number | null;
}

interface ItemType {
  id: string;
  tenant_id: string | null;
  type_key: string;
  type_name: string;
  icon: IconName;
  color: ColorToken;
  is_system: boolean;
  is_active: boolean;
  description: string | null;
}

interface Warehouse { id: string; code: string; name: string; is_default: boolean }

const TONE: Record<ColorToken, string> = {
  gray:   "border-gray-500/30 bg-gray-500/10 text-gray-300",
  blue:   "border-blue-500/30 bg-blue-500/10 text-blue-200",
  cyan:   "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  teal:   "border-teal-500/30 bg-teal-500/10 text-teal-200",
  green:  "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  amber:  "border-amber-500/30 bg-amber-500/10 text-amber-200",
  orange: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  red:    "border-rose-500/30 bg-rose-500/10 text-rose-200",
  rose:   "border-rose-500/30 bg-rose-500/10 text-rose-200",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-200",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  slate:  "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

function fmtQty(n: number) {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export default function InventoryItems() {
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [filterTypeId, setFilterTypeId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"active" | "inactive" | "archived" | "">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [typesPanelOpen, setTypesPanelOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set("q", search);
      if (filterTypeId) qs.set("type_id", filterTypeId);
      if (filterStatus) qs.set("status", filterStatus);
      const [iRes, tRes, wRes] = await Promise.all([
        fetch(`/api/inventory/items?${qs.toString()}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/inventory/item-types`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/inventory/warehouses`, { credentials: "include", cache: "no-store" }),
      ]);
      const iJ = await iRes.json();
      const tJ = await tRes.json();
      const wJ = await wRes.json();
      if (!iRes.ok) throw new Error(iJ.error ?? `Failed (${iRes.status})`);
      setRows((iJ.items ?? []) as ItemRow[]);
      setTypes((tJ.types ?? []) as ItemType[]);
      setWarehouses((wJ.warehouses ?? []) as Warehouse[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [search, filterTypeId, filterStatus]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader
          title="Inventory Items"
          subtitle="The universal item master — products, parts, packaging, supplies, anything tracked."
          action={
            <div className="flex gap-2">
              <button
                onClick={() => setTypesPanelOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]"
              >
                Manage Types
              </button>
              <button
                onClick={() => setQuickAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-white/[0.10]"
              >
                + Add Item
              </button>
            </div>
          }
        />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] p-3">
          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, code, brand…"
              className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] min-w-[240px]"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Type</div>
            <select
              value={filterTypeId}
              onChange={(e) => setFilterTypeId(e.target.value)}
              className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.type_name}{t.is_system ? "" : " (custom)"}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Status</div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
              <option value="">All</option>
            </select>
          </label>
          <div className="ml-auto text-[11px] text-gray-500 tabular-nums">{rows.length} items</div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.012]">
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Brand</th>
                <th className="px-3 py-2 text-left">UoM</th>
                <th className="px-3 py-2 text-right">On hand</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-[11px] text-gray-600">No items match. Click + Add Item to create one.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.03]">
                    <td className="px-3 py-1.5 font-mono text-[11.5px] text-gray-300">{r.item_code}</td>
                    <td className="px-3 py-1.5 text-gray-200">{r.item_name}</td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] ${TONE[r.color] ?? TONE.slate}`}>
                        {r.type_name}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-400">{r.brand ?? "—"}</td>
                    <td className="px-3 py-1.5 text-gray-400">{r.unit_of_measure}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-mono">{fmtQty(r.qty_on_hand)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-mono text-gray-400">{r.cost_price != null ? Number(r.cost_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</td>
                    <td className="px-3 py-1.5 text-[11px] text-gray-500">{r.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {quickAddOpen && (
        <QuickAddDrawer
          types={types}
          warehouses={warehouses}
          onClose={() => setQuickAddOpen(false)}
          onSuccess={() => { setQuickAddOpen(false); void load(); }}
        />
      )}

      {typesPanelOpen && (
        <TypesPanel
          types={types}
          onClose={() => setTypesPanelOpen(false)}
          onChanged={() => { void load(); }}
        />
      )}
    </div>
  );
}

/* ─── Quick Add drawer ──────────────────────────────────── */

function QuickAddDrawer({
  types, warehouses, onClose, onSuccess,
}: {
  types: ItemType[];
  warehouses: Warehouse[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [itemName, setItemName] = useState("");
  const [typeId, setTypeId] = useState(types.find((t) => t.type_key === "finished_product")?.id ?? types[0]?.id ?? "");
  const [unit, setUnit] = useState<UnitOfMeasure>("pcs");
  const [initialQty, setInitialQty] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.is_default)?.id ?? "");
  const [advanced, setAdvanced] = useState(false);

  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [reorderPoint, setReorderPoint] = useState("");
  const [minStock, setMinStock] = useState("");
  const [maxStock, setMaxStock] = useState("");
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!itemName.trim()) { setError("Item name required"); return; }
    if (!typeId) { setError("Type required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        item_name: itemName.trim(),
        item_type_id: typeId,
        unit_of_measure: unit,
      };
      if (initialQty) {
        payload.initial_quantity = Number(initialQty) || 0;
        payload.initial_warehouse_id = warehouseId || null;
      }
      if (advanced) {
        if (brand) payload.brand = brand;
        if (sku) payload.sku = sku;
        if (barcode) payload.barcode = barcode;
        if (costPrice) payload.cost_price = Number(costPrice) || 0;
        if (currency) payload.currency = currency;
        if (reorderPoint) payload.reorder_point = Number(reorderPoint);
        if (minStock) payload.min_stock = Number(minStock);
        if (maxStock) payload.max_stock = Number(maxStock);
        if (description) payload.description = description;
      }
      const r = await fetch("/api/inventory/items", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? `Failed (${r.status})`); return; }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/60">
      <div className="w-full max-w-md overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)] border-l border-white/[0.08]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-[14px] font-semibold">Add Inventory Item</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-[18px]">×</button>
        </div>
        <div className="p-4 space-y-3">
          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Item Name *</div>
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Type *</div>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            >
              {types.filter((t) => t.is_active).map((t) => (
                <option key={t.id} value={t.id}>{t.type_name}{t.is_system ? "" : " (custom)"}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Unit of Measure</div>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as UnitOfMeasure)}
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            >
              {ALLOWED_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Initial Qty</div>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={initialQty}
                onChange={(e) => setInitialQty(e.target.value)}
                className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Warehouse</div>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              >
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}
              </select>
            </label>
          </div>

          <button
            onClick={() => setAdvanced((s) => !s)}
            className="text-[11px] text-gray-400 hover:text-gray-200"
          >
            {advanced ? "− Hide advanced" : "+ Advanced details"}
          </button>

          {advanced && (
            <div className="space-y-3 rounded-md border border-white/[0.06] p-3">
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
                <input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
                <input placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
                <input placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
                <input type="number" placeholder="Cost price" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
                <input type="number" placeholder="Reorder point" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
                <input type="number" placeholder="Min stock" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
                <input type="number" placeholder="Max stock" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
              </div>
              <textarea placeholder="Description / notes" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </div>
          )}

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{error}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
          <button onClick={onClose} className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-gray-400 hover:text-gray-200">Cancel</button>
          <button onClick={submit} disabled={submitting} className="rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50">
            {submitting ? "Saving…" : "Create Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Types Panel ──────────────────────────────────────── */

function TypesPanel({
  types, onClose, onChanged,
}: {
  types: ItemType[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName>("box");
  const [color, setColor] = useState<ColorToken>("slate");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return types.slice().sort((a, b) => (a.is_system === b.is_system ? a.type_name.localeCompare(b.type_name) : a.is_system ? -1 : 1));
  }, [types]);

  const submit = async () => {
    if (!name.trim()) { setError("Type name required"); return; }
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/inventory/item-types", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type_name: name.trim(), icon, color, description: description || null }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? `Failed (${r.status})`); return; }
      setName(""); setDescription("");
      onChanged();
    } finally {
      setSubmitting(false);
    }
  };

  const archive = async (id: string) => {
    if (!confirm("Archive this custom type? Items already using it keep their reference.")) return;
    const r = await fetch(`/api/inventory/item-types/${id}`, { method: "DELETE", credentials: "include" });
    const j = await r.json();
    if (!r.ok) { alert(j.error ?? `Failed (${r.status})`); return; }
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/60">
      <div className="w-full max-w-lg overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)] border-l border-white/[0.08]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-[14px] font-semibold">Item Types</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-[18px]">×</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-md border border-white/[0.06] p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500">New custom type</div>
            <input
              placeholder="e.g. CEO Office Items, Exhibition Screens…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px]">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Icon</div>
                <select value={icon} onChange={(e) => setIcon(e.target.value as IconName)} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]">
                  {ALLOWED_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </label>
              <label className="block text-[11px]">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Color</div>
                <select value={color} onChange={(e) => setColor(e.target.value as ColorToken)} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]">
                  {ALLOWED_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <textarea placeholder="Optional description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            {error && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{error}</div>
            )}
            <button onClick={submit} disabled={submitting} className="w-full rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50">
              {submitting ? "Creating…" : "Create custom type"}
            </button>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">All types</div>
            <ul className="space-y-1">
              {sorted.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-md border border-white/[0.04] px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] ${TONE[t.color] ?? TONE.slate}`}>
                      {t.type_name}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {t.is_system ? "system" : "custom"}{!t.is_active ? " · archived" : ""}
                    </span>
                  </div>
                  {!t.is_system && t.is_active && (
                    <button onClick={() => archive(t.id)} className="text-[11px] text-rose-300 hover:text-rose-200">Archive</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
