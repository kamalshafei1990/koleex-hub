"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import {
  EmptyState,
  KpiCard,
  ProgressBar,
  SectionCard,
  StatusBadge,
} from "@/components/finance/FinanceUi";
import { fmtMoney } from "@/lib/finance/calc";
import type { FinanceCustomerAccount } from "@/lib/finance/types";

export default function FinanceCustomers() {
  const [rows, setRows] = useState<FinanceCustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/finance/customers", { cache: "no-store" });
      const j = (await r.json()) as { customers?: FinanceCustomerAccount[] };
      setRows(j.customers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const kpi = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + (r.total_revenue ?? 0), 0);
    const collected = rows.reduce((s, r) => s + (r.paid_amount ?? 0), 0);
    const outstanding = rows.reduce((s, r) => s + (r.outstanding_balance ?? 0), 0);
    const overdue = rows.reduce((s, r) => s + (r.overdue_amount ?? 0), 0);
    return { revenue, collected, outstanding, overdue };
  }, [rows]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Customer Accounts"
          subtitle="Revenue, money collected, and money still owed — for every customer you sell to."
        />

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Revenue" value={kpi.revenue} currency="USD" accent="emerald" loading={loading} />
          <KpiCard label="Collected" value={kpi.collected} currency="USD" accent="emerald" loading={loading} />
          <KpiCard label="Outstanding" value={kpi.outstanding} currency="USD" accent="amber" loading={loading} />
          <KpiCard label="Overdue" value={kpi.overdue} currency="USD" accent="rose" loading={loading} />
        </div>

        <div className="mt-6">
          {loading ? (
            <SectionCard><div className="py-8 text-center text-sm text-gray-500">Loading customers…</div></SectionCard>
          ) : rows.length === 0 ? (
            <EmptyState title="No customers yet" hint="Customers appear here as soon as you create an order for them on the Orders page." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((r) => (
                <div key={r.customer_id} className="rounded-2xl border border-white/[0.06] bg-[var(--bg-secondary)] p-5 transition hover:border-white/[0.10]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">{r.customer_name || "—"}</div>
                      <div className="mt-1 text-[11px] text-gray-500">
                        {r.payment_terms ?? "No payment terms set"}
                      </div>
                    </div>
                    <StatusBadge status={r.credit_status} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Mini label="Revenue" value={fmtMoney(r.total_revenue ?? 0, r.default_currency, { compact: true })} accent="emerald" />
                    <Mini label="Collected" value={fmtMoney(r.paid_amount ?? 0, r.default_currency, { compact: true })} accent="emerald" />
                    <Mini label="Outstanding" value={fmtMoney(r.outstanding_balance ?? 0, r.default_currency, { compact: true })} accent="amber" />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>Collection progress</span>
                      <span>{r.total_revenue ? (((r.paid_amount ?? 0) / r.total_revenue) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="mt-1">
                      <ProgressBar value={r.paid_amount ?? 0} max={r.total_revenue ?? 0} color={r.overdue_amount && r.overdue_amount > 0 ? "rose" : "emerald"} />
                    </div>
                  </div>
                  {(r.overdue_amount ?? 0) > 0 && (
                    <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                      ⚠ {fmtMoney(r.overdue_amount ?? 0, r.default_currency, { compact: true })} overdue — past due date.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent: "emerald" | "rose" | "amber" }) {
  const color = accent === "emerald" ? "text-emerald-400" : accent === "rose" ? "text-rose-400" : "text-amber-400";
  return (
    <div className="rounded-lg border border-white/[0.04] bg-[var(--bg-primary)] p-2">
      <div className="text-[9px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
