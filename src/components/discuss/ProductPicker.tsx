"use client";

import { useEffect, useMemo, useState } from "react";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { cdnImage } from "@/lib/cdn";
import type { ProductRow } from "@/types/supabase";
import ModalShell from "./DiscussModalShell";

/* ═══════════════════════════════════════════════════════════════════════════
   PRODUCT PICKER MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

/** "industrial-sewing-machines" → "Industrial Sewing Machines". The taxonomy
 *  is stored as slugs; nobody should have to read a slug in a picker. */
function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** One filter chip: label + count. Monochrome; the active chip is the only
 *  inverted surface in the rail (Koleex brand — colour is functional only). */
function FacetChip({
  label, count, active = false, onClick,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`shrink-0 h-7 px-2.5 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors ${
        active
          ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent"
          : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
      }`}
    >
      <span className="max-w-[150px] truncate">{label}</span>
      <span className={`tabular-nums text-[10px] ${active ? "opacity-70" : "text-[var(--text-faint)]"}`}>
        {count}
      </span>
    </button>
  );
}

export default function ProductPicker({
  products,
  images,
  loading = false,
  onCancel,
  onSelect,
  t,
}: {
  products: ProductRow[];
  images: Record<string, string>;
  /** True while the lazy catalog fetch (first open) is in flight. */
  loading?: boolean;
  onCancel: () => void;
  onSelect: (p: ProductRow) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [search, setSearch] = useState("");
  /* ── Classification drill-down ──────────────────────────────────────────
     ONE row of chips at a time, never a stack. Tapping a category REPLACES
     the row with that category's subcategories behind a back chip, so the
     filter never grows past a single line no matter how deep the taxonomy is.

     A level is shown only when it actually discriminates: this catalogue has
     700 of 706 products in ONE division, so a division row would be a single
     dead chip. The row is derived from the data rather than hardcoded to
     division > category > subcategory, so it stays right if that changes. */
  const [drill, setDrill] = useState<{ category: string | null; subcategory: string | null }>(
    { category: null, subcategory: null },
  );

  // Full-text haystack per product (built once): name, code, brand, the whole
  // classification path, tags, copy, compliance, specs — everything. Lets the
  // search match on any attribute, not just name/code/brand.
  const haystacks = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) m.set(p.id, buildProductHaystack(p));
    return m;
  }, [products]);

  /* Counts for the current level. Derived from the products actually in
     scope, so a chip never promises results it cannot deliver. */
  const facets = useMemo(() => {
    const scope = drill.category
      ? products.filter((p) => p.category_slug === drill.category)
      : products;
    const key = drill.category ? "subcategory_slug" : "category_slug";
    const counts = new Map<string, number>();
    for (const p of scope) {
      const v = (p as unknown as Record<string, string | null>)[key];
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return {
      scopeTotal: scope.length,
      items: [...counts.entries()].sort((x, y) => y[1] - x[1]),
    };
  }, [products, drill.category]);

  /* Browse order. The default used to be raw API order — newest first — and
     of the newest 60 exactly ONE had a photo, so the picker looked both empty
     of images and (capped at 60) missing most of the catalogue. Ordering by
     "has a photo" then name puts the recognisable products first; everything
     is still reachable by scrolling or search. */
  const ordered = useMemo(() => {
    const withImg = (p: ProductRow) => (images[p.id] ? 0 : 1);
    const scoped = products.filter(
      (p) =>
        (!drill.category || p.category_slug === drill.category) &&
        (!drill.subcategory || p.subcategory_slug === drill.subcategory),
    );
    return [...scoped].sort(
      (a2, b2) =>
        withImg(a2) - withImg(b2) ||
        stripHtmlText(a2.product_name).localeCompare(stripHtmlText(b2.product_name)),
    );
  }, [products, images, drill.category, drill.subcategory]);

  const filtered = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return ordered;
    // Every token must appear (AND) so multi-word queries narrow results.
    return ordered.filter((p) => {
      const h = haystacks.get(p.id) ?? "";
      return tokens.every((tok) => h.includes(tok));
    });
  }, [ordered, search, haystacks]);

  /* Progressive reveal instead of a hard cap: 706 cards mounted at once is a
     long frame, but a 60-item CEILING is what made most of the catalogue
     unreachable. Render a window and grow it as the user scrolls — every
     product is reachable, and the first paint stays cheap. */
  const PAGE = 60;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  useEffect(() => { setVisibleCount(PAGE); }, [search, drill.category, drill.subcategory]);
  const shown = filtered.slice(0, visibleCount);

  return (
    <ModalShell title={t("composer.product")} onCancel={onCancel} width={640} closeLabel={t("btn.close", "Close")}>
      <div className="p-5 flex flex-col gap-3">
        <div className="h-10 px-3 flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors">
          <SearchIcon className="h-4 w-4 text-[var(--text-dim)]" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("composer.productSearch", "Search by name, code, brand, category, tags…")}
            className="flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none"
          />
        </div>
        {loading ? (
          <div className="p-10 flex justify-center">
            <SpinnerIcon size={18} className="text-[var(--text-dim)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-[11px] text-[var(--text-dim)]">
            {t("search.noResults")}
          </div>
        ) : (
          /* Grid of photo cards — same grammar as the To-do product picker:
             white photo area (object-contain so machines aren't cropped),
             model code first, product name beneath. */
          <>
          {/* ── One-line classification rail ──────────────────────────────
              Horizontally scrollable, monochrome (Koleex brand: the active
              state is the ONLY inverted element — no colour is spent on
              decoration). Shows counts so the user knows what a chip costs
              before tapping it. When drilled in, the first chip walks back
              out — the trail never occupies a second row. */}
          {facets.items.length > 1 && (
            <div className="-mx-1 px-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {drill.category ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDrill({ category: null, subcategory: null })}
                    className="shrink-0 h-7 ps-1.5 pe-2.5 rounded-full border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] inline-flex items-center gap-1 transition-colors"
                  >
                    <AngleLeftIcon className="h-3 w-3 rtl:rotate-180" />
                    {humanizeSlug(drill.category)}
                  </button>
                  <FacetChip
                    label={t("picker.all", "All")}
                    count={facets.scopeTotal}
                    active={!drill.subcategory}
                    onClick={() => setDrill((d) => ({ ...d, subcategory: null }))}
                  />
                  {facets.items.map(([slug, n]) => (
                    <FacetChip
                      key={slug}
                      label={humanizeSlug(slug)}
                      count={n}
                      active={drill.subcategory === slug}
                      onClick={() =>
                        setDrill((d) => ({
                          ...d,
                          subcategory: d.subcategory === slug ? null : slug,
                        }))
                      }
                    />
                  ))}
                </>
              ) : (
                <>
                  <FacetChip
                    label={t("picker.all", "All")}
                    count={products.length}
                    active
                    onClick={() => setDrill({ category: null, subcategory: null })}
                  />
                  {facets.items.map(([slug, n]) => (
                    <FacetChip
                      key={slug}
                      label={humanizeSlug(slug)}
                      count={n}
                      onClick={() => setDrill({ category: slug, subcategory: null })}
                    />
                  ))}
                </>
              )}
            </div>
          )}
          <p className="text-[10.5px] text-[var(--text-faint)] -mt-1">
            {t("composer.productCount", "Showing {n} of {total}")
              .replace("{n}", String(shown.length))
              .replace("{total}", String(filtered.length))}
          </p>
          <div
            className="max-h-[420px] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 p-0.5"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) {
                setVisibleCount((n) => (n < filtered.length ? n + PAGE : n));
              }
            }}
          >
            {shown.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className="group text-start rounded-xl border border-[var(--border-subtle)] hover:border-[var(--border-focus)] bg-[var(--bg-surface)] overflow-hidden transition-all"
                title={stripHtmlText(p.product_name)}
              >
                <div className="aspect-square w-full bg-white flex items-center justify-center overflow-hidden p-2">
                  {images[p.id] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      /* Thumbnail-sized + first-party: the raw storage URL is a
                         full-resolution product photo (hundreds of KB each,
                         and *.supabase.co is unreliable from mainland China).
                         cdnImage serves a 256px variant through our origin —
                         orders of magnitude less to paint a grid. Lazy so
                         off-screen cards cost nothing until scrolled to. */
                      src={cdnImage(images[p.id], { width: 256, quality: 75 })}
                      alt={stripHtmlText(p.product_name)}
                      loading="lazy"
                      decoding="async"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <PackageIcon className="h-8 w-8 text-black/20" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[11.5px] font-semibold text-[var(--text-primary)] truncate">
                    {p.slug}
                  </p>
                  <p className="text-[10.5px] text-[var(--text-dim)] truncate">
                    {stripHtmlText(p.product_name)}
                  </p>
                </div>
              </button>
            ))}
          </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

