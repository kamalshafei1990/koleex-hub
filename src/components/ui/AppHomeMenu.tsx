"use client";

/* ---------------------------------------------------------------------------
   AppHomeMenu — Koleex Hub brand-aligned quick-launch row + command-palette search.

   Redesigned (UNI-14): cards are now compact horizontal rectangles, not big
   square tiles. They sit quietly above the actual dashboard content rather
   than dominating it.

     [icon] Label                    [count]
     ──────────────────────────────────────
     Compact 56px-tall card · 4 per row · cleaner

   · Apps pass nav items (with optional count/hint)
   · Search bar collapses on focus-out — small and unobtrusive
   · Mobile: 2 per row, stacks gracefully
   --------------------------------------------------------------------------- */

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

export interface AppHomeNavItem {
  /** Route href — used when onClick is NOT provided. */
  href?: string;
  /** Click handler — when provided, card renders as a <button>. */
  onClick?: () => void;
  /** RrIcon name OR custom ReactNode. */
  icon: RrIconName | ReactNode;
  label: string;
  /** Optional small count / stat shown on the right. */
  count?: string | number;
  /** Optional muted hint below the label. */
  hint?: string;
  /** Stable key when href is omitted. */
  key?: string;
  /** @deprecated — kept for backward compatibility. */
  chipBg?: string;
  /** @deprecated — kept for backward compatibility. */
  chipText?: string;
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
      {/* Compact search */}
      <HomeSearchBar
        placeholder={searchPlaceholder}
        searchHref={searchHref}
        onSearchSubmit={onSearchSubmit}
      />

      {/* Compact horizontal quick-launch row — 4 per row on desktop, 2 on mobile */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
        {navItems.map((item, i) => (
          <HomeNavCard key={item.key ?? item.href ?? `nav-${i}`} {...item} />
        ))}
      </div>
    </section>
  );
}

function HomeNavCard({ href, onClick, icon, label, count, hint }: AppHomeNavItem) {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors group-hover:bg-[var(--bg-surface-hover)] group-hover:text-[var(--text-primary)]">
        {typeof icon === "string" ? (
          <RrIcon name={icon as RrIconName} size={15} />
        ) : (
          icon
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12.5px] font-medium leading-tight tracking-tight text-[var(--text-primary)]">
          {label}
        </span>
        {hint && (
          <span className="truncate text-[10.5px] leading-tight text-[var(--text-dim)]">
            {hint}
          </span>
        )}
      </div>
      {count !== undefined && count !== "" && (
        <span className="shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-[var(--text-muted)]">
          {count}
        </span>
      )}
    </>
  );
  const className = "group flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2.5 transition-all duration-150 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] active:scale-[0.98]";
  if (onClick) {
    return <button type="button" onClick={onClick} className={className}>{inner}</button>;
  }
  return <Link href={href ?? "#"} className={className}>{inner}</Link>;
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
      <div className="group flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 transition-all duration-150 focus-within:border-[var(--border-focus)] hover:border-[var(--border-color)]">
        <RrIcon name="search" size={15} className="shrink-0 text-[var(--text-dim)] transition-colors group-focus-within:text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]"
        />
        {q.trim() ? (
          <button
            type="submit"
            className="shrink-0 rounded-md bg-[var(--bg-inverted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
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
