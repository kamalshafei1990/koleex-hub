"use client";

/* ---------------------------------------------------------------------------
   ReceiveDialog — Phase O.3.
   Open from any PO row. Loads the PO's items, lets the operator fill
   in qty received / accepted / rejected per line + pick a warehouse,
   then POSTs to /api/purchase/orders/[id]/receive. The server creates
   the receipt + inventory movements atomically.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";

interface POItem {
  id: string;
  description: string | null;
  product_id: string | null;
  qty: number;
  qty_received: number;
  unit: string | null;
  unit_cost: number;
}
interface PODetail {
  order: {
    id: string;
    po_no: string | null;
    status: string;
    currency: string | null;
    supplier_id: string;
  };
  items: POItem[];
  receipts: Array<{ id: string; gr_no: string | null; status: string; received_at: string | null; posted_at: string | null }>;
  receipt_items: Array<{ id: string; receipt_id: string; po_item_id: string | null; qty_accepted: number; inventory_movement_id: string | null }>;
}
interface Warehouse { id: string; code: string; name: string; is_default: boolean }

interface LineState { qty_received: string; qty_accepted: string; qty_rejected: string }

export default function ReceiveDialog({
  open,
  poId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  poId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [detail, setDetail] = useState<PODetail | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [notes, setNotes] = useState("");
  const [lineState, setLineState] = useState<Record<string, LineState>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, wRes] = await Promise.all([
        fetch(`/api/purchase/orders/${poId}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/inventory/warehouses`, { credentials: "include", cache: "no-store" }),
      ]);
      const pJ = (await pRes.json()) as PODetail | { error: string };
      const wJ = await wRes.json();
      if (!pRes.ok || !("order" in pJ)) {
        setError("Failed to load PO");
        return;
      }
      setDetail(pJ);
      const whs = (wJ.warehouses ?? []) as Warehouse[];
      setWarehouses(whs);
      const def = whs.find((w) => w.is_default) ?? whs[0];
      if (def) setWarehouseId(def.id);
      const init: Record<string, LineState> = {};
      for (const it of pJ.items) {
        const remaining = Math.max(0, Number(it.qty) - Number(it.qty_received));
        init[it.id] = {
          qty_received: remaining > 0 ? String(remaining) : "",
          qty_accepted: remaining > 0 ? String(remaining) : "",
          qty_rejected: "0",
        };
      }
      setLineState(init);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    if (open) void load();
    else {
      setDetail(null);
      setError(null);
      setSubmitting(false);
    }
  }, [open, load]);

  const updateLine = (poItemId: string, key: keyof LineState, val: string) => {
    setLineState((s) => ({ ...s, [poItemId]: { ...s[poItemId], [key]: val } }));
  };

  const remainingFor = useCallback(
    (it: POItem) => Math.max(0, Number(it.qty) - Number(it.qty_received)),
    [],
  );

  const totalToReceive = useMemo(() => {
    if (!detail) return 0;
    return detail.items.reduce((acc, it) => acc + (Number(lineState[it.id]?.qty_accepted) || 0), 0);
  }, [detail, lineState]);

  const submit = async () => {
    if (!detail) return;
    setError(null);

    const lines = detail.items
      .map((it) => {
        const s = lineState[it.id];
        const qr = Number(s?.qty_received) || 0;
        if (qr <= 0) return null;
        return {
          po_item_id: it.id,
          qty_received: qr,
          qty_accepted: Number(s?.qty_accepted) || 0,
          qty_rejected: Number(s?.qty_rejected) || 0,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (lines.length === 0) {
      setError("Enter at least one line to receive");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch(`/api/purchase/orders/${poId}/receive`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id: warehouseId || null,
          carrier: carrier || null,
          tracking_no: trackingNo || null,
          notes: notes || null,
          lines,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? `Failed (${r.status})`);
        return;
      }
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-white/[0.08] bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">Receive Goods</h2>
            <p className="text-[11px] text-gray-500">
              {detail?.order.po_no ? `PO ${detail.order.po_no}` : "Loading…"} ·{" "}
              {detail ? `${detail.items.length} line${detail.items.length === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-[18px]">×</button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
          {loading && !detail && <div className="text-[12px] text-gray-500">Loading PO…</div>}

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
              {error}
            </div>
          )}

          {detail && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-1">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Warehouse</div>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Carrier</div>
                  <input
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Tracking #</div>
                  <input
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                    className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                  />
                </label>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.012]">
                <table className="min-w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Ordered</th>
                      <th className="px-3 py-2 text-right">Already</th>
                      <th className="px-3 py-2 text-right">Remaining</th>
                      <th className="px-3 py-2 text-right">Received</th>
                      <th className="px-3 py-2 text-right">Accepted</th>
                      <th className="px-3 py-2 text-right">Rejected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it) => {
                      const s = lineState[it.id] ?? { qty_received: "", qty_accepted: "", qty_rejected: "0" };
                      const remaining = remainingFor(it);
                      return (
                        <tr key={it.id} className="border-b border-white/[0.03]">
                          <td className="px-3 py-1.5 text-gray-300">{it.description ?? it.product_id?.slice(0, 8) ?? "—"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono text-gray-400">{it.qty}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono text-gray-500">{it.qty_received}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono">{remaining}</td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={s.qty_received}
                              onChange={(e) => updateLine(it.id, "qty_received", e.target.value)}
                              className="w-20 rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-1.5 py-1 text-right text-[11.5px] tabular-nums"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={s.qty_accepted}
                              onChange={(e) => updateLine(it.id, "qty_accepted", e.target.value)}
                              className="w-20 rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-1.5 py-1 text-right text-[11.5px] tabular-nums"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={s.qty_rejected}
                              onChange={(e) => updateLine(it.id, "qty_rejected", e.target.value)}
                              className="w-20 rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-1.5 py-1 text-right text-[11.5px] tabular-nums"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                />
              </label>

              {detail.receipts.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">Receipt history</div>
                  <ul className="text-[11.5px] text-gray-400 space-y-0.5">
                    {detail.receipts.map((r) => (
                      <li key={r.id}>
                        <span className="font-mono">{r.gr_no ?? r.id.slice(0, 8)}</span> · {r.status}
                        {r.posted_at && <> · posted {r.posted_at.slice(0, 10)}</>}
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
            {totalToReceive > 0 ? `${totalToReceive} units will move into stock` : "No quantities entered"}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-gray-400 hover:text-gray-200">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || !detail || totalToReceive <= 0}
              className="rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-white/[0.10] disabled:opacity-50"
            >
              {submitting ? "Posting…" : "Confirm receipt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
