"use client";

/* ---------------------------------------------------------------------------
   /finance/workspace — operator-oriented finance home.

   Sections:
     · Quick Actions (large buttons)
     · Pending Approvals
     · Recent Transactions timeline
     · Bank Accounts
     · Navigation cards (Expenses / Journals / Reports / FX)
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ErpEyebrow, ErpHairline, ErpPage, ErpPanel, ErpQuickAction,
  ErpStatusDot, type ErpStatus,
} from "@/components/ui/erp/ErpUi";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { FocusBoundary, FocusToggle } from "@/components/ui/focus/FocusMode";
import { openSmartCreate } from "@/components/ui/create/SmartCreateDrawer";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";

interface PendingItem {
  kind: "expense" | "payment" | "bill" | "journal";
  id: string; ref: string; party_name?: string | null;
  amount: number; currency: string; submitted_at: string | null;
  href: string; status: string;
}
interface RecentItem {
  kind: "expense" | "payment" | "invoice" | "bill" | "fx" | "journal";
  id: string; ref: string; party_name?: string | null;
  amount: number; currency: string; occurred_at: string; href: string;
}
interface WorkspaceBank {
  id: string; label: string; currency: string; current_balance: number;
}
interface Snapshot {
  base_currency: string;
  pending: PendingItem[];
  recent: RecentItem[];
  banks: WorkspaceBank[];
  counts: {
    expenses_open: number; payments_open: number; invoices_open: number;
    bills_open: number; fx_30d: number; journals_draft: number;
  };
}

function fmtAmt(n: number, ccy: string) {
  return `${ccy} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

const KIND_ICON: Record<RecentItem["kind"], RrIconName> = {
  expense: "receipt", payment: "money", invoice: "file-invoice-dollar",
  bill: "file-invoice", fx: "balance-scale-left", journal: "books",
};
const KIND_LABEL_KEY: Record<RecentItem["kind"], { key: string; en: string }> = {
  expense: { key: "kind.expense", en: "Expense" },
  payment: { key: "kind.payment", en: "Payment" },
  invoice: { key: "kind.invoice", en: "Invoice" },
  bill:    { key: "kind.bill",    en: "Bill" },
  fx:      { key: "kind.fx",      en: "FX" },
  journal: { key: "kind.journal", en: "Journal" },
};

export default function FinanceWorkspace() {
  const { t } = useTranslation(financeT);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [vis, setVis]   = useState<{ can_see_bank_balances: boolean; can_see_profit: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/finance/workspace");
        const j = await r.json();
        if (!r.ok) throw new Error(humanizeError(j.error || `HTTP ${r.status}`));
        setSnap(j.snapshot);
        setVis(j.visibility);
      } catch (e) {
        setError(humanizeError(e));
      } finally { setLoading(false); }
    })();
  }, []);

  const totalPending = (snap?.pending.length ?? 0);

  return (
    <ErpPage
      title={t("workspace.title", "Finance Workspace")}
      subtitle={t("workspace.subtitle", "Enter · review · approve")}
      icon="bank"
      backHref="/"
      action={
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openSmartCreate()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[12px] text-emerald-100 hover:bg-emerald-300/[0.14]"
                  title={t("header.createTitle", "Create (c)")}>
            <RrIcon name="plus" size={12} /> {t("header.create", "Create")}
          </button>
          <FocusToggle />
          <Link href="/reports" className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-surface-hover)]">
            <RrIcon name="newspaper" size={12} /> {t("workspace.reports", "Reports")}
          </Link>
        </div>
      }
    >
      {loading && <div className="text-sm text-[var(--text-dim)]">{t("workspace.loading", "Loading…")}</div>}
      {error && <div className="text-sm text-rose-300">{error}</div>}
      {snap && (
        <>
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <ErpEyebrow>{t("workspace.topActions", "Top actions")}</ErpEyebrow>
              <Link href="/finance/data-entry" className="text-[11px] text-emerald-200 hover:text-emerald-100">{t("workspace.howToEnter", "How do I enter data? →")}</Link>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <ErpQuickAction href="/finance/data-entry" icon="pencil"             label={t("workspace.qa.dataEntry",  "Data Entry")}  hint={t("workspace.qa.dataEntryHint",  "Assets · balances · all manual entry")} />
              <ErpQuickAction href="/finance/visual"     icon="balance-scale-left" label={t("workspace.qa.statements", "Statements")}  hint={t("workspace.qa.statementsHint", "Income · Balance · Cash flow")} />
              <ErpQuickAction href="/finance/fx-rates"   icon="balance-scale-left" label={t("workspace.qa.fx",         "FX Rates")}    hint={t("workspace.qa.fxHint",         "USD → CNY · stale + missing")} />
              <ErpQuickAction href="/finance/approvals"  icon="badge-check"        label={t("workspace.qa.approvals",  "Approvals")}   hint={t("workspace.qa.approvalsHint",  "Review pending")} />
            </div>
          </section>

          {/* Pending Approvals + Bank Accounts */}
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-2 flex items-baseline justify-between">
                <ErpEyebrow>{t("workspace.pendingQueue", "Pending Queue")}</ErpEyebrow>
                <Link href="/finance/approvals" className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-highlight)]">
                  {t("workspace.viewAll", "View all")}{totalPending > 0 ? ` (${totalPending})` : ""} →
                </Link>
              </div>
              <ErpPanel>
                {snap.pending.length === 0 ? (
                  <EmptyState
                    icon="badge-check"
                    title={t("workspace.empty.pending", "No pending items")}
                    body={t("workspace.empty.pendingBody", "Submit an expense or journal to get started.")}
                    actionHref="/finance/expenses?new=1"
                    actionLabel={t("workspace.empty.newExpense", "New expense")}
                  />
                ) : (
                  <ul>
                    {snap.pending.slice(0, 10).map((p) => (
                      <li key={`${p.kind}-${p.id}`} className="border-b border-[var(--border-faint)] last:border-b-0">
                        <Link href={p.href} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-secondary)]">
                          <ErpStatusDot status={statusFromApproval(p.status)} />
                          <RrIcon name={KIND_ICON[p.kind]} size={12} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12.5px] font-medium">{p.ref}</div>
                            <div className="text-[10.5px] text-[var(--text-dim)]">
                              {t(KIND_LABEL_KEY[p.kind].key, KIND_LABEL_KEY[p.kind].en)} · {p.party_name ?? t("workspace.unspecified", "Unspecified")} · {fmtDay(p.submitted_at)}
                            </div>
                          </div>
                          <div className="font-mono text-[12px] tabular-nums">
                            {p.amount === 0 && p.kind === "journal" ? "—" : fmtAmt(p.amount, p.currency)}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </ErpPanel>
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <ErpEyebrow>{t("workspace.banks", "Bank Accounts")}</ErpEyebrow>
                <Link href="/finance/bank-accounts" className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-highlight)]">{t("workspace.manage", "Manage →")}</Link>
              </div>
              <ErpPanel>
                {snap.banks.length === 0 ? (
                  <EmptyState
                    icon="bank" title={t("workspace.empty.noBanks", "No bank accounts added yet")}
                    body={t("workspace.empty.noBanksBody", "Add one to start tracking balances.")}
                    actionHref="/finance/bank-accounts?new=1" actionLabel={t("workspace.empty.addBank", "Add Bank Account")}
                  />
                ) : (
                  <ul>
                    {snap.banks.map((b) => (
                      <li key={b.id} className="border-b border-[var(--border-faint)] last:border-b-0">
                        <Link href={`/finance/bank-accounts?id=${b.id}`}
                              className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[var(--bg-secondary)]">
                          <div className="min-w-0">
                            <div className="truncate text-[12.5px] font-medium">{b.label}</div>
                            <div className="text-[10.5px] text-[var(--text-dim)]">{b.currency}</div>
                          </div>
                          <div className="font-mono text-[12px] tabular-nums">
                            {vis?.can_see_bank_balances ? fmtAmt(b.current_balance, b.currency) : "•••"}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </ErpPanel>
            </div>
          </section>

          {/* Recent Transactions — secondary chrome, hidden under Focus Mode. */}
          <FocusBoundary>
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <ErpEyebrow>{t("workspace.recent", "Recent Activity")}</ErpEyebrow>
              <span className="text-[10.5px] text-[var(--text-dim)]">{t("workspace.lastEvents", "Last {n} events").replace("{n}", String(snap.recent.length))}</span>
            </div>
            <ErpPanel>
              {snap.recent.length === 0 ? (
                <EmptyState
                  icon="clock" title={t("workspace.empty.noActivity", "No activity yet")}
                  body={t("workspace.empty.noActivityBody", "When you create transactions they'll show up here.")}
                />
              ) : (
                <ol className="relative">
                  {snap.recent.map((r, idx) => (
                    <li key={`${r.kind}-${r.id}`} className="relative border-b border-[var(--border-faint)] last:border-b-0">
                      <Link href={r.href} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-secondary)]">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-highlight)]">
                          <RrIcon name={KIND_ICON[r.kind]} size={12} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-medium">{r.ref}</div>
                          <div className="text-[10.5px] text-[var(--text-dim)]">
                            {t(KIND_LABEL_KEY[r.kind].key, KIND_LABEL_KEY[r.kind].en)} · {r.party_name ?? r.occurred_at}
                          </div>
                        </div>
                        <div className="font-mono text-[12px] tabular-nums">{fmtAmt(r.amount, r.currency)}</div>
                        <div className="text-[10.5px] text-[var(--text-dim)]">{fmtDay(r.occurred_at)}</div>
                      </Link>
                      {idx === 0 && <span aria-hidden className="absolute left-[15px] top-0 h-2 w-px bg-emerald-400/40" />}
                    </li>
                  ))}
                </ol>
              )}
            </ErpPanel>
          </section>

          {/* Navigation cards */}
          <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <NavCard href="/finance/expenses"   icon="receipt"             label={t("workspace.nav.expenses",  "Expenses")}  count={snap.counts.expenses_open} />
            <NavCard href="/finance/accounting" icon="books"               label={t("workspace.nav.journals",  "Journals")}  count={snap.counts.journals_draft} />
            <NavCard href="/reports"            icon="newspaper"           label={t("workspace.nav.reports",   "Reports")}   count={null} />
            <NavCard href="/finance/setup?card=fx-rates" icon="balance-scale-left" label={t("workspace.nav.fxActivity", "FX Activity")} count={snap.counts.fx_30d} />
          </section>
          </FocusBoundary>
        </>
      )}
    </ErpPage>
  );
}

