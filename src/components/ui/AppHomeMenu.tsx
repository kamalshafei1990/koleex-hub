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

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { useShortcutHint } from "@/lib/ui/use-shortcut-hint";

/* Smart global suggestions — group presentation. Labels default to English;
   hosts pass suggestLabels for zh/ar. */
type SuggestItem = { id: string; title: string; subtitle: string | null; href: string; icon?: string };
type SuggestGroup = { key: string; items: SuggestItem[] };
const GROUP_META: Record<string, { icon: RrIconName; en: string }> = {
  templates: { icon: "palette", en: "Templates" },
  reports: { icon: "file", en: "Reports" },
  products: { icon: "box-open", en: "Products" },
  contacts: { icon: "users", en: "Contacts" },
  todos: { icon: "clipboard", en: "To-do" },
  notes: { icon: "pencil", en: "Notes" },
};

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
  /** Live variant of onSearchSubmit: fires on every keystroke so hosts that
      filter-as-you-type (Reports) don't feel dead until Enter is pressed. */
  onSearchChange?: (term: string) => void;
  /** Smart global suggestions: as you type, a dropdown offers matches from
      across the whole Hub (reports, products, contacts, todos, notes) via
      /api/search/global. Enter on a suggestion deep-links to it; Enter on
      the bare term still runs onSearchSubmit. */
  globalSuggest?: boolean;
  /** Localised group titles for the dropdown, keyed by group key. */
  suggestLabels?: Record<string, string>;
  /** When true, hide the built-in search bar (the host page provides its own). */
  hideSearch?: boolean;
}

export default function AppHomeMenu({
  navItems,
  searchPlaceholder,
  searchHref,
  onSearchSubmit,
  onSearchChange,
  globalSuggest = false,
  suggestLabels,
  hideSearch = false,
}: AppHomeMenuProps) {
  return (
    /* data-kx-pane so the Hub's existing guard
       `:is(.kx-pd,.kx-app) :is(main,aside,[data-kx-pane]) { overflow-x: clip }`
       catches this block. Measured on Orders at 375px: this section reported
       clientWidth 375 against scrollWidth 379 — FOUR pixels, from the `-mx-1`
       on the pill row inside it. Four pixels of horizontal scroll inside a
       vertical scroller is invisible with a mouse and a pane that slides
       under a finger on a touch screen, which is exactly the defect the guard
       was written for; it simply never matched a <section>. One attribute
       fixes it in all nine apps that use this menu. */
    <section
      data-testid="app-home-menu"
      data-kx-pane
      aria-label="Quick navigate"
      className="space-y-3"
    >
      {/* Compact, clean search bar */}
      {!hideSearch && (
        <HomeSearchBar
          placeholder={searchPlaceholder}
          searchHref={searchHref}
          onSearchSubmit={onSearchSubmit}
          onSearchChange={onSearchChange}
          globalSuggest={globalSuggest}
          suggestLabels={suggestLabels}
        />
      )}

      {/* Single horizontal pill row — scrolls on mobile, wraps on desktop */}
      <nav
        aria-label="App navigation"
        className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:gap-2 sm:px-0 sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {navItems.map((item, i) => {
          const { key: itemKey, ...rest } = item;
          return <HomePill key={itemKey ?? item.href ?? `nav-${i}`} {...rest} />;
        })}
      </nav>
    </section>
  );
}

