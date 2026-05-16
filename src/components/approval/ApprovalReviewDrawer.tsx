"use client";

/* ===========================================================================
   ApprovalReviewDrawer  —  Phase 2.2

   Right-side drawer that hosts the entire approval workflow for one
   expense. Mirrors the AttachmentPreviewDrawer in visual language.

     · Header: title · ApprovalBadge · EvidenceBadge · amount
     · Body:   compact expense detail block · approval history timeline
     · Footer: quick actions, surfaced only when the action is legal
                from the current state-machine state.

   Permissions are enforced server-side; the drawer shows or hides
   buttons optimistically based on `canApprove` passed by the caller.
   ========================================================================== */

import { useCallback, useEffect, useState } from "react";
import type {
  ApprovalAction,
  ApprovalStatus,
  FinanceApprovalHistoryEntry,
  FinanceAttachment,
  FinanceExpense,
} from "@/lib/finance/types";
import { ApprovalBadge } from "./ApprovalBadge";
import { EvidenceBadge } from "@/components/attachments/EvidenceBadge";
import { fmtMoney } from "@/lib/finance/calc";
import { isImageMime, isPdfMime } from "@/lib/attachments/client";

interface Props {
  open: boolean;
  onClose: () => void;
  expense: FinanceExpense | null;
  /** Caller flag — true for users with Finance module access. */
  canApprove: boolean;
  /** Re-fetch parent list after a state change. */
  onChange?: (expense: FinanceExpense) => void;
}

