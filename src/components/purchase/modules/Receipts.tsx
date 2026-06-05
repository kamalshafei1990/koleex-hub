"use client";

/* Goods Receipts (GRN) — proof that the supplier's shipment
   physically arrived, what condition it was in, and how much we
   accepted vs rejected. Sits between Purchase Orders and Vendor
   Bills in the standard 3-way match (PO ↔ Receipt ↔ Bill). */

import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatDate, sectionTitleCls } from "../shared";
import { NewReceiptDialog } from "../dialogs";
import ClipboardCheckIcon from "@/components/icons/ui/ClipboardCheckIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";

type Receipt = {
  id: string; gr_no: string | null; status: string | null;
  po_id: string | null; supplier_id: string | null;
  carrier: string | null; tracking_no: string | null;
  received_at: string | null; created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  draft:     "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]",
  partial:   "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  complete:  "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelled: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export default function ReceiptsModule({ t }: PurchaseModuleProps) {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [supplierName, setSupplierName] = useState<Map<string, string>>(new Map());
  const [poNo, setPoNo] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await supabase
      .from("purchase_receipts")
      .select("id,gr_no,status,po_id,supplier_id,carrier,tracking_no,received_at,created_at")
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(30);
    const list = (r.data ?? []) as Receipt[];
    const supplierIds = list.map((x) => x.supplier_id).filter((x): x is string => !!x);
    const poIds = list.map((x) => x.po_id).filter((x): x is string => !!x);

    const [cR, pR] = await Promise.all([
      supplierIds.length
        ? supabase.from("contacts").select("id,display_name,company_name,full_name").in("id", supplierIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null; company_name: string | null; full_name: string | null }[] }),
      poIds.length
        ? supabase.from("purchase_orders").select("id,po_no").in("id", poIds)
        : Promise.resolve({ data: [] as { id: string; po_no: string | null }[] }),
    ]);

    setRows(list);
    const sm = new Map<string, string>();
    for (const c of (cR.data ?? [])) sm.set(c.id, c.company_name || c.display_name || c.full_name || "—");
    setSupplierName(sm);
    const pm = new Map<string, string>();
    for (const p of (pR.data ?? [])) pm.set(p.id, p.po_no || "");
    setPoNo(pm);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><ClipboardCheckIcon className="h-3 w-3" />{t("purchase.recent")} {t("purchase.tabReceipts").toLowerCase()}</h2>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 transition-all"
        >
          <PlusIcon className="h-3.5 w-3.5" /> New receipt
        </button>
      </div>

      <NewReceiptDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={load} />

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("purchase.empty.noReceipts")}</p>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((r) => {
            const status = (r.status || "draft").toLowerCase();
            const tone = STATUS_TONE[status] || STATUS_TONE.draft;
            return (
              <div key={r.id} {...kxInspectAttrs({ component: "PurchaseReceiptRow", module: "Purchases", section: "Receipts", recordId: r.id })} className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_140px_auto] gap-3 md:gap-4 items-center px-4 py-3">
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{r.gr_no || r.id.slice(0, 8)}</span>
                <div className="min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] truncate">{supplierName.get(r.supplier_id || "") || "—"}</p>
                  <p className="text-[11px] text-[var(--text-dim)]">
                    {r.po_id ? `From PO ${poNo.get(r.po_id) || ""}` : "Unlinked"}
                    {r.carrier && ` · ${r.carrier}`}
                    {r.tracking_no && ` · ${r.tracking_no}`}
                  </p>
                </div>
                <span className="hidden md:inline text-[11px] tabular-nums text-[var(--text-dim)]">{formatDate(r.received_at || r.created_at)}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${tone}`}>{status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
