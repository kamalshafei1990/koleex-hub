"use client";

/* ===========================================================================
   ConfirmDialog  —  Hub-native confirmation primitive

   Replaces browser confirm() everywhere in Finance + Expenses. Same
   visual vocabulary as the rest of the Hub:

     · hairline borders, monochrome surface
     · compact layout — title + one-line description + 2 buttons
     · destructive mode tints the confirm button rose
     · ESC closes · Enter confirms · click-outside cancels
     · focus traps on the confirm button on mount

   Designed to be importable from any module — no Finance or Expense
   coupling.
   ========================================================================== */

import { useCallback, useEffect, useRef } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Tints the confirm button rose when true. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Set true while the confirm action is in flight. */
  busy?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  /* Keyboard handling: ESC cancels, Enter confirms. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      else if (e.key === "Enter" && !busy) { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel, onConfirm]);

  /* Focus the confirm button on mount so Enter works without a
     stray click first. */
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  const handleBackdropClick = useCallback(() => {
    if (!busy) onCancel();
  }, [busy, onCancel]);

  if (!open) return null;

  /* Destructive mode uses the same rose vocabulary the rest of the Hub
     uses for non-positive actions; standard mode uses the Hub-inverted
     button so it matches every other primary action. */
  const confirmCls = destructive
    ? "border-rose-500/[0.30] bg-rose-500/[0.10] text-rose-300 hover:bg-rose-500/[0.16]"
    : "border-transparent bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-black/40 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[var(--bg-secondary)] shadow-[0_24px_64px_-24px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5">
          <h2 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
          {description && (
            <p className="mt-1 text-[12px] leading-relaxed text-gray-400">{description}</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.05] px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-gray-300 transition-colors hover:bg-white/[0.05] hover:text-gray-100 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-wait " +
              confirmCls
            }
          >
            {busy && (
              <svg viewBox="0 0 24 24" width="11" height="11" className="animate-spin">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
                <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
