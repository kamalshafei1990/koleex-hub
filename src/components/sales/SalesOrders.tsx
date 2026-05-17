"use client";

/* ---------------------------------------------------------------------------
   /sales/orders — Sales Order list + Shipment dialog (Phase O.4).

   Minimal surface, focused on the operational outbound flow:
     · table of recent SOs with status badge + Ship button
     · ShipDialog: pick source location, enter qty per line, tracking,
       notes; clear "ordered / shipped / remaining" per line
     · Void shipment from the shipment history list inside the dialog
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RrIcon from "@/components/ui/RrIcon";
import {
  InventoryEmpty,
  Panel,
  StatusBadge,
} from "@/components/inventory/InventoryUi";

interface SoRow {
  id: string;
  so_no: string | null;
  customer_id: string | null;
  status: "draft" | "confirmed" | "partial" | "shipped" | "closed" | "cancelled";
  currency: string;
  notes: string | null;
  created_at: string;
}

export default function SalesOrders() {
  const [rows, setRows] = useState<SoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shipSoId, setShipSoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/sales/orders?limit=100", { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Failed (${r.status})`);
      setRows((j.orders ?? []) as SoRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              aria-label="Back to Hub"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
            >
              <RrIcon name="arrow-left" size={16} />
            </Link>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
              <RrIcon name="file-invoice" size={16} />
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight md:text-[22px]">Sales Orders</h1>
              <p className="hidden text-[12px] text-[var(--text-dim)] sm:block">Outbound flow — order → shipment → inventory OUT.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/sales"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]"
            >
              Sales Hub
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        <Panel>
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                <th className="px-4 py-2 text-left">SO #</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Currency</th>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-[11px] text-gray-600">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-0 py-0">
                  <InventoryEmpty
                    title="No sales orders yet"
                    hint="Sales orders are created upstream (quotation → SO). This page surfaces them so you can ship."
                  />
                </td></tr>
              ) : (
                rows.map((s) => {
                  const canShip = s.status === "confirmed" || s.status === "partial";
                  return (
                    <tr key={s.id} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-2 font-mono text-[11.5px] text-gray-300 whitespace-nowrap">{s.so_no ?? s.id.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-[11px] text-gray-400">{s.customer_id ? s.customer_id.slice(0, 8) : "—"}</td>
                      <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-2 text-[11px] text-gray-400">{s.currency}</td>
                      <td className="px-4 py-2 text-[11px] text-gray-500">{s.created_at.slice(0, 10)}</td>
                      <td className="px-4 py-2 text-right">
                        {canShip && (
                          <button
                            onClick={() => setShipSoId(s.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-white/[0.10] bg-white/[0.04] px-2.5 py-1 text-[11.5px] hover:bg-white/[0.08]"
                          >
                            <RrIcon name="truck-side" size={11} /> Ship
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

      {shipSoId && (
        <ShipDialog
          soId={shipSoId}
          onClose={() => setShipSoId(null)}
          onSuccess={() => { setShipSoId(null); void load(); }}
        />
      )}
    </div>
  );
}

/* ─── Ship dialog ──────────────────────────────────────── */

interface SoItem {
  id: string;
  description: string | null;
  inventory_item_id: string | null;
  qty: number;
  qty_shipped: number;
  unit_price: number;
}
interface SoDetail {
  order: {
    id: string;
    so_no: string | null;
    status: string;
    currency: string;
    customer_id: string | null;
  };
  items: SoItem[];
  shipments: Array<{ id: string; shipment_no: string; status: string; shipped_at: string | null; tracking_no: string | null }>;
}
interface Warehouse { id: string; code: string; name: string; is_default: boolean; location_type?: string | null }

