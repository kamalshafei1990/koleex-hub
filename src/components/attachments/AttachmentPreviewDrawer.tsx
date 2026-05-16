"use client";

/* ===========================================================================
   AttachmentPreviewDrawer  —  Phase 2.1

   Calm right-side drawer that hosts the full attachment workflow for
   one entity (expense / payment / order / supplier / customer).

     · Header: entity label · evidence status · receipt count
     · AttachmentDropzone surface
     · AttachmentList of current files (with thumbnails / signed URLs)
     · Verify / Pending review controls (expense entities only)
     · Inline preview pane — images render in-place, PDFs open in a tab

   Visual language: hairline borders, monochrome surfaces, Linear-style
   drawer that slides in from the right. No modal. No backdrop blur.
   ========================================================================== */

import { useCallback, useEffect, useState } from "react";
import AttachmentDropzone from "./AttachmentDropzone";
import AttachmentList from "./AttachmentList";
import { EvidenceBadge } from "./EvidenceBadge";
import type {
  AttachmentEntityType,
  EvidenceStatus,
  FinanceAttachment,
} from "@/lib/finance/types";
import { isImageMime, isPdfMime } from "@/lib/attachments/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  entityType: AttachmentEntityType;
  entityId: string | null;
  /** Display title for the drawer header (e.g. expense title). */
  title?: string;
  /** Current evidence status (expense only). */
  evidenceStatus?: EvidenceStatus;
  receiptCount?: number;
  /** UX-validation pass: current approval status from the parent —
   *  when an expense is in `draft` (or `requires_changes`) and now
   *  carries at least one attachment, the drawer surfaces a
   *  "Submit for review" shortcut so the operator never has to
   *  switch drawers. */
  approvalStatus?: "draft" | "submitted" | "under_review" | "approved" | "partially_approved" | "rejected" | "requires_changes";
  /** Called whenever the attachment set changes so parent can refetch. */
  onChange?: () => void;
  /** Submit-for-review callback. Wired when entityType==="expense". */
  onSubmitForReview?: () => void;
}

