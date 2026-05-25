"use client";

/* ---------------------------------------------------------------------------
   PageHeader — Koleex Hub brand-aligned app header.

   Matches the visual language of the Hub homepage (/):
     · Large bold title (28–32px) — same scale as "Good evening, Kamal"
     · Muted subtitle on its own line for proper hierarchy
     · Generous whitespace and breathing room
     · Pill-shaped tabs (rounded-full) — same as Hub category chips
     · Back arrow + identity icon as compact circular controls
     · Optional ··· overflow popup for secondary routes

   Each app passes its own tabs config and identity icon; chrome is identical.
   --------------------------------------------------------------------------- */

import { useState, isValidElement, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import PageNavPopup, { type NavGroup } from "@/components/ui/PageNavPopup";

export interface PageTab {
  key: string;
  label: string;
  icon: RrIconName;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** App icon — RrIcon name string OR custom ReactNode (e.g. SalesIcon). */
  icon: RrIconName | ReactNode;
  backHref?: string;
  action?: ReactNode;
  controls?: ReactNode;
  meta?: ReactNode;
  tabs?: PageTab[];
  overflowTabs?: NavGroup[];
  popupTitle?: string;
  popupSubtitle?: string;
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
      {/* ── Hero title row — bold + generous (matches Hub home greeting) ── */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {/* Back arrow */}
          <Link
            href={backHref}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
          >
            <RrIcon name="arrow-left" size={16} />
          </Link>

          {/* Identity icon chip — squared to match Hub app cards */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]">
            {typeof icon === "string" ? (
              <RrIcon name={icon as RrIconName} size={18} />
            ) : isValidElement(icon) ? (
              icon
            ) : null}
          </div>

          {/* Title + subtitle — large + breathing room */}
          <div className="flex min-w-0 flex-col">
            <h1 className="text-[26px] font-bold tracking-tight leading-tight text-[var(--text-primary)] md:text-[30px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">
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
      {meta && <div className="mt-4">{meta}</div>}

      {/* ── Tab strip — pill chips like Hub category filters ──────────── */}
      {hasTabs && (
        <nav
          aria-label={`${title} navigation`}
          className="mt-6 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs!.map((tab) => {
            const isActive = tab.key === active;
            return (
              <Link
                key={tab.key}
                href={tab.key}
                aria-current={isActive ? "page" : undefined}
                title={tab.label}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] shadow-sm"
                    : "border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                <RrIcon name={tab.icon} size={12} className={isActive ? "" : "text-[var(--text-dim)]"} />
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
              className="ml-0.5 inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-[var(--text-muted)] transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
            >
              <RrIcon name="books" size={12} />
              <span className="ml-1 tracking-widest text-[11px]">···</span>
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
