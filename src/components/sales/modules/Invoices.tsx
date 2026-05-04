"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatMoney, formatDate, linkBtnCls, sectionTitleCls } from "../shared";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Invoice = {
  id: string; invoice_no: string | null; status: string | null;
  customer_name: string | null; total: number | null; balance: number | null;
  issued_at: string | null; due_date: string | null; created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  draft:   "bg-slate-500/15 text-slate-400 border-slate-500/20",
  sent:    "bg-blue-500/15 text-blue-400 border-blue-500/20",
  paid:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  partial: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  overdue: "bg-red-500/15 text-red-400 border-red-500/20",
  cancelled: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

export default function InvoicesModule({ t }: SalesModuleProps) {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await supabase
        .from("invoices")
        .select("id,invoice_no,status,customer_name,total,balance,issued_at,due_date,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      setRows((r.data ?? []) as Invoice[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><DocumentIcon className="h-3 w-3" />{t("sales.recent")} {t("sales.tabInvoices").toLowerCase()}</h2>
        <Link href="/invoices" className={linkBtnCls}>{t("sales.openInApp")}<AngleRightIcon className="h-3 w-3" /></Link>
      </div>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)] mb-3">{t("sales.empty.noInvoices")}</p>
          <Link href="/invoices" className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90">Create invoice</Link>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((i) => {
            const status = (i.status || "draft").toLowerCase();
            const tone = STATUS_TONE[status] || STATUS_TONE.draft;
            const overdue = i.due_date && i.status !== "paid" && Number(i.balance) > 0 && new Date(i.due_date) < new Date();
            return (
              <Link
                key={i.id}
                href={`/invoices?id=${i.id}`}
                className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_120px_auto] gap-3 md:gap-4 items-center px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors"
              >
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{i.invoice_no || i.id.slice(0, 8)}</span>
                <span className="text-[13px] text-[var(--text-muted)] truncate">{i.customer_name || "—"}</span>
                <span className="hidden md:inline text-[12px] tabular-nums text-[var(--text-dim)]">{formatDate(i.issued_at || i.created_at)}</span>
                <div className="flex items-center gap-2 justify-end">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${overdue ? STATUS_TONE.overdue : tone}`}>
                    {overdue ? "overdue" : status}
                  </span>
                  <span className="text-[13px] tabular-nums font-semibold text-[var(--text-primary)] min-w-[80px] text-right">{formatMoney(Number(i.total) || 0)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