export default function AttachmentPreviewDrawer({
  open, onClose, entityType, entityId, title, evidenceStatus, receiptCount,
  approvalStatus, onChange, onSubmitForReview,
}: Props) {
  const [attachments, setAttachments] = useState<FinanceAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<FinanceAttachment | null>(null);
  const [duplicateWarn, setDuplicateWarn] = useState<{ file_name: string } | null>(null);
  const [evidenceLocal, setEvidenceLocal] = useState<EvidenceStatus | undefined>(evidenceStatus);
  /* Hub-native delete confirmation in place of native confirm(). */
  const [confirmTarget, setConfirmTarget] = useState<FinanceAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { setEvidenceLocal(evidenceStatus); }, [evidenceStatus]);

  const load = useCallback(async () => {
    if (!entityId || !open) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/attachments?entity_type=${entityType}&entity_id=${entityId}`, { cache: "no-store" });
      const j = (await res.json()) as { attachments?: FinanceAttachment[] };
      const list = j.attachments ?? [];
      setAttachments(list);
      setActive(list[0] ?? null);
    } catch {
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, open]);

  useEffect(() => { void load(); }, [load]);

  const handleUploaded = useCallback((_a: FinanceAttachment, duplicate: { file_name: string } | null) => {
    if (duplicate) setDuplicateWarn(duplicate);
    void load();
    onChange?.();
  }, [load, onChange]);

  /* The list calls this; we don't fire DELETE here — we hand the
     attachment to the Hub-native ConfirmDialog and wait for an
     explicit confirmation. The audit trail is preserved (soft delete
     server-side), so no undo toast is needed in this flow. */
  const handleDelete = useCallback((a: FinanceAttachment) => {
    setConfirmTarget(a);
  }, []);
  const performDelete = useCallback(async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/finance/attachments/${confirmTarget.id}`, { method: "DELETE" });
      setConfirmTarget(null);
      void load();
      onChange?.();
    } finally {
      setDeleting(false);
    }
  }, [confirmTarget, load, onChange]);

  const handleMakePrimary = useCallback(async (a: FinanceAttachment) => {
    await fetch(`/api/finance/attachments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_primary: true }),
    });
    void load();
    onChange?.();
  }, [load, onChange]);

  const setEvidence = useCallback(async (next: EvidenceStatus) => {
    setEvidenceLocal(next);
    /* Persist via PATCH on the most-recent attachment so the API can
       confirm permission. If there are no attachments, "Verified" is
       not allowed — the badge stays missing. */
    const target = attachments[0];
    if (!target) return;
    await fetch(`/api/finance/attachments/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidence_status: next }),
    });
    onChange?.();
  }, [attachments, onChange]);

  /* ── Render ─────────────────────────────────────────────────── */

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex">
      {/* Click-away shade — uses the same hairline pattern as the rest of Hub. */}
      <button aria-label="Close" onClick={onClose} className="flex-1 bg-black/30 backdrop-blur-[2px]" />

      {/* Drawer — full-width on phones, 560px on tablet+. */}
      <aside className="flex h-full w-full flex-col border-l border-white/[0.06] bg-[var(--bg-primary)] shadow-[-12px_0_48px_-12px_rgba(0,0,0,0.6)] sm:max-w-[560px]">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Evidence</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="truncate text-[14px] font-medium text-[var(--text-primary)]">{title ?? "Attachment"}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              {entityType === "expense" && (
                <EvidenceBadge status={evidenceLocal} receiptCount={receiptCount ?? attachments.length} withTip />
              )}
              {entityType !== "expense" && attachments.length > 0 && (
                <span className="text-[11px] text-gray-500">{attachments.length} file{attachments.length === 1 ? "" : "s"}</span>
              )}
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
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {entityId ? (
            <>
              <AttachmentDropzone
                entityType={entityType}
                entityId={entityId}
                onUploaded={handleUploaded}
              />

              {duplicateWarn && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/[0.18] bg-amber-500/[0.04] px-3 py-2 text-[11px] text-amber-200">
                  <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                  <div className="flex-1">
                    Possible duplicate of <span className="font-medium">{duplicateWarn.file_name}</span>. File uploaded anyway — review before marking verified.
                  </div>
                  <button onClick={() => setDuplicateWarn(null)} className="text-amber-200/80 hover:text-amber-100">×</button>
                </div>
              )}

              <div className="mt-4">
                {loading ? (
                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-6 text-center text-[12px] text-gray-500">Loading attachments…</div>
                ) : (
                  <AttachmentList
                    attachments={attachments}
                    onOpen={(a) => setActive(a)}
                    onMakePrimary={handleMakePrimary}
                    onDelete={handleDelete}
                  />
                )}
              </div>

              {/* Inline preview (active attachment) */}
              {active && active.signed_url && (
                <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.05] bg-black/30">
                  <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-gray-500">
                    <span>Preview</span>
                    <a href={active.signed_url} target="_blank" rel="noreferrer noopener" className="text-gray-300 hover:text-white">
                      Open full →
                    </a>
                  </div>
                  {isImageMime(active.file_type) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={active.signed_url} alt={active.file_name} className="max-h-[420px] w-full object-contain bg-black/40" />
                  ) : isPdfMime(active.file_type) ? (
                    <iframe src={active.signed_url} className="h-[420px] w-full bg-black/40" title={active.file_name} />
                  ) : (
                    <div className="px-4 py-8 text-center text-[12px] text-gray-500">Inline preview not available — open in new tab.</div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] px-4 py-8 text-center text-[12px] text-gray-500">
              Save the record before attaching evidence.
            </div>
          )}
        </div>

        {/* Footer — evidence-status controls (expense only). */}
        {entityType === "expense" && attachments.length > 0 && (
          <footer className="space-y-2 border-t border-white/[0.05] px-4 py-3">
            {/* UX-validation pass: submit-for-review shortcut. When an
                expense is in draft (or sent back for changes) AND now
                carries a receipt, surface the next operational step
                here instead of forcing the operator to close this
                drawer, find the row, open the review drawer, and click
                Submit. Eliminates 3 interactions. */}
            {onSubmitForReview && (approvalStatus === "draft" || approvalStatus === "requires_changes") && (
              <button
                type="button"
                onClick={onSubmitForReview}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-sky-500/[0.28] bg-sky-500/[0.10] px-3 py-1.5 text-[12px] font-medium text-sky-200 transition-colors hover:bg-sky-500/[0.16]"
              >
                {approvalStatus === "requires_changes" ? "Resubmit for review" : "Submit for review"}
              </button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Mark</span>
              <button
                type="button"
                onClick={() => void setEvidence("pending")}
                className={
                  "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors " +
                  (evidenceLocal === "pending"
                    ? "border-amber-500/[0.30] bg-amber-500/[0.08] text-amber-200"
                    : "border-white/[0.06] bg-white/[0.02] text-gray-300 hover:bg-white/[0.05] hover:text-gray-100")
                }
              >
                Pending review
              </button>
              <button
                type="button"
                onClick={() => void setEvidence("partial")}
                className={
                  "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors " +
                  (evidenceLocal === "partial"
                    ? "border-amber-500/[0.30] bg-amber-500/[0.08] text-amber-200"
                    : "border-white/[0.06] bg-white/[0.02] text-gray-300 hover:bg-white/[0.05] hover:text-gray-100")
                }
              >
                Partial
              </button>
              <button
                type="button"
                onClick={() => void setEvidence("verified")}
                className={
                  "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors " +
                  (evidenceLocal === "verified"
                    ? "border-emerald-500/[0.30] bg-emerald-500/[0.10] text-emerald-300"
                    : "border-white/[0.06] bg-white/[0.02] text-gray-300 hover:bg-white/[0.05] hover:text-gray-100")
                }
              >
                Verified
              </button>
            </div>
          </footer>
        )}
      </aside>
      <ConfirmDialog
        open={!!confirmTarget}
        title={confirmTarget ? `Remove "${confirmTarget.file_name}"?` : ""}
        description="The file will be hidden from this entity, but the audit trail (who uploaded it and when) is preserved."
        confirmLabel="Remove"
        cancelLabel="Keep"
        destructive
        busy={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => { void performDelete(); }}
      />
    </div>
  );
}
