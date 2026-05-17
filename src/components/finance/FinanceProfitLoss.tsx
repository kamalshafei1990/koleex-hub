"use client";

/* ---------------------------------------------------------------------------
   /finance/accounting/profit-loss

   Profit & Loss statement built from POSTED journal lines only.
   Period filter + optional comparison to the immediately prior
   period. Grouped sections (Revenue · Cost of sales · Operating
   expenses) with subtotals + margin %.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { Eyebrow, Hairline } from "@/components/finance/FinanceDashboardUi";

interface PLAccountLine { account_id: string; code: string; name: string; amount: number }
interface PLSection { label: string; amount: number; accounts: PLAccountLine[] }
interface ProfitLoss {
  period: { from: string; to: string };
  currency: string;
  revenue: PLSection;
  cost_of_sales: PLSection;
  gross_profit: number;
  gross_margin_pct: number;
  operating_expenses: PLSection;
  operating_profit: number;
  operating_margin_pct: number;
  net_profit: number;
  net_margin_pct: number;
  comparison?: ProfitLoss;
}

function fmt(n: number): string {
  if (Math.abs(n) < 0.005) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${abs})` : abs;
}
function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export default function FinanceProfitLoss() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const ytdStart = useMemo(() => `${new Date().getUTCFullYear()}-01-01`, []);
  const [from, setFrom] = useState(ytdStart);
  const [to,   setTo]   = useState(today);
  const [compare, setCompare] = useState(true);
  const [data, setData] = useState<ProfitLoss | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from, to });
      if (compare) qs.set("compare_prior", "1");
      const res = await fetch(`/api/accounting/profit-loss?${qs.toString()}`, { cache: "no-store", credentials: "include" });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? `Failed (${res.status})`); setData(null); return; }
      setData(j.statement as ProfitLoss);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [from, to, compare]);
  useEffect(() => { void load(); }, [load]);

  /* Variance helper for the comparison column. */
  const variance = (cur: number, prev: number): { amount: number; pct: number } => ({
    amount: cur - prev,
    pct: prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : 0,
  });

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Profit & Loss"
          subtitle="Revenue, costs, and net profit — calculated from posted journal lines only."
        />

        {/* Period filter */}
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.012] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="From">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </Field>
            <Field label="To">
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </Field>
            <label className="flex items-center gap-2 text-[12px] text-gray-300">
              <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="rounded border-white/[0.10]" />
              Compare to prior period
            </label>
            <div className="ml-auto text-[10px] uppercase tracking-[0.18em] text-gray-500">
              {loading ? "Loading…" : data ? `${data.currency} · ${data.period.from} → ${data.period.to}` : ""}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</div>
        )}

        {data && (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.012]">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-[0.12em] text-gray-500">
                  <th className="px-4 py-2 text-left">Section</th>
                  <th className="px-4 py-2 text-right">Current</th>
                  {data.comparison && (
                    <>
                      <th className="px-4 py-2 text-right">Prior</th>
                      <th className="px-4 py-2 text-right">Δ</th>
                      <th className="px-4 py-2 text-right">Δ %</th>
                    </>
                  )}
                  <th className="px-4 py-2 text-right">% of revenue</th>
                </tr>
              </thead>
              <tbody>
                <SectionRows section={data.revenue} compareSection={data.comparison?.revenue} revenue={data.revenue.amount} />
                {data.cost_of_sales.accounts.length > 0 && (
                  <SectionRows section={data.cost_of_sales} compareSection={data.comparison?.cost_of_sales} revenue={data.revenue.amount} />
                )}
                <SummaryRow label="Gross profit" current={data.gross_profit} prior={data.comparison?.gross_profit} revenue={data.revenue.amount} pctOf={data.gross_margin_pct} priorPct={data.comparison?.gross_margin_pct} variance={data.comparison ? variance(data.gross_profit, data.comparison.gross_profit) : undefined} />
                <SectionRows section={data.operating_expenses} compareSection={data.comparison?.operating_expenses} revenue={data.revenue.amount} />
                <SummaryRow label="Operating profit" current={data.operating_profit} prior={data.comparison?.operating_profit} revenue={data.revenue.amount} pctOf={data.operating_margin_pct} priorPct={data.comparison?.operating_margin_pct} variance={data.comparison ? variance(data.operating_profit, data.comparison.operating_profit) : undefined} />
                <SummaryRow label="Net profit" current={data.net_profit} prior={data.comparison?.net_profit} revenue={data.revenue.amount} pctOf={data.net_margin_pct} priorPct={data.comparison?.net_margin_pct} grand variance={data.comparison ? variance(data.net_profit, data.comparison.net_profit) : undefined} />
              </tbody>
            </table>
          </div>
        )}

        <Hairline />
        <div>
          <Eyebrow>Method</Eyebrow>
          <p className="mt-2 max-w-prose text-[11.5px] leading-relaxed text-gray-500">
            Revenue is the net credit on accounts 4000-4999. Cost of sales captures direct costs (freight, customs). Operating expenses cover everything else in the 5xxx range. Net profit currently equals operating profit; tax + financial-charges entries flow through operating expenses until the dedicated tax engine ships.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">{label}</div>
      {children}
    </label>
  );
}

