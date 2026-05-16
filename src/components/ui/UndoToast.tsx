"use client";

/* ===========================================================================
   UndoToast  —  Hub-native deferred-action safety toast

   The "Delete → immediate disappearance" pattern is psychologically
   harsh for a finance operator who just clicked the wrong row.
   UndoToast pairs with a parent-level deferred-action map:

     1. Operator clicks Delete → row vanishes optimistically, toast
        appears.
     2. After `timeoutMs` (5s default) the parent fires the real DELETE.
     3. Until then, clicking Undo cancels the deferred action and
        restores the row instantly.

   This component is presentation only — it accepts the label, the
   undo handler, and dismisses itself on completion or undo. The
   parent owns the timer and the actual deletion plumbing.

   Visual language matches the rest of the Hub: monochrome, hairline
   border, fixed bottom-center, slides up on appear.
   ========================================================================== */

import { useEffect, useRef, useState } from "react";

export interface UndoToastProps {
  open: boolean;
  message: string;
  /** Default 5s — generous enough that a flicker-tap can be saved. */
  durationMs?: number;
  onUndo: () => void;
  /** Fires when the timer expires (parent does the real work then). */
  onExpire: () => void;
  /** Optional manual dismiss handler. */
  onDismiss?: () => void;
}

export default function UndoToast({
  open,
  message,
  durationMs = 5000,
  onUndo,
  onExpire,
  onDismiss,
}: UndoToastProps) {
  /* Progress 0..1 — animates the thin bar at the bottom of the toast. */
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      startRef.current = null;
      setProgress(0);
      return;
    }
    startRef.current = Date.now();
    const tick = () => {
      const t = startRef.current == null ? 0 : (Date.now() - startRef.current) / durationMs;
      const next = Math.min(1, Math.max(0, t));
      setProgress(next);
      if (next < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    timeoutRef.current = setTimeout(() => { onExpire(); }, durationMs);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, durationMs]);

  /* ESC key triggers undo — the calmest "panic button". */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onUndo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onUndo]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-[250] flex justify-center pointer-events-none px-4 sm:bottom-6"
    >
      <div
        className="pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--bg-secondary)] px-3.5 py-2 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.7)]"
        style={{ animation: "koleex-fade-in 200ms ease-out both" }}
      >
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
        <span className="text-[12px] text-gray-200">{message}</span>
        <button
          type="button"
          onClick={onUndo}
          className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-gray-200 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          Undo
        </button>
        {onDismiss && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="rounded-md p-0.5 text-gray-500 transition-colors hover:bg-white/[0.05] hover:text-gray-300"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        {/* Thin progress bar at the bottom edge — calm visual countdown. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] bg-white/[0.04]">
          <div
            className="h-full bg-white/40"
            style={{ width: `${(1 - progress) * 100}%`, transition: "width 80ms linear" }}
          />
        </div>
      </div>
    </div>
  );
}