/* ─── Helpers ─── */

function statusFromApproval(s: string): ErpStatus {
  if (s === "approved" || s === "posted")    return "complete";
  if (s === "rejected" || s === "voided")    return "blocked";
  if (s === "pending" || s === "submitted")  return "started";
  return "empty";
}

function EmptyState({ icon, title, body, actionHref, actionLabel }: {
  icon: RrIconName; title: string; body: string;
  actionHref?: string; actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
        <RrIcon name={icon} size={16} />
      </span>
      <div className="text-[12.5px] font-medium">{title}</div>
      <div className="mt-1 text-[10.5px] text-[var(--text-dim)]">{body}</div>
      {actionHref && actionLabel && (
        <Link href={actionHref}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-hover)] px-3 py-1.5 text-[11.5px] hover:bg-[var(--bg-surface-hover)]">
          <RrIcon name="plus" size={10} />
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function NavCard({ href, icon, label, count }: {
  href: string; icon: RrIconName; label: string; count: number | null;
}) {
  const { t } = useTranslation(financeT);
  return (
    <Link href={href} className="block">
      <ErpPanel className="px-3 py-3.5 transition-colors hover:bg-[var(--bg-surface-subtle)]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-highlight)]">
            <RrIcon name={icon} size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium">{label}</div>
            {count !== null && <div className="text-[10.5px] text-[var(--text-dim)]">{t("workspace.openLabel", "{n} open").replace("{n}", String(count))}</div>}
          </div>
          <ErpHairline className="hidden" />
        </div>
      </ErpPanel>
    </Link>
  );
}
