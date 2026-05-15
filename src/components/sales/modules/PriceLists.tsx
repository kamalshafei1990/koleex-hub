"use client";

/* Price Lists — named pricing schemas applied to customers/markets.
   Standard ERP feature (Odoo "Pricelists", SAP "Condition Records",
   Salesforce "Price Books"). Each list has many items mapping
   product → price; we render the list metadata + item count and
   link out to the dedicated /products pricing area. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatDate, linkBtnCls, sectionTitleCls } from "../shared";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type PriceList = {
  id: string; name: string; currency: string | null;
  is_active: boolean | null; created_at: string;
};

export default function PriceListsModule({ t }: SalesModuleProps) {
  const [rows, setRows] = useState<PriceList[]>([]);
  const [itemCount, setItemCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pR, iR] = await Promise.all([
        supabase.from("price_lists").select("id,name,currency,is_active,created_at").order("created_at", { ascending: false }),
        supabase.from("price_list_items").select("price_list_id"),
      ]);
      if (cancelled) return;
      setRows((pR.data ?? []) as PriceList[]);
      const counts: Record<string, number> = {};
      for (const it of (iR.data ?? []) as { price_list_id: string }[]) {
        counts[it.price_list_id] = (counts[it.price_list_id] || 0) + 1;
      }
      setItemCount(counts);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><LayoutGridIcon className="h-3 w-3" />Price lists</h2>
        <Link href="/products/settings" className={linkBtnCls}>{t("sales.openInApp")}<AngleRightIcon className="h-3 w-3" /></Link>
      </div>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("sales.empty.noPriceLists")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((p) => (
            <div key={p.id} className={`${cardCls} p-4`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)] truncate">{p.name}</h3>
                {p.is_active !== false ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">Active</span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-slate-500/15 text-slate-400 border border-slate-500/20 shrink-0">Inactive</span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[20px] font-bold tabular-nums text-[var(--text-primary)] leading-tight">{itemCount[p.id] || 0}</span>
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-dim)]">items</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[var(--text-ghost)]">
                <span>{p.currency || "USD"}</span>
                <span>Created {formatDate(p.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
