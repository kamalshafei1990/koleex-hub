"use client";

/* ---------------------------------------------------------------------------
   PageNavPopup — generic overflow popup for app-level navigation.

   Extracted from InventoryNavPopup into a shared primitive. Each app passes
   its own `groups` config (with section labels, accent colors, route cards),
   and this component renders a centered modal listing them.

     · Backdrop click → close
     · ESC → close
     · Section headers: colored left-border accent
     · Cards: rounded icon chip + label + blurb; active route highlighted
   --------------------------------------------------------------------------- */

import { useEffect } from "react";
import Link from "next/link";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

export interface NavCard {
  /** Route path. */
  key: string;
  /** Visible label. */
  label: string;
  /** Icon name. */
  icon: RrIconName;
  /** Short description shown under label. */
  blurb: string;
}

export interface NavGroup {
  /** Stable id (e.g. "do", "lookup", "setup"). */
  id: string;
  /** Group header label. */
  label: string;
  /** Tailwind color tokens for the left-border accent and icon chip. */
  accent: {
    border: string;
    chipBg: string;
    chipText: string;
    header: string;
  };
  items: NavCard[];
}

interface Props {
  open: boolean;
  activeKey: string;
  onClose: () => void;
  /** App icon shown in the popup header. */
  appIcon: RrIconName;
  /** Popup title (e.g. "Inventory"). */
  title: string;
  /** Popup subtitle (e.g. "Pick where to go."). */
  subtitle: string;
  groups: NavGroup[];
}

export default function PageNavPopup({
  open, activeKey, onClose, appIcon, title, subtitle, groups,
}: Props) {
  /* ESC + scroll lock */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="page-nav-popup"
      className="fixed inset-0 z-[130] flex items-stretch justify-center bg-black/65 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-2xl sm:h-auto sm:max-h-[88vh] sm:w-[min(740px,92vw)] sm:rounded-2xl sm:border sm:border-[var(--border-color)]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
            >
              <RrIcon name={appIcon} size={15} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold leading-none tracking-tight">
                {title}
              </h2>
              <div className="mt-1 text-[11.5px] text-[var(--text-dim)]">
                {subtitle}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
          >
            <RrIcon name="cross" size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.id}>
                <div className={`mb-3 flex items-center gap-2 border-l-[3px] pl-2.5 ${g.accent.border}`}>
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${g.accent.header}`}>
                    {g.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {g.items.map((r) => {
                    const isActive = r.key === activeKey;
                    return (
                      <Link
                        key={r.key}
                        href={r.key}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        className={`group flex min-h-[88px] flex-col gap-2 rounded-xl border p-3.5 transition-colors ${
                          isActive
                            ? "border-[var(--border-color)] bg-[var(--bg-secondary)] ring-1 ring-[var(--border-color)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/60 hover:border-[var(--border-color)] hover:bg-[var(--bg-secondary)]"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${g.accent.chipBg} ${g.accent.chipText}`}
                        >
                          <RrIcon name={r.icon} size={14} />
                        </span>
                        <div>
                          <div className="text-[13px] font-medium leading-tight tracking-tight text-[var(--text-primary)]">
                            {r.label}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-dim)]">
                            {r.blurb}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
