"use client";

/* Payments (outgoing) — money we paid the supplier. Mirrors the
   Sales `invoice_payments` feed but for AP. Tracks 30/90/all-time
   spend tiles plus a recent list with payment method tone. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatMoney, formatDate, sectionTitleCls } from "../shared";
import { NewPaymentDialog } from "../dialogs";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Payment = {
  id: string; payment_no: string | null; bill_id: string | null;
  supplier_id: string | null; amount: number | null; currency: string | null;
  method: string | null; reference: string | null;
  paid_at: string | null; created_at: string;
};

const METHOD_TONE: Record<string, string> = {
  bank_transfer: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  cash:          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  check:         "bg-violet-500/15 text-violet-400 border-violet-500/20",
  card:          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  wire:          "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
};

export default function PaymentsModule({ t }: PurchaseModuleProps) {
  const [rows, setRows] = useState<Payment[]>([]);
  const [supplierName, setSupplierName] = useState<Map<string, string>>(new Map());
  const [billNo, setBillNo] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await supabase
      .from("vendor_payments")
      .select("id,payment_no,bill_id,supplier_id,amount,currency,method,reference,paid_at,created_at")
      .order("paid_at", { ascending: false, nullsFirst: false })
      .limit(50);
    const list = (r.data ?? []) as Payment[];
    const billIds = list.map((p) => p.bill_id).filter((x): x is string => !!x);
    const supIds  = list.map((p) => p.supplier_id).filter((x): x is string => !!x);

    const [bR, cR] = await Promise.all([
      billIds.length
        ? supabase.from("vendor_bills").select("id,bill_no").in("id", billIds)
        : Promise.resolve({ data: [] as { id: string; bill_no: string | null }[] }),
      supIds.length
        ? supabase.from("contacts").select("id,display_name,company_name,full_name").in("id", supIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null; company_name: string | null; full_name: string | null }[] }),
    ]);

    setRows(list);
    const bm = new Map<string, string>();
    for (const b of (bR.data ?? [])) bm.set(b.id, b.bill_no || "");
    setBillNo(bm);
    const sm = new Map<string, string>();
    for (const c of (cR.data ?? [])) sm.set(c.id, c.company_name || c.display_name || c.full_name || "—");
    setSupplierName(sm);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* React-Compiler: anchor "now" once via useState so useMemo stays pure. */
  const [nowMs] = useState(() => Date.now());
  const totals = useMemo(() => {
    const d30 = nowMs - 30 * 86400000;
    const d90 = nowMs - 90 * 86400000;
    let t30 = 0, t90 = 0, total = 0;
    for (const p of rows) {
      const amt = Number(p.amount) || 0;
      const at = p.paid_at || p.created_at;
      const ts = at ? new Date(at).getTime() : 0;
      total += amt;
      if (ts >= d30) t30 += amt;
      if (ts >= d90) t90 += amt;
    }
    return { t30, t90, total };
  }, [rows, nowMs]);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><WalletIcon className="h-3 w-3" />{t("purchase.recent")} {t("purchase.tabPayments").toLowerCase()}</h2>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 transition-all"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Record payment
        </button>
      </div>

      <NewPaymentDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={load} />

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
          <p className="text-[14px] text-[var(--text-muted)]">{t("purchase.empty.noPayments")}</p>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((p) => {
            const method = (p.method || "").toLowerCase();
            const tone = METHOD_TONE[method] || "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]";
            const linkedBill = p.bill_id ? billNo.get(p.bill_id) : null;
            return (
              <div key={p.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_120px_120px_auto] gap-3 md:gap-4 items-center px-4 py-3">
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{linkedBill || p.payment_no || (p.reference ?? p.id.slice(0, 8))}</span>
                <span className="text-[13px] text-[var(--text-muted)] truncate">{supplierName.get(p.supplier_id || "") || p.reference || "—"}</span>
                <span className="hidden md:inline text-[11px] tabular-nums text-[var(--text-dim)]">{formatDate(p.paid_at || p.created_at)}</span>
                <span className="hidden md:flex justify-end">
                  {method ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${tone}`}>
                      {method.replace(/_/g, " ")}
                    </span>
                  ) : <span className="text-[var(--text-ghost)] text-[11px]">—</span>}
                </span>
                <span className="text-[13px] tabular-nums font-semibold text-rose-700 dark:text-rose-300 min-w-[80px] text-right">{formatMoney(Number(p.amount) || 0, p.currency || "USD")}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
