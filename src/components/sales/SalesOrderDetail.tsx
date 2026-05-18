"use client";

/* ---------------------------------------------------------------------------
   /sales/orders/[id] — Sales Order detail (Phase O.4.1).

   Three blocks under the header:
     1. Line items table with per-line ordered / shipped / remaining
        plus a live stock summary (total on-hand + top locations)
     2. Shipment history table
     3. Order timeline (created → each shipment with shipped /
        voided / void reason)

   Ship button opens the ShipDialog used everywhere else in the app
   so the engine and validation rules are identical.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RrIcon from "@/components/ui/RrIcon";
import {
  InventoryEmpty,
  LocationTypeChip,
  Panel,
  StatusBadge,
} from "@/components/inventory/InventoryUi";
import ShipDialog from "@/components/sales/ShipDialog";
import DocumentWorkflowBanner from "@/components/ui/workflow/DocumentWorkflowBanner";
import TraceabilityPanel from "@/components/ui/traceability/TraceabilityPanel";
import { humanizeError } from "@/lib/ui/humanize-error";

interface ItemRow {
  id: string;
  description: string | null;
  inventory_item_id: string | null;
  qty: number;
  qty_shipped: number;
  unit_price: number;
  total: number;
  total_on_hand: number;
  available_locations: Array<{
    warehouse_id: string;
    warehouse_code: string;
    warehouse_name: string;
    location_type: string;
    qty_on_hand: number;
  }>;
}
interface ShipmentRow {
  id: string;
  shipment_no: string;
  status: string;
  shipped_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  tracking_no: string | null;
  source_location_code: string | null;
  source_location_name: string | null;
  total_qty: number;
  total_cost: number;
  line_count: number;
  created_at: string;
  /* Phase A.4 — mirrored from sales_shipments. */
  accounting_status: "drafted" | "posted" | "failed" | "voided" | "pending" | null;
  accounting_entry_id: string | null;
}
interface OrderRow {
  id: string;
  so_no: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: "draft" | "confirmed" | "partial" | "shipped" | "closed" | "cancelled";
  currency: string;
  notes: string | null;
  created_at: string;
  qty_ordered: number;
  qty_shipped: number;
  qty_remaining: number;
}
interface Detail {
  order: OrderRow;
  items: ItemRow[];
  shipments: ShipmentRow[];
}

function fmtQty(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}
function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

