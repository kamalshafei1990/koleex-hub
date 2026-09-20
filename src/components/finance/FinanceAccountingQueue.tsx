"use client";

/* ---------------------------------------------------------------------------
   /finance/accounting/queue

   Every operational document waiting for the books, in one place:
   payments, expenses, bank movements, issued invoices, shipped orders,
   vendor bills, goods receipts, payroll runs and FX exchanges. Five
   status tabs with exact counts, a kind filter, a flat table, a review
   panel for the selected row, bulk draft / post for month-end, and a
   manual journal form for adjustments.

   Workflow:
     pending → (Create draft) → drafted → (Post) → posted → (Void) → voided
     failed  → (Retry)

   The screen owns no accounting logic: every action is one call under
   /api/accounting/. Amounts and dates render through lib/finance/format.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { useTranslation } from "@/lib/i18n";
import { FIN_ACCOUNTING } from "@/lib/translations/finance/accounting";
import { translateAccountName } from "@/lib/translations/finance/account-names";
import RrIcon from "@/components/ui/RrIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import { Eyebrow } from "@/components/finance/FinanceDashboardUi";
import Button from "@/components/kds/Button";
import Checkbox from "@/components/kds/Checkbox";
import ConfirmWithReason from "@/components/kds/ConfirmWithReason";
import FormModal from "@/components/kds/FormModal";
import StatusPill from "@/components/kds/StatusPill";
import { useToast } from "@/components/kds/useToast";
import { humanizeError } from "@/lib/ui/humanize-error";
import { fmtAccounting, fmtAccountingMoney, fmtDMY, todayIso } from "@/lib/finance/format";
import type { AccountingAccount } from "@/lib/accounting/types";

type QueueStatus = "pending" | "drafted" | "posted" | "failed" | "voided";
type Kind =
  | "payment" | "expense" | "cash_movement" | "sales_revenue" | "inventory_cogs"
  | "vendor_bill" | "inventory_receipt" | "payroll" | "fx_exchange";

interface QueueItem {
  kind: Kind;
  source_id: string;
  reference: string | null;
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
  href: string | null;
}

interface QueueResponse {
  items: QueueItem[];
  counts: Record<QueueStatus, number>;
  counts_by_kind: Partial<Record<Kind, number>>;
  kinds: Kind[];
}

interface JournalLine {
  id: string;
  line_index: number;
  debit: number | string;
  credit: number | string;
  currency: string;
  exchange_rate?: number | string | null;
  description: string | null;
  account: { code: string; name: string; type: string; normal_balance: string } | null;
}

interface ReviewResponse {
  source: Record<string, unknown> | null;
  entry: { id: string; journal_no: string; status: string; entry_date: string; description: string | null; posted_at: string | null } | null;
  lines: JournalLine[];
}

const TABS: QueueStatus[] = ["pending", "drafted", "failed", "posted", "voided"];
const KINDS: Kind[] = ["payment", "expense", "cash_movement", "sales_revenue", "inventory_cogs", "vendor_bill", "inventory_receipt", "payroll", "fx_exchange"];
const EMPTY_COUNTS: Record<QueueStatus, number> = { pending: 0, drafted: 0, posted: 0, failed: 0, voided: 0 };

const STATUS_TONE: Record<QueueStatus, "neutral" | "brand" | "success" | "warning" | "error"> = {
  pending: "neutral", drafted: "brand", posted: "success", failed: "error", voided: "warning",
};

const rowKey = (it: { kind: Kind; source_id: string }) => `${it.kind}:${it.source_id}`;

async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T & { error?: string } }> {
  const res = await fetch(path, { credentials: "include", cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, body };
}

export default function FinanceAccountingQueue() {
  const { t } = useTranslation(FIN_ACCOUNTING);
  const { showToast, toastElement } = useToast();

  const TAB_LABEL: Record<QueueStatus, string> = {
    pending: t("accounting.queue.tab.pending", "Pending"),
    drafted: t("accounting.queue.tab.drafted", "Drafted"),
    failed:  t("accounting.queue.tab.failed", "Failed"),
    posted:  t("accounting.queue.tab.posted", "Posted"),
    voided:  t("accounting.queue.tab.voided", "Voided"),
  };
  const KIND_LABEL: Record<Kind, string> = {
    payment:           t("accounting.queue.kind.payment", "Payment"),
    expense:           t("accounting.queue.kind.expense", "Expense"),
    cash_movement:     t("accounting.queue.kind.cash", "Bank movement"),
    sales_revenue:     t("accounting.queue.kind.invoice", "Invoice"),
    inventory_cogs:    t("accounting.queue.kind.cogs", "Shipment (COGS)"),
    vendor_bill:       t("accounting.queue.kind.bill", "Vendor bill"),
    inventory_receipt: t("accounting.queue.kind.receipt", "Goods receipt"),
    payroll:           t("accounting.queue.kind.payroll", "Payroll"),
    fx_exchange:       t("accounting.queue.kind.fx", "FX exchange"),
  };

  const [active, setActive] = useState<QueueStatus>("pending");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<Record<QueueStatus, number>>(EMPTY_COUNTS);
  const [countsByKind, setCountsByKind] = useState<Partial<Record<Kind, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [voidAsk, setVoidAsk] = useState<QueueItem | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);

  /* One request: rows for the active tab + exact counts for every tab. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ status: active, limit: "200" });
      if (kind !== "all") qs.set("kind", kind);
      const r = await api<QueueResponse>(`/api/accounting/queue?${qs}`);
      if (!r.ok) { setError(humanizeError(r.body.error ?? `Failed (${r.status})`)); return; }
      setItems(r.body.items ?? []);
      /* Counts come from the whole tenant only when no kind filter is
         applied; a filtered call would shrink the tab badges. */
      if (kind === "all") { setCounts(r.body.counts ?? EMPTY_COUNTS); setCountsByKind(r.body.counts_by_kind ?? {}); }
      else setCounts(r.body.counts ?? EMPTY_COUNTS);
      setChecked(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [active, kind]);
  useEffect(() => { void load(); }, [load]);

  /* Keep the review panel on a row that still exists after a reload. */
  useEffect(() => {
    if (!selected) return;
    const still = items.find((it) => rowKey(it) === rowKey(selected));
    setSelected(still ?? null);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = useCallback(async (path: string, body: Record<string, unknown>, okMsg: string): Promise<boolean> => {
    setBusy(true);
    try {
      const r = await api(path, { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) { showToast(humanizeError(r.body.error ?? `Failed (${r.status})`), "error"); return false; }
      showToast(okMsg, "success");
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }, [load, showToast]);

  const doDraft = (it: QueueItem) => act("/api/accounting/draft", { kind: it.kind, source_id: it.source_id }, t("accounting.queue.toast.drafted", "Draft created"));
  const doPost  = (it: QueueItem) => it.accounting_entry_id ? act("/api/accounting/post-draft", { entry_id: it.accounting_entry_id }, t("accounting.queue.toast.posted", "Posted to the ledger")) : Promise.resolve(false);
  const doRetry = (it: QueueItem) => act("/api/accounting/retry", { kind: it.kind, source_id: it.source_id }, t("accounting.queue.toast.posted", "Posted to the ledger"));
  const doVoid  = (it: QueueItem, reason: string) => it.accounting_entry_id
    ? act(`/api/accounting/journals/${it.accounting_entry_id}/void`, { reason: reason || "voided from queue" }, t("accounting.queue.toast.voided", "Entry reversed"))
    : Promise.resolve(false);

  /* Bulk: the month-end button. Draft everything pending, post everything drafted, retry the failed. */
  const bulkAction: "draft" | "post" | "retry" | null = active === "pending" ? "draft" : active === "drafted" ? "post" : active === "failed" ? "retry" : null;
  const runBulk = async () => {
    if (!bulkAction || checked.size === 0) return;
    setBusy(true);
    try {
      const picked = items.filter((it) => checked.has(rowKey(it))).map((it) => ({ kind: it.kind, source_id: it.source_id }));
      const r = await api<{ succeeded: number; failed: number }>("/api/accounting/bulk", { method: "POST", body: JSON.stringify({ action: bulkAction, items: picked }) });
      if (!r.ok) { showToast(humanizeError(r.body.error ?? `Failed (${r.status})`), "error"); return; }
      const msg = t("accounting.queue.toast.bulk", "{ok} done · {failed} need attention")
        .replace("{ok}", String(r.body.succeeded ?? 0)).replace("{failed}", String(r.body.failed ?? 0));
      showToast(msg, (r.body.failed ?? 0) > 0 ? "error" : "success");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const allChecked = items.length > 0 && items.every((it) => checked.has(rowKey(it)));
  const toggleAll = (v: boolean) => setChecked(v ? new Set(items.map(rowKey)) : new Set());
  const toggleOne = (it: QueueItem, v: boolean) => setChecked((prev) => { const n = new Set(prev); if (v) n.add(rowKey(it)); else n.delete(rowKey(it)); return n; });

  const BULK_LABEL: Record<"draft" | "post" | "retry", string> = {
    draft: t("accounting.queue.bulk.draft", "Draft selected"),
    post:  t("accounting.queue.bulk.post", "Post selected"),
    retry: t("accounting.queue.bulk.retry", "Retry selected"),
  };

  const kindChips = useMemo(() => KINDS.filter((k) => (countsByKind[k] ?? 0) > 0 || k === kind), [countsByKind, kind]);

  return (
    <div className="min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {toastElement}
      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-6 sm:px-6">
        <FinanceHeader
          title={t("accounting.queue.title", "Accounting Queue")}
          subtitle={t("accounting.queue.subtitle.long", "Operational events awaiting recognition. Create a draft, review, post.")}
          action={
            <>
              <Button variant="secondary" onClick={() => setJournalOpen(true)} aria-label={t("accounting.queue.newJournal", "New journal entry")}>
                <RrIcon name="contract" size={13} />
                {t("accounting.queue.newJournal", "New journal entry")}
              </Button>
              <Link
                href="/finance/accounting/trial-balance"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 text-[13px] font-semibold text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--text-primary)]"
              >
                <RrIcon name="badge-check" size={12} />
                {t("accounting.queue.trialBalance", "Trial Balance")}
              </Link>
            </>
          }
        />

        {/* Status tabs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border-subtle)] pb-2">
          {TABS.map((key) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setActive(key); setSelected(null); }}
                className={`relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${isActive ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-highlight)]"}`}
              >
                {isActive && <span aria-hidden className="pointer-events-none absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-[var(--bg-inverted)]/40" />}
                {TAB_LABEL[key]}
                <span className="text-[10px] tabular-nums text-[var(--text-dim)]">{counts[key]}</span>
              </button>
            );
          })}
        </div>

        {/* Kind filter + bulk toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <KindChip active={kind === "all"} onClick={() => setKind("all")} label={t("accounting.queue.kind.all", "All kinds")} />
          {kindChips.map((k) => (
            <KindChip key={k} active={kind === k} onClick={() => setKind(k)} label={KIND_LABEL[k]} count={countsByKind[k]} />
          ))}
          <div className="ms-auto flex items-center gap-2">
            {bulkAction && (
              <Button variant="secondary" disabled={busy || checked.size === 0} onClick={() => void runBulk()} className="h-8 px-3 text-[12px]">
                {BULK_LABEL[bulkAction]}{checked.size > 0 ? ` (${checked.size})` : ""}
              </Button>
            )}
            <Button variant="iconSecondary" onClick={() => void load()} disabled={loading} aria-label={t("accounting.queue.refresh", "Refresh")} title={t("accounting.queue.refresh", "Refresh")}>
              <RefreshCwIcon size={14} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-600 dark:text-rose-300">{error}</div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="kx-glass overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            {loading && items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11px] text-[var(--text-dim)]">{t("accounting.queue.loading", "Loading…")}</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Eyebrow>{t("accounting.queue.emptyTitle", "No {status} items").replace("{status}", TAB_LABEL[active].toLowerCase())}</Eyebrow>
                <p className="mt-2 text-[12px] text-[var(--text-dim)]">
                  {active === "pending"
                    ? t("accounting.queue.empty.pending", "All operational events have been recognised or drafted.")
                    : t("accounting.queue.empty.other", "Nothing to review in this state.")}
                </p>
              </div>
            ) : (
              <table className="min-w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[9px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    <th className="w-8 px-3 py-2">
                      {bulkAction && <Checkbox checked={allChecked} onChange={toggleAll} aria-label={t("accounting.queue.selectAll", "Select all")} />}
                    </th>
                    <th className="px-3 py-2 text-start">{t("accounting.queue.col.kind", "Kind")}</th>
                    <th className="px-3 py-2 text-start">{t("accounting.queue.col.ref", "Ref")}</th>
                    <th className="px-3 py-2 text-start">{t("accounting.queue.col.desc", "Description")}</th>
                    <th className="px-3 py-2 text-start">{t("accounting.queue.col.party", "Party")}</th>
                    <th className="px-3 py-2 text-end">{t("accounting.queue.col.amount", "Amount")}</th>
                    <th className="px-3 py-2 text-start">{t("accounting.queue.col.date", "Date")}</th>
                    <th className="px-3 py-2 text-end">{t("accounting.queue.col.actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const isSelected = selected ? rowKey(selected) === rowKey(it) : false;
                    return (
                      <tr
                        key={rowKey(it)}
                        onClick={() => setSelected(it)}
                        className={`cursor-pointer border-b border-[var(--border-faint)] transition-colors ${isSelected ? "bg-[var(--bg-surface)]" : "hover:bg-[var(--bg-surface-subtle)]"}`}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          {bulkAction && <Checkbox checked={checked.has(rowKey(it))} onChange={(v) => toggleOne(it, v)} />}
                        </td>
                        <td className="px-3 py-2 text-[11px] uppercase tracking-[0.10em] text-[var(--text-secondary)]">{KIND_LABEL[it.kind]}</td>
                        <td className="px-3 py-2 font-mono text-[11.5px] text-[var(--text-highlight)]">{it.reference ?? "—"}</td>
                        <td className="px-3 py-2">
                          <div>{it.description}</div>
                          {it.accounting_last_error && <div className="mt-0.5 text-[10.5px] text-rose-600 dark:text-rose-300">{it.accounting_last_error}</div>}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{it.party_name ?? "—"}</td>
                        <td className="px-3 py-2 text-end font-mono tabular-nums">{it.currency ? fmtAccountingMoney(it.amount, it.currency) : "—"}</td>
                        <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{fmtDMY(it.source_date)}</td>
                        <td className="px-3 py-2 text-end" onClick={(e) => e.stopPropagation()}>
                          <RowAction item={it} busy={busy} onDraft={() => void doDraft(it)} onPost={() => void doPost(it)} onRetry={() => void doRetry(it)} onVoid={() => setVoidAsk(it)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {selected ? (
            <ReviewPanel
              item={selected}
              kindLabel={KIND_LABEL[selected.kind]}
              busy={busy}
              onClose={() => setSelected(null)}
              onDraft={() => void doDraft(selected)}
              onPost={() => void doPost(selected)}
              onRetry={() => void doRetry(selected)}
              onVoid={() => setVoidAsk(selected)}
            />
          ) : (
            <div className="hidden kx-glass rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-12 text-center lg:block">
              <Eyebrow>{t("accounting.queue.review.panel", "Review panel")}</Eyebrow>
              <p className="mt-2 text-[12px] text-[var(--text-dim)]">{t("accounting.queue.review.empty", "Select an item to view its operational source and journal draft.")}</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmWithReason
        open={voidAsk !== null}
        title={t("accounting.queue.voidPrompt", "Reason for voiding this entry?")}
        reasonPlaceholder={t("accounting.cogs.reasonPrompt", "Reason (optional):")}
        confirmLabel={t("accounting.queue.btn.void", "Void")}
        onCancel={() => setVoidAsk(null)}
        onConfirm={(reason) => { const it = voidAsk; setVoidAsk(null); if (it) void doVoid(it, reason); }}
      />

      <ManualJournalModal
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
        onSaved={() => { setJournalOpen(false); void load(); }}
      />
    </div>
  );
}

/* ─── Kind chip ────────────────────────────────────────────────── */

function KindChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors ${
        active
          ? "border-[var(--border-focus)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
          : "border-[var(--border-subtle)] bg-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)]"
      }`}
    >
      {label}
      {typeof count === "number" && <span className="tabular-nums text-[10px] text-[var(--text-dim)]">{count}</span>}
    </button>
  );
}

/* ─── Row action ───────────────────────────────────────────────── */

function RowAction({ item, busy, onDraft, onPost, onRetry, onVoid }: {
  item: QueueItem; busy: boolean; onDraft: () => void; onPost: () => void; onRetry: () => void; onVoid: () => void;
}) {
  const { t } = useTranslation(FIN_ACCOUNTING);
  const base = "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors disabled:opacity-50";
  switch (item.accounting_status) {
    case "pending":
      return <button type="button" onClick={onDraft} disabled={busy} className={`${base} border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text-primary)]`}>{t("accounting.queue.btn.draft", "Create draft")}</button>;
    case "drafted":
      return <button type="button" onClick={onPost} disabled={busy || !item.accounting_entry_id} className={`${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-200`}>{t("accounting.queue.btn.post", "Post")}</button>;
    case "failed":
      return <button type="button" onClick={onRetry} disabled={busy} className={`${base} border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-200`}>{t("accounting.queue.btn.retry", "Retry")}</button>;
    case "posted":
      return <button type="button" onClick={onVoid} disabled={busy} className={`${base} border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-rose-500/30 hover:text-rose-700 dark:hover:text-rose-200`}>{t("accounting.queue.btn.void", "Void")}</button>;
    default:
      return <span className="text-[10px] text-[var(--text-ghost)]">—</span>;
  }
}

/* ─── Review panel ─────────────────────────────────────────────── */

function ReviewPanel({ item, kindLabel, busy, onClose, onDraft, onPost, onRetry, onVoid }: {
  item: QueueItem; kindLabel: string; busy: boolean; onClose: () => void;
  onDraft: () => void; onPost: () => void; onRetry: () => void; onVoid: () => void;
}) {
  const { t, lang } = useTranslation(FIN_ACCOUNTING);
  /* The answer is keyed by what was asked, so "loading" is simply "the
     answer on hand is not for the current row" — no flag to keep in step. */
  const reviewKey = `${item.kind}:${item.source_id}:${item.accounting_status}:${item.accounting_entry_id ?? ""}`;
  const [answer, setAnswer] = useState<{ key: string; body: ReviewResponse | null } | null>(null);
  const data = answer?.key === reviewKey ? answer.body : null;
  const loading = answer?.key !== reviewKey;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await api<ReviewResponse>(`/api/accounting/queue/${item.kind}/${encodeURIComponent(item.source_id)}`);
      if (!cancelled) setAnswer({ key: reviewKey, body: r.ok ? r.body : null });
    })();
    return () => { cancelled = true; };
  }, [item.kind, item.source_id, reviewKey]);

  const totalDr = (data?.lines ?? []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = (data?.lines ?? []).reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.005;
  const firstAccountCode = data?.lines[0]?.account?.code;

  return (
    <aside className="kx-glass rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-center justify-between">
        <Eyebrow>{t("accounting.queue.review.title", "Review · {kind}").replace("{kind}", kindLabel)}</Eyebrow>
        <button type="button" onClick={onClose} aria-label={t("accounting.queue.review.close", "Close")} className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-highlight)]">{t("accounting.queue.review.close", "Close")}</button>
      </div>
      <div className="mt-3 text-[13px] font-medium">{item.reference ? <span className="font-mono">{item.reference} · </span> : null}{item.description}</div>
      <div className="mt-1 text-[11px] text-[var(--text-dim)]">{item.party_name ?? "—"} · {fmtDMY(item.source_date)}</div>
      {item.currency && <div className="mt-2 font-mono text-[13px] tabular-nums">{fmtAccountingMoney(item.amount, item.currency)}</div>}
      <div className="mt-3 flex items-center gap-2">
        <StatusPill tone={STATUS_TONE[item.accounting_status]}>{item.accounting_status}</StatusPill>
        {item.href && (
          <Link href={item.href} className="text-[11px] text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-highlight)] hover:underline">
            {t("accounting.queue.review.openSource", "Open source document")}
          </Link>
        )}
      </div>

      {item.accounting_last_error && (
        <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-600 dark:text-rose-300">{item.accounting_last_error}</div>
      )}

      <div className="mt-5">
        <Eyebrow>{t("accounting.queue.review.journalPreview", "Journal preview")}</Eyebrow>
        {loading ? (
          <div className="mt-2 text-[11px] text-[var(--text-dim)]">{t("accounting.queue.review.loadingJournal", "Loading journal…")}</div>
        ) : !data?.entry ? (
          <div className="mt-2 text-[11px] text-[var(--text-dim)]">{t("accounting.queue.review.noDraft", "No draft yet. Create one from the row above.")}</div>
        ) : (
          <div className="mt-2 space-y-1.5">
            <div className="font-mono text-[10px] text-[var(--text-dim)]">
              {data.entry.journal_no} · {fmtDMY(data.entry.entry_date)}
              {data.entry.posted_at && ` · ${t("accounting.queue.review.postedOn", "posted {date}").replace("{date}", fmtDMY(data.entry.posted_at))}`}
            </div>
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[9px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                  <th className="py-1 text-start">{t("accounting.queue.review.col.account", "Account")}</th>
                  <th className="py-1 text-end">{t("accounting.queue.review.col.debit", "Debit")}</th>
                  <th className="py-1 text-end">{t("accounting.queue.review.col.credit", "Credit")}</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--border-faint)]">
                    <td className="py-1">
                      <span className="font-mono text-[var(--text-dim)]">{l.account?.code} </span>
                      {l.account ? translateAccountName(l.account.code, l.account.name, lang) : "—"}
                      {l.currency && Number(l.exchange_rate ?? 1) !== 1 && <span className="ms-1 text-[10px] text-[var(--text-dim)]">{l.currency} @ {Number(l.exchange_rate).toFixed(4)}</span>}
                    </td>
                    <td className="py-1 text-end font-mono tabular-nums">{fmtAccounting(l.debit)}</td>
                    <td className="py-1 text-end font-mono tabular-nums">{fmtAccounting(l.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border-color)]">
                  <td className="pt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("accounting.queue.review.totals", "Totals")}</td>
                  <td className="pt-1 text-end font-mono tabular-nums">{fmtAccounting(totalDr)}</td>
                  <td className="pt-1 text-end font-mono tabular-nums">{fmtAccounting(totalCr)}</td>
                </tr>
              </tfoot>
            </table>
            <div className={`text-[10px] ${balanced ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
              {balanced ? t("accounting.queue.review.balanced", "Balanced") : t("accounting.queue.review.imbalance", "Out of balance by {value}").replace("{value}", (totalDr - totalCr).toFixed(2))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {item.accounting_status === "pending" && <Button variant="secondary" disabled={busy} onClick={onDraft}>{t("accounting.queue.btn.draft", "Create draft")}</Button>}
        {item.accounting_status === "drafted" && item.accounting_entry_id && <Button variant="primary" disabled={busy} onClick={onPost}>{t("accounting.queue.review.postEntry", "Post entry")}</Button>}
        {item.accounting_status === "failed" && <Button variant="secondary" disabled={busy} onClick={onRetry}>{t("accounting.queue.review.retryRec", "Retry recognition")}</Button>}
        {item.accounting_status === "posted" && <Button variant="ghost" disabled={busy} onClick={onVoid}>{t("accounting.queue.btn.void", "Void")}</Button>}
        {data?.entry && firstAccountCode && (
          <Link
            href={`/finance/accounting/general-ledger?account_code=${encodeURIComponent(firstAccountCode)}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-medium text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
          >
            {t("accounting.queue.review.openGL", "Open in GL →")}
          </Link>
        )}
      </div>
    </aside>
  );
}

/* ─── Manual journal entry ─────────────────────────────────────── */

interface DraftLine { account_id: string; debit: string; credit: string; description: string }
const emptyLine = (): DraftLine => ({ account_id: "", debit: "", credit: "", description: "" });

function ManualJournalModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useTranslation(FIN_ACCOUNTING);
  const { showToast, toastElement } = useToast();
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || accounts.length) return;
    void (async () => {
      const r = await api<{ accounts: AccountingAccount[] }>("/api/accounting/accounts");
      if (r.ok) setAccounts((r.body.accounts ?? []).filter((a) => a.is_active));
    })();
  }, [open, accounts.length]);

  useEffect(() => {
    if (open) { setDate(todayIso()); setDescription(""); setLines([emptyLine(), emptyLine()]); }
  }, [open]);

  const totalDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const diff = +(totalDr - totalCr).toFixed(2);
  const complete = lines.filter((l) => l.account_id && ((Number(l.debit) || 0) > 0) !== ((Number(l.credit) || 0) > 0)).length >= 2;
  const canSave = complete && diff === 0 && totalDr > 0 && !saving;

  const update = (i: number, patch: Partial<DraftLine>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLines((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));

  const save = async (post: boolean) => {
    setSaving(true);
    try {
      const payload = {
        entry_date: date,
        description: description.trim() || null,
        post,
        lines: lines
          .filter((l) => l.account_id && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0))
          .map((l) => ({ account_id: l.account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description.trim() || null })),
      };
      const r = await api<{ journal_no?: string }>("/api/accounting/journals", { method: "POST", body: JSON.stringify(payload) });
      if (!r.ok) { showToast(humanizeError(r.body.error ?? `Failed (${r.status})`), "error"); return; }
      showToast((post ? t("accounting.journal.toast.posted", "Journal {no} posted") : t("accounting.journal.toast.drafted", "Journal {no} saved as draft")).replace("{no}", r.body.journal_no ?? ""), "success");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t("accounting.journal.title", "New journal entry")}
      subtitle={t("accounting.journal.subtitle", "An adjusting entry typed by the accountant. Debits must equal credits; the date must be in an open period.")}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t("accounting.journal.cancel", "Cancel")}</Button>
          <Button variant="secondary" onClick={() => void save(false)} disabled={!canSave}>{t("accounting.journal.saveDraft", "Save draft")}</Button>
          <Button variant="primary" onClick={() => void save(true)} disabled={!canSave}>{t("accounting.journal.post", "Post")}</Button>
        </>
      }
    >
      {toastElement}
      <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
        <label className="block">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("accounting.journal.date", "Date")}</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("accounting.journal.description", "Description")}</div>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("accounting.journal.descriptionPh", "e.g. Accrued rent for September")} className={inputCls} />
        </label>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[9px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              <th className="py-1.5 pe-2 text-start">{t("accounting.queue.review.col.account", "Account")}</th>
              <th className="w-32 py-1.5 pe-2 text-end">{t("accounting.queue.review.col.debit", "Debit")}</th>
              <th className="w-32 py-1.5 pe-2 text-end">{t("accounting.queue.review.col.credit", "Credit")}</th>
              <th className="py-1.5 pe-2 text-start">{t("accounting.journal.lineMemo", "Memo")}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-[var(--border-faint)]">
                <td className="py-1.5 pe-2">
                  <select value={l.account_id} onChange={(e) => update(i, { account_id: e.target.value })} className={inputCls} aria-label={t("accounting.queue.review.col.account", "Account")}>
                    <option value="">{t("accounting.journal.pickAccount", "Pick an account…")}</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} — {translateAccountName(a.code, a.name, lang)}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 pe-2">
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={l.debit} onChange={(e) => update(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} className={`${inputCls} text-end font-mono tabular-nums`} aria-label={t("accounting.queue.review.col.debit", "Debit")} />
                </td>
                <td className="py-1.5 pe-2">
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={l.credit} onChange={(e) => update(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} className={`${inputCls} text-end font-mono tabular-nums`} aria-label={t("accounting.queue.review.col.credit", "Credit")} />
                </td>
                <td className="py-1.5 pe-2">
                  <input value={l.description} onChange={(e) => update(i, { description: e.target.value })} className={inputCls} aria-label={t("accounting.journal.lineMemo", "Memo")} />
                </td>
                <td className="py-1.5">
                  <button type="button" onClick={() => remove(i)} disabled={lines.length <= 2} aria-label={t("accounting.journal.removeLine", "Remove line")} className="h-8 w-8 rounded-lg text-[var(--text-ghost)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:opacity-30">×</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                <button type="button" onClick={() => setLines((p) => [...p, emptyLine()])} className="text-[11px] normal-case tracking-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  + {t("accounting.journal.addLine", "Add line")}
                </button>
              </td>
              <td className="pt-2 pe-2 text-end font-mono tabular-nums">{fmtAccounting(totalDr)}</td>
              <td className="pt-2 pe-2 text-end font-mono tabular-nums">{fmtAccounting(totalCr)}</td>
              <td className={`pt-2 text-[11px] ${diff === 0 && totalDr > 0 ? "text-emerald-600 dark:text-emerald-300" : "text-[var(--text-dim)]"}`} colSpan={2}>
                {totalDr === 0 && totalCr === 0
                  ? ""
                  : diff === 0
                    ? t("accounting.queue.review.balanced", "Balanced")
                    : t("accounting.queue.review.imbalance", "Out of balance by {value}").replace("{value}", diff.toFixed(2))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </FormModal>
  );
}
