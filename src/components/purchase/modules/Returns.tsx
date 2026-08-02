"use client";

/* Returns to vendor — wrong / damaged / over-shipped goods being
   sent back. Tracks the return reason, refund amount, and which
   PO / receipt / bill the return offsets. */

import { useEffect, useState } from "react";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatMoney, formatDate, sectionTitleCls } from "../shared";
import CornerUpLeftIcon from "@/components/icons/ui/CornerUpLeftIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";

type Return = {
  id: string; return_no: string | null; status: string | null;
  supplier_id: string | null; reason: string | null;
  total_value: number | null; refund_amount: number | null; currency: string | null;
  return_date: string | null; created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  draft:     "bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/35",
  sent:      "bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40",
  refunded:  "bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35",
  closed:    "bg-[var(--bg-inverted)]/[0.06] text-[var(--text-muted)] border-[var(--border-subtle)]",
  cancelled: "bg-[#FF3333]/12 text-[#FF3333] border-[#FF3333]/35",
};

export default function ReturnsModule({ t }: PurchaseModuleProps) {
  const [rows, setRows] = useState<Return[]>([]);
  const [supplierName, setSupplierName] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      /* RLS-5: gated tenant-scoped read (was a direct anon-client query). */
      const res = await fetch("/api/purchase/list?resource=returns", { credentials: "include" });
      const j = res.ok
        ? ((await res.json()) as { rows?: Return[]; suppliers?: { id: string; display_name: string | null; company_name: string | null; full_name: string | null }[] })
        : { rows: [], suppliers: [] };
      if (cancelled) return;
      setRows(j.rows ?? []);
      const m = new Map<string, string>();
      for (const c of j.suppliers ?? []) {
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
              <div key={r.id} {...kxInspectAttrs({ component: "PurchaseReturnRow", module: "Purchases", section: "Returns", recordId: r.id })} className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_140px_auto] gap-3 md:gap-4 items-center px-4 py-3">
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{r.return_no || r.id.slice(0, 8)}</span>
                <div className="min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] truncate">{supplierName.get(r.supplier_id || "") || "—"}</p>
                  <p className="text-[11px] text-[var(--text-dim)] truncate">{r.reason || "No reason given"}</p>
                </div>
                <span className="hidden md:inline text-[11px] tabular-nums text-[var(--text-dim)]">{formatDate(r.return_date || r.created_at)}</span>
                <div className="flex items-center gap-2 justify-end">
                  <span className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tone}`}>{status}</span>
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
