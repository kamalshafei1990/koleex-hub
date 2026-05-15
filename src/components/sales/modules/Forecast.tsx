"use client";

/* Forecast — probability-weighted revenue projection, grouped by
   quarter. Mirrors Salesforce Forecast and SAP S/4HANA "Sales
   Pipeline & Forecast" tile. Each opportunity contributes
   expected_revenue × probability/100 in the quarter of its
   expected_close_date. */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatMoney, linkBtnCls, sectionTitleCls } from "../shared";
import LineChartIcon from "@/components/icons/ui/LineChartIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Opp = {
  id: string;
  name: string;
  expected_revenue: number | null;
  probability: number | null;
  expected_close_date: string | null;
  won_at: string | null;
  lost_at: string | null;
};

function quarterKey(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()} Q${q}`;
}

function quarterStart(year: number, q: number): Date {
  return new Date(year, (q - 1) * 3, 1);
}

export default function ForecastModule({ t }: SalesModuleProps) {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await supabase
        .from("crm_opportunities")
        .select("id,name,expected_revenue,probability,expected_close_date,won_at,lost_at")
        .is("lost_at", null);
      if (cancelled) return;
      setOpps((r.data ?? []) as Opp[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /* Roll opportunities into 4 upcoming quarters starting from this
     one. We show two metrics per quarter: weighted (× probability)
     and unweighted (best-case). */
  const buckets = useMemo(() => {
    const now = new Date();
    const startQ = Math.floor(now.getMonth() / 3) + 1;
    const startY = now.getFullYear();
    const out: { label: string; weighted: number; unweighted: number; count: number; won: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const q = ((startQ - 1 + i) % 4) + 1;
      const y = startY + Math.floor((startQ - 1 + i) / 4);
      const qStart = quarterStart(y, q);
      const qEnd = quarterStart(y + (q === 4 ? 1 : 0), q === 4 ? 1 : q + 1);
      let weighted = 0, unweighted = 0, count = 0, won = 0;
      for (const o of opps) {
        const d = o.expected_close_date ? new Date(o.expected_close_date) : (o.won_at ? new Date(o.won_at) : null);
        if (!d) continue;
        if (d >= qStart && d < qEnd) {
          const rev = Number(o.expected_revenue) || 0;
          const prob = (Number(o.probability) || 0) / 100;
          unweighted += rev;
          weighted += rev * (o.won_at ? 1 : prob);
          count += 1;
          if (o.won_at) won += rev;
        }
      }
      out.push({ label: `${y} Q${q}`, weighted, unweighted, count, won });
    }
    return out;
  }, [opps]);

  const max = Math.max(1, ...buckets.map((b) => b.unweighted));

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  const haveAnyForecast = buckets.some((b) => b.count > 0);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><LineChartIcon className="h-3 w-3" />Quarterly forecast</h2>
        <Link href="/crm" className={linkBtnCls}>{t("sales.openInApp")}<AngleRightIcon className="h-3 w-3" /></Link>
      </div>

      {!haveAnyForecast ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("sales.empty.noForecast")}</p>
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {buckets.map((b, i) => (
              <div key={i} className={`${cardCls} p-4`}>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">{b.label}</div>
                <div className="text-[18px] md:text-[20px] font-bold text-[var(--text-primary)] leading-tight">{formatMoney(b.weighted)}</div>
                <div className="text-[11px] text-[var(--text-ghost)] mt-1">
                  {b.count} {b.count === 1 ? "opp" : "opps"} · {formatMoney(b.unweighted)} max
                </div>
              </div>
            ))}
          </div>

          {/* Bar chart with weighted vs unweighted */}
          <div className={`${cardCls} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Weighted vs unweighted</h3>
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[var(--text-primary)]/30" /> Max</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[var(--text-primary)]/80" /> Weighted</span>
              </div>
            </div>
            <div className="flex items-end gap-3 h-40">
              {buckets.map((b, i) => {
                const hMax = (b.unweighted / max) * 100;
                const hW = (b.weighted / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="text-[10px] tabular-nums font-medium text-[var(--text-dim)]">
                      {b.weighted > 0 ? formatMoney(b.weighted) : ""}
                    </div>
                    <div className="w-full relative" style={{ height: "100%" }}>
                      <div
                        className="absolute bottom-0 inset-x-0 rounded-t-md bg-[var(--text-primary)]/30"
                        style={{ height: `${Math.max(3, hMax)}%` }}
                      />
                      <div
                        className="absolute bottom-0 inset-x-0 rounded-t-md bg-[var(--text-primary)]/80 transition-all"
                        style={{ height: `${Math.max(3, hW)}%` }}
                      />
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">{b.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
