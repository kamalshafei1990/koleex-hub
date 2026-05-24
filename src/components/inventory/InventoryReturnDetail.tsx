"use client";

/* ---------------------------------------------------------------------------
   /inventory/returns/[id] — Return detail page.

   Four sections:
     1) Header — type, party, source document, warehouse, reason, notes
     2) Items table — item identity, qty, condition, disposition,
        stock-impact (which warehouse + +/− qty)
     3) Timeline — Drafted / Submitted / Approved /
        Received-or-Shipped / Completed
     4) Related movements — per item, the bridge row's movement_id
        clickable to movement detail
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import RrIcon from "@/components/ui/RrIcon";
import { Panel, DirectionDelta } from "@/components/inventory/InventoryUi";
import { DetailsAccordion, HumanStatusPill, TraceabilityCard } from "@/components/inventory/InventoryUx";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";

type ReturnStatus =
  | "draft" | "pending" | "approved" | "received" | "shipped"
  | "completed" | "cancelled" | "voided";

type ReturnType = "customer_return" | "supplier_return";

interface ReturnHeader {
  id: string;
  return_no: string;
  return_type: ReturnType;
  status: ReturnStatus;
  customer_id: string | null;
  supplier_id: string | null;
  source_document_type: string | null;
  source_document_id: string | null;
  warehouse_id: string;
  reason_code: string;
  reason_notes: string | null;
  notes: string | null;
  void_reason: string | null;
  requested_at: string | null;
  approved_at: string | null;
  processed_at: string | null;
  cancelled_at: string | null;
  voided_at: string | null;
  created_at: string;
}

interface ReturnItem {
  id: string;
  inventory_item_id: string;
  quantity: number;
  unit_of_measure: string;
  condition_status: "good" | "damaged" | "defective" | "scrap";
  disposition: "restock" | "quarantine" | "scrap" | "vendor_return";
  notes: string | null;
}

interface BridgeRow {
  id: string;
  return_item_id: string;
  movement_id: string;
}

interface Warehouse { id: string; code: string; name: string; kind?: string | null }

interface ContactRow {
  id: string;
  display_name: string | null;
  company_name: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
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
  warehouse_id: string;
}

function contactLabel(c: ContactRow | undefined): string {
  if (!c) return "—";
  return (
    c.display_name ||
    c.company_name ||
    c.full_name ||
    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
    "—"
  );
}

export default function InventoryReturnDetail({ returnId }: { returnId: string }) {
  const { t } = useTranslation(inventoryT);
  const router = useRouter();

  const [ret, setRet] = useState<ReturnHeader | null>(null);
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [bridges, setBridges] = useState<BridgeRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<ContactRow[]>([]);
  const [suppliers, setSuppliers] = useState<ContactRow[]>([]);
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
      const [rRes, whRes, cRes, sRes, balRes, prodRes] = await Promise.all([
        fetch(`/api/inventory/returns/${returnId}`, { cache: "no-store", credentials: "include" }),
        fetch("/api/inventory/warehouses", { cache: "no-store", credentials: "include" }),
        fetch("/api/contacts?type=customer", { cache: "no-store", credentials: "include" }),
        fetch("/api/contacts?type=supplier", { cache: "no-store", credentials: "include" }),
        fetch("/api/inventory/balances?limit=2000", { cache: "no-store", credentials: "include" }),
        fetch("/api/products/with-stock-profile?limit=500", { cache: "no-store", credentials: "include" }),
      ]);
      const rJ = await rRes.json();
      if (!rRes.ok) throw new Error(humanizeError(rJ.error ?? `HTTP ${rRes.status}`));
      setRet(rJ.return as ReturnHeader);
      setItems((rJ.items ?? []) as ReturnItem[]);
      setBridges((rJ.bridges ?? []) as BridgeRow[]);

      const whJ = await whRes.json();
      setWarehouses((whJ.warehouses ?? []) as Warehouse[]);

      const cJ = await cRes.json();
      const sJ = await sRes.json();
      setCustomers((cJ.contacts ?? []) as ContactRow[]);
      setSuppliers((sJ.contacts ?? []) as ContactRow[]);

      const balJ = await balRes.json();
      setBalances((balJ.balances ?? []) as StockBalance[]);

      const prodJ = await prodRes.json();
      setProducts((prodJ.products ?? []) as ProductLite[]);

      /* Resolve attached movement records for traceability. */
      const allIds = ((rJ.bridges ?? []) as BridgeRow[]).map((b) => b.movement_id);
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
                warehouse_id: j.movement.warehouse_id,
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
  }, [returnId]);

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
    if (!ret) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const b of balances) {
      if (b.warehouse_id !== ret.warehouse_id) continue;
      m.set(b.inventory_item_id, Number(b.qty_on_hand) || 0);
    }
    return m;
  }, [balances, ret]);

  const bridgeByItem = useMemo(() => {
    const m = new Map<string, BridgeRow[]>();
    for (const b of bridges) {
      const list = m.get(b.return_item_id) ?? [];
      list.push(b);
      m.set(b.return_item_id, list);
    }
    return m;
  }, [bridges]);

  const act = async (path: string, body?: Record<string, unknown>) => {
    if (!ret) return;
    setActionError(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/inventory/returns/${ret.id}/${path}`, {
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

  if (loading && !ret) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 text-[12px] text-[var(--text-dim)]">
          {t("inv.returns.loading")}
        </div>
      </div>
    );
  }
  if (error || !ret) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300 dark:text-rose-200">
            {error ?? "Return not found."}
          </div>
        </div>
      </div>
    );
  }

  const wh = warehouseMap.get(ret.warehouse_id);
  const party =
    ret.return_type === "customer_return"
      ? customers.find((c) => c.id === ret.customer_id)
      : suppliers.find((s) => s.id === ret.supplier_id);

  const isDraft     = ret.status === "draft";
  const isPending   = ret.status === "pending";
  const isApproved  = ret.status === "approved";
  const isReceived  = ret.status === "received";
  const isShipped   = ret.status === "shipped";
  const isCompleted = ret.status === "completed";

  const canCancel   = isDraft || isPending || isApproved;
  const canVoid     = isReceived || isShipped || isCompleted;

  const isCustomer = ret.return_type === "customer_return";
  const isSupplier = ret.return_type === "supplier_return";

  /* Stock pre-flight for supplier ship action. */
  const offendingLines = isSupplier && isApproved
    ? items.filter((it) => (sourceStockByItem.get(it.inventory_item_id) ?? 0) < Number(it.quantity))
    : [];
  const canShip = isSupplier && isApproved && offendingLines.length === 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader
          title={ret.return_no}
          subtitle={
            ret.return_type === "customer_return"
              ? t("inv.returns.type.customer")
              : t("inv.returns.type.supplier")
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/inventory/returns"
                className="rounded-md border border-[var(--border-color)] px-2.5 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              >
                ← {t("inv.returns.title")}
              </Link>
              {isDraft && (
                <ActionBtn busy={busy} onClick={() => act("submit")}>
                  {t("inv.returns.act.submit")}
                </ActionBtn>
              )}
              {isPending && (
                <ActionBtn busy={busy} onClick={() => act("approve")}>
                  {t("inv.returns.act.approve")}
                </ActionBtn>
              )}
              {isCustomer && isApproved && (
                <ActionBtn busy={busy} onClick={() => act("receive")}>
                  {t("inv.returns.act.receive")}
                </ActionBtn>
              )}
              {isSupplier && isApproved && (
                <ActionBtn busy={busy} disabled={!canShip} onClick={() => act("ship")}>
                  {t("inv.returns.act.ship")}
                </ActionBtn>
              )}
              {(isReceived || isShipped) && (
                <ActionBtn busy={busy} onClick={() => act("complete")}>
                  {t("inv.returns.act.complete")}
                </ActionBtn>
              )}
              {canCancel && (
                <ActionBtn busy={busy} onClick={() => act("cancel")}>
                  {t("inv.returns.act.cancel")}
                </ActionBtn>
              )}
              {canVoid && (
                <ActionBtn busy={busy} onClick={() => setShowVoid(true)}>
                  {t("inv.returns.act.void")}
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

        {offendingLines.length > 0 && isSupplier && isApproved && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200">
            One or more lines exceed source stock — adjust quantities or top up before shipping.
          </div>
        )}

        {/* Section 1 — Calm header: party + warehouse + status + reason.
              Created / submitted / approved / processed timestamps and
              source-document refs move into the Details accordion. */}
        <Panel>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
            <div className="flex flex-col text-[13px] text-[var(--text-primary)]">
              <span className="font-medium">{contactLabel(party)}</span>
              <span className="text-[11px] text-[var(--text-dim)]">
                {wh ? `${wh.code} — ${wh.name}` : "—"} · {t(`inv.returns.reason.${ret.reason_code}`)}
              </span>
            </div>
            <div className="ml-auto"><HumanStatusPill status={ret.status} /></div>
            {ret.reason_notes && (
              <div className="basis-full text-[12px] text-[var(--text-secondary)] whitespace-pre-wrap">
                {ret.reason_notes}
              </div>
            )}
            {ret.notes && (
              <div className="basis-full text-[12px] text-[var(--text-secondary)] whitespace-pre-wrap">
                {ret.notes}
              </div>
            )}
            {ret.void_reason && (
              <div className="basis-full text-[12px] text-rose-300 dark:text-rose-200">
                Void reason: {ret.void_reason}
              </div>
            )}
          </div>
        </Panel>

        {/* Section 2 — Items */}
        <Panel>
          <div className="border-b border-[var(--border-color)] px-4 py-2 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
            {t("inv.returns.detail.items")}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                  <th className="px-3 py-2 text-left">{t("inv.returns.form.item")}</th>
                  <th className="px-3 py-2 text-right">{t("inv.returns.form.qty")}</th>
                  <th className="px-3 py-2 text-left">{t("inv.returns.form.unit")}</th>
                  <th className="px-3 py-2 text-left">{t("inv.returns.form.condition")}</th>
                  <th className="px-3 py-2 text-left">{t("inv.returns.form.disposition")}</th>
                  <th className="px-3 py-2 text-left">{t("inv.returns.detail.stock_impact")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const product = productByItem.get(it.inventory_item_id);
                  const insufficient = isSupplier && isApproved &&
                    (sourceStockByItem.get(it.inventory_item_id) ?? 0) < Number(it.quantity);
                  const myBridges = bridgeByItem.get(it.id) ?? [];
                  const myMv = myBridges.map((b) => movements[b.movement_id]).filter(Boolean);
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
                      <td className="px-3 py-2 text-[var(--text-secondary)]">
                        {t(`inv.returns.condition.${it.condition_status}`)}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">
                        {t(`inv.returns.disp.${it.disposition}`)}
                      </td>
                      <td className={`px-3 py-2 ${insufficient ? "text-rose-300 dark:text-rose-200" : "text-[var(--text-secondary)]"}`}>
                        {myMv.length > 0 ? (
                          <span className="space-y-0.5">
                            {myMv.map((m) => {
                              const targetWh = warehouseMap.get(m.warehouse_id);
                              return (
                                <span key={m.id} className="block">
                                  <DirectionDelta direction={m.direction} quantity={m.quantity} unit={m.unit} />
                                  <span className="ml-1 text-[10.5px] text-[var(--text-dim)]">
                                    @ {targetWh ? `${targetWh.code}` : "—"}
                                  </span>
                                </span>
                              );
                            })}
                          </span>
                        ) : (
                          <span className="text-[var(--text-dim)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[11.5px] text-[var(--text-dim)]">
                      {t("inv.returns.form.need_items")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* INV-H6 — Single "Details" accordion: timeline, source doc,
            related movements, traceability, raw timestamps. */}
        <DetailsAccordion label={t("inv.returns.detail.timeline") + " · " + t("inv.returns.detail.movements")}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
              <HeaderCell label={t("inv.returns.col.created")} value={new Date(ret.created_at).toLocaleString()} />
              <HeaderCell label={t("inv.returns.timeline.submitted")} value={fmt(ret.requested_at)} />
              <HeaderCell label={t("inv.returns.timeline.approved")} value={fmt(ret.approved_at)} />
              <HeaderCell
                label={isCustomer ? t("inv.returns.timeline.received") : t("inv.returns.timeline.shipped")}
                value={fmt(ret.processed_at)}
              />
              {ret.source_document_type && ret.source_document_id && (
                <HeaderCell
                  label={t("inv.returns.form.source_doc_type")}
                  value={
                    <a
                      href={sourceDocHref(ret.source_document_type, ret.source_document_id)}
                      className="font-mono text-[11px] text-[var(--accent-primary,#3b82f6)] hover:underline"
                    >
                      {ret.source_document_type} · {ret.source_document_id.slice(0, 8)}
                    </a>
                  }
                />
              )}
            </div>

            <div>
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)] mb-2">
                {t("inv.returns.detail.timeline")}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                <Step label={t("inv.returns.timeline.drafted")}   at={ret.created_at}    done />
                <Step label={t("inv.returns.timeline.submitted")} at={ret.requested_at}  done={!!ret.requested_at} />
                <Step label={t("inv.returns.timeline.approved")}  at={ret.approved_at}   done={!!ret.approved_at} />
                <Step
                  label={isCustomer ? t("inv.returns.timeline.received") : t("inv.returns.timeline.shipped")}
                  at={ret.processed_at}
                  done={!!ret.processed_at}
                />
                <Step
                  label={t("inv.returns.timeline.completed")}
                  at={isCompleted ? ret.processed_at : null}
                  done={isCompleted}
                />
              </div>
            </div>

            <div>
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)] mb-2">
                {t("inv.returns.detail.movements")}
              </div>
              {bridges.length === 0 ? (
                <div className="text-[11.5px] text-[var(--text-dim)]">
                  {t("inv.returns.detail.no_movements")}
                </div>
              ) : (
                <table className="min-w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                      <th className="px-2 py-1.5 text-left">{t("inv.returns.form.item")}</th>
                      <th className="px-2 py-1.5 text-left">Movement</th>
                      <th className="px-2 py-1.5 text-left">Warehouse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const product = productByItem.get(it.inventory_item_id);
                      const myBridges = bridgeByItem.get(it.id) ?? [];
                      if (myBridges.length === 0) {
                        return (
                          <tr key={it.id} className="border-b border-[var(--border-subtle)]/40 last:border-b-0">
                            <td className="px-2 py-1.5">{product?.product_name ?? <span className="font-mono text-[10.5px] text-[var(--text-dim)]">{it.inventory_item_id.slice(0, 8)}</span>}</td>
                            <td colSpan={2} className="px-2 py-1.5 text-[var(--text-dim)]">—</td>
                          </tr>
                        );
                      }
                      return myBridges.map((b, ix) => {
                        const mv = movements[b.movement_id];
                        const mvWh = mv ? warehouseMap.get(mv.warehouse_id) : null;
                        return (
                          <tr key={b.id} className="border-b border-[var(--border-subtle)]/40 last:border-b-0">
                            {ix === 0 ? (
                              <td className="px-2 py-1.5" rowSpan={myBridges.length}>{product?.product_name ?? <span className="font-mono text-[10.5px] text-[var(--text-dim)]">{it.inventory_item_id.slice(0, 8)}</span>}</td>
                            ) : null}
                            <td className="px-2 py-1.5">{mv ? <MovementLink mv={mv} onOpen={(id) => router.push(`/inventory/movements?focus=${id}`)} /> : <span className="text-[var(--text-dim)]">—</span>}</td>
                            <td className="px-2 py-1.5 text-[var(--text-secondary)]">{mvWh ? `${mvWh.code} — ${mvWh.name}` : <span className="text-[var(--text-dim)]">—</span>}</td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <TraceabilityCard
              links={[
                { label: t("inv.trace.current_warehouse"), value: wh?.code ?? "—", href: "/inventory/warehouses", icon: "bank" },
                ...(ret.source_document_type
                  ? [{ label: "Source", value: ret.source_document_type, href: ret.source_document_id ? sourceDocHref(ret.source_document_type, ret.source_document_id) : undefined, icon: "file-invoice" as const }]
                  : []),
              ]}
            />
          </div>
        </DetailsAccordion>

        {showVoid && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-5">
              <div className="mb-2 text-[13px] font-medium">{t("inv.returns.act.void")}</div>
              <textarea
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder={t("inv.returns.act.void_reason")}
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
                  <RrIcon name="check" size={12} /> {t("inv.returns.act.void")}
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

function MovementLink({ mv, onOpen }: { mv: { id: string; movement_no: string; direction: "in" | "out"; quantity: number; unit: string; status: string }; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(mv.id)}
      className="inline-flex items-center gap-2 text-left hover:underline"
    >
      <span className="font-mono text-[11px] text-[var(--text-secondary)]">{mv.movement_no}</span>
      <DirectionDelta direction={mv.direction} quantity={mv.quantity} unit={mv.unit} />
      <HumanStatusPill status={mv.status} />
    </button>
  );
}

function sourceDocHref(type: string, id: string): string {
  if (type === "sales_shipment") return `/sales/shipments/${id}`;
  if (type === "invoice") return `/sales/invoices/${id}`;
  if (type === "purchase_receipt") return `/purchases/receipts/${id}`;
  if (type === "vendor_bill") return `/purchases/bills/${id}`;
  return "#";
}
