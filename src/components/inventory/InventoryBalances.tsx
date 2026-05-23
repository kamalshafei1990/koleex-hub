"use client";

/* ---------------------------------------------------------------------------
   /inventory/balances — Derived stock balances per (item, location).

   Read-only — balances are never edited directly. Filters by warehouse
   and item; location_type is shown so virtual locations (port,
   customer_location, exhibition) are visually distinct from physical
   warehouses.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import {
  InventoryEmpty,
  LocationTypeChip,
  Panel,
} from "@/components/inventory/InventoryUi";
import RrIcon from "@/components/ui/RrIcon";

interface Balance {
  id: string;
  inventory_item_id: string;
  item_code: string;
  item_name: string | null;
  item_type_name: string | null;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  last_movement_at: string | null;
  /* INV-H1 — product identity overlay. */
  product_id?: string | null;
  product_name?: string | null;
  product_slug?: string | null;
  product_image_url?: string | null;
}
interface Warehouse { id: string; code: string; name: string; location_type?: string | null }

/* INV-H4A — drilled row when grouping by item+variant+batch+warehouse. */
interface DrilledRow {
  inventory_item_id: string;
  variant_id: string | null;
  batch_id: string | null;
  warehouse_id: string;
  qty_on_hand: number;
  avg_cost: number;
  inventory_value: number;
  currency: string;
}

type GroupBy = "item" | "variant" | "batch";

