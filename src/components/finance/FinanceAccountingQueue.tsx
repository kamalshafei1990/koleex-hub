"use client";

/* ---------------------------------------------------------------------------
   /finance/accounting/queue

   Operational events awaiting accounting recognition. The page is a
   review-oriented operator surface — quiet, monochrome, dense but
   readable. Five status tabs (Pending / Drafted / Failed / Posted /
   Voided) with a count badge each; a flat table beneath; a side
   review drawer slides in when you select an item.

   Workflow:
     1. Find a pending event in the table
     2. Click "Create draft" → drafted state
     3. Inspect the generated journal in the drawer
     4. Click "Post" → posted state, the draft hits the GL
     5. Failed items show a "Retry" action; voided are read-only

   No data-flow / business logic owned here — every action calls
   one of the four API endpoints under /api/accounting/.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import RrIcon from "@/components/ui/RrIcon";
import { DashboardSection, Eyebrow, Hairline } from "@/components/finance/FinanceDashboardUi";

type QueueStatus = "pending" | "drafted" | "posted" | "failed" | "voided";
type Kind = "payment" | "expense" | "cash_movement";

interface QueueItem {
  kind: Kind;
  source_id: string;
  description: string;
  party_name: string | null;
  amount: number;
  currency: string;
  source_date: string;
  accounting_status: QueueStatus;
  accounting_entry_id: string | null;
  accounting_last_error: string | null;
  accounting_posted_at: string | null;
  created_at: string;
}

interface QueueResponse {
  items: QueueItem[];
  counts: Record<QueueStatus, number>;
}

interface JournalLine {
  id: string;
  line_index: number;
  debit: number | string;
  credit: number | string;
  currency: string;
  description: string | null;
  reference: string | null;
  account: { code: string; name: string; type: string; normal_balance: string } | null;
}

interface ReviewResponse {
  source: Record<string, unknown> | null;
  entry: {
    id: string;
    journal_no: string;
    status: string;
    entry_date: string;
    description: string | null;
    posted_at: string | null;
  } | null;
  lines: JournalLine[];
}

const TABS: Array<{ key: QueueStatus; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "drafted", label: "Drafted" },
  { key: "failed",  label: "Failed" },
  { key: "posted",  label: "Posted" },
  { key: "voided",  label: "Voided" },
];

const KIND_LABEL: Record<Kind, string> = {
  payment: "Payment",
  expense: "Expense",
  cash_movement: "Bank movement",
};

function fmtMoney(n: number, ccy: string): string {
  if (Math.abs(n) < 0.005) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? `(${abs})` : abs} ${ccy}`;
}

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d <= 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

export default function FinanceAccountingQueue() {
  const [active, setActive] = useState<QueueStatus>("pending");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<Record<QueueStatus, number>>({
    pending: 0, drafted: 0, posted: 0, failed: 0, voided: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Currently-selected item — drives the review drawer. */
  const [selected, setSelected] = useState<QueueItem | null>(null);
  /* Per-row busy state — prevents double-clicks during a draft / post / retry. */
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/queue?status=${active}`, { cache: "no-store", credentials: "include" });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? `Failed (${res.status})`); return; }
      const data = j as QueueResponse;
      setItems(data.items);
      /* Pull a separate "all statuses" call so the tab counts are
         independent of the active filter. The endpoint already caps
         at 100/kind so this is cheap. */
      const allRes = await fetch(`/api/accounting/queue?status=all&limit=200`, { cache: "no-store", credentials: "include" });
      const allJ = await allRes.json().catch(() => null);
      if (allRes.ok && allJ?.counts) setCounts(allJ.counts as Record<QueueStatus, number>);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [active]);
  useEffect(() => { void load(); }, [load]);

  const callAction = useCallback(async (kind: "draft" | "post-draft" | "retry" | "void", body: Record<string, unknown>): Promise<boolean> => {
    setBusy(`${kind}:${JSON.stringify(body)}`);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/${kind}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? `Failed (${res.status})`);
        return false;
      }
      return true;
    } finally {
      setBusy(null);
    }
  }, []);

  const doDraft = useCallback(async (it: QueueItem) => {
    if (await callAction("draft", { kind: it.kind, source_id: it.source_id })) await load();
  }, [callAction, load]);
  const doPost = useCallback(async (it: QueueItem) => {
    if (!it.accounting_entry_id) return;
    if (await callAction("post-draft", { entry_id: it.accounting_entry_id })) await load();
  }, [callAction, load]);
  const doRetry = useCallback(async (it: QueueItem) => {
    if (await callAction("retry", { kind: it.kind, source_id: it.source_id })) await load();
  }, [callAction, load]);
  const doVoid = useCallback(async (it: QueueItem) => {
    if (!it.accounting_entry_id) return;
    const reason = window.prompt("Reason for voiding this entry?") ?? "voided via queue";
    const res = await fetch(`/api/accounting/journals/${it.accounting_entry_id}/void`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) await load();
    else { const j = await res.json().catch(() => ({})); setError(j.error ?? `Void failed (${res.status})`); }
  }, [load]);

  const visibleItems = useMemo(() => items, [items]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Accounting Queue"
          subtitle="Operational events awaiting recognition. Create a draft, review, post."
          action={
            <Link
              href="/finance/accounting/trial-balance"
              className="inline-flex items-center gap-2 rounded-md border border-white/[0.10] bg-[var(--bg-primary)] px-3 py-1.5 text-[12px] font-semibold transition hover:border-white/[0.20]"
            >
              <RrIcon name="badge-check" size={12} />
              Trial Balance
            </Link>
          }
        />

        {/* Status tabs — calm, no chrome */}
        <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.05] pb-2">
          {TABS.map((t) => {
            const isActive = active === t.key;
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => { setActive(t.key); setSelected(null); }}
                className={`relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
                  isActive
                    ? "font-medium text-[var(--text-primary)]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {isActive && <span aria-hidden className="pointer-events-none absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-white/40" />}
                {t.label}
                <span className="text-[10px] tabular-nums text-gray-500">{count}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</div>
        )}

        {/* Table + drawer */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.012]">
            {loading ? (
              <div className="px-4 py-8 text-center text-[11px] text-gray-500">Loading…</div>
            ) : visibleItems.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Eyebrow>No {active} items</Eyebrow>
                <p className="mt-2 text-[12px] text-gray-500">
                  {active === "pending" ? "All operational events have been recognised or drafted." : "Nothing to review in this state."}
                </p>
              </div>
            ) : (
              <table className="min-w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-white/[0.05] text-[9px] uppercase tracking-[0.12em] text-gray-500">
                    <th className="px-3 py-2 text-left">Kind</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Party</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Age</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((it) => {
                    const isSelected = selected?.source_id === it.source_id && selected?.kind === it.kind;
                    return (
                      <tr
                        key={`${it.kind}-${it.source_id}`}
                        onClick={() => setSelected(it)}
                        className={`cursor-pointer border-b border-white/[0.03] transition-colors ${
                          isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="px-3 py-2 text-[11px] uppercase tracking-[0.10em] text-gray-400">{KIND_LABEL[it.kind]}</td>
                        <td className="px-3 py-2">{it.description}</td>
                        <td className="px-3 py-2 text-gray-400">{it.party_name ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-mono">{fmtMoney(it.amount, it.currency)}</td>
                        <td className="px-3 py-2 font-mono text-gray-400">{it.source_date}</td>
                        <td className="px-3 py-2 text-[10px] text-gray-500">{relativeAge(it.created_at)}</td>
                        <td className="px-3 py-2 text-right">
                          <ActionButtons
                            item={it}
                            busy={busy}
                            onDraft={() => void doDraft(it)}
                            onPost={() => void doPost(it)}
                            onRetry={() => void doRetry(it)}
                            onVoid={() => void doVoid(it)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Review drawer */}
          {selected ? (
            <ReviewDrawer
              item={selected}
              onClose={() => setSelected(null)}
              onAction={async () => { await load(); }}
              busy={busy}
              callAction={callAction}
            />
          ) : (
            <div className="hidden rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-12 text-center lg:block">
              <Eyebrow>Review panel</Eyebrow>
              <p className="mt-2 text-[12px] text-gray-500">Select an item to view its operational source and journal draft.</p>
            </div>
          )}
        </div>

        <DashboardSection eyebrow="Workflow" title="How recognition works">
          <ol className="grid gap-3 text-[12px] text-gray-400 sm:grid-cols-2 lg:grid-cols-4">
            <li><strong className="text-gray-300">1. Pending</strong> — operational event happened; no journal yet.</li>
            <li><strong className="text-gray-300">2. Drafted</strong> — entry created in <code>draft</code> status, balanced, awaiting review.</li>
            <li><strong className="text-gray-300">3. Posted</strong> — entry hit the GL and is now immutable.</li>
            <li><strong className="text-gray-300">4. Voided</strong> — original posted entry reversed by a new opposite-side entry.</li>
          </ol>
        </DashboardSection>
        <Hairline />
      </div>
    </div>
  );
}

function ActionButtons({
  item, busy, onDraft, onPost, onRetry, onVoid,
}: {
  item: QueueItem;
  busy: string | null;
  onDraft: () => void;
  onPost: () => void;
  onRetry: () => void;
  onVoid: () => void;
}) {
  const isBusy = busy !== null;
  /* Stop the row's onClick from also firing when buttons are tapped. */
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  if (item.accounting_status === "pending") {
    return (
      <button type="button" onClick={(e) => { stop(e); onDraft(); }} disabled={isBusy}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-[11px] hover:border-white/[0.20] disabled:opacity-50">
        Create draft
      </button>
    );
  }
  if (item.accounting_status === "drafted") {
    return (
      <button type="button" onClick={(e) => { stop(e); onPost(); }} disabled={isBusy}
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50">
        Post
      </button>
    );
  }
  if (item.accounting_status === "failed") {
    return (
      <button type="button" onClick={(e) => { stop(e); onRetry(); }} disabled={isBusy}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-500/15 disabled:opacity-50">
        Retry
      </button>
    );
  }
  if (item.accounting_status === "posted") {
    return (
      <button type="button" onClick={(e) => { stop(e); onVoid(); }} disabled={isBusy}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.02] px-2 py-1 text-[11px] text-gray-400 hover:border-rose-500/30 hover:text-rose-200 disabled:opacity-50">
        Void
      </button>
    );
  }
  return <span className="text-[10px] text-gray-600">—</span>;
}

function ReviewDrawer({
  item, onClose, onAction, busy, callAction,
}: {
  item: QueueItem;
  onClose: () => void;
  onAction: () => Promise<void>;
  busy: string | null;
  callAction: (kind: "draft" | "post-draft" | "retry" | "void", body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const load = useCallback(async () => {
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/accounting/queue/${item.kind}/${encodeURIComponent(item.source_id)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const j = await res.json();
      if (res.ok) setData(j as ReviewResponse);
    } finally {
      setDrawerLoading(false);
    }
  }, [item.kind, item.source_id]);
  useEffect(() => { void load(); }, [load]);

  const totalDr = (data?.lines ?? []).reduce((s, l) => s + (Number(l.debit)  || 0), 0);
  const totalCr = (data?.lines ?? []).reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.005;

  return (
    <aside className="rounded-xl border border-white/[0.05] bg-white/[0.012] p-4">
      <div className="flex items-center justify-between">
        <Eyebrow>Review · {KIND_LABEL[item.kind]}</Eyebrow>
        <button type="button" onClick={onClose} className="text-[10px] text-gray-500 hover:text-gray-300">Close</button>
      </div>
      <div className="mt-3 text-[13px] font-medium">{item.description}</div>
      <div className="mt-1 text-[11px] text-gray-500">
        {item.party_name ?? "—"} · {item.source_date}
      </div>
      <div className="mt-2 font-mono text-[13px] tabular-nums">{fmtMoney(item.amount, item.currency)}</div>

      <div className="mt-3 inline-flex rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-gray-400">
        {item.accounting_status}
      </div>

      {item.accounting_last_error && (
        <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
          {item.accounting_last_error}
        </div>
      )}

      <div className="mt-5">
        <Eyebrow>Journal preview</Eyebrow>
        {drawerLoading ? (
          <div className="mt-2 text-[11px] text-gray-500">Loading journal…</div>
        ) : !data?.entry ? (
          <div className="mt-2 text-[11px] text-gray-500">No draft yet. Create one from the row above.</div>
        ) : (
          <div className="mt-2 space-y-1.5">
            <div className="text-[10px] text-gray-500">
              {data.entry.journal_no} · {data.entry.status}
              {data.entry.posted_at && ` · posted ${data.entry.posted_at.slice(0, 10)}`}
            </div>
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-white/[0.05] text-[9px] uppercase tracking-[0.10em] text-gray-500">
                  <th className="py-1 text-left">Account</th>
                  <th className="py-1 text-right">Debit</th>
                  <th className="py-1 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.id} className="border-b border-white/[0.03]">
                    <td className="py-1">
                      <span className="font-mono text-gray-500">{l.account?.code} </span>
                      {l.account?.name}
                    </td>
                    <td className="py-1 text-right tabular-nums font-mono">{Number(l.debit) > 0 ? fmtMoney(Number(l.debit), l.currency).split(" ")[0] : "—"}</td>
                    <td className="py-1 text-right tabular-nums font-mono">{Number(l.credit) > 0 ? fmtMoney(Number(l.credit), l.currency).split(" ")[0] : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/[0.10]">
                  <td className="pt-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Totals</td>
                  <td className="pt-1 text-right tabular-nums font-mono">{totalDr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="pt-1 text-right tabular-nums font-mono">{totalCr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
            <div className={`text-[10px] ${balanced ? "text-emerald-300" : "text-rose-300"}`}>
              {balanced ? "Balanced" : `Out of balance by ${(totalDr - totalCr).toFixed(2)}`}
            </div>
          </div>
        )}
      </div>

      {/* Drawer-level action buttons mirror the row's actions but
          give the operator a larger target after reviewing. */}
      <div className="mt-5 flex flex-wrap gap-2">
        {item.accounting_status === "pending" && (
          <button type="button" disabled={busy !== null}
            onClick={async () => { if (await callAction("draft", { kind: item.kind, source_id: item.source_id })) await onAction(); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[11px] hover:border-white/[0.20] disabled:opacity-50">
            Create draft
          </button>
        )}
        {item.accounting_status === "drafted" && item.accounting_entry_id && (
          <button type="button" disabled={busy !== null}
            onClick={async () => { if (await callAction("post-draft", { entry_id: item.accounting_entry_id })) await onAction(); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50">
            Post entry
          </button>
        )}
        {item.accounting_status === "failed" && (
          <button type="button" disabled={busy !== null}
            onClick={async () => { if (await callAction("retry", { kind: item.kind, source_id: item.source_id })) await onAction(); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200 hover:bg-amber-500/15 disabled:opacity-50">
            Retry recognition
          </button>
        )}
        {data?.entry && (
          <Link
            href={`/finance/accounting/general-ledger?account_id=${data.lines[0]?.account?.code ?? ""}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] px-3 py-1.5 text-[11px] text-gray-400 hover:border-white/[0.15] hover:text-gray-200"
          >
            Open in GL →
          </Link>
        )}
      </div>
    </aside>
  );
}
