"use client";

/* ---------------------------------------------------------------------------
   /finance/accounting/cash-flow
   Direct-method cash flow from POSTED journal lines.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import { Eyebrow, Hairline } from "@/components/finance/FinanceDashboardUi";

interface CashFlowLine { label: string; amount: number; detail?: string }
interface CashFlowSection { label: string; amount: number; lines: CashFlowLine[] }
interface CashFlowStatement {
  period: { from: string; to: string };
  currency: string;
  opening_cash: number;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  net_change: number;
  closing_cash: number;
  reconciled: boolean;
}

function fmt(n: number): string {
  if (Math.abs(n) < 0.005) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${abs})` : abs;
}

export default function FinanceCashFlow() {
  const { t } = useTranslation(financeT);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const ytdStart = useMemo(() => `${new Date().getUTCFullYear()}-01-01`, []);
  const [from, setFrom] = useState(ytdStart);
  const [to,   setTo]   = useState(today);
  const [data, setData] = useState<CashFlowStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/cash-flow?from=${from}&to=${to}`, { cache: "no-store", credentials: "include" });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? `Failed (${res.status})`); setData(null); return; }
      setData(j.statement as CashFlowStatement);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("accounting.cf.title", "Cash Flow Statement")}
          subtitle={t("accounting.cf.subtitle.long", "Direct-method statement built from posted journal lines that touch cash accounts.")}
        />

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block"><div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">From</div>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" /></label>
            <label className="block"><div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">To</div>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" /></label>
            <div className="ml-auto text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              {loading ? "Loading…" : data ? `${data.currency} · ${data.period.from} → ${data.period.to}` : ""}
            </div>
          </div>
        </div>

        {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</div>}

        {data && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <table className="min-w-full text-[12.5px]">
              <tbody>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Opening cash</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono font-medium">{fmt(data.opening_cash)}</td>
                </tr>
                {[data.operating, data.investing, data.financing].map((sec) => (
                  <Section key={sec.label} section={sec} />
                ))}
                <tr className="border-t border-[var(--border-color)]">
                  <td className="px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">Net change in cash</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono">{fmt(data.net_change)}</td>
                </tr>
                <tr className="border-t-2 border-white/20">
                  <td className="px-4 py-2 text-[14px] font-bold">Closing cash</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono text-[14px] font-bold">{fmt(data.closing_cash)}</td>
                </tr>
              </tbody>
            </table>
            {!data.reconciled && (
              <div className="rounded-b-xl border-t border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[11px] text-rose-300">
                Cash flow does not reconcile to the trial balance. Investigate posted lines that touch a cash account but aren&apos;t classified.
              </div>
            )}
          </div>
        )}

        <Hairline />
        <div>
          <Eyebrow>Method</Eyebrow>
          <p className="mt-2 max-w-prose text-[11.5px] leading-relaxed text-[var(--text-dim)]">
            Each posted journal line that touches account 1000 or 1010 is classified by source type: payments and expenses are operating; opening-balance entries and lines whose contra side is equity or loans payable are financing; everything else flows to operating. Investing activity stays at zero until fixed-asset accounts are added in a later phase.{" "}
            {/* deliberately ascii apostrophes elsewhere; this single em-clarification kept short */}
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ section }: { section: CashFlowSection }) {
  return (
    <>
      <tr className="bg-[var(--bg-secondary)]">
        <td className="px-4 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">{section.label}</td>
        <td className="px-4 py-1.5 text-right tabular-nums font-mono font-medium text-[var(--text-highlight)]">{fmt(section.amount)}</td>
      </tr>
      {section.lines.map((line) => (
        <tr key={line.label} className="border-b border-[var(--border-faint)]">
          <td className="px-4 py-1.5 pl-6 text-[var(--text-highlight)]">{line.label}</td>
          <td className="px-4 py-1.5 text-right tabular-nums font-mono text-[var(--text-secondary)]">{fmt(line.amount)}</td>
        </tr>
      ))}
      {section.lines.length === 0 && (
        <tr className="border-b border-[var(--border-faint)]">
          <td className="px-4 py-1.5 pl-6 text-[11px] text-[var(--text-ghost)]" colSpan={2}>No activity in this section.</td>
        </tr>
      )}
    </>
  );
}
