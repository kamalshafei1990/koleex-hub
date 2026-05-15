"use client";

/* Leads — top-of-funnel opportunities not yet qualified into the
   pipeline. Salesforce/Odoo treat these as a separate object; here
   we derive them from `crm_opportunities` rows that sit in the
   first stage(s) and have no probability yet (or a low one). */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatMoney, linkBtnCls, sectionTitleCls, relativeTime } from "../shared";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Stage = { id: string; name: string; sequence: number; is_won: boolean | null };
type Opp = {
  id: string; name: string; company_name: string | null; contact_name: string | null;
  expected_revenue: number | null; probability: number | null; stage_id: string | null;
  source: string | null; created_at: string; updated_at: string;
  won_at: string | null; lost_at: string | null;
};

export default function LeadsModule({ t }: SalesModuleProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, o] = await Promise.all([
        supabase.from("crm_stages").select("id,name,sequence,is_won").order("sequence", { ascending: true }),
        supabase
          .from("crm_opportunities")
          .select("id,name,company_name,contact_name,expected_revenue,probability,stage_id,source,created_at,updated_at,won_at,lost_at")
          .is("won_at", null)
          .is("lost_at", null)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setStages((s.data ?? []) as Stage[]);
      setOpps((o.data ?? []) as Opp[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /* "Lead" = sits in the first stage (lowest sequence). This mirrors
     Odoo's lead/opportunity split: leads are anything pre-qualified. */
  const leads = useMemo(() => {
    if (stages.length === 0) return opps;
    const firstStageId = stages[0].id;
    return opps.filter((o) => o.stage_id === firstStageId || o.stage_id === null);
  }, [opps, stages]);

  const totalValue = leads.reduce((a, l) => a + (Number(l.expected_revenue) || 0), 0);
  const avgValue = leads.length > 0 ? totalValue / leads.length : 0;

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><SparklesIcon className="h-3 w-3" />New leads</h2>
        <Link href="/crm" className={linkBtnCls}>{t("sales.openInApp")}<AngleRightIcon className="h-3 w-3" /></Link>
      </div>

      {/* Lead summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Open leads</div>
          <div className="text-[22px] font-bold text-[var(--text-primary)] leading-tight">{leads.length}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Pipeline value</div>
          <div className="text-[22px] font-bold text-[var(--text-primary)] leading-tight">{formatMoney(totalValue)}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Avg lead size</div>
          <div className="text-[22px] font-bold text-[var(--text-primary)] leading-tight">{formatMoney(avgValue)}</div>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)] mb-3">{t("sales.empty.noLeads")}</p>
          <Link href="/crm" className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90">Add lead</Link>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {leads.slice(0, 30).map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_140px_120px_auto] gap-3 md:gap-4 items-center px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{l.name || "Untitled lead"}</p>
                <p className="text-[11px] text-[var(--text-dim)] truncate">
                  {[l.company_name, l.contact_name, l.source].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span className="hidden md:inline text-[11px] tabular-nums text-[var(--text-dim)]">{relativeTime(l.created_at)}</span>
              <span className="hidden md:inline text-[11px] uppercase tracking-wider text-[var(--text-dim)]">
                {l.probability != null ? `${l.probability}%` : "—"}
              </span>
              <span className="text-[13px] tabular-nums font-semibold text-[var(--text-primary)] min-w-[80px] text-right">{formatMoney(Number(l.expected_revenue) || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
