"use client";

/* Returns to vendor — wrong / damaged / over-shipped goods being
   sent back. Tracks the return reason, refund amount, and which
   PO / receipt / bill the return offsets. */

import { useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatMoney, formatDate, sectionTitleCls } from "../shared";
import CornerUpLeftIcon from "@/components/icons/ui/CornerUpLeftIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Return = {
  id: string; return_no: string | null; status: string | null;
  supplier_id: string | null; reason: string | null;
  total_value: number | null; refund_amount: number | null; currency: string | null;
  return_date: string | null; created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  draft:     "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]",
  sent:      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  refunded:  "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  closed:    "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]",
  cancelled: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export default function ReturnsModule({ t }: PurchaseModuleProps) {
  const [rows, setRows] = useState<Return[]>([]);
  const [supplierName, setSupplierName] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [rR, cR] = await Promise.all([
        supabase
          .from("purchase_returns")
          .select("id,return_no,status,supplier_id,reason,total_value,refund_amount,currency,return_date,created_at")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("contacts").select("id,display_name,company_name,full_name").not("supplier_type", "is", null),
      ]);
      if (cancelled) return;
      setRows((rR.data ?? []) as Return[]);
      const m = new Map<string, string>();
      for (const c of (cR.data ?? []) as { id: string; display_name: string | null; company_name: string | null; full_name: string | null }[]) {
        m.set(c.id, c.company_name || c.display_name || c.full_name || "—");
      }
      setSupplierName(m);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h2 className={sectionTitleCls}><CornerUpLeftIcon className="h-3 w-3" />{t("purchase.recent")} {t("purchase.tabReturns").toLowerCase()}</h2>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("purchase.empty.noReturns")}</p>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((r) => {
            const status = (r.status || "draft").toLowerCase();
            const tone = STATUS_TONE[status] || STATUS_TONE.draft;
            return (
              <div key={r.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_140px_auto] gap-3 md:gap-4 items-center px-4 py-3">
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{r.return_no || r.id.slice(0, 8)}</span>
                <div className="min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] truncate">{supplierName.get(r.supplier_id || "") || "—"}</p>
                  <p className="text-[11px] text-[var(--text-dim)] truncate">{r.reason || "No reason given"}</p>
                </div>
                <span className="hidden md:inline text-[11px] tabular-nums text-[var(--text-dim)]">{formatDate(r.return_date || r.created_at)}</span>
                <div className="flex items-center gap-2 justify-end">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${tone}`}>{status}</span>
                  <span className="text-[13px] tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 min-w-[80px] text-right">{formatMoney(Number(r.refund_amount || r.total_value) || 0, r.currency || "USD")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
