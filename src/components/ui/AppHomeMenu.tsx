"use client";

/* ---------------------------------------------------------------------------
   AppHomeMenu — Koleex Hub brand-aligned home-page launcher.

   Restored brand-aligned design: big square tile cards + command-palette
   search bar. Same DNA as the Hub homepage app grid at /.

     [ ICON ]   [ ICON ]   [ ICON ]   [ ICON ]   [ ICON ]
     Label      Label      Label      Label      Label

     [ ICON ]   [ ICON ]   [ ICON ]   [ ICON ]   [ ICON ]
     Label      Label      Label      Label      Label

     ┌─────────────────────────────────────────  ⌘K ──┐
     │ 🔍 Search …                                    │
     └────────────────────────────────────────────────┘

   Use only on the canonical home page of an app — never alongside a
   sub-nav (pill tabs) that surfaces the same routes.
   --------------------------------------------------------------------------- */

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

export interface AppHomeNavItem {
  href?: string;
  onClick?: () => void;
  icon: RrIconName | ReactNode;
  label: string;
  hint?: string;
  key?: string;
  /** @deprecated kept for backward compatibility — tiles are monochrome. */
  chipBg?: string;
  /** @deprecated kept for backward compatibility — tiles are monochrome. */
  chipText?: string;
}

interface AppHomeMenuProps {
  navItems: AppHomeNavItem[];
  searchPlaceholder: string;
  searchHref?: string;
  onSearchSubmit?: (term: string) => void;
}

/* Pick desktop column count so the grid never leaves orphan empty slots.
   Mobile is always 3 cols (matches Hub home's mobile layout). */
function pickCols(n: number): string {
  if (n <= 3)  return "sm:grid-cols-3 lg:grid-cols-3";
  if (n === 4) return "sm:grid-cols-4 lg:grid-cols-4";
  if (n === 5) return "sm:grid-cols-5 lg:grid-cols-5";
  if (n === 6) return "sm:grid-cols-6 lg:grid-cols-6";
  if (n === 7) return "sm:grid-cols-4 lg:grid-cols-7";
  if (n === 8) return "sm:grid-cols-4 lg:grid-cols-8";
  if (n === 9) return "sm:grid-cols-3 lg:grid-cols-9";
  if (n === 10) return "sm:grid-cols-5 lg:grid-cols-5";
  if (n === 11) return "sm:grid-cols-6 lg:grid-cols-6";
  if (n === 12) return "sm:grid-cols-6 lg:grid-cols-6";
  return "sm:grid-cols-6 lg:grid-cols-6";
}

export default function AppHomeMenu({
  navItems,
  searchPlaceholder,
  searchHref,
  onSearchSubmit,
}: AppHomeMenuProps) {
  const colsClass = pickCols(navItems.length);
  return (
    <section data-testid="app-home-menu" aria-label="Quick navigate" className="space-y-4">
      <HomeSearchBar
        placeholder={searchPlaceholder}
        searchHref={searchHref}
        onSearchSubmit={onSearchSubmit}
      />
      <div className={`grid grid-cols-3 gap-3 ${colsClass}`}>
        {navItems.map((item, i) => (
          <HomeNavCard key={item.key ?? item.href ?? `nav-${i}`} {...item} />
        ))}
      </div>
    </section>
  );
}

function HomeNavCard({ href, onClick, icon, label, hint }: AppHomeNavItem) {
  const inner = (
    <>
      <span className="flex h-10 w-10 items-center justify-center text-[var(--text-muted)] transition-all duration-200 group-hover:scale-110 group-hover:text-[var(--text-primary)]">
        {typeof icon === "string" ? (
          <RrIcon name={icon as RrIconName} size={22} />
        ) : (
          icon
        )}
      </span>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[12.5px] font-medium leading-tight tracking-tight text-[var(--text-primary)]">
          {label}
        </span>
        {hint && (
          <span className="text-[10.5px] leading-tight text-[var(--text-dim)]">
            {hint}
          </span>
        )}
      </div>
    </>
  );
  /* aspect-square + rounded-2xl + bg-[var(--bg-card)] + subtle border:
     matches the AppCard pattern from src/app/page.tsx (Hub home). */
  const className = "group relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-color)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] active:translate-y-0 active:scale-[0.97]";
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
      <div className="group flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-4 transition-all duration-200 focus-within:border-[var(--border-focus)] focus-within:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:border-[var(--border-color)]">
        <RrIcon name="search" size={18} className="shrink-0 text-[var(--text-dim)] transition-colors group-focus-within:text-[var(--text-muted)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--text-dim)]"
        />
        {q.trim() ? (
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
          >
            Search
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-dim)] sm:inline-block">
            ⌘K
          </kbd>
        )}
      </div>
    </form>
  );
}
