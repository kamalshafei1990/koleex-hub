"use client";

/* ---------------------------------------------------------------------------
   PageHeader — the canonical Hub-wide app header.

   Extracted from InventoryHeader (INV-H10) into a generic primitive so every
   app (Sales, Purchase, HR, Finance, Expenses, Projects, Operations, ...)
   shares the same chrome:

     [←] [appIcon] App · {title}                  {controls}{action}
     ──────────────────────────────────────────────────────────────────
     [Tab1] [Tab2] [Tab3] [Tab4] [Tab5] [Tab6] [···]

   · Back arrow → backHref (default "/")
   · App icon chip — app identity
   · Title (h1) + optional inline muted subtitle (hidden on mobile)
   · Action slot on the right (any ReactNode)
   · Optional tab strip with horizontal scroll + overflow ··· popup
   · `showTabs` prop to hide tabs on detail pages

   Each app passes its own `tabs` + `overflowTabs` config so this stays
   layout-only and never hardcodes app-specific routes.
   --------------------------------------------------------------------------- */

import { useState, isValidElement, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import PageNavPopup, { type NavGroup } from "@/components/ui/PageNavPopup";

export interface PageTab {
  /** Route path (must match next/router pathname). */
  key: string;
  /** Visible label. */
  label: string;
  /** Icon name from RrIcon set. */
  icon: RrIconName;
}

export interface PageHeaderProps {
  /** Page title (h1). */
  title: string;
  /** Optional subtitle shown inline next to title (hidden on mobile). */
  subtitle?: string;
  /** App icon — either an RrIcon name (string) or a custom ReactNode (e.g. SalesIcon size={16}). */
  icon: RrIconName | ReactNode;
  /** Back-arrow link target. Defaults to "/". */
  backHref?: string;
  /** Right-side action slot (button, link, etc.). */
  action?: ReactNode;
  /** Secondary right-side controls slot (filters, toggles, etc.). */
  controls?: ReactNode;
  /** Optional secondary line under the title row (status pills, counts). */
  meta?: ReactNode;
  /** Primary tabs shown horizontally in the tab strip. */
  tabs?: PageTab[];
  /** Optional secondary routes shown only in the ··· overflow popup. */
  overflowTabs?: NavGroup[];
  /** Popup title (e.g. "Inventory"). Required if overflowTabs given. */
  popupTitle?: string;
  /** Popup subtitle (e.g. "Pick where to go."). */
  popupSubtitle?: string;
  /** Hide the tab strip (e.g. detail pages). */
  showTabs?: boolean;
}

export default function PageHeader({
  title,
  subtitle,
  icon,
  backHref = "/",
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
  const [menuOpen, setMenuOpen] = useState(false);

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
      .find((k) => pathname === k || (k !== backHref && pathname.startsWith(k + "/"))) ??
    (tabs?.[0]?.key ?? "");

  return (
    <div>
      {/* ── Title row ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {/* Back arrow */}
          <Link
            href={backHref}
            aria-label="Back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] transition-colors hover:border-[var(--border-color)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <RrIcon name="arrow-left" size={16} />
          </Link>

          {/* App identity icon chip */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
            {typeof icon === "string" ? (
              <RrIcon name={icon as RrIconName} size={16} />
            ) : isValidElement(icon) ? (
              icon
            ) : null}
          </div>

          {/* Title + stacked subtitle */}
          <div className="flex min-w-0 flex-col">
            <h1 className="text-[20px] font-bold tracking-tight leading-tight text-[var(--text-primary)] md:text-[22px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 truncate text-[12px] leading-snug text-[var(--text-dim)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right slot: controls + action */}
        {(controls || action) && (
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            {action}
          </div>
        )}
      </div>

      {/* Optional meta row */}
      {meta && <div className="mt-3">{meta}</div>}

      {/* ── Tab strip — bigger tap targets, calmer hover ──────────── */}
      {hasTabs && (
        <nav
          aria-label={`${title} navigation`}
          className="mt-5 flex items-end gap-0.5 overflow-x-auto border-b border-[var(--border-subtle)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs!.map((tab) => {
            const isActive = tab.key === active;
            return (
              <Link
                key={tab.key}
                href={tab.key}
                aria-current={isActive ? "page" : undefined}
                title={tab.label}
                className={`inline-flex h-11 shrink-0 items-center gap-1.5 px-3.5 text-[12.5px] font-medium transition-colors duration-150 ${
                  isActive
                    ? "border-b-2 border-[var(--text-primary)] pb-0 text-[var(--text-primary)]"
                    : "border-b-2 border-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span aria-hidden className={isActive ? "" : "text-[var(--text-ghost)]"}>
                  <RrIcon name={tab.icon} size={13} />
                </span>
                {tab.label}
              </Link>
            );
          })}

          {hasOverflow && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              data-testid="page-nav-menu-trigger"
              aria-label="More routes"
              title="More"
              className="ml-1 inline-flex h-11 shrink-0 items-center gap-1 border-b-2 border-transparent px-3 text-[12.5px] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
            >
              <RrIcon name="books" size={13} />
              <span className="tracking-widest">···</span>
            </button>
          )}
        </nav>
      )}

      {hasOverflow && (
        <PageNavPopup
          open={menuOpen}
          activeKey={active}
          onClose={() => setMenuOpen(false)}
          appIcon={typeof icon === "string" ? (icon as RrIconName) : "books"}
          title={popupTitle ?? title}
          subtitle={popupSubtitle ?? "Pick where to go."}
          groups={overflowTabs!}
        />
      )}
    </div>
  );
}
