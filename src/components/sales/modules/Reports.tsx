"use client";

/* Reports — three at-a-glance charts from the same DB the rest of
   the Sales hub reads. Pure SVG, no chart library — keeps the
   bundle tiny and the chart styles match the Hub's minimal look. */

import { useEffect, useMemo, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatMoney, sectionTitleCls } from "../shared";
import LineChartIcon from "@/components/icons/ui/LineChartIcon";
import ChartPieIcon from "@/components/icons/ui/ChartPieIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

export default function ReportsModule({ t }: SalesModuleProps) {
  const [invoices, setInvoices] = useState<{ total: number | null; issued_at: string | null; created_at: string }[]>([]);
  const [opps, setOpps] = useState<{ value: number | null; stage_id: string | null; is_won: boolean | null; is_lost: boolean | null }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; sort_order: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [iR, oR, sR] = await Promise.all([
        supabase.from("invoices").select("total,issued_at,created_at"),
        supabase.from("crm_opportunities").select("value,stage_id,is_won,is_lost"),
        supabase.from("crm_stages").select("id,name,sort_order").order("sort_order", { ascending: true }),
      ]);
      if (cancelled) return;
      setInvoices((iR.data ?? []) as typeof invoices);
      setOpps((oR.data ?? []) as typeof opps);
      setStages((sR.data ?? []) as typeof stages);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /* Last 6 months revenue (sum of invoice totals issued in the
     month). Render as a sparkline-style area chart. */
  const monthly = useMemo(() => {
    const out: { label: string; total: number }[] = [];
    const now = new Date();
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const total = invoices
        .filter((i) => {
          const at = i.issued_at || i.created_at;
          if (!at) return false;
          const t = new Date(at).getTime();
          return t >= d.getTime() && t < next.getTime();
        })
        .reduce((a, i) => a + (Number(i.total) || 0), 0);
      out.push({ label: d.toLocaleDateString("en-US", { month: "short" }), total });
    }
    return out;
  }, [invoices]);

  /* Pipeline funnel — count + total value per stage. */
  const funnel = useMemo(() => {
    return stages.map((s) => {
      const inStage = opps.filter((o) => o.stage_id === s.id && !o.is_won && !o.is_lost);
      return {
        name: s.name,
        count: inStage.length,
        value: inStage.reduce((a, o) => a + (Number(o.value) || 0), 0),
      };
    });
  }, [opps, stages]);

  /* Won vs Lost (last 365 days). */
  const winLoss = useMemo(() => {
    const won = opps.filter((o) => o.is_won).length;
    const lost = opps.filter((o) => o.is_lost).length;
    const total = won + lost;
    return { won, lost, total, winRate: total > 0 ? Math.round((won / total) * 100) : 0 };
  }, [opps]);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  const haveAnyData = invoices.length + opps.length > 0;
  if (!haveAnyData) {
    return (
      <div className="p-6">
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("sales.report.notReady")}</p>
        </div>
      </div>
    );
  }

  /* Sparkline scale */
  const maxMonthly = Math.max(1, ...monthly.map((m) => m.total));
  const maxFunnel  = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
      {/* Revenue trend */}
      <div className={`${cardCls} p-5`}>
        <h2 className={sectionTitleCls}><LineChartIcon className="h-3 w-3" />{t("sales.report.revenueTrend")}</h2>
        <p className="text-[10px] text-[var(--text-ghost)] uppercase tracking-wider mb-3">Last 6 months</p>
        <div className="flex items-end gap-2 h-32">
          {monthly.map((m, i) => {
            const h = (m.total / maxMonthly) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="text-[10px] tabular-nums font-medium text-[var(--text-dim)]">
                  {m.total > 0 ? formatMoney(m.total) : ""}
                </div>
                <div
                  className="w-full rounded-t-md bg-[var(--text-primary)]/80 transition-all"
                  style={{ height: `${Math.max(3, h)}%`, minHeight: "3px" }}
                  title={`${m.label}: ${formatMoney(m.total)}`}
                />
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">{m.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline funnel */}
      <div className={`${cardCls} p-5`}>
        <h2 className={sectionTitleCls}><LayoutGridIcon className="h-3 w-3" />{t("sales.report.pipelineFunnel")}</h2>
        {funnel.length === 0 ? (
          <p className="text-[12px] text-[var(--text-dim)]">No stages defined yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {funnel.map((f, i) => {
              const pct = (f.count / maxFunnel) * 100;
              return (
                <li key={i}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[12px] text-[var(--text-primary)] truncate">{f.name}</span>
                    <span className="text-[11px] tabular-nums text-[var(--text-dim)] shrink-0">
                      {f.count} · {formatMoney(f.value)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--text-primary)]/70 transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Win / loss */}
      <div className={`${cardCls} p-5 lg:col-span-2`}>
        <h2 className={sectionTitleCls}><ChartPieIcon className="h-3 w-3" />Win / loss</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-[24px] font-bold tracking-tight text-emerald-400 leading-tight">{winLoss.won}</div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)]">Won</div>
          </div>
          <div>
            <div className="text-[24px] font-bold tracking-tight text-red-400 leading-tight">{winLoss.lost}</div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)]">Lost</div>
          </div>
          <div>
            <div className="text-[24px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">{winLoss.winRate}%</div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)]">Win rate</div>
          </div>
        </div>
        {winLoss.total > 0 && (
          <div className="mt-4 h-2 rounded-full bg-red-500/30 overflow-hidden flex">
            <div className="h-full bg-emerald-500" style={{ width: `${winLoss.winRate}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
