"use client";

/* ---------------------------------------------------------------------------
   HierarchyBlocks — Division / Category / Subcategory tiles, v5.

   v5 (the right way):
   - DIVISION tiles render the same SVG that lives in Supabase Storage
     under media/divisions/<slug>.svg — exact match with /products and
     /product-data.
   - CATEGORY tiles render media/categories/<slug>.svg, paired with a
     dominant monospace code as the secondary visual anchor.
   - Both fall back to the code-only layout if the storage URL can't
     be built (no NEXT_PUBLIC_SUPABASE_URL).
   --------------------------------------------------------------------------- */

import Link from "next/link";
import type { Category, Division, Subcategory } from "./data";
import { taxonomyLogoUrl } from "./taxonomy-logo";

/* Shared logo renderer. Returns null when no URL is available so the
   caller can decide whether to show a placeholder. */
function TaxonomyLogo({
  folder,
  slug,
  alt,
  size = 32,
  className,
}: {
  folder: "divisions" | "categories" | "subcategories";
  slug: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  const url = taxonomyLogoUrl(folder, slug);
  if (!url) return null;
  /* Plain <img> on purpose — these are small inline SVGs from our own
     storage bucket. next/image would force a remote-pattern allowlist
     dance for marginal benefit. */
  /* eslint-disable-next-line @next/next/no-img-element */
  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}

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
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] overflow-hidden">
                <TaxonomyLogo
                  folder="divisions"
                  slug={d.id}
                  alt={d.name}
                  size={28}
                />
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
   The tile has BOTH: the canonical category SVG (top-left) and the
   monospace code as the dominant visual centerpiece. */
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
          {/* Top row: canonical SVG + sub-count + decoded badge */}
          <div className="flex items-start justify-between gap-2 mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] overflow-hidden">
              <TaxonomyLogo
                folder="categories"
                slug={c.slug}
                alt={c.label}
                size={28}
              />
            </div>
            <div className="flex items-center gap-1.5 pt-1">
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

          {/* THE CODE — still dominant */}
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

/* ── 3. SubcategoryTable ────────────────────────────────────────────── */
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
      {/* Header: canonical logo + code + label */}
      <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--border-faint)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] overflow-hidden shrink-0">
            <TaxonomyLogo
              folder="categories"
              slug={category.slug}
              alt={category.label}
              size={26}
            />
          </div>
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