function ShipDialog({
  soId, onClose, onSuccess,
}: { soId: string; onClose: () => void; onSuccess: () => void }) {
  const [detail, setDetail] = useState<SoDetail | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sourceLocationId, setSourceLocationId] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [notes, setNotes] = useState("");
  const [lineQty, setLineQty] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, wRes] = await Promise.all([
        fetch(`/api/sales/orders/${soId}`, { credentials: "include", cache: "no-store" }),
        fetch("/api/inventory/warehouses", { credentials: "include", cache: "no-store" }),
      ]);
      const sJ = (await sRes.json()) as SoDetail | { error: string };
      const wJ = await wRes.json();
      if (!sRes.ok || !("order" in sJ)) { setError("Failed to load SO"); return; }
      setDetail(sJ);
      const whs = (wJ.warehouses ?? []) as Warehouse[];
      setWarehouses(whs);
      const def = whs.find((w) => w.is_default) ?? whs.find((w) => (w.location_type ?? "warehouse") === "warehouse") ?? whs[0];
      if (def) setSourceLocationId(def.id);
      const init: Record<string, string> = {};
      for (const it of sJ.items) {
        const remaining = Math.max(0, Number(it.qty) - Number(it.qty_shipped));
        init[it.id] = remaining > 0 ? String(remaining) : "";
      }
      setLineQty(init);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [soId]);

  useEffect(() => { void load(); }, [load]);

  const totalToShip = useMemo(() => {
    if (!detail) return 0;
    return detail.items.reduce((acc, it) => acc + (Number(lineQty[it.id]) || 0), 0);
  }, [detail, lineQty]);

  const submit = async () => {
    if (!detail) return;
    setError(null);
    const lines = detail.items
      .map((it) => {
        const q = Number(lineQty[it.id]) || 0;
        if (q <= 0) return null;
        return { sales_order_item_id: it.id, qty: q };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
    if (lines.length === 0) { setError("Enter at least one quantity"); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/sales/orders/${soId}/ship`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_location_id: sourceLocationId || null,
          tracking_no: trackingNo || null,
          notes: notes || null,
          lines,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? `Failed (${r.status})`); return; }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  const voidShipment = async (id: string) => {
    if (!confirm("Void this shipment? Stock will be restored and qty_shipped will roll back.")) return;
    const reason = prompt("Reason (optional):") ?? null;
    const r = await fetch(`/api/sales/shipments/${id}/void`, {
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border border-white/[0.08] bg-[var(--bg-primary)] text-[var(--text-primary)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">Ship Sales Order</h2>
            <p className="text-[11px] text-gray-500">
              {detail?.order.so_no ? `SO ${detail.order.so_no}` : "Loading…"} · {detail ? `${detail.items.length} line${detail.items.length === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-300 text-[20px] leading-none">×</button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
          {loading && !detail && <div className="text-[12px] text-gray-500">Loading SO…</div>}
          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</div>
          )}

          {detail && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-1">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Source location</div>
                  <select
                    value={sourceLocationId}
                    onChange={(e) => setSourceLocationId(e.target.value)}
                    className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Tracking #</div>
                  <input
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                    placeholder="DHL, AWB, courier ref…"
                    className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Notes</div>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                  />
                </label>
              </div>

              <Panel>
                <table className="min-w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Ordered</th>
                      <th className="px-3 py-2 text-right">Shipped</th>
                      <th className="px-3 py-2 text-right">Remaining</th>
                      <th className="px-3 py-2 text-right">This shipment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it) => {
                      const remaining = Math.max(0, Number(it.qty) - Number(it.qty_shipped));
                      const trackedNote = it.inventory_item_id ? null : "non-stock";
                      return (
                        <tr key={it.id} className="border-b border-white/[0.03] last:border-b-0">
                          <td className="px-3 py-1.5 text-gray-300">
                            {it.description ?? it.inventory_item_id?.slice(0, 8) ?? "—"}
                            {trackedNote && <span className="ml-1.5 text-[10.5px] text-amber-300/80">· {trackedNote}</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono text-gray-400">{it.qty}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono text-gray-500">{it.qty_shipped}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono">{remaining}</td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              max={remaining}
                              value={lineQty[it.id] ?? ""}
                              onChange={(e) => setLineQty((s) => ({ ...s, [it.id]: e.target.value }))}
                              className="w-24 rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-1.5 py-1 text-right text-[11.5px] tabular-nums"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>

              {detail.shipments.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">Shipment history</div>
                  <ul className="space-y-1 text-[11.5px]">
                    {detail.shipments.map((s) => (
                      <li key={s.id} className="flex items-center justify-between rounded-md border border-white/[0.04] px-2 py-1.5">
                        <span className="flex items-center gap-2 text-gray-300">
                          <span className="font-mono">{s.shipment_no}</span>
                          <StatusBadge status={s.status} />
                          {s.shipped_at && <span className="text-gray-500">{s.shipped_at.slice(0, 10)}</span>}
                          {s.tracking_no && <span className="text-gray-500">· {s.tracking_no}</span>}
                        </span>
                        {s.status === "shipped" && (
                          <button onClick={() => voidShipment(s.id)} className="text-[11px] text-rose-300 hover:text-rose-200">Void</button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
          <span className="text-[11px] text-gray-500">
            {totalToShip > 0 ? `${totalToShip} units will leave inventory` : "No quantities entered"}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-gray-400 hover:text-gray-200">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || !detail || totalToShip <= 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50"
            >
              {!submitting && <RrIcon name="truck-side" size={12} />}
              {submitting ? "Posting…" : "Confirm shipment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