export default function ApprovalReviewDrawer({
  open, onClose, expense, canApprove, onChange,
}: Props) {
  const [history, setHistory] = useState<FinanceApprovalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<ApprovalAction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonMode, setReasonMode] = useState<null | "reject" | "request_changes">(null);
  const [error, setError] = useState<string | null>(null);
  /* UX-validation pass: attachments load inline so the reviewer can
     see the actual receipt without closing this drawer and opening
     the evidence drawer separately. Eliminates drawer-switching for
     the manager flow. */
  const [attachments, setAttachments] = useState<FinanceAttachment[]>([]);
  const [activeAttachmentIdx, setActiveAttachmentIdx] = useState(0);
  /* Once-per-mount timestamp — used for badge "Xd waiting" math without
     calling Date.now() during render. */
  const [nowMs] = useState<number>(() => Date.now());

  /* Load history + attachments in parallel whenever a new expense
     opens. Embedded receipts are a key UX improvement — the reviewer
     reads the proof and the audit trail in one pass, no drawer
     switching. */
  useEffect(() => {
    if (!open || !expense?.id) return;
    let cancelled = false;
    setLoading(true);
    setActiveAttachmentIdx(0);
    void Promise.all([
      fetch(`/api/finance/expenses/${expense.id}/approval`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/finance/attachments?entity_type=expense&entity_id=${expense.id}`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([histJson, attJson]) => {
        if (cancelled) return;
        setHistory((histJson?.history ?? []) as FinanceApprovalHistoryEntry[]);
        setAttachments((attJson?.attachments ?? []) as FinanceAttachment[]);
      })
      .catch(() => {
        if (cancelled) return;
        setHistory([]);
        setAttachments([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, expense?.id]);

  const performAction = useCallback(async (action: ApprovalAction, notes?: string) => {
    if (!expense) return;
    setActing(action);
    setError(null);
    try {
      const res = await fetch(`/api/finance/expenses/${expense.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });
      const body = (await res.json()) as { expense?: FinanceExpense; error?: string };
      if (!res.ok || !body.expense) {
        setError(body.error ?? "Action failed");
        return;
      }
      onChange?.(body.expense);
      /* Refresh history. */
      const hr = await fetch(`/api/finance/expenses/${expense.id}/approval`, { cache: "no-store" });
      const hj = await hr.json();
      setHistory((hj.history ?? []) as FinanceApprovalHistoryEntry[]);
      setReasonMode(null);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  }, [expense, onChange]);

  if (!open || !expense) return null;
  const status: ApprovalStatus = (expense.approval_status ?? "draft") as ApprovalStatus;

  const ageDays = (() => {
    const ts = expense.submitted_at ?? expense.reviewed_at;
    if (!ts) return undefined;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return undefined;
    return Math.max(0, Math.floor((nowMs - d.getTime()) / 86_400_000));
  })();

  /* State-machine driven button visibility. */
  const canSubmit          = status === "draft" || status === "requires_changes" || status === "rejected";
  const canApproveNow      = canApprove && (status === "submitted" || status === "under_review" || status === "requires_changes" || status === "partially_approved");
  const canReject          = canApprove && (status === "submitted" || status === "under_review");
  const canRequestChanges  = canApprove && (status === "submitted" || status === "under_review");
  const canReset           = canApprove && status !== "draft";

  return (
    <div className="fixed inset-0 z-[200] flex">
      <button aria-label="Close" onClick={onClose} className="flex-1 bg-black/30 backdrop-blur-[2px]" />

      <aside className="flex h-full w-full flex-col border-l border-white/[0.06] bg-[var(--bg-primary)] shadow-[-12px_0_48px_-12px_rgba(0,0,0,0.6)] sm:max-w-[560px]">
        {/* Header */}
        <header className="flex items-start gap-3 border-b border-white/[0.05] px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Approval</div>
            <div className="mt-0.5 truncate text-[14px] font-medium text-[var(--text-primary)]">
              {expense.title || "Expense"}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <ApprovalBadge status={status} ageDays={ageDays} withTip />
              <EvidenceBadge status={expense.evidence_status} receiptCount={expense.receipt_count} compact withTip />
              <span className="text-[10px] text-gray-500">
                {fmtMoney(Number(expense.amount) || 0, expense.currency, { compact: true })} · {expense.expense_date}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-gray-100"
            aria-label="Close drawer"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Compact expense detail */}
          <section className="rounded-xl border border-white/[0.05] bg-white/[0.012] p-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Detail</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
              <DetailRow label="Category" value={expense.category_name ?? "—"} />
              <DetailRow label="Payment status" value={expense.payment_status} />
              {expense.linked_order_id && <DetailRow label="Linked order" value={expense.linked_order_id.slice(0, 8) + "…"} mono />}
              {expense.due_date && <DetailRow label="Due" value={expense.due_date} />}
              {expense.linked_supplier_id && <DetailRow label="Supplier" value={expense.linked_supplier_id} />}
            </dl>
            {expense.notes && (
              <div className="mt-2 rounded-lg border border-white/[0.04] bg-white/[0.012] p-2 text-[11px] text-gray-400">{expense.notes}</div>
            )}
            {(expense.rejection_reason || expense.requires_changes_reason) && (
              <div className={
                "mt-2 rounded-lg border px-2.5 py-2 text-[11px] " +
                (expense.rejection_reason
                  ? "border-rose-500/[0.22] bg-rose-500/[0.04] text-rose-200/90"
                  : "border-amber-500/[0.22] bg-amber-500/[0.04] text-amber-200/90")
              }>
                <div className="text-[9px] uppercase tracking-[0.18em] opacity-70 mb-0.5">
                  {expense.rejection_reason ? "Reason for rejection" : "Changes requested"}
                </div>
                {expense.rejection_reason ?? expense.requires_changes_reason}
              </div>
            )}
          </section>

          {/* ── Inline evidence preview — the reviewer reads the proof
                without leaving this drawer. Thumbnail strip up top
                + inline image/PDF of the active selection beneath. */}
          {attachments.length > 0 && (
            <section className="rounded-xl border border-white/[0.05] bg-white/[0.012] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">
                  Evidence · {attachments.length} file{attachments.length === 1 ? "" : "s"}
                </div>
                {attachments[activeAttachmentIdx]?.signed_url && (
                  <a
                    href={attachments[activeAttachmentIdx].signed_url!}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[10px] text-gray-300 hover:text-white"
                  >
                    Open full →
                  </a>
                )}
              </div>
              {attachments.length > 1 && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto">
                  {attachments.map((a, i) => {
                    const isImg = isImageMime(a.file_type);
                    const active = i === activeAttachmentIdx;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setActiveAttachmentIdx(i)}
                        className={
                          "h-12 w-12 shrink-0 overflow-hidden rounded-md border transition-colors " +
                          (active ? "border-white/[0.25] bg-white/[0.06]" : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.12]")
                        }
                        title={a.file_name}
                      >
                        {isImg && a.signed_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.signed_url} alt={a.file_name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[9px] font-semibold tracking-wider text-gray-400">
                            {isPdfMime(a.file_type) ? "PDF" : "FILE"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {(() => {
                const active = attachments[activeAttachmentIdx];
                if (!active || !active.signed_url) return null;
                if (isImageMime(active.file_type)) {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={active.signed_url}
                      alt={active.file_name}
                      className="mt-2 max-h-[360px] w-full rounded-md bg-black/40 object-contain"
                    />
                  );
                }
                if (isPdfMime(active.file_type)) {
                  return (
                    <iframe
                      src={active.signed_url}
                      className="mt-2 h-[360px] w-full rounded-md bg-black/40"
                      title={active.file_name}
                    />
                  );
                }
                return (
                  <div className="mt-2 rounded-md bg-black/30 px-3 py-4 text-center text-[11px] text-gray-500">
                    Inline preview not available. Open the file in a new tab.
                  </div>
                );
              })()}
            </section>
          )}

          {/* Approval history timeline */}
          <section>
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-2">Approval history</div>
            {loading ? (
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.012] px-3 py-4 text-center text-[11px] text-gray-500">Loading…</div>
            ) : history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] px-3 py-4 text-center text-[11px] text-gray-500">No history yet.</div>
            ) : (
              <ol className="space-y-1.5">
                {history.map((h) => <TimelineEntry key={h.id} entry={h} />)}
              </ol>
            )}
          </section>

          {error && (
            <div className="rounded-lg border border-rose-500/[0.22] bg-rose-500/[0.04] px-3 py-2 text-[11px] text-rose-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer — action buttons + reason prompt */}
        <footer className="border-t border-white/[0.05] px-4 py-3 space-y-2">
          {reasonMode && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-1.5">
                {reasonMode === "reject" ? "Reason for rejection" : "What needs to change?"}
              </div>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full resize-none rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[12px] text-gray-200 placeholder:text-gray-600 focus:border-white/[0.12] focus:outline-none"
                placeholder={reasonMode === "reject" ? "Why is this expense being rejected?" : "What changes are needed?"}
                autoFocus
              />
              <div className="mt-2 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => { setReasonMode(null); setReason(""); }}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] text-gray-300 hover:bg-white/[0.05]"
                >Cancel</button>
                <button
                  type="button"
                  disabled={!reason.trim() || acting != null}
                  onClick={() => void performAction(reasonMode === "reject" ? "reject" : "request_changes", reason.trim())}
                  className={
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors " +
                    (reasonMode === "reject"
                      ? "border border-rose-500/[0.30] bg-rose-500/[0.10] text-rose-200 hover:bg-rose-500/[0.16]"
                      : "border border-amber-500/[0.30] bg-amber-500/[0.10] text-amber-200 hover:bg-amber-500/[0.16]") +
                    " disabled:opacity-50 disabled:cursor-not-allowed"
                  }
                >
                  {reasonMode === "reject" ? "Reject expense" : "Send back for changes"}
                </button>
              </div>
            </div>
          )}

          {!reasonMode && (
            <div className="flex flex-wrap items-center gap-1.5">
              {canSubmit && (
                <ActionButton
                  busy={acting === "submit"}
                  onClick={() => void performAction("submit")}
                  tone="primary"
                >
                  Submit for review
                </ActionButton>
              )}
              {canApproveNow && (
                <ActionButton
                  busy={acting === "approve"}
                  onClick={() => void performAction("approve")}
                  tone="positive"
                >
                  Approve
                </ActionButton>
              )}
              {canRequestChanges && (
                <ActionButton
                  busy={acting === "request_changes"}
                  onClick={() => setReasonMode("request_changes")}
                  tone="warning"
                >
                  Request changes
                </ActionButton>
              )}
              {canReject && (
                <ActionButton
                  busy={acting === "reject"}
                  onClick={() => setReasonMode("reject")}
                  tone="negative"
                >
                  Reject
                </ActionButton>
              )}
              {canReset && (
                <ActionButton
                  busy={acting === "reset"}
                  onClick={() => void performAction("reset")}
                  tone="neutral"
                >
                  Reset to draft
                </ActionButton>
              )}
              {!canSubmit && !canApproveNow && !canRequestChanges && !canReject && !canReset && (
                <div className="text-[11px] text-gray-500">No actions available in this state.</div>
              )}
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}

/* ─── small subcomponents ─────────────────────────────────────────── */

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{label}</dt>
      <dd className={mono ? "font-mono text-[11.5px] text-gray-200" : "text-gray-200"}>{value}</dd>
    </>
  );
}

function ActionButton({
  children, onClick, busy, tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  tone: "primary" | "positive" | "negative" | "warning" | "neutral";
}) {
  const toneCls =
    tone === "positive" ? "border-emerald-500/[0.30] bg-emerald-500/[0.10] text-emerald-300 hover:bg-emerald-500/[0.16]"
  : tone === "negative" ? "border-rose-500/[0.30] bg-rose-500/[0.10] text-rose-300 hover:bg-rose-500/[0.16]"
  : tone === "warning"  ? "border-amber-500/[0.30] bg-amber-500/[0.10] text-amber-200 hover:bg-amber-500/[0.16]"
  : tone === "primary"  ? "border-sky-500/[0.28] bg-sky-500/[0.10] text-sky-200 hover:bg-sky-500/[0.16]"
  :                       "border-white/[0.06] bg-white/[0.02] text-gray-300 hover:bg-white/[0.05]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors " +
        toneCls +
        " disabled:opacity-50 disabled:cursor-wait"
      }
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" className="animate-spin">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const ACTION_LABEL: Record<string, string> = {
  submit:           "Submitted for review",
  review_note:      "Review note added",
  approve:          "Approved",
  partial_approve:  "Partially approved",
  reject:           "Rejected",
  request_changes:  "Changes requested",
  reset:            "Reset to draft",
  auto_change:      "Status change",
};

const ACTION_DOT: Record<string, string> = {
  submit:           "bg-sky-300/85",
  review_note:      "bg-sky-300/85",
  approve:          "bg-emerald-400/85",
  partial_approve:  "bg-emerald-300/75",
  reject:           "bg-rose-400/85",
  request_changes:  "bg-amber-300/85",
  reset:            "bg-white/40",
  auto_change:      "bg-white/40",
};

function TimelineEntry({ entry }: { entry: FinanceApprovalHistoryEntry }) {
  const label = ACTION_LABEL[entry.action] ?? entry.action;
  const dot = ACTION_DOT[entry.action] ?? "bg-white/40";
  const when = (() => {
    const d = new Date(entry.created_at);
    if (Number.isNaN(d.getTime())) return entry.created_at;
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  })();
  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-white/[0.04] bg-white/[0.012] px-2.5 py-2">
      <span aria-hidden className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-[11px] font-medium text-gray-200">{label}</span>
          {entry.actor_name && (
            <span className="text-[10px] text-gray-500">by {entry.actor_name}</span>
          )}
          <span className="text-[10px] text-gray-600">· {when}</span>
        </div>
        {entry.notes && (
          <div className="mt-0.5 text-[11px] text-gray-400 leading-relaxed">{entry.notes}</div>
        )}
      </div>
    </li>
  );
}
