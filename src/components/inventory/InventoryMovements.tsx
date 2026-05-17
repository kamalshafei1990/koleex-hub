"use client";

/* ---------------------------------------------------------------------------
   /inventory/movements — Movement ledger + new-movement form.
   Now keyed on inventory_item_id (Phase O.2.1).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import type { MovementStatus, MovementType } from "@/lib/inventory/types";

interface Item { id: string; item_code: string; item_name: string }
interface Warehouse { id: string; code: string; name: string; is_default: boolean }
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
  { value: "opening_balance",   label: "Opening Balance",   direction: "in" },
  { value: "purchase_receipt",  label: "Purchase Receipt",  direction: "in" },
  { value: "sales_shipment",    label: "Sales Shipment",    direction: "out" },
  { value: "adjustment_in",     label: "Adjustment IN",     direction: "in" },
  { value: "adjustment_out",    label: "Adjustment OUT",    direction: "out" },
  { value: "transfer_in",       label: "Transfer IN",       direction: "in" },
  { value: "transfer_out",      label: "Transfer OUT",      direction: "out" },
  { value: "return_in",         label: "Return IN",         direction: "in" },
  { value: "return_out",        label: "Return OUT",        direction: "out" },
  { value: "manual",            label: "Manual",            direction: "either" },
];

function fmtQty(n: number): string {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export default function InventoryMovements() {
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Form */
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

  const itemMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items) m.set(i.id, `${i.item_code} · ${i.item_name}`);
    return m;
  }, [items]);
  const warehouseMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouses) m.set(w.id, w.code);
    return m;
  }, [warehouses]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mvRes, itemRes, whRes] = await Promise.all([
        fetch("/api/inventory/movements?limit=100", { cache: "no-store", credentials: "include" }),
        fetch("/api/inventory/items?status=active&limit=500", { cache: "no-store", credentials: "include" }),
        fetch("/api/inventory/warehouses", { cache: "no-store", credentials: "include" }),
      ]);
      const mvJ = await mvRes.json();
      const itemJ = await itemRes.json();
      const whJ = await whRes.json();
      if (!mvRes.ok) throw new Error(mvJ.error ?? `Movements failed (${mvRes.status})`);
      setMovements((mvJ.movements ?? []) as MovementRow[]);
      setItems(((itemJ.items ?? []) as Array<{ id: string; item_code: string; item_name: string }>).map((i) => ({ id: i.id, item_code: i.item_code, item_name: i.item_name })));
      const whList = ((whJ.warehouses ?? []) as Warehouse[]);
      setWarehouses(whList);
      if (!warehouseId && whList.length > 0) {
        const def = whList.find((w) => w.is_default) ?? whList[0];
        setWarehouseId(def.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => { void load(); }, [load]);

  const onTypeChange = (next: MovementType) => {
    setType(next);
    const def = MOVEMENT_TYPES.find((t) => t.value === next);
    if (def && def.direction !== "either") setDirection(def.direction);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const qty = Number(quantity);
    if (!itemId) { setSubmitError("Pick an inventory item"); return; }
    if (!warehouseId) { setSubmitError("Pick a warehouse"); return; }
    if (!Number.isFinite(qty) || qty <= 0) { setSubmitError("Quantity must be > 0"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/inventory/movements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory_item_id: itemId,
          warehouse_id: warehouseId,
          movement_type: type,
          direction,
          quantity: qty,
          unit,
          reference: reference || null,
          notes: notes || null,
          post: true,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setSubmitError(j.error ?? `Failed (${r.status})`); return; }
      setQuantity(""); setReference(""); setNotes("");
      await load();
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
    if (!r.ok) { alert(j.error ?? `Failed (${r.status})`); return; }
    await load();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader title="Stock Movements" subtitle="Append-only ledger of inventory changes." />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr,360px]">
          <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.012]">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Movement #</th>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">WH</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {loading && movements.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
                ) : movements.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-[11px] text-gray-600">No movements yet.</td></tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="border-b border-white/[0.03]">
                      <td className="px-3 py-1.5 text-gray-400">{m.movement_date}</td>
                      <td className="px-3 py-1.5 font-mono text-[11.5px] text-gray-300">{m.movement_no}</td>
                      <td className="px-3 py-1.5 text-gray-300">{itemMap.get(m.inventory_item_id) ?? "—"}</td>
                      <td className="px-3 py-1.5 text-gray-400">{warehouseMap.get(m.warehouse_id) ?? "?"}</td>
                      <td className="px-3 py-1.5 text-gray-400">{m.movement_type}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums font-mono ${m.direction === "in" ? "text-emerald-200" : "text-rose-200"}`}>
                        {m.direction === "in" ? "+" : "−"}{fmtQty(m.quantity)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.10em] ${
                          m.status === "posted" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" :
                          m.status === "voided" ? "border-gray-500/30 bg-gray-500/10 text-gray-400" :
                          "border-amber-400/30 bg-amber-500/10 text-amber-200"
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {m.status === "posted" && (
                          <button onClick={() => voidMovement(m.id)} className="text-[11px] text-rose-300 hover:text-rose-200">
                            Void
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <form onSubmit={submit} className="space-y-3 rounded-xl border border-white/[0.05] bg-white/[0.012] p-4 self-start">
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500">New Movement</div>

            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Inventory Item</div>
              <input
                list="inv-item-list"
                value={itemQuery}
                onChange={(e) => {
                  setItemQuery(e.target.value);
                  const match = items.find((i) => `${i.item_code} · ${i.item_name}` === e.target.value || i.item_code === e.target.value);
                  setItemId(match?.id ?? "");
                }}
                placeholder="Search items by code or name…"
                className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
              <datalist id="inv-item-list">
                {items.slice(0, 300).map((i) => (
                  <option key={i.id} value={`${i.item_code} · ${i.item_name}`} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Warehouse</div>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]">
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
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
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="GR-…, PO-…" className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </label>

            <label className="block">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Notes</div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </label>

            {submitError && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{submitError}</div>
            )}

            <button type="submit" disabled={submitting} className="w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06] disabled:opacity-50">
              {submitting ? "Posting…" : "Post Movement"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
