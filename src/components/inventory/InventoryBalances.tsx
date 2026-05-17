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
}
interface Warehouse { id: string; code: string; name: string; location_type?: string | null }

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
      const [bRes, wRes] = await Promise.all([
        fetch(`/api/inventory/balances?${qs.toString()}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/inventory/warehouses`, { credentials: "include", cache: "no-store" }),
      ]);
      const bJ = await bRes.json();
      const wJ = await wRes.json();
      if (!bRes.ok) throw new Error(bJ.error ?? `Failed (${bRes.status})`);
      setRows((bJ.balances ?? []) as Balance[]);
      setWarehouses((wJ.warehouses ?? []) as Warehouse[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filterWh, onlyPositive]);

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
            <div className="ml-auto flex items-end gap-4 self-end text-[10.5px] text-gray-500 tabular-nums">
              <div>{filteredRows.length} row{filteredRows.length === 1 ? "" : "s"}</div>
              <div>Σ on-hand <span className="ml-1 font-mono text-gray-300">{fmtQty(totals.onHand)}</span></div>
              <div>Σ available <span className="ml-1 font-mono text-gray-300">{fmtQty(totals.available)}</span></div>
            </div>
          </div>
        </Panel>

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
                      <td className="px-4 py-2 text-gray-200">{r.item_name ?? "—"}</td>
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
      </div>
    </div>
  );
}
