"use client";

/* ---------------------------------------------------------------------------
   /inventory/items — Universal Inventory Item master.

   - Items table with type icon badges, code, brand, on-hand, status.
   - Filters: search (debounced), type, status.
   - Quick Add drawer with item name, type, unit, initial qty/warehouse.
   - Advanced details inside the drawer for cost, supplier, reorder
     points, etc.
   - "Manage Types" panel for the tenant-custom types feature.
   - Row click opens a read-only detail drawer with per-warehouse stock
     and an Archive action.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import type { ColorToken, IconName, UnitOfMeasure } from "@/lib/inventory/types";
import { ALLOWED_COLORS, ALLOWED_ICONS, ALLOWED_UNITS } from "@/lib/inventory/types";
import {
  InventoryEmpty,
  Panel,
  StatusBadge,
  TypeChip,
  TypeIcon,
} from "@/components/inventory/InventoryUi";
import RrIcon from "@/components/ui/RrIcon";

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

function fmtQty(n: number) {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export default function InventoryItems() {
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  /* Search is local while the user types; we copy it into searchKey
     after a 250ms debounce — load() depends on searchKey, not search,
     so we don't refetch on every keystroke. */
  const [search, setSearch] = useState("");
  const [searchKey, setSearchKey] = useState("");
  const [filterTypeId, setFilterTypeId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"active" | "inactive" | "archived" | "">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [typesPanelOpen, setTypesPanelOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* Debounce search. */
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setSearchKey(search.trim()), 250);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (searchKey) qs.set("q", searchKey);
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
  }, [searchKey, filterTypeId, filterStatus]);

  useEffect(() => { void load(); }, [load]);

  /* Type-id → meta map for the type picker filter chip strip. */
  const typeMap = useMemo(() => {
    const m = new Map<string, ItemType>();
    for (const t of types) m.set(t.id, t);
    return m;
  }, [types]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader
          title="Inventory Items"
          subtitle="Products, parts, packaging, supplies — anything physically tracked."
          action={
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTypesPanelOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]"
              >
                <RrIcon name="stamp" size={12} />
                Manage Types
              </button>
              <button
                onClick={() => setQuickAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10]"
              >
                <RrIcon name="plus" size={12} />
                Add Item
              </button>
            </div>
          }
        />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {/* Filters bar — search left, dropdowns center, count right. */}
        <Panel className="px-3 py-2.5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col">
              <span className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Search</span>
              <span className="relative">
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-gray-500">
                  <RrIcon name="search" size={12} />
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, code, brand, SKU…"
                  className="w-[260px] rounded-md border border-white/[0.06] bg-[var(--bg-primary)] py-1.5 pl-7 pr-2 text-[12px]"
                />
              </span>
            </label>
            <label className="flex flex-col">
              <span className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Type</span>
              <select
                value={filterTypeId}
                onChange={(e) => setFilterTypeId(e.target.value)}
                className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              >
                <option value="">All types</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.type_name}{t.is_system ? "" : " · custom"}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col">
              <span className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Status</span>
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
            {filterTypeId && (
              <button
                onClick={() => setFilterTypeId("")}
                className="self-end rounded-md border border-white/[0.06] bg-transparent px-2 py-1.5 text-[11px] text-gray-400 hover:text-gray-200"
              >
                Clear filter
              </button>
            )}
            <div className="ml-auto self-end text-[11px] text-gray-500 tabular-nums">
              {loading ? "…" : `${rows.length} item${rows.length === 1 ? "" : "s"}`}
            </div>
          </div>
        </Panel>

        {/* Items table */}
        <Panel>
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                <th className="px-3 py-2 text-left w-[40px]"></th>
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
                <tr><td colSpan={9} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-0 py-0">
                  <InventoryEmpty
                    title={searchKey || filterTypeId ? "No items match the current filters" : "No items yet"}
                    hint={searchKey || filterTypeId ? "Try clearing filters or broadening your search." : "Create your first item — machines, parts, packaging, supplies, anything you track."}
                    action={
                      <button
                        onClick={() => setQuickAddOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.06] px-3 py-1 text-[11.5px] hover:bg-white/[0.10]"
                      >
                        <RrIcon name="plus" size={11} />
                        Add Item
                      </button>
                    }
                  />
                </td></tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className="cursor-pointer border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.025]"
                  >
                    <td className="px-3 py-2"><TypeIcon icon={r.icon} color={r.color} /></td>
                    <td className="px-3 py-2 font-mono text-[11.5px] text-gray-300">{r.item_code}</td>
                    <td className="px-3 py-2 text-gray-200">{r.item_name}</td>
                    <td className="px-3 py-2">
                      <TypeChip name={r.type_name} icon={r.icon} color={r.color} />
                    </td>
                    <td className="px-3 py-2 text-gray-400">{r.brand ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-400">{r.unit_of_measure}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-mono">{fmtQty(r.qty_on_hand)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-mono text-gray-400">
                      {r.cost_price != null ? Number(r.cost_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>
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

      {selectedId && (
        <ItemDetailDrawer
          itemId={selectedId}
          typeMap={typeMap}
          onClose={() => setSelectedId(null)}
          onChanged={() => { void load(); }}
        />
      )}
    </div>
  );
}

/* ─── Quick Add drawer ──────────────────────────────────── */

function DrawerShell({
  title, onClose, children, footer,
}: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] border-l border-white/[0.08]"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-300 text-[20px] leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-white/[0.06] px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

function QuickAddDrawer({
  types, warehouses, onClose, onSuccess,
}: {
  types: ItemType[];
  warehouses: Warehouse[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [itemName, setItemName] = useState("");
  const initialTypeId =
    types.find((t) => t.is_active && t.type_key === "finished_product")?.id ??
    types.find((t) => t.is_active)?.id ?? "";
  const [typeId, setTypeId] = useState(initialTypeId);
  const [unit, setUnit] = useState<UnitOfMeasure>("pcs");
  const [initialQty, setInitialQty] = useState("");
  const initialWh = warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? "";
  const [warehouseId, setWarehouseId] = useState(initialWh);
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

  const selectedType = types.find((t) => t.id === typeId);

  const submit = async () => {
    if (!itemName.trim()) { setError("Item name required"); return; }
    if (!typeId) { setError("Type required"); return; }
    if (Number(initialQty) > 0 && !warehouseId) {
      setError("Initial quantity needs a destination warehouse");
      return;
    }
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
    <DrawerShell
      title="Add Inventory Item"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-gray-400 hover:text-gray-200">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50"
          >
            {!submitting && <RrIcon name="check" size={12} />}
            {submitting ? "Saving…" : "Create Item"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Item Name *</div>
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            autoFocus
            placeholder="e.g. Lockstitch Machine LX-9000"
            className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
          />
        </label>
        <label className="block">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-gray-500">
            <span>Type *</span>
            {selectedType && <TypeChip name={selectedType.type_name} icon={selectedType.icon} color={selectedType.color} compact />}
          </div>
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
          >
            {types.filter((t) => t.is_active).map((t) => (
              <option key={t.id} value={t.id}>{t.type_name}{t.is_system ? "" : " · custom"}</option>
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
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Initial Qty (optional)</div>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={initialQty}
              onChange={(e) => setInitialQty(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Warehouse</div>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              disabled={warehouses.length === 0}
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] disabled:opacity-50"
            >
              {warehouses.length === 0 && <option value="">—</option>}
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code}{w.is_default ? " · default" : ""}</option>
              ))}
            </select>
          </label>
        </div>
        {Number(initialQty) > 0 && (
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-1.5 text-[10.5px] text-emerald-200/90">
            An opening-balance movement of {initialQty} {unit} will be posted automatically.
          </div>
        )}

        <button
          onClick={() => setAdvanced((s) => !s)}
          className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200"
        >
          <span aria-hidden>{advanced ? "−" : "+"}</span>
          {advanced ? "Hide advanced details" : "Advanced details (brand, SKU, cost, thresholds)"}
        </button>

        {advanced && (
          <div className="space-y-3 rounded-md border border-white/[0.06] p-3">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Brand"        value={brand}        onChange={(e) => setBrand(e.target.value)}        className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
              <input placeholder="SKU"          value={sku}          onChange={(e) => setSku(e.target.value)}          className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
              <input placeholder="Barcode"      value={barcode}      onChange={(e) => setBarcode(e.target.value)}      className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
              <input placeholder="Currency"     value={currency}     onChange={(e) => setCurrency(e.target.value)}     className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
              <input type="number" placeholder="Cost price"    value={costPrice}    onChange={(e) => setCostPrice(e.target.value)}    className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
              <input type="number" placeholder="Reorder point" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
              <input type="number" placeholder="Min stock"     value={minStock}     onChange={(e) => setMinStock(e.target.value)}     className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
              <input type="number" placeholder="Max stock"     value={maxStock}     onChange={(e) => setMaxStock(e.target.value)}     className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
            </div>
            <textarea placeholder="Description / notes" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
          </div>
        )}

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{error}</div>
        )}
      </div>
    </DrawerShell>
  );
}

/* ─── Item detail drawer ─────────────────────────────────── */

interface DetailItem {
  id: string;
  item_code: string;
  item_name: string;
  item_type_id: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  qr_code: string | null;
  unit_of_measure: string;
  cost_price: number | null;
  currency: string | null;
  min_stock: number | null;
  reorder_point: number | null;
  max_stock: number | null;
  is_consumable: boolean;
  is_sellable: boolean;
  is_purchasable: boolean;
  track_stock: boolean;
  description: string | null;
  notes: string | null;
  status: "active" | "inactive" | "archived";
  linked_product_id: string | null;
  created_at: string;
  updated_at: string;
}
interface DetailStockBucket {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
}
interface DetailStock {
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  warehouses: DetailStockBucket[];
}

function ItemDetailDrawer({
  itemId, typeMap, onClose, onChanged,
}: {
  itemId: string;
  typeMap: Map<string, ItemType>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [item, setItem] = useState<DetailItem | null>(null);
  const [stock, setStock] = useState<DetailStock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/inventory/items/${itemId}`, { credentials: "include", cache: "no-store" });
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) { setError(j.error ?? `Failed (${r.status})`); return; }
        setItem(j.item as DetailItem);
        setStock(j.stock as DetailStock);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [itemId]);

  const archive = async () => {
    if (!item) return;
    if (!confirm(`Archive ${item.item_code} — ${item.item_name}? It will stop showing in active pickers.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/inventory/items/${itemId}`, { method: "DELETE", credentials: "include" });
      const j = await r.json();
      if (!r.ok) { alert(j.error ?? "Archive failed"); return; }
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/inventory/items/${itemId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error ?? "Restore failed"); return; }
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const type = item ? typeMap.get(item.item_type_id) : null;

  return (
    <DrawerShell
      title="Inventory Item"
      onClose={onClose}
      footer={
        item ? (
          <div className="flex justify-between gap-2">
            {item.status === "archived" ? (
              <button onClick={restore} disabled={busy} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50">
                Restore
              </button>
            ) : (
              <button onClick={archive} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[12px] text-rose-300 hover:bg-rose-500/20 disabled:opacity-50">
                <RrIcon name="trash" size={12} /> Archive
              </button>
            )}
            <button onClick={onClose} className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-gray-400 hover:text-gray-200">
              Close
            </button>
          </div>
        ) : null
      }
    >
      {loading && <div className="text-[12px] text-gray-500">Loading…</div>}
      {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</div>}
      {item && (
        <div className="space-y-4">
          <div>
            <div className="font-mono text-[11px] text-gray-500">{item.item_code}</div>
            <div className="mt-1 text-[16px] font-medium tracking-tight">{item.item_name}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {type && <TypeChip name={type.type_name} icon={type.icon} color={type.color} />}
              <StatusBadge status={item.status} />
              {item.is_consumable && <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] text-amber-200">Consumable</span>}
              {item.is_sellable && <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] text-emerald-200">Sellable</span>}
            </div>
          </div>

          {/* Stock summary */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">Stock</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-white/[0.05] bg-white/[0.012] px-3 py-2">
                <div className="text-[9.5px] uppercase tracking-[0.10em] text-gray-500">On hand</div>
                <div className="mt-0.5 text-[16px] tabular-nums font-mono">{fmtQty(stock?.total_on_hand ?? 0)}</div>
              </div>
              <div className="rounded-md border border-white/[0.05] bg-white/[0.012] px-3 py-2">
                <div className="text-[9.5px] uppercase tracking-[0.10em] text-gray-500">Reserved</div>
                <div className="mt-0.5 text-[16px] tabular-nums font-mono text-gray-300">{fmtQty(stock?.total_reserved ?? 0)}</div>
              </div>
              <div className="rounded-md border border-white/[0.05] bg-white/[0.012] px-3 py-2">
                <div className="text-[9.5px] uppercase tracking-[0.10em] text-gray-500">Available</div>
                <div className="mt-0.5 text-[16px] tabular-nums font-mono">{fmtQty(stock?.total_available ?? 0)}</div>
              </div>
            </div>
            {(stock?.warehouses?.length ?? 0) > 0 && (
              <div className="mt-3 overflow-hidden rounded-md border border-white/[0.05]">
                <table className="min-w-full text-[11.5px]">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                      <th className="px-2 py-1.5 text-left">Location</th>
                      <th className="px-2 py-1.5 text-right">On hand</th>
                      <th className="px-2 py-1.5 text-right">Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock!.warehouses.map((w) => (
                      <tr key={w.warehouse_id} className="border-b border-white/[0.03] last:border-b-0">
                        <td className="px-2 py-1.5 text-gray-300">{w.warehouse_code} <span className="text-gray-500">· {w.warehouse_name}</span></td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-mono">{fmtQty(w.qty_on_hand)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-mono text-gray-400">{fmtQty(w.qty_available)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Details grid */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">Details</div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
              <DT label="Unit"        value={item.unit_of_measure} />
              <DT label="Brand"       value={item.brand ?? "—"} />
              <DT label="SKU"         value={item.sku ?? "—"} />
              <DT label="Barcode"     value={item.barcode ?? "—"} />
              <DT label="Cost"        value={item.cost_price != null ? `${Number(item.cost_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.currency ?? ""}` : "—"} />
              <DT label="Reorder"     value={item.reorder_point != null ? fmtQty(item.reorder_point) : "—"} />
              <DT label="Min stock"   value={item.min_stock != null ? fmtQty(item.min_stock) : "—"} />
              <DT label="Max stock"   value={item.max_stock != null ? fmtQty(item.max_stock) : "—"} />
              <DT label="Linked product" value={item.linked_product_id ? "Yes" : "—"} />
              <DT label="Track stock" value={item.track_stock ? "Yes" : "No"} />
            </dl>
          </div>

          {(item.description || item.notes) && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-1">Description</div>
              <div className="rounded-md border border-white/[0.05] bg-white/[0.012] px-3 py-2 text-[11.5px] text-gray-300 whitespace-pre-wrap">
                {item.description || item.notes}
              </div>
            </div>
          )}
        </div>
      )}
    </DrawerShell>
  );
}

function DT({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-200 tabular-nums">{value}</dd>
    </>
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
    <DrawerShell title="Item Types" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md border border-white/[0.06] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500">New custom type</div>
            <TypeChip name={name || "Preview"} icon={icon} color={color} compact />
          </div>
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
          <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">All types ({sorted.length})</div>
          <ul className="space-y-1">
            {sorted.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-md border border-white/[0.04] px-2 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <TypeIcon icon={t.icon} color={t.color} />
                  <span className="text-[12px] text-gray-200 truncate">{t.type_name}</span>
                  <span className="text-[10px] text-gray-500 shrink-0">
                    {t.is_system ? "system" : "custom"}{!t.is_active ? " · archived" : ""}
                  </span>
                </div>
                {!t.is_system && t.is_active && (
                  <button onClick={() => archive(t.id)} className="shrink-0 text-[11px] text-rose-300 hover:text-rose-200">Archive</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DrawerShell>
  );
}
