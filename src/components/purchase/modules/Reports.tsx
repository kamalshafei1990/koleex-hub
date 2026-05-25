"use client";

/* Purchase Reports — three at-a-glance views: monthly spend trend,
   spend by category, spend by supplier. Same pure-SVG style as the
   Sales reports so the two apps look consistent. */

import { useEffect, useMemo, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatMoney, sectionTitleCls } from "../shared";
import LineChartIcon from "@/components/icons/ui/LineChartIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type PaymentRow  = { amount: number | null; paid_at: string | null; created_at: string; supplier_id: string | null };
type BillItemRow = { line_total: number | null; category_id: string | null };
type CategoryRow = { id: string; name: string; kind: string };
type SupplierRow = { id: string; display_name: string | null; company_name: string | null; full_name: string | null };

export default function ReportsModule({ t }: PurchaseModuleProps) {
  const [payments, setPayments]   = useState<PaymentRow[]>([]);
  const [billItems, setBillItems] = useState<BillItemRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [suppliers, setSuppliers]   = useState<SupplierRow[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pR, biR, cR, sR] = await Promise.all([
        supabase.from("vendor_payments").select("amount,paid_at,created_at,supplier_id"),
        supabase.from("vendor_bill_items").select("line_total,category_id"),
        supabase.from("purchase_categories").select("id,name,kind"),
        supabase.from("contacts").select("id,display_name,company_name,full_name").not("supplier_type", "is", null),
      ]);
      if (cancelled) return;
      setPayments((pR.data ?? []) as PaymentRow[]);
      setBillItems((biR.data ?? []) as BillItemRow[]);
      setCategories((cR.data ?? []) as CategoryRow[]);
      setSuppliers((sR.data ?? []) as SupplierRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /* Monthly spend trend — last 6 months. */
  const monthly = useMemo(() => {
    const out: { label: string; total: number }[] = [];
    const now = new Date();
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const total = payments
        .filter((p) => {
          const at = p.paid_at || p.created_at;
          if (!at) return false;
          const tt = new Date(at).getTime();
          return tt >= d.getTime() && tt < next.getTime();
        })
        .reduce((a, p) => a + (Number(p.amount) || 0), 0);
      out.push({ label: d.toLocaleDateString("en-US", { month: "short" }), total });
    }
    return out;
  }, [payments]);

  /* Spend by category. */
  const byCategory = useMemo(() => {
    const cMap = new Map<string, CategoryRow>();
    for (const c of categories) cMap.set(c.id, c);
    const totals: Record<string, number> = {};
    for (const it of billItems) {
      if (!it.category_id) continue;
      totals[it.category_id] = (totals[it.category_id] || 0) + (Number(it.line_total) || 0);
    }
    const list = Object.entries(totals)
      .map(([id, total]) => {
        const c = cMap.get(id);
        return { id, name: c?.name || "Unknown", kind: c?.kind || "direct", total };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    return list;
  }, [billItems, categories]);

  /* Spend by supplier. */
  const bySupplier = useMemo(() => {
    const sMap = new Map<string, SupplierRow>();
    for (const s of suppliers) sMap.set(s.id, s);
    const totals: Record<string, number> = {};
    for (const p of payments) {
      if (!p.supplier_id) continue;
      totals[p.supplier_id] = (totals[p.supplier_id] || 0) + (Number(p.amount) || 0);
    }
    return Object.entries(totals)
      .map(([id, total]) => {
        const s = sMap.get(id);
        return { id, name: s?.company_name || s?.full_name || s?.display_name || "Unknown", total };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [payments, suppliers]);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  const hasAny = payments.length + billItems.length > 0;
  if (!hasAny) {
    return (
      <div className="p-6">
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("purchase.empty.notReady")}</p>
        </div>
      </div>
    );
  }

  const maxMonthly = Math.max(1, ...monthly.map((m) => m.total));
  const maxCat     = Math.max(1, ...byCategory.map((c) => c.total));
  const maxSup     = Math.max(1, ...bySupplier.map((s) => s.total));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
      {/* Spend trend */}
      <div className={`${cardCls} p-5 lg:col-span-2`}>
        <h2 className={sectionTitleCls}><LineChartIcon className="h-3 w-3" />Spend trend</h2>
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

      {/* Spend by category */}
      <div className={`${cardCls} p-5`}>
        <h2 className={sectionTitleCls}><LayoutGridIcon className="h-3 w-3" />Spend by category</h2>
        {byCategory.length === 0 ? (
          <p className="text-[12px] text-[var(--text-dim)]">No category-tagged spend yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {byCategory.map((c, i) => {
              const pct = (c.total / maxCat) * 100;
              return (
                <li key={i}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[12px] text-[var(--text-primary)] truncate">{c.name}</span>
                    <span className="text-[11px] tabular-nums text-[var(--text-dim)] shrink-0">{formatMoney(c.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--text-primary)]/70" style={{ width: `${Math.max(3, pct)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Spend by supplier */}
      <div className={`${cardCls} p-5`}>
        <h2 className={sectionTitleCls}><UsersIcon className="h-3 w-3" />Top suppliers</h2>
        {bySupplier.length === 0 ? (
          <p className="text-[12px] text-[var(--text-dim)]">No paid suppliers yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {bySupplier.map((s, i) => {
              const pct = (s.total / maxSup) * 100;
              return (
                <li key={i}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[12px] text-[var(--text-primary)] truncate">{s.name}</span>
                    <span className="text-[11px] tabular-nums text-[var(--text-dim)] shrink-0">{formatMoney(s.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${Math.max(3, pct)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
