"use client";

/* ---------------------------------------------------------------------------
   /finance/accounting/general-ledger

   Per-account ledger viewer. Choose an account from the COA picker,
   optionally clamp to a period, see every effective journal line with a
   running balance, 200 rows a page. Amounts are base currency; a line
   booked in another currency shows its own currency and rate. Mono +
   tabular-nums; negatives in parentheses; dates D/M/Y.

   Deep links: ?account_id=… or ?account_code=1010 (from the queue and
   the trial balance), plus from / to.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { FIN_ACCOUNTING } from "@/lib/translations/finance/accounting";
import { FIN_COMMON } from "@/lib/translations/finance/common";
import { FIN_GL } from "@/lib/translations/finance/gl";
import { translateAccountName } from "@/lib/translations/finance/account-names";
import { EmptyState } from "@/components/finance/FinanceUi";
import Pagination from "@/components/kds/Pagination";
import RrIcon from "@/components/ui/RrIcon";
import { fmtAccounting, fmtDMY, todayIso } from "@/lib/finance/format";
import type { AccountingAccount, GeneralLedger } from "@/lib/accounting/types";

/* Only the namespaces this screen reads — see finance.ts. */
const DICT = { ...FIN_ACCOUNTING, ...FIN_COMMON, ...FIN_GL } as const;

const PAGE = 200;

type PagedLedger = GeneralLedger & { total_rows?: number; limit?: number; offset?: number };

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