function HomePill({ href, onClick, icon, label, count, active }: AppHomeNavItem) {
  const isActive = !!active;
  /* IDENTITY HOOKS ONLY — no paint decisions here. This component is shared by
     nine apps and most of them are still Core, so the Aurora look lives in
     globals bound to `:is(.kx-pd, .kx-app)`: the app converts, these hooks
     light up, and nothing else in the Hub moves. Same arrangement PageHeader
     uses with .kx-ph-band / .kx-ph-tabs / .kx-ph-search.

     Both states need one. Inactive is filled with `--bg-card`, a solid #111
     the Aurora remap does not cover, so it stays an opaque slab on a glass
     page; active is `--bg-inverted`, a solid white block, which is Core's
     selection language and the loudest flat shape that can sit on glass. */
  const baseClass = `kx-ahm-pill inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12px] font-medium transition-all duration-200 sm:h-9 sm:px-4 sm:text-[12.5px] ${
    isActive
      ? "kx-ahm-pill-on bg-[var(--bg-inverted)] text-[var(--text-inverted)] shadow-sm"
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
  onSearchChange,
  globalSuggest = false,
  suggestLabels,
}: {
  placeholder: string;
  searchHref?: string;
  onSearchSubmit?: (term: string) => void;
  onSearchChange?: (term: string) => void;
  globalSuggest?: boolean;
  suggestLabels?: Record<string, string>;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  // Issue d54f3e66 (reopened): this AppHomeMenu search bar had a bare,
  // dead ⌘K badge — no platform label, no tooltip, no working shortcut.
  // Wire it the same way as the PageHeader HomeSearchBar via the shared hook.
  const shortcut = useShortcutHint();
  const inputRef = useRef<HTMLInputElement>(null);
  const focusInput = () => { const el = inputRef.current; if (el) { el.focus(); try { el.select(); } catch { /* */ } } };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); focusInput(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── Smart global suggestions ──────────────────────────────────────────
     Debounced fan-out to /api/search/global. The dropdown replaces the
     silent-until-Enter behaviour the owner called "not work": two letters
     in, matches from every corner of the Hub appear. */
  const [groups, setGroups] = useState<SuggestGroup[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  /* Speed (owner: "too slow"): the last SERVER payload lives here, and every
     keystroke re-filters it INSTANTLY in the browser — the dropdown answers
     in 0ms while the 120ms-debounced fetch refines behind it. Backspacing is
     instant too, because the unfiltered payload is never thrown away. */
  const rawRef = useRef<SuggestGroup[]>([]);
  const flatItems: SuggestItem[] = groups.flatMap((g) => g.items);

  useEffect(() => {
    if (!globalSuggest) return;
    const term = q.trim();
    if (term.length < 2) {
      rawRef.current = [];
      setGroups([]); setSuggestOpen(false); setSuggestLoading(false); setActiveIdx(-1);
      return;
    }
    /* Instant preview: filter what we already have by the new term. */
    if (rawRef.current.length > 0) {
      const needle = term.toLowerCase();
      const preview = rawRef.current
        .map((g) => ({ ...g, items: g.items.filter((it) => `${it.title} ${it.subtitle ?? ""}`.toLowerCase().includes(needle)) }))
        .filter((g) => g.items.length > 0);
      setGroups(preview);
      setSuggestOpen(true);
      setActiveIdx(-1);
    }
    setSuggestLoading(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/search/global?q=${encodeURIComponent(term)}`, { signal: ac.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { groups: SuggestGroup[] };
        rawRef.current = data.groups ?? [];
        setGroups(data.groups ?? []);
        setSuggestOpen(true);
        setActiveIdx(-1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") { setGroups([]); setSuggestOpen(false); }
      } finally {
        if (!ac.signal.aborted) setSuggestLoading(false);
      }
    }, 120);
    return () => {
      window.clearTimeout(timer);
      /* Kill the in-flight fetch too — without this an OLD response lands
         after the instant preview of a NEWER keystroke and replaces it:
         the "lag" of the dropdown jumping backwards mid-typing. */
      abortRef.current?.abort();
    };
  }, [q, globalSuggest]);

  const pickSuggestion = (item: SuggestItem) => {
    setSuggestOpen(false);
    setGroups([]);
    setQ("");
    onSearchChange?.("");
    router.push(item.href);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    /* A highlighted suggestion wins over the bare term (standard omnibox). */
    if (activeIdx >= 0 && flatItems[activeIdx]) { pickSuggestion(flatItems[activeIdx]); return; }
    const trimmed = q.trim();
    if (!trimmed) return;
    setSuggestOpen(false);
    if (onSearchSubmit) onSearchSubmit(trimmed);
    else if (searchHref) router.push(`${searchHref}?q=${encodeURIComponent(trimmed)}`);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestOpen || flatItems.length === 0) {
      if (e.key === "Escape") setSuggestOpen(false);
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % flatItems.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i <= 0 ? flatItems.length - 1 : i - 1)); }
    else if (e.key === "Escape") { e.preventDefault(); setSuggestOpen(false); setActiveIdx(-1); }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="kx-ahm-search group flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 transition-all duration-200 focus-within:border-[var(--border-focus)] hover:border-[var(--border-color)] sm:gap-3 sm:px-4 sm:py-3">
        <RrIcon name="search" size={15} className="shrink-0 text-[var(--text-dim)] transition-colors group-focus-within:text-[var(--text-muted)]" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); onSearchChange?.(e.target.value); }}
          onKeyDown={onInputKeyDown}
          onFocus={() => { if (groups.length > 0) setSuggestOpen(true); }}
          onBlur={() => { /* Delay so a suggestion click lands before close. */
            window.setTimeout(() => setSuggestOpen(false), 150);
          }}
          placeholder={placeholder}
          aria-label={shortcut.hint}
          aria-expanded={suggestOpen}
          role={globalSuggest ? "combobox" : undefined}
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)] sm:text-[13.5px]"
        />
        {globalSuggest && suggestLoading && (
          <RrIcon name="loading" size={14} className="shrink-0 animate-spin text-[var(--text-dim)]" />
        )}
        {q.trim() ? (
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
          >
            Search
          </button>
        ) : (
          <button
            type="button"
            onClick={focusInput}
            title={shortcut.hint}
            aria-label={shortcut.hint}
            className="hidden shrink-0 cursor-pointer items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--text-dim)] transition-colors hover:border-[var(--border-color)] hover:text-[var(--text-secondary)] sm:inline-flex"
          >
            <kbd>{shortcut.label}</kbd>
          </button>
        )}
      </div>

      {globalSuggest && suggestOpen && (
        <div
          role="listbox"
          aria-label="Suggestions"
          /* kx-pop-panel, NOT a bg-* utility: the repo's dropdown shell owns
             radius/border/solid-background/shadow and BEATS utilities (see
             globals.css). The first version used bg-[var(--bg-elevated)],
             which is translucent — the nav pills bled straight through and
             the owner flagged it as a UI bug. */
          className="kx-pop-panel absolute inset-x-0 top-full z-50 mt-2 max-h-[60vh]"
        >
          {groups.length === 0 && !suggestLoading && (
            <div className="px-4 py-5 text-center text-[12px] text-[var(--text-dim)]">—</div>
          )}
          {groups.map((g) => {
            const meta = GROUP_META[g.key] ?? { icon: "file" as RrIconName, en: g.key };
            const label = suggestLabels?.[g.key] ?? meta.en;
            return (
              <div key={g.key} className="border-b border-[var(--border-subtle)] last:border-b-0">
                <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                  <RrIcon name={meta.icon} size={12} />
                  <span>{label}</span>
                </div>
                <ul>
                  {g.items.map((it) => {
                    const idx = flatItems.indexOf(it);
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={idx === activeIdx}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => pickSuggestion(it)}
                          className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-start transition-colors ${
                            idx === activeIdx ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface)]"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            {/* Per-item icon when the API provides one (the
                                report templates carry their catalogue icon —
                                the owner's ask); everything else wears its
                                group's icon so no row is ever iconless. */}
                            <RrIcon
                              name={(it.icon as RrIconName | undefined) ?? meta.icon}
                              size={14}
                              className="shrink-0 text-[var(--text-dim)]"
                            />
                            <span className="min-w-0 truncate text-[13px] text-[var(--text-primary)]">{it.title}</span>
                          </span>
                          {it.subtitle && (
                            <span className="shrink-0 text-[10.5px] text-[var(--text-dim)]">{it.subtitle}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
}
