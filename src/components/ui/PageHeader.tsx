"use client";

/* ---------------------------------------------------------------------------
   PageHeader — Koleex Hub canonical app header (Hero → Search → Menu).

   Three distinct stacked sections shared across every app:

     ┌─────────────────────────────────────────────────────────────────┐
     │ [←] [📦]  App Name                          [action] [actions]  │   ← Hero
     │           Subtitle text                                          │
     ├─────────────────────────────────────────────────────────────────┤
     │ 🔍 Search …                                              ⌘K     │   ← Search
     ├─────────────────────────────────────────────────────────────────┤
     │ [Home] [Items] [Movements] [Transfers] [Returns] [Balances] ▾   │   ← Menu
     └─────────────────────────────────────────────────────────────────┘

   · Back arrow auto-computes parent path (e.g. /inventory/items → /inventory)
   · App icon + name + optional subtitle form a clean visual hero
   · Search bar in the middle band — same shape on every app
   · Menu pills at the bottom — text + active state + "More ▾" overflow
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, isValidElement, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import type { NavGroup } from "@/components/ui/PageNavPopup";

/* Sliding-pill geometry — change in one place. */
const TAB_WIDTH_LG = 148;
const TAB_WIDTH_MD = 120;
const TRACK_PADDING = 6;

export interface PageTab {
  key: string;
  label: string;
  icon?: RrIconName | ReactNode;
  /** When provided, tab renders as a state-toggle button. */
  onClick?: () => void;
  /** Force-mark this tab as active (useful for state-based apps). */
  active?: boolean;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
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
  /** Search bar placeholder. Omit to hide the search bar entirely. */
  searchPlaceholder?: string;
  /** Destination route — receives ?q=<term> on submit. */
  searchHref?: string;
  /** Custom submit handler (overrides searchHref). */
  onSearchSubmit?: (term: string) => void;
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
  popupTitle: _popupTitle,
  popupSubtitle: _popupSubtitle,
  showTabs = true,
  searchPlaceholder,
  searchHref,
  onSearchSubmit,
}: PageHeaderProps) {
  const pathname = usePathname() ?? "";
  const resolvedBackHref = backHref ?? parentPath(pathname);

  /* Flatten any overflow groups into the main tab list so every item
     is visible inline (no "More" dropdown). De-dup by key to avoid
     showing the same route twice when a primary tab also appears in
     overflow groups. */
  const tabsFromOverflow: PageTab[] =
    overflowTabs?.flatMap((g) =>
      g.items.map((i) => ({ key: i.key, label: i.label, icon: i.icon }))
    ) ?? [];
  const tabSet = new Set<string>();
  const mergedTabs: PageTab[] = [];
  for (const tab of [...(tabs ?? []), ...tabsFromOverflow]) {
    if (tabSet.has(tab.key)) continue;
    tabSet.add(tab.key);
    mergedTabs.push(tab);
  }

  const hasTabs = showTabs && mergedTabs.length > 0;
  const hasSearch = !!searchPlaceholder;

  /* Longest-prefix match — detail pages still light the right tab. */
  const allKeys = mergedTabs.map((t) => t.key);
  const active =
    allKeys
      .slice()
      .sort((a, b) => b.length - a.length)
      .find((k) => pathname === k || (k !== resolvedBackHref && pathname.startsWith(k + "/"))) ??
    (mergedTabs[0]?.key ?? "");

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Hero row: back + icon + name + subtitle + actions ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="flex min-w-0 items-center gap-3 sm:items-start sm:gap-4">
          <Link
            href={resolvedBackHref}
            aria-label="Back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] sm:h-10 sm:w-10"
          >
            <RrIcon name="arrow-left" size={16} />
          </Link>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] sm:h-10 sm:w-10">
            {typeof icon === "string" ? (
              <RrIcon name={icon as RrIconName} size={18} />
            ) : isValidElement(icon) ? (
              icon
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col">
            <h1 className="text-[20px] font-bold tracking-tight leading-tight text-[var(--text-primary)] sm:text-[24px] md:text-[26px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--text-muted)] sm:mt-1 sm:text-[13px]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {(controls || action) && (
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            {action}
          </div>
        )}
      </div>

      {meta && <div>{meta}</div>}

      {/* ── Search row ───────────────────────────────────────────── */}
      {hasSearch && (
        <HomeSearchBar
          placeholder={searchPlaceholder!}
          searchHref={searchHref}
          onSearchSubmit={onSearchSubmit}
        />
      )}

      {/* ── Menu row — sliding pill ────────────────────────────── */}
      {hasTabs && (
        <SlidingPillNav
          tabs={mergedTabs}
          activeKey={active}
          ariaLabel={`${title} navigation`}
        />
      )}
    </div>
  );
}

