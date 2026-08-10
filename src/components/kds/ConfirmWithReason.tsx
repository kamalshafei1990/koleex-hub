"use client";

/* KDS ConfirmWithReason — CF-1-styled confirm carrying an optional reason
   field. Replaces the native confirm()+prompt() pair (shipment voids,
   journal voids). Danger-only by design: reasons are for destructive acts. */

import { useEffect, useState } from "react";

export default function ConfirmWithReason({ open, title, reasonPlaceholder = "Reason (optional):", confirmLabel = "Confirm", onCancel, onConfirm }: {
  open: boolean;
  title: React.ReactNode;
  reasonPlaceholder?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm" onClick={onCancel} role="alertdialog" aria-modal="true">
      <div className="kx-glass-pop w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[var(--bg-secondary)] shadow-[0_24px_64px_-24px_rgba(0,0,0,0.7)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3.5">
          <p className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</p>
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonPlaceholder}
            className="mt-2.5 w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-ghost)]" />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.05] px-4 py-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/[0.05] hover:text-[var(--text-primary)]">Cancel</button>
          <button type="button" onClick={() => onConfirm(reason.trim() || "")} className="rounded-lg border border-rose-500/[0.30] bg-rose-500/[0.10] px-3 py-1.5 text-[12px] font-medium text-rose-300 transition-colors hover:bg-rose-500/[0.16]">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
