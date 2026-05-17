"use client";

/* ---------------------------------------------------------------------------
   /finance/accounting/equity
   Statement of equity from POSTED journal lines.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { Eyebrow, Hairline } from "@/components/finance/FinanceDashboardUi";

interface EquityMovement { label: string; amount: number; detail?: string }
interface EquityStatement {
  period: { from: string; to: string };
  currency: string;
  opening_equity: number;
  contributions: number;
  current_year_earnings: number;
  closing_equity: number;
  movements: EquityMovement[];
  retained_earnings: number;
}

function fmt(n: number): string {
  if (Math.abs(n) < 0.005) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${abs})` : abs;
}

export default function FinanceEquity() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const ytdStart = useMemo(() => `${new Date().getUTCFullYear()}-01-01`, []);
  const [from, setFrom] = useState(ytdStart);
  const [to,   setTo]   = useState(today);
  const [data, setData] = useState<EquityStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/accounting/equity?from=${from}&to=${to}`, { cache: "no-store", credentials: "include" });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? `Failed (${res.status})`); setData(null); return; }
      setData(j.statement as EquityStatement);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Statement of Equity"
          subtitle="Opening equity, contributions, current-year earnings, closing equity."
        />

        <div className="rounded-xl border border-white/[0.05] bg-white/[0.012] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block"><div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">From</div>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" /></label>
            <label className="block"><div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">To</div>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" /></label>
            <div className="ml-auto text-[10px] uppercase tracking-[0.18em] text-gray-500">
              {loading ? "Loading…" : data ? `${data.currency} · ${data.period.from} → ${data.period.to}` : ""}
            </div>
          </div>
        </div>

        {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</div>}

        {data && (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.012]">
            <table className="min-w-full text-[12.5px]">
              <tbody>
                <tr className="border-b border-white/[0.08]">
                  <td className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Opening equity</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono font-medium">{fmt(data.opening_equity)}</td>
                </tr>
                {data.movements.length === 0 ? (
                  <tr><td className="px-4 py-2 pl-6 text-[11px] text-gray-600" colSpan={2}>No equity movements in this period.</td></tr>
                ) : (
                  data.movements.map((m) => (
                    <tr key={m.label} className="border-b border-white/[0.03]">
                      <td className="px-4 py-1.5 pl-6 text-gray-300">{m.label}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-400">{fmt(m.amount)}</td>
                    </tr>
                  ))
                )}
                <tr className="border-t border-white/[0.10]">
                  <td className="px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-gray-400">Net equity movement</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono">{fmt(data.closing_equity - data.opening_equity)}</td>
                </tr>
                <tr className="border-t-2 border-white/20">
                  <td className="px-4 py-2 text-[14px] font-bold">Closing equity</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono text-[14px] font-bold">{fmt(data.closing_equity)}</td>
                </tr>
                <tr className="border-t border-white/[0.05]">
                  <td className="px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-gray-500">Retained earnings (3100, period-end balance)</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-400">{fmt(data.retained_earnings)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <Hairline />
        <div>
          <Eyebrow>Method</Eyebrow>
          <p className="mt-2 max-w-prose text-[11.5px] leading-relaxed text-gray-500">
            Opening equity = balance of 3xxx accounts at period start. Owner contributions = net change on Owner Capital (3000). Current-year earnings = net profit from the P&L for the same period. Closing equity = opening + contributions + earnings.
          </p>
        </div>
      </div>
    </div>
  );
}
