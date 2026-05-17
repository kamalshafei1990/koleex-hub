"use client";

/* ---------------------------------------------------------------------------
   /finance/accounting/trial-balance

   Tenant-scoped trial balance — every COA account with its posted
   debit / credit totals + signed balance. The totals strip at the
   bottom validates the ledger is balanced (debit total = credit
   total). Period filter optional; defaults to all-time.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { EmptyState } from "@/components/finance/FinanceUi";
import RrIcon from "@/components/ui/RrIcon";
import type { TrialBalance } from "@/lib/accounting/types";

const TYPE_GROUPS: Array<{ label: string; types: string[] }> = [
  { label: "Assets",      types: ["asset", "contra_asset"] },
  { label: "Liabilities", types: ["liability", "contra_liability"] },
  { label: "Equity",      types: ["equity", "contra_equity"] },
  { label: "Revenue",     types: ["revenue", "contra_revenue"] },
  { label: "Expenses",    types: ["expense", "contra_expense"] },
];

function fmt(n: number): string {
  if (Math.abs(n) < 0.005) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${abs})` : abs;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/[0.06] bg-[var(--bg-secondary)] p-5">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">{label}</div>
      {children}
    </label>
  );
}

export default function FinanceTrialBalance() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const ninetyAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 365); return d.toISOString().slice(0, 10); }, []);
  const [from, setFrom] = useState<string>("");          // empty = all-time
  const [to,   setTo]   = useState<string>(today);
  const [data, setData] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to)   qs.set("to", to);
      const res = await fetch(`/api/accounting/trial-balance?${qs.toString()}`, { cache: "no-store", credentials: "include" });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? `Failed (${res.status})`); setData(null); return; }
      setData(j.trial_balance as TrialBalance);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    if (!data) return [];
    return TYPE_GROUPS.map((g) => ({
      label: g.label,
      rows: data.rows.filter((r) => g.types.includes(r.type)),
    }));
  }, [data]);

  const balanced = data ? Math.abs(data.totals.difference) < 0.005 : true;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Trial Balance"
          subtitle="Every account with its posted debit / credit totals. The ledger is balanced when the totals strip nets to zero."
          action={
            <Link
              href="/finance/accounting/general-ledger"
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.10] bg-[var(--bg-primary)] px-3 py-1.5 text-[12px] font-semibold transition hover:border-white/[0.20]"
            >
              <RrIcon name="file-invoice" size={12} />
              Open General Ledger
            </Link>
          }
        />

        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="From">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </Field>
            <Field label="To">
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </Field>
            <button
              type="button"
              onClick={() => { setFrom(""); setTo(today); }}
              className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] hover:border-white/[0.20]"
            >Reset to all-time</button>
            <button
              type="button"
              onClick={() => setFrom(ninetyAgo)}
              className="rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] hover:border-white/[0.20]"
            >Last 365 days</button>
            <div className="ml-auto text-[10px] uppercase tracking-[0.18em] text-gray-500">
              {loading ? "Loading…" : data ? `As of ${data.as_of}` : ""}
            </div>
          </div>
        </Card>

        {error && (
          <Card>
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</div>
          </Card>
        )}

        {data && data.rows.length === 0 && (
          <Card>
            <EmptyState
              title="No accounts yet"
              hint="The chart of accounts seeds on first read. If you're seeing this, the tenant has accounts but no posted activity — start by posting a payment or an opening balance."
            />
          </Card>
        )}

        {data && grouped.map((g) => (
          g.rows.length > 0 && (
            <Card key={g.label}>
              <div className="mb-2 flex items-center justify-between border-b border-white/[0.04] pb-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">{g.label}</div>
                <div className="text-[10px] text-gray-500">{g.rows.length} accounts</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.10em] text-gray-500">
                      <th className="px-2 py-1.5 text-left">Code</th>
                      <th className="px-2 py-1.5 text-left">Account</th>
                      <th className="px-2 py-1.5 text-right">Debit</th>
                      <th className="px-2 py-1.5 text-right">Credit</th>
                      <th className="px-2 py-1.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.account_id} className="border-b border-white/[0.04]">
                        <td className="px-2 py-1.5 font-mono text-gray-300">{r.code}</td>
                        <td className="px-2 py-1.5">
                          <Link
                            href={`/finance/accounting/general-ledger?account_id=${encodeURIComponent(r.account_id)}`}
                            className="text-[var(--text-primary)] hover:underline"
                          >{r.name}</Link>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-mono">{fmt(r.debit_total)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-mono">{fmt(r.credit_total)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-mono">{fmt(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        ))}

        {/* Totals strip — the proof that the ledger balances. */}
        {data && (
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-t-2 border-white/20 pt-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-gray-400">Totals</div>
              <div className="flex flex-wrap items-baseline gap-6 tabular-nums">
                <span className="text-[10px] text-gray-500">Debit</span>
                <span className="font-mono text-[14px] font-bold">{fmt(data.totals.debit)}</span>
                <span className="text-[10px] text-gray-500">Credit</span>
                <span className="font-mono text-[14px] font-bold">{fmt(data.totals.credit)}</span>
                <span className="text-[10px] text-gray-500">Difference</span>
                <span className={`font-mono text-[14px] font-bold ${balanced ? "text-emerald-300" : "text-rose-300"}`}>{fmt(data.totals.difference)}</span>
              </div>
            </div>
            {!balanced && (
              <div className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                Ledger is out of balance — investigate before relying on this trial balance.
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
