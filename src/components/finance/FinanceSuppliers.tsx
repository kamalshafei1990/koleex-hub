"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceTabs from "@/components/finance/FinanceTabs";
import {
  EmptyState,
  KpiCard,
  PageHeader,
  ProgressBar,
  SectionCard,
} from "@/components/finance/FinanceUi";
import { fmtMoney } from "@/lib/finance/calc";
import type { FinanceSupplierAccount } from "@/lib/finance/types";

export default function FinanceSuppliers() {
  const [rows, setRows] = useState<FinanceSupplierAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/finance/suppliers", { cache: "no-store" });
      const j = (await r.json()) as { suppliers?: FinanceSupplierAccount[] };
      setRows(j.suppliers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const kpi = useMemo(() => {
    const purchases = rows.reduce((s, r) => s + (r.total_purchases ?? 0), 0);
    const paid = rows.reduce((s, r) => s + (r.paid_amount ?? 0), 0);
    const payable = rows.reduce((s, r) => s + (r.outstanding_payable ?? 0), 0);
    return { purchases, paid, payable };
  }, [rows]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <PageHeader
          title="Supplier Accounts"
          subtitle="What you've bought from each supplier, what's paid, and what's still owed."
        />
        <div className="mt-5"><FinanceTabs /></div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard label="Total Purchases" value={kpi.purchases} currency="USD" accent="default" loading={loading} />
          <KpiCard label="Paid" value={kpi.paid} currency="USD" accent="emerald" loading={loading} />
          <KpiCard label="Outstanding" value={kpi.payable} currency="USD" accent="amber" loading={loading} />
        </div>

        <div className="mt-6">
          {loading ? (
            <SectionCard><div className="py-8 text-center text-sm text-gray-500">Loading suppliers…</div></SectionCard>
          ) : rows.length === 0 ? (
            <EmptyState title="No suppliers yet" hint="Suppliers appear here as soon as you add supplier costs to an order or link a supplier to an expense." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((r) => (
                <div key={r.supplier_id} className="rounded-2xl border border-white/[0.06] bg-[var(--bg-secondary)] p-5 transition hover:border-white/[0.10]">
                  <div>
                    <div className="text-base font-semibold">{r.supplier_name || "—"}</div>
                    <div className="mt-1 text-[11px] text-gray-500">{r.payment_terms ?? "No payment terms set"}</div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Mini label="Purchases" value={fmtMoney(r.total_purchases ?? 0, r.default_currency, { compact: true })} accent="default" />
                    <Mini label="Paid" value={fmtMoney(r.paid_amount ?? 0, r.default_currency, { compact: true })} accent="emerald" />
                    <Mini label="To pay" value={fmtMoney(r.outstanding_payable ?? 0, r.default_currency, { compact: true })} accent="amber" />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>Payment progress</span>
                      <span>{r.total_purchases ? (((r.paid_amount ?? 0) / r.total_purchases) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="mt-1"><ProgressBar value={r.paid_amount ?? 0} max={r.total_purchases ?? 0} color="emerald" /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent: "emerald" | "amber" | "default" }) {
  const color = accent === "emerald" ? "text-emerald-400" : accent === "amber" ? "text-amber-400" : "text-[var(--text-primary)]";
  return (
    <div className="rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] p-2">
      <div className="text-[9px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
