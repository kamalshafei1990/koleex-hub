"use client";

/* Commissions — agent commission tiers used to compute earnings on
   closed-won orders. Standard ERP feature (Odoo "Sales Commission",
   SAP "Incentive & Commission Management", Salesforce CPQ
   "Commission Plans"). The reference table is
   commercial_commission_tiers; we surface the schedule + a quick
   estimate of MTD earned commission across won opportunities. */

import { useEffect, useMemo, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatMoney, sectionTitleCls } from "../shared";
import LineChartIcon from "@/components/icons/ui/LineChartIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Tier = {
  id: string; code: string; name: string;
  rate_percent: number | null; applies_to: string | null;
  sort_order: number | null; is_active: boolean | null;
};

type WonOpp = {
  id: string;
  expected_revenue: number | null;
  won_at: string | null;
};

export default function CommissionsModule({ t }: SalesModuleProps) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [won, setWon] = useState<WonOpp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tR, wR] = await Promise.all([
        supabase
          .from("commercial_commission_tiers")
          .select("id,code,name,rate_percent,applies_to,sort_order,is_active")
          .order("sort_order", { ascending: true, nullsFirst: false }),
        supabase
          .from("crm_opportunities")
          .select("id,expected_revenue,won_at")
          .not("won_at", "is", null),
      ]);
      if (cancelled) return;
      setTiers((tR.data ?? []) as Tier[]);
      setWon((wR.data ?? []) as WonOpp[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /* Quick MTD estimate: sum of expected_revenue on won opportunities
     this month × the average active commission rate. Rough but useful
     until we have per-opportunity tier assignment. */
  const summary = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const wonMTD = won.filter((o) => o.won_at && new Date(o.won_at) >= monthStart);
    const wonRevenueMTD = wonMTD.reduce((a, o) => a + (Number(o.expected_revenue) || 0), 0);
    const activeTiers = tiers.filter((t) => t.is_active !== false && Number(t.rate_percent) > 0);
    const avgRate = activeTiers.length
      ? activeTiers.reduce((a, t) => a + (Number(t.rate_percent) || 0), 0) / activeTiers.length
      : 0;
    return {
      wonCount: wonMTD.length,
      wonRevenueMTD,
      avgRate,
      estimatedCommissionMTD: wonRevenueMTD * (avgRate / 100),
    };
  }, [won, tiers]);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <h2 className={sectionTitleCls}><LineChartIcon className="h-3 w-3" />Commission program</h2>

      {/* Estimate tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Won this month</div>
          <div className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{summary.wonCount}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Revenue MTD</div>
          <div className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{formatMoney(summary.wonRevenueMTD)}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Avg active rate</div>
          <div className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{summary.avgRate.toFixed(1)}%</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Est. commission MTD</div>
          <div className="text-[20px] font-bold text-emerald-400 leading-tight">{formatMoney(summary.estimatedCommissionMTD)}</div>
        </div>
      </div>

      {tiers.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("sales.empty.noCommissions")}</p>
        </div>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Commission tiers</h3>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {tiers.map((tier) => (
              <li key={tier.id} className="grid grid-cols-[80px_1fr_120px_120px_auto] gap-3 items-center px-4 py-3">
                <span className="font-mono text-[11px] font-semibold text-[var(--text-muted)]">{tier.code}</span>
                <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{tier.name}</p>
                <span className="text-[11px] text-[var(--text-dim)] uppercase tracking-wider truncate">{tier.applies_to || "—"}</span>
                <span className="text-[14px] font-bold tabular-nums text-[var(--text-primary)]">{(Number(tier.rate_percent) || 0).toFixed(1)}%</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${tier.is_active !== false ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-slate-500/15 text-slate-400 border-slate-500/20"}`}>
                  {tier.is_active !== false ? "Active" : "Off"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
