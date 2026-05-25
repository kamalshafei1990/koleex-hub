"use client";

/* Supplier Contracts — blanket / framework agreements that govern
   pricing & terms across many POs. SAP calls these "Outline
   Agreements", Odoo "Purchase Agreements". Surfaces expiry dates
   so buyers can renegotiate before lapse. */

import { useEffect, useMemo, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatMoney, formatDate, sectionTitleCls } from "../shared";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Contract = {
  id: string; contract_no: string | null; title: string;
  supplier_id: string;
  start_date: string | null; end_date: string | null;
  total_value: number | null; currency: string | null;
  status: string | null;
};

const STATUS_TONE: Record<string, string> = {
  draft:      "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]",
  active:     "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  expired:    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  terminated: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export default function ContractsModule({ t }: PurchaseModuleProps) {
  const [rows, setRows] = useState<Contract[]>([]);
  const [supplierName, setSupplierName] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [r, c] = await Promise.all([
        supabase
          .from("supplier_contracts")
          .select("id,contract_no,title,supplier_id,start_date,end_date,total_value,currency,status")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("contacts").select("id,display_name,company_name,full_name").not("supplier_type", "is", null),
      ]);
      if (cancelled) return;
      setRows((r.data ?? []) as Contract[]);
      const m = new Map<string, string>();
      for (const x of (c.data ?? []) as { id: string; display_name: string | null; company_name: string | null; full_name: string | null }[]) {
        m.set(x.id, x.company_name || x.display_name || x.full_name || "—");
      }
      setSupplierName(m);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /* React-Compiler: anchor "now" once via useState so useMemo stays pure. */
  const [nowMs] = useState(() => Date.now());
  const expiringSoon = useMemo(() => {
    const in60 = nowMs + 60 * 86400000;
    return rows.filter((r) => {
      if (!r.end_date) return false;
      const t = new Date(r.end_date).getTime();
      return t > nowMs && t <= in60 && (r.status || "").toLowerCase() === "active";
    }).length;
  }, [rows, nowMs]);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h2 className={sectionTitleCls}><BookOpenIcon className="h-3 w-3" />{t("purchase.tabContracts")}</h2>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Total contracts</div>
          <div className="text-[20px] font-bold text-[var(--text-primary)] leading-tight">{rows.length}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Active</div>
          <div className="text-[20px] font-bold text-emerald-700 dark:text-emerald-300 leading-tight">{rows.filter((r) => (r.status || "").toLowerCase() === "active").length}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Expiring &lt; 60 days</div>
          <div className="text-[20px] font-bold text-amber-700 dark:text-amber-300 leading-tight">{expiringSoon}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("purchase.empty.noContracts")}</p>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((r) => {
            const status = (r.status || "draft").toLowerCase();
            const tone = STATUS_TONE[status] || STATUS_TONE.draft;
            return (
              <div key={r.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_180px_auto] gap-3 md:gap-4 items-center px-4 py-3">
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{r.contract_no || r.id.slice(0, 8)}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{r.title}</p>
                  <p className="text-[11px] text-[var(--text-dim)] truncate">{supplierName.get(r.supplier_id) || "—"}</p>
                </div>
                <span className="hidden md:inline text-[11px] tabular-nums text-[var(--text-dim)]">
                  {r.start_date ? formatDate(r.start_date) : "—"} – {r.end_date ? formatDate(r.end_date) : "—"}
                </span>
                <div className="flex items-center gap-2 justify-end">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${tone}`}>{status}</span>
                  <span className="text-[13px] tabular-nums font-semibold text-[var(--text-primary)] min-w-[80px] text-right">{formatMoney(Number(r.total_value) || 0, r.currency || "USD")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
