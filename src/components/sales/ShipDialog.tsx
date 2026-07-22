"use client";

/* ---------------------------------------------------------------------------
   ShipDialog — Phase O.4.1.

   Loads the SO detail (which now carries per-line live stock totals
   and a breakdown by location), shows ordered / shipped / remaining
   per line plus available stock both globally and at the chosen
   source location. Inline validation visually blocks over-ship.

   The shipment-history block at the bottom links each shipment to its
   detail page and exposes a Void action when status='shipped'.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import RrIcon from "@/components/ui/RrIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import {
  Panel,
  StatusBadge,
} from "@/components/inventory/InventoryUi";

interface SoItem {
  id: string;
  description: string | null;
  inventory_item_id: string | null;
  qty: number;
  qty_shipped: number;
  unit_price: number;
  total_on_hand: number;
  available_locations: Array<{
    warehouse_id: string;
    warehouse_code: string;
    warehouse_name: string;
    location_type: string;
    qty_on_hand: number;
  }>;
}
interface SoDetail {
  order: {
    id: string;
    so_no: string | null;
    status: string;
    currency: string;
    customer_name: string | null;
  };
  items: SoItem[];
  shipments: Array<{
    id: string;
    shipment_no: string;
    status: string;
    shipped_at: string | null;
    tracking_no: string | null;
    source_location_code: string | null;
    source_location_name: string | null;
    total_qty: number;
  }>;
}
interface Warehouse { id: string; code: string; name: string; is_default: boolean; location_type?: string | null }

function fmtQty(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export default function ShipDialog({
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

  /* Per-line: available stock at the currently-selected source location. */
  const stockAtSource = useCallback((it: SoItem): number => {
    if (!sourceLocationId) return 0;
    const bucket = it.available_locations.find((b) => b.warehouse_id === sourceLocationId);
    return bucket?.qty_on_hand ?? 0;
  }, [sourceLocationId]);

  /* Per-line validation. Returns { ok, reason } so we can colour the
     row and disable Confirm if anything is off. */
  type LineState = { qty: number; remaining: number; stock: number; ok: boolean; reason: string | null };
  const lineStates: Record<string, LineState> = useMemo(() => {
    const out: Record<string, LineState> = {};
    if (!detail) return out;
    for (const it of detail.items) {
      const q = Number(lineQty[it.id]) || 0;
      const remaining = Math.max(0, Number(it.qty) - Number(it.qty_shipped));
      const stock = stockAtSource(it);
      let ok = true;
      let reason: string | null = null;
      if (q < 0) { ok = false; reason = "Negative"; }
      else if (q > remaining + 0.0001) { ok = false; reason = "Over-ship"; }
      else if (it.inventory_item_id && q > stock + 0.0001) { ok = false; reason = "Not enough stock here"; }
      out[it.id] = { qty: q, remaining, stock, ok, reason };
    }
    return out;
  }, [detail, lineQty, stockAtSource]);

  const totalToShip = useMemo(() => Object.values(lineStates).reduce((acc, s) => acc + s.qty, 0), [lineStates]);
  const hasBlocker = Object.values(lineStates).some((s) => !s.ok && s.qty > 0);

  const submit = async () => {
    if (!detail) return;
    setError(null);
    const lines = detail.items
      .map((it) => {
        const q = lineStates[it.id]?.qty ?? 0;
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
      if (!r.ok) { setError(humanizeError(j.error ?? `HTTP ${r.status}`)); return; }
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
    if (!r.ok) { alert(humanizeError(j.error ?? `HTTP ${r.status}`)); return; }
    await load();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-xl border border-white/[0.08] bg-[var(--bg-primary)] text-[var(--text-primary)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold">Ship Sales Order</h2>
            <p className="text-[11px] text-gray-500 truncate">
              {detail ? (
                <>
                  <span className="font-mono">SO {detail.order.so_no}</span>
                  <span className="mx-1.5 text-gray-600">·</span>
                  {detail.order.customer_name ?? "—"}
                  <span className="mx-1.5 text-gray-600">·</span>
                  {detail.items.length} line{detail.items.length === 1 ? "" : "s"}
                </>
              ) : "Loading…"}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-300 text-[20px] leading-none">×</button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-4 space-y-4">
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
                      <th className="px-3 py-2 text-right">Stock here</th>
                      <th className="px-3 py-2 text-right">Total on hand</th>
                      <th className="px-3 py-2 text-right">This shipment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it) => {
                      const st = lineStates[it.id] ?? { qty: 0, remaining: 0, stock: 0, ok: true, reason: null };
                      const trackedNote = it.inventory_item_id ? null : "non-stock";
                      const rowCls =
                        st.qty > 0 && !st.ok ? "bg-rose-500/[0.04]" :
                        st.qty > 0           ? "bg-emerald-500/[0.025]" :
                                               "";
                      return (
                        <tr key={it.id} className={`border-b border-white/[0.03] last:border-b-0 ${rowCls}`}>
                          <td className="px-3 py-1.5 text-gray-300">
                            <div className="flex items-center gap-1.5">
                              <span>{it.description ?? it.inventory_item_id?.slice(0, 8) ?? "—"}</span>
                              {trackedNote && (
                                <span className="text-[10.5px] text-amber-300/80">· {trackedNote}</span>
                              )}
                            </div>
                            {it.inventory_item_id && it.available_locations.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10.5px] text-gray-500">
                                <span className="text-gray-600">Top:</span>
                                {it.available_locations.slice(0, 3).map((b) => (
                                  <span key={b.warehouse_id} className={`rounded border border-white/[0.04] px-1 py-px ${b.warehouse_id === sourceLocationId ? "bg-white/[0.04] text-gray-300" : ""}`}>
                                    {b.warehouse_code} <span className="font-mono">{fmtQty(b.qty_on_hand)}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono text-gray-400">{fmtQty(it.qty)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono text-gray-500">{fmtQty(it.qty_shipped)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono">{fmtQty(st.remaining)}</td>
                          <td className={`px-3 py-1.5 text-right tabular-nums font-mono ${it.inventory_item_id ? (st.stock <= 0 ? "text-rose-300" : "text-gray-300") : "text-gray-600"}`}>
                            {it.inventory_item_id ? fmtQty(st.stock) : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono text-gray-400">{it.inventory_item_id ? fmtQty(it.total_on_hand) : "—"}</td>
                          <td className="px-3 py-1.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const cap = it.inventory_item_id
                                    ? Math.min(st.remaining, st.stock)
                                    : st.remaining;
                                  setLineQty((s) => ({ ...s, [it.id]: String(Math.max(0, cap)) }));
                                }}
                                className="rounded-md border border-white/[0.06] px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-200"
                                title="Fill with the max we can ship from this location"
                              >
                                Max
                              </button>
                              <input
                                type="number"
                                min="0"
                                step="0.0001"
                                max={st.remaining}
                                value={lineQty[it.id] ?? ""}
                                onChange={(e) => setLineQty((s) => ({ ...s, [it.id]: e.target.value }))}
                                className={`w-24 rounded-md border bg-[var(--bg-primary)] px-1.5 py-1 text-right text-[11.5px] tabular-nums ${
                                  st.qty > 0 && !st.ok ? "border-rose-500/40" : "border-white/[0.06]"
                                }`}
                              />
                            </div>
                            {st.qty > 0 && st.reason && (
                              <div className="mt-0.5 text-right text-[10.5px] text-rose-300">{st.reason}</div>
                            )}
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
                  <Panel>
                    <table className="min-w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                          <th className="px-3 py-1.5 text-left">Shipment #</th>
                          <th className="px-3 py-1.5 text-left">Status</th>
                          <th className="px-3 py-1.5 text-left">Date</th>
                          <th className="px-3 py-1.5 text-left">Location</th>
                          <th className="px-3 py-1.5 text-right">Qty</th>
                          <th className="px-3 py-1.5 text-left">Tracking</th>
                          <th className="px-3 py-1.5 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.shipments.map((s) => (
                          <tr key={s.id} className="border-b border-white/[0.03] last:border-b-0">
                            <td className="px-3 py-1.5 font-mono text-[11.5px] text-gray-300">{s.shipment_no}</td>
                            <td className="px-3 py-1.5"><StatusBadge status={s.status} /></td>
                            <td className="px-3 py-1.5 text-[11px] text-gray-500">{s.shipped_at?.slice(0, 10) ?? "—"}</td>
                            <td className="px-3 py-1.5 text-[11px] text-gray-400">{s.source_location_code ?? "—"}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums font-mono">{fmtQty(s.total_qty)}</td>
                            <td className="px-3 py-1.5 text-[11px] text-gray-400">{s.tracking_no ?? "—"}</td>
                            <td className="px-3 py-1.5 text-right">
                              {s.status === "shipped" && (
                                <button onClick={() => voidShipment(s.id)} className="text-[11px] text-rose-300 hover:text-rose-200">Void</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Panel>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
          <span className={`text-[11px] ${hasBlocker ? "text-rose-300" : "text-gray-500"}`}>
            {hasBlocker
              ? "Some lines exceed available stock or remaining qty."
              : totalToShip > 0 ? `${totalToShip} units will leave inventory` : "No quantities entered"}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-gray-400 hover:text-gray-200">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || !detail || totalToShip <= 0 || hasBlocker}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50 disabled:hover:bg-white/[0.06]"
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
