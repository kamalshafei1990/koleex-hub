"use client";

/* Payments — incoming cash collection feed. Standard ERP module
   (Odoo "Customer Payments", SAP "FI-AR Incoming Payments"). Joins
   invoice_payments → invoices → customers so we can show payer,
   reference, method, and the invoice the payment satisfies. */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatMoney, formatDate, linkBtnCls, sectionTitleCls } from "../shared";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Payment = {
  id: string; invoice_id: string | null;
  amount: number | null; currency: string | null;
  method: string | null; reference: string | null;
  received_at: string | null; created_at: string;
};

const METHOD_TONE: Record<string, string> = {
  bank_transfer: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  cash:          "bg-amber-500/15 text-amber-400 border-amber-500/20",
  check:         "bg-violet-500/15 text-violet-400 border-violet-500/20",
  card:          "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  wire:          "bg-blue-500/15 text-blue-400 border-blue-500/20",
};

export default function PaymentsModule({ t }: SalesModuleProps) {
  const [rows, setRows] = useState<Payment[]>([]);
  const [invoiceLookup, setInvoiceLookup] = useState<Map<string, { inv_no: string | null; customer_id: string | null }>>(new Map());
  const [customerName, setCustomerName] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await supabase
        .from("invoice_payments")
        .select("id,invoice_id,amount,currency,method,reference,received_at,created_at")
        .order("received_at", { ascending: false, nullsFirst: false })
        .limit(50);
      const list = (r.data ?? []) as Payment[];
      const invIds = list.map((p) => p.invoice_id).filter((x): x is string => !!x);

      const [iR, cR] = await Promise.all([
        invIds.length
          ? supabase.from("invoices").select("id,inv_no,customer_id").in("id", invIds)
          : Promise.resolve({ data: [] as { id: string; inv_no: string | null; customer_id: string | null }[] }),
        supabase.from("customers").select("id,name,company_name"),
      ]);
      if (cancelled) return;

      setRows(list);
      const im = new Map<string, { inv_no: string | null; customer_id: string | null }>();
      for (const i of (iR.data ?? []) as { id: string; inv_no: string | null; customer_id: string | null }[]) {
        im.set(i.id, { inv_no: i.inv_no, customer_id: i.customer_id });
      }
      setInvoiceLookup(im);

      const cm = new Map<string, string>();
      for (const c of (cR.data ?? []) as { id: string; name: string | null; company_name: string | null }[]) {
        cm.set(c.id, c.company_name || c.name || "—");
      }
      setCustomerName(cm);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /* React-Compiler: anchor "now" once via useState so useMemo stays pure. */
  const [nowMs] = useState(() => Date.now());
  /* Roll up totals — last 30 days, last 90 days, all-time. */
  const totals = useMemo(() => {
    const d30 = nowMs - 30 * 86400000;
    const d90 = nowMs - 90 * 86400000;
    let t30 = 0, t90 = 0, total = 0;
    for (const p of rows) {
      const amt = Number(p.amount) || 0;
      const at = p.received_at || p.created_at;
      const ts = at ? new Date(at).getTime() : 0;
      total += amt;
      if (ts >= d30) t30 += amt;
      if (ts >= d90) t90 += amt;
    }
    return { t30, t90, total };
  }, [rows, nowMs]);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><DocumentIcon className="h-3 w-3" />{t("sales.recent")} payments</h2>
        <Link href="/invoices" className={linkBtnCls}>{t("sales.openInApp")}<AngleRightIcon className="h-3 w-3" /></Link>
      </div>

      {/* Cash-in tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Last 30 days</div>
          <div className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{formatMoney(totals.t30)}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Last 90 days</div>
          <div className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{formatMoney(totals.t90)}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">All-time</div>
          <div className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{formatMoney(totals.total)}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("sales.empty.noPayments")}</p>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((p) => {
            const inv = p.invoice_id ? invoiceLookup.get(p.invoice_id) : undefined;
            const customer = inv?.customer_id ? customerName.get(inv.customer_id) : null;
            const method = (p.method || "").toLowerCase();
            const tone = METHOD_TONE[method] || "bg-slate-500/15 text-slate-400 border-slate-500/20";
            return (
              <div key={p.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_120px_120px_auto] gap-3 md:gap-4 items-center px-4 py-3">
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{inv?.inv_no || (p.reference ?? p.id.slice(0, 8))}</span>
                <span className="text-[13px] text-[var(--text-muted)] truncate">{customer || p.reference || "—"}</span>
                <span className="hidden md:inline text-[11px] tabular-nums text-[var(--text-dim)]">{formatDate(p.received_at || p.created_at)}</span>
                <span className="hidden md:flex justify-end">
                  {method ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${tone}`}>
                      {method.replace(/_/g, " ")}
                    </span>
                  ) : <span className="text-[var(--text-ghost)] text-[11px]">—</span>}
                </span>
                <span className="text-[13px] tabular-nums font-semibold text-emerald-400 min-w-[80px] text-right">{formatMoney(Number(p.amount) || 0, p.currency || "USD")}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
