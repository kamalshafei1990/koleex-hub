"use client";

/* RFQs — Request for Quotation. After a requisition is approved we
   send an RFQ to one or more vendors so they can quote. Once the
   supplier responds with a price, the RFQ converts into a PO. */

import { useMemo } from "react";
import type { PurchaseModuleProps, SupplierRef } from "../shared";
import { cardCls, formatMoney, formatDate, sectionTitleCls, supplierNames, usePurchaseList } from "../shared";
import FileBadge2Icon from "@/components/icons/ui/FileBadge2Icon";
import { kxInspectAttrs } from "@/lib/qa/inspector";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type RFQ = {
  id: string; rfq_no: string | null; status: string | null;
  supplier_id: string | null; total_estimated: number | null;
  response_due: string | null; sent_at: string | null;
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  draft:     "bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/35",
  sent:      "bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40",
  responded: "bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35",
  closed:    "bg-[var(--bg-inverted)]/[0.06] text-[var(--text-muted)] border-[var(--border-subtle)]",
  cancelled: "bg-[#FF3333]/12 text-[#FF3333] border-[#FF3333]/35",
};

export default function RFQsModule({ t }: PurchaseModuleProps) {
  const { data, loading } = usePurchaseList<{ rows: RFQ[]; suppliers: SupplierRef[] }>("rfqs");
  const rows = data?.rows ?? [];
  const supplierName = useMemo(() => supplierNames(data?.suppliers), [data]);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} /></div>;

  return (
    <div className="space-y-4">
      <h2 className={sectionTitleCls}><FileBadge2Icon className="h-3 w-3" />{t("purchase.recent")} {t("purchase.tabRFQs").toLowerCase()}</h2>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("purchase.empty.noRFQs")}</p>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((r) => {
            const status = (r.status || "draft").toLowerCase();
            const tone = STATUS_TONE[status] || STATUS_TONE.draft;
            return (
              <div key={r.id} {...kxInspectAttrs({ component: "PurchaseRFQRow", module: "Purchases", section: "RFQs", recordId: r.id })} className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_140px_auto] gap-3 md:gap-4 items-center px-4 py-3">
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{r.rfq_no || r.id.slice(0, 8)}</span>
                <span className="text-[13px] text-[var(--text-muted)] truncate">{supplierName.get(r.supplier_id || "") || "—"}</span>
                <span className="hidden md:inline text-[11px] tabular-nums text-[var(--text-dim)]">{r.response_due ? `Due ${formatDate(r.response_due)}` : formatDate(r.created_at)}</span>
                <div className="flex items-center gap-2 justify-end">
                  <span className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tone}`}>{status}</span>
                  <span className="text-[13px] tabular-nums font-semibold text-[var(--text-primary)] min-w-[80px] text-right">{formatMoney(Number(r.total_estimated) || 0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
