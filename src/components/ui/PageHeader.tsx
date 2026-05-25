"use client";

/* ---------------------------------------------------------------------------
   PageHeader — Odoo-style compact app menu bar (Koleex brand).

   Single horizontal row with everything inline:

   ┌─────────────────────────────────────────────────────────────────────┐
   │ [←] [icon] App Name · Page · Sub · Actions ··· ▾    [+ New] [🔍 …]  │
   └─────────────────────────────────────────────────────────────────────┘

   · Back arrow (auto-computes parent path)
   · App icon chip + app name (small, top-left)
   · Inline menu items (text links, hover underline) — primary navigation
   · "···" overflow → dropdown menu for secondary routes
   · Right side: action buttons + controls (search, filters, etc.)

   Optional second row only when needed for page-specific subtitle.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, isValidElement, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import type { NavGroup } from "@/components/ui/PageNavPopup";

export interface PageTab {
  key: string;
  label: string;
  /** RrIcon name OR custom ReactNode. Optional. */
  icon?: RrIconName | ReactNode;
  /** When provided, tab renders as a state-toggle button. */
  onClick?: () => void;
  /** Force-mark this tab as active (useful for state-based apps). */
  active?: boolean;
}

export interface PageHeaderProps {
  /** App / page title (e.g. "Inventory", "Sales", "Finance"). */
  title: string;
  /** Optional secondary subtitle shown on a second row when present. */
  subtitle?: string;
  /** App icon — RrIcon name or custom ReactNode. */
  icon: RrIconName | ReactNode;
  /** Back-arrow destination. Auto-computes parent path if omitted. */
  backHref?: string;
  /** Action button slot (right side). */
  action?: ReactNode;
  /** Controls slot — search, filter, view-mode icons (right side). */
  controls?: ReactNode;
  /** Optional secondary meta row (status pills, counts). */
  meta?: ReactNode;
  /** Inline menu items shown after the app name. */
  tabs?: PageTab[];
  /** Items shown only inside the "···" dropdown popup. */
  overflowTabs?: NavGroup[];
  /** Popup title (header of dropdown). */
  popupTitle?: string;
  /** Popup subtitle. */
  popupSubtitle?: string;
  /** Hide the inline menu strip (e.g. on detail pages). */
  showTabs?: boolean;
}

function parentPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  if (idx <= 0) return "/";
  return trimmed.slice(0, idx);
}

export default function PageHeader({
  title,
  subtitle,
  icon,
  backHref,
  action,
  controls,
  meta,
  tabs,
  overflowTabs,
  popupTitle,
  popupSubtitle,
  showTabs = true,
}: PageHeaderProps) {
  const pathname = usePathname() ?? "";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const resolvedBackHref = backHref ?? parentPath(pathname);

  const hasTabs = showTabs && tabs && tabs.length > 0;
  const hasOverflow = overflowTabs && overflowTabs.length > 0;

  /* Longest-prefix match — detail pages still light the right tab. */
  const allKeys = [
    ...(tabs?.map((t) => t.key) ?? []),
    ...(overflowTabs?.flatMap((g) => g.items.map((i) => i.key)) ?? []),
  ];
  const active =
    allKeys
      .slice()
      .sort((a, b) => b.length - a.length)
      .find((k) => pathname === k || (k !== resolvedBackHref && pathname.startsWith(k + "/"))) ??
    (tabs?.[0]?.key ?? "");

  /* Close dropdown on outside click / Escape */
  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDropdownOpen(false); };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [dropdownOpen]);

  return (
    <div>
      {/* ── Compact Odoo-style menu row ───────────────────────────── */}
      <div className="flex h-12 items-center gap-2 border-b border-[var(--border-subtle)]">
        {/* Back arrow */}
        <Link
          href={resolvedBackHref}
          aria-label="Back"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
        >
          <RrIcon name="arrow-left" size={15} />
        </Link>

        {/* App icon + name */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-primary)]">
            {typeof icon === "string" ? (
              <RrIcon name={icon as RrIconName} size={16} />
            ) : isValidElement(icon) ? (
              icon
            ) : null}
          </span>
          <span className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
            {title}
          </span>
        </div>

        {/* Inline menu items */}
        {hasTabs && (
          <nav
            aria-label={`${title} navigation`}
            className="ml-2 flex flex-1 items-center gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs!.map((tab) => {
              const isActive = tab.active ?? (tab.key === active);
              const tabClassName = `relative inline-flex h-12 shrink-0 items-center gap-1.5 px-3 text-[13px] transition-colors duration-150 ${
                isActive
                  ? "font-medium text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`;
              const tabInner = (
                <>
                  {tab.icon && (
                    <span aria-hidden className={isActive ? "" : "text-[var(--text-dim)]"}>
                      {typeof tab.icon === "string" ? (
                        <RrIcon name={tab.icon as RrIconName} size={12} />
                      ) : (
                        tab.icon
                      )}
                    </span>
                  )}
                  {tab.label}
                  {isActive && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-[var(--text-primary)]"
                    />
                  )}
                </>
              );
              if (tab.onClick) {
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={tab.onClick}
                    aria-current={isActive ? "page" : undefined}
                    className={tabClassName}
                  >
                    {tabInner}
                  </button>
                );
              }
              return (
                <Link
                  key={tab.key}
                  href={tab.key}
                  aria-current={isActive ? "page" : undefined}
                  className={tabClassName}
                >
                  {tabInner}
                </Link>
              );
            })}

            {hasOverflow && (
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((v) => !v)}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
                  className="inline-flex h-12 shrink-0 items-center gap-1 px-3 text-[13px] text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text-primary)]"
                >
                  More
                  <span aria-hidden className="text-[10px]">▾</span>
                </button>
                {dropdownOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-50 mt-1 w-[280px] overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
                  >
                    {overflowTabs!.map((group) => (
                      <div key={group.id} className="py-1.5">
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
                          {group.label}
                        </div>
                        {group.items.map((item) => (
                          <Link
                            key={item.key}
                            href={item.key}
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                          >
                            <RrIcon name={item.icon} size={13} className="text-[var(--text-dim)]" />
                            <span>{item.label}</span>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
        )}

        {/* Spacer to push controls to the right when no menu */}
        {!hasTabs && <div className="flex-1" />}

        {/* Right slot: controls + action */}
        {(controls || action) && (
          <div className="flex shrink-0 items-center gap-2 pl-2">
            {controls}
            {action}
          </div>
        )}
      </div>

      {/* Optional page-subtitle row */}
      {subtitle && (
        <div className="border-b border-[var(--border-subtle)] py-2.5">
          <p className="text-[12.5px] text-[var(--text-muted)]">{subtitle}</p>
        </div>
      )}

      {/* Optional meta row (kept for back-compat) */}
      {meta && <div className="mt-3">{meta}</div>}

      {/* PageNavPopup is no longer rendered separately — overflow lives in the dropdown above */}
      {popupTitle === "__unused__" || popupSubtitle === "__unused__" ? null : null}
    </div>
  );
}
