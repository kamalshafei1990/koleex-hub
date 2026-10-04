"use client";

/* ---------------------------------------------------------------------------
   /finance/accounting/trial-balance

   Tenant-scoped trial balance — every COA account with its posted
   debit / credit totals + signed balance. The totals strip at the
   bottom validates the ledger is balanced (debit total = credit
   total). Period filter optional; defaults to all-time.
   --------------------------------------------------------------------------- */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { useWarmData } from "@/lib/warm-cache";
import { FIN_ACCOUNTING } from "@/lib/translations/finance/accounting";
import { FIN_COMMON } from "@/lib/translations/finance/common";
import { FIN_TB } from "@/lib/translations/finance/tb";
import { translateAccountName } from "@/lib/translations/finance/account-names";
import { EmptyState } from "@/components/finance/FinanceUi";
import RrIcon from "@/components/ui/RrIcon";
import { fmtAccounting as fmt, todayIso } from "@/lib/finance/format";
import type { TrialBalance } from "@/lib/accounting/types";

/* Only the namespaces this screen reads — see finance.ts. */
const DICT = { ...FIN_ACCOUNTING, ...FIN_COMMON, ...FIN_TB } as const;


const TYPE_GROUPS: Array<{ key: string; label: string; types: string[] }> = [
  { key: "tb.group.assets",      label: "Assets",      types: ["asset", "contra_asset"] },
  { key: "tb.group.liabilities", label: "Liabilities", types: ["liability", "contra_liability"] },
  { key: "tb.group.equity",      label: "Equity",      types: ["equity", "contra_equity"] },
  { key: "tb.group.revenue",     label: "Revenue",     types: ["revenue", "contra_revenue"] },
  { key: "tb.group.expenses",    label: "Expenses",    types: ["expense", "contra_expense"] },
];


function Card({ children }: { children: React.ReactNode }) {
  return <div className="kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{label}</div>
      {children}
    </label>
  );
}

export default function FinanceTrialBalance() {
  const { t, lang } = useTranslation(DICT);
  const today = useMemo(() => todayIso(), []);
  const ninetyAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 365); return d.toISOString().slice(0, 10); }, []);
  const [from, setFrom] = useState<string>("");          // empty = all-time
  const [to,   setTo]   = useState<string>(today);

  /* Warm cache keyed by the period: a tab revisited paints its last answer
     at once and refreshes behind it; a fresh answer skips the request. */
  const fetchData = useCallback(async () => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to)   qs.set("to", to);
    const res = await fetch(`/api/accounting/trial-balance?${qs.toString()}`, { cache: "no-store", credentials: "include" });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? `Failed (${res.status})`);
    return j.trial_balance as TrialBalance;
  }, [from, to]);
  const { data, loading, error: loadError } = useWarmData<TrialBalance>(`fin:tb:${from}:${to}`, fetchData);
  const error = loadError ? (loadError instanceof Error ? loadError.message : String(loadError)) : null;

  const grouped = useMemo(() => {
    if (!data) return [];
    return TYPE_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      rows: data.rows.filter((r) => g.types.includes(r.type)),
    }));
  }, [data]);

  const balanced = data ? Math.abs(data.totals.difference) < 0.005 : true;

  return (
    <div className="min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="space-y-4 pt-4 pb-6">
        <FinanceHeader
          title={t("accounting.tb.title", "Trial Balance")}
          subtitle={t("accounting.tb.subtitle.long", "Every account with its posted debit / credit totals. The ledger is balanced when the totals strip nets to zero.")}
          action={
            <Link
              href="/finance/accounting/general-ledger"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-[12px] font-semibold transition hover:border-[var(--border-strong)]"
            >
              <RrIcon name="file-invoice" size={12} />
              {t("tb.openGL", "Open General Ledger")}
            </Link>
          }
        />

        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("tb.from", "From")}>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </Field>
            <Field label={t("tb.to", "To")}>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </Field>
            <button
              type="button"
              onClick={() => { setFrom(""); setTo(today); }}
              className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-semibold hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
            >{t("tb.resetAllTime", "Reset to all-time")}</button>
            <button
              type="button"
              onClick={() => setFrom(ninetyAgo)}
              className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-semibold hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all"
            >{t("tb.last365", "Last 365 days")}</button>
            <div className="ml-auto text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              {loading ? t("common.loading", "Loading…") : data ? t("tb.asOf", "As of {date}").replace("{date}", data.as_of) : ""}
            </div>
          </div>
        </Card>

        {error && (
          <Card>
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-300">{error}</div>
          </Card>
        )}

        {data && data.rows.length === 0 && (
          <Card>
            <EmptyState
              title={t("tb.empty.title", "No accounts yet")}
              hint={t("tb.empty.hint", "The chart of accounts seeds on first read. If you're seeing this, the tenant has accounts but no posted activity — start by posting a payment or an opening balance.")}
            />
          </Card>
        )}

        {data && grouped.map((g) => (
          g.rows.length > 0 && (
            <Card key={g.label}>
              <div className="mb-2 flex items-center justify-between border-b border-[var(--border-faint)] pb-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">{t(g.key, g.label)}</div>
                <div className="text-[10px] text-[var(--text-dim)]">{t("tb.accountsCount", "{n} accounts").replace("{n}", String(g.rows.length))}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[9px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                      <th className="px-2 py-1.5 text-left">{t("tb.col.code", "Code")}</th>
                      <th className="px-2 py-1.5 text-left">{t("tb.col.account", "Account")}</th>
                      <th className="px-2 py-1.5 text-right">{t("tb.col.debit", "Debit")}</th>
                      <th className="px-2 py-1.5 text-right">{t("tb.col.credit", "Credit")}</th>
                      <th className="px-2 py-1.5 text-right">{t("tb.col.balance", "Balance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.account_id} className="border-b border-[var(--border-faint)]">
                        <td className="px-2 py-1.5 font-mono text-[var(--text-highlight)]">{r.code}</td>
                        <td className="px-2 py-1.5">
                          <Link
                            href={`/finance/accounting/general-ledger?account_id=${encodeURIComponent(r.account_id)}`}
                            className="text-[var(--text-primary)] hover:underline"
                          >{translateAccountName(r.code, r.name, lang)}</Link>
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
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">{t("tb.totals", "Totals")}</div>
              <div className="flex flex-wrap items-baseline gap-6 tabular-nums">
                <span className="text-[10px] text-[var(--text-dim)]">{t("tb.col.debit", "Debit")}</span>
                <span className="font-mono text-[14px] font-bold">{fmt(data.totals.debit)}</span>
                <span className="text-[10px] text-[var(--text-dim)]">{t("tb.col.credit", "Credit")}</span>
                <span className="font-mono text-[14px] font-bold">{fmt(data.totals.credit)}</span>
                <span className="text-[10px] text-[var(--text-dim)]">{t("tb.diff", "Difference")}</span>
                <span className={`font-mono text-[14px] font-bold ${balanced ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>{fmt(data.totals.difference)}</span>
              </div>
            </div>
            {!balanced && (
              <div className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-300">
                {t("tb.outOfBalance", "Ledger is out of balance — investigate before relying on this trial balance.")}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