export default function SalesOrderDetail({ soId }: { soId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shipOpen, setShipOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/sales/orders/${soId}`, { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      setDetail(j as Detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [soId]);

  useEffect(() => { void load(); }, [load]);

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
    if (!r.ok) { alert(humanizeError(j.error)); return; }
    await load();
  };

  const draftCogs = async (id: string) => {
    const r = await fetch(`/api/accounting/inventory-cogs/draft`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipment_id: id }),
    });
    const j = await r.json();
    if (!r.ok) { alert(humanizeError(j.error)); return; }
    await load();
  };

  /* Build a flat timeline from order + shipments. */
  const timeline = useMemo(() => {
    if (!detail) return [] as Array<{ id: string; date: string; kind: "created" | "shipped" | "voided"; title: string; detail: string }>;
    const events: Array<{ id: string; date: string; kind: "created" | "shipped" | "voided"; title: string; detail: string }> = [];
    events.push({
      id: "soc",
      date: detail.order.created_at,
      kind: "created",
      title: "Order created",
      detail: detail.order.customer_name ? `for ${detail.order.customer_name}` : "",
    });
    for (const s of detail.shipments) {
      if (s.shipped_at) {
        events.push({
          id: `${s.id}-ship`,
          date: s.shipped_at,
          kind: "shipped",
          title: `Shipped ${s.shipment_no}`,
          detail: `${fmtQty(s.total_qty)} units from ${s.source_location_code ?? "—"}${s.tracking_no ? ` · ${s.tracking_no}` : ""}`,
        });
      }
      if (s.voided_at) {
        events.push({
          id: `${s.id}-void`,
          date: s.voided_at,
          kind: "voided",
          title: `Voided ${s.shipment_no}`,
          detail: s.void_reason ?? "no reason",
        });
      }
    }
    return events.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [detail]);

  const canShip = detail?.order.status === "confirmed" || detail?.order.status === "partial";
  const progressPct = detail && detail.order.qty_ordered > 0
    ? Math.min(100, Math.round((detail.order.qty_shipped / detail.order.qty_ordered) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        {/* Page bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/sales/orders"
              aria-label="Back to Sales Orders"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
            >
              <RrIcon name="arrow-left" size={16} />
            </Link>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
              <RrIcon name="file-invoice" size={16} />
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="font-mono text-[18px] font-bold tracking-tight md:text-[20px]">
                {detail?.order.so_no ?? "—"}
              </h1>
              {detail && <StatusBadge status={detail.order.status} />}
              {detail?.order.customer_name && (
                <span className="hidden text-[12px] text-[var(--text-dim)] sm:inline">· {detail.order.customer_name}</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canShip && (
              <button
                onClick={() => setShipOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10]"
              >
                <RrIcon name="truck-side" size={12} />
                Ship
              </button>
            )}
            <Link
              href="/sales/orders"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]"
            >
              All Orders
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {/* Workflow context — Customer → SO → Ship → Invoice → Payment */}
        {detail && (
          <DocumentWorkflowBanner
            kind="so"
            status={detail.order.status}
            documentId={detail.order.id}
            customerHref={detail.order.customer_id ? `/customers/${detail.order.customer_id}` : null}
          />
        )}

        {/* Cross-links — quick navigation to related surfaces. */}
        {detail && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
            <span className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mr-1">Related</span>
            {detail.order.customer_id && (
              <Link href={`/customers/${detail.order.customer_id}`} className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.012] px-2 py-0.5 hover:bg-white/[0.04]">
                <RrIcon name="contract" size={10} /> Customer
              </Link>
            )}
            <Link href="/inventory/balances" className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.012] px-2 py-0.5 hover:bg-white/[0.04]">
              <RrIcon name="box-open" size={10} /> Inventory
            </Link>
            <Link href="/invoices" className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.012] px-2 py-0.5 hover:bg-white/[0.04]">
              <RrIcon name="file-invoice-dollar" size={10} /> Invoices
            </Link>
            <Link href="/finance/accounting/queue" className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.012] px-2 py-0.5 hover:bg-white/[0.04]">
              <RrIcon name="clock" size={10} /> Accounting Queue
            </Link>
            <Link href="/workflows/sales" className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.012] px-2 py-0.5 hover:bg-white/[0.04]">
              <RrIcon name="contract" size={10} /> Sales Workflow
            </Link>
          </div>
        )}

        {/* Traceability — relationship timeline + financial impact + related docs */}
        {detail && <TraceabilityPanel kind="so" id={detail.order.id} />}

        {loading && !detail && (
          <div className="text-[12px] text-gray-500">Loading order…</div>
        )}

        {detail && (
          <>
            {/* Header KPI strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile label="Ordered"   value={fmtQty(detail.order.qty_ordered)} />
              <KpiTile label="Shipped"   value={fmtQty(detail.order.qty_shipped)}   accent="bg-emerald-300/50" />
              <KpiTile label="Remaining" value={fmtQty(detail.order.qty_remaining)} accent="bg-amber-300/50" />
              <KpiTile label="Currency"  value={detail.order.currency}              hint={`${detail.shipments.length} shipment${detail.shipments.length === 1 ? "" : "s"}`} />
            </div>

            {/* Progress bar */}
            {detail.order.qty_ordered > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10.5px] text-gray-500">
                  <span>Fulfilment</span>
                  <span className="tabular-nums">{progressPct}%</span>
                </div>
                <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full bg-emerald-400/55" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {/* Items */}
            <section>
              <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">Line items</div>
              <Panel>
                <table className="min-w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Ordered</th>
                      <th className="px-3 py-2 text-right">Shipped</th>
                      <th className="px-3 py-2 text-right">Remaining</th>
                      <th className="px-3 py-2 text-right">On hand</th>
                      <th className="px-3 py-2 text-left">Top locations</th>
                      <th className="px-3 py-2 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.length === 0 ? (
                      <tr><td colSpan={7} className="px-0 py-0">
                        <InventoryEmpty
                          title="No line items"
                          hint="This order has no lines yet."
                        />
                      </td></tr>
                    ) : (
                      detail.items.map((it) => {
                        const remaining = Math.max(0, Number(it.qty) - Number(it.qty_shipped));
                        return (
                          <tr key={it.id} className="border-b border-white/[0.03] last:border-b-0">
                            <td className="px-3 py-2 text-gray-200">
                              {it.description ?? it.inventory_item_id?.slice(0, 8) ?? "—"}
                              {!it.inventory_item_id && (
                                <span className="ml-1.5 text-[10.5px] text-amber-300/80">· non-stock</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-mono text-gray-300">{fmtQty(it.qty)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-mono text-gray-400">{fmtQty(it.qty_shipped)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-mono">{fmtQty(remaining)}</td>
                            <td className={`px-3 py-2 text-right tabular-nums font-mono ${it.inventory_item_id ? "text-gray-300" : "text-gray-600"}`}>
                              {it.inventory_item_id ? fmtQty(it.total_on_hand) : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {it.inventory_item_id && it.available_locations.length > 0 ? (
                                <div className="flex flex-wrap gap-1 text-[10.5px]">
                                  {it.available_locations.slice(0, 4).map((b) => (
                                    <span key={b.warehouse_id} className="inline-flex items-center gap-1 rounded border border-white/[0.04] px-1.5 py-0.5 text-gray-400">
                                      <span className="font-mono text-gray-300">{b.warehouse_code}</span>
                                      <span className="tabular-nums">{fmtQty(b.qty_on_hand)}</span>
                                      <LocationTypeChip type={b.location_type} />
                                    </span>
                                  ))}
                                  {it.available_locations.length > 4 && (
                                    <span className="text-gray-500">+{it.available_locations.length - 4} more</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10.5px] text-gray-600">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-mono text-gray-400">
                              {Number(it.unit_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </Panel>
            </section>

            {/* Shipment history */}
            <section>
              <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">Shipment history</div>
              {detail.shipments.length === 0 ? (
                <Panel>
                  <InventoryEmpty
                    title="No shipments yet"
                    hint={canShip ? "Click Ship to send the first shipment for this order." : "Once the order is confirmed you can start shipping."}
                  />
                </Panel>
              ) : (
                <Panel>
                  <table className="min-w-full text-[12.5px]">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                        <th className="px-3 py-2 text-left">Shipment #</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Source</th>
                        <th className="px-3 py-2 text-right">Lines</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">COGS</th>
                        <th className="px-3 py-2 text-left">Tracking</th>
                        <th className="px-3 py-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.shipments.map((s) => (
                        <tr key={s.id} className="border-b border-white/[0.03] last:border-b-0">
                          <td className="px-3 py-1.5 font-mono text-[11.5px] text-gray-300">{s.shipment_no}</td>
                          <td className="px-3 py-1.5"><StatusBadge status={s.status} /></td>
                          <td className="px-3 py-1.5 text-[11px] text-gray-500">{s.shipped_at?.slice(0, 10) ?? "—"}</td>
                          <td className="px-3 py-1.5 text-[11.5px] text-gray-300">
                            {s.source_location_code ?? "—"}
                            {s.source_location_name && <span className="ml-1 text-gray-500">· {s.source_location_name}</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono text-gray-400">{s.line_count}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono">{fmtQty(s.total_qty)}</td>
                          <td className="px-3 py-1.5 text-right">
                            <div className="inline-flex flex-col items-end gap-0.5">
                              <span className="tabular-nums font-mono text-gray-300">
                                {s.total_cost > 0 ? s.total_cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                              </span>
                              {s.accounting_status && (
                                <span className={`inline-flex items-center rounded-full border px-1.5 py-px text-[9.5px] uppercase tracking-[0.10em] ${
                                  s.accounting_status === "posted" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" :
                                  s.accounting_status === "voided" ? "border-gray-500/30 bg-gray-500/10 text-gray-400" :
                                  s.accounting_status === "failed" ? "border-rose-400/30 bg-rose-500/10 text-rose-300" :
                                                                     "border-amber-400/30 bg-amber-500/10 text-amber-200"
                                }`}>
                                  {s.accounting_status}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-[11px] text-gray-400">{s.tracking_no ?? "—"}</td>
                          <td className="px-3 py-1.5 text-right">
                            <div className="inline-flex items-center gap-2">
                              {s.status === "shipped" && s.total_cost > 0 && !s.accounting_status && (
                                <button
                                  onClick={() => draftCogs(s.id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 text-[10.5px] hover:bg-white/[0.08]"
                                  title="Create a draft COGS journal in the Accounting Queue"
                                >
                                  Draft COGS
                                </button>
                              )}
                              {s.status === "shipped" && (
                                <button onClick={() => voidShipment(s.id)} className="text-[11px] text-rose-300 hover:text-rose-200">
                                  Void
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              )}
            </section>

            {/* Timeline */}
            <section>
              <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">Timeline</div>
              <Panel className="px-4 py-3">
                <ol className="space-y-3">
                  {timeline.map((ev) => {
                    const tone =
                      ev.kind === "shipped" ? "bg-emerald-300/60" :
                      ev.kind === "voided"  ? "bg-rose-300/60"    :
                                              "bg-gray-300/50";
                    return (
                      <li key={ev.id} className="flex items-start gap-3">
                        <div className="mt-1 flex flex-col items-center">
                          <span aria-hidden className={`h-2 w-2 rounded-full ${tone}`} />
                          <span aria-hidden className="mt-1 h-6 w-px bg-white/[0.05]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="text-[12.5px] text-gray-200">{ev.title}</div>
                            <div className="text-[10.5px] text-gray-500 tabular-nums">{fmtDateTime(ev.date)}</div>
                          </div>
                          {ev.detail && <div className="text-[11px] text-gray-500">{ev.detail}</div>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Panel>
            </section>

            {detail.order.notes && (
              <section>
                <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">Notes</div>
                <Panel className="px-4 py-3 text-[12px] text-gray-300 whitespace-pre-wrap">
                  {detail.order.notes}
                </Panel>
              </section>
            )}
          </>
        )}
      </div>

      {shipOpen && (
        <ShipDialog
          soId={soId}
          onClose={() => setShipOpen(false)}
          onSuccess={() => { setShipOpen(false); void load(); }}
        />
      )}
    </div>
  );
}

function KpiTile({ label, value, hint, accent = "bg-white/30" }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="relative rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3.5">
      <div aria-hidden className={`absolute left-4 top-0 h-px w-8 ${accent}`} />
      <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{label}</div>
      <div className="mt-2 text-[20px] font-medium leading-none tabular-nums tracking-[-0.01em]">{value}</div>
      {hint && <div className="mt-1.5 text-[10.5px] text-gray-600">{hint}</div>}
    </div>
  );
}
