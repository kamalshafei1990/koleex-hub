"use client";

/* ===========================================================================
   PaymentReviewDrawer  —  Phase 2.3

   Right-side drawer that hosts the full payment-control workflow for
   one cash movement:

     · Detail strip       — direction, party, amounts (expected/actual),
                            bank reference, linked entity
     · Evidence preview   — bank transfer screenshots, MT103, etc.
     · Approval history   — same audit log as expenses
     · Reconciliation     — actual amount + bank ref entry, match /
                            mismatch / dispute / verify actions
     · Approval actions   — submit / approve / reject / request changes

   The visual vocabulary matches the existing AttachmentPreviewDrawer
   and ApprovalReviewDrawer exactly — hairline borders, monochrome,
   slide-in from right, full-width on phones.
   ========================================================================== */

import { useCallback, useEffect, useState } from "react";
import type {
  ApprovalAction,
  ApprovalStatus,
  FinanceApprovalHistoryEntry,
  FinanceAttachment,
  FinancePayment,
  ReconciliationStatus,
} from "@/lib/finance/types";
import { ApprovalBadge } from "@/components/approval/ApprovalBadge";
import { ReconciliationBadge } from "./ReconciliationBadge";
import AttachmentDropzone from "@/components/attachments/AttachmentDropzone";
import { isImageMime, isPdfMime } from "@/lib/attachments/client";
import { fmtMoney } from "@/lib/finance/calc";
import { approvalTierForAmount, approvalTierExplanation } from "@/lib/finance/payment-thresholds";
import GuidanceTip from "@/components/ui/GuidanceTip";

interface Props {
  open: boolean;
  onClose: () => void;
  payment: FinancePayment | null;
  /** Caller flag — true for users with Finance module access. */
  canApprove: boolean;
  /** Re-fetch parent list after a state change. */
  onChange?: (payment: FinancePayment) => void;
}

type ReconcileAction = "match" | "partial_match" | "mismatch" | "dispute" | "verify" | "reset";

