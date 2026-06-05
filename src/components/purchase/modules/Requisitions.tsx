"use client";

/* Requisitions — internal "we want to buy X" requests. The standard
   first step in any ERP procurement workflow (Odoo "Purchase
   Requests", SAP MM "Banf", Cisco "Buy Cisco" forms). Threshold
   approvals (configured in the Approvals tab) decide whether the
   request auto-approves or needs a manager / director / CFO sign-
   off before becoming an RFQ or PO. */

import { useCallback, useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatMoney, formatDate, sectionTitleCls, STATUS_TONE_REQ } from "../shared";
import { NewRequisitionDialog } from "../dialogs";
import FilePlusIcon from "@/components/icons/ui/FilePlusIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";

type Requisition = {
  id: string; pr_no: string | null; status: string | null;
  department: string | null; priority: number | null;
  needed_by: string | null; total_estimated: number | null;
  currency: string | null; created_at: string;
};

const PRIORITY_LABEL = ["Low", "Normal", "High", "Urgent"];
const PRIORITY_TONE = [
  "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]",
  "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
];

export default function RequisitionsModule({ t }: PurchaseModuleProps) {
  const [rows, setRows] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await supabase
      .from("purchase_requisitions")
      .select("id,pr_no,status,department,priority,needed_by,total_estimated,currency,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setRows((r.data ?? []) as Requisition[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><FilePlusIcon className="h-3 w-3" />{t("purchase.recent")} {t("purchase.tabRequisitions").toLowerCase()}</h2>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 transition-all"
        >
          <PlusIcon className="h-3.5 w-3.5" /> New requisition
        </button>
      </div>

      <NewRequisitionDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={load} />

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("purchase.empty.noReqs")}</p>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((r) => {
            const status = (r.status || "draft").toLowerCase();
            const tone = STATUS_TONE_REQ[status] || STATUS_TONE_REQ.draft;
            const prio = Math.max(0, Math.min(3, Number(r.priority) || 0));
            return (
              <div key={r.id} {...kxInspectAttrs({ component: "PurchaseRequisitionRow", module: "Purchases", section: "Requisitions", recordId: r.id })} className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_120px_auto] gap-3 md:gap-4 items-center px-4 py-3">
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{r.pr_no || r.id.slice(0, 8)}</span>
                <div className="min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] truncate">{r.department || "—"}</p>
                  <p className="text-[11px] text-[var(--text-dim)]">{r.needed_by ? `Needed by ${formatDate(r.needed_by)}` : "No deadline"}</p>
                </div>
                <span className="hidden md:inline text-[12px] tabular-nums text-[var(--text-dim)]">{formatDate(r.created_at)}</span>
                <div className="flex items-center gap-2 justify-end">
                  <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${PRIORITY_TONE[prio]}`}>{PRIORITY_LABEL[prio]}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${tone}`}>{status}</span>
                  <span className="text-[13px] tabular-nums font-semibold text-[var(--text-primary)] min-w-[80px] text-right">{formatMoney(Number(r.total_estimated) || 0, r.currency || "USD")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
