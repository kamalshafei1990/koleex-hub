"use client";

/* KDS Modal — ELECTED MD-4 by owner 2026-08-02 (Suppliers style):
   chromeless padded card — no header bar, no footer rule. Title is an
   inline row; actions sit left-aligned, primary first, cancel as a
   ghost/text sibling. Backdrop dim + blur is law (kds-1 §2).
   Motion (owner-approved system 2026-08-21): pops in, shrinks away. */

import { usePresence } from "./usePresence";

export default function Modal({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: string;
}) {
  const { mounted, closing } = usePresence(open);
  if (!mounted) return null;
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm transition-opacity duration-150 ${closing ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`kx-glass-pop kx-pop-in ${closing ? "kx-pop-closing" : ""} w-full ${maxWidth} space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 max-h-[88vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <p className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</p>}
        {children}
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
