"use client";

/* ---------------------------------------------------------------------------
   HierarchyBlocks — three reusable blocks for the Division → Category →
   Subcategory layers of the knowledge document.

   Kept together because they share visual language and only differ in
   the data they consume. All inherit Hub design tokens.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { HubIcon } from "./icon-registry";
import type { Category, Division, Subcategory } from "./data";

/* ── 1. DivisionStrip ───────────────────────────────────────────────────
   Six division tiles in a row. Garment Machinery is "Live", the rest
   show a "Planned" badge. Top of the page so readers understand they
   are inside ONE division of a larger system. */
export function DivisionStrip({
  divisions,
  currentId,
}: {
  divisions: Division[];
  currentId: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {divisions.map((d) => {
        const isCurrent = d.id === currentId;
        const live = d.status === "live";
        return (
          <div
            key={d.id}
            className={`relative rounded-xl border p-3.5 transition-colors ${
              isCurrent
                ? "border-[var(--text-primary)] bg-[var(--bg-surface)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
                <HubIcon domain="division" k={d.id} size={13} />
              </div>
              <div className="font-mono text-[12px] font-bold tracking-wider text-[var(--text-primary)]">
                {d.prefix}
              </div>
            </div>
            <div className="mt-2.5 text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
              {d.name}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`text-[9.5px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                  live
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-300"
                    : "border-[var(--border-subtle)] text-[var(--text-faint)]"
                }`}
              >
                {live && (
                  <span
                    aria-hidden
                    className="h-1 w-1 rounded-full bg-emerald-500"
                  />
                )}
                {live ? "Live" : "Planned"}
              </span>
              {isCurrent && (
                <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                  · you are here
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── 2. CategoryGrid ───────────────────────────────────────────────────
   11 category tiles. Each tile shows the category icon, the code, the
   label, the subcategory count, and "Has breakdown" if applicable.
   Clicking the tile scrolls to the matching subcategory table below. */
export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {categories.map((c) => (
        <Link
          key={c.code}
          href={`#${c.anchor}`}
          scroll
          className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 hover:bg-[var(--bg-surface-subtle)] transition-colors block"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] group-hover:bg-[var(--bg-surface-hover)] transition-colors">
              <HubIcon domain="category" k={c.code} size={14} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9.5px] font-mono text-[var(--text-faint)]">
                {c.subcategories.length}
              </span>
              {c.hasBreakdown && (
                <span className="text-[8.5px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-full border border-emerald-500/40 text-emerald-600 dark:text-emerald-300">
                  Decoded
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 font-mono text-[15px] font-bold tracking-wider text-[var(--text-primary)]">
            {c.code}
          </div>
          <div className="mt-0.5 text-[12.5px] font-semibold text-[var(--text-primary)] leading-snug">
            {c.label}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-faint)] leading-snug line-clamp-2">
            {c.blurb}
          </div>
          <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)] group-hover:text-[var(--text-primary)] transition-colors">
            View subcategories →
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ── 3. SubcategoryTable ──────────────────────────────────────────────
   One per category. Two-column table (subcategory / code) modeled on
   the printed reference cards the user shared. Anchorable. Compact. */
export function SubcategoryTable({
  category,
  showBreakdownLink,
}: {
  category: Category;
  /** Render a "Has technical breakdown ↓" link at the bottom when true. */
  showBreakdownLink?: boolean;
}) {
  return (
    <section
      id={category.anchor}
      className="scroll-mt-20 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden"
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-faint)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
            <HubIcon domain="category" k={category.code} size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[16px] font-semibold tracking-tight text-[var(--text-primary)] truncate">
                {category.label}
              </h3>
              <span className="font-mono text-[12px] font-bold tracking-wider text-[var(--text-dim)]">
                — {category.code}
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)] truncate">
              {category.blurb}
            </p>
          </div>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)] shrink-0">
          {category.subcategories.length} subs
        </div>
      </header>

      {/* Table */}
      <ul className="divide-y divide-[var(--border-faint)]">
        {category.subcategories.map((s: Subcategory) => (
          <li
            key={s.code}
            className="grid grid-cols-[1fr_88px] gap-3 px-5 py-2.5 items-center hover:bg-[var(--bg-surface-subtle)] transition-colors"
          >
            <span className="text-[13px] text-[var(--text-primary)]">
              {s.label}
            </span>
            <span className="font-mono text-[12px] font-bold tracking-wider text-[var(--text-primary)] text-right">
              {s.code}
            </span>
          </li>
        ))}
      </ul>

      {/* Breakdown bridge for XS */}
      {showBreakdownLink && (
        <div className="border-t border-[var(--border-faint)] px-5 py-3 bg-[var(--bg-surface-subtle)]">
          <Link
            href="#technical-breakdown"
            className="text-[11.5px] font-semibold text-[var(--text-primary)] hover:underline underline-offset-2"
          >
            View technical breakdown for XSL · XSO · XSI ↓
          </Link>
        </div>
      )}
    </section>
  );
}
