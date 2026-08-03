"use client";

import { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue, memo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { currentScopeKey } from "@/lib/me-bootstrap";
import { kxInspectAttrs } from "@/lib/qa/inspector";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { StatusPill } from "@/components/kds";
import { localizedName } from "@/lib/i18n-name";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import { IMG } from "@/lib/cdn";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import FilterIcon from "@/components/icons/ui/FilterIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import ScissorsIcon from "@/components/icons/ui/ScissorsIcon";
import CpuIcon from "@/components/icons/ui/CpuIcon";
import HomeIcon from "@/components/icons/ui/HomeIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import TruckIcon from "@/components/icons/ui/TruckIcon";
import FactoryIcon from "@/components/icons/ui/FactoryIcon";
import ZapIcon from "@/components/icons/ui/ZapIcon";
import StethoscopeIcon from "@/components/icons/ui/StethoscopeIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import ListIcon from "@/components/icons/ui/ListIcon";
import SettingsIcon2 from "@/components/icons/ui/SettingsIcon2";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ProductsIcon from "@/components/icons/ProductsIcon";
import ProductDataIcon from "@/components/icons/ProductDataIcon";
import {
  fetchProducts, fetchTaxonomyAll,
  fetchModelSummaries, fetchProductMainImages, deleteProduct,
  fetchClassificationIcons,
} from "@/lib/products-admin";
import type { ProductRow, DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import ConfirmDialog from "./form-sections/ConfirmDialog";

/* Koleex's flagship division. The hub treats this line as the
   default view on the public catalog and visually emphasises it
   everywhere we surface divisions (pill strip, badges). Other
   divisions are secondary — "extra lines" that customers can
   discover but aren't the hub's primary story. Keep this constant
   in one place so a future rename (e.g. "koleex-machinery") is a
   single-file change. */
const FLAGSHIP_DIVISION_SLUG = "garment-machinery";

/* Division → icon. Divisions are DB-driven with no icon column, so we map by
   name keyword (robust to slug variants) and fall back to a neutral box. */
function divisionIcon(name: string): React.ElementType {
  const n = (name || "").toLowerCase();
  if (/garment|sewing|machin/.test(n)) return ScissorsIcon;
  if (/digital|device|electron|tech/.test(n)) return CpuIcon;
  if (/smart|living|home/.test(n)) return HomeIcon;
  if (/life ?style|lifestyle|beauty|leisure/.test(n)) return SparklesIcon;
  if (/mobil|vehicle|auto|transport/.test(n)) return TruckIcon;
  if (/industr|factory|solution/.test(n)) return FactoryIcon;
  if (/fabric|textile|material/.test(n)) return LayersIcon;
  if (/energy|power|solar|battery/.test(n)) return ZapIcon;
  if (/medic|health|care|pharma/.test(n)) return StethoscopeIcon;
  return PackageIcon;
}

/* Static tonal maps — hoisted to module scope so they aren't
   re-allocated on every render (levelColors) or, worse, once per
   product card on every render (stColors, previously rebuilt inside
   each card's IIFE in both the grid and list views). With 600+ cards
   mounted at once that was hundreds of throwaway objects per render. */
/* Level is a tier label, NOT a functional status → neutral chips per the
   brand rule (monochrome-first; color reserved for true status). */
const LEVEL_CHIP = "text-[var(--text-muted)] bg-[var(--bg-surface)] border-[var(--border-subtle)]";
/* Frozen empty array — a fresh [] per render would defeat ProductCard's memo. */
const EMPTY_SUPPLIERS: string[] = [];

/* Hoisted: a fresh style object per section per render defeated nothing but
   allocated needlessly. */
const SECTION_CV = { contentVisibility: "auto", containIntrinsicSize: "1px 800px" } as const;

const levelColors: Record<string, string> = {
  entry: LEVEL_CHIP, mid: LEVEL_CHIP, premium: LEVEL_CHIP, enterprise: LEVEL_CHIP,
};
/* Status IS functional → semantic tones via the ONE canonical KDS pill
   (this file previously had TWO different chip shapes for the same
   status — rounded-md in grid, rounded-full in list; element law now). */
const ST_TONE = { draft: "warning", active: "success", archived: "error" } as const;

/* Renders a classification-hub icon (a flat Visual-Library SVG) in the current
   theme colour via a CSS mask, so it reads correctly on dark/light. Returns
   null when there's no icon for that slug. */
function ClassMonoIcon({ src, className }: { src?: string; className?: string }) {
  if (!src) return null;
  // Whitespace (e.g. a stray newline in a stored URL) invalidates the CSS
  // mask value and the pill paints as a solid square — strip it.
  const url = src.replace(/\s+/g, "");
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className ?? "h-5 w-5"}`}
      style={{
        WebkitMaskImage: `url("${url}")`, maskImage: `url("${url}")`,
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskPosition: "center", maskPosition: "center",
        WebkitMaskSize: "contain", maskSize: "contain",
      }}
    />
  );
}

/* ── ProductCard ──
   Extracted from the grid map and MEMOISED. The catalogue mounts ~700
   cards; before this, any parent re-render (typing in search, a filter
   change, a meta fetch landing) reconciled every card subtree — ~17k
   nodes — which is what made search feel laggy. All inputs are either
   primitives or stable useMemo/useCallback values, so untouched cards
   now bail out of re-rendering entirely. Markup is verbatim: this is a
   pure extraction, no visual change. */
/* ── Internal work signals (Product Data card) ──
   Shape mirrors /api/products/signals. Kept local: the public catalogue
   never receives these fields. */
export interface ProductSignal {
  /** null = no spec template resolved, so a % would be meaningless. */
  readiness: number | null;
  missing: string[];
  cost: number | null;
  visible: boolean;
  updatedAt: string | null;
  supplier: { name: string; logo: string | null } | null;
}

/** "3d" / "5h" / "now" — compact staleness for the internal card. */
function agoShort(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `${mo}mo` : `${Math.floor(mo / 12)}y`;
}

const ProductCard = memo(function ProductCard({
  p, imgUrl, models, suppliers, lvl, baseRoute, isInternal, catMap, subMap, divMap, primaryModelNames, signal, t, onAskDelete,
}: {
  p: ProductRow;
  imgUrl?: string;
  models: number;
  suppliers: string[];
  lvl: string;
  baseRoute: string;
  isInternal: boolean;
  catMap: Record<string, string>;
  subMap: Record<string, string>;
  divMap: Record<string, string>;
  primaryModelNames: Record<string, string>;
  /* Internal work signals (Product Data only) — readiness, gaps, cost,
     visibility, staleness. Undefined on the public /products card. */
  signal?: ProductSignal;
  t: (key: string, fallback?: string) => string;
  onAskDelete: (e: React.MouseEvent, id: string, name: string) => void;
}) {
  return (
    <div
      key={p.id}
      {...kxInspectAttrs({ component: "ProductCard", module: "Product Data", section: "Catalog", recordId: p.slug || p.id })}
      className="group relative kx-hover-card kx-glow-in bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] overflow-hidden"
    >
      {/* Stretched navigation link — covers the whole card and
          is the ONLY card-level anchor, so the edit/delete actions
          below are siblings (not nested <a>) → no hydration error. */}
      <Link
        href={`${baseRoute}/${p.slug || p.id}`}
        aria-label={p.product_name}
        className="absolute inset-0 z-0"
      />
      {/* Image — calm, clean. Background matches the
          card surface so transparent product photos
          blend in (no white box around the photo).
          No scale on hover — the card lifts, image
          stays put. */}
      <div className="relative aspect-[4/3] bg-gradient-to-b from-white to-[#f4f5f7] overflow-hidden border-b border-black/5">
        {imgUrl ? (
          /* IMG.card = CDN-downscaled 480px render. The raw
             URL here was the original multi-MB upload — the
             whole grid was pulling full-size photos for
             thumbnail-sized cells, which is why images took
             forever to appear. */
          <img
            src={IMG.card(imgUrl)}
            alt={p.product_name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain p-4"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageRawIcon className="h-10 w-10 text-gray-300" />
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {p.featured && (
            <span /* no backdrop-blur: the inverted bg is fully opaque, so it blurred nothing while costing a render surface on every card */
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] font-bold uppercase tracking-wider">
              <StarIcon className="h-2.5 w-2.5" /> {t("list.featured", "Featured")}
            </span>
          )}
          {p.level && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider border ${lvl}`}>
              {p.level}
            </span>
          )}
        </div>

        {/* Actions (show on hover) — internal only.
            Edit is a real <Link> (with prefetch), wrapped
            in stopPropagation so the click doesn't also
            trigger the parent card's product-detail Link.
            Delete stays a <button> since it opens a modal. */}
        {isInternal && (
        /* GEN-7 — edit/delete were hover-only, so on touch devices
           (no :hover) the card had no visible edit option. Show the
           actions by default on small screens and keep the clean
           hover-reveal on desktop (md+). */
        <div className="absolute bottom-2.5 right-2.5 z-10 flex gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
          <Link
            href={`${baseRoute}/${p.id}/edit`}
            onClick={(e) => e.stopPropagation()}
            className="h-8 w-8 rounded-lg bg-[var(--bg-primary)]/80 border border-[var(--border-subtle)] backdrop-blur-sm flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title={t("card.editProduct")}
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={(e) => onAskDelete(e, p.id, p.product_name)}
            className="h-8 w-8 rounded-lg bg-[var(--bg-primary)]/80 border border-[var(--border-subtle)] backdrop-blur-sm flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 transition-colors"
            title={t("card.deleteProduct")}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        )}
      </div>

      {/* Content — internal cards are a fixed-height flex column so every
          card in a row lines up: the name slot always reserves two lines,
          the readiness slot always exists, and the cost row is pinned to
          the bottom with mt-auto. Without this, a one-line name shifted
          everything below it up and the grid read as ragged. */}
      <div className={`p-3.5 md:p-4 ${isInternal ? "flex flex-col min-h-[208px]" : ""}`}>
        {(() => {
          const mn = primaryModelNames[p.id];
          const hasDistinctName = mn && mn !== p.product_name;
          if (hasDistinctName) {
            // Catalog layout — code first as the heading,
            // descriptive name as the subtitle below.
            return (
              <>
                <h3 className="text-[16px] md:text-[18px] font-bold tracking-tight text-[var(--text-primary)] truncate group-hover:text-[var(--text-highlight)] transition-colors">
                  {mn}
                </h3>
                <p className={`text-[12px] md:text-[13px] text-[var(--text-muted)] mt-0.5 line-clamp-2 leading-snug ${isInternal ? "min-h-[34px]" : ""}`}>
                  {p.product_name}
                </p>
              </>
            );
          }
          // No descriptive name yet — show the model code
          // as the title and a small "Needs name" pill to
          // flag it for the admin.
          return (
            <>
              <h3 className="text-[16px] md:text-[18px] font-bold tracking-tight text-[var(--text-primary)] truncate group-hover:text-[var(--text-highlight)] transition-colors">
                {p.product_name}
              </h3>
              {isInternal && (
                <p className="mt-0.5 text-[10px] font-medium text-amber-400/80 min-h-[34px]">
                  {t("list.needsName", "Needs name")}
                </p>
              )}
            </>
          );
        })()}

        {/* Category + Subcategory line.
            PUBLIC card only: the internal grid is already grouped by
            category → subcategory headings, so repeating them on every
            card is pure noise (owner directive 2026-08-03 — the internal
            card must answer "what's missing / what does it cost", not
            restate the section it sits in). */}
        {!isInternal && (
        <p className="text-[11px] text-[var(--text-dim)] mt-2 truncate flex items-center gap-1.5">
          <LayersIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">{catMap[p.category_slug] || p.category_slug}</span>
          {p.subcategory_slug && subMap[p.subcategory_slug] && (
            <>
              <span className="text-[var(--text-ghost)]">·</span>
              <span className="truncate text-[var(--text-muted)]">{subMap[p.subcategory_slug]}</span>
            </>
          )}
        </p>
        )}

        {/* Division label — only for non-flagship products.
            Garment Machinery is the default/home line and
            gets a clean card; anything else gets tagged so
            it's clear at a glance which line it belongs to. */}
        {!isInternal && p.division_slug && p.division_slug !== FLAGSHIP_DIVISION_SLUG && divMap[p.division_slug] && (
          <p className="text-[10px] text-[var(--text-ghost)] mt-0.5 uppercase tracking-wider truncate">
            {divMap[p.division_slug]}
          </p>
        )}

        {/* Meta row — publish status, brand, models. */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {(() => {
            const st = (p.status || "draft");
            return (
              <StatusPill tone={ST_TONE[st as keyof typeof ST_TONE] ?? "warning"} className="uppercase tracking-wider !text-[10px]">
                {t(`status.${st}`, st)}
              </StatusPill>
            );
          })()}
          {/* Brand chip: PUBLIC only. Internally every product is Koleex,
              so the chip carried zero information and cost a whole row. */}
          {!isInternal && p.brand && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[10px] font-medium text-[var(--text-subtle)]">
              <TagsIcon className="h-2.5 w-2.5" /> {p.brand}
            </span>
          )}
          {/* Visibility — distinct from status: "active" says the record is
              live, this says customers can actually see it. */}
          {isInternal && signal && !signal.visible && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[10px] font-medium text-[var(--text-ghost)]" title={t("card.hidden", "Hidden from customers")}>
              {t("card.hiddenShort", "Hidden")}
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[10px] font-medium text-[var(--text-subtle)]">
            <BoxesIcon className="h-2.5 w-2.5" /> {models} {models === 1 ? t("list.modelOne", "model") : t("list.modelMany", "models")}
          </span>
        </div>

        {/* ── Internal work signals ──
            Readiness bar + gap chips + cost/supplier/freshness. This is
            what turns the grid from a gallery into a worklist. */}
        {isInternal && signal && (
          <div className="mt-3 space-y-2 flex flex-col flex-1">
            {/* Readiness — the same computeReadiness engine the editor
                uses, so card and detail page never disagree. */}
            {/* Readiness slot is ALWAYS rendered so the rows below never
                shift between cards; unknown readiness shows an empty
                track and a dash instead of collapsing. */}
            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                {signal.readiness != null && (
                  <div
                    className={`h-full rounded-full transition-all ${
                      signal.readiness >= 80 ? "bg-emerald-500"
                      : signal.readiness >= 50 ? "bg-amber-500"
                      : "bg-rose-500/80"
                    }`}
                    style={{ width: `${Math.max(2, Math.min(100, signal.readiness))}%` }}
                  />
                )}
              </div>
              <span className="text-[10px] font-semibold tabular-nums text-[var(--text-dim)] shrink-0">
                {signal.readiness != null ? `${signal.readiness}%` : "—"}
              </span>
            </div>

            {/* Gap chips — shown ONLY when something is missing, so a
                complete product reads as a clean card. */}
            {signal.missing.length > 0 && (
              <div className="flex flex-wrap gap-1 min-h-[18px]">
                {signal.missing.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-amber-500/10 text-amber-400/90 border border-amber-500/20"
                  >
                    {t(`card.missing.${k}`, {
                      photo: "No photo",
                      specs: "No specs",
                      cost: "No cost",
                      code: "No code",
                      description: "No description",
                      template: "No spec template",
                    }[k] ?? k)}
                  </span>
                ))}
              </div>
            )}

            {/* Supplier — logo + name. Sourcing is the internal card's
                second question after readiness ("who makes this?"), so it
                gets a real row with the factory's mark, not a grey
                comma-separated tail. */}
            {(signal.supplier || suppliers.length > 0) ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-6 w-6 shrink-0 rounded-md bg-white border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center">
                  {signal.supplier?.logo ? (
                    <img
                      src={IMG.thumb(signal.supplier.logo)}
                      alt=""
                      className="h-full w-full object-contain p-0.5"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <FactoryIcon className="h-3 w-3 text-gray-400" />
                  )}
                </span>
                <span className="truncate text-[11px] font-medium text-[var(--text-subtle)]">
                  {signal.supplier?.name || suppliers[0]}
                </span>
                {suppliers.length > 1 && (
                  <span className="shrink-0 text-[10px] text-[var(--text-ghost)]">+{suppliers.length - 1}</span>
                )}
              </div>
            ) : (
              /* Keep the slot so cost stays on the same line across cards. */
              <div className="flex items-center gap-2 min-w-0 h-6">
                <span className="text-[10px] text-[var(--text-ghost)]">{t("card.noSupplier", "No supplier linked")}</span>
              </div>
            )}

            {/* Cost · freshness — cost is a headline number an operator
                reads across the whole grid, so it carries real weight:
                dim currency mark, large tabular figure. */}
            <div className="flex items-baseline gap-2 min-w-0 mt-auto pt-1">
              {signal.cost != null ? (
                <span className="flex items-baseline gap-1 shrink-0">
                  <span className="text-[11px] font-medium text-[var(--text-ghost)]">¥</span>
                  <span className="text-[17px] md:text-[18px] font-bold tabular-nums tracking-tight text-[var(--text-primary)] leading-none">
                    {signal.cost.toLocaleString()}
                  </span>
                </span>
              ) : (
                <span className="text-[10px] text-[var(--text-ghost)]">{t("card.noCostYet", "Cost not set")}</span>
              )}
              {signal.updatedAt && (
                <span className="ms-auto shrink-0 text-[10px] text-[var(--text-ghost)]" title={new Date(signal.updatedAt).toLocaleString()}>
                  {agoShort(signal.updatedAt)}
                </span>
              )}
            </div>
          </div>
        )}
        {/* Public card keeps the plain supplier line it always had. */}
        {isInternal && !signal && suppliers.length > 0 && (
          <p className="text-[10px] text-[var(--text-ghost)] mt-2 truncate">
            {suppliers.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
});

export default function ProductList() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang } = useTranslation(PRODUCTS_UI_I18N);
  /* "internal" when the same component is rendered under /product-data.
     Under /products the view is the PUBLIC catalog: no supplier
     column, no Add button, no Edit/Delete actions, no cost hints. */
  const isInternal = (pathname || "").startsWith("/product-data");
  const baseRoute = isInternal ? "/product-data" : "/products";

  /* Cache the product list per-scope (tenant + view-as) so returning to the
     catalogue paints instantly from cache instead of re-showing skeletons,
     while the effect below still refetches fresh in the background. The scope
     key guarantees a cached list never bleeds across tenants / view-as. */
  const queryClient = useQueryClient();
  const productsQK = ["products", "list", currentScopeKey()] as const;

  const [products, setProducts] = useState<ProductRow[]>(
    () => queryClient.getQueryData<ProductRow[]>(productsQK) ?? [],
  );
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  /* True once taxonomy is known (warm cache or network) — until then the
     divisions bar renders as a same-height skeleton so its arrival never
     pushes the grid down. */
  const [metaReady, setMetaReady] = useState(false);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  // Classification-icon hub overrides (level → slug → url). Lets the icons set
  // in the Database app surface as section markers in the catalogue.
  const [classIcons, setClassIcons] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => {
    let alive = true;
    fetchClassificationIcons().then((v) => { if (alive) setClassIcons(v); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const [modelCounts, setModelCounts] = useState<Record<string, number>>({});
  const [productSuppliers, setProductSuppliers] = useState<Record<string, string[]>>({});
  const [allSuppliers, setAllSuppliers] = useState<string[]>([]);
  const [primaryModelNames, setPrimaryModelNames] = useState<Record<string, string>>({});
  /* Internal work signals — fetched only under /product-data, in parallel
     with the meta round-trip, so the public catalogue payload is untouched. */
  const [signals, setSignals] = useState<Record<string, ProductSignal>>({});
  const [mainImages, setMainImages] = useState<Record<string, string>>({});
  // Skip the skeleton on revisit when the list is already cached for this scope.
  const [loading, setLoading] = useState(
    () => queryClient.getQueryData<ProductRow[]>(productsQK) == null,
  );
  /* Load-failure state — products are the critical fetch. On failure we
     show a real error + Retry instead of the misleading "No products yet"
     empty state. retryKey re-runs the load effect. */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);


  /* Filter state — persisted to sessionStorage so the back-button
     from a product detail returns the user to the same filtered
     view they left. Keyed per route (admin /product-data vs public
     /products) so the two lists don't share state. Hydrated lazily
     on first render via the useState initialiser to avoid SSR
     mismatch — `window` only exists in the browser. */
  const filterStorageKey = `kx:productList:${pathname || "default"}`;
  type FilterSnapshot = {
    div: string; cat: string; sub: string; brand: string; level: string;
    supplier: string; visible: string; featured: string; status: string;
    search: string; showFilters: boolean; viewMode: "grid" | "list";
  };
  const readFilterSnapshot = (): Partial<FilterSnapshot> => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.sessionStorage.getItem(filterStorageKey);
      return raw ? (JSON.parse(raw) as Partial<FilterSnapshot>) : {};
    } catch { return {}; }
  };
  /* Read the persisted snapshot EXACTLY once. As a plain call this ran on
     every render (sync storage read while typing) and, since the snapshot is
     rewritten on each filter change, its values went stale — which made the
     flagship-division default silently override an explicit "All divisions". */
  const initialFiltersRef = useRef<ReturnType<typeof readFilterSnapshot> | null>(null);
  if (initialFiltersRef.current === null) initialFiltersRef.current = readFilterSnapshot();
  const initialFilters = initialFiltersRef.current;

  const [filterDiv, setFilterDiv] = useState(() => {
    if (initialFilters.div) return initialFilters.div;
    /* Public catalog defaults to the flagship division. Resolve it
       SYNCHRONOUSLY from the warm taxonomy cache when possible — applying
       it post-paint re-filtered an already-visible grid (visible shuffle). */
    if (!isInternal && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(`kx_products_meta_v1:${currentScopeKey()}`);
        const m = raw ? (JSON.parse(raw) as { divisions?: { slug: string }[] }) : null;
        if (m?.divisions?.some(x => x.slug === FLAGSHIP_DIVISION_SLUG)) return FLAGSHIP_DIVISION_SLUG;
      } catch { /* fall through */ }
    }
    return initialFilters.div ?? "";
  });
  const [filterCat, setFilterCat] = useState(initialFilters.cat ?? "");
  const [filterSub, setFilterSub] = useState(initialFilters.sub ?? "");
  const [filterBrand, setFilterBrand] = useState(initialFilters.brand ?? "");
  const [filterLevel, setFilterLevel] = useState(initialFilters.level ?? "");
  const [filterSupplier, setFilterSupplier] = useState(initialFilters.supplier ?? "");
  const [filterVisible, setFilterVisible] = useState(initialFilters.visible ?? "");
  const [filterFeatured, setFilterFeatured] = useState(initialFilters.featured ?? "");
  const [filterStatus, setFilterStatus] = useState(initialFilters.status ?? "");
  const [search, setSearch] = useState(initialFilters.search ?? "");
  /* The search box stays instant, but filtering 700+ products and
     re-rendering every card on each keystroke is what made the page
     lag. useDeferredValue lets React keep the input responsive and
     render the (expensive) filtered grid at a lower priority — it can
     even interrupt a stale filter pass when the next keystroke lands. */
  const deferredSearch = useDeferredValue(search);
  const [showFilters, setShowFilters] = useState(initialFilters.showFilters ?? false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(initialFilters.viewMode ?? "grid");

  /* Search suggestions — typeahead dropdown that pops below the
     input when it has focus + at least one typed character. The
     dropdown groups matches into Categories / Subcategories /
     Brands / Products. Keyboard nav (↑↓/Enter/Escape) and a
     click-outside close are wired below. */
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    /* PERF warm-start: paint the last-known product list INSTANTLY from
       localStorage (survives full reload + iOS PWA restart, unlike the
       in-memory query cache), then refresh from the network below and
       silently replace it. Scoped by tenant + view-as so no cross-tenant
       bleed; try/catch means a corrupt/absent cache just falls through to
       the normal load path. */
    let paintedFromCache = false;
    try {
      const lsKey = `kx_products_list_v1:${currentScopeKey()}`;
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(lsKey) : null;
      if (raw) {
        const cached = JSON.parse(raw) as ProductRow[];
        if (Array.isArray(cached) && cached.length) {
          setProducts(cached);
          paintedFromCache = true;
        }
      }
      /* Warm-start the photo map too — without this, a revisit painted the
         cards instantly but every image slot sat EMPTY until the media
         round-trip finished, which read as "photos take forever". */
      const rawImgs = typeof window !== "undefined"
        ? window.localStorage.getItem(`kx_products_imgs_v1:${currentScopeKey()}`)
        : null;
      if (rawImgs) {
        const cachedImgs = JSON.parse(rawImgs) as Record<string, string>;
        if (cachedImgs && typeof cachedImgs === "object") setMainImages(cachedImgs);
      }
      /* Warm-start the taxonomy too. Without it the warm paint had NO
         division filter (slug→id map missing) and NO category order, so
         the grid painted unfiltered + unsorted, then visibly re-shuffled
         and grew a divisions bar when the meta fetch landed ~700ms later.
         With it, the first paint IS the final layout. */
      const rawMeta = typeof window !== "undefined"
        ? window.localStorage.getItem(`kx_products_meta_v1:${currentScopeKey()}`)
        : null;
      if (rawMeta) {
        const m = JSON.parse(rawMeta) as { divisions?: DivisionRow[]; categories?: CategoryRow[]; subcategories?: SubcategoryRow[] };
        if (m && Array.isArray(m.divisions) && Array.isArray(m.categories) && Array.isArray(m.subcategories)) {
          setDivisions(m.divisions);
          setCategories(m.categories);
          setSubcategories(m.subcategories);
          setMetaReady(true);
          if (!isInternal && !initialFilters.div && m.divisions.some(x => x.slug === FLAGSHIP_DIVISION_SLUG)) {
            setFilterDiv(FLAGSHIP_DIVISION_SLUG);
          }
        }
      }
    } catch { /* corrupt/absent cache → normal load path */ }
    setLoading(!paintedFromCache);
    setLoadError(null);
    /* Thumbnails arrive from either the signals bundle or the standalone
       media endpoint — one place applies them and persists the warm-start
       copy, so the next open paints photos with the first frame. */
    const applyMainImages = (imgs: Record<string, string>) => {
      setMainImages(imgs);
      try {
        const json = JSON.stringify(imgs);
        if (json.length < 1_000_000) window.localStorage.setItem(`kx_products_imgs_v1:${currentScopeKey()}`, json);
      } catch { /* quota guard */ }
    };
    (async () => {
      try {
        /* Products are the CRITICAL fetch — if this fails we must surface a
           real error + Retry, never a misleading "No products yet" state.
           A 12s abort prevents an indefinite skeleton on a stalled network.
           Filters/meta below stay tolerant (a missing filter list shouldn't
           block the catalogue from rendering). */
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 12_000);
        /* The meta fetches don't depend on the products response — start
           them immediately so they load alongside it instead of queueing
           behind the largest request on the page. */
        /* Internally the signals call already carries the model summary and
           the thumbnail map (it reads both tables anyway), so we don't pay
           two more round trips for them — on the operators' network every
           request costs ~1-2s of pure latency. The public catalogue, which
           has no signals call, still fetches them directly. */
        const metaPromise = Promise.all([
          fetchTaxonomyAll(),
          isInternal ? Promise.resolve(null) : fetchModelSummaries(),
          isInternal ? Promise.resolve(null) : fetchProductMainImages(),
        ]);
        /* If the products fetch throws we bail to the error state without
           awaiting meta — observe its rejection so it can't surface as an
           unhandled-promise error. */
        metaPromise.catch(() => {});
        /* Work signals: Product Data only, fire-and-forget so a slow or
           failed signals call can never delay (or break) the grid — the
           cards simply render without the readiness strip. */
        if (isInternal) {
          fetch("/api/products/signals", { credentials: "include", signal: ctrl.signal })
            .then((r) => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.json();
            })
            .then((j: {
              signals?: Record<string, ProductSignal>;
              models?: { counts: Record<string, number>; suppliers: Record<string, string[]>; allSuppliers: string[]; primaryModelNames: Record<string, string> };
              mainImages?: Record<string, string>;
            }) => {
              if (cancelled) return;
              if (j?.signals) setSignals(j.signals);
              if (j?.models) {
                setModelCounts(j.models.counts);
                setProductSuppliers(j.models.suppliers);
                setAllSuppliers(j.models.allSuppliers);
                setPrimaryModelNames(j.models.primaryModelNames || {});
              }
              if (j?.mainImages) applyMainImages(j.mainImages);
            })
            .catch(async () => {
              /* Signals are optional, but model codes and thumbnails are
                 not — fall back to the standalone endpoints so a signals
                 failure never strips the grid of its identity. */
              if (cancelled) return;
              try {
                const [ms, imgs] = await Promise.all([fetchModelSummaries(), fetchProductMainImages()]);
                if (cancelled) return;
                setModelCounts(ms.counts);
                setProductSuppliers(ms.suppliers);
                setAllSuppliers(ms.allSuppliers);
                setPrimaryModelNames(ms.primaryModelNames || {});
                applyMainImages(imgs);
              } catch { /* grid still renders without either */ }
            });
        }
        let p: ProductRow[];
        try {
          /* ?view=list keeps the response to the ~15 columns this grid
             actually uses — the full 80-column rows made this the page's
             megabyte-scale blocking fetch. */
          const res = await fetch("/api/products?view=list", { credentials: "include", signal: ctrl.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = (await res.json()) as { products?: ProductRow[] };
          p = json.products ?? [];
        } finally {
          clearTimeout(timeoutId);
        }
        if (cancelled) return;
        queryClient.setQueryData(productsQK, p); // warm the cache for instant revisit
        /* Persist for instant paint on the next cold load / PWA restart. */
        try {
          const json = JSON.stringify(p);
          if (json.length < 2_500_000) window.localStorage.setItem(`kx_products_list_v1:${currentScopeKey()}`, json);
        } catch { /* quota / serialize guard */ }
        /* PAINT NOW — products are the page. Taxonomy pills, model counts,
           supplier chips and photos hydrate in below the moment their
           (slower) fetches land; they must never hold the whole grid
           hostage. This is what made "opening the app" feel slow: the
           grid used to wait for the SLOWEST of five secondary requests. */
        setProducts(p);
        setLoading(false);
        /* Meta hydration — tolerant: a failed secondary fetch degrades a
           filter/photo, it must not blank an already-painted catalogue. */
        try {
          const [taxonomy, ms, imgs] = await metaPromise;
          if (cancelled) return;
          const { divisions: d, categories: c, subcategories: s } = taxonomy;
          setDivisions(d); setCategories(c);
          setSubcategories(s);
          setMetaReady(true);
          /* Persist the taxonomy for the next open's first paint. */
          try {
            const metaJson = JSON.stringify({ divisions: d, categories: c, subcategories: s });
            if (metaJson.length < 400_000) window.localStorage.setItem(`kx_products_meta_v1:${currentScopeKey()}`, metaJson);
          } catch { /* quota guard */ }
          /* null = the signals bundle is carrying these instead. */
          if (ms) {
            setModelCounts(ms.counts);
            setProductSuppliers(ms.suppliers);
            setAllSuppliers(ms.allSuppliers);
            setPrimaryModelNames(ms.primaryModelNames || {});
          }
          if (imgs) applyMainImages(imgs);
          /* Public catalog lands on Garment Machinery by default — it's
             the flagship. Only when the user has NO stored filter. */
          if (
            !isInternal &&
            !initialFilters.div &&
            d.some(x => x.slug === FLAGSHIP_DIVISION_SLUG)
          ) {
            setFilterDiv(FLAGSHIP_DIVISION_SLUG);
          }
        } catch { /* secondary data only — the grid is already up */ }
      } catch (e) {
        if (!cancelled) {
          const aborted = e instanceof DOMException && e.name === "AbortError";
          /* 401 = expired session, not a server fault — surface a
             sign-in path instead of a Retry that can never succeed. */
          const authFailed = e instanceof Error && e.message.includes("HTTP 401");
          setLoadError(
            authFailed
              ? "__auth__"
              : aborted
                ? "The server took too long to respond. Please retry."
                : humanizeError(e),
          );
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInternal, retryKey]);

  /* Persist the filter snapshot to sessionStorage on every change.
     Back-button from a detail page returns to the same view. Stays
     scoped to the current route (admin vs public) via the storage
     key so the two lists never bleed into each other. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const snapshot: FilterSnapshot = {
        div: filterDiv, cat: filterCat, sub: filterSub,
        brand: filterBrand, level: filterLevel, supplier: filterSupplier,
        visible: filterVisible, featured: filterFeatured, status: filterStatus,
        search: deferredSearch, showFilters, viewMode,
      };
      window.sessionStorage.setItem(filterStorageKey, JSON.stringify(snapshot));
    } catch { /* quota exceeded — fine */ }
  }, [
    filterDiv, filterCat, filterSub, filterBrand, filterLevel,
    filterSupplier, filterVisible, filterFeatured, filterStatus,
    deferredSearch, showFilters, viewMode, filterStorageKey,
  ]);

  const allBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.brand) set.add(p.brand); });
    return Array.from(set).sort();
  }, [products]);

  /* Close the suggestions dropdown on click-outside or Escape so
     the user always has a clean exit even when they don't pick a
     suggestion. */
  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen]);

  const allLevels = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.level) set.add(p.level); });
    return Array.from(set).sort();
  }, [products]);

  const divMap = useMemo(() => Object.fromEntries(divisions.map(d => [d.slug, d.name])), [divisions]);

  /* Divisions re-ordered so the flagship is always first in any
     UI that iterates over them (pill strip, dropdown, etc.). The
     raw `divisions` array is alphabetical from the DB; this keeps
     that ordering for the "rest" but promotes the flagship to the
     head so brand hierarchy is visible at a glance. */
  const orderedDivisions = useMemo(() => {
    const flagship = divisions.filter(d => d.slug === FLAGSHIP_DIVISION_SLUG);
    const rest = divisions.filter(d => d.slug !== FLAGSHIP_DIVISION_SLUG);
    return [...flagship, ...rest];
  }, [divisions]);
  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.slug, localizedName(c, lang)])), [categories, lang]);

  const selectedDivId = useMemo(() => divisions.find(d => d.slug === filterDiv)?.id, [divisions, filterDiv]);
  const filteredCats = useMemo(() => selectedDivId ? categories.filter(c => c.division_id === selectedDivId) : categories, [categories, selectedDivId]);
  const selectedCatId = useMemo(() => categories.find(c => c.slug === filterCat)?.id, [categories, filterCat]);
  const filteredSubs = useMemo(() => selectedCatId ? subcategories.filter(s => s.category_id === selectedCatId) : subcategories, [subcategories, selectedCatId]);

  /* Cheap O(1) lookups so the search hot path doesn't re-scan the
     taxonomy arrays for every product on every keystroke. Built
     here (not inside the memo) so they're shared with section
     headers downstream. */
  const divNameBySlug = useMemo(
    () => Object.fromEntries(divisions.map(d => [d.slug, localizedName(d, lang).toLowerCase()])),
    [divisions, lang],
  );
  const catNameBySlug = useMemo(
    () => Object.fromEntries(categories.map(c => [c.slug, localizedName(c, lang).toLowerCase()])),
    [categories, lang],
  );
  const subNameBySlug = useMemo(
    () => Object.fromEntries(subcategories.map(s => [s.slug, localizedName(s, lang).toLowerCase()])),
    [subcategories, lang],
  );

  /* Pre-build the per-product search haystack ONCE so each keystroke
     just runs N substring checks instead of rebuilding 600+ joined
     strings every render. Matters when the catalog grows past a few
     hundred products and the user is typing live. */
  const searchHaystack = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of products) {
      const mn = (primaryModelNames[p.id] || "").toLowerCase();
      map[p.id] = [
        p.product_name.toLowerCase(),
        p.slug,
        mn,
        (p.brand || "").toLowerCase(),
        (p.excerpt || "").toLowerCase(),
        (p.description || "").toLowerCase(),
        (p.level || "").toLowerCase(),
        (p.status || "").toLowerCase(),
        divNameBySlug[p.division_slug] || "",
        catNameBySlug[p.category_slug] || "",
        subNameBySlug[p.subcategory_slug] || "",
        (p.tags || []).join(" ").toLowerCase(),
      ].join(" ");
    }
    return map;
  }, [products, primaryModelNames, divNameBySlug, catNameBySlug, subNameBySlug]);

  /* Typeahead suggestions built from the typed query.
       · Categories  → click sets the category filter
       · Subcategories → click sets the subcategory filter
       · Brands  → click sets the brand filter
       · Products → click navigates to that product
     Each section is capped (3-6) to keep the dropdown short, with
     the first section being whatever currently has the strongest
     match so common typed prefixes (like "I" for "Industrial...")
     surface category hits first. */
  type Suggestion =
    | { kind: "category"; slug: string; label: string; count: number }
    | { kind: "subcategory"; slug: string; categorySlug: string; label: string; count: number }
    | { kind: "brand"; label: string; count: number }
    | { kind: "product"; id: string; slug: string; label: string; modelCode?: string; thumb?: string };

  /* Tallies for the suggestion dropdown. They depend only on `products`, so
     keeping them inside the search-keyed memo meant a full 705-product pass
     on every keystroke for output that never changed. */
  const suggestionCounts = useMemo(() => {
    const categoryProductCounts: Record<string, number> = {};
    const subcategoryProductCounts: Record<string, number> = {};
    const brandProductCounts: Record<string, number> = {};
    for (const p of products) {
      categoryProductCounts[p.category_slug] = (categoryProductCounts[p.category_slug] || 0) + 1;
      subcategoryProductCounts[p.subcategory_slug] = (subcategoryProductCounts[p.subcategory_slug] || 0) + 1;
      if (p.brand) brandProductCounts[p.brand] = (brandProductCounts[p.brand] || 0) + 1;
    }
    return { categoryProductCounts, subcategoryProductCounts, brandProductCounts };
  }, [products]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q.length < 1) return [] as Suggestion[];

    const { categoryProductCounts, subcategoryProductCounts, brandProductCounts } = suggestionCounts;

    /* Prefer prefix matches first (typing "i" → Industrial Sewing
       Machines comes before Cutting Equipment), fall back to
       contains-matches after, deduplicated. */
    const prefixThenContains = (haystack: string, needle: string) => {
      const h = haystack.toLowerCase();
      if (h.startsWith(needle)) return 0;
      if (h.split(/\s+/).some(w => w.startsWith(needle))) return 1;
      if (h.includes(needle)) return 2;
      return -1;
    };

    const cats = categories
      .map(c => ({ c, score: prefixThenContains(c.name, q) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 4)
      .map(({ c }): Suggestion => ({ kind: "category", slug: c.slug, label: c.name, count: categoryProductCounts[c.slug] || 0 }));

    const subs = subcategories
      .map(s => ({ s, score: prefixThenContains(s.name, q) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map(({ s }): Suggestion => ({
        kind: "subcategory",
        slug: s.slug,
        categorySlug: categories.find(c => c.id === s.category_id)?.slug || "",
        label: s.name,
        count: subcategoryProductCounts[s.slug] || 0,
      }));

    const brands = allBrands
      .map(b => ({ b, score: prefixThenContains(b, q) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(({ b }): Suggestion => ({ kind: "brand", label: b, count: brandProductCounts[b] || 0 }));

    const prods: Suggestion[] = [];
    for (const p of products) {
      const mn = primaryModelNames[p.id] || "";
      const sName = prefixThenContains(p.product_name, q);
      const sModel = mn ? prefixThenContains(mn, q) : -1;
      const score = Math.min(sName === -1 ? Infinity : sName, sModel === -1 ? Infinity : sModel);
      if (!Number.isFinite(score)) continue;
      prods.push({ kind: "product", id: p.id, slug: p.slug || p.id, label: p.product_name, modelCode: mn || undefined, thumb: mainImages[p.id], _score: score } as Suggestion & { _score: number });
    }
    (prods as (Suggestion & { _score: number })[]).sort((a, b) => a._score - b._score);
    const productSuggestions = prods.slice(0, 6);

    return [...cats, ...subs, ...brands, ...productSuggestions];
  }, [search, categories, subcategories, allBrands, products, primaryModelNames, mainImages]);

  /* Reset the keyboard cursor whenever the suggestion list changes. */
  /* Functional bail-out: returning the identical value lets React skip the
     re-render, so typing no longer costs a second full pass over the tree. */
  useEffect(() => { setActiveSuggestionIdx((i) => (i === -1 ? i : -1)); }, [suggestions]);

  /* PERF smooth-open: mounting 700+ product cards in one commit froze the
     main thread right as the page appeared (the "opens not smooth" jank).
     Reveal category sections progressively — first 2 immediately (above
     the fold), then pump the rest in small idle slices. Unmounted sections
     keep their <section id> and reserved height so the category jump-nav
     and scroll position stay correct. */


  /* Highlight matched substring inside a suggestion label. */
  const highlight = (label: string, q: string) => {
    if (!q) return label;
    const i = label.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return label;
    return (
      <>
        {label.slice(0, i)}
        <strong className="text-[var(--text-highlight)] font-bold">{label.slice(i, i + q.length)}</strong>
        {label.slice(i + q.length)}
      </>
    );
  };

  /* Apply a suggestion: either set a filter or navigate to a product. */
  const applySuggestion = (s: Suggestion) => {
    setSearchOpen(false);
    setSearch("");
    setActiveSuggestionIdx(-1);
    if (s.kind === "category") {
      const cat = categories.find(c => c.slug === s.slug);
      const div = divisions.find(d => d.id === cat?.division_id);
      if (div) setFilterDiv(div.slug);
      setFilterCat(s.slug);
      setFilterSub("");
    } else if (s.kind === "subcategory") {
      const cat = categories.find(c => c.slug === s.categorySlug);
      const div = divisions.find(d => d.id === cat?.division_id);
      if (div) setFilterDiv(div.slug);
      if (cat) setFilterCat(cat.slug);
      setFilterSub(s.slug);
    } else if (s.kind === "brand") {
      setFilterBrand(s.label);
    } else if (s.kind === "product") {
      router.push(`${baseRoute}/${s.slug}`);
    }
  };

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    return products.filter(p => {
      if (filterDiv && p.division_slug !== filterDiv) return false;
      if (filterCat && p.category_slug !== filterCat) return false;
      if (filterSub && p.subcategory_slug !== filterSub) return false;
      if (filterBrand && p.brand !== filterBrand) return false;
      if (filterLevel && p.level !== filterLevel) return false;
      if (filterSupplier && !(productSuppliers[p.id] || []).includes(filterSupplier)) return false;
      if (filterVisible === "visible" && !p.visible) return false;
      if (filterVisible === "hidden" && p.visible) return false;
      if (filterFeatured === "yes" && !p.featured) return false;
      if (filterFeatured === "no" && p.featured) return false;
      if (filterStatus && (p.status || "draft") !== filterStatus) return false;
      if (tokens.length > 0) {
        const hay = searchHaystack[p.id] || "";
        for (const t of tokens) if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [products, filterDiv, filterCat, filterSub, filterBrand, filterLevel, filterSupplier, filterVisible, filterFeatured, filterStatus, deferredSearch, productSuppliers, searchHaystack]);

  /* Build sub-category and category name lookup tables once so
     section headers + the search index resolve in O(1). */
  const subMap = useMemo(
    () => Object.fromEntries(subcategories.map(s => [s.slug, localizedName(s, lang)])),
    [subcategories, lang],
  );

  /* TWO-LEVEL grouping: Category → Subcategory → Products.
     Lands the user on a real catalog page where each top-level
     CATEGORY (Industrial Sewing Machines / Cutting Equipment /
     Embroidery Equipment / etc.) is its own banner-headed section,
     and within it each SUBCATEGORY is a sub-section of cards.

     Order:
       · Categories appear in the order returned by fetchCategories
         (DB `order` then name).
       · Subcategories within each category match the DB order.

     Empty buckets drop out automatically. */
  type CategoryGroup = {
    slug: string;
    name: string;
    total: number;
    subSections: { slug: string; name: string; products: ProductRow[] }[];
  };

  const categoryTree = useMemo<CategoryGroup[]>(() => {
    /* Grid-only: the list branch renders `filtered` directly, so building the
       tree there was pure waste on every keystroke. */
    if (viewMode !== "grid" || filtered.length === 0) return [];
    // Build product index: cat -> sub -> ProductRow[]
    const catBuckets: Record<string, Record<string, ProductRow[]>> = {};
    for (const p of filtered) {
      const c = p.category_slug || "_uncategorized";
      const s = p.subcategory_slug || "_uncategorized";
      if (!catBuckets[c]) catBuckets[c] = {};
      if (!catBuckets[c][s]) catBuckets[c][s] = [];
      catBuckets[c][s].push(p);
    }
    /* Rank maps: the comparators used to call indexOf() on every comparison,
       re-scanning the taxonomy arrays O(n log n) times per filter change. */
    const catRank = new Map(categories.map((c, i) => [c.slug, i]));
    const subRank = new Map(subcategories.map((x, i) => [x.slug, i]));
    const rank = (m: Map<string, number>, k: string) => m.get(k) ?? Number.MAX_SAFE_INTEGER;
    const catSlugs = Object.keys(catBuckets).sort((a, b) => rank(catRank, a) - rank(catRank, b));
    return catSlugs.map(catSlug => {
      const catName = catNameBySlug[catSlug] || (catSlug === "_uncategorized" ? t("list.uncategorized", "Uncategorized") : catSlug);
      const subSlugs = Object.keys(catBuckets[catSlug]).sort((a, b) => rank(subRank, a) - rank(subRank, b));
      const subSections = subSlugs.map(subSlug => ({
        slug: subSlug,
        name: subMap[subSlug] || (subSlug === "_uncategorized" ? t("list.other", "Other") : subSlug),
        products: catBuckets[catSlug][subSlug],
      }));
      const total = subSections.reduce((a, s) => a + s.products.length, 0);
      // Capitalise first letter of category name even if input is title cased lower in our map
      const displayName = catName.charAt(0).toUpperCase() + catName.slice(1);
      return { slug: catSlug, name: displayName, total, subSections };
    });
  }, [filtered, categories, subcategories, subMap, catNameBySlug, viewMode]);

  /* The division is deliberately NOT counted here: it has its own
     dedicated pill strip below the toolbar, so echoing it again in the
     Filters badge + ACTIVE chips row + "Showing X" line made the page
     top read three ways for one fact (owner: "too messy"). */
  const activeFilterCount = [filterCat, filterSub, filterBrand, filterLevel, filterSupplier, filterVisible, filterFeatured, filterStatus].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterDiv(""); setFilterCat(""); setFilterSub(""); setFilterBrand("");
    setFilterLevel(""); setFilterSupplier(""); setFilterVisible(""); setFilterFeatured(""); setFilterStatus("");
    setSearch("");
  };

  /* Delete confirmation — goes through the themed ConfirmDialog
     instead of the native window.confirm() which Safari renders
     with a system dialog that clashes with the hub's dark theme. */
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const askDelete = useCallback((e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({ id, name });
  }, []);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    const ok = await deleteProduct(id);
    if (!ok) return;
    setProducts((prev) => {
      const next = prev.filter((x) => x.id !== id);
      /* Keep the warm caches in step — otherwise the next visit paints the
         deleted product from localStorage and it vanishes when the network
         lands. */
      queryClient.setQueryData(productsQK, next);
      try {
        const json = JSON.stringify(next);
        if (json.length < 2_500_000) window.localStorage.setItem(`kx_products_list_v1:${currentScopeKey()}`, json);
      } catch { /* quota guard */ }
      return next;
    });
  };

  const selectClass = "h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-secondary)] outline-none focus:border-[var(--border-focus)]";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link href="/" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              {isInternal ? <ProductDataIcon size={16} /> : <ProductsIcon size={16} />}
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
              {isInternal ? t("list.productData") : t("list.products")}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Settings + Add are admin tools — only surface them on
                the internal /product-data path. The public /products
                catalog is read-only for customers. */}
            {isInternal && (
              <>
                <Link href={`${baseRoute}/settings`} className="h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all">
                  <SettingsIcon2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("list.controlPanel")}</span>
                </Link>
                {/* "Visual Library" button removed — it now lives in the
                    Database app (Database › Visual Library › Specs & Attributes;
                    /product-data/visual-mapping already redirects there), so a
                    duplicate entry point here was just header clutter. */}
                <Link href={`${baseRoute}/new`} className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg">
                  <PlusIcon className="h-4 w-4" /> {t("action.addProduct")}
                </Link>
              </>
            )}
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-dim)] mb-1 md:mb-1.5 ml-0 md:ml-11">
          {products.length} {t("list.countInCatalog")}
        </p>

        {/* Search + Filters — sticky to the top of the viewport so
            the user can refine the query without scrolling back up.
            z-30 sits above the category jump-nav (z-20) so the
            search row always wins when both stack. */}
        <div className="sticky top-0 z-30 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 pt-1 pb-2 mb-3 bg-[var(--bg-primary)]">
        <div>
          <div className="flex gap-3">
            <div className="relative flex-1" ref={searchBoxRef}>
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)] z-10" />
              <input
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSearchOpen(true);
                    setActiveSuggestionIdx(i => Math.min(i + 1, suggestions.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSuggestionIdx(i => Math.max(i - 1, -1));
                  } else if (e.key === "Enter" && activeSuggestionIdx >= 0 && suggestions[activeSuggestionIdx]) {
                    e.preventDefault();
                    applySuggestion(suggestions[activeSuggestionIdx]);
                  } else if (e.key === "Escape") {
                    setSearchOpen(false);
                  }
                }}
                placeholder={t("list.searchPlaceholder")}
                aria-label={t("list.searchAria")}
                aria-autocomplete="list"
                aria-expanded={searchOpen && suggestions.length > 0}
                className="w-full h-10 pl-10 pr-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none transition-[border-color,box-shadow] focus:border-[#567FB2]/60 focus:shadow-[0_0_0_4px_rgba(86,127,178,0.16)] [&::-webkit-search-cancel-button]:hidden"
              />
              {/* Clear button — only when there's text. Native input
                  type=search clear button is inconsistent across
                  browsers so we render our own. */}
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setSearchOpen(false); }}
                  aria-label={t("list.clearSearch")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <span className="text-[16px] leading-none">×</span>
                </button>
              )}

              {/* ── Suggestions dropdown ── Pops below the input
                  while focused with a non-empty query. Groups
                  matches by kind (Categories, Subcategories,
                  Brands, Products). Keyboard nav: ↑↓ moves the
                  active row, Enter applies, Escape closes. */}
              {searchOpen && suggestions.length > 0 && (
                <div
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-[420px] overflow-y-auto rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-2xl"
                >
                  {(() => {
                    const groups: { title: string; items: Suggestion[] }[] = [];
                    const cats = suggestions.filter(s => s.kind === "category");
                    const subs = suggestions.filter(s => s.kind === "subcategory");
                    const brs  = suggestions.filter(s => s.kind === "brand");
                    const prs  = suggestions.filter(s => s.kind === "product");
                    if (cats.length) groups.push({ title: t("search.groupCategories"), items: cats });
                    if (subs.length) groups.push({ title: t("search.groupSubcategories"), items: subs });
                    if (brs.length)  groups.push({ title: t("search.groupBrands"), items: brs });
                    if (prs.length)  groups.push({ title: t("search.groupProducts"), items: prs });

                    let idx = -1;
                    return groups.map((g) => (
                      <div key={g.title}>
                        <div className="sticky top-0 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-ghost)] bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]/40">
                          {g.title}
                        </div>
                        {g.items.map((s) => {
                          idx++;
                          const isActive = idx === activeSuggestionIdx;
                          const key = `${s.kind}-${"slug" in s ? s.slug : "id" in s ? s.id : s.label}`;
                          return (
                            <button
                              key={key}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onMouseEnter={() => setActiveSuggestionIdx(idx)}
                              onClick={() => applySuggestion(s)}
                              className={`w-full text-left flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors border-l-2 ${
                                isActive
                                  ? "bg-[var(--bg-surface)] border-[var(--border-focus)] text-[var(--text-primary)]"
                                  : "border-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                              }`}
                            >
                              {/* Icon / thumb per kind */}
                              {s.kind === "product" ? (
                                <div className="h-9 w-9 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] overflow-hidden shrink-0 flex items-center justify-center">
                                  {s.thumb ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={IMG.thumb(s.thumb)} alt="" className="w-full h-full object-contain p-1" />
                                  ) : (
                                    <ImageRawIcon className="h-4 w-4 text-[var(--text-ghost)]" />
                                  )}
                                </div>
                              ) : (
                                <div className="h-7 w-7 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                                  {s.kind === "category" && <LayersIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                  {s.kind === "subcategory" && <BoxesIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                  {s.kind === "brand" && <TagsIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                </div>
                              )}

                              {/* Label + secondary line */}
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                  {s.kind === "product" && s.modelCode
                                    ? <>{highlight(s.modelCode, search)}<span className="text-[var(--text-dim)] ml-2 font-normal">{highlight(s.label, search)}</span></>
                                    : highlight(s.label, search)}
                                </div>
                                {s.kind === "subcategory" && (
                                  <div className="text-[11px] text-[var(--text-dim)] truncate">
                                    {t("search.inCategory")} {catNameBySlug[s.categorySlug] || s.categorySlug}
                                  </div>
                                )}
                              </div>

                              {/* Trailing count or arrow */}
                              {("count" in s) ? (
                                <span className="shrink-0 text-[10px] tabular-nums font-semibold text-[var(--text-dim)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-full px-1.5 h-[18px] inline-flex items-center justify-center">
                                  {s.count}
                                </span>
                              ) : (
                                <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-ghost)] font-semibold">
                                  {t("search.open")}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
            {/* View Toggle */}
            <div className="flex rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`h-10 w-10 flex items-center justify-center transition-all ${
                  viewMode === "grid"
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                }`}
              >
                <LayoutGridIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`h-10 w-10 flex items-center justify-center border-l border-[var(--border-subtle)] transition-all ${
                  viewMode === "list"
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                }`}
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 px-4 rounded-xl border text-[12px] font-medium flex items-center gap-2 transition-all ${
                showFilters || activeFilterCount > 0
                  ? "bg-[var(--bg-surface)] border-[var(--border-focus)] text-[var(--text-primary)]"
                  : "bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-[var(--text-muted)]"
              }`}
            >
              <FilterIcon className="h-3.5 w-3.5" />
              {t("list.filters", "Filters")}
              {activeFilterCount > 0 && (
                <span className="h-5 min-w-[20px] px-1 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="h-10 px-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-muted)] flex items-center gap-1.5 transition-colors"
              >
                <CrossIcon className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.division")}</label>
                  <select value={filterDiv} onChange={(e) => { setFilterDiv(e.target.value); setFilterCat(""); setFilterSub(""); }} className={selectClass + " w-full"}>
                    <option value="">{t("list.allOption")}</option>
                    {orderedDivisions.map(d => <option key={d.slug} value={d.slug}>{localizedName(d, lang)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.category")}</label>
                  <select value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setFilterSub(""); }} className={selectClass + " w-full"} disabled={!filterDiv}>
                    <option value="">{t("list.allOption")}</option>
                    {filteredCats.map(c => <option key={c.slug} value={c.slug}>{localizedName(c, lang)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.subcategory")}</label>
                  <select value={filterSub} onChange={(e) => setFilterSub(e.target.value)} className={selectClass + " w-full"} disabled={!filterCat}>
                    <option value="">{t("list.allOption")}</option>
                    {filteredSubs.map(s => <option key={s.slug} value={s.slug}>{localizedName(s, lang)}</option>)}
                  </select>
                </div>
                {/* Supplier filter is an internal concept — hide on
                    the public /products catalog. */}
                {isInternal && (
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.supplier")}</label>
                    <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className={selectClass + " w-full"}>
                      <option value="">{t("list.allOption")}</option>
                      {allSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.brand")}</label>
                  <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className={selectClass + " w-full"}>
                    <option value="">{t("list.allOption")}</option>
                    {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.level")}</label>
                  <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className={selectClass + " w-full"}>
                    <option value="">{t("list.allOption")}</option>
                    {allLevels.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.visibility")}</label>
                  <select value={filterVisible} onChange={(e) => setFilterVisible(e.target.value)} className={selectClass + " w-full"}>
                    <option value="">{t("list.allOption")}</option>
                    <option value="visible">{t("filter.visible")}</option>
                    <option value="hidden">{t("filter.hidden")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.status")}</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass + " w-full"}>
                    <option value="">{t("list.allOption")}</option>
                    <option value="draft">{t("status.draft")}</option>
                    <option value="active">{t("status.active")}</option>
                    <option value="archived">{t("status.archived")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.featured")}</label>
                  <select value={filterFeatured} onChange={(e) => setFilterFeatured(e.target.value)} className={selectClass + " w-full"}>
                    <option value="">{t("list.allOption")}</option>
                    <option value="yes">{t("filter.isFeatured")}</option>
                    <option value="no">{t("filter.notFeatured")}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Active filter chips — surfaces every active filter as a
              removable chip so the user always knows what's narrowing
              the catalog. Click the X on any chip to clear just that
              filter; clearing the search via the X here also clears
              its own filter. Only renders when at least one is set. */}
          {(activeFilterCount > 0 || search) && (
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-ghost)]">{t("list.activeFilters")}</span>
              {(() => {
                const chips: { label: string; onClear: () => void }[] = [];
                if (search) chips.push({ label: `"${search}"`, onClear: () => setSearch("") });
                if (filterCat) chips.push({ label: `${t("filter.category")}: ${catNameBySlug[filterCat] || filterCat}`, onClear: () => { setFilterCat(""); setFilterSub(""); } });
                if (filterSub) chips.push({ label: `${t("filter.subcategory")}: ${subNameBySlug[filterSub] || filterSub}`, onClear: () => setFilterSub("") });
                if (filterBrand) chips.push({ label: `${t("filter.brand")}: ${filterBrand}`, onClear: () => setFilterBrand("") });
                if (filterLevel) chips.push({ label: `${t("filter.level")}: ${filterLevel}`, onClear: () => setFilterLevel("") });
                if (filterSupplier) chips.push({ label: `${t("filter.supplier")}: ${filterSupplier}`, onClear: () => setFilterSupplier("") });
                if (filterVisible) chips.push({ label: filterVisible === "visible" ? t("filter.visible") : t("filter.hidden"), onClear: () => setFilterVisible("") });
                if (filterFeatured) chips.push({ label: filterFeatured === "yes" ? t("filter.isFeatured") : t("filter.notFeatured"), onClear: () => setFilterFeatured("") });
                if (filterStatus) chips.push({ label: `${t("filter.status")}: ${filterStatus}`, onClear: () => setFilterStatus("") });
                return chips.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 h-7 pl-3 pr-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-focus)] text-[11px] font-medium text-[var(--text-primary)]">
                    {c.label}
                    <button
                      type="button"
                      onClick={c.onClear}
                      aria-label={t("list.removeFilter").replace("{label}", c.label)}
                      className="h-5 w-5 rounded-full flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                    >
                      <span className="text-[14px] leading-none">×</span>
                    </button>
                  </span>
                ));
              })()}
            </div>
          )}
        </div>
        </div>

        {/* ── Division pill strip ──
            Koleex's brand hierarchy, surfaced visually. "All" is the
            opt-out; Garment Machinery is the flagship (always pinned
            first, always rendered as a filled accent pill even when
            not selected so it reads as the primary line); the rest
            are outlined secondary pills. Horizontally scrollable on
            mobile so long division names don't wrap awkwardly. */}
        {orderedDivisions.length === 0 && !metaReady && (
          /* Height-reserving skeleton for the divisions bar (matches the
             real strip: rounded-xl shell, pill row). Prevents the whole
             page from being pushed down when the taxonomy fetch lands. */
          <div className="mb-6">
            <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1.5 py-1.5">
              {[88, 132, 108, 96, 84].map((w, i) => (
                <div key={i} className="h-[30px] rounded-lg bg-[var(--bg-inverted)]/[0.05] animate-pulse" style={{ width: w }} />
              ))}
            </div>
          </div>
        )}
        {orderedDivisions.length > 0 && (
          <div className="mb-4">
            {/* Sliding-pill nav shell — matches the Database/app tab nav:
                one bordered rounded-xl container, compact pills inside, the
                active one filled. Divisions are client filters (buttons), so
                this mirrors SlidingPillNav's look without its href routing. */}
            <div
              role="tablist"
              aria-label={t("list.divisions")}
              className="relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {/* "All" — clears the division filter. */}
              <button
                type="button"
                role="tab"
                aria-selected={filterDiv === ""}
                onClick={() => { setFilterDiv(""); setFilterCat(""); setFilterSub(""); }}
                className={`relative z-10 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                  filterDiv === ""
                    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
                }`}
              >
                <LayoutGridIcon className="h-3.5 w-3.5 opacity-80 shrink-0" />
                {t("list.allDivisions", "All divisions")}
              </button>

              {orderedDivisions.map((d) => {
                const isActive = filterDiv === d.slug;
                /* Prefer the icon saved for this division in the Classification
                   Icon Hub (classIcons.division[slug]); fall back to a built-in
                   keyword icon when none is assigned yet. */
                const savedIcon = classIcons.division?.[d.slug];
                const DivIcon = divisionIcon(d.name);
                return (
                  <button
                    key={d.slug}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => { setFilterDiv(d.slug); setFilterCat(""); setFilterSub(""); }}
                    className={`relative z-10 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {/* Fixed 16px icon slot: the saved hub icon replaces the
                        fallback async — identical boxes mean the pill width
                        never changes when it lands (no bar jitter). */}
                    <span className="h-4 w-4 flex items-center justify-center shrink-0">
                      {savedIcon
                        ? <ClassMonoIcon src={savedIcon} className="h-4 w-4" />
                        : <DivIcon className="h-3.5 w-3.5 opacity-80" />}
                    </span>
                    {localizedName(d, lang)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Results count — live tally tied to the search/filter state.
            When a search is typed, surface the match count
            prominently so the user gets immediate feedback that
            the query is doing something. */}
        {(activeFilterCount > 0 || search) && (
          <p className="text-[12px] text-[var(--text-dim)] mb-4 px-1">
            {filtered.length === 0 ? (
              <span className="text-amber-400">{t("list.noMatchesFor")} <strong className="text-[var(--text-primary)]">"{search}"</strong></span>
            ) : (
              <>{t("list.showing")} <strong className="text-[var(--text-primary)] tabular-nums">{filtered.length}</strong> {t("list.ofProducts").replace("{total}", String(products.length))}{search ? <> {t("list.matching")} <strong className="text-[var(--text-primary)]">"{search}"</strong></> : null}</>
            )}
          </p>
        )}

        {/* Product Grid / List */}
        {loadError === "__auth__" ? (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-16 text-center">
            <ProductsIcon size={48} className="text-[var(--text-barely)] mx-auto mb-4" />
            <p className="text-[var(--text-primary)] text-[14px] font-semibold">{t("state.sessionExpiredTitle", "Session expired")}</p>
            <p className="text-[var(--text-muted)] text-[13px] mt-1">{t("state.sessionExpiredHint", "Please sign in again to load the catalog.")}</p>
            <a
              href="/login"
              className="inline-flex items-center gap-2 mt-4 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg"
            >
              {t("action.signInAgain", "Sign in again")}
            </a>
          </div>
        ) : loadError ? (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-red-500/30 p-16 text-center">
            <ProductsIcon size={48} className="text-red-400/70 mx-auto mb-4" />
            <p className="text-[var(--text-primary)] text-[14px] font-semibold">{t("state.loadFailedTitle")}</p>
            <p className="text-[var(--text-muted)] text-[13px] mt-1">{loadError}</p>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="inline-flex items-center gap-2 mt-4 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg"
            >
              {t("action.retry")}
            </button>
          </div>
        ) : loading ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden animate-pulse">
                  <div className="aspect-[4/3] bg-[var(--bg-surface-subtle)]" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-[var(--bg-surface-subtle)] rounded w-3/4" />
                    <div className="h-3 bg-[var(--bg-surface-subtle)] rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-subtle)]">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                  <div className="h-14 w-14 rounded-xl bg-[var(--bg-surface-subtle)] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--bg-surface-subtle)] rounded w-1/3" />
                    <div className="h-3 bg-[var(--bg-surface-subtle)] rounded w-1/4" />
                  </div>
                  <div className="h-6 w-16 bg-[var(--bg-surface-subtle)] rounded" />
                </div>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-16 text-center">
            <ProductsIcon size={48} className="text-[var(--text-barely)] mx-auto mb-4" />
            <p className="text-[var(--text-dim)] text-[14px] font-medium">
              {products.length === 0 ? t("state.noProducts") : t("state.noResults")}
            </p>
            <p className="text-[var(--text-ghost)] text-[13px] mt-1">
              {products.length === 0 ? t("list.noProductsYetHint") : t("list.noResultsHint")}
            </p>
            {products.length === 0 && isInternal && (
              <Link href={`${baseRoute}/new`} className="inline-flex items-center gap-2 mt-4 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all">
                <PlusIcon className="h-4 w-4" /> {t("action.addProduct")}
              </Link>
            )}
          </div>
        ) : viewMode === "grid" ? (
          /* Two-level catalog layout:
               CATEGORY banner (e.g. "Industrial Sewing Machines")
                 SUB-CATEGORY header  (e.g. "Lockstitch Machines")
                   product cards in a 4-column grid
                 SUB-CATEGORY header  (e.g. "Overlock Machines")
                   product cards
               CATEGORY banner (e.g. "Cutting Equipment")
                 SUB-CATEGORY header
                   product cards
               …

             Sticky jump-nav at the top lets the user hop between
             categories instantly. content-visibility:auto on each
             category section keeps render fast even with 600+ cards
             mounted at once. */
          <>
            {/* ── Category jump-nav ── */}
            {categoryTree.length > 1 && (
              <nav className="sticky top-[49px] z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 pt-1.5 pb-3.5 mb-5 bg-[var(--bg-primary)]" aria-label="Categories">
                {/* Light secondary jump-nav — quieter than the Divisions filter
                    above: borderless ghost links with plain muted counts, so the
                    two rows read as a clear primary/secondary hierarchy. */}
                {/* Boxed chips (owner, 2026-08-02): bordered mini-tiles with
                    the category's hub icon + name — secondary-button language
                    instead of the old ghost text links. */}
                {/* On a phone the 88px tile grid wrapped to four rows and ate
                    roughly half the viewport before a single product was
                    visible. Below `sm` the same links render as ONE
                    horizontally-scrolling row of compact pills — the exact
                    language of the Divisions bar above — which costs ~40px
                    instead of ~380px. From `sm` up the tile grid is unchanged.
                    One DOM tree, responsive classes: no duplicated markup and
                    no second copy for screen readers to read out. */}
                <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(100px,1fr))] max-sm:flex max-sm:overflow-x-auto max-sm:pb-0.5 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden">
                  {categoryTree.map((cat) => (
                    <a
                      key={cat.slug}
                      href={`#cat-${cat.slug}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById(`cat-${cat.slug}`);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="group relative flex flex-col items-center justify-center gap-2 w-full h-[88px] p-2 rounded-2xl bg-[var(--bg-card)] border border-white/[0.06] kx-hover-card kx-hover-tile kx-tile-neon select-none transition-transform duration-75 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 max-sm:h-[36px] max-sm:w-auto max-sm:shrink-0 max-sm:flex-row max-sm:justify-start max-sm:gap-1.5 max-sm:px-3 max-sm:py-0 max-sm:rounded-full"
                    >
                      {classIcons.category?.[cat.slug] ? (
                        <ClassMonoIcon src={classIcons.category[cat.slug]} className="kx-neon-icon h-[22px] w-[22px] text-[var(--text-primary)] opacity-90 max-sm:h-4 max-sm:w-4 max-sm:shrink-0" />
                      ) : (
                        <LayoutGridIcon className="kx-neon-svg h-[22px] w-[22px] text-[var(--text-primary)] opacity-90 max-sm:h-4 max-sm:w-4 max-sm:shrink-0" />
                      )}
                      <span className="kx-neon-label text-[10px] font-medium text-center leading-tight text-[var(--text-muted)] line-clamp-2 max-sm:text-[11px] max-sm:leading-none max-sm:whitespace-nowrap">{cat.name}</span>
                    </a>
                  ))}
                </div>
              </nav>
            )}

          <div className="space-y-14">
          {categoryTree.map((cat) => (
            /* Every section renders; content-visibility:auto skips the paint +
               layout of the offscreen ones. This replaced a progressive-mount
               scheme whose reserved-height placeholders collapsed to real size
               on mount and drove cold CLS to ~1.0 (measured). */
            <section
              key={cat.slug}
              id={`cat-${cat.slug}`}
              style={SECTION_CV}
              className="scroll-mt-32"
            >
              {/* ── CATEGORY headline — minimal & monochrome: icon in a clean
                  bordered tile, title, count on the right, then a hairline that
                  separates the header from the grid so each category reads as a
                  tidy, self-contained block. */}
              <div className="mb-7">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {classIcons.category?.[cat.slug] && (
                      <span className="h-9 w-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                        <ClassMonoIcon src={classIcons.category?.[cat.slug]} className="h-[18px] w-[18px] text-[var(--text-secondary)]" />
                      </span>
                    )}
                    <h2 className="text-[18px] md:text-[22px] font-bold tracking-tight text-[var(--text-primary)] truncate leading-tight">
                      {cat.name}
                    </h2>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-[var(--text-ghost)] tabular-nums whitespace-nowrap">
                    {cat.total} {cat.total === 1 ? t("list.productOne", "product") : t("list.productMany", "products")}
                  </span>
                </div>
                <div className="mt-3 h-px bg-[var(--border-subtle)]" />
              </div>

              {/* Sub-sections within the category */}
              <div className="space-y-10">
              {cat.subSections.map((section) => (
                <div key={section.slug}>
                  {/* Subcategory icons removed (owner, 2026-08-02) — the
                      name + count pill carry the row; icons doubled the
                      visual noise under every category. */}
                  <header className="flex items-center gap-2.5 mb-4">
                    <h3 className="text-[14px] md:text-[16px] font-semibold tracking-tight text-[var(--text-primary)]">
                      {section.name}
                    </h3>
                    <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">
                      {section.products.length}
                    </span>
                    <span className="flex-1 h-px bg-[var(--border-subtle)] ml-1" />
                  </header>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {section.products.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                imgUrl={mainImages[p.id]}
                models={modelCounts[p.id] || 0}
                suppliers={productSuppliers[p.id] || EMPTY_SUPPLIERS}
                lvl={levelColors[p.level || ""] || ""}
                baseRoute={baseRoute}
                isInternal={isInternal}
                catMap={catMap}
                subMap={subMap}
                divMap={divMap}
                primaryModelNames={primaryModelNames}
                signal={signals[p.id]}
                t={t}
                onAskDelete={askDelete}
              />
            ))}
              </div>
                </div>
              ))}
              </div>
            </section>
          ))}
          </div>
          </>
        ) : (
          /* ── List View ── */
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            {/* List header */}
            {/* Internal table trades the Brand column (always "Koleex")
                for the two numbers an operator actually scans: readiness
                and cost. Public table keeps Brand. */}
            <div className="hidden md:grid grid-cols-[56px_1fr_140px_120px_100px_80px_80px] gap-4 items-center px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
              <span />
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("list.colProduct")}</span>
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("list.colCategory")}</span>
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                {isInternal ? t("list.colReady", "Ready") : t("list.colBrand")}
              </span>
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                {isInternal ? t("list.colCost", "Cost") : t("list.colModels")}
              </span>
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("list.colStatus")}</span>
              <span />
            </div>
            <div className="divide-y divide-[var(--border-subtle)]" style={{ contentVisibility: "auto", containIntrinsicSize: "1px 1200px" }}>
              {filtered.map((p) => {
                const imgUrl = mainImages[p.id];
                const models = modelCounts[p.id] || 0;
                const suppliers = productSuppliers[p.id] || [];
                const lvl = levelColors[p.level || ""] || "";

                return (
                  <div
                    key={p.id}
                    className="group relative flex items-center gap-3 md:grid md:grid-cols-[56px_1fr_140px_120px_100px_80px_80px] md:gap-4 px-4 md:px-5 py-3 hover:bg-[var(--bg-surface-subtle)] transition-colors"
                  >
                    {/* Stretched navigation link — only card-level anchor;
                        action links below are siblings (no nested <a>). */}
                    <Link
                      href={`${baseRoute}/${p.slug || p.id}`}
                      aria-label={p.product_name}
                      className="absolute inset-0 z-0"
                    />
                    {/* Thumbnail — Supabase Storage transform downscales
                        the source photo to ~96px @ q75 (typically <30 KB
                        instead of multi-MB originals). loading="lazy"
                        keeps off-screen rows from blocking the
                        first paint. */}
                    <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-white border border-[var(--border-subtle)] overflow-hidden shrink-0 flex items-center justify-center">
                      {imgUrl ? (
                        <img
                          src={IMG.thumb(imgUrl)}
                          alt={p.product_name}
                          className="w-full h-full object-contain p-1"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <ImageRawIcon className="h-5 w-5 text-gray-300" />
                      )}
                    </div>

                    {/* Product info (mobile: all info here, desktop: just name) */}
                    <div className="flex-1 md:flex-none min-w-0">
                      {(() => {
                        const mn = primaryModelNames[p.id];
                        const hasDistinctName = mn && mn !== p.product_name;
                        if (hasDistinctName) {
                          return (
                            <>
                              <div className="flex items-center gap-2">
                                <h3 className="text-[14px] md:text-[16px] font-bold tracking-tight text-[var(--text-primary)] truncate group-hover:text-[var(--text-highlight)] transition-colors">
                                  {mn}
                                </h3>
                                {p.featured && <StarIcon className="h-3 w-3 text-amber-400 shrink-0" />}
                              </div>
                              <p className="text-[12px] md:text-[13px] text-[var(--text-muted)] truncate">
                                {p.product_name}
                              </p>
                            </>
                          );
                        }
                        return (
                          <div className="flex items-center gap-2">
                            <h3 className="text-[14px] md:text-[16px] font-bold tracking-tight text-[var(--text-primary)] truncate group-hover:text-[var(--text-highlight)] transition-colors">
                              {p.product_name}
                            </h3>
                            {p.featured && <StarIcon className="h-3 w-3 text-amber-400 shrink-0" />}
                          </div>
                        );
                      })()}
                      {/* Mobile: show all meta inline */}
                      <div className="md:hidden flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-[var(--text-dim)]">{catMap[p.category_slug] || p.category_slug}</span>
                        {p.brand && (
                          <>
                            <span className="text-[var(--text-ghost)]">·</span>
                            <span className="text-[11px] text-[var(--text-dim)]">{p.brand}</span>
                          </>
                        )}
                        <span className="text-[var(--text-ghost)]">·</span>
                        <span className="text-[11px] text-[var(--text-dim)]">{models} {models === 1 ? t("list.modelOne", "model") : t("list.modelMany", "models")}</span>
                      </div>
                      {/* Desktop: supplier line — internal only, with logo */}
                      {isInternal && (signals[p.id]?.supplier || suppliers.length > 0) && (() => {
                        const sup = signals[p.id]?.supplier;
                        return (
                          <div className="hidden md:flex items-center gap-1.5 mt-0.5 min-w-0">
                            {sup?.logo && (
                              <span className="h-4 w-4 shrink-0 rounded bg-white border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center">
                                <img src={IMG.thumb(sup.logo)} alt="" className="h-full w-full object-contain" loading="lazy" decoding="async" />
                              </span>
                            )}
                            <span className="text-[11px] text-[var(--text-ghost)] truncate">
                              {sup?.name || suppliers.join(", ")}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Category (desktop only) — show the division
                        below the category as a subtle caption when
                        the product is NOT in the flagship line. */}
                    <div className="hidden md:flex flex-col min-w-0 gap-0.5">
                      <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] truncate">
                        <LayersIcon className="h-3 w-3 text-[var(--text-ghost)] shrink-0" />
                        {catMap[p.category_slug] || p.category_slug}
                      </span>
                      {p.division_slug && p.division_slug !== FLAGSHIP_DIVISION_SLUG && divMap[p.division_slug] && (
                        <span className="text-[10px] text-[var(--text-ghost)] uppercase tracking-wider truncate pl-[18px]">
                          {divMap[p.division_slug]}
                        </span>
                      )}
                    </div>

                    {/* Readiness (internal) / Brand (public) — desktop only */}
                    <div className="hidden md:flex items-center gap-1.5 min-w-0">
                      {isInternal ? (() => {
                        const sig = signals[p.id];
                        if (!sig) return <span className="text-[11px] text-[var(--text-ghost)]">—</span>;
                        if (sig.readiness == null) {
                          return (
                            <span className="text-[10px] text-amber-400/80" title={t("card.missing.template", "No spec template")}>
                              {t("list.noTemplate", "No template")}
                            </span>
                          );
                        }
                        return (
                          <div className="flex items-center gap-2 w-full min-w-0">
                            <div className="h-1 flex-1 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  sig.readiness >= 80 ? "bg-emerald-500"
                                  : sig.readiness >= 50 ? "bg-amber-500"
                                  : "bg-rose-500/80"
                                }`}
                                style={{ width: `${Math.max(2, Math.min(100, sig.readiness))}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold tabular-nums text-[var(--text-subtle)] shrink-0">{sig.readiness}%</span>
                          </div>
                        );
                      })() : p.brand ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[11px] font-medium text-[var(--text-subtle)] truncate">
                          <TagsIcon className="h-2.5 w-2.5 shrink-0" /> {p.brand}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--text-ghost)]">—</span>
                      )}
                    </div>

                    {/* Cost + models (internal) / models (public) — desktop only */}
                    <div className="hidden md:flex items-center gap-1.5">
                      {isInternal && (() => {
                        const c = signals[p.id]?.cost;
                        return c != null ? (
                          <span className="flex items-baseline gap-0.5">
                            <span className="text-[10px] text-[var(--text-ghost)]">¥</span>
                            <span className="text-[14px] font-bold tabular-nums tracking-tight text-[var(--text-primary)]">{c.toLocaleString()}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--text-ghost)]">—</span>
                        );
                      })()}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[11px] font-medium text-[var(--text-subtle)]">
                        <BoxesIcon className="h-2.5 w-2.5" /> {models}
                      </span>
                      {p.level && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${lvl}`}>
                          {p.level}
                        </span>
                      )}
                    </div>

                    {/* Status (desktop only) */}
                    <div className="hidden md:flex items-center justify-center">
                      {(() => {
                        const st = (p.status || "draft");
                        return (
                          <StatusPill tone={ST_TONE[st as keyof typeof ST_TONE] ?? "warning"} className="uppercase tracking-wider !text-[10px]">
                            {t(`status.${st}`, st)}
                          </StatusPill>
                        );
                      })()}
                    </div>

                    {/* Actions */}
                    <div className="relative z-10 flex items-center gap-1.5 shrink-0">
                      {isInternal && (
                        <>
                          <Link
                            href={`${baseRoute}/${p.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 rounded-lg hover:bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
                            title={t("card.editProduct")}
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={(e) => askDelete(e, p.id, p.product_name)}
                            className="h-8 w-8 rounded-lg hover:bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 transition-colors"
                            title={t("card.deleteProduct")}
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Themed confirm for product delete — replaces window.confirm() */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : "Delete product?"}
        message="This also removes all its models, media, translations, and saved prices. This cannot be undone."
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}