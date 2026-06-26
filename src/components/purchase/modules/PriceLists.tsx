"use client";

/* Vendor Price Lists — supplier-specific pricing for products /
   services / consumables. Standard ERP setup feature (Odoo
   "Vendor Pricelists", SAP "Info Records"). Each list is owned by
   one supplier and carries many product → unit_price rows. */

import { useEffect, useState } from "react";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatDate, sectionTitleCls } from "../shared";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type PriceList = {
  id: string; supplier_id: string | null; name: string;
  currency: string | null; valid_from: string | null; valid_to: string | null;
  is_active: boolean | null; created_at: string;
};

export default function PriceListsModule({ t }: PurchaseModuleProps) {
  const [rows, setRows] = useState<PriceList[]>([]);
  const [supplierName, setSupplierName] = useState<Map<string, string>>(new Map());
  const [itemCount, setItemCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/purchase/list?resource=pricelists", { credentials: "include" });
      const data = (res.ok ? await res.json() : { rows: [], items: [], suppliers: [] }) as {
        rows: PriceList[];
        items: { price_list_id: string }[];
        suppliers: { id: string; display_name: string | null; company_name: string | null; full_name: string | null }[];
      };
      if (cancelled) return;
      setRows(data.rows);
      const counts: Record<string, number> = {};
      for (const it of data.items) {
        counts[it.price_list_id] = (counts[it.price_list_id] || 0) + 1;
      }
      setItemCount(counts);
      const m = new Map<string, string>();
      for (const c of data.suppliers) {
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
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 shrink-0">Active</span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] shrink-0">Inactive</span>
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
