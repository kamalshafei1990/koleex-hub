"use client";

/* ---------------------------------------------------------------------------
   /finance/accounting/general-ledger

   Per-account ledger viewer. Choose an account from the COA picker,
   optionally clamp to a period, see every posted journal line with
   a running balance. Mono + tabular-nums; negative amounts render in
   parentheses (accounting convention).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { financeT, translateAccountName } from "@/lib/translations/finance";
import { EmptyState } from "@/components/finance/FinanceUi";
import RrIcon from "@/components/ui/RrIcon";
import type { AccountingAccount, GeneralLedger } from "@/lib/accounting/types";

function fmt(n: number): string {
  if (Math.abs(n) < 0.005) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${abs})` : abs;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{label}</div>
      {children}
    </label>
  );
}

export default function FinanceGeneralLedger() {
  const { t, lang } = useTranslation(financeT);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(params.get("account_id"));
  const [from, setFrom] = useState<string>(params.get("from") ?? "");
  const [to,   setTo]   = useState<string>(params.get("to") ?? today);
  const [ledger, setLedger] = useState<GeneralLedger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Load COA once. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await fetch("/api/accounting/accounts", { cache: "no-store", credentials: "include" });
      const j = await r.json().catch(() => ({ accounts: [] }));
      if (cancelled) return;
      setAccounts((j.accounts ?? []) as AccountingAccount[]);
      setAccountId((prev) => prev ?? (j.accounts?.[0]?.id ?? null));
    })();
    return () => { cancelled = true; };
  }, []);

  /* Reload the ledger whenever the picker / period change. URL stays
     in sync so the page is shareable. */
  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ account_id: accountId });
      if (from) qs.set("from", from);
      if (to)   qs.set("to", to);
      const res = await fetch(`/api/accounting/general-ledger?${qs.toString()}`, { cache: "no-store", credentials: "include" });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? `Failed (${res.status})`); setLedger(null); return; }
      setLedger(j.ledger as GeneralLedger);
      const url = new URL(window.location.href);
      url.searchParams.set("account_id", accountId);
      if (from) url.searchParams.set("from", from); else url.searchParams.delete("from");
      if (to)   url.searchParams.set("to",   to);   else url.searchParams.delete("to");
      router.replace(`${pathname}?${url.searchParams.toString()}`, { scroll: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [accountId, from, to, router, pathname]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("accounting.gl.title", "General Ledger")}
          subtitle={t("accounting.gl.subtitle.long", "Every posted journal line against a chosen account, with a running balance.")}
          action={
            <Link
              href="/finance/accounting/trial-balance"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-[12px] font-semibold transition hover:border-[var(--border-strong)]"
            >
              <RrIcon name="file-invoice" size={12} />
              {t("gl.openTB", "Trial Balance")}
            </Link>
          }
        />

        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("gl.account", "Account")}>
              <select
                value={accountId ?? ""}
                onChange={(e) => setAccountId(e.target.value || null)}
                className="min-w-[280px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {translateAccountName(a.code, a.name, lang)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("gl.from", "From")}>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </Field>
            <Field label={t("gl.to", "To")}>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
            </Field>
            <button
              type="button"
              onClick={() => setFrom("")}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] hover:border-[var(--border-strong)]"
            >{t("gl.allTime", "All-time")}</button>
            <div className="ml-auto text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              {loading ? t("common.loading", "Loading…") : ledger ? t("gl.entriesCount", "{n} entries").replace("{n}", String(ledger.rows.length)) : ""}
            </div>
          </div>
        </Card>

        {error && (
          <Card>
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-300">{error}</div>
          </Card>
        )}

        {ledger && (
          <Card>
            <div className="mb-2 flex items-baseline justify-between border-b border-[var(--border-subtle)] pb-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
                  {ledger.account.code} · {t(`gl.type.${ledger.account.type}`, `${ledger.account.type} (${ledger.account.normal_balance}-normal)`)}
                </div>
                <div className="text-[14px] font-semibold">{translateAccountName(ledger.account.code, ledger.account.name, lang)}</div>
              </div>
              <div className="flex items-baseline gap-6 text-[12px] tabular-nums">
                <span className="text-[10px] text-[var(--text-dim)]">{t("gl.opening", "Opening")}</span>
                <span className="font-mono">{fmt(ledger.opening_balance)}</span>
                <span className="text-[10px] text-[var(--text-dim)]">{t("gl.closing", "Closing")}</span>
                <span className="font-mono font-bold">{fmt(ledger.closing_balance)}</span>
              </div>
            </div>

            {ledger.rows.length === 0 ? (
              <EmptyState title={t("gl.empty.title", "No activity")} hint={t("gl.empty.hint", "No posted journal lines hit this account in the selected window.")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[9px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                      <th className="px-2 py-1.5 text-left">{t("gl.col.date", "Date")}</th>
                      <th className="px-2 py-1.5 text-left">{t("gl.col.journal", "Journal")}</th>
                      <th className="px-2 py-1.5 text-left">{t("gl.col.description", "Description")}</th>
                      <th className="px-2 py-1.5 text-left">{t("gl.col.source", "Source")}</th>
                      <th className="px-2 py-1.5 text-right">{t("gl.col.debit", "Debit")}</th>
                      <th className="px-2 py-1.5 text-right">{t("gl.col.credit", "Credit")}</th>
                      <th className="px-2 py-1.5 text-right">{t("gl.col.balance", "Balance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.rows.map((r, i) => (
                      <tr key={`${r.entry_id}-${i}`} className="border-b border-[var(--border-faint)]">
                        <td className="px-2 py-1.5 font-mono text-[var(--text-highlight)]">{r.entry_date}</td>
                        <td className="px-2 py-1.5 font-mono text-[var(--text-secondary)]">{r.journal_no}</td>
                        <td className="px-2 py-1.5">{r.description ?? "—"}</td>
                        <td className="px-2 py-1.5 text-[10px] text-[var(--text-dim)]">{r.source_type}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-mono">{r.debit > 0 ? fmt(r.debit) : "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-mono">{r.credit > 0 ? fmt(r.credit) : "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-mono font-semibold">{fmt(r.running_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
