"use client";

/* ---------------------------------------------------------------------------
   /inventory — Dashboard.

   Four KPI tiles (warehouses, items with stock, total on-hand, reserved)
   followed by two sections:
     · Top stock holders   — the eight items with the most on-hand
     · Recent movements    — the last ten posted/draft/voided rows

   The page consciously mirrors the visual rhythm of Finance: hairline
   between sections, eyebrow + heading + "view all" link, no card
   chrome inside sections except a single rounded panel around the
   table. Movement type is humanised; direction is colour-coded.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import { Eyebrow, Hairline } from "@/components/finance/FinanceDashboardUi";
import {
  DirectionDelta,
  InventoryEmpty,
  InventoryKpi,
  Panel,
  StatusBadge,
  movementLabel,
} from "@/components/inventory/InventoryUi";
import RrIcon from "@/components/ui/RrIcon";

interface SummaryMovement {
  id: string;
  movement_no: string;
  movement_date: string;
  movement_type: string;
  direction: "in" | "out";
  quantity: number;
  unit: string;
  status: string;
}
interface SummaryBalance {
  inventory_item_id: string;
  item_code: string;
  item_name: string | null;
  item_type_name: string | null;
  warehouse_code: string;
  warehouse_name: string;
  qty_on_hand: number;
  qty_available: number;
}
interface Summary {
  warehouse_count: number;
  item_count: number;
  total_on_hand: number;
  total_reserved: number;
  recent_movements: SummaryMovement[];
  top_balances: SummaryBalance[];
}

function fmtQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export default function InventoryDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/inventory/summary", {
          credentials: "include",
          cache: "no-store",
        });
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) { setError(j.error ?? `Failed (${r.status})`); return; }
        setSummary(j.summary as Summary);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalStock = summary?.total_on_hand ?? 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader
          title="Inventory"
          subtitle="Stock movements and balances across every location."
          action={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/inventory/items"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]"
              >
                <RrIcon name="box-open" size={12} />
                Items
              </Link>
              <Link
                href="/inventory/movements"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-white/[0.10]"
              >
                <RrIcon name="plus" size={12} />
                New Movement
              </Link>
            </div>
          }
        />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {/* KPI strip — uses InventoryKpi (mirrors Finance KPI rhythm). */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InventoryKpi
            label="Locations"
            value={loading ? "—" : String(summary?.warehouse_count ?? 0)}
            hint="Warehouses + virtual locations"
            tone="info"
          />
          <InventoryKpi
            label="Items in stock"
            value={loading ? "—" : String(summary?.item_count ?? 0)}
            hint="Distinct inventory items on hand"
          />
          <InventoryKpi
            label="Total on-hand"
            value={loading ? "—" : fmtQty(totalStock)}
            hint="Sum across all locations"
            tone="positive"
          />
          <InventoryKpi
            label="Reserved"
            value={loading ? "—" : fmtQty(summary?.total_reserved ?? 0)}
            hint="Committed but not yet shipped"
            tone="warning"
          />
        </div>

        <Hairline />

        {/* Top stock holders. */}
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow>Top stock holders</Eyebrow>
            <Link href="/inventory/balances" className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300">
              View all balances <span aria-hidden>→</span>
            </Link>
          </div>
          <Panel className="mt-3">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Item</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Location</th>
                  <th className="px-4 py-2 text-right">On hand</th>
                  <th className="px-4 py-2 text-right">Available</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
                ) : !summary?.top_balances?.length ? (
                  <tr><td colSpan={6} className="px-0 py-0">
                    <InventoryEmpty
                      title="No stock recorded yet"
                      hint="Create an inventory item with an initial quantity, or post your first movement."
                      action={
                        <Link href="/inventory/items" className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11.5px] hover:bg-white/[0.06]">
                          <RrIcon name="plus" size={11} />
                          Add an item
                        </Link>
                      }
                    />
                  </td></tr>
                ) : (
                  summary.top_balances.map((b) => (
                    <tr key={`${b.inventory_item_id}-${b.warehouse_code}`} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-2 font-mono text-[11.5px] text-gray-300">{b.item_code}</td>
                      <td className="px-4 py-2 text-gray-200">{b.item_name ?? "—"}</td>
                      <td className="px-4 py-2 text-[11px] text-gray-500">{b.item_type_name ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-400">{b.warehouse_code}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-mono">{fmtQty(b.qty_on_hand)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-400">{fmtQty(b.qty_available)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Panel>
        </section>

        {/* Recent movements. */}
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow>Recent movements</Eyebrow>
            <Link href="/inventory/movements" className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300">
              View all <span aria-hidden>→</span>
            </Link>
          </div>
          <Panel className="mt-3">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Movement #</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
                ) : !summary?.recent_movements?.length ? (
                  <tr><td colSpan={5} className="px-0 py-0">
                    <InventoryEmpty
                      title="No movements yet"
                      hint="Stock moves the moment you receive a PO, post an adjustment, or open a balance."
                    />
                  </td></tr>
                ) : (
                  summary.recent_movements.map((m) => (
                    <tr key={m.id} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-2 text-gray-400">{m.movement_date}</td>
                      <td className="px-4 py-2 font-mono text-[11.5px] text-gray-300">{m.movement_no}</td>
                      <td className="px-4 py-2 text-gray-300">{movementLabel(m.movement_type)}</td>
                      <td className="px-4 py-2 text-right">
                        <DirectionDelta direction={m.direction} quantity={m.quantity} unit={m.unit} />
                      </td>
                      <td className="px-4 py-2"><StatusBadge status={m.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Panel>
        </section>
      </div>
    </div>
  );
}
