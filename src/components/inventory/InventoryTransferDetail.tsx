"use client";

/* ---------------------------------------------------------------------------
   /inventory/transfers/[id] — Transfer detail page.

   Four sections:
     1) Header — warehouses, status pill, all 4 timestamps, notes
     2) Items — item identity, qty, *current source stock* (inline), unit
     3) Timeline — Drafted / Submitted / Approved / Shipped / Received
     4) Related movements — each item's transfer_out + transfer_in pair
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import RrIcon from "@/components/ui/RrIcon";
import { Panel, StatusBadge, DirectionDelta } from "@/components/inventory/InventoryUi";
import { TraceabilityCard } from "@/components/inventory/InventoryUx";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";

type TransferStatus =
  | "draft" | "pending" | "approved" | "shipped" | "received" | "cancelled" | "voided";

interface TransferHeader {
  id: string;
  transfer_no: string;
  status: TransferStatus;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  notes: string | null;
  void_reason: string | null;
  requested_at: string | null;
  approved_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  voided_at: string | null;
  created_at: string;
}

interface TransferItem {
  id: string;
  inventory_item_id: string;
  quantity: number;
  unit_of_measure: string;
  notes: string | null;
}

interface BridgeRow {
  id: string;
  transfer_item_id: string;
  transfer_out_movement_id: string | null;
  transfer_in_movement_id: string | null;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface StockBalance {
  inventory_item_id: string;
  warehouse_id: string;
  qty_on_hand: number;
}

interface ProductLite {
  product_id: string;
  product_name: string;
  brand: string | null;
  sku: string | null;
  image_url: string | null;
  stock_profile: { inventory_item_id: string; item_code: string } | null;
}

interface MovementLite {
  id: string;
  movement_no: string;
  direction: "in" | "out";
  quantity: number;
  unit: string;
  status: string;
  movement_date: string;
}

export default function InventoryTransferDetail({ transferId }: { transferId: string }) {
  const { t } = useTranslation(inventoryT);
  const router = useRouter();

  const [transfer, setTransfer] = useState<TransferHeader | null>(null);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [bridges, setBridges] = useState<BridgeRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [movements, setMovements] = useState<Record<string, MovementLite>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [showVoid, setShowVoid] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, whRes, balRes, prodRes] = await Promise.all([
        fetch(`/api/inventory/transfers/${transferId}`, { cache: "no-store", credentials: "include" }),
        fetch("/api/inventory/warehouses", { cache: "no-store", credentials: "include" }),
        fetch("/api/inventory/balances?limit=2000", { cache: "no-store", credentials: "include" }),
        fetch("/api/products/with-stock-profile?limit=500", { cache: "no-store", credentials: "include" }),
      ]);
      const tJ = await tRes.json();
      if (!tRes.ok) throw new Error(humanizeError(tJ.error ?? `HTTP ${tRes.status}`));
      setTransfer(tJ.transfer as TransferHeader);
      setItems((tJ.items ?? []) as TransferItem[]);
      setBridges((tJ.bridges ?? []) as BridgeRow[]);

      const whJ = await whRes.json();
      setWarehouses((whJ.warehouses ?? []) as Warehouse[]);

      const balJ = await balRes.json();
      setBalances((balJ.balances ?? []) as StockBalance[]);

      const prodJ = await prodRes.json();
      setProducts((prodJ.products ?? []) as ProductLite[]);

      /* Resolve attached movement records for traceability. */
      const allIds = ((tJ.bridges ?? []) as BridgeRow[])
        .flatMap((b) => [b.transfer_out_movement_id, b.transfer_in_movement_id])
        .filter(Boolean) as string[];
      const mvMap: Record<string, MovementLite> = {};
      await Promise.all(
        allIds.map(async (id) => {
          const r = await fetch(`/api/inventory/movements/${id}`, { cache: "no-store", credentials: "include" });
          if (r.ok) {
            const j = await r.json();
            if (j.movement) {
              mvMap[id] = {
                id: j.movement.id,
                movement_no: j.movement.movement_no,
                direction: j.movement.direction,
                quantity: Number(j.movement.quantity),
                unit: j.movement.unit,
                status: j.movement.status,
                movement_date: j.movement.movement_date,
              };
            }
          }
        }),
      );
      setMovements(mvMap);
    } catch (e) {
      setError(humanizeError(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [transferId]);

  useEffect(() => { void load(); }, [load]);

  const warehouseMap = useMemo(() => {
    const m = new Map<string, Warehouse>();
    for (const w of warehouses) m.set(w.id, w);
    return m;
  }, [warehouses]);

  const productByItem = useMemo(() => {
    const m = new Map<string, ProductLite>();
    for (const p of products) if (p.stock_profile) m.set(p.stock_profile.inventory_item_id, p);
    return m;
  }, [products]);

  const sourceStockByItem = useMemo(() => {
    if (!transfer) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const b of balances) {
      if (b.warehouse_id !== transfer.source_warehouse_id) continue;
      m.set(b.inventory_item_id, Number(b.qty_on_hand) || 0);
    }
    return m;
  }, [balances, transfer]);

  const act = async (path: string, body?: Record<string, unknown>) => {
    if (!transfer) return;
    setActionError(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/inventory/transfers/${transfer.id}/${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setActionError(humanizeError(j.error ?? `HTTP ${r.status}`));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading && !transfer) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 text-[12px] text-[var(--text-dim)]">
          {t("inv.transfers.loading")}
        </div>
      </div>
    );
  }
  if (error || !transfer) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300 dark:text-rose-200">
            {error ?? "Transfer not found."}
          </div>
        </div>
      </div>
    );
  }

  const src = warehouseMap.get(transfer.source_warehouse_id);
  const dest = warehouseMap.get(transfer.destination_warehouse_id);
  const bridgeByItem = new Map(bridges.map((b) => [b.transfer_item_id, b]));

  const isDraft   = transfer.status === "draft";
  const isPending = transfer.status === "pending";
  const isApproved = transfer.status === "approved";
  const isShipped  = transfer.status === "shipped";
  const isReceived = transfer.status === "received";
  const canCancel  = isDraft || isPending;
  const canVoid    = isShipped || isReceived;

  /* Detect lines that exceed source stock — gates the Ship action. */
  const offendingLines = items.filter((it) => {
    const have = sourceStockByItem.get(it.inventory_item_id) ?? 0;
    return have < Number(it.quantity);
  });
  const canShip = isApproved && offendingLines.length === 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader
          title={transfer.transfer_no}
          subtitle={t("inv.transfers.title")}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/inventory/transfers"
                className="rounded-md border border-[var(--border-color)] px-2.5 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              >
                ← {t("inv.transfers.title")}
              </Link>
              {isDraft && (
                <ActionBtn busy={busy} onClick={() => act("submit")}>
                  {t("inv.transfers.act.submit")}
                </ActionBtn>
              )}
              {isPending && (
                <ActionBtn busy={busy} onClick={() => act("approve")}>
                  {t("inv.transfers.act.approve")}
                </ActionBtn>
              )}
              {isApproved && (
                <ActionBtn busy={busy} disabled={!canShip} onClick={() => act("ship")}>
                  {t("inv.transfers.act.ship")}
                </ActionBtn>
              )}
              {isShipped && (
                <ActionBtn busy={busy} onClick={() => act("receive")}>
                  {t("inv.transfers.act.receive")}
                </ActionBtn>
              )}
              {canCancel && (
                <ActionBtn busy={busy} onClick={() => act("cancel")}>
                  {t("inv.transfers.act.cancel")}
                </ActionBtn>
              )}
              {canVoid && (
                <ActionBtn busy={busy} onClick={() => setShowVoid(true)}>
                  {t("inv.transfers.act.void")}
                </ActionBtn>
              )}
            </div>
          }
        />

        {actionError && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300 dark:text-rose-200">
            {actionError}
          </div>
        )}

        {offendingLines.length > 0 && isApproved && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200">
            One or more lines exceed source stock — adjust quantities or move stock in before shipping.
          </div>
        )}

        {/* Section 1 — Header */}
        <Panel>
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-4">
            <HeaderCell label={t("inv.transfers.form.source")} value={src ? `${src.code} — ${src.name}` : "—"} />
            <HeaderCell label={t("inv.transfers.form.destination")} value={dest ? `${dest.code} — ${dest.name}` : "—"} />
            <HeaderCell label={t("inv.transfers.col.status")} value={<StatusBadge status={transfer.status} />} />
            <HeaderCell label={t("inv.transfers.col.created")} value={new Date(transfer.created_at).toLocaleString()} />
            <HeaderCell label={t("inv.transfers.timeline.submitted")} value={fmt(transfer.requested_at)} />
            <HeaderCell label={t("inv.transfers.timeline.approved")} value={fmt(transfer.approved_at)} />
            <HeaderCell label={t("inv.transfers.timeline.shipped")} value={fmt(transfer.shipped_at)} />
            <HeaderCell label={t("inv.transfers.timeline.received")} value={fmt(transfer.received_at)} />
            {transfer.notes && (
              <div className="sm:col-span-4">
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  {t("inv.transfers.form.notes")}
                </div>
                <div className="mt-1 text-[12.5px] text-[var(--text-secondary)] whitespace-pre-wrap">
                  {transfer.notes}
                </div>
              </div>
            )}
            {transfer.void_reason && (
              <div className="sm:col-span-4">
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  Void reason
                </div>
                <div className="mt-1 text-[12.5px] text-rose-300 dark:text-rose-200">{transfer.void_reason}</div>
              </div>
            )}
          </div>
        </Panel>

        {/* Section 2 — Items */}
        <Panel>
          <div className="border-b border-[var(--border-color)] px-4 py-2 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
            {t("inv.transfers.detail.items")}
          </div>
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                <th className="px-3 py-2 text-left">{t("inv.transfers.form.item")}</th>
                <th className="px-3 py-2 text-right">{t("inv.transfers.form.qty")}</th>
                <th className="px-3 py-2 text-left">{t("inv.transfers.form.unit")}</th>
                <th className="px-3 py-2 text-right">{t("inv.transfers.form.source_stock")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const product = productByItem.get(it.inventory_item_id);
                const onHand = sourceStockByItem.get(it.inventory_item_id) ?? 0;
                const insufficient = onHand < Number(it.quantity);
                return (
                  <tr key={it.id} className="border-b border-[var(--border-color)]/40 last:border-b-0">
                    <td className="px-3 py-2 text-[var(--text-primary)]">
                      {product ? (
                        <span className="inline-flex items-center gap-2">
                          {product.image_url && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={product.image_url} alt="" className="h-7 w-7 rounded object-cover bg-[var(--bg-surface)]" />
                          )}
                          <span className="flex flex-col">
                            <span className="text-[12px]">{product.product_name}</span>
                            <span className="font-mono text-[10.5px] text-[var(--text-dim)]">
                              {product.sku ? <>{product.sku} · </> : null}{product.stock_profile?.item_code}
                            </span>
                          </span>
                        </span>
                      ) : (
                        <span className="font-mono text-[11.5px] text-[var(--text-dim)]">{it.inventory_item_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Number(it.quantity).toLocaleString("en-US", { maximumFractionDigits: 4 })}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{it.unit_of_measure}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${insufficient && isApproved ? "text-rose-300 dark:text-rose-200" : "text-[var(--text-secondary)]"}`}>
                      {onHand.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[11.5px] text-[var(--text-dim)]">
                    {t("inv.transfers.form.need_items")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>

        {/* Section 3 — Timeline */}
        <Panel>
          <div className="border-b border-[var(--border-color)] px-4 py-2 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
            {t("inv.transfers.detail.timeline")}
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-5">
            <Step label={t("inv.transfers.timeline.drafted")}   at={transfer.created_at}    done />
            <Step label={t("inv.transfers.timeline.submitted")} at={transfer.requested_at}  done={!!transfer.requested_at} />
            <Step label={t("inv.transfers.timeline.approved")}  at={transfer.approved_at}   done={!!transfer.approved_at} />
            <Step label={t("inv.transfers.timeline.shipped")}   at={transfer.shipped_at}    done={!!transfer.shipped_at} />
            <Step label={t("inv.transfers.timeline.received")}  at={transfer.received_at}   done={!!transfer.received_at} />
          </div>
        </Panel>

        {/* Section 4 — Related movements */}
        <Panel>
          <div className="border-b border-[var(--border-color)] px-4 py-2 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
            {t("inv.transfers.detail.movements")}
          </div>
          {bridges.length === 0 ? (
            <div className="px-4 py-6 text-center text-[11.5px] text-[var(--text-dim)]">
              {t("inv.transfers.detail.no_movements")}
            </div>
          ) : (
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                  <th className="px-3 py-2 text-left">{t("inv.transfers.form.item")}</th>
                  <th className="px-3 py-2 text-left">Transfer OUT</th>
                  <th className="px-3 py-2 text-left">Transfer IN</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const product = productByItem.get(it.inventory_item_id);
                  const bridge = bridgeByItem.get(it.id);
                  const outMv = bridge?.transfer_out_movement_id ? movements[bridge.transfer_out_movement_id] : null;
                  const inMv  = bridge?.transfer_in_movement_id  ? movements[bridge.transfer_in_movement_id]  : null;
                  return (
                    <tr key={it.id} className="border-b border-[var(--border-color)]/40 last:border-b-0">
                      <td className="px-3 py-2 text-[var(--text-primary)]">
                        {product?.product_name ?? <span className="font-mono text-[11px] text-[var(--text-dim)]">{it.inventory_item_id.slice(0, 8)}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {outMv ? <MovementLink mv={outMv} onOpen={(id) => router.push(`/inventory/movements?focus=${id}`)} /> : <span className="text-[var(--text-dim)]">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {inMv ? <MovementLink mv={inMv} onOpen={(id) => router.push(`/inventory/movements?focus=${id}`)} /> : <span className="text-[var(--text-dim)]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        {/* INV-H5A — Traceability card */}
        <TraceabilityCard
          links={[
            { label: t("inv.trace.current_warehouse"), value: warehouseMap.get(transfer.destination_warehouse_id)?.code ?? warehouseMap.get(transfer.source_warehouse_id)?.code ?? "—", icon: "bank" },
            ...(transfer.source_warehouse_id
              ? [{ label: "Source", value: warehouseMap.get(transfer.source_warehouse_id)?.name ?? transfer.source_warehouse_id, href: `/inventory/warehouses`, icon: "bank" as const }]
              : []),
            ...(transfer.destination_warehouse_id
              ? [{ label: "Destination", value: warehouseMap.get(transfer.destination_warehouse_id)?.name ?? transfer.destination_warehouse_id, href: `/inventory/warehouses`, icon: "bank" as const }]
              : []),
            ...items.slice(0, 1).map((it) => {
              const product = productByItem.get(it.inventory_item_id);
              return {
                label: t("inv.trace.latest"),
                value: product?.product_name ?? `Item ${it.inventory_item_id.slice(0, 8)}`,
                href: `/inventory/items?q=${encodeURIComponent(product?.stock_profile?.item_code ?? "")}`,
                icon: "box-open" as const,
              };
            }),
          ]}
        />

        {showVoid && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-5">
              <div className="mb-2 text-[13px] font-medium">{t("inv.transfers.act.void")}</div>
              <textarea
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder={t("inv.transfers.act.void_reason")}
                className="mb-3 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowVoid(false)}
                  className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-surface)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || voidReason.trim().length < 3}
                  onClick={async () => {
                    await act("void", { reason: voidReason.trim() });
                    setShowVoid(false);
                    setVoidReason("");
                  }}
                  className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                >
                  <RrIcon name="check" size={12} /> {t("inv.transfers.act.void")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function HeaderCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{label}</div>
      <div className="mt-1 text-[12.5px] text-[var(--text-secondary)]">{value}</div>
    </div>
  );
}

function fmt(at: string | null): React.ReactNode {
  return at ? new Date(at).toLocaleString() : <span className="text-[var(--text-dim)]">—</span>;
}

function Step({ label, at, done }: { label: string; at: string | null; done: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${done ? "border-emerald-400/30 bg-emerald-500/5" : "border-[var(--border-color)] bg-[var(--bg-surface)]/30"}`}>
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{label}</div>
      <div className="mt-1 text-[11.5px] text-[var(--text-secondary)]">{at ? new Date(at).toLocaleString() : "—"}</div>
    </div>
  );
}

function ActionBtn({
  busy,
  disabled,
  onClick,
  children,
}: {
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function MovementLink({ mv, onOpen }: { mv: MovementLite; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(mv.id)}
      className="inline-flex items-center gap-2 text-left hover:underline"
    >
      <span className="font-mono text-[11px] text-[var(--text-secondary)]">{mv.movement_no}</span>
      <DirectionDelta direction={mv.direction} quantity={mv.quantity} unit={mv.unit} />
      <StatusBadge status={mv.status} />
    </button>
  );
}
