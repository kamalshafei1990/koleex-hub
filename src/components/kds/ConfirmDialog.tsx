"use client";

/* KDS ConfirmDialog — ELECTED CF-1 by owner 2026-08-02 (Expenses style):
   compact hairline card, no header bar, rose-tint destructive confirm.
   Motion (owner-approved system 2026-08-21): pops in, shrinks away. */

import { usePresence } from "./usePresence";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  busy,
  tone = "danger",
}: {
  open: boolean;
  title: React.ReactNode;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  /** "danger" (default) = rose destructive confirm (the elected CF-1 look).
   *  "neutral" = benign confirms ("Add another copy") — inverted primary. */
  tone?: "danger" | "neutral";
}) {
  const { mounted, closing } = usePresence(open);
  if (!mounted) return null;
  return (
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm transition-opacity duration-150 ${closing ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className={`kx-glass-pop ${closing ? "kx-pop-closing" : ""} w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[var(--bg-secondary)] shadow-[0_24px_64px_-24px_rgba(0,0,0,0.7)] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5">
          <p className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</p>
          {message && <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-dim)]">{message}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.05] px-4 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/[0.05] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={tone === "danger"
              ? "rounded-lg border border-rose-500/[0.30] bg-rose-500/[0.10] px-3 py-1.5 text-[12px] font-medium text-rose-300 transition-colors hover:bg-rose-500/[0.16] disabled:opacity-50"
              : "rounded-lg border border-transparent bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90 disabled:opacity-50"}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
