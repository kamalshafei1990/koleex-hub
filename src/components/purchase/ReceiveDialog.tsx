"use client";

/* ---------------------------------------------------------------------------
   ReceiveDialog — Phase O.3.
   Open from any PO row. Loads the PO's items, lets the operator fill
   in qty received / accepted / rejected per line + pick a warehouse,
   then POSTs to /api/purchase/orders/[id]/receive. The server creates
   the receipt + inventory movements atomically.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { humanizeError } from "@/lib/ui/humanize-error";

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

  /* Phase O.3.1 — destination mode controls which fields show + whether
     the receipt creates stock movements. */
  type DestinationMode =
    | "warehouse" | "port" | "forwarder" | "in_transit" | "consolidation"
    | "direct_ship_to_customer" | "exhibition" | "demo_location"
    | "non_stock_purchase";
  const [destinationMode, setDestinationMode] = useState<DestinationMode>("warehouse");
  const [portName, setPortName] = useState("");
  const [forwarderName, setForwarderName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [exhibitionName, setExhibitionName] = useState("");
  const [demoLocationName, setDemoLocationName] = useState("");
  const [shipmentReference, setShipmentReference] = useState("");
  const [containerNo, setContainerNo] = useState("");
  const [expectedShipDate, setExpectedShipDate] = useState("");
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const affectsInventory = destinationMode !== "non_stock_purchase";

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
          destination_mode: destinationMode,
          warehouse_id: destinationMode === "warehouse" ? warehouseId || null : null,
          port_name: destinationMode === "port" ? portName || null : null,
          forwarder_name: destinationMode === "forwarder" ? forwarderName || null : null,
          customer_id: destinationMode === "direct_ship_to_customer" ? customerId || null : null,
          exhibition_name: destinationMode === "exhibition" ? exhibitionName || null : null,
          demo_location_name: destinationMode === "demo_location" ? demoLocationName || null : null,
          shipment_reference: shipmentReference || null,
          container_no: containerNo || null,
          expected_ship_date: expectedShipDate || null,
          expected_arrival_date: expectedArrivalDate || null,
          carrier: carrier || null,
          tracking_no: trackingNo || null,
          notes: notes || null,
          lines,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(humanizeError(j.error ?? `HTTP ${r.status}`));
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">Receive Goods</h2>
            <p className="text-[11px] text-[var(--text-dim)]">
              {detail?.order.po_no ? `PO ${detail.order.po_no}` : "Loading…"} ·{" "}
              {detail ? `${detail.items.length} line${detail.items.length === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-muted)] text-[18px]">×</button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
          {loading && !detail && <div className="text-[12px] text-[var(--text-dim)]">Loading PO…</div>}

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
              {error}
            </div>
          )}

          {detail && (
            <>
              {/* Destination mode + helper banner. Trading flows often
                  route goods to port / forwarder / direct-to-customer,
                  so the user picks the destination before anything else. */}
              <div className="rounded-md border border-[var(--border-subtle)] p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Receiving destination</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    { v: "warehouse", label: "Koleex warehouse", hint: "Affects inventory" },
                    { v: "port", label: "Port", hint: "Affects inventory" },
                    { v: "forwarder", label: "Forwarder", hint: "Affects inventory" },
                    { v: "in_transit", label: "In transit", hint: "Affects inventory" },
                    { v: "consolidation", label: "Consolidation", hint: "Affects inventory" },
                    { v: "direct_ship_to_customer", label: "Direct to customer", hint: "Affects inventory" },
                    { v: "exhibition", label: "Exhibition", hint: "Affects inventory" },
                    { v: "demo_location", label: "Demo location", hint: "Affects inventory" },
                    { v: "non_stock_purchase", label: "Non-stock", hint: "No inventory" },
                  ] as const).map((opt) => {
                    const active = destinationMode === opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setDestinationMode(opt.v)}
                        className={`rounded-md border px-2 py-1.5 text-left text-[11.5px] transition ${
                          active ? "border-[var(--border-color)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-[10px] text-[var(--text-dim)]">{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>
                <div className={`mt-2 text-[11px] ${affectsInventory ? "text-emerald-300" : "text-[var(--text-dim)]"}`}>
                  {affectsInventory ? "✓ Will affect inventory" : "✗ Will NOT affect inventory"}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {destinationMode === "warehouse" && (
                  <label className="block sm:col-span-1">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Warehouse</div>
                    <select
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                    >
                      {warehouses.filter((w) => !("location_type" in w) || (w as { location_type?: string }).location_type === "warehouse" || (w as { location_type?: string }).location_type === undefined).map((w) => (
                        <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                {destinationMode === "port" && (
                  <label className="block sm:col-span-1">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Port name</div>
                    <input
                      value={portName}
                      onChange={(e) => setPortName(e.target.value)}
                      placeholder="e.g. Shanghai, Hamburg, Jeddah"
                      className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                    />
                  </label>
                )}
                {destinationMode === "forwarder" && (
                  <label className="block sm:col-span-1">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Forwarder</div>
                    <input
                      value={forwarderName}
                      onChange={(e) => setForwarderName(e.target.value)}
                      placeholder="DHL, Schenker, …"
                      className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                    />
                  </label>
                )}
                {destinationMode === "direct_ship_to_customer" && (
                  <label className="block sm:col-span-1">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Customer ID *</div>
                    <input
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      placeholder="contact uuid"
                      className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                    />
                  </label>
                )}
                {destinationMode === "exhibition" && (
                  <label className="block sm:col-span-1">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Exhibition</div>
                    <input
                      value={exhibitionName}
                      onChange={(e) => setExhibitionName(e.target.value)}
                      placeholder="ITMA Milan 2027, Texprocess…"
                      className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                    />
                  </label>
                )}
                {destinationMode === "demo_location" && (
                  <label className="block sm:col-span-1">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Demo location</div>
                    <input
                      value={demoLocationName}
                      onChange={(e) => setDemoLocationName(e.target.value)}
                      placeholder="Customer site, training center…"
                      className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                    />
                  </label>
                )}
                {(destinationMode === "port" || destinationMode === "forwarder" || destinationMode === "direct_ship_to_customer" || destinationMode === "in_transit" || destinationMode === "consolidation" || destinationMode === "exhibition" || destinationMode === "demo_location") && (
                  <>
                    <label className="block">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Shipment ref</div>
                      <input
                        value={shipmentReference}
                        onChange={(e) => setShipmentReference(e.target.value)}
                        placeholder="BL, AWB, ref#…"
                        className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                      />
                    </label>
                    <label className="block">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Container #</div>
                      <input
                        value={containerNo}
                        onChange={(e) => setContainerNo(e.target.value)}
                        placeholder="MSCU1234567"
                        className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Ship</div>
                        <input type="date" value={expectedShipDate} onChange={(e) => setExpectedShipDate(e.target.value)} className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Arrival</div>
                        <input type="date" value={expectedArrivalDate} onChange={(e) => setExpectedArrivalDate(e.target.value)} className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
                      </label>
                    </div>
                  </>
                )}
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Carrier</div>
                  <input
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Tracking #</div>
                  <input
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                  />
                </label>
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                <table className="min-w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
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
                        <tr key={it.id} className="border-b border-[var(--border-subtle)]">
                          <td className="px-3 py-1.5 text-[var(--text-muted)]">{it.description ?? it.product_id?.slice(0, 8) ?? "—"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono text-[var(--text-muted)]">{it.qty}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono text-[var(--text-dim)]">{it.qty_received}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono">{remaining}</td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={s.qty_received}
                              onChange={(e) => updateLine(it.id, "qty_received", e.target.value)}
                              className="w-20 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-1.5 py-1 text-right text-[11.5px] tabular-nums"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={s.qty_accepted}
                              onChange={(e) => updateLine(it.id, "qty_accepted", e.target.value)}
                              className="w-20 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-1.5 py-1 text-right text-[11.5px] tabular-nums"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={s.qty_rejected}
                              onChange={(e) => updateLine(it.id, "qty_rejected", e.target.value)}
                              className="w-20 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-1.5 py-1 text-right text-[11.5px] tabular-nums"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <label className="block">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                />
              </label>

              {detail.receipts.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)] mb-2">Receipt history</div>
                  <ul className="text-[11.5px] text-[var(--text-muted)] space-y-0.5">
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

        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-3">
          <span className="text-[11px] text-[var(--text-dim)]">
            {totalToReceive > 0 ? `${totalToReceive} units will move into stock` : "No quantities entered"}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || !detail || totalToReceive <= 0}
              className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-50"
            >
              {submitting ? "Posting…" : "Confirm receipt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