export default function PaymentReviewDrawer({
  open, onClose, payment, canApprove, onChange,
}: Props) {
  const [history, setHistory] = useState<FinanceApprovalHistoryEntry[]>([]);
  const [attachments, setAttachments] = useState<FinanceAttachment[]>([]);
  const [activeAttachmentIdx, setActiveAttachmentIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [reasonMode, setReasonMode] = useState<null | "reject" | "request_changes">(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  /* Reconciliation form state. */
  const [actualAmount, setActualAmount] = useState<string>("");
  const [bankReference, setBankReference] = useState<string>("");
  const [bankAccount, setBankAccount] = useState<string>("");
  /* Stable per-mount now for "Xd waiting" — purity-rule safe. */
  const [nowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!open || !payment?.id) return;
    setActualAmount(payment.actual_amount != null ? String(payment.actual_amount)
      : payment.expected_amount != null ? String(payment.expected_amount) : "");
    setBankReference(payment.bank_reference ?? "");
    setBankAccount(payment.bank_account ?? "");
  }, [open, payment?.id, payment?.actual_amount, payment?.expected_amount, payment?.bank_reference, payment?.bank_account]);

  useEffect(() => {
    if (!open || !payment?.id) return;
    let cancelled = false;
    setLoading(true);
    setActiveAttachmentIdx(0);
    void Promise.all([
      fetch(`/api/finance/payments/${payment.id}/approval`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/finance/attachments?entity_type=payment&entity_id=${payment.id}`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([histJson, attJson]) => {
        if (cancelled) return;
        setHistory((histJson?.history ?? []) as FinanceApprovalHistoryEntry[]);
        setAttachments((attJson?.attachments ?? []) as FinanceAttachment[]);
      })
      .catch(() => {
        if (cancelled) return;
        setHistory([]); setAttachments([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, payment?.id]);

  const performApproval = useCallback(async (action: ApprovalAction, notes?: string) => {
    if (!payment) return;
    setActing(action);
    setError(null);
    try {
      const res = await fetch(`/api/finance/payments/${payment.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });
      const body = (await res.json()) as { payment?: FinancePayment; error?: string };
      if (!res.ok || !body.payment) { setError(body.error ?? "Action failed"); return; }
      onChange?.(body.payment);
      const hr = await fetch(`/api/finance/payments/${payment.id}/approval`, { cache: "no-store" });
      const hj = await hr.json();
      setHistory((hj.history ?? []) as FinanceApprovalHistoryEntry[]);
      setReasonMode(null);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  }, [payment, onChange]);

  const performReconcile = useCallback(async (action: ReconcileAction) => {
    if (!payment) return;
    setActing(`reconcile:${action}`);
    setError(null);
    try {
      const res = await fetch(`/api/finance/payments/${payment.id}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          actual_amount: actualAmount === "" ? undefined : Number(actualAmount),
          bank_reference: bankReference || undefined,
          bank_account: bankAccount || undefined,
        }),
      });
      const body = (await res.json()) as { payment?: FinancePayment; error?: string };
      if (!res.ok || !body.payment) { setError(body.error ?? "Reconcile failed"); return; }
      onChange?.(body.payment);
      const hr = await fetch(`/api/finance/payments/${payment.id}/approval`, { cache: "no-store" });
      const hj = await hr.json();
      setHistory((hj.history ?? []) as FinanceApprovalHistoryEntry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconcile failed");
    } finally {
      setActing(null);
    }
  }, [payment, onChange, actualAmount, bankReference, bankAccount]);

  if (!open || !payment) return null;
  const status: ApprovalStatus = (payment.approval_status ?? "draft") as ApprovalStatus;
  const recStatus: ReconciliationStatus = (payment.reconciliation_status ?? "unreconciled") as ReconciliationStatus;

  const ageDays = (() => {
    const ts = payment.submitted_at ?? payment.reviewed_at;
    if (!ts) return undefined;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return undefined;
    return Math.max(0, Math.floor((nowMs - d.getTime()) / 86_400_000));
  })();

  const tier = approvalTierForAmount(payment.expected_amount ?? payment.amount);
  const expected = payment.expected_amount ?? payment.amount;
  const actual = payment.actual_amount;
  const diff = (actual != null && expected != null) ? actual - expected : null;

  /* State-machine driven action visibility — mirrors expense drawer. */
  const canSubmit          = status === "draft" || status === "requires_changes" || status === "rejected";
  const canApproveNow      = canApprove && (status === "submitted" || status === "under_review" || status === "requires_changes" || status === "partially_approved");
  const canReject          = canApprove && (status === "submitted" || status === "under_review");
  const canRequestChanges  = canApprove && (status === "submitted" || status === "under_review");
  const canReset           = canApprove && status !== "draft";

  return (
    <div className="fixed inset-0 z-[200] flex">
      <button aria-label="Close" onClick={onClose} className="flex-1 bg-black/30 backdrop-blur-[2px]" />

      <aside className="flex h-full w-full flex-col border-l border-white/[0.06] bg-[var(--bg-primary)] shadow-[-12px_0_48px_-12px_rgba(0,0,0,0.6)] sm:max-w-[600px]">
        <header className="flex items-start gap-3 border-b border-white/[0.05] px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">
              {payment.direction === "in" ? "Money in" : "Money out"}
            </div>
            <div className="mt-0.5 truncate text-[14px] font-medium text-[var(--text-primary)]">
              {payment.party_name || "Payment"}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <ApprovalBadge status={status} ageDays={ageDays} withTip />
              <ReconciliationBadge status={recStatus} withTip />
              <span className="text-[10px] text-gray-500">
                {fmtMoney(Number(expected) || 0, payment.currency, { compact: true })} · {payment.payment_date}
              </span>
            </div>
          </div>
          <button
            type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-gray-100"
            aria-label="Close drawer"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Detail strip */}
          <section className="rounded-xl border border-white/[0.05] bg-white/[0.012] p-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Cash detail</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
              <DetailRow label="Method" value={payment.payment_method ?? "—"} />
              <DetailRow label="Reference" value={payment.reference_no ?? "—"} mono />
              <DetailRow label="Linked order" value={payment.linked_order_id ? payment.linked_order_id.slice(0, 8) + "…" : "—"} mono />
              <DetailRow label="Linked expense" value={payment.linked_expense_id ? payment.linked_expense_id.slice(0, 8) + "…" : "—"} mono />
              <DetailRow label="Bank reference" value={payment.bank_reference ?? "—"} mono />
              <DetailRow label="Bank account" value={payment.bank_account ?? "—"} />
            </dl>
            {/* Expected vs actual */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-2">
                <div className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] text-gray-500">
                  <span>Expected</span>
                  <GuidanceTip guidanceId="payment.expectedAmount" />
                </div>
                <div className="mt-0.5 text-[13px] font-medium tabular-nums text-gray-200">
                  {expected != null ? fmtMoney(Number(expected), payment.currency, { compact: true }) : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-2">
                <div className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] text-gray-500">
                  <span>Actual</span>
                  <GuidanceTip guidanceId="payment.actualAmount" />
                </div>
                <div className="mt-0.5 text-[13px] font-medium tabular-nums text-gray-200">
                  {actual != null ? fmtMoney(Number(actual), payment.currency, { compact: true }) : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-2">
                <div className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] text-gray-500">
                  <span>Difference</span>
                  <GuidanceTip guidanceId="payment.difference" />
                </div>
                <div className={
                  "mt-0.5 text-[13px] font-medium tabular-nums " +
                  (diff == null ? "text-gray-500"
                  : Math.abs(diff) < 1 ? "text-emerald-300"
                  : "text-rose-300")
                }>
                  {diff == null ? "—" : `${diff > 0 ? "+" : ""}${fmtMoney(diff, payment.currency, { compact: true })}`}
                </div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-gray-500">{approvalTierExplanation(payment.expected_amount ?? payment.amount)}</div>
            {(payment.rejection_reason || payment.requires_changes_reason) && (
              <div className={
                "mt-2 rounded-lg border px-2.5 py-2 text-[11px] " +
                (payment.rejection_reason
                  ? "border-rose-500/[0.22] bg-rose-500/[0.04] text-rose-200/90"
                  : "border-amber-500/[0.22] bg-amber-500/[0.04] text-amber-200/90")
              }>
                <div className="text-[9px] uppercase tracking-[0.18em] opacity-70 mb-0.5">
                  {payment.rejection_reason ? "Reason for rejection" : "Changes requested"}
                </div>
                {payment.rejection_reason ?? payment.requires_changes_reason}
              </div>
            )}
          </section>

          {/* Reconciliation form */}
          {canApprove && (status === "approved" || status === "partially_approved") && (
            <section className="rounded-xl border border-white/[0.05] bg-white/[0.012] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Reconcile</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-gray-500">
                    <span>Actual amount</span>
                    <GuidanceTip guidanceId="payment.actualAmount" />
                  </span>
                  <input
                    type="number" inputMode="decimal"
                    value={actualAmount}
                    onChange={(e) => setActualAmount(e.target.value)}
                    placeholder={expected != null ? String(expected) : ""}
                    className="mt-1 w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[12px] tabular-nums text-gray-200 focus:border-white/[0.22] focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-gray-500">
                    <span>Bank reference</span>
                    <GuidanceTip guidanceId="payment.bankReference" />
                  </span>
                  <input
                    value={bankReference}
                    onChange={(e) => setBankReference(e.target.value)}
                    placeholder="MT103 / wire / ref"
                    className="mt-1 w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[12px] text-gray-200 focus:border-white/[0.22] focus:outline-none"
                  />
                </label>
                <label className="col-span-2 block">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Bank account (optional)</span>
                  <input
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="Acct. or IBAN tail"
                    className="mt-1 w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[12px] text-gray-200 focus:border-white/[0.22] focus:outline-none"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <ActionButton tone="positive" busy={acting === "reconcile:match"} onClick={() => void performReconcile("match")}>Match</ActionButton>
                <ActionButton tone="neutral"  busy={acting === "reconcile:partial_match"} onClick={() => void performReconcile("partial_match")}>Partial</ActionButton>
                <ActionButton tone="negative" busy={acting === "reconcile:mismatch"} onClick={() => void performReconcile("mismatch")}>Mismatch</ActionButton>
                <ActionButton tone="negative" busy={acting === "reconcile:dispute"} onClick={() => void performReconcile("dispute")}>Dispute</ActionButton>
                {recStatus !== "verified" && (
                  <ActionButton tone="positive" busy={acting === "reconcile:verify"} onClick={() => void performReconcile("verify")}>Verify</ActionButton>
                )}
                {recStatus !== "unreconciled" && (
                  <ActionButton tone="neutral" busy={acting === "reconcile:reset"} onClick={() => void performReconcile("reset")}>Reset</ActionButton>
                )}
              </div>
            </section>
          )}

          {/* Attachments — bank evidence */}
          {payment.id && (
            <section className="rounded-xl border border-white/[0.05] bg-white/[0.012] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Bank evidence · {attachments.length} file{attachments.length === 1 ? "" : "s"}</div>
              <div className="mt-2">
                <AttachmentDropzone
                  entityType="payment"
                  entityId={payment.id}
                  category="payment_screenshot"
                  compact
                  onUploaded={() => {
                    /* Re-fetch attachments after upload. */
                    void fetch(`/api/finance/attachments?entity_type=payment&entity_id=${payment.id}`, { cache: "no-store" })
                      .then((r) => r.json())
                      .then((j) => setAttachments((j.attachments ?? []) as FinanceAttachment[]))
                      .catch(() => { /* ignore */ });
                  }}
                />
              </div>
              {attachments.length > 0 && (
                <>
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
                  {(() => {
                    const active = attachments[activeAttachmentIdx];
                    if (!active || !active.signed_url) return null;
                    if (isImageMime(active.file_type)) {
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={active.signed_url} alt={active.file_name}
                          className="mt-2 max-h-[320px] w-full rounded-md bg-black/40 object-contain" />
                      );
                    }
                    if (isPdfMime(active.file_type)) {
                      return (
                        <iframe src={active.signed_url} className="mt-2 h-[320px] w-full rounded-md bg-black/40" title={active.file_name} />
                      );
                    }
                    return null;
                  })()}
                </>
              )}
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

        {/* Footer — approval actions, mirror of expense flow */}
        <footer className="border-t border-white/[0.05] px-4 py-3 space-y-2">
          {reasonMode && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-1.5">
                {reasonMode === "reject" ? "Reason for rejection" : "What needs to change?"}
              </div>
              <textarea
                rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                className="w-full resize-none rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[12px] text-gray-200 focus:border-white/[0.12] focus:outline-none"
                autoFocus
              />
              <div className="mt-2 flex items-center justify-end gap-1.5">
                <button type="button" onClick={() => { setReasonMode(null); setReason(""); }}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] text-gray-300 hover:bg-white/[0.05]">Cancel</button>
                <button type="button" disabled={!reason.trim() || acting != null}
                  onClick={() => void performApproval(reasonMode === "reject" ? "reject" : "request_changes", reason.trim())}
                  className={
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors " +
                    (reasonMode === "reject"
                      ? "border border-rose-500/[0.30] bg-rose-500/[0.10] text-rose-200 hover:bg-rose-500/[0.16]"
                      : "border border-amber-500/[0.30] bg-amber-500/[0.10] text-amber-200 hover:bg-amber-500/[0.16]") +
                    " disabled:opacity-50 disabled:cursor-not-allowed"
                  }
                >
                  {reasonMode === "reject" ? "Reject payment" : "Send back for changes"}
                </button>
              </div>
            </div>
          )}

          {!reasonMode && (
            <div className="flex flex-wrap items-center gap-1.5">
              {canSubmit && (
                <ActionButton tone="primary" busy={acting === "submit"} onClick={() => void performApproval("submit")}>
                  {tier.tier === "auto" ? "Submit (auto-approve)" : "Submit for approval"}
                </ActionButton>
              )}
              {canApproveNow && (
                <ActionButton tone="positive" busy={acting === "approve"} onClick={() => void performApproval("approve")}>
                  Approve
                </ActionButton>
              )}
              {canRequestChanges && (
                <ActionButton tone="warning" busy={acting === "request_changes"} onClick={() => setReasonMode("request_changes")}>
                  Request changes
                </ActionButton>
              )}
              {canReject && (
                <ActionButton tone="negative" busy={acting === "reject"} onClick={() => setReasonMode("reject")}>
                  Reject
                </ActionButton>
              )}
              {canReset && (
                <ActionButton tone="neutral" busy={acting === "reset"} onClick={() => void performApproval("reset")}>
                  Reset to draft
                </ActionButton>
              )}
              {!canSubmit && !canApproveNow && !canRequestChanges && !canReject && !canReset && (
                <div className="text-[11px] text-gray-500">No approval actions available in this state.</div>
              )}
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}

/* ─── reused subcomponents ──────────────────────────────────────────── */

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
      type="button" onClick={onClick} disabled={busy}
      className={
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors " +
        toneCls + " disabled:opacity-50 disabled:cursor-wait"
      }
    >
      {busy && (
        <svg viewBox="0 0 24 24" width="11" height="11" className="animate-spin">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

const ACTION_LABEL: Record<string, string> = {
  submit:           "Submitted for approval",
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
          {entry.actor_name && <span className="text-[10px] text-gray-500">by {entry.actor_name}</span>}
          <span className="text-[10px] text-gray-600">· {when}</span>
        </div>
        {entry.notes && <div className="mt-0.5 text-[11px] text-gray-400 leading-relaxed">{entry.notes}</div>}
      </div>
    </li>
  );
}
