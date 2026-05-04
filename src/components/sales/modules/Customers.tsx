"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatMoney, linkBtnCls, sectionTitleCls } from "../shared";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type CustomerRow = {
  id: string; name: string; country: string | null; tier: string | null;
  is_active: boolean | null;
};

export default function CustomersModule({ t }: SalesModuleProps) {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [revenueByCustomer, setRevenueByCustomer] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, inv] = await Promise.all([
        supabase.from("customers").select("id,name,country,tier,is_active").order("name", { ascending: true }).limit(50),
        supabase.from("invoices").select("customer_id,total,status"),
      ]);
      if (cancelled) return;
      const list = (c.data ?? []) as CustomerRow[];
      setRows(list);
      // Sum invoice totals (paid + unpaid) per customer for the
      // "top customers by revenue" sort.
      const m: Record<string, number> = {};
      for (const i of (inv.data ?? []) as { customer_id: string | null; total: number | null }[]) {
        if (!i.customer_id) continue;
        m[i.customer_id] = (m[i.customer_id] || 0) + (Number(i.total) || 0);
      }
      setRevenueByCustomer(m);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  // Sort customers by revenue desc, fall back to name asc when tied/zero.
  const sorted = [...rows].sort((a, b) => {
    const ra = revenueByCustomer[a.id] || 0;
    const rb = revenueByCustomer[b.id] || 0;
    if (rb !== ra) return rb - ra;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><UsersIcon className="h-3 w-3" />{t("sales.topCustomers")}</h2>
        <Link href="/customers" className={linkBtnCls}>{t("sales.openInApp")}<AngleRightIcon className="h-3 w-3" /></Link>
      </div>

      {sorted.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)] mb-3">{t("sales.empty.noCustomers")}</p>
          <Link href="/customers" className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90">Add customer</Link>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {sorted.map((c, i) => {
            const rev = revenueByCustomer[c.id] || 0;
            return (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-7 w-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px] font-bold tabular-nums text-[var(--text-muted)] shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{c.name}</p>
                    <p className="text-[11px] text-[var(--text-dim)] truncate">
                      {[c.country, c.tier].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </div>
                <span className="text-[13px] tabular-nums font-semibold text-[var(--text-primary)] shrink-0">
                  {rev > 0 ? formatMoney(rev) : <span className="text-[var(--text-dim)]">—</span>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
