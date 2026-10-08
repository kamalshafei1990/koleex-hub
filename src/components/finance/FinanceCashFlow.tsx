"use client";

/* ---------------------------------------------------------------------------
   /finance/accounting/cash-flow
   Direct-method cash flow from POSTED journal lines.
   --------------------------------------------------------------------------- */

import { useCallback, useMemo, useState } from "react";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { useWarmData } from "@/lib/warm-cache";
import { FIN_ACCOUNTING } from "@/lib/translations/finance/accounting";
import { FIN_CF } from "@/lib/translations/finance/cf";
import { FIN_COMMON } from "@/lib/translations/finance/common";
import { Eyebrow, Hairline } from "@/components/finance/FinanceDashboardUi";
import { fmtAccounting as fmt, todayIso } from "@/lib/finance/format";

/* Only the namespaces this screen actually reads — see finance.ts. */
const DICT = { ...FIN_ACCOUNTING, ...FIN_CF, ...FIN_COMMON } as const;


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


export default function FinanceCashFlow() {
  const { t } = useTranslation(DICT);
  const sectionKeyFor = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes("operat")) return "cf.section.operating";
    if (l.includes("invest")) return "cf.section.investing";
    if (l.includes("financ")) return "cf.section.financing";
    return "";
  };
  const today = useMemo(() => todayIso(), []);
  const ytdStart = useMemo(() => `${new Date().getUTCFullYear()}-01-01`, []);
  const [from, setFrom] = useState(ytdStart);
  const [to,   setTo]   = useState(today);

  /* Warm cache keyed by the period: a tab revisited paints its last answer
     at once and refreshes behind it; a fresh answer skips the request. */
  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/accounting/cash-flow?from=${from}&to=${to}`, { cache: "no-store", credentials: "include" });
    const j = await res.json();
    /* No «Bank & Profit» (src/lib/experience): a line, not a failure. */
    if (res.status === 403 && j.code === "needs_bank_profit") throw Object.assign(new Error(String(j.error ?? "")), { name: "needs_bank_profit" });
    if (!res.ok) throw new Error(j.error ?? `Failed (${res.status})`);
    return j.statement as CashFlowStatement;
  }, [from, to]);
  const { data, loading, error: loadError } = useWarmData<CashFlowStatement>(`fin:cf:${from}:${to}`, fetchData);
  const locked = loadError instanceof Error && loadError.name === "needs_bank_profit";
  const error = loadError && !locked ? (loadError instanceof Error ? loadError.message : String(loadError)) : null;

  return (
    <div className="min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="space-y-4 pt-4 pb-6">
        <FinanceHeader
          title={t("accounting.cf.title", "Cash Flow Statement")}
          subtitle={t("accounting.cf.subtitle.long", "Direct-method statement built from posted journal lines that touch cash accounts.")}
        />

        <div className="kx-glass rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block"><div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("cf.from", "From")}</div>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" /></label>
            <label className="block"><div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("cf.to", "To")}</div>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" /></label>
            <div className="ml-auto text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              {loading ? t("common.loading", "Loading…") : data ? `${data.currency} · ${data.period.from} → ${data.period.to}` : ""}
            </div>
          </div>
        </div>

        {locked && <div className="kx-glass rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-6 text-[13px] text-[var(--text-dim)]">{t("cf.locked", "The cash flow opens with «Bank & Profit» in Roles & Permissions.")}</div>}
        {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-300">{error}</div>}

        {data && (
          <div className="kx-glass rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <table className="min-w-full text-[12.5px]">
              <tbody>
                <tr className="border-b border-[var(--border-subtle)]">
                  <td className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{t("cf.opening", "Opening cash")}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono font-medium">{fmt(data.opening_cash)}</td>
                </tr>
                {[data.operating, data.investing, data.financing].map((sec) => (
                  <Section key={sec.label} section={sec} sectionKey={sectionKeyFor(sec.label)} t={t} />
                ))}
                <tr className="border-t border-[var(--border-color)]">
                  <td className="px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">{t("cf.net", "Net change in cash")}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono">{fmt(data.net_change)}</td>
                </tr>
                <tr className="border-t-2 border-white/20">
                  <td className="px-4 py-2 text-[14px] font-bold">{t("cf.closing", "Closing cash")}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono text-[14px] font-bold">{fmt(data.closing_cash)}</td>
                </tr>
              </tbody>
            </table>
            {!data.reconciled && (
              <div className="rounded-b-xl border-t border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[11px] text-rose-600 dark:text-rose-300">
                {t("cf.notReconciled", "Cash flow does not reconcile to the trial balance. Investigate posted lines that touch a cash account but aren't classified.")}
              </div>
            )}
          </div>
        )}

        <Hairline />
        <div>
          <Eyebrow>{t("cf.method", "Method")}</Eyebrow>
          <p className="mt-2 max-w-prose text-[11.5px] leading-relaxed text-[var(--text-dim)]">
            {t("cf.method.body", "Each posted journal line that touches account 1000 or 1010 is classified by source type: payments and expenses are operating; opening-balance entries and lines whose contra side is equity or loans payable are financing; everything else flows to operating. Investing activity stays at zero until fixed-asset accounts are added in a later phase.")}
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ section, sectionKey, t }: { section: CashFlowSection; sectionKey: string; t: (key: string, fallback?: string) => string }) {
  return (
    <>
      <tr className="bg-[var(--bg-secondary)]">
        <td className="px-4 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">{sectionKey ? t(sectionKey, section.label) : section.label}</td>
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
          <td className="px-4 py-1.5 pl-6 text-[11px] text-[var(--text-ghost)]" colSpan={2}>{t("cf.section.empty", "No activity in this section.")}</td>
        </tr>
      )}
    </>
  );
}
