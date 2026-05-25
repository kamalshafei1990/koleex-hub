"use client";

/* Purchase Dashboard — KPI grid + recent activity feed for the
   procure-to-pay pipeline. Aggregates spend / open POs / open
   bills / pending requisitions across the new purchase_* tables. */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatMoney, sectionTitleCls, relativeTime } from "../shared";

import LineChartIcon from "@/components/icons/ui/LineChartIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import FilePlusIcon from "@/components/icons/ui/FilePlusIcon";
import FileBadge2Icon from "@/components/icons/ui/FileBadge2Icon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import ClipboardCheckIcon from "@/components/icons/ui/ClipboardCheckIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import KpiCard from "@/components/ui/KpiCard";

interface Stats {
  openPOs: number;
  openPOValue: number;
  spendMTD: number;
  spendYTD: number;
  outstandingBills: number;
  overdueBills: number;
  pendingRequisitions: number;
  openRFQs: number;
  activeSuppliers: number;
}

export default function DashboardModule({ t, setActiveTab }: PurchaseModuleProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<{ id: string; kind: string; label: string; ts: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const monthStart = new Date();
        monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        const yearStart = new Date(new Date().getFullYear(), 0, 1);

        const [posR, billsR, paymentsR, reqsR, rfqsR, suppR] = await Promise.all([
          supabase.from("purchase_orders").select("id,po_no,supplier_id,status,total,created_at,order_date").order("created_at", { ascending: false }).limit(50),
          supabase.from("vendor_bills").select("id,bill_no,supplier_id,status,total,balance,due_date,bill_date,created_at").order("created_at", { ascending: false }).limit(50),
          supabase.from("vendor_payments").select("id,supplier_id,amount,paid_at,created_at").order("paid_at", { ascending: false, nullsFirst: false }).limit(50),
          supabase.from("purchase_requisitions").select("id,pr_no,status,total_estimated,created_at").order("created_at", { ascending: false }).limit(20),
          supabase.from("purchase_rfqs").select("id,rfq_no,status,supplier_id,total_estimated,created_at").order("created_at", { ascending: false }).limit(20),
          supabase.from("contacts").select("id,supplier_type,is_active").not("supplier_type", "is", null),
        ]);
        if (cancelled) return;

        const pos      = posR.data ?? [];
        const bills    = billsR.data ?? [];
        const payments = paymentsR.data ?? [];
        const reqs     = reqsR.data ?? [];
        const rfqs     = rfqsR.data ?? [];
        const supps    = suppR.data ?? [];

        const openPOs = pos.filter((p) => !["closed", "cancelled", "received"].includes((p.status || "").toLowerCase()));
        const openPOValue = openPOs.reduce((a, p) => a + (Number(p.total) || 0), 0);

        const spendMTD = payments
          .filter((p) => p.paid_at && new Date(p.paid_at) >= monthStart)
          .reduce((a, p) => a + (Number(p.amount) || 0), 0);
        const spendYTD = payments
          .filter((p) => p.paid_at && new Date(p.paid_at) >= yearStart)
          .reduce((a, p) => a + (Number(p.amount) || 0), 0);

        const outstandingBills = bills.reduce((a, b) => a + (Number(b.balance) || 0), 0);
        const today = new Date();
        const overdueBills = bills.filter((b) =>
          b.due_date && new Date(b.due_date) < today &&
          Number(b.balance) > 0 &&
          !["paid", "cancelled"].includes((b.status || "").toLowerCase()),
        ).length;

        const pendingRequisitions = reqs.filter((r) => ["draft", "pending"].includes((r.status || "").toLowerCase())).length;
        const openRFQs = rfqs.filter((r) => ["draft", "sent", "responded"].includes((r.status || "").toLowerCase())).length;
        const activeSuppliers = supps.filter((s) => s.is_active !== false).length;

        setStats({
          openPOs: openPOs.length,
          openPOValue,
          spendMTD,
          spendYTD,
          outstandingBills,
          overdueBills,
          pendingRequisitions,
          openRFQs,
          activeSuppliers,
        });

        const feed: { id: string; kind: string; label: string; ts: string }[] = [];
        for (const p of pos.slice(0, 3))      feed.push({ id: p.id, kind: "po",      label: `PO ${p.po_no || ""} — ${formatMoney(Number(p.total) || 0)}`, ts: p.created_at });
        for (const b of bills.slice(0, 3))    feed.push({ id: b.id, kind: "bill",    label: `Bill ${b.bill_no || ""} — ${formatMoney(Number(b.total) || 0)}`, ts: b.created_at });
        for (const r of reqs.slice(0, 3))     feed.push({ id: r.id, kind: "req",     label: `Requisition ${r.pr_no || ""} — ${formatMoney(Number(r.total_estimated) || 0)}`, ts: r.created_at });
        for (const r of rfqs.slice(0, 2))     feed.push({ id: r.id, kind: "rfq",     label: `RFQ ${r.rfq_no || ""}`, ts: r.created_at });
        for (const p of payments.slice(0, 2)) feed.push({ id: p.id, kind: "payment", label: `Payment — ${formatMoney(Number(p.amount) || 0)}`, ts: p.created_at });
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
      { id: "openPOs",         icon: BoxesIcon,         label: t("purchase.kpi.openOrders"),       value: String(stats.openPOs), sub: formatMoney(stats.openPOValue), href: "#orders" },
      { id: "spendMTD",        icon: LineChartIcon,     label: t("purchase.kpi.spendMTD"),         value: formatMoney(stats.spendMTD), sub: t("purchase.thisMonth"), href: "#payments" },
      { id: "spendYTD",        icon: LineChartIcon,     label: t("purchase.kpi.spendYTD"),         value: formatMoney(stats.spendYTD), sub: "Year to date", href: "#payments" },
      { id: "outstandingBills",icon: DocumentIcon,      label: t("purchase.kpi.outstandingBills"), value: formatMoney(stats.outstandingBills), sub: t("purchase.allTime"), href: "#bills" },
      { id: "overdue",         icon: TriangleWarningIcon, label: t("purchase.kpi.overdue"),        value: String(stats.overdueBills), sub: t("purchase.allTime"), href: "#bills" },
      { id: "pendingReqs",     icon: FilePlusIcon,      label: t("purchase.kpi.pendingReqs"),      value: String(stats.pendingRequisitions), sub: t("purchase.allTime"), href: "#requisitions" },
      { id: "openRFQs",        icon: FileBadge2Icon,    label: t("purchase.kpi.openRFQs"),         value: String(stats.openRFQs), sub: t("purchase.allTime"), href: "#rfqs" },
      { id: "activeSuppliers", icon: UsersIcon,         label: t("purchase.kpi.activeSuppliers"),  value: String(stats.activeSuppliers), sub: t("purchase.allTime"), href: "/contacts" },
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
      {/* KPI grid — canonical shared KpiCard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const isExternal = k.href.startsWith("/");
          return (
            <KpiCard
              key={k.id}
              href={isExternal ? k.href : undefined}
              label={k.label}
              value={k.value}
              hint={k.sub}
              icon={<k.icon size={14} />}
            />
          );
        })}
      </div>

      {/* Recent activity feed */}
      <div className={`${cardCls} p-4 md:p-5`}>
        <h2 className={sectionTitleCls}>
          <SparklesIcon className="h-3 w-3" />
          {t("purchase.recent")}
        </h2>
        {recent.length === 0 ? (
          <p className="text-[12px] text-[var(--text-dim)]">No purchase activity yet.</p>
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

      {/* Quick actions */}
      <div className={`${cardCls} p-4 md:p-5`}>
        <h2 className={sectionTitleCls}>
          <LayoutGridIcon className="h-3 w-3" /> Quick actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <a href="#requisitions" className="h-12 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center gap-2"><FilePlusIcon className="h-4 w-4" /> New requisition</a>
          <a href="#rfqs" className="h-12 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center gap-2"><FileBadge2Icon className="h-4 w-4" /> Send RFQ</a>
          <a href="#orders" className="h-12 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center gap-2"><BoxesIcon className="h-4 w-4" /> Create PO</a>
          <a href="#payments" className="h-12 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-focus)] flex items-center gap-2"><WalletIcon className="h-4 w-4" /> Record payment</a>
        </div>
      </div>
    </div>
  );
}
