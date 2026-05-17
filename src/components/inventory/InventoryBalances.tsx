"use client";

/* ---------------------------------------------------------------------------
   /inventory/balances — Derived stock balances per (product, warehouse).
   Read-only — balances cannot be edited; they reflect posted movements.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";

interface Balance {
  id: string;
  product_id: string;
  product_name: string | null;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  last_movement_at: string | null;
}
interface Warehouse { id: string; code: string; name: string }

function fmtQty(n: number) {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export default function InventoryBalances() {
  const [rows, setRows] = useState<Balance[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [filterWh, setFilterWh] = useState("");
  const [onlyPositive, setOnlyPositive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader title="Stock Balances" subtitle="Derived truth — never edited directly." />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] p-3">
          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Warehouse</div>
            <select
              value={filterWh}
              onChange={(e) => setFilterWh(e.target.value)}
              className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            >
              <option value="">All warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[11.5px] text-gray-400">
            <input
              type="checkbox"
              checked={onlyPositive}
              onChange={(e) => setOnlyPositive(e.target.checked)}
            />
            Hide zero on-hand
          </label>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.012]">
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-left">Warehouse</th>
                <th className="px-4 py-2 text-right">On hand</th>
                <th className="px-4 py-2 text-right">Reserved</th>
                <th className="px-4 py-2 text-right">Available</th>
                <th className="px-4 py-2 text-left">Last movement</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-[11px] text-gray-600">No balances to show.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.03]">
                    <td className="px-4 py-2 text-gray-300">{r.product_name ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-400">{r.warehouse_code} <span className="text-gray-600">· {r.warehouse_name}</span></td>
                    <td className="px-4 py-2 text-right tabular-nums font-mono">{fmtQty(r.qty_on_hand)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-400">{fmtQty(r.qty_reserved)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-300">{fmtQty(r.qty_available)}</td>
                    <td className="px-4 py-2 text-[11px] text-gray-500">{r.last_movement_at ? r.last_movement_at.slice(0, 10) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
