"use client";

/* Purchase Orders — confirmed buy commitments to a supplier. The
   beating heart of the procure-to-pay flow: a PO references a
   requisition (optional), points at one supplier, lists the items
   we're buying with quantities + unit costs, and tracks how much
   has been received and billed against it. */

import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatMoney, formatDate, sectionTitleCls, STATUS_TONE_PO } from "../shared";
import { NewPurchaseOrderDialog } from "../dialogs";
import ReceiveDialog from "../ReceiveDialog";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type PO = {
  id: string; po_no: string | null; status: string | null;
  supplier_id: string | null; total: number | null; currency: string | null;
  order_date: string | null; expected_delivery_date: string | null;
  created_at: string;
};

export default function OrdersModule({ t }: PurchaseModuleProps) {
  const [rows, setRows] = useState<PO[]>([]);
  const [supplierName, setSupplierName] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [receivePoId, setReceivePoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [pR, cR] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select("id,po_no,status,supplier_id,total,currency,order_date,expected_delivery_date,created_at")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("contacts").select("id,display_name,company_name,full_name").eq("contact_type", "supplier"),
    ]);
    setRows((pR.data ?? []) as PO[]);
    const m = new Map<string, string>();
    for (const c of (cR.data ?? []) as { id: string; display_name: string | null; company_name: string | null; full_name: string | null }[]) {
      m.set(c.id, c.company_name || c.display_name || c.full_name || "—");
    }
    setSupplierName(m);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><BoxesIcon className="h-3 w-3" />{t("purchase.recent")} {t("purchase.tabOrders").toLowerCase()}</h2>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 transition-all"
        >
          <PlusIcon className="h-3.5 w-3.5" /> New PO
        </button>
      </div>

      <NewPurchaseOrderDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={load} />
      {receivePoId && (
        <ReceiveDialog
          open={!!receivePoId}
          poId={receivePoId}
          onClose={() => setReceivePoId(null)}
          onSuccess={() => { setReceivePoId(null); load(); }}
        />
      )}

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("purchase.empty.noOrders")}</p>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((p) => {
            const status = (p.status || "draft").toLowerCase();
            const tone = STATUS_TONE_PO[status] || STATUS_TONE_PO.draft;
            return (
              <div key={p.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_140px_auto] gap-3 md:gap-4 items-center px-4 py-3">
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{p.po_no || p.id.slice(0, 8)}</span>
                <div className="min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] truncate">{supplierName.get(p.supplier_id || "") || "—"}</p>
                  <p className="text-[11px] text-[var(--text-dim)]">{p.expected_delivery_date ? `Expected ${formatDate(p.expected_delivery_date)}` : `Ordered ${formatDate(p.order_date || p.created_at)}`}</p>
                </div>
                <span className="hidden md:inline text-[11px] tabular-nums text-[var(--text-dim)]">{formatDate(p.order_date || p.created_at)}</span>
                <div className="flex items-center gap-2 justify-end">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${tone}`}>{status}</span>
                  <span className="text-[13px] tabular-nums font-semibold text-[var(--text-primary)] min-w-[80px] text-right">{formatMoney(Number(p.total) || 0, p.currency || "USD")}</span>
                  {/* O.3 — Receive button. Disabled for terminal statuses. */}
                  {!["received", "cancelled", "closed"].includes(status) && (
                    <button
                      type="button"
                      onClick={() => setReceivePoId(p.id)}
                      className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-primary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]"
                    >
                      Receive
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