export default function FinanceGeneralLedger() {
  const { t, lang } = useTranslation(DICT);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = useMemo(() => todayIso(), []);

  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [accountId, setAccountId] = useState<string | null>(params.get("account_id"));
  const [from, setFrom] = useState<string>(params.get("from") ?? "");
  const [to,   setTo]   = useState<string>(params.get("to") ?? today);
  const [page, setPage] = useState(1);
  const [ledger, setLedger] = useState<PagedLedger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Load COA once; resolve ?account_code= to an id when given. */
  useEffect(() => {
    let cancelled = false;
    const wantCode = params.get("account_code");
    void (async () => {
      const r = await fetch("/api/accounting/accounts", { cache: "no-store", credentials: "include" });
      const j = await r.json().catch(() => ({ accounts: [] }));
      if (cancelled) return;
      const list = (j.accounts ?? []) as AccountingAccount[];
      setAccounts(list);
      setAccountId((prev) => prev ?? (wantCode ? list.find((a) => a.code === wantCode)?.id ?? null : null) ?? (list[0]?.id ?? null));
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Any filter change restarts at page 1. */
  useEffect(() => { setPage(1); }, [accountId, from, to]);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ account_id: accountId, limit: String(PAGE), offset: String((page - 1) * PAGE) });
      if (from) qs.set("from", from);
      if (to)   qs.set("to", to);
      const res = await fetch(`/api/accounting/general-ledger?${qs}`, { cache: "no-store", credentials: "include" });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? `Failed (${res.status})`); setLedger(null); return; }
      setLedger(j.ledger as PagedLedger);
      const url = new URLSearchParams();
      url.set("account_id", accountId);
      if (from) url.set("from", from);
      if (to)   url.set("to", to);
      router.replace(`${pathname}?${url}`, { scroll: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [accountId, from, to, page, router, pathname]);
  useEffect(() => { void load(); }, [load]);

  const totalRows = ledger?.total_rows ?? ledger?.rows.length ?? 0;
  const pages = Math.max(1, Math.ceil(totalRows / PAGE));
  const firstRow = totalRows === 0 ? 0 : (page - 1) * PAGE + 1;
  const lastRow = Math.min(page * PAGE, totalRows);

  const inputCls = "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]";

  return (
    <div className="min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("accounting.gl.title", "General Ledger")}
          subtitle={t("accounting.gl.subtitle.long", "Every posted journal line against a chosen account, with a running balance.")}
          action={
            <Link
              href="/finance/accounting/trial-balance"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 text-[13px] font-semibold text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--text-primary)]"
            >
              <RrIcon name="file-invoice" size={12} />
              {t("gl.openTB", "Trial Balance")}
            </Link>
          }
        />

        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("gl.account", "Account")}>
              <select value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value || null)} className={`min-w-[280px] ${inputCls}`}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {translateAccountName(a.code, a.name, lang)}</option>
                ))}
              </select>
            </Field>
            <Field label={t("gl.from", "From")}>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
            </Field>
            <Field label={t("gl.to", "To")}>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
            </Field>
            <button
              type="button"
              onClick={() => setFrom("")}
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 text-[13px] font-semibold text-[var(--text-muted)] transition-all hover:border-[var(--border-focus)] hover:text-[var(--text-primary)]"
            >{t("gl.allTime", "All-time")}</button>
            <div className="ms-auto text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              {loading ? t("common.loading", "Loading…") : ledger ? t("gl.entriesCount", "{n} entries").replace("{n}", String(totalRows)) : ""}
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
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--border-subtle)] pb-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
                  {ledger.account.code} · {t(`gl.type.${ledger.account.type}`, `${ledger.account.type} (${ledger.account.normal_balance}-normal)`)}
                </div>
                <div className="text-[14px] font-semibold">{translateAccountName(ledger.account.code, ledger.account.name, lang)}</div>
              </div>
              <div className="flex items-baseline gap-6 text-[12px] tabular-nums">
                <span className="text-[10px] text-[var(--text-dim)]">{t("gl.opening", "Opening")}</span>
                <span className="font-mono">{fmtAccounting(ledger.opening_balance)}</span>
                <span className="text-[10px] text-[var(--text-dim)]">{t("gl.closing", "Closing")}</span>
                <span className="font-mono font-bold">{fmtAccounting(ledger.closing_balance)}</span>
              </div>
            </div>

            {ledger.rows.length === 0 ? (
              <EmptyState title={t("gl.empty.title", "No activity")} hint={t("gl.empty.hint", "No posted journal lines hit this account in the selected window.")} />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[9px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                        <th className="px-2 py-1.5 text-start">{t("gl.col.date", "Date")}</th>
                        <th className="px-2 py-1.5 text-start">{t("gl.col.journal", "Journal")}</th>
                        <th className="px-2 py-1.5 text-start">{t("gl.col.description", "Description")}</th>
                        <th className="px-2 py-1.5 text-start">{t("gl.col.source", "Source")}</th>
                        <th className="px-2 py-1.5 text-end">{t("gl.col.debit", "Debit")}</th>
                        <th className="px-2 py-1.5 text-end">{t("gl.col.credit", "Credit")}</th>
                        <th className="px-2 py-1.5 text-end">{t("gl.col.balance", "Balance")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.rows.map((r, i) => (
                        <tr key={`${r.entry_id}-${i}`} className="border-b border-[var(--border-faint)]">
                          <td className="px-2 py-1.5 font-mono text-[var(--text-highlight)]">{fmtDMY(r.entry_date)}</td>
                          <td className="px-2 py-1.5 font-mono text-[var(--text-secondary)]">{r.journal_no}</td>
                          <td className="px-2 py-1.5">
                            {r.description ?? "—"}
                            {r.currency && r.exchange_rate != null && Number(r.exchange_rate) !== 1 && (
                              <span className="ms-1 text-[10px] text-[var(--text-dim)]">{r.currency} @ {Number(r.exchange_rate).toFixed(4)}</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-[10px] text-[var(--text-dim)]">{r.source_type}</td>
                          <td className="px-2 py-1.5 text-end font-mono tabular-nums">{fmtAccounting(r.debit)}</td>
                          <td className="px-2 py-1.5 text-end font-mono tabular-nums">{fmtAccounting(r.credit)}</td>
                          <td className="px-2 py-1.5 text-end font-mono font-semibold tabular-nums">{fmtAccounting(r.running_balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pages > 1 && (
                  <Pagination
                    className="mt-3"
                    page={page}
                    pages={pages}
                    summary={t("gl.pageSummary", "{from}–{to} of {total}").replace("{from}", String(firstRow)).replace("{to}", String(lastRow)).replace("{total}", String(totalRows))}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => Math.min(pages, p + 1))}
                    prevLabel={t("gl.prev", "Prev")}
                    nextLabel={t("gl.next", "Next")}
                  />
                )}
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
