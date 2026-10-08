"use client";

/* ---------------------------------------------------------------------------
   /finance/accounting/equity
   Statement of equity from POSTED journal lines.
   --------------------------------------------------------------------------- */

import { useCallback, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { useWarmData } from "@/lib/warm-cache";
import { FIN_ACCOUNTING } from "@/lib/translations/finance/accounting";
import { FIN_COMMON } from "@/lib/translations/finance/common";
import { FIN_EQUITY } from "@/lib/translations/finance/equity";
import { Eyebrow, Hairline } from "@/components/finance/FinanceDashboardUi";
import { fmtAccounting as fmt, todayIso } from "@/lib/finance/format";

/* Only the namespaces this screen actually reads — see finance.ts. */
const DICT = { ...FIN_ACCOUNTING, ...FIN_COMMON, ...FIN_EQUITY } as const;


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


export default function FinanceEquity() {
  const { t } = useTranslation(DICT);
  const today = useMemo(() => todayIso(), []);
  const ytdStart = useMemo(() => `${new Date().getUTCFullYear()}-01-01`, []);
  const [from, setFrom] = useState(ytdStart);
  const [to,   setTo]   = useState(today);

  /* Warm cache keyed by the period: a tab revisited paints its last answer
     at once and refreshes behind it; a fresh answer skips the request. */
  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/accounting/equity?from=${from}&to=${to}`, { cache: "no-store", credentials: "include" });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? `Failed (${res.status})`);
    return j.statement as EquityStatement;
  }, [from, to]);
  const { data, loading, error: loadError } = useWarmData<EquityStatement>(`fin:eq:${from}:${to}`, fetchData);
  const error = loadError ? (loadError instanceof Error ? loadError.message : String(loadError)) : null;

  return (
    <div className="min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="space-y-4 pt-4 pb-6">
        <FinanceHeader
          title={t("accounting.eq.title", "Statement of Equity")}
          subtitle={t("accounting.eq.subtitle.long", "Opening equity, contributions, current-year earnings, closing equity.")}
        />

        <div className="kx-glass rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block"><div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("equity.from", "From")}</div>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" /></label>
            <label className="block"><div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("equity.to", "To")}</div>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" /></label>
            <div className="ml-auto text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              {loading ? t("common.loading", "Loading…") : data ? `${data.currency} · ${data.period.from} → ${data.period.to}` : ""}
            </div>
          </div>
        </div>

        {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-300">{error}</div>}

        {data && (
          <div className="kx-glass rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <table className="min-w-full text-[12.5px]">
              <tbody>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{t("equity.opening", "Opening equity")}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono font-medium">{fmt(data.opening_equity)}</td>
                </tr>
                {data.movements.length === 0 ? (
                  <tr><td className="px-4 py-2 pl-6 text-[11px] text-[var(--text-ghost)]" colSpan={2}>{t("equity.empty", "No equity movements in this period.")}</td></tr>
                ) : (
                  data.movements.map((m) => (
                    <tr key={m.label} className="border-b border-[var(--border-faint)]">
                      <td className="px-4 py-1.5 pl-6 text-[var(--text-highlight)]">{m.label}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums font-mono text-[var(--text-secondary)]">{fmt(m.amount)}</td>
                    </tr>
                  ))
                )}
                <tr className="border-t border-[var(--border-color)]">
                  <td className="px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">{t("equity.netMovement", "Net equity movement")}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono">{fmt(data.closing_equity - data.opening_equity)}</td>
                </tr>
                <tr className="border-t-2 border-white/20">
                  <td className="px-4 py-2 text-[14px] font-bold">{t("equity.closing", "Closing equity")}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono text-[14px] font-bold">{fmt(data.closing_equity)}</td>
                </tr>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("equity.retained", "Retained earnings (3100, period-end balance)")}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono text-[var(--text-secondary)]">{fmt(data.retained_earnings)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <Hairline />
        <div>
          <Eyebrow>{t("equity.method", "Method")}</Eyebrow>
          <p className="mt-2 max-w-prose text-[11.5px] leading-relaxed text-[var(--text-dim)]">
            {t("equity.method.body", "Opening equity = balance of 3xxx accounts at period start. Owner contributions = net change on Owner Capital (3000). Current-year earnings = net profit from the P&L for the same period. Closing equity = opening + contributions + earnings.")}
          </p>
        </div>
      </div>
    </div>
  );
}
