"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { EmptyState, ProgressBar, SectionCard } from "@/components/finance/FinanceUi";
import { HeroKpiCard, MetricCard } from "@/components/finance/FinanceUiX";
import { fmtMoney } from "@/lib/finance/calc";
import RrIcon from "@/components/ui/RrIcon";
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

  /* Phase R.1 — generate an external account statement for one
     supplier. Same flow as the customer statement: print export →
     opens auto-print page in a new tab. */
  const [generating, setGenerating] = useState<string | null>(null);
  const generateStatement = useCallback(async (supplierId: string) => {
    setGenerating(supplierId);
    try {
      const res = await fetch("/api/reports/export/print", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "supplier_statement", filters: { supplier_id: supplierId } }),
      });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? `Failed (${res.status})`); return; }
      window.open(`/finance/reports/${encodeURIComponent(j.export_id)}/print?auto=1`, "_blank");
    } finally {
      setGenerating(null);
    }
  }, []);

  const kpi = useMemo(() => {
    const purchases = rows.reduce((s, r) => s + (r.total_purchases ?? 0), 0);
    const paid = rows.reduce((s, r) => s + (r.paid_amount ?? 0), 0);
    const payable = rows.reduce((s, r) => s + (r.outstanding_payable ?? 0), 0);
    return { purchases, paid, payable };
  }, [rows]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Supplier Accounts"
          subtitle="What you've bought from each supplier, what's paid, and what's still owed."
        />

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <HeroKpiCard label="Total Purchases" value={kpi.purchases} unit="USD" tone="neutral" hint="Across every supplier" loading={loading} />
          <HeroKpiCard label="Outstanding" value={kpi.payable} unit="USD" tone="warning" hint="Still to pay suppliers" loading={loading} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <MetricCard label="Paid" value={kpi.paid} unit="USD" hint="Cash already wired to suppliers" loading={loading} />
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
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => void generateStatement(r.supplier_id)}
                      disabled={generating === r.supplier_id}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.10] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] font-semibold transition hover:border-white/[0.20] disabled:opacity-50"
                    >
                      <RrIcon name="file-invoice" size={12} />
                      {generating === r.supplier_id ? "Preparing…" : "Generate Supplier Statement"}
                    </button>
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
