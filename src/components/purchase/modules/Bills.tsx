"use client";

/* Vendor Bills — invoices the SUPPLIER sends to us. The mirror of
   the Sales-side `invoices` table: same lifecycle (draft → posted →
   paid) and overdue computation, just on the AP (accounts payable)
   side instead of AR. */

import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatMoney, formatDate, sectionTitleCls, STATUS_TONE_BILL } from "../shared";
import { NewBillDialog } from "../dialogs";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Bill = {
  id: string; bill_no: string | null; supplier_invoice_no: string | null;
  status: string | null; supplier_id: string | null;
  total: number | null; balance: number | null; currency: string | null;
  bill_date: string | null; due_date: string | null; created_at: string;
};

export default function BillsModule({ t }: PurchaseModuleProps) {
  const [rows, setRows] = useState<Bill[]>([]);
  const [supplierName, setSupplierName] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    const [bR, cR] = await Promise.all([
      supabase
        .from("vendor_bills")
        .select("id,bill_no,supplier_invoice_no,status,supplier_id,total,balance,currency,bill_date,due_date,created_at")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("contacts").select("id,display_name,company_name,full_name").not("supplier_type", "is", null),
    ]);
    setRows((bR.data ?? []) as Bill[]);
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
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><DocumentIcon className="h-3 w-3" />{t("purchase.recent")} {t("purchase.tabBills").toLowerCase()}</h2>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 transition-all"
        >
          <PlusIcon className="h-3.5 w-3.5" /> New bill
        </button>
      </div>

      <NewBillDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={load} />

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("purchase.empty.noBills")}</p>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((b) => {
            const status = (b.status || "draft").toLowerCase();
            const tone = STATUS_TONE_BILL[status] || STATUS_TONE_BILL.draft;
            const overdue = b.due_date && status !== "paid" && Number(b.balance) > 0 && new Date(b.due_date) < new Date();
            return (
              <div key={b.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_140px_auto] gap-3 md:gap-4 items-center px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{b.bill_no || b.id.slice(0, 8)}</p>
                  {b.supplier_invoice_no && <p className="text-[10px] text-[var(--text-ghost)]">Vendor #: {b.supplier_invoice_no}</p>}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] truncate">{supplierName.get(b.supplier_id || "") || "—"}</p>
                  <p className="text-[11px] text-[var(--text-dim)]">{b.due_date ? `Due ${formatDate(b.due_date)}` : `Billed ${formatDate(b.bill_date || b.created_at)}`}</p>
                </div>
                <span className="hidden md:inline text-[11px] tabular-nums text-[var(--text-dim)]">{formatDate(b.bill_date || b.created_at)}</span>
                <div className="flex items-center gap-2 justify-end">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${overdue ? STATUS_TONE_BILL.overdue : tone}`}>
                    {overdue ? "overdue" : status}
                  </span>
                  <span className="text-[13px] tabular-nums font-semibold text-[var(--text-primary)] min-w-[80px] text-right">{formatMoney(Number(b.total) || 0, b.currency || "USD")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