function fmtQty(n: number) {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export default function InventoryBalances() {
  const [rows, setRows] = useState<Balance[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [filterWh, setFilterWh] = useState("");
  const [onlyPositive, setOnlyPositive] = useState(true);
  const [search, setSearch] = useState("");
  const [searchKey, setSearchKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /* INV-H4A — group-by control. */
  const [groupBy, setGroupBy] = useState<GroupBy>("item");
  const [drilled, setDrilled] = useState<DrilledRow[]>([]);
  const [variantNames, setVariantNames] = useState<Map<string, string>>(new Map());
  const [batchNos, setBatchNos] = useState<Map<string, string>>(new Map());

  /* Debounced search. */
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setSearchKey(search.trim().toLowerCase()), 200);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (filterWh) qs.set("warehouse_id", filterWh);
      if (onlyPositive) qs.set("only_positive", "1");
      if (groupBy !== "item") qs.set("group_by", "item,variant,batch,warehouse");
      const [bRes, wRes] = await Promise.all([
        fetch(`/api/inventory/balances?${qs.toString()}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/inventory/warehouses`, { credentials: "include", cache: "no-store" }),
      ]);
      const bJ = await bRes.json();
      const wJ = await wRes.json();
      if (!bRes.ok) throw new Error(bJ.error ?? `Failed (${bRes.status})`);
      if (groupBy === "item") {
        setRows((bJ.balances ?? []) as Balance[]);
        setDrilled([]);
      } else {
        setDrilled((bJ.balances ?? []) as DrilledRow[]);
        setRows([]);
        /* Build a lookup for variant + batch names. */
        const variantIds = Array.from(new Set(((bJ.balances ?? []) as DrilledRow[]).map((r) => r.variant_id).filter(Boolean) as string[]));
        const batchIds   = Array.from(new Set(((bJ.balances ?? []) as DrilledRow[]).map((r) => r.batch_id).filter(Boolean) as string[]));
        const [vJ, btJ] = await Promise.all([
          variantIds.length
            ? fetch(`/api/inventory/variants?limit=500`, { credentials: "include", cache: "no-store" }).then((r) => r.json())
            : Promise.resolve({ variants: [] }),
          batchIds.length
            ? fetch(`/api/inventory/batches?limit=500`, { credentials: "include", cache: "no-store" }).then((r) => r.json())
            : Promise.resolve({ batches: [] }),
        ]);
        const vm = new Map<string, string>();
        for (const v of (vJ.variants ?? []) as Array<{ id: string; variant_name: string }>) vm.set(v.id, v.variant_name);
        const bm = new Map<string, string>();
        for (const b of (btJ.batches ?? []) as Array<{ id: string; batch_no: string }>) bm.set(b.id, b.batch_no);
        setVariantNames(vm);
        setBatchNos(bm);
      }
      setWarehouses((wJ.warehouses ?? []) as Warehouse[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filterWh, onlyPositive, groupBy]);

  useEffect(() => { void load(); }, [load]);

  const whMap = useMemo(() => {
    const m = new Map<string, Warehouse>();
    for (const w of warehouses) m.set(w.id, w);
    return m;
  }, [warehouses]);

  const filteredRows = useMemo(() => {
    if (!searchKey) return rows;
    return rows.filter((r) => {
      const hay = `${r.item_code} ${r.item_name ?? ""}`.toLowerCase();
      return hay.includes(searchKey);
    });
  }, [rows, searchKey]);

  /* Totals across the currently-displayed rows. */
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.onHand += r.qty_on_hand;
        acc.reserved += r.qty_reserved;
        acc.available += r.qty_available;
        return acc;
      },
      { onHand: 0, reserved: 0, available: 0 },
    );
  }, [filteredRows]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader title="Stock Balances" subtitle="Derived truth — never edited directly. One row per item × location." />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {/* Filters bar */}
        <Panel className="px-3 py-2.5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col">
              <span className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Search item</span>
              <span className="relative">
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-gray-500">
                  <RrIcon name="search" size={12} />
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Code or item name…"
                  className="w-[220px] rounded-md border border-white/[0.06] bg-[var(--bg-primary)] py-1.5 pl-7 pr-2 text-[12px]"
                />
              </span>
            </label>
            <label className="flex flex-col">
              <span className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Location</span>
              <select value={filterWh} onChange={(e) => setFilterWh(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]">
                <option value="">All locations</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 text-[11.5px] text-gray-400 pb-1.5">
              <input type="checkbox" checked={onlyPositive} onChange={(e) => setOnlyPositive(e.target.checked)} />
              Hide zero on-hand
            </label>
            {/* INV-H4A — Group-by */}
            <label className="flex flex-col">
              <span className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Group by</span>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              >
                <option value="item">Item</option>
                <option value="variant">Item + Variant</option>
                <option value="batch">Item + Variant + Batch</option>
              </select>
            </label>
            <div className="ml-auto flex items-end gap-4 self-end text-[10.5px] text-gray-500 tabular-nums">
              <div>{filteredRows.length} row{filteredRows.length === 1 ? "" : "s"}</div>
              <div>Σ on-hand <span className="ml-1 font-mono text-gray-300">{fmtQty(totals.onHand)}</span></div>
              <div>Σ available <span className="ml-1 font-mono text-gray-300">{fmtQty(totals.available)}</span></div>
            </div>
          </div>
        </Panel>

        {groupBy !== "item" && (
          <Panel>
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                  <th className="px-4 py-2 text-left">Item</th>
                  <th className="px-4 py-2 text-left">Variant</th>
                  {groupBy === "batch" && <th className="px-4 py-2 text-left">Batch</th>}
                  <th className="px-4 py-2 text-left">Location</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Avg cost</th>
                  <th className="px-4 py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {loading && drilled.length === 0 ? (
                  <tr><td colSpan={groupBy === "batch" ? 7 : 6} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
                ) : drilled.length === 0 ? (
                  <tr><td colSpan={groupBy === "batch" ? 7 : 6} className="px-0 py-0">
                    <InventoryEmpty title="No balances yet" hint="Drilled balances appear when posted movements carry variants or batches." />
                  </td></tr>
                ) : (
                  /* When groupBy="variant", collapse rows by (item, variant, warehouse) ignoring batch. */
                  (() => {
                    if (groupBy === "variant") {
                      const buckets = new Map<string, DrilledRow>();
                      for (const r of drilled) {
                        const key = `${r.inventory_item_id}|${r.variant_id ?? ""}|${r.warehouse_id}`;
                        const cur = buckets.get(key) ?? {
                          inventory_item_id: r.inventory_item_id,
                          variant_id: r.variant_id,
                          batch_id: null,
                          warehouse_id: r.warehouse_id,
                          qty_on_hand: 0,
                          avg_cost: 0,
                          inventory_value: 0,
                          currency: r.currency,
                        };
                        const newQty = cur.qty_on_hand + r.qty_on_hand;
                        cur.avg_cost = newQty > 0
                          ? (cur.qty_on_hand * cur.avg_cost + r.qty_on_hand * r.avg_cost) / newQty
                          : 0;
                        cur.qty_on_hand = newQty;
                        cur.inventory_value = cur.inventory_value + r.inventory_value;
                        buckets.set(key, cur);
                      }
                      return Array.from(buckets.values()).map((r, idx) => (
                        <tr key={`v-${idx}`} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]">
                          <td className="px-4 py-2 font-mono text-[11.5px] text-gray-300">{r.inventory_item_id.slice(0, 8)}…</td>
                          <td className="px-4 py-2 text-gray-200">{r.variant_id ? variantNames.get(r.variant_id) ?? r.variant_id.slice(0, 8) : "—"}</td>
                          <td className="px-4 py-2 text-gray-400">{whMap.get(r.warehouse_id)?.code ?? r.warehouse_id.slice(0, 8)}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-mono">{fmtQty(r.qty_on_hand)}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-400">{r.avg_cost.toFixed(4)}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-mono">{r.inventory_value.toFixed(2)} {r.currency}</td>
                        </tr>
                      ));
                    }
                    return drilled.map((r, idx) => (
                      <tr key={`b-${idx}`} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]">
                        <td className="px-4 py-2 font-mono text-[11.5px] text-gray-300">{r.inventory_item_id.slice(0, 8)}…</td>
                        <td className="px-4 py-2 text-gray-200">{r.variant_id ? variantNames.get(r.variant_id) ?? r.variant_id.slice(0, 8) : "—"}</td>
                        <td className="px-4 py-2 text-gray-200">{r.batch_id ? batchNos.get(r.batch_id) ?? r.batch_id.slice(0, 8) : "—"}</td>
                        <td className="px-4 py-2 text-gray-400">{whMap.get(r.warehouse_id)?.code ?? r.warehouse_id.slice(0, 8)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-mono">{fmtQty(r.qty_on_hand)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-400">{r.avg_cost.toFixed(4)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-mono">{r.inventory_value.toFixed(2)} {r.currency}</td>
                      </tr>
                    ));
                  })()
                )}
              </tbody>
            </table>
          </Panel>
        )}

        {groupBy === "item" && (
        <Panel>
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Item</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Location</th>
                <th className="px-4 py-2 text-right">On hand</th>
                <th className="px-4 py-2 text-right">Reserved</th>
                <th className="px-4 py-2 text-right">Available</th>
                <th className="px-4 py-2 text-left">Last movement</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={8} className="px-0 py-0">
                  <InventoryEmpty
                    title={search || filterWh ? "No balances match the filters" : "No balances yet"}
                    hint={search || filterWh ? "Try clearing filters." : "Balances appear automatically as soon as you post stock movements."}
                  />
                </td></tr>
              ) : (
                filteredRows.map((r) => {
                  const wh = whMap.get(r.warehouse_id);
                  return (
                    <tr key={r.id} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-2 font-mono text-[11.5px] text-gray-300 whitespace-nowrap">{r.item_code}</td>
                      <td className="px-4 py-2 text-gray-200">
                        <span className="inline-flex items-center gap-2">
                          {r.product_image_url && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={r.product_image_url} alt="" className="h-7 w-7 rounded object-cover bg-[var(--bg-surface)] shrink-0" />
                          )}
                          <span className="inline-flex flex-col min-w-0">
                            <span className="truncate">{r.product_name ?? r.item_name ?? "—"}</span>
                            {r.product_name && r.item_name && r.product_name !== r.item_name && (
                              <span className="text-[10.5px] text-gray-500 truncate">{r.item_name}</span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[11px] text-gray-500">{r.item_type_name ?? "—"}</td>
                      <td className="px-4 py-2">
                        <div className="inline-flex items-center gap-2">
                          <span className="text-gray-300">{r.warehouse_code}</span>
                          <span className="text-gray-500 text-[11px]">· {r.warehouse_name}</span>
                          <LocationTypeChip type={wh?.location_type ?? "warehouse"} />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-mono">{fmtQty(r.qty_on_hand)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-400">{fmtQty(r.qty_reserved)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-300">{fmtQty(r.qty_available)}</td>
                      <td className="px-4 py-2 text-[11px] text-gray-500">{r.last_movement_at ? r.last_movement_at.slice(0, 10) : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Panel>
        )}
      </div>
    </div>
  );
}
