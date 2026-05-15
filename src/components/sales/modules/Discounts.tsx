"use client";

/* Discounts — discount approval tiers + volume-based break tables.
   Standard ERP feature (Odoo "Pricing Rules", SAP "Condition
   Master / Pricing Procedures", Salesforce CPQ "Discount Schedule").
   Two tables back this view:
     · commercial_discount_tiers       — % bands + approver role
     · commercial_volume_discount_tiers — order-size-based bands */

import { useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatMoney, sectionTitleCls } from "../shared";
import LineChartIcon from "@/components/icons/ui/LineChartIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type DiscountTier = {
  id: string; code: string; label: string;
  min_percent: number | null; max_percent: number | null;
  approver_role: string | null; sort_order: number | null;
  is_active: boolean | null;
};

type VolumeTier = {
  id: string; code: string; name: string;
  min_order_usd: number | null; max_order_usd: number | null;
  discount_min_percent: number | null; discount_max_percent: number | null;
  sort_order: number | null; is_active: boolean | null;
};

export default function DiscountsModule({ t }: SalesModuleProps) {
  const [tiers, setTiers] = useState<DiscountTier[]>([]);
  const [vols, setVols] = useState<VolumeTier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [d, v] = await Promise.all([
        supabase.from("commercial_discount_tiers")
          .select("id,code,label,min_percent,max_percent,approver_role,sort_order,is_active")
          .order("sort_order", { ascending: true, nullsFirst: false }),
        supabase.from("commercial_volume_discount_tiers")
          .select("id,code,name,min_order_usd,max_order_usd,discount_min_percent,discount_max_percent,sort_order,is_active")
          .order("sort_order", { ascending: true, nullsFirst: false }),
      ]);
      if (cancelled) return;
      setTiers((d.data ?? []) as DiscountTier[]);
      setVols((v.data ?? []) as VolumeTier[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  const hasAny = tiers.length + vols.length > 0;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <h2 className={sectionTitleCls}><LineChartIcon className="h-3 w-3" />Discount policy</h2>

      {!hasAny ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("sales.empty.noDiscounts")}</p>
        </div>
      ) : (
        <>
          {/* Approval tiers — what discount level needs whose sign-off */}
          {tiers.length > 0 && (
            <div className={`${cardCls} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Approval tiers</h3>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">% range → approver</span>
              </div>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {tiers.map((d) => (
                  <li key={d.id} className="grid grid-cols-[80px_1fr_140px_auto] gap-3 items-center px-4 py-3">
                    <span className="font-mono text-[11px] font-semibold text-[var(--text-muted)]">{d.code}</span>
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{d.label}</p>
                      <p className="text-[11px] text-[var(--text-dim)]">
                        {(d.min_percent ?? 0)}% – {(d.max_percent ?? 0)}%
                      </p>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider truncate">{d.approver_role || "—"}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${d.is_active !== false ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-slate-500/15 text-slate-400 border-slate-500/20"}`}>
                      {d.is_active !== false ? "Active" : "Off"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Volume breaks — discount % keyed off order size */}
          {vols.length > 0 && (
            <div className={`${cardCls} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Volume breaks</h3>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">order size → discount</span>
              </div>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {vols.map((v) => (
                  <li key={v.id} className="grid grid-cols-[80px_1fr_180px_auto] gap-3 items-center px-4 py-3">
                    <span className="font-mono text-[11px] font-semibold text-[var(--text-muted)]">{v.code}</span>
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{v.name}</p>
                      <p className="text-[11px] text-[var(--text-dim)] tabular-nums">
                        {formatMoney(Number(v.min_order_usd) || 0)} – {v.max_order_usd ? formatMoney(Number(v.max_order_usd)) : "∞"}
                      </p>
                    </div>
                    <span className="text-[12px] tabular-nums text-[var(--text-muted)]">
                      {(v.discount_min_percent ?? 0)}% – {(v.discount_max_percent ?? 0)}%
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${v.is_active !== false ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-slate-500/15 text-slate-400 border-slate-500/20"}`}>
                      {v.is_active !== false ? "Active" : "Off"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