/* Some legacy product names carry raw HTML (e.g. "…with 2 iron<div>Table
   size…</div>" or "<b>With Air Trimmer</b>"). Strip tags so the picker shows
   clean text instead of leaking markup. */
function stripHtmlText(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Flatten every searchable field of a product into one lowercase string so the
   picker search matches on anything — identity, classification, copy, specs. */
function buildProductHaystack(p: ProductRow): string {
  const parts: Array<string | null | undefined> = [
    p.product_name,
    p.slug,
    p.brand,
    p.division_slug,
    p.category_slug,
    p.subcategory_slug,
    p.level,
    p.excerpt,
    p.description,
    p.hs_code,
    p.machine_dimensions,
    p.warranty,
    p.warranty_type,
    ...(p.tags ?? []),
    ...(p.highlights ?? []),
    ...(p.colors ?? []),
    ...(p.voltage ?? []),
    ...(p.plug_types ?? []),
  ];
  // Spec values (sizes, RPM, needle counts…) so they're searchable too.
  if (p.specs && typeof p.specs === "object") {
    for (const v of Object.values(p.specs)) {
      if (v != null && (typeof v === "string" || typeof v === "number")) parts.push(String(v));
    }
  }
  return parts
    .filter(Boolean)
    .map((s) => stripHtmlText(String(s)))
    .join(" ")
    .toLowerCase();
}

