"use client";

/* ---------------------------------------------------------------------------
   HierarchyBlocks — Division / Category / Subcategory tiles, v4.

   v4 changes (from user feedback):
   - DIVISION tiles use the canonical SVG components from
     src/components/icons/divisions/ — same icons /products and
     /product-data render.
   - CATEGORY tiles drop the made-up icons entirely. The CODE itself
     is now the dominant visual: large monospace badge as the hero,
     name + blurb as supporting metadata.
   - Subcategory tables get a stronger code column so the codes read
     at a glance.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { HubIcon } from "./icon-registry";
import type { Category, Division, Subcategory } from "./data";

/* ── 1. DivisionStrip ─────────────────────────────────────────────────── */
export function DivisionStrip({
  divisions,
  currentId,
}: {
  divisions: Division[];
  currentId: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
      {divisions.map((d) => {
        const isCurrent = d.id === currentId;
        const live = d.status === "live";
        return (
          <div
            key={d.id}
            className={`relative rounded-xl border p-4 transition-colors ${
              isCurrent
                ? "border-[var(--text-primary)] bg-[var(--bg-surface)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              {/* Canonical division icon — falls back gracefully when
                  the registry returns null (which it shouldn't for
                  any real division id). */}
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
                <HubIcon domain="division" k={d.id} size={20} />
              </div>
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
            </div>
            <div className="mt-3 text-[13px] font-semibold text-[var(--text-primary)]">
              {d.name}
            </div>
            {isCurrent && (
              <div className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                You are here
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── 2. CategoryGrid ──────────────────────────────────────────────────
   v4: the CODE is the visual anchor. No icons. Tile is dominated by
   a giant monospace code, with the label + sub-count below. */
export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {categories.map((c) => (
        <Link
          key={c.code}
          href={`#${c.anchor}`}
          scroll
          className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 hover:border-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-all block"
        >
          {/* Top row: tiny eyebrow + sub-count chip */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
              Category
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[var(--text-faint)] font-mono">
                {c.subcategories.length}{" "}
                {c.subcategories.length === 1 ? "sub" : "subs"}
              </span>
              {c.hasBreakdown && (
                <span className="text-[8.5px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-full border border-emerald-500/40 text-emerald-600 dark:text-emerald-300">
                  Decoded
                </span>
              )}
            </div>
          </div>

          {/* THE CODE — dominant visual element */}
          <div className="font-mono text-[34px] sm:text-[40px] font-bold tracking-[0.04em] text-[var(--text-primary)] leading-none">
            {c.code}
          </div>

          {/* Label + blurb */}
          <div className="mt-3 text-[13.5px] font-semibold text-[var(--text-primary)] leading-snug">
            {c.label}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-faint)] leading-snug line-clamp-2">
            {c.blurb}
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--border-faint)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)] group-hover:text-[var(--text-primary)] transition-colors">
            View subcategories →
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ── 3. SubcategoryTable ─────────────────────────────────────────────
   v4: header uses a code-first layout (big mono code | name).
   Rows show the code in a strong column with a subtle background. */
export function SubcategoryTable({
  category,
  showBreakdownLink,
}: {
  category: Category;
  showBreakdownLink?: boolean;
}) {
  return (
    <section
      id={category.anchor}
      className="scroll-mt-20 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden"
    >
      {/* Header: big code, label, blurb */}
      <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--border-faint)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-4 min-w-0">
          {/* Code badge */}
          <div className="font-mono text-[22px] font-bold tracking-[0.04em] text-[var(--text-primary)] leading-none shrink-0">
            {category.code}
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)] truncate">
              {category.label}
            </h3>
            <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)] truncate">
              {category.blurb}
            </p>
          </div>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)] shrink-0">
          {category.subcategories.length} subs
        </div>
      </header>

      {/* Rows */}
      <ul className="divide-y divide-[var(--border-faint)]">
        {category.subcategories.map((s: Subcategory) => (
          <li
            key={s.code}
            className="grid grid-cols-[1fr_104px] gap-3 items-center hover:bg-[var(--bg-surface-subtle)] transition-colors"
          >
            <span className="text-[13px] text-[var(--text-primary)] px-5 py-2.5">
              {s.label}
            </span>
            <span className="font-mono text-[13px] font-bold tracking-[0.04em] text-[var(--text-primary)] text-right px-5 py-2.5 border-l border-[var(--border-faint)] bg-[var(--bg-surface-subtle)]">
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
