"use client";

/* ---------------------------------------------------------------------------
   AppHomeMenu — Koleex Hub canonical single-menu pattern.

   ONE clean horizontal pill row. Each app passes its full set of nav items
   (with optional counts + active state). No duplicate filter strips, no big
   square tile grid — just a single, scannable, compact menu.

     ┌─────────────────────────────────────────────  ⌘K ──┐
     │ 🔍 Search …                                        │
     └─────────────────────────────────────────────────────┘

     [✓ All · 42]  [⏰ Unpaid · 2]  [✓ Paid · 40]  [⚠ Overdue · 0]
     [+ New]      [📚 Categories]   [🛡 Approvals]   [📊 Analytics]

   Active pill (white background, black text) shows the current filter or
   default view. Inactive pills have a subtle border + surface bg + hover.
   --------------------------------------------------------------------------- */

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

export interface AppHomeNavItem {
  /** Route href — used when onClick is NOT provided. */
  href?: string;
  /** Click handler — when provided, item renders as a <button>. */
  onClick?: () => void;
  /** RrIcon name OR custom ReactNode. */
  icon: RrIconName | ReactNode;
  label: string;
  /** Optional count badge (number or string like "42", "+12"). */
  count?: string | number;
  /** Mark this item as the active filter/section. */
  active?: boolean;
  /** Stable key when href is omitted. */
  key?: string;
  /** @deprecated kept for backward compat */
  chipBg?: string;
  /** @deprecated kept for backward compat */
  chipText?: string;
  /** @deprecated kept for backward compat */
  hint?: string;
}

interface AppHomeMenuProps {
  navItems: AppHomeNavItem[];
  searchPlaceholder: string;
  searchHref?: string;
  onSearchSubmit?: (term: string) => void;
}

export default function AppHomeMenu({
  navItems,
  searchPlaceholder,
  searchHref,
  onSearchSubmit,
}: AppHomeMenuProps) {
  return (
    <section data-testid="app-home-menu" aria-label="Quick navigate" className="space-y-3">
      {/* Compact, clean search bar */}
      <HomeSearchBar
        placeholder={searchPlaceholder}
        searchHref={searchHref}
        onSearchSubmit={onSearchSubmit}
      />

      {/* Single horizontal pill row — all nav items live here */}
      <nav
        aria-label="App navigation"
        className="flex flex-wrap items-center gap-2"
      >
        {navItems.map((item, i) => (
          <HomePill key={item.key ?? item.href ?? `nav-${i}`} {...item} />
        ))}
      </nav>
    </section>
  );
}

function HomePill({ href, onClick, icon, label, count, active }: AppHomeNavItem) {
  const isActive = !!active;
  const baseClass = `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-medium transition-all duration-200 ${
    isActive
      ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] shadow-sm"
      : "border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
  }`;
  const inner = (
    <>
      <span aria-hidden className={isActive ? "" : "text-[var(--text-dim)]"}>
        {typeof icon === "string" ? (
          <RrIcon name={icon as RrIconName} size={13} />
        ) : (
          icon
        )}
      </span>
      <span>{label}</span>
      {count !== undefined && count !== "" && (
        <span
          className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
            isActive
              ? "bg-[var(--text-inverted)]/15 text-[var(--text-inverted)]"
              : "bg-[var(--bg-surface)] text-[var(--text-dim)]"
          }`}
        >
          {count}
        </span>
      )}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClass} aria-current={isActive ? "page" : undefined}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href ?? "#"} className={baseClass} aria-current={isActive ? "page" : undefined}>
      {inner}
    </Link>
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
      <div className="group flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 transition-all duration-200 focus-within:border-[var(--border-focus)] hover:border-[var(--border-color)]">
        <RrIcon name="search" size={16} className="shrink-0 text-[var(--text-dim)] transition-colors group-focus-within:text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-[var(--text-dim)]"
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
