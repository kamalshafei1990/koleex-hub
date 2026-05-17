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
const KIND_LABEL: Record<RecentItem["kind"], string> = {
  expense: "Expense", payment: "Payment", invoice: "Invoice",
  bill: "Bill", fx: "FX", journal: "Journal",
};

export default function FinanceWorkspace() {
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
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        setSnap(j.snapshot);
        setVis(j.visibility);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally { setLoading(false); }
    })();
  }, []);

  const totalPending = (snap?.pending.length ?? 0);

  return (
    <ErpPage
      title="Finance Workspace"
      subtitle="Enter · review · approve"
      icon="bank"
      backHref="/"
      action={
        <Link href="/reports" className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]">
          <RrIcon name="newspaper" size={12} />
          Reports
        </Link>
      }
    >
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-rose-300">{error}</div>}
      {snap && (
        <>
          {/* Quick Actions */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <ErpEyebrow>Quick Actions</ErpEyebrow>
              <Link href="/finance/setup" className="text-[11px] text-gray-400 hover:text-gray-200">Finance setup →</Link>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <ErpQuickAction href="/finance/expenses?new=1" icon="receipt"          label="New Expense"        hint="Cash or bill" />
              <ErpQuickAction href="/finance/payments?new=1" icon="money"            label="New Payment"        hint="In / out" />
              <ErpQuickAction href="/invoices?new=1"          icon="file-invoice-dollar" label="New Invoice"      hint="Customer billing" />
              <ErpQuickAction href="/finance/accounting?new=1" icon="books"          label="New Journal"        hint="Manual entry" />
              <ErpQuickAction href="/finance/setup?card=fx-rates" icon="balance-scale-left" label="New FX Exchange" hint="Currency conversion" />
              <ErpQuickAction href="/finance/setup?card=assets"   icon="briefcase"   label="New Asset"           hint="Capital purchase" />
              <ErpQuickAction href="/finance/suppliers?new-bill=1" icon="file-invoice" label="New Vendor Bill"   hint="Supplier invoice" />
              <ErpQuickAction href="/finance/bank-accounts?new=1" icon="bank"        label="New Bank Account"    hint="Add account" />
            </div>
          </section>

          {/* Pending Approvals + Bank Accounts */}
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-2 flex items-baseline justify-between">
                <ErpEyebrow>Pending Queue</ErpEyebrow>
                <Link href="/finance/approvals" className="text-[11px] text-gray-400 hover:text-gray-200">
                  View all{totalPending > 0 ? ` (${totalPending})` : ""} →
                </Link>
              </div>
              <ErpPanel>
                {snap.pending.length === 0 ? (
                  <EmptyState
                    icon="badge-check"
                    title="No pending items"
                    body="Submit an expense or journal to get started."
                    actionHref="/finance/expenses?new=1"
                    actionLabel="New expense"
                  />
                ) : (
                  <ul>
                    {snap.pending.slice(0, 10).map((p) => (
                      <li key={`${p.kind}-${p.id}`} className="border-b border-white/[0.025] last:border-b-0">
                        <Link href={p.href} className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02]">
                          <ErpStatusDot status={statusFromApproval(p.status)} />
                          <RrIcon name={KIND_ICON[p.kind]} size={12} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12.5px] font-medium">{p.ref}</div>
                            <div className="text-[10.5px] text-gray-500">
                              {KIND_LABEL[p.kind]} · {p.party_name ?? "Unspecified"} · {fmtDay(p.submitted_at)}
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
                <ErpEyebrow>Bank Accounts</ErpEyebrow>
                <Link href="/finance/bank-accounts" className="text-[11px] text-gray-400 hover:text-gray-200">Manage →</Link>
              </div>
              <ErpPanel>
                {snap.banks.length === 0 ? (
                  <EmptyState
                    icon="bank" title="No bank accounts added yet"
                    body="Add one to start tracking balances."
                    actionHref="/finance/bank-accounts?new=1" actionLabel="Add Bank Account"
                  />
                ) : (
                  <ul>
                    {snap.banks.map((b) => (
                      <li key={b.id} className="border-b border-white/[0.025] last:border-b-0">
                        <Link href={`/finance/bank-accounts?id=${b.id}`}
                              className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-white/[0.02]">
                          <div className="min-w-0">
                            <div className="truncate text-[12.5px] font-medium">{b.label}</div>
                            <div className="text-[10.5px] text-gray-500">{b.currency}</div>
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

          {/* Recent Transactions */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <ErpEyebrow>Recent Activity</ErpEyebrow>
              <span className="text-[10.5px] text-gray-500">Last {snap.recent.length} events</span>
            </div>
            <ErpPanel>
              {snap.recent.length === 0 ? (
                <EmptyState
                  icon="clock" title="No activity yet"
                  body="When you create transactions they'll show up here."
                />
              ) : (
                <ol className="relative">
                  {snap.recent.map((r, idx) => (
                    <li key={`${r.kind}-${r.id}`} className="relative border-b border-white/[0.025] last:border-b-0">
                      <Link href={r.href} className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02]">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-300">
                          <RrIcon name={KIND_ICON[r.kind]} size={12} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-medium">{r.ref}</div>
                          <div className="text-[10.5px] text-gray-500">
                            {KIND_LABEL[r.kind]} · {r.party_name ?? r.occurred_at}
                          </div>
                        </div>
                        <div className="font-mono text-[12px] tabular-nums">{fmtAmt(r.amount, r.currency)}</div>
                        <div className="text-[10.5px] text-gray-500">{fmtDay(r.occurred_at)}</div>
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
            <NavCard href="/finance/expenses"   icon="receipt"             label="Expenses"  count={snap.counts.expenses_open} />
            <NavCard href="/finance/accounting" icon="books"               label="Journals"   count={snap.counts.journals_draft} />
            <NavCard href="/reports"            icon="newspaper"           label="Reports"    count={null} />
            <NavCard href="/finance/setup?card=fx-rates" icon="balance-scale-left" label="FX Activity" count={snap.counts.fx_30d} />
          </section>
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
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02] text-gray-400">
        <RrIcon name={icon} size={16} />
      </span>
      <div className="text-[12.5px] font-medium">{title}</div>
      <div className="mt-1 text-[10.5px] text-gray-500">{body}</div>
      {actionHref && actionLabel && (
        <Link href={actionHref}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 text-[11.5px] hover:bg-white/[0.10]">
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
  return (
    <Link href={href} className="block">
      <ErpPanel className="px-3 py-3.5 transition-colors hover:bg-white/[0.025]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-300">
            <RrIcon name={icon} size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium">{label}</div>
            {count !== null && <div className="text-[10.5px] text-gray-500">{count} open</div>}
          </div>
          <ErpHairline className="hidden" />
        </div>
      </ErpPanel>
    </Link>
  );
}
