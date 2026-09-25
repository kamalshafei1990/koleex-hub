"use client";

/* ---------------------------------------------------------------------------
   DiscussModalShell — shared dimmed backdrop + centred card for Discuss's
   pickers and modals. A real dialog: role="dialog", aria-modal, labelled by
   its title, Escape closes, backdrop click closes, the close button is
   labelled, and focus moves into the dialog on open and back to the opener
   on close.
   --------------------------------------------------------------------------- */

import { useEffect, useId, useRef } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import CrossIcon from "@/components/icons/ui/CrossIcon";

export default function DiscussModalShell({
  title,
  onCancel,
  children,
  width = 480,
  closeLabel = "Close",
}: {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
  width?: number;
  closeLabel?: string;
}) {
  useScrollLock();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  /* Focus in on open (unless a child already took it with autoFocus), and
     back to whatever opened the dialog on close. */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => {
      try { opener?.focus?.(); } catch { /* opener gone */ }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="presentation"
    >
      {/* m-auto centres the panel both axes AND keeps it scrollable if it is
          ever taller than the viewport (items-center would clip the top). */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="m-auto w-full rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden outline-none"
        style={{ maxWidth: width }}
      >
        <div className="h-14 px-5 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <h2 id={titleId} className="text-[14px] font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={closeLabel}
            className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
