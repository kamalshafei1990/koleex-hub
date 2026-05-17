"use client";

/* ---------------------------------------------------------------------------
   /inventory  Dashboard — at-a-glance inventory state for the tenant.
   Three KPIs (warehouses, products with stock, total on-hand), then
   the top stock-holding products + recent movements feed.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import { Eyebrow, Hairline } from "@/components/finance/FinanceDashboardUi";
import Link from "next/link";

interface SummaryMovement {
  id: string;
  movement_no: string;
  movement_date: string;
  movement_type: string;
  direction: "in" | "out";
  quantity: number;
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
        if (!r.ok) {
          setError(j.error ?? `Failed (${r.status})`);
          return;
        }
        setSummary(j.summary as Summary);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader
          title="Inventory"
          subtitle="Stock movements and balances across your warehouses."
          action={
            <Link
              href="/inventory/movements"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-white/[0.06]"
            >
              + New Movement
            </Link>
          }
        />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {loading && !summary && (
          <div className="text-[12px] text-gray-500">Loading…</div>
        )}

        {summary && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiTile label="Warehouses" value={String(summary.warehouse_count)} hint="Active locations" />
              <KpiTile label="Items with stock" value={String(summary.item_count)} hint="Distinct inventory items on hand" />
              <KpiTile label="Total on-hand" value={fmtQty(summary.total_on_hand)} hint="Sum across all warehouses" />
              <KpiTile label="Reserved" value={fmtQty(summary.total_reserved)} hint="Held for committed orders" />
            </div>

            <Hairline />

            <section>
              <div className="flex items-baseline justify-between">
                <Eyebrow>Top stock holders</Eyebrow>
                <Link href="/inventory/balances" className="text-[11px] text-gray-500 hover:text-gray-300">
                  View all balances →
                </Link>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.012]">
                <table className="min-w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                      <th className="px-4 py-2 text-left">Code</th>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-left">Warehouse</th>
                      <th className="px-4 py-2 text-right">On hand</th>
                      <th className="px-4 py-2 text-right">Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.top_balances.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-[11px] text-gray-600">
                          No stock recorded yet. Add an item with initial quantity or post your first movement.
                        </td>
                      </tr>
                    ) : (
                      summary.top_balances.map((b) => (
                        <tr key={`${b.inventory_item_id}-${b.warehouse_code}`} className="border-b border-white/[0.03]">
                          <td className="px-4 py-2 font-mono text-[11.5px] text-gray-300">{b.item_code}</td>
                          <td className="px-4 py-2 text-gray-300">{b.item_name ?? "—"}</td>
                          <td className="px-4 py-2 text-gray-400">{b.warehouse_code}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-mono">{fmtQty(b.qty_on_hand)}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-400">{fmtQty(b.qty_available)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <div className="flex items-baseline justify-between">
                <Eyebrow>Recent movements</Eyebrow>
                <Link href="/inventory/movements" className="text-[11px] text-gray-500 hover:text-gray-300">
                  View all →
                </Link>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.012]">
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
                    {summary.recent_movements.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-[11px] text-gray-600">
                          No movements yet.
                        </td>
                      </tr>
                    ) : (
                      summary.recent_movements.map((m) => (
                        <tr key={m.id} className="border-b border-white/[0.03]">
                          <td className="px-4 py-2 text-gray-400">{m.movement_date}</td>
                          <td className="px-4 py-2 font-mono text-[11.5px] text-gray-300">{m.movement_no}</td>
                          <td className="px-4 py-2 text-gray-400">{m.movement_type}</td>
                          <td className={`px-4 py-2 text-right tabular-nums font-mono ${m.direction === "in" ? "text-emerald-200" : "text-rose-200"}`}>
                            {m.direction === "in" ? "+" : "−"}{fmtQty(m.quantity)}
                          </td>
                          <td className="px-4 py-2 text-[11px] text-gray-500">{m.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function KpiTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500">{label}</div>
      <div className="mt-1 text-[22px] font-medium tabular-nums">{value}</div>
      <div className="mt-1 text-[10.5px] text-gray-600">{hint}</div>
    </div>
  );
}
