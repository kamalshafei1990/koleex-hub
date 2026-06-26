"use client";

/* Suppliers — vendor directory ranked by total spend so AP / buyers
   can see who the strategic relationships are. Pulls from the
   shared `contacts` table where `supplier_type` is set, joined with
   `vendor_payments` for the spend rollup. */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatMoney, sectionTitleCls, linkBtnCls } from "../shared";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Supplier = {
  id: string;
  display_name: string | null; full_name: string | null; company_name: string | null; company_name_en: string | null;
  country: string | null; supplier_type: string | null;
  preferred_payment_method: string | null;
  rating: number | null;
  is_active: boolean | null;
  certifications: unknown;
};

export default function SuppliersModule({ t }: PurchaseModuleProps) {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [spendBySupplier, setSpend] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/purchase/list?resource=suppliers", { credentials: "include" });
      const data = (res.ok ? await res.json() : { rows: [], payments: [] }) as {
        rows: Supplier[];
        payments: { supplier_id: string | null; amount: number | null }[];
      };
      if (cancelled) return;

      setRows(data.rows);
      const m: Record<string, number> = {};
      for (const row of data.payments) {
        if (!row.supplier_id) continue;
        m[row.supplier_id] = (m[row.supplier_id] || 0) + (Number(row.amount) || 0);
      }
      setSpend(m);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  const sorted = [...rows].sort((a, b) => {
    const sa = spendBySupplier[a.id] || 0;
    const sb = spendBySupplier[b.id] || 0;
    if (sb !== sa) return sb - sa;
    return (a.company_name || a.company_name_en || a.full_name || a.display_name || "").localeCompare(b.company_name || b.company_name_en || b.full_name || b.display_name || "");
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><UsersIcon className="h-3 w-3" />Top suppliers by spend</h2>
        <Link href="/contacts" className={linkBtnCls}>{t("purchase.openInApp")}<AngleRightIcon className="h-3 w-3" /></Link>
      </div>

      {sorted.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)] mb-3">{t("purchase.empty.noSuppliers")}</p>
          <Link href="/contacts" className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90">Add supplier</Link>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {sorted.map((s, i) => {
            const spend = spendBySupplier[s.id] || 0;
            const display = s.company_name || s.company_name_en || s.full_name || s.display_name || "—";
            const subtitle = [s.country, s.supplier_type, s.preferred_payment_method].filter(Boolean).join(" · ") || "—";
            const rating = Number(s.rating) || 0;
            const certCount = Array.isArray(s.certifications) ? s.certifications.length : 0;
            const inactive = s.is_active === false;
            return (
              <Link
                key={s.id}
                href={`/suppliers/${s.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="h-7 w-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px] font-bold tabular-nums text-[var(--text-muted)] shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{display}</p>
                      {rating > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 shrink-0">
                          ★ {rating}
                        </span>
                      )}
                      {inactive && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-300 shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-dim)] truncate">
                      {subtitle}
                      {certCount > 0 ? ` · ${certCount} cert${certCount > 1 ? "s" : ""}` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-[13px] tabular-nums font-semibold text-[var(--text-primary)] shrink-0">
                  {spend > 0 ? formatMoney(spend) : <span className="text-[var(--text-dim)]">—</span>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
