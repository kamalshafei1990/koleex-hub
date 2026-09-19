"use client";

/* Vendor Price Lists — supplier-specific pricing for products /
   services / consumables. Standard ERP setup feature (Odoo
   "Vendor Pricelists", SAP "Info Records"). Each list is owned by
   one supplier and carries many product → unit_price rows. */

import { useMemo } from "react";
import type { PurchaseModuleProps, SupplierRef } from "../shared";
import { cardCls, formatDate, sectionTitleCls, supplierNames, usePurchaseList } from "../shared";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type PriceList = {
  id: string; supplier_id: string | null; name: string;
  currency: string | null; valid_from: string | null; valid_to: string | null;
  is_active: boolean | null; created_at: string;
};

export default function PriceListsModule({ t }: PurchaseModuleProps) {
  const { data, loading } = usePurchaseList<{
    rows: PriceList[];
    items: { price_list_id: string }[];
    suppliers: SupplierRef[];
  }>("pricelists");
  const rows = data?.rows ?? [];
  const supplierName = useMemo(() => supplierNames(data?.suppliers), [data]);
  const itemCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of data?.items ?? []) counts[it.price_list_id] = (counts[it.price_list_id] || 0) + 1;
    return counts;
  }, [data]);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} /></div>;

  return (
    <div className="space-y-4">
      <h2 className={sectionTitleCls}><TagsIcon className="h-3 w-3" />Vendor price lists</h2>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("purchase.empty.noPriceLists")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((p) => (
            <div key={p.id} className={`${cardCls} p-4`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)] truncate">{p.name}</h3>
                {p.is_active !== false ? (
                  <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35 shrink-0">Active</span>
                ) : (
                  <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap bg-[var(--bg-inverted)]/[0.06] text-[var(--text-muted)] border-[var(--border-subtle)] shrink-0">Inactive</span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-dim)] truncate mb-2">{supplierName.get(p.supplier_id || "") || "—"}</p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[20px] font-bold tabular-nums text-[var(--text-primary)] leading-tight">{itemCount[p.id] || 0}</span>
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-dim)]">items</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[var(--text-ghost)]">
                <span>{p.currency || "USD"}</span>
                <span>{p.valid_from ? formatDate(p.valid_from) : "—"} – {p.valid_to ? formatDate(p.valid_to) : "no end"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
