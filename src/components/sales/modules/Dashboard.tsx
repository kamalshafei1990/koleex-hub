"use client";

/* Sales Dashboard — KPI grid + recent activity feed.
   Pulls live counts via the existing API endpoints and the
   browser Supabase client (read-only summary numbers, RLS-safe). */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatMoney, sectionTitleCls, relativeTime } from "../shared";

import LineChartIcon from "@/components/icons/ui/LineChartIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

interface Stats {
  pipelineValue: number;
  pipelineCount: number;
  openQuotes: number;
  openOrders: number;
  outstanding: number;
  revenueMTD: number;
  activeCustomers: number;
  upcomingTasks: number;
  wonThisMonth: number;
}

export default function DashboardModule({ t }: SalesModuleProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<{ id: string; kind: string; label: string; ts: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const monthStart = new Date();
        monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

        const [oppsR, quotesR, ordersR, invoicesR, custR, actR] = await Promise.all([
          supabase.from("crm_opportunities").select("id,name,value,stage_id,is_won,is_lost,won_at,updated_at").eq("is_lost", false),
          supabase.from("quotations").select("id,quote_no,status,total,created_at,customer_name").order("created_at", { ascending: false }).limit(50),
          supabase.from("sales_orders").select("id,status,total,created_at").order("created_at", { ascending: false }).limit(50),
          supabase.from("invoices").select("id,status,total,balance,issued_at,created_at,customer_name").order("created_at", { ascending: false }).limit(50),
          supabase.from("customers").select("id,name,is_active"),
          supabase.from("crm_activities").select("id,title,due_date,is_done,created_at").eq("is_done", false).order("due_date", { ascending: true }).limit(20),
        ]);
        if (cancelled) return;

        const opps = oppsR.data ?? [];
        const quotes = quotesR.data ?? [];
        const orders = ordersR.data ?? [];
        const invoices = invoicesR.data ?? [];
        const customers = custR.data ?? [];
        const acts = actR.data ?? [];

        const pipelineActive = opps.filter((o) => !o.is_won && !o.is_lost);
        const pipelineValue = pipelineActive.reduce((a, o) => a + (Number(o.value) || 0), 0);
        const wonThisMonth = opps.filter((o) => o.is_won && o.won_at && new Date(o.won_at) >= monthStart).length;

        const openQuotes = quotes.filter((q) => ["draft", "sent", "pending"].includes((q.status || "").toLowerCase())).length;
        const openOrders = orders.filter((o) => !["cancelled", "delivered", "closed"].includes((o.status || "").toLowerCase())).length;
        const outstanding = invoices.reduce((a, i) => a + (Number(i.balance) || 0), 0);
        const revenueMTD = invoices
          .filter((i) => i.issued_at && new Date(i.issued_at) >= monthStart)
          .reduce((a, i) => a + (Number(i.total) || 0), 0);

        setStats({
          pipelineValue,
          pipelineCount: pipelineActive.length,
          openQuotes,
          openOrders,
          outstanding,
          revenueMTD,
          activeCustomers: customers.filter((c) => c.is_active !== false).length,
          upcomingTasks: acts.length,
          wonThisMonth,
        });

        // Build a feed mixing the last few of each kind
        const feed: { id: string; kind: string; label: string; ts: string }[] = [];
        for (const q of quotes.slice(0, 3)) feed.push({ id: q.id, kind: "quote",   label: `Quote ${q.quote_no || ""} — ${q.customer_name || ""}`, ts: q.created_at });
        for (const i of invoices.slice(0, 3)) feed.push({ id: i.id, kind: "invoice", label: `Invoice — ${i.customer_name || ""}  ${formatMoney(Number(i.total) || 0)}`, ts: i.created_at });
        for (const a of acts.slice(0, 3)) feed.push({ id: a.id, kind: "task",    label: a.title || "Task", ts: a.created_at });
        feed.sort((a, b) => (a.ts < b.ts ? 1 : -1));
        setRecent(feed.slice(0, 8));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const kpis = useMemo(() => {
    if (!stats) return [];
    return [
      { id: "pipelineValue",    icon: LayoutGridIcon, label: t("sales.kpi.pipelineValue"),    value: formatMoney(stats.pipelineValue), sub: `${stats.pipelineCount} active`, href: "/crm" },
      { id: "openQuotes",       icon: DocumentIcon,   label: t("sales.kpi.openQuotes"),       value: String(stats.openQuotes), sub: t("sales.thisMonth"),         href: "/quotations" },
      { id: "openOrders",       icon: BoxesIcon,      label: t("sales.kpi.openOrders"),       value: String(stats.openOrders), sub: t("sales.allTime"),           href: "/sales" },
      { id: "outstanding",      icon: DocumentIcon,   label: t("sales.kpi.outstanding"),      value: formatMoney(stats.outstanding), sub: t("sales.allTime"),     href: "/invoices" },
      { id: "revenueMTD",       icon: LineChartIcon,  label: t("sales.kpi.revenueMTD"),       value: formatMoney(stats.revenueMTD), sub: t("sales.thisMonth"),    href: "/invoices" },
      { id: "activeCustomers",  icon: UsersIcon,      label: t("sales.kpi.activeCustomers"),  value: String(stats.activeCustomers), sub: t("sales.allTime"),      href: "/customers" },
      { id: "upcomingTasks",    icon: ActivityIcon,   label: t("sales.kpi.upcomingTasks"),    value: String(stats.upcomingTasks), sub: t("sales.recent"),          href: "/crm" },
      { id: "wonThisMonth",     icon: CheckCircleIcon,label: t("sales.kpi.wonThisMonth"),     value: String(stats.wonThisMonth), sub: t("sales.thisMonth"),        href: "/crm" },
    ];
  }, [stats, t]);

  if (loading || !stats) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-dim)]">
        <SpinnerIcon size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((k) => (
          <Link
            key={k.id}
            href={k.href}
            className={`${cardCls} p-4 hover:border-[var(--border-focus)] transition-colors`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] truncate">{k.label}</span>
              <span className="h-7 w-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                <k.icon size={13} />
              </span>
            </div>
            <div className="text-[20px] md:text-[22px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">{k.value}</div>
            <div className="text-[10px] text-[var(--text-ghost)] mt-1 truncate">{k.sub}</div>
          </Link>
        ))}
      </div>

      {/* Recent activity feed */}
      <div className={`${cardCls} p-4 md:p-5`}>
        <h2 className={sectionTitleCls}>
          <SparklesIcon className="h-3 w-3" />
          {t("sales.recent")}
        </h2>
        {recent.length === 0 ? (
          <p className="text-[12px] text-[var(--text-dim)]">{t("sales.empty.noActivities")}</p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((r) => (
              <li key={r.kind + r.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-surface)] transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center justify-center h-5 px-1.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)] shrink-0">
                    {r.kind}
                  </span>
                  <span className="text-[13px] text-[var(--text-primary)] truncate">{r.label}</span>
                </div>
                <span className="text-[11px] text-[var(--text-dim)] tabular-nums shrink-0">{relativeTime(r.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
