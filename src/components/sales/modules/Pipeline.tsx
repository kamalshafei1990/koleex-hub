"use client";

/* Pipeline — opportunity overview by stage. Compact summary that
   leverages the same `crm_opportunities` + `crm_stages` tables the
   full /crm app uses. Dropping a heavy kanban here would duplicate
   4000 lines of /crm logic; instead we show stage-bucket counts +
   total value, with a "Open full app" deep-link for editing. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatMoney, linkBtnCls, sectionTitleCls } from "../shared";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Stage = { id: string; name: string; sort_order: number };
type Opp = { id: string; name: string; value: number | null; stage_id: string | null; expected_close_date: string | null; is_won: boolean | null; is_lost: boolean | null };

export default function PipelineModule({ t }: SalesModuleProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, o] = await Promise.all([
        supabase.from("crm_stages").select("id,name,sort_order").order("sort_order", { ascending: true }),
        supabase.from("crm_opportunities").select("id,name,value,stage_id,expected_close_date,is_won,is_lost").eq("is_lost", false),
      ]);
      if (cancelled) return;
      setStages((s.data ?? []) as Stage[]);
      setOpps((o.data ?? []) as Opp[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;
  }

  const byStage = new Map<string, Opp[]>();
  for (const o of opps) {
    const k = o.stage_id || "_none";
    if (!byStage.has(k)) byStage.set(k, []);
    byStage.get(k)!.push(o);
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><LayoutGridIcon className="h-3 w-3" />Pipeline by stage</h2>
        <Link href="/crm" className={linkBtnCls}>{t("sales.openInApp")}<AngleRightIcon className="h-3 w-3" /></Link>
      </div>

      {opps.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)] mb-3">{t("sales.empty.noOpps")}</p>
          <Link href="/crm" className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90">
            Create first opportunity
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {stages.map((s) => {
            const list = byStage.get(s.id) ?? [];
            const value = list.reduce((a, o) => a + (Number(o.value) || 0), 0);
            return (
              <div key={s.id} className={`${cardCls} p-4`}>
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)] truncate">{s.name}</h3>
                  <span className="text-[11px] tabular-nums text-[var(--text-dim)] shrink-0">{list.length}</span>
                </div>
                <div className="text-[18px] font-bold tracking-tight text-[var(--text-primary)] mb-3">{formatMoney(value)}</div>
                {list.length > 0 && (
                  <ul className="space-y-1">
                    {list.slice(0, 4).map((o) => (
                      <li key={o.id} className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="truncate text-[var(--text-muted)]">{o.name || "Untitled"}</span>
                        <span className="tabular-nums text-[var(--text-dim)] shrink-0">{formatMoney(Number(o.value) || 0)}</span>
                      </li>
                    ))}
                    {list.length > 4 && (
                      <li className="text-[11px] text-[var(--text-ghost)]">+{list.length - 4} more…</li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
