"use client";

/* ---------------------------------------------------------------------------
   AppHomeMenu — canonical Hub-wide "home page navigation" pattern.

   Extracted from InventoryDashboard so every app's home page can render the
   same visual shape:

     1. Grid of icon-tile nav cards (5 cards per row on desktop)
     2. Prominent search bar below

   Each app passes:
     · navItems     — array of nav cards (href, icon, label, colors)
     · searchPlaceholder — placeholder text for the search input
     · searchHref   — destination route that handles the search query
                       (the bar redirects to `${searchHref}?q=<term>`)

   Apps that don't have a dedicated search page can omit searchHref and the
   bar becomes a passive filter input controlled via onSearchSubmit.
   --------------------------------------------------------------------------- */

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

export interface AppHomeNavItem {
  /** Route href — used when onClick is NOT provided (the card renders as a Link). */
  href?: string;
  /** Click handler — when provided, card renders as a <button> instead of <Link>. */
  onClick?: () => void;
  /** Either an RrIcon name (string) or a custom ReactNode (e.g. <SalesIcon size={15} />). */
  icon: RrIconName | ReactNode;
  label: string;
  /** Tailwind classes for the icon chip background (e.g. "bg-blue-500/10"). */
  chipBg: string;
  /** Tailwind classes for the icon color (e.g. "text-blue-400"). */
  chipText: string;
  /** Stable key when href is omitted. */
  key?: string;
}

interface AppHomeMenuProps {
  navItems: AppHomeNavItem[];
  /** Placeholder for the search bar. */
  searchPlaceholder: string;
  /** Destination route — receives `?q=<term>` on submit. */
  searchHref?: string;
  /** Custom submit handler (overrides searchHref). */
  onSearchSubmit?: (term: string) => void;
}

/* Pick a desktop column count so the grid never leaves orphan empty slots.
   Mobile is always 4 cols. Desktop picks the count itself. */
function pickCols(n: number): string {
  if (n <= 4)  return "sm:grid-cols-4";
  if (n === 5) return "sm:grid-cols-5";
  if (n === 6) return "sm:grid-cols-6";
  if (n === 7) return "sm:grid-cols-7";
  if (n === 8) return "sm:grid-cols-8";
  if (n === 9) return "sm:grid-cols-3 lg:grid-cols-9";
  /* 10+: split into two even-ish rows. 10 → 5/5, 11 → 6/5, 12 → 6/6. */
  if (n === 10) return "sm:grid-cols-5";
  if (n === 11) return "sm:grid-cols-6";
  if (n === 12) return "sm:grid-cols-6";
  return "sm:grid-cols-6";
}

export default function AppHomeMenu({
  navItems,
  searchPlaceholder,
  searchHref,
  onSearchSubmit,
}: AppHomeMenuProps) {
  const colsClass = pickCols(navItems.length);
  return (
    <section data-testid="app-home-menu" aria-label="Quick navigate">
      <div className={`grid grid-cols-4 gap-2.5 ${colsClass}`}>
        {navItems.map((item, i) => (
          <HomeNavCard key={item.key ?? item.href ?? `nav-${i}`} {...item} />
        ))}
      </div>
      <div className="mt-3">
        <HomeSearchBar
          placeholder={searchPlaceholder}
          searchHref={searchHref}
          onSearchSubmit={onSearchSubmit}
        />
      </div>
    </section>
  );
}

function HomeNavCard({ href, onClick, icon, label, chipBg, chipText }: AppHomeNavItem) {
  const inner = (
    <>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${chipBg} transition-transform group-hover:scale-110`}>
        {typeof icon === "string" ? (
          <RrIcon name={icon as RrIconName} size={16} className={chipText} />
        ) : (
          <span className={chipText}>{icon}</span>
        )}
      </span>
      <span className="text-[11.5px] font-medium leading-tight text-[var(--text-primary)] tracking-tight">{label}</span>
    </>
  );
  const className = "group flex min-h-[88px] flex-col items-center justify-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-3.5 text-center transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--border-color)] hover:bg-[var(--bg-elevated)] hover:shadow-sm";
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
    if (onSearchSubmit) {
      onSearchSubmit(trimmed);
    } else if (searchHref) {
      router.push(`${searchHref}?q=${encodeURIComponent(trimmed)}`);
    }
  };
  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 transition-all duration-150 focus-within:border-[var(--text-dim)] focus-within:ring-2 focus-within:ring-[var(--border-subtle)] hover:border-[var(--text-ghost)]">
        <RrIcon name="search" size={16} className="shrink-0 text-[var(--text-dim)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-[var(--text-dim)]"
          aria-label="Search"
        />
        {q.trim() && (
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
          >
            Search
          </button>
        )}
        <kbd className="hidden shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-dim)] sm:inline-block">/</kbd>
      </div>
    </form>
  );
}