/* ===========================================================================
   SlidingPillNav — single white pill that slides between fixed-width tabs.
   One DOM pill, no per-tab background, no width animation (only `left`).
   =========================================================================== */
function SlidingPillNav({
  tabs,
  activeKey,
  ariaLabel,
}: {
  tabs: PageTab[];
  activeKey: string;
  ariaLabel: string;
}) {
  const [tabWidth, setTabWidth] = useState<number>(TAB_WIDTH_LG);
  const trackRef = useRef<HTMLDivElement>(null);

  /* Responsive tab width — 148px on ≥900px, 120px below. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setTabWidth(mq.matches ? TAB_WIDTH_MD : TAB_WIDTH_LG);
    update();
    const handler = (e: MediaQueryListEvent) => setTabWidth(e.matches ? TAB_WIDTH_MD : TAB_WIDTH_LG);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* Active index — supports both forced `tab.active` and longest-prefix `activeKey`. */
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => (t.active ?? (t.key === activeKey))),
  );

  /* Roving tabindex — arrow keys move focus between tabs. */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const els = trackRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    if (!els || els.length === 0) return;
    const list = Array.from(els);
    const focused = list.findIndex((el) => el === document.activeElement);
    const start = focused >= 0 ? focused : activeIndex;
    const delta = e.key === "ArrowLeft" ? -1 : 1;
    const next = (start + delta + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <nav
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="relative inline-flex max-w-full overflow-x-auto rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* The single sliding pill — only `left` animates */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1.5 bottom-1.5 rounded-[10px] bg-[var(--bg-inverted)] shadow-[0_1px_0_rgba(255,255,255,0.2),0_6px_20px_rgba(0,0,0,0.4)] transition-[left] duration-[350ms] ease-[cubic-bezier(.22,.61,.36,1)]"
        style={{
          left: `${TRACK_PADDING + activeIndex * tabWidth}px`,
          width: `${tabWidth}px`,
        }}
      />

      {tabs.map((tab, i) => {
        const isActive = i === activeIndex;
        const tabClass =
          "relative z-10 inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap py-2.5 text-[13px] outline-none transition-colors duration-[250ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,255,255,0.6)] " +
          (isActive
            ? "font-semibold text-[var(--text-inverted)]"
            : "font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]");
        const inner = (
          <>
            {tab.icon && (
              <span aria-hidden className={isActive ? "opacity-90" : "opacity-70"}>
                {typeof tab.icon === "string" ? (
                  <RrIcon name={tab.icon as RrIconName} size={14} />
                ) : (
                  tab.icon
                )}
              </span>
            )}
            <span>{tab.label}</span>
          </>
        );
        const baseProps = {
          role: "tab" as const,
          "aria-selected": isActive,
          tabIndex: isActive ? 0 : -1,
          style: { width: `${tabWidth}px` },
          className: tabClass,
        };
        if (tab.onClick) {
          return (
            <button key={tab.key} type="button" onClick={tab.onClick} {...baseProps}>
              {inner}
            </button>
          );
        }
        return (
          <Link key={tab.key} href={tab.key} {...baseProps}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}

function HomeSearchBar({
  placeholder,
  searchHref,
  onSearchSubmit,
}: {
  placeholder: string;
  searchHref?: string;
  onSearchSubmit?: (term: string) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    if (onSearchSubmit) onSearchSubmit(trimmed);
    else if (searchHref) router.push(`${searchHref}?q=${encodeURIComponent(trimmed)}`);
  };
  return (
    <form onSubmit={handleSubmit}>
      <div className="group flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 transition-all duration-200 focus-within:border-[var(--border-focus)] hover:border-[var(--border-color)] sm:gap-3 sm:px-4 sm:py-3">
        <RrIcon name="search" size={15} className="shrink-0 text-[var(--text-dim)] transition-colors group-focus-within:text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)] sm:text-[13.5px]"
        />
        {q.trim() ? (
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
          >
            Search
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--text-dim)] sm:inline-block">
            ⌘K
          </kbd>
        )}
      </div>
    </form>
  );
}
