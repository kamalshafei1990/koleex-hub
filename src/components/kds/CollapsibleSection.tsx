"use client";

import { useState } from "react";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";

/* KDS CollapsibleSection — ELECTED AC-2 by owner 2026-08-02 (Suppliers
   style): rounded-2xl card, tinted header strip with icon chip, a
   one-line preview when collapsed, chevron points right when closed
   (RTL-aware). */

export default function CollapsibleSection({
  icon,
  title,
  preview,
  actions,
  defaultOpen = true,
  children,
  className = "",
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  preview?: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-3 bg-[var(--bg-surface-subtle)]/30 px-4 md:px-5 py-3 text-start cursor-pointer hover:bg-[var(--bg-surface-subtle)]/60 transition-colors ${open ? "border-b border-[var(--border-subtle)]" : ""}`}
      >
        <span className="flex items-center gap-3 min-w-0">
          {icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]" aria-hidden>
              {icon}
            </span>
          )}
          <span className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)] truncate">{title}</span>
          {!open && preview && <span className="ms-1 truncate text-[11px] text-[var(--text-faint)] hidden sm:inline">{preview}</span>}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {actions}
          <AngleDownIcon className={`h-4 w-4 text-[var(--text-faint)] transition-transform ${open ? "" : "-rotate-90 rtl:rotate-90"}`} />
        </span>
      </button>
      {open && <div className="px-4 md:px-5 py-4">{children}</div>}
    </div>
  );
}
