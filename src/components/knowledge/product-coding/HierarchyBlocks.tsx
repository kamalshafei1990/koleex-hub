"use client";

/* ---------------------------------------------------------------------------
   HierarchyBlocks — v10.

   Two visual primitives now:
     · DivisionStrip — 9 KOLEEX divisions across the top of the page.
     · CategoryGrid — 11 expandable category tiles. Each tile is a
       button; clicking opens a panel below that row showing the
       subcategory table inline. This kills the dedicated "Section 03
       — Subcategories" wall-of-tables and bakes the lookup into the
       category browse experience.

   Visual rhythm matches the Hub design system. No new colors.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import type { Category, Division, Subcategory } from "./data";
import { taxonomyLogoUrl } from "./taxonomy-logo";

/* Storage-hosted SVG renderer for taxonomy logos. */
function TaxonomyLogo({
  folder,
  slug,
  alt,
  size = 32,
}: {
  folder: "divisions" | "categories" | "subcategories";
  slug: string;
  alt: string;
  size?: number;
}) {
  const url = taxonomyLogoUrl(folder, slug);
  if (!url) return null;
  /* eslint-disable-next-line @next/next/no-img-element */
  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
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
                <TaxonomyLogo folder="divisions" slug={d.id} alt={d.name} size={28} />
              </div>
              <span
                className={`text-[9.5px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                  live
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-300"
                    : "border-[var(--border-subtle)] text-[var(--text-faint)]"
                }`}
              >
                {live && <span aria-hidden className="h-1 w-1 rounded-full bg-emerald-500" />}
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

/* ── 2. CategoryGrid (expandable) ─────────────────────────────────────
   Each tile is a button. Clicking expands an inline subcategory panel
   that spans the full grid row width. State is local: one tile open
   at a time, clicking again closes. */
export function CategoryGrid({ categories }: { categories: Category[] }) {
  const [openCode, setOpenCode] = useState<string | null>(null);
  const open = categories.find((c) => c.code === openCode) ?? null;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {categories.map((c) => {
          const isOpen = c.code === openCode;
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => setOpenCode(isOpen ? null : c.code)}
              aria-expanded={isOpen}
              className={`group rounded-2xl border p-5 transition-all text-left block ${
                isOpen
                  ? "border-[var(--text-primary)] bg-[var(--bg-surface)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
              }`}
            >
              {/* Top row: icon + sub-count + decoded badge */}
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] overflow-hidden">
                  <TaxonomyLogo folder="categories" slug={c.slug} alt={c.label} size={28} />
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

              {/* THE CODE — dominant */}
              <div className="font-mono text-[34px] sm:text-[40px] font-bold tracking-[0.04em] text-[var(--text-primary)] leading-none">
                {c.code}
              </div>

              <div className="mt-3 text-[13.5px] font-semibold text-[var(--text-primary)] leading-snug">
                {c.label}
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-faint)] leading-snug line-clamp-2">
                {c.blurb}
              </div>

              <div
                className={`mt-3 pt-3 border-t border-[var(--border-faint)] text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                  isOpen
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-faint)] group-hover:text-[var(--text-primary)]"
                }`}
              >
                {isOpen ? "Close ▴" : "Open subcategories ▾"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Inline expanded panel — full grid width */}
      {open && (
        <div className="mt-4 rounded-2xl border border-[var(--text-primary)] bg-[var(--bg-secondary)] overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--border-faint)] bg-[var(--bg-surface)]">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] overflow-hidden shrink-0">
                <TaxonomyLogo folder="categories" slug={open.slug} alt={open.label} size={26} />
              </div>
              <div className="font-mono text-[22px] font-bold tracking-[0.04em] text-[var(--text-primary)] leading-none shrink-0">
                {open.code}
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)] truncate">
                  {open.label}
                </h3>
                <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)] truncate">
                  {open.blurb}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenCode(null)}
              className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)] hover:text-[var(--text-primary)] px-2 py-1"
              aria-label="Close subcategories"
            >
              Close ✕
            </button>
          </header>

          {/* Subcategory rows — 2-col grid when there are many entries */}
          <ul
            className={`divide-y divide-[var(--border-faint)] ${
              open.subcategories.length > 6
                ? "sm:divide-y-0 sm:grid sm:grid-cols-2 sm:gap-x-0 sm:divide-x sm:divide-[var(--border-faint)]"
                : ""
            }`}
          >
            {open.subcategories.map((s: Subcategory, i) => (
              <li
                key={s.code}
                className={`grid grid-cols-[1fr_104px] gap-3 items-center hover:bg-[var(--bg-surface-subtle)] transition-colors ${
                  open.subcategories.length > 6
                    ? i >= Math.ceil(open.subcategories.length / 2)
                      ? "sm:border-t sm:border-[var(--border-faint)]"
                      : ""
                    : ""
                }`}
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

          {/* Bridge to the breakdown for XS */}
          {open.hasBreakdown && (
            <div className="border-t border-[var(--border-faint)] px-5 py-3 bg-[var(--bg-surface-subtle)] text-center">
              <a
                href="#technical-breakdown"
                className="text-[11.5px] font-semibold text-[var(--text-primary)] hover:underline underline-offset-2"
              >
                View technical breakdown for XSL · XSO · XSI ↓
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
