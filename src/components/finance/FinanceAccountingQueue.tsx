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

import { humanizeError } from "@/lib/ui/humanize-error";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
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

/* Tab + kind labels are now created inside components via i18n. */
const TAB_KEYS: QueueStatus[] = ["pending", "drafted", "failed", "posted", "voided"];

function fmtMoney(n: number, ccy: string): string {
  if (Math.abs(n) < 0.005) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? `(${abs})` : abs} ${ccy}`;
}

export default function FinanceAccountingQueue() {
  const { t } = useTranslation(financeT);
  const relativeAge = (iso: string): string => {
    const ms = Date.now() - new Date(iso).getTime();
    const d = Math.floor(ms / 86_400_000);
    if (d <= 0) return t("accounting.queue.today", "today");
    if (d === 1) return t("accounting.queue.dayAgo", "1d ago");
    return t("accounting.queue.daysAgo", "{n}d ago").replace("{n}", String(d));
  };
  const TABS: Array<{ key: QueueStatus; label: string }> = [
    { key: "pending", label: t("accounting.queue.tab.pending", "Pending") },
    { key: "drafted", label: t("accounting.queue.tab.drafted", "Drafted") },
    { key: "failed",  label: t("accounting.queue.tab.failed", "Failed") },
    { key: "posted",  label: t("accounting.queue.tab.posted", "Posted") },
    { key: "voided",  label: t("accounting.queue.tab.voided", "Voided") },
  ];
  void TAB_KEYS;
  const KIND_LABEL: Record<Kind, string> = {
    payment: t("accounting.queue.kind.payment", "Payment"),
    expense: t("accounting.queue.kind.expense", "Expense"),
    cash_movement: t("accounting.queue.kind.cash", "Bank movement"),
  };
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
    const reason = window.prompt(t("accounting.queue.voidPrompt", "Reason for voiding this entry?")) ?? "voided via queue";
    const res = await fetch(`/api/accounting/journals/${it.accounting_entry_id}/void`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) await load();
    else { const j = await res.json().catch(() => ({})); setError(j.error ?? t("accounting.queue.voidFailed", "Void failed ({n})").replace("{n}", String(res.status))); }
  }, [load, t]);

  const visibleItems = useMemo(() => items, [items]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("accounting.queue.title", "Accounting Queue")}
          subtitle={t("accounting.queue.subtitle.long", "Operational events awaiting recognition. Create a draft, review, post.")}
          action={
            <Link
              href="/finance/accounting/trial-balance"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-[12px] font-semibold transition hover:border-[var(--border-strong)]"
            >
              <RrIcon name="badge-check" size={12} />
              {t("accounting.queue.trialBalance", "Trial Balance")}
            </Link>
          }
        />

        {/* Status tabs — calm, no chrome */}
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border-subtle)] pb-2">
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
                    : "text-[var(--text-dim)] hover:text-[var(--text-highlight)]"
                }`}
              >
                {isActive && <span aria-hidden className="pointer-events-none absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-white/40" />}
                {t.label}
                <span className="text-[10px] tabular-nums text-[var(--text-dim)]">{count}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</div>
        )}

        {/* Table + drawer */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            {loading ? (
              <div className="px-4 py-8 text-center text-[11px] text-[var(--text-dim)]">{t("accounting.queue.loading", "Loading…")}</div>
            ) : visibleItems.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Eyebrow>{t("accounting.queue.emptyTitle", "No {status} items").replace("{status}", active)}</Eyebrow>
                <p className="mt-2 text-[12px] text-[var(--text-dim)]">
                  {active === "pending" ? t("accounting.queue.empty.pending", "All operational events have been recognised or drafted.") : t("accounting.queue.empty.other", "Nothing to review in this state.")}
                </p>
              </div>
            ) : (
              <table className="min-w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[9px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    <th className="px-3 py-2 text-left">{t("accounting.queue.col.kind", "Kind")}</th>
                    <th className="px-3 py-2 text-left">{t("accounting.queue.col.desc", "Description")}</th>
                    <th className="px-3 py-2 text-left">{t("accounting.queue.col.party", "Party")}</th>
                    <th className="px-3 py-2 text-right">{t("accounting.queue.col.amount", "Amount")}</th>
                    <th className="px-3 py-2 text-left">{t("accounting.queue.col.date", "Date")}</th>
                    <th className="px-3 py-2 text-left">{t("accounting.queue.col.age", "Age")}</th>
                    <th className="px-3 py-2 text-right">{t("accounting.queue.col.actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((it) => {
                    const isSelected = selected?.source_id === it.source_id && selected?.kind === it.kind;
                    return (
                      <tr
                        key={`${it.kind}-${it.source_id}`}
                        onClick={() => setSelected(it)}
                        className={`cursor-pointer border-b border-[var(--border-faint)] transition-colors ${
                          isSelected ? "bg-[var(--bg-surface)]" : "hover:bg-[var(--bg-secondary)]"
                        }`}
                      >
                        <td className="px-3 py-2 text-[11px] uppercase tracking-[0.10em] text-[var(--text-secondary)]">{KIND_LABEL[it.kind]}</td>
                        <td className="px-3 py-2">{it.description}</td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{it.party_name ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-mono">{fmtMoney(it.amount, it.currency)}</td>
                        <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{it.source_date}</td>
                        <td className="px-3 py-2 text-[10px] text-[var(--text-dim)]">{relativeAge(it.created_at)}</td>
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
            <div className="hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-12 text-center lg:block">
              <Eyebrow>{t("accounting.queue.review.panel", "Review panel")}</Eyebrow>
              <p className="mt-2 text-[12px] text-[var(--text-dim)]">{t("accounting.queue.review.empty", "Select an item to view its operational source and journal draft.")}</p>
            </div>
          )}
        </div>

        {/* Phase A.4 — Inventory COGS recognition. */}
        <DashboardSection eyebrow={t("accounting.cogs.eyebrow", "Inventory COGS")} title={t("accounting.cogs.title", "Cost of Goods Sold from sales shipments")} tight>
          <InventoryCogsSection />
        </DashboardSection>

        {/* Phase A.5 — Revenue recognition. Sits beside COGS so the
            accountant sees both sides of every sale in one place. */}
        <DashboardSection eyebrow={t("accounting.revenue.eyebrow", "Sales Revenue")} title={t("accounting.revenue.title", "Revenue + AR recognition from confirmed invoices")} tight>
          <SalesRevenueSection />
        </DashboardSection>

        <DashboardSection eyebrow={t("accounting.workflow.eyebrow", "Workflow")} title={t("accounting.workflow.title", "How recognition works")}>
          <ol className="grid gap-3 text-[12px] text-[var(--text-secondary)] sm:grid-cols-2 lg:grid-cols-4">
            <li><strong className="text-[var(--text-highlight)]">{t("accounting.workflow.s1", "1. Pending")}</strong> — {t("accounting.workflow.s1Hint", "operational event happened; no journal yet.")}</li>
            <li><strong className="text-[var(--text-highlight)]">{t("accounting.workflow.s2", "2. Drafted")}</strong> — {t("accounting.workflow.s2Hint", "entry created in draft status, balanced, awaiting review.")}</li>
            <li><strong className="text-[var(--text-highlight)]">{t("accounting.workflow.s3", "3. Posted")}</strong> — {t("accounting.workflow.s3Hint", "entry hit the GL and is now immutable.")}</li>
            <li><strong className="text-[var(--text-highlight)]">{t("accounting.workflow.s4", "4. Voided")}</strong> — {t("accounting.workflow.s4Hint", "original posted entry reversed by a new opposite-side entry.")}</li>
          </ol>
        </DashboardSection>
        <Hairline />
      </div>
    </div>
  );
}

/* ─── Inventory COGS section ─────────────────────────────────
   Reads /api/accounting/inventory-cogs (Phase A.4) and surfaces a
   compact table with Post / Void actions. Mirrors the visual rhythm
   of the main queue but stays in its own component so the existing
   payment/expense flow is untouched. */

interface CogsRow {
  id: string;
  journal_no: string;
  status: "draft" | "posted" | "voided";
  entry_date: string;
  source_id: string | null;
  shipment_no: string | null;
  sales_order_id: string | null;
  total_cost: number;
}

function InventoryCogsSection() {
  const { t } = useTranslation(financeT);
  const [rows, setRows] = useState<CogsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/accounting/inventory-cogs?limit=100", { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error ?? `Failed (${r.status})`));
      setRows((j.entries ?? []) as CogsRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const post = async (id: string) => {
    setBusy(id);
    try {
      const r = await fetch("/api/accounting/post-draft", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: id }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { alert(j.error ?? t("accounting.cogs.postFailed", "Post failed")); return; }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const voidEntry = async (id: string) => {
    if (!confirm(t("accounting.cogs.voidConfirm", "Void this COGS journal? A reversing entry will be posted."))) return;
    const reason = prompt(t("accounting.cogs.reasonPrompt", "Reason (optional):")) ?? "voided from queue";
    setBusy(id);
    try {
      const r = await fetch(`/api/accounting/journals/${id}/void`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error ?? t("accounting.cogs.voidFailed", "Void failed")); return; }
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</div>
      )}
      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <table className="min-w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
              <th className="px-4 py-2 text-left">{t("accounting.cogs.col.journal", "Journal #")}</th>
              <th className="px-4 py-2 text-left">{t("accounting.cogs.col.shipment", "Shipment #")}</th>
              <th className="px-4 py-2 text-left">{t("accounting.cogs.col.date", "Date")}</th>
              <th className="px-4 py-2 text-right">{t("accounting.cogs.col.value", "Inventory value")}</th>
              <th className="px-4 py-2 text-left">{t("accounting.cogs.col.status", "Status")}</th>
              <th className="px-4 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[11px] text-[var(--text-ghost)]">{t("accounting.queue.loading", "Loading…")}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[11px] text-[var(--text-ghost)]">
                {t("accounting.cogs.empty", "No COGS drafts yet. They appear here automatically once a sales shipment is shipped and the operator drafts the entry.")}
              </td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border-faint)] last:border-b-0 hover:bg-[var(--bg-secondary)]">
                  <td className="px-4 py-2 font-mono text-[11.5px] text-[var(--text-highlight)]">{r.journal_no}</td>
                  <td className="px-4 py-2 text-[var(--text-highlight)]">
                    {r.sales_order_id ? (
                      <Link href={`/sales/orders/${r.sales_order_id}`} className="font-mono hover:text-[var(--text-primary)]">{r.shipment_no ?? "—"}</Link>
                    ) : (
                      <span className="font-mono">{r.shipment_no ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-[11px] text-[var(--text-dim)]">{r.entry_date}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono">
                    {Number(r.total_cost).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.10em] ${
                      r.status === "posted" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" :
                      r.status === "voided" ? "border-gray-500/30 bg-gray-500/10 text-[var(--text-secondary)]" :
                                              "border-amber-400/30 bg-amber-500/10 text-amber-200"
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      {r.status === "draft" && (
                        <button
                          onClick={() => post(r.id)}
                          disabled={busy === r.id}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
                        >
                          {t("accounting.queue.btn.post", "Post")}
                        </button>
                      )}
                      {r.status === "posted" && (
                        <button
                          onClick={() => voidEntry(r.id)}
                          disabled={busy === r.id}
                          className="text-[11px] text-rose-300 hover:text-rose-200 disabled:opacity-50"
                        >
                          {t("accounting.queue.btn.void", "Void")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
  const { t } = useTranslation(financeT);
  const isBusy = busy !== null;
  /* Stop the row's onClick from also firing when buttons are tapped. */
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  if (item.accounting_status === "pending") {
    return (
      <button type="button" onClick={(e) => { stop(e); onDraft(); }} disabled={isBusy}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] hover:border-[var(--border-strong)] disabled:opacity-50">
        {t("accounting.queue.btn.draft", "Create draft")}
      </button>
    );
  }
  if (item.accounting_status === "drafted") {
    return (
      <button type="button" onClick={(e) => { stop(e); onPost(); }} disabled={isBusy}
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50">
        {t("accounting.queue.btn.post", "Post")}
      </button>
    );
  }
  if (item.accounting_status === "failed") {
    return (
      <button type="button" onClick={(e) => { stop(e); onRetry(); }} disabled={isBusy}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-500/15 disabled:opacity-50">
        {t("accounting.queue.btn.retry", "Retry")}
      </button>
    );
  }
  if (item.accounting_status === "posted") {
    return (
      <button type="button" onClick={(e) => { stop(e); onVoid(); }} disabled={isBusy}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:border-rose-500/30 hover:text-rose-200 disabled:opacity-50">
        {t("accounting.queue.btn.void", "Void")}
      </button>
    );
  }
  return <span className="text-[10px] text-[var(--text-ghost)]">—</span>;
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
  const { t } = useTranslation(financeT);
  const KIND_LABEL: Record<Kind, string> = {
    payment: t("accounting.queue.kind.payment", "Payment"),
    expense: t("accounting.queue.kind.expense", "Expense"),
    cash_movement: t("accounting.queue.kind.cash", "Bank movement"),
  };
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
    <aside className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-center justify-between">
        <Eyebrow>{t("accounting.queue.review.title", "Review · {kind}").replace("{kind}", KIND_LABEL[item.kind])}</Eyebrow>
        <button type="button" onClick={onClose} className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-highlight)]">{t("accounting.queue.review.close", "Close")}</button>
      </div>
      <div className="mt-3 text-[13px] font-medium">{item.description}</div>
      <div className="mt-1 text-[11px] text-[var(--text-dim)]">
        {item.party_name ?? "—"} · {item.source_date}
      </div>
      <div className="mt-2 font-mono text-[13px] tabular-nums">{fmtMoney(item.amount, item.currency)}</div>

      <div className="mt-3 inline-flex rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
        {item.accounting_status}
      </div>

      {item.accounting_last_error && (
        <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
          {item.accounting_last_error}
        </div>
      )}

      <div className="mt-5">
        <Eyebrow>{t("accounting.queue.review.journalPreview", "Journal preview")}</Eyebrow>
        {drawerLoading ? (
          <div className="mt-2 text-[11px] text-[var(--text-dim)]">{t("accounting.queue.review.loadingJournal", "Loading journal…")}</div>
        ) : !data?.entry ? (
          <div className="mt-2 text-[11px] text-[var(--text-dim)]">{t("accounting.queue.review.noDraft", "No draft yet. Create one from the row above.")}</div>
        ) : (
          <div className="mt-2 space-y-1.5">
            <div className="text-[10px] text-[var(--text-dim)]">
              {data.entry.journal_no} · {data.entry.status}
              {data.entry.posted_at && ` · ${t("accounting.queue.review.postedOn", "posted {date}").replace("{date}", data.entry.posted_at.slice(0, 10))}`}
            </div>
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[9px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                  <th className="py-1 text-left">{t("accounting.queue.review.col.account", "Account")}</th>
                  <th className="py-1 text-right">{t("accounting.queue.review.col.debit", "Debit")}</th>
                  <th className="py-1 text-right">{t("accounting.queue.review.col.credit", "Credit")}</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--border-faint)]">
                    <td className="py-1">
                      <span className="font-mono text-[var(--text-dim)]">{l.account?.code} </span>
                      {l.account?.name}
                    </td>
                    <td className="py-1 text-right tabular-nums font-mono">{Number(l.debit) > 0 ? fmtMoney(Number(l.debit), l.currency).split(" ")[0] : "—"}</td>
                    <td className="py-1 text-right tabular-nums font-mono">{Number(l.credit) > 0 ? fmtMoney(Number(l.credit), l.currency).split(" ")[0] : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border-color)]">
                  <td className="pt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("accounting.queue.review.totals", "Totals")}</td>
                  <td className="pt-1 text-right tabular-nums font-mono">{totalDr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="pt-1 text-right tabular-nums font-mono">{totalCr.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
            <div className={`text-[10px] ${balanced ? "text-emerald-300" : "text-rose-300"}`}>
              {balanced ? t("accounting.queue.review.balanced", "Balanced") : t("accounting.queue.review.imbalance", "Out of balance by {value}").replace("{value}", (totalDr - totalCr).toFixed(2))}
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
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] hover:border-[var(--border-strong)] disabled:opacity-50">
            {t("accounting.queue.btn.draft", "Create draft")}
          </button>
        )}
        {item.accounting_status === "drafted" && item.accounting_entry_id && (
          <button type="button" disabled={busy !== null}
            onClick={async () => { if (await callAction("post-draft", { entry_id: item.accounting_entry_id })) await onAction(); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50">
            {t("accounting.queue.review.postEntry", "Post entry")}
          </button>
        )}
        {item.accounting_status === "failed" && (
          <button type="button" disabled={busy !== null}
            onClick={async () => { if (await callAction("retry", { kind: item.kind, source_id: item.source_id })) await onAction(); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200 hover:bg-amber-500/15 disabled:opacity-50">
            {t("accounting.queue.review.retryRec", "Retry recognition")}
          </button>
        )}
        {data?.entry && (
          <Link
            href={`/finance/accounting/general-ledger?account_id=${data.lines[0]?.account?.code ?? ""}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:text-[var(--text-highlight)]"
          >
            {t("accounting.queue.review.openGL", "Open in GL →")}
          </Link>
        )}
      </div>
    </aside>
  );
}

/* ─── Sales Revenue section (Phase A.5) ───────────────────────
   Same shape as the Inventory COGS section: read the dedicated
   /api/accounting/revenue endpoint, render with Post / Void
   actions, mirror the operational row via the standard journal
   void RPC. */

interface RevenueQueueRow {
  id: string;
  journal_no: string;
  status: "draft" | "posted" | "voided";
  entry_date: string;
  source_id: string | null;
  invoice_no: string | null;
  customer_name: string | null;
  total: number;
}

function SalesRevenueSection() {
  const { t } = useTranslation(financeT);
  const [rows, setRows] = useState<RevenueQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/accounting/revenue?limit=100", { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error ?? `Failed (${r.status})`));
      setRows((j.entries ?? []) as RevenueQueueRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const post = async (id: string) => {
    setBusy(id);
    try {
      const r = await fetch("/api/accounting/post-draft", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: id }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { alert(j.error ?? t("accounting.cogs.postFailed", "Post failed")); return; }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const voidEntry = async (id: string) => {
    if (!confirm(t("accounting.revenue.voidConfirm", "Void this revenue journal? A reversing entry will be posted."))) return;
    const reason = prompt(t("accounting.cogs.reasonPrompt", "Reason (optional):")) ?? "voided from queue";
    setBusy(id);
    try {
      const r = await fetch(`/api/accounting/journals/${id}/void`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error ?? t("accounting.cogs.voidFailed", "Void failed")); return; }
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</div>
      )}
      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <table className="min-w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
              <th className="px-4 py-2 text-left">{t("accounting.cogs.col.journal", "Journal #")}</th>
              <th className="px-4 py-2 text-left">{t("accounting.revenue.col.invoice", "Invoice #")}</th>
              <th className="px-4 py-2 text-left">{t("accounting.revenue.col.customer", "Customer")}</th>
              <th className="px-4 py-2 text-left">{t("accounting.cogs.col.date", "Date")}</th>
              <th className="px-4 py-2 text-right">{t("accounting.revenue.col.total", "Total")}</th>
              <th className="px-4 py-2 text-left">{t("accounting.cogs.col.status", "Status")}</th>
              <th className="px-4 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[var(--text-ghost)]">{t("accounting.queue.loading", "Loading…")}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[var(--text-ghost)]">
                {t("accounting.revenue.empty", "No revenue drafts yet. They appear here once a confirmed invoice is drafted via the API.")}
              </td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border-faint)] last:border-b-0 hover:bg-[var(--bg-secondary)]">
                  <td className="px-4 py-2 font-mono text-[11.5px] text-[var(--text-highlight)]">{r.journal_no}</td>
                  <td className="px-4 py-2 font-mono text-[11.5px] text-[var(--text-highlight)]">{r.invoice_no ?? "—"}</td>
                  <td className="px-4 py-2 text-[var(--text-highlight)]">{r.customer_name ?? "—"}</td>
                  <td className="px-4 py-2 text-[11px] text-[var(--text-dim)]">{r.entry_date}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono">
                    {Number(r.total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.10em] ${
                      r.status === "posted" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" :
                      r.status === "voided" ? "border-gray-500/30 bg-gray-500/10 text-[var(--text-secondary)]" :
                                              "border-amber-400/30 bg-amber-500/10 text-amber-200"
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      {r.status === "draft" && (
                        <button onClick={() => post(r.id)} disabled={busy === r.id}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50">
                          {t("accounting.queue.btn.post", "Post")}
                        </button>
                      )}
                      {r.status === "posted" && (
                        <button onClick={() => voidEntry(r.id)} disabled={busy === r.id}
                          className="text-[11px] text-rose-300 hover:text-rose-200 disabled:opacity-50">
                          {t("accounting.queue.btn.void", "Void")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
