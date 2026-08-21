"use client";

/* KDS FormModal — PROMOTED from admin/form-sections/Modal on 2026-08-07.
   The kit's SECOND modal tier: chromed form dialog (header bar + subtitle +
   X close, Escape + body scroll-lock, scrollable body, pinned right-aligned
   footer) for heavy create/edit forms. Visuals unchanged by the promotion —
   this is a re-homing, not a redesign. The elected MD-4 Modal stays the
   default for light dialogs. */

import { useEffect, useRef } from "react";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import { usePresence } from "./usePresence";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export default function Modal({ open, onClose, title, subtitle, children, footer, width = "max-w-xl" }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  /* Motion (owner-approved system 2026-08-21): pop in, shrink away. */
  const { mounted, closing } = usePresence(open);
  if (!mounted) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-150 ${closing ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      <div className={`${width} kx-glass-pop ${closing ? "kx-pop-closing" : ""} w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl shadow-black/40 flex flex-col max-h-[85vh]`}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[var(--border-subtle)] shrink-0">
          <div>
            <h3 className="text-[16px] font-bold text-[var(--text-primary)]">{title}</h3>
            {subtitle && <p className="text-[12px] text-[var(--text-dim)] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-ghost)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--border-subtle)] shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