function SectionRows({
  section, compareSection, revenue,
}: {
  section: { label: string; amount: number; accounts: { code: string; name: string; amount: number }[] };
  compareSection?: { label: string; amount: number; accounts: { code: string; name: string; amount: number }[] };
  revenue: number;
}) {
  /* Pre-compute the comparison map for fast lookup per account row. */
  const compareByCode = new Map<string, number>((compareSection?.accounts ?? []).map((a) => [a.code, a.amount]));
  return (
    <>
      <tr className="bg-white/[0.02]">
        <td className="px-4 py-1.5 text-[10px] uppercase tracking-[0.12em] text-gray-400" colSpan={2 + (compareSection ? 3 : 0) + 1}>{section.label}</td>
      </tr>
      {section.accounts.map((a) => {
        const prior = compareByCode.get(a.code) ?? 0;
        const vAmt = a.amount - prior;
        const vPct = prior !== 0 ? (vAmt / Math.abs(prior)) * 100 : 0;
        return (
          <tr key={a.code} className="border-b border-white/[0.03]">
            <td className="px-4 py-1.5">
              <span className="font-mono text-gray-500">{a.code} </span>
              <span className="text-gray-300">{a.name}</span>
            </td>
            <td className="px-4 py-1.5 text-right tabular-nums font-mono">{fmt(a.amount)}</td>
            {compareSection && (
              <>
                <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-500">{fmt(prior)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-500">{fmt(vAmt)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-500">{pct(vPct)}</td>
              </>
            )}
            <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-500">{revenue > 0 ? pct((a.amount / revenue) * 100) : "—"}</td>
          </tr>
        );
      })}
      <tr className="border-b border-white/[0.08]">
        <td className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Total {section.label.toLowerCase()}</td>
        <td className="px-4 py-1.5 text-right tabular-nums font-mono font-medium">{fmt(section.amount)}</td>
        {compareSection && (
          <>
            <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-500">{fmt(compareSection.amount)}</td>
            <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-500">{fmt(section.amount - compareSection.amount)}</td>
            <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-500">{compareSection.amount !== 0 ? pct(((section.amount - compareSection.amount) / Math.abs(compareSection.amount)) * 100) : "—"}</td>
          </>
        )}
        <td className="px-4 py-1.5 text-right tabular-nums font-mono text-gray-500">{revenue > 0 ? pct((section.amount / revenue) * 100) : "—"}</td>
      </tr>
    </>
  );
}

function SummaryRow({
  label, current, prior, revenue, pctOf, priorPct, variance, grand,
}: {
  label: string;
  current: number;
  prior?: number;
  revenue: number;
  pctOf: number;
  priorPct?: number;
  variance?: { amount: number; pct: number };
  grand?: boolean;
}) {
  void priorPct; void revenue;
  return (
    <tr className={`${grand ? "border-t-2 border-white/20" : "border-t border-white/[0.08]"}`}>
      <td className={`px-4 py-2 ${grand ? "text-[14px] font-bold" : "text-[12.5px] font-medium"}`}>{label}</td>
      <td className={`px-4 py-2 text-right tabular-nums font-mono ${grand ? "text-[14px] font-bold" : "font-medium"}`}>{fmt(current)}</td>
      {prior !== undefined && variance && (
        <>
          <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-400">{fmt(prior)}</td>
          <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-400">{fmt(variance.amount)}</td>
          <td className="px-4 py-2 text-right tabular-nums font-mono text-gray-400">{pct(variance.pct)}</td>
        </>
      )}
      <td className={`px-4 py-2 text-right tabular-nums font-mono ${grand ? "text-[14px] font-bold" : ""}`}>{pct(pctOf)}</td>
    </tr>
  );
}
