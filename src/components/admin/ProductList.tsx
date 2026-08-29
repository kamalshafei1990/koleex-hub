"use client";

import { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue, memo } from "react";
import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";
import { useTopRampOwner } from "@/lib/useTopRampOwner";
import KdsSelect from "@/components/kds/Select";
import TabStrip from "@/components/ui/TabStrip";

/* Aurora ground — the Hub canvas, client-only, mounted only under the skin.
   Lives HERE (not in the two thin page wrappers) so /products and
   /product-data — one source, two front-ends — convert together. */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });
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
import { BACK_CHROME } from "@/components/ui/PageHeader";
import ProductsIcon from "@/components/icons/ProductsIcon";
import ProductDataIcon from "@/components/icons/ProductDataIcon";
import {
  fetchTaxonomyAll,
  fetchModelSummaries, fetchProductMainImages, deleteProduct,
  fetchClassificationIcons,
} from "@/lib/products-admin";
import type { ProductRow, DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import ConfirmDialog from "@/components/kds/ConfirmDialog";
import { useCnyUsd, formatUsd, formatRate, fxSourceTitle } from "@/lib/use-cny-usd";
import BackToTop from "@/components/ui/BackToTop";

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
/* "Smart" code matching: XPRR-2100EF-LC must be findable as xprr2100ef,
   XPRR 2100, or 2100ef-lc. Squash = drop everything that isn't a letter or
   digit (Unicode-aware, so 中文/العربية survive) and lowercase. Both the
   haystack and the typed tokens get squashed, so separator style can never
   make a code unfindable. */
const squash = (v: string) => v.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/* Frozen empty array — a fresh [] per render would defeat ProductCard's memo. */
const EMPTY_SUPPLIERS: string[] = [];

/* Hoisted: a fresh style object per section per render defeated nothing but
   allocated needlessly.

   ⚠️ THE PADDING IS NOT DECORATION — IT STOPS THE CARDS' HOVER BEING CLIPPED.
   `content-visibility: auto` applies PAINT containment permanently, not only
   while the subtree is being skipped, so anything a child paints outside this
   section's border box is cut off. `.kx-hover-card:hover` reaches ~18px past
   the card (`0 0 16px` glow plus `0 10px 30px -12px`), and measured on this
   page 43 of the 65 cards in the largest section sit within that reach of the
   edge — they came back with the glow shaved off while inner cards were
   perfect. Same defect the Home launcher grids had (`.kx-lazy-grid`).

   Nothing is clipped at the TOP: each section opens with the category header
   block, not with cards. Sides and bottom are what need the room.

   ⚠️ THE SIDES CANCEL THEIR PADDING WITH A NEGATIVE MARGIN — THE BOTTOM MUST
   NOT. Read the parent before touching this: the sections are stacked by
   `space-y-8` on the wrapping div, and **Tailwind v4 implements space-y as
   `margin-block-end` on `:not(:last-child)`, not as margin-top.** So a
   `marginBottom` here does not sit alongside that gap, it REPLACES it — I
   tried `marginBottom: -24` first and every gap between categories collapsed
   from 56px to -24px, measured. The bottom padding is instead paid for by
   shrinking the utility itself: 32px gap + 24px padding = the same 56px that
   `space-y-14` used to give. Change one and change the other.

   THE BLEED MUST MATCH THE CONTAINER'S OWN PADDING, NOT A FIXED 24.
   The wrapper is `px-4 md:px-6 lg:px-8` — 16px on a phone, 24 from md up.
   A hardcoded -24 therefore overhung the viewport by 8px each side at 375px.
   The earlier note here accepted that, reasoning the body's `overflow-x:
   hidden` would absorb it; it does not, because the Hub scrolls inside
   #main-scroll-container, not the body — measured, the page scrolled
   sideways by exactly those 8px and the owner reported the whole app
   "dancing" on mobile.

   `--kx-bleed` is defined from the same breakpoints as the wrapper padding
   (globals.css), so the two can no longer disagree. Change the wrapper's
   padding and change --kx-bleed with it.

   The bleed itself stays: content-visibility clips paint at the box edge, so
   without room the cards' hover glow was sheared off. The bottom padding is
   paid for by the utility: 32px gap + 24px padding = the 56px `space-y-14`
   used to give. Same dependency as `.kx-lazy-grid`; full note in globals.css. */
const SECTION_CV = {
  contentVisibility: "auto",
  containIntrinsicSize: "1px 800px",
  paddingInline: "var(--kx-bleed)",
  paddingBottom: 24,
  marginInline: "calc(var(--kx-bleed) * -1)",
} as const;

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
  /* fixed = one list price. from = base + priced options. on_request =
     quoted per configuration, so an empty cost is the ANSWER, not a gap. */
  pricingMode: "fixed" | "from" | "on_request";
  priceNote: string | null;
  visible: boolean;
  updatedAt: string | null;
  supplier: { id?: string | null; name: string; logo: string | null } | null;
  /* The price's own annotations (Supplier tab) — note + extra prices. */
  costNote?: string | null;
  costExtras?: { price: number | null; note: string }[];
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

/* Supplier row wrapper: a real link into the Suppliers app when the id is
   known, otherwise the same static div it always was. Sits ABOVE the card's
   inset-0 stretched link so the click goes to the supplier, not the product. */
function SupplierRowShell({ supplierId, children }: { supplierId: string | null; children: React.ReactNode }) {
  if (!supplierId) return <div className="flex items-center gap-2 min-w-0">{children}</div>;
  return (
    <Link
      href={`/suppliers/${supplierId}`}
      onClick={(e) => e.stopPropagation()}
      className="relative z-[6] flex items-center gap-2 min-w-0 rounded-md px-1 py-0.5 transition-colors hover:bg-[var(--bg-inverted)]/[0.06] group/sup"
      title="Open in the Suppliers app"
    >
      {children}
    </Link>
  );
}

/* Read the model maps SYNCHRONOUSLY, for the first render.
   `products` already initialises from the TanStack cache, so on a soft
   navigation the very first frame paints 121 cards — and the model maps used
   to be seeded one effect later. That asymmetry WAS the open glitch: cards
   painted at 208px without their code/chips/count and jumped to 311px a
   moment after. Both halves have to be warm at the same instant. */
type ModelMaps = {
  counts: Record<string, number>;
  primaryModelNames: Record<string, string>;
  modelNames: Record<string, string[]>;
};
/* The taxonomy decides the grid's SHAPE. With categories present the grid
   renders as category sections; without them it renders flat. Seeding it one
   effect after the first paint therefore means the cards are laid out twice,
   in two different containers — which is the horizontal "card jumps a little
   to the right then back" the owner sees, and it happens ONLY here because
   only this grid sections itself. Same lazy-initialiser rule as products and
   the model maps: read it before the first render or not at all. */
type MetaMaps = { divisions: DivisionRow[]; categories: CategoryRow[]; subcategories: SubcategoryRow[] };
function readMetaCache(scopeKey: string): MetaMaps | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`kx_products_meta_v1:${scopeKey}`);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<MetaMaps>;
    if (!Array.isArray(m?.divisions) || !Array.isArray(m?.categories) || !Array.isArray(m?.subcategories)) return null;
    return { divisions: m.divisions, categories: m.categories, subcategories: m.subcategories };
  } catch { return null; }
}

function readModelCache(scopeKey: string): ModelMaps | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`kx_products_models_v1:${scopeKey}`);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<ModelMaps>;
    if (!m?.primaryModelNames) return null;
    return { counts: m.counts ?? {}, primaryModelNames: m.primaryModelNames, modelNames: m.modelNames ?? {} };
  } catch { return null; }
}

const ProductCard = memo(function ProductCard({
  p, imgUrl, models, suppliers, lvl, baseRoute, isInternal, aurora, catMap, subMap, divMap, primaryModelNames, modelNamesList, signal, signalsPending, modelsPending, t, onAskDelete, fx, fxTitle, fob, fobPending, onCardAction,
}: {
  p: ProductRow;
  imgUrl?: string;
  /* Passed down, never read from useSkin() here: this component renders
     once per product (121 today, 3000 planned) and each call would be its
     own subscription to the skin. */
  aurora: boolean;
  models: number;
  suppliers: string[];
  lvl: string;
  baseRoute: string;
  isInternal: boolean;
  catMap: Record<string, string>;
  subMap: Record<string, string>;
  divMap: Record<string, string>;
  primaryModelNames: Record<string, string>;
  /* Family roster (all member codes, primary first). Empty/1 → no chips. */
  modelNamesList?: string[];
  /* Internal work signals (Product Data only) — readiness, gaps, cost,
     visibility, staleness. Undefined on the public /products card. */
  signal?: ProductSignal;
  /* True while the signals payload (which CARRIES the supplier) is still in
     flight. Without it the card asserts "No supplier linked" before it can
     possibly know, then flips to the real supplier when the payload lands —
     121 cards changing at once, ~1.5s after the grid appeared. That is the
     glitch the owner saw on opening Product Data, and the worst part was not
     the movement: it was showing him something false. */
  signalsPending?: boolean;
  /* True until the page response (which now carries the model codes) has
     landed. Distinct from signalsPending: models decide the card's SHAPE,
     signals only decorate it. */
  modelsPending?: boolean;
  t: (key: string, fallback?: string) => string;
  onAskDelete: (e: React.MouseEvent, id: string, name: string) => void;
  /* Passed down rather than fetched per card: sixty cards calling the hook
     would mount sixty effects for one shared number. One object identity
     also keeps the memo from busting on every render. */
  fx?: { rate: number; source: string; asOf: string | null } | null;
  fxTitle?: string;
  /* Global FOB for THIS product (catalogue card only). undefined = not
     fetched yet, null fobUsd = no cost on file or quoted per configuration. */
  fob?: { fobUsd: number | null; mode: string };
  fobPending?: boolean;
  onCardAction?: (action: "ask_ai" | "compare" | "quote", product: ProductRow) => void;
}) {
  return (
    <div
      key={p.id}
      {...kxInspectAttrs({ component: "ProductCard", module: "Product Data", section: "Catalog", recordId: p.slug || p.id })}
      className="group relative kx-glass kx-hover-card kx-glow-in bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] overflow-hidden"
    >
      {/* Stretched navigation link — covers the whole card and
          is the ONLY card-level anchor, so the edit/delete actions
          below are siblings (not nested <a>) → no hydration error. */}
      <Link
        href={`${baseRoute}/${p.slug || p.id}`}
        aria-label={p.product_name}
        className="absolute inset-0 z-[5]"
      />
      {/* Image — calm, clean. Background matches the
          card surface so transparent product photos
          blend in (no white box around the photo).
          No scale on hover — the card lifts, image
          stays put. */}
      <div className="relative aspect-[4/3] max-sm:aspect-[3/2] bg-gradient-to-b from-white to-[#f4f5f7] overflow-hidden border-b border-black/5">
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
          {/* These sit ON the product photo, which is usually white, so they
              cannot take their fill from a theme token: under the kx-pd remap
              `--bg-primary` is TRANSPARENT, which left them invisible over a
              light image (owner: "I can't see clearly if under white
              background"). A fixed dark scrim + a light rim reads on any
              photo in any theme; Core keeps the token, where it is solid. */}
          {/* NO backdrop-blur ON THESE TWO, and the number is why: they are
              2 per card × 214 cards = 428 live blur layers on one screen —
              measured 2026-08-21, and they were 428 of the 429 filtered
              elements on the whole page. They are also INVISIBLE at rest on
              desktop (opacity-0 until the card is hovered), and a
              compositor still pays for a filtered layer it is not showing.
              Nothing is lost visually: they already sit on a fixed
              black/60 scrim, which is what makes them readable over a white
              photo — the blur under an opaque-enough scrim showed nothing.
              This cost was SKIN-INDEPENDENT, which is why it survived the
              kx-flat-items sweep (that rule targets .kx-glass). */}
          {/* data-kx-keep-hover, both of them: the global Aurora hover
              REPLACES a control's own hover fill with its 3% white + blue
              rim — which over a white product photo turned this scrim
              nearly transparent and the white glyph invisible exactly on
              hover (owner: "the hover become white and the background is
              white so I can see nothing"). These two manage their own
              contrast against an unknown photo; the skin must not touch
              them. This is the hatch that rule documents — the FIRST
              legitimate use, not a :not() escalation. */}
          <Link
            href={`${baseRoute}/${p.id}/edit`}
            data-kx-keep-hover=""
            onClick={(e) => e.stopPropagation()}
            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
              aurora
                ? "bg-black/60 border-white/25 text-white/85 hover:text-white hover:bg-black/75"
                : "bg-[var(--bg-primary)]/80 border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            title={t("card.editProduct")}
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </Link>
          <button
            data-kx-keep-hover=""
            onClick={(e) => onAskDelete(e, p.id, p.product_name)}
            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
              aurora
                ? "bg-black/60 border-white/25 text-white/85 hover:text-red-400 hover:bg-black/75"
                : "bg-[var(--bg-primary)]/80 border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400"
            }`}
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
      <div className={`p-3.5 md:p-4 max-sm:p-3 ${isInternal ? "flex flex-col min-h-[208px] max-sm:min-h-[164px]" : ""}`}>
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
                <p className={`text-[12px] md:text-[13px] text-[var(--text-muted)] mt-0.5 line-clamp-2 leading-snug ${isInternal ? "min-h-[34px] max-sm:min-h-0" : ""}`}>
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
                /* The slot keeps its height either way, so the card does not
                   move when the answer arrives. Only the CLAIM waits: "Needs
                   name" is a judgement about missing data, and before the
                   model codes land we do not know whether the name is missing
                   — every card said it, then took it back. */
                <p className="mt-0.5 text-[10px] font-medium text-amber-400/80 min-h-[34px] max-sm:min-h-0">
                  {modelsPending ? "" : t("list.needsName", "Needs name")}
                </p>
              )}
            </>
          );
        })()}

        {/* ── Family chips ── A product that carries several models is a
            FAMILY; show every member code on the card so someone hunting
            for XF-600 spots it from outside without opening XF-450.
            Chips sit ABOVE the stretched card link (z-10) and deep-link
            the profile straight onto that member. */}
        {/* Family roster — EVERY member code, always visible (owner rule:
            never hide a code). An ALIGNED mini-grid, not ragged pills:
            two tidy columns on desktop, one full-width column on phones —
            reads like the catalog's own model list. */}
        {modelNamesList && modelNamesList.length > 1 && (
          <div className="relative z-10 mt-2 grid grid-cols-2 max-sm:grid-cols-1 gap-1">
            {modelNamesList.map((code) => (
              <Link
                key={code}
                href={`${baseRoute}/${p.slug || p.id}?model=${encodeURIComponent(code)}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center min-w-0 px-2 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[11.5px] font-bold tabular-nums tracking-tight text-[var(--text-primary)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface)] transition-colors"
                title={code}
              >
                <span className="truncate">{code}</span>
              </Link>
            ))}
          </div>
        )}

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

        {/* ── Global FOB + actions — the CATALOGUE card's commercial half.
            Price is the tier-agnostic Global FOB in USD, computed server-side
            by /api/products/fob-prices from the landed factory cost through
            Commercial Setup, converted at the DAY'S rate — so it re-prices
            itself as the rate moves and can never go stale. The cost it is
            derived from never reaches the browser.
            Gated to Hub accounts (owner decision 2026-08-29): the route needs
            a session, and Hub accounts are issued by the owner personally. */}
        {!isInternal && (
          <div className="relative z-10 mt-3 pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">
                {t("card.globalFob", "Global FOB")}
              </span>
              {fobPending && fob === undefined ? (
                /* Reserve the line rather than collapse it — a price that
                   pops in later must not shift the whole grid. */
                <span className="h-4 w-20 rounded bg-[var(--bg-surface-subtle)] animate-pulse" aria-hidden="true" />
              ) : fob?.fobUsd != null ? (
                <span
                  className="text-[15px] font-bold tabular-nums tracking-tight text-[var(--text-primary)]"
                  title={fxTitle}
                >
                  ${fob.fobUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              ) : (
                <span className="text-[11px] font-medium text-[var(--text-dim)]">
                  {t("card.priceOnRequest", "Price on request")}
                </span>
              )}
            </div>

            {/* Actions. Wired to onCardAction so the list owns the behaviour —
                the three flows are specified separately by the owner. */}
            {/* Three across on desktop; STACKED on phones — at the 2-column
               mobile grid a card is ~155px wide and "Compare" cannot fit in a
               third of that (measured at 360px: all three clipped to one
               letter). Full-width rows also give a proper tap target.

               Each action reads as ITSELF (owner call 2026-08-29): Ask AI
               wears the same travelling glow as every other AI control in the
               Hub (kx-ai-glow — reused, never re-declared), Compare is amber
               and Quote is green. Amber and green are the design system's
               FUNCTIONAL state tokens, not new brand colours, so the card
               stays inside the monochrome-plus-accent rule. */}
            <div className="grid grid-cols-3 max-sm:grid-cols-1 gap-1.5">
              {([
                {
                  key: "ask_ai",
                  label: t("card.askAi", "Ask AI"),
                  cls: "kx-ai-glow border-[var(--accent,#0066FF)]/40 text-[var(--accent,#0066FF)] hover:bg-[var(--accent,#0066FF)]/10",
                },
                {
                  key: "compare",
                  label: t("card.compare", "Compare"),
                  cls: "border-[var(--state-warning,#F59E0B)]/40 text-[var(--state-warning,#F59E0B)] hover:bg-[var(--state-warning,#F59E0B)]/10 hover:border-[var(--state-warning,#F59E0B)]/70",
                },
                {
                  key: "quote",
                  label: t("card.addToQuotation", "Quote"),
                  cls: "border-[var(--state-success,#10B981)]/40 text-[var(--state-success,#10B981)] hover:bg-[var(--state-success,#10B981)]/10 hover:border-[var(--state-success,#10B981)]/70",
                },
              ] as const).map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCardAction?.(a.key, p); }}
                  /* whitespace-nowrap, NOT truncate: the AI glow ring is drawn
                     at inset -2px, i.e. OUTSIDE the button box, so truncate's
                     overflow:hidden clipped the travelling beam away entirely —
                     the button kept its blue rim and lost its motion. This is
                     the same class the Auto-translate control uses. */
                  className={`px-2 py-1.5 rounded-lg border bg-[var(--bg-surface-subtle)] text-[10.5px] font-bold whitespace-nowrap transition-all ${a.cls}`}
                  title={a.label}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Meta row — publish status, brand, models.
            INTERNAL ONLY (owner spec 2026-08-29). The catalogue card carries
            exactly six things: photo · model · family · category+subcategory ·
            Global FOB · actions. "Active" is the publishing state of OUR
            record and customers read it as stock; the brand chip says Koleex
            on every Koleex product. Both were noise on a customer card. */}
        <div className={`flex items-center gap-2 mt-3 max-sm:mt-2 max-sm:gap-1.5 flex-wrap ${isInternal ? "" : "hidden"}`}>
          {isInternal && (() => {
            const st = (p.status || "draft");
            return (
              <StatusPill tone={ST_TONE[st as keyof typeof ST_TONE] ?? "warning"} className="uppercase tracking-wider !text-[10px]">
                {t(`status.${st}`, st)}
              </StatusPill>
            );
          })()}
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

        {/* The work strip is the LAST thing to arrive and the tallest thing
            on the card — measured on production, a card is 4 rows / 208px
            without it and 5 rows / 311px with it, so the whole grid grew
            ~900px about half a second after it had painted. That jump is the
            "quick glitch" the owner kept seeing.

            So the strip's space is held from the first frame — but held
            INVISIBLY. The first version drew pulsing grey boxes, which put
            726 shimmering placeholders on screen at once (6 per card x 121)
            and the owner rightly called that a flash too: it traded a layout
            jump for a light show. Reserving space costs nothing visually if
            you draw nothing. The content simply appears in place.

            Nothing here states a value either — never a "0" or a "No cost"
            that we would have to take back (already logged twice on this
            card). */}
        {isInternal && !signal && signalsPending && (
          <div className="mt-3 space-y-2 max-sm:mt-2 max-sm:space-y-1.5 flex flex-col flex-1" aria-hidden>
            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full bg-[var(--bg-surface)]" />
              <span className="h-3 w-7" />
            </div>
            <div className="flex flex-wrap gap-1"><span className="h-[18px] w-16" /></div>
            <div className="flex items-center gap-2 min-w-0 h-7 max-sm:hidden" />
            <div className="flex items-baseline gap-2 min-w-0 mt-auto pt-1"><span className="h-5 w-20" /></div>
          </div>
        )}

        {/* ── Internal work signals ──
            Readiness bar + gap chips + cost/supplier/freshness. This is
            what turns the grid from a gallery into a worklist. */}
        {isInternal && signal && (
          <div className="mt-3 space-y-2 max-sm:mt-2 max-sm:space-y-1.5 flex flex-col flex-1">
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
              <div className="flex flex-wrap gap-1 min-h-[18px] max-sm:min-h-0">
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
              /* Clickable when we know WHO it is: rides above the card's
                 stretched link (z-[6] > z-[5]) straight into the Suppliers
                 app. Free-text suppliers with no id stay plain text. */
              <SupplierRowShell supplierId={signal.supplier?.id ?? null}>
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
              </SupplierRowShell>
            ) : signalsPending ? (
              /* Don't answer "who makes this?" before the answer has arrived.
                 Same 24px slot, a quiet placeholder instead of a claim. */
              <div className="flex items-center gap-2 min-w-0 h-6 max-sm:hidden" aria-hidden />
            ) : (
              /* Keep the slot so cost stays on the same line across cards. */
              <div className="flex items-center gap-2 min-w-0 h-6 max-sm:hidden">
                <span className="text-[10px] text-[var(--text-ghost)]">{t("card.noSupplier", "No supplier linked")}</span>
              </div>
            )}

            {/* Cost · freshness — cost is a headline number an operator
                reads across the whole grid, so it carries real weight:
                dim currency mark, large tabular figure. */}
            <div className="flex items-baseline gap-2 min-w-0 mt-auto pt-1">
              {signal.cost != null ? (
                <span
                  className="flex min-w-0 items-baseline gap-1"
                  title={[
                    signal.priceNote || "",
                    signal.costNote || "",
                    ...(signal.costExtras ?? []).map((o) => `¥${o.price ?? "—"}${o.note ? ` — ${o.note}` : ""}`),
                  ].filter(Boolean).join("\n") || undefined}
                >
                  {/* "From" tells the operator this figure is a floor, not the
                      price — the options add to it. */}
                  {signal.pricingMode === "from" && (
                    <span className="text-[10px] font-medium text-[var(--text-ghost)] me-0.5">{t("card.priceFrom", "From")}</span>
                  )}
                  <span className="text-[11px] font-medium text-[var(--text-ghost)]">¥</span>
                  <span className="text-[17px] md:text-[18px] font-bold tabular-nums tracking-tight text-[var(--text-primary)] leading-none">
                    {signal.cost.toLocaleString()}
                  </span>
                  {/* The dollar figure reads at a glance — that is its whole
                      job. Still one step down from the CNY headline in size
                      and weight, because CNY is the number the pricing engine
                      actually uses and the two must never look interchangeable. */}
                  {fx && (
                    <span
                      className="text-[13px] font-semibold text-[var(--text-subtle)] tabular-nums ms-1.5"
                      title={fxTitle}
                    >
                      ≈ {formatUsd(signal.cost, fx.rate)}
                    </span>
                  )}
                </span>
              ) : signal.pricingMode === "on_request" ? (
                /* Priced per configuration — a real answer, so it reads as
                   information and not as the amber "you forgot something". */
                <span className="text-[10px] font-medium text-[var(--text-subtle)]" title={signal.priceNote || undefined}>
                  {t("card.priceOnRequest", "Priced per configuration")}
                </span>
              ) : (
                <span className="text-[10px] text-[var(--text-ghost)] max-sm:hidden">{t("card.noCostYet", "Cost not set")}</span>
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
  const aurora = useSkin() === "aurora";

  /* The /products catalogue shows ONLY active products (owner rule,
     2026-08-05). The API already refuses non-active rows to callers
     without the Product Data grant; this filter makes privileged staff
     see the same catalogue customers do when they browse /products —
     drafts and archived stock live in /product-data only. */
  const baseRoute = isInternal ? "/product-data" : "/products";

  /* Cache the product list per-scope (tenant + view-as) so returning to the
     catalogue paints instantly from cache instead of re-showing skeletons,
     while the effect below still refetches fresh in the background. The scope
     key guarantees a cached list never bleeds across tenants / view-as. */
  const queryClient = useQueryClient();
  /* The two front-ends hold DIFFERENT row sets — the catalogue is active-only
     at the request level — so their warm caches must not share a key, or a
     Product Data visit would seed draft rows into the catalogue's first
     frame (and the catalogue would shrink PD's warm paint). */
  const productsQK = ["products", "list", currentScopeKey(), isInternal ? "int" : "pub"] as const;
  const listSnapshotKey = `kx_products_list_v1:${currentScopeKey()}${isInternal ? "" : ":pub"}`;

  const [products, setProducts] = useState<ProductRow[]>(
    () => queryClient.getQueryData<ProductRow[]>(productsQK) ?? [],
  );
  const [divisions, setDivisions] = useState<DivisionRow[]>(() => readMetaCache(currentScopeKey())?.divisions ?? []);
  /* True once taxonomy is known (warm cache or network) — until then the
     divisions bar renders as a same-height skeleton so its arrival never
     pushes the grid down. */
  const [metaReady, setMetaReady] = useState(() => readMetaCache(currentScopeKey()) != null);
  const [categories, setCategories] = useState<CategoryRow[]>(() => readMetaCache(currentScopeKey())?.categories ?? []);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>(() => readMetaCache(currentScopeKey())?.subcategories ?? []);
  // Classification-icon hub overrides (level → slug → url). Lets the icons set
  // in the Database app surface as section markers in the catalogue.
  /* WARM START. The real icons live in the Classification Icon Hub and arrive
     on their own request, so every open used to paint the built-in fallback
     first and swap to the real icon a moment later — the "icons change after
     loading" flicker. Everything else on this page already warm-starts from
     localStorage (products, taxonomy, thumbnails); the icon map was the one
     that didn't. Seeding from the last known map means the first frame is
     already correct on every visit after the first, and the network response
     just confirms or updates it.

     Icons are URLs keyed by slug — small, and no cost/supplier data — so the
     cache is safe to keep. Scoped like its siblings so nothing bleeds across
     tenants or a view-as switch. */
  const ICONS_KEY = "kx_class_icons_v1";
  const [classIcons, setClassIcons] = useState<Record<string, Record<string, string>>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(`${ICONS_KEY}:${currentScopeKey()}`);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch { return {}; }
  });
  /* Phone-only: the category grid collapsed to its first two rows.
     13 categories at 2-up = ~7 rows ≈ half the phone viewport before any
     product shows (owner screenshot) — the exact reason the original tile
     grid died. Desktop always shows all; ≥sm ignores this state. */
  const [catsOpen, setCatsOpen] = useState(false);
  useEffect(() => {
    if (!catsOpen) return;
    const close = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("[data-kx-cats-menu],[data-kx-cats-trigger]")) return;
      setCatsOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [catsOpen]);
  useEffect(() => {
    let alive = true;
    fetchClassificationIcons().then((v) => {
      if (!alive || !v || Object.keys(v).length === 0) return;
      setClassIcons(v);
      try { window.localStorage.setItem(`${ICONS_KEY}:${currentScopeKey()}`, JSON.stringify(v)); }
      catch { /* quota guard */ }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const [modelCounts, setModelCounts] = useState<Record<string, number>>(() => readModelCache(currentScopeKey())?.counts ?? {});
  const [productSuppliers, setProductSuppliers] = useState<Record<string, string[]>>({});
  /* Translated product names from signals — 中文/عربي names join the search
     haystack so operators can search in whichever language the name was
     entered. */
  const [nameAlts, setNameAlts] = useState<Record<string, string>>({});
  const [supplierAlt, setSupplierAlt] = useState<Record<string, string>>({});
  const [allSuppliers, setAllSuppliers] = useState<string[]>([]);
  const [supplierLogos, setSupplierLogos] = useState<Record<string, string>>({});
  const [primaryModelNames, setPrimaryModelNames] = useState<Record<string, string>>(() => readModelCache(currentScopeKey())?.primaryModelNames ?? {});
  /* Full model roster per product — feeds the family chips on the card and
     lets search find a member code that is NOT the primary (the "XF-600
     lives inside XF-450" problem). */
  const [modelNames, setModelNames] = useState<Record<string, string[]>>(() => readModelCache(currentScopeKey())?.modelNames ?? {});
  /* Internal work signals — fetched only under /product-data, in parallel
     with the meta round-trip, so the public catalogue payload is untouched. */
  const [signals, setSignals] = useState<Record<string, ProductSignal>>({});
  /* Global FOB per product — CATALOGUE only, and deliberately a second,
     narrow round-trip rather than a field on the list payload: the list is
     paginated and cached, while the price must reflect the DAY'S exchange
     rate, so baking it into a cached row would serve a stale number. The
     route returns the finished USD figure only — never the cost behind it. */
  const [fobPrices, setFobPrices] = useState<Record<string, { fobUsd: number | null; mode: string }>>({});
  const [fobPending, setFobPending] = useState(false);

  /* Card actions. The three flows (Ask AI · Compare · Add to Quotation) are
     being specified by the owner separately, so this is the single seam they
     will land in — one handler, so no card needs to change when they do.
     Until then the buttons are inert BY DESIGN, not by oversight. */
  /* List-view column template. The catalogue row and the internal row answer
     different questions, so they do not share a grid: internally the columns
     are readiness / cost / status; on the catalogue they are Global FOB /
     models / actions. Tailwind needs the whole class literal, so these are
     two complete strings rather than an interpolated one. */
  const LIST_COLS = isInternal
    ? "md:grid-cols-[56px_1fr_140px_120px_100px_80px_80px]"
    /* Catalogue row: leads with a REAL product photo (96px + breathing room),
       not the 56px chip the data table uses — a buyer scans pictures first.
       Two templates, because one was not survivable: with the photo, price
       and a 232px action block all fixed, the fixed columns alone came to
       770px, so between ~900px and ~1200px the 1fr name column was squeezed
       to nothing and the product name vanished from its own row. Below xl
       the Models count steps out (it is the least useful of the six) and the
       fixed widths tighten; from xl the full six columns fit comfortably. */
    : "md:grid-cols-[88px_minmax(0,1fr)_112px_212px] lg:grid-cols-[104px_minmax(0,1fr)_160px_120px_220px] xl:grid-cols-[112px_minmax(0,1fr)_180px_130px_90px_232px]";

  const onCardAction = useCallback((action: "ask_ai" | "compare" | "quote", product: ProductRow) => {
    void action; void product;
  }, []);
  /* Factory costs are quoted and stored in CNY; the "≈ $" beside them is a
     reading aid so nobody converts in their head at a half-remembered rate.
     Fetched once for the whole grid and handed down to the cards. */
  const fx = useCnyUsd();
  const fxTitle = useMemo(() => (fx ? fxSourceTitle(fx) : undefined), [fx]);
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
  /* ONE automatic retry per mount before the dead-end error. The owner's link
     chokes in episodes (documented 30-90s), so a single stalled trip is not
     evidence the catalogue is unreachable — it is evidence we asked during a
     choke. Ref, not state: it must survive the effect re-run that the retry
     itself triggers, and it must never cause a render. */
  const autoRetriedRef = useRef(false);

  /* ── Server-driven list ────────────────────────────────────────────────
     The grid used to download the whole catalogue and filter it here. At the
     121 products in the system that is 71 KB; the owner is entering 3000,
     which is ~1.8 MB on a response path measured at 2100 ms per 128 KB — past
     this component's own 30s abort. A page is ~28 KB no matter how big the
     catalogue gets.

     Search, filters and sort now execute in SQL (/api/products?paged=1) and
     pages append as the user scrolls. */
  const [total, setTotal] = useState<number | null>(null);
  /* Per-heading truth, counted in SQL over the whole match set — see where it
     is set. null means "server did not send it", and every consumer falls back
     to counting loaded rows, which is exactly the old behaviour. */
  const [groupCounts, setGroupCounts] = useState<
    { categories: Record<string, number>; subcategories: Record<string, number>; capped: boolean } | null
  >(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /* The in-flight guard is a ref so it is read synchronously by the observer
     callback — state would be a render behind and let two pages start. */
  const loadingMoreRef = useRef(false);
  const pageRef = useRef(1);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  /* Signals carry the supplier, so until they land a card cannot honestly say
     whether a product has one. Starts false ONLY for the internal grid — the
     public card never fetches signals and must not sit in a permanent
     placeholder. */
  const [signalsReady, setSignalsReady] = useState(false);
  /* Model codes now come with the page itself. Until that first response
     lands, a card cannot honestly say a product "needs a name" or has
     "0 models" — it simply does not know yet. */
  const [modelsReady, setModelsReady] = useState(() => readModelCache(currentScopeKey()) != null);
  const modelsFromPageRef = useRef<{
    counts: Record<string, number>;
    primaryModelNames: Record<string, string>;
    modelNames: Record<string, string[]>;
  } | null>(null);


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
  /* The category nav pins directly beneath the sticky toolbar. Its offset
     used to be the literal `top-[49px]`, which is a guess at the toolbar's
     height — and the theme's density layer resizes the search field, so the
     guess is wrong at any density but one. Too small and the nav slides
     under the toolbar; too big and a transparent slit opens between them
     that scrolling cards flicker through. Measure it instead and publish it
     as --kx-pd-tools-h on the shared parent. */
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = toolbarRef.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    const apply = () => host.style.setProperty("--kx-pd-tools-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  /* ── The search box was firing one full round trip PER KEYSTROKE ──
     Measured on prod: typing "spread" (6 characters) fired 13 requests — six
     `/api/products?q=…` and six `/api/products/signals`, one set per letter.
     `useDeferredValue` above defers RENDERING, which keeps typing smooth; it
     does nothing about the network, and on a fast machine it settles between
     every keypress, so every letter got its own SQL search.

     On the operators' link (~1s per request, documented) that is six seconds
     of work to answer a query the user finished typing in one.

     300ms: long enough that a normal typist sends ONE request per word, short
     enough that it never feels like a lag after they stop. The local filter
     below still narrows the grid on `deferredSearch` — i.e. instantly, on the
     rows already loaded — so the screen reacts on the keystroke and the
     server merely confirms it. */
  const [searchForServer, setSearchForServer] = useState(search);
  useEffect(() => {
    const id = setTimeout(() => setSearchForServer(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  /* The screen's filter state translated into the endpoint's allowlisted
     params. `filterSupplier` is deliberately absent: supplier links live on
     the model rows, not on products, so it stays a client-side refinement
     over the loaded pages. Everything else the server can do, the server
     does — that is the whole point.

     The string identity of this object is what the load effect keys on, so a
     changed filter starts a fresh page 1 and an unchanged one does not. */
  const serverParams = useMemo(() => {
    const p = new URLSearchParams({ view: "list", paged: "1", pageSize: "150" });
    /* The DEBOUNCED term, not the deferred one — see the note beside it. */
    if (searchForServer.trim()) p.set("q", searchForServer.trim());
    if (filterDiv) p.set("division", filterDiv);
    if (filterCat) p.set("category", filterCat);
    if (filterSub) p.set("subcategory", filterSub);
    if (filterBrand) p.set("brand", filterBrand);
    if (filterLevel) p.set("level", filterLevel);
    /* Status/visible are INTERNAL work filters — the same guard the client
       predicate uses, so a "Draft" filter chosen in /product-data can never
       silently empty the public catalogue for the same operator. */
    if (isInternal) {
      if (filterStatus) p.set("status", filterStatus);
      if (filterVisible === "visible") p.set("visible", "true");
      if (filterVisible === "hidden") p.set("visible", "false");
    } else {
      /* The catalogue can only ever SHOW active products (owner rule:
         non-active is invisible outside Product Data — the client predicate
         below enforces the same), so ask the server for active only. The
         header count and group counts become the truth of THIS view instead
         of counting drafts the grid will never render, and draft rows stop
         travelling over the wire just to be filtered out on arrival. */
      p.set("status", "active");
    }
    if (filterFeatured === "yes") p.set("featured", "true");
    if (filterFeatured === "no") p.set("featured", "false");
    return p.toString();
  }, [searchForServer, filterDiv, filterCat, filterSub, filterBrand, filterLevel,
      filterStatus, filterVisible, filterFeatured, isInternal]);

  /* While a server search is running, the client must NOT re-apply its own
     token match. The client haystack carries model codes and supplier names
     that arrive with the SIGNALS payload — so before signals land it would
     reject rows the server correctly matched by model code, and the result
     would look like "search finds nothing for a second".

     Keyed on the DEBOUNCED term, deliberately: this must be true exactly when
     the rows on screen came from a server search. During the 300ms before the
     request goes out the term is typed but not yet sent, so the server's rows
     are still the unsearched set — and there the local token filter is
     precisely what the user wants, narrowing the loaded rows on the keystroke
     instead of leaving the full grid up until the network answers. */
  const serverSearchActive = searchForServer.trim().length > 0;
  /* "No filter, no search" — the only state whose first page is safe to keep
     as the warm-start snapshot. */
  /* "Default view" = what THIS front-end shows on a clean open: the flagship
     division + forced status=active on the catalogue, bare on Product Data.
     Comparing against the bare param string looked right but was wrong: the
     catalogue's flagship default meant serverParams never equalled it, so the
     catalogue's warm snapshot silently stopped refreshing. Deliberately NOT
     "whatever the session restored" — a leftover filter must never be
     persisted as if it were the whole catalogue (see the persist site). */
  const defaultDivRef = useRef<string | null>(null);
  if (defaultDivRef.current === null) {
    let d = "";
    if (!isInternal && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(`kx_products_meta_v1:${currentScopeKey()}`);
        const m = raw ? (JSON.parse(raw) as { divisions?: { slug: string }[] }) : null;
        if (m?.divisions?.some((x) => x.slug === FLAGSHIP_DIVISION_SLUG)) d = FLAGSHIP_DIVISION_SLUG;
      } catch { /* absent/corrupt cache → no division default */ }
    }
    defaultDivRef.current = d;
  }
  const defaultParams = new URLSearchParams({ view: "list", paged: "1", pageSize: "150" });
  if (defaultDivRef.current) defaultParams.set("division", defaultDivRef.current);
  if (!isInternal) defaultParams.set("status", "active");
  const isDefaultView = serverParams === defaultParams.toString();
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
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(listSnapshotKey) : null;
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
      /* The taxonomy is seeded in the useState initialisers above, BEFORE the
         first render — it decides whether the grid renders sectioned or flat,
         so reading it here (one paint later) laid the cards out twice. What
         remains effect-only is the flagship default, which is a filter
         choice, not layout. */
      {
        const meta = readMetaCache(currentScopeKey());
        if (meta && !isInternal && !initialFilters.div
            && meta.divisions.some((x) => x.slug === FLAGSHIP_DIVISION_SLUG)) {
          setFilterDiv(FLAGSHIP_DIVISION_SLUG);
        }
      }
    } catch { /* corrupt/absent cache → normal load path */ }
    setLoading(!paintedFromCache);
    setLoadError(null);
    /* Thumbnails are applied by the two effects that actually receive them
       (signals on /product-data, the media endpoint on /products) — this
       effect no longer fetches anything but the page of rows. */
    (async () => {
      try {
        /* Products are the CRITICAL fetch — if this fails we must surface a
           real error + Retry, never a misleading "No products yet" state.
           The abort guards against an INDEFINITE stall — 30s, not 12s: the
           office link has documented 30–90s choke episodes, and a 12s trip
           was converting an eventually-successful load into "Couldn't load
           products" (owner screenshot 2026-08-08). Filters/meta below stay
           tolerant (a missing filter list shouldn't block the catalogue). */
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 30_000);
        /* The taxonomy and the public model/photo maps used to be started
           HERE, so a filter change or a search keystroke re-fetched
           /api/catalog-refs along with the page. Divisions and categories do
           not change because someone typed — they now load once, in their own
           effect below. */
        /* Work signals used to be fetched HERE, inside the effect keyed on
           `serverParams` — so every search keystroke and every filter change
           re-ran this 15KB call, which recomputes readiness for every product
           server-side and returns the SAME answer each time. Measured: typing
           "spread" fired it six times. It depends on neither the search nor
           the filters, so it now lives in its own effect below and runs once
           per screen open. */
        let p: ProductRow[];
        try {
          /* ?view=list keeps the response to the ~15 columns this grid
             actually uses; ?paged=1 keeps it to ONE page. Search and filters
             ride along in serverParams and execute in SQL. */
          const res = await fetch(`/api/products?${serverParams}`, { credentials: "include", signal: ctrl.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = (await res.json()) as {
            rows?: ProductRow[]; total?: number | null; hasMore?: boolean;
            models?: { counts: Record<string, number>; primaryModelNames: Record<string, string>; modelNames: Record<string, string[]> };
            groupCounts?: { categories: Record<string, number>; subcategories: Record<string, number>; capped: boolean };
          };
          p = json.rows ?? [];
          /* Model codes ride WITH the page now, so the card paints its final
             shape on the first frame instead of rebuilding when signals land
             (measured: card body 208px -> 311px after paint). Signals still
             arrive later and refine suppliers/readiness — they just no longer
             change the card's size or correct its text. */
          if (json.models) {
            modelsFromPageRef.current = json.models;
            setModelCounts(json.models.counts);
            setPrimaryModelNames(json.models.primaryModelNames);
            setModelNames(json.models.modelNames);
            setModelsReady(true);
          }
          pageRef.current = 1;
          setTotal(json.total ?? null);
          /* TRUE counts per heading, from SQL over the whole match set. Without
             them the grid counts the rows it happens to have loaded, so once
             the catalogue passes the auto-complete cap every category heading
             under-reports and the ones further down the sort do not appear at
             all — the "my products were deleted" failure, again. */
          setGroupCounts(json.groupCounts ?? null);
          setHasMore(Boolean(json.hasMore));
        } finally {
          clearTimeout(timeoutId);
        }
        if (cancelled) return;
        queryClient.setQueryData(productsQK, p); // warm the cache for instant revisit
        /* Persist for instant paint on the next cold load / PWA restart —
           but ONLY the unfiltered, unsearched first page. Caching a filtered
           result would make the next cold open paint someone's leftover
           "Draft + Garment Machinery" view as if it were the whole catalogue. */
        if (isDefaultView) {
          try {
            const json = JSON.stringify(p);
            if (json.length < 2_500_000) window.localStorage.setItem(listSnapshotKey, json);
            /* The model maps go WITH the list. Without them the warm paint
               renders cards that have no code, no chips and no count — 208px
               — and they grow to 311px the moment the network answers. That
               is the open-glitch again, just sourced from cache instead of
               from a late request (measured on production: page height
               10676 -> 11574 at 1.4s). */
            if (modelsFromPageRef.current) {
              const mj = JSON.stringify(modelsFromPageRef.current);
              if (mj.length < 600_000) window.localStorage.setItem(`kx_products_models_v1:${currentScopeKey()}`, mj);
            }
          } catch { /* quota / serialize guard */ }
        }
        /* PAINT NOW — products are the page. Taxonomy pills, model counts,
           supplier chips and photos hydrate in below the moment their
           (slower) fetches land; they must never hold the whole grid
           hostage. This is what made "opening the app" feel slow: the
           grid used to wait for the SLOWEST of five secondary requests. */
        setProducts(p);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          const aborted = e instanceof DOMException && e.name === "AbortError";
          /* 401 = expired session, not a server fault — surface a
             sign-in path instead of a Retry that can never succeed. */
          const authFailed = e instanceof Error && e.message.includes("HTTP 401");
          /* A stalled or dropped trip gets ONE silent second chance before we
             ever show a dead end. Not for 401 (retrying an expired session
             can only fail) and not for a real HTTP error (the server
             answered; asking again changes nothing). */
          const worthRetrying = !authFailed && (aborted || !(e instanceof Error && /HTTP \d/.test(e.message)));
          if (worthRetrying && !autoRetriedRef.current) {
            autoRetriedRef.current = true;
            window.setTimeout(() => { if (!cancelled) setRetryKey((k) => k + 1); }, 800);
            return;
          }
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
    /* serverParams: a changed filter or search is a NEW page 1. The abort
       controller above cancels the in-flight page, so fast typing cannot land
       an older response after a newer one. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInternal, retryKey, serverParams]);

  /* ── Taxonomy (+ the public catalogue's model & photo maps) — ONE call ──
     Divisions, categories and subcategories describe the SHAPE of the
     catalogue, not the current query. They used to be fetched inside the
     load effect, so /api/catalog-refs went out again on every filter change
     and every debounced search — measured on prod, once per filter change.

     On /product-data the model summary and thumbnails ride along with the
     signals bundle (it reads both tables anyway), so only the public
     catalogue fetches them here. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [taxonomy, ms, imgs] = await Promise.all([
          fetchTaxonomyAll(),
          isInternal ? Promise.resolve(null) : fetchModelSummaries(),
          isInternal ? Promise.resolve(null) : fetchProductMainImages(),
        ]);
        if (cancelled) return;
        const { divisions: d, categories: c, subcategories: sub } = taxonomy;
        setDivisions(d); setCategories(c); setSubcategories(sub);
        setMetaReady(true);
        /* Persist the taxonomy for the next open's first paint. */
        try {
          const metaJson = JSON.stringify({ divisions: d, categories: c, subcategories: sub });
          if (metaJson.length < 400_000) window.localStorage.setItem(`kx_products_meta_v1:${currentScopeKey()}`, metaJson);
        } catch { /* quota guard */ }
        /* null = the signals bundle is carrying these instead. */
        if (ms) {
          setModelCounts(ms.counts);
          setProductSuppliers(ms.suppliers);
          setAllSuppliers(ms.allSuppliers);
          setPrimaryModelNames(ms.primaryModelNames || {});
          setModelNames((ms as { modelNames?: Record<string, string[]> }).modelNames || {});
        }
        if (imgs) {
          setMainImages(imgs);
          try {
            const json = JSON.stringify(imgs);
            if (json.length < 1_000_000) window.localStorage.setItem(`kx_products_imgs_v1:${currentScopeKey()}`, json);
          } catch { /* quota guard */ }
        }
        /* Public catalog lands on Garment Machinery by default — it's the
           flagship. Only when the user has NO stored filter. */
        if (!isInternal && !initialFilters.div && d.some(x => x.slug === FLAGSHIP_DIVISION_SLUG)) {
          setFilterDiv(FLAGSHIP_DIVISION_SLUG);
        }
      } catch { /* secondary data only — the grid renders without it */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInternal, retryKey]);

  /* ── Work signals — ONE call per screen open ──
     Product Data only. Carries three payloads the grid needs and the public
     catalogue never sees: per-product readiness/gaps/cost/supplier, the model
     summary (codes, counts, supplier names) and the thumbnail map.

     It answers the same thing regardless of what is typed in the search box
     or which filters are set, so it is keyed on neither. It used to sit in
     the load effect above and therefore re-ran on every keystroke: six
     identical 15KB responses to type one word, each one recomputing readiness
     for the whole catalogue server-side.

     Still fire-and-forget: a slow or failed signals call must never delay or
     break the grid — the cards simply render without the readiness strip. */
  useEffect(() => {
    if (!isInternal) return;
    let cancelled = false;
    const ctrl = new AbortController();
    /* Thumbnails land here or from the standalone media endpoint; one place
       applies them and persists the warm-start copy, so the next open paints
       photos with the first frame. */
    const applyImgs = (imgs: Record<string, string>) => {
      if (cancelled) return;
      setMainImages(imgs);
      try {
        const json = JSON.stringify(imgs);
        if (json.length < 1_000_000) window.localStorage.setItem(`kx_products_imgs_v1:${currentScopeKey()}`, json);
      } catch { /* quota guard */ }
    };
    fetch("/api/products/signals", { credentials: "include", signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: {
        signals?: Record<string, ProductSignal>;
        models?: { counts: Record<string, number>; suppliers: Record<string, string[]>; allSuppliers: string[]; supplierLogos?: Record<string, string>; primaryModelNames: Record<string, string>; modelNames?: Record<string, string[]>; nameAlts?: Record<string, string>; supplierAlt?: Record<string, string> };
        mainImages?: Record<string, string>;
      }) => {
        if (cancelled) return;
        if (j?.signals) setSignals(j.signals);
        if (j?.models) {
          setModelCounts(j.models.counts);
          setProductSuppliers(j.models.suppliers);
          if (j.models.nameAlts) setNameAlts(j.models.nameAlts);
          if (j.models.supplierAlt) setSupplierAlt(j.models.supplierAlt);
          setAllSuppliers(j.models.allSuppliers);
          if (j.models.supplierLogos) setSupplierLogos(j.models.supplierLogos);
          setPrimaryModelNames(j.models.primaryModelNames || {});
          setModelNames(j.models.modelNames || {});
        }
        if (j?.mainImages) applyImgs(j.mainImages);
        /* The supplier answer has arrived — cards may now state it,
           including stating that there ISN'T one. */
        setSignalsReady(true);
      })
      .catch(async (e) => {
        /* An abort is this effect being torn down, not a failure — running
           the fallback there would fire two more requests on the way out. */
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        /* Signals are optional, but model codes and thumbnails are not — fall
           back to the standalone endpoints so a signals failure never strips
           the grid of its identity. */
        try {
          const [ms, imgs] = await Promise.all([fetchModelSummaries(), fetchProductMainImages()]);
          if (cancelled) return;
          setModelCounts(ms.counts);
          setProductSuppliers(ms.suppliers);
          setAllSuppliers(ms.allSuppliers);
          if ((ms as { nameAlts?: Record<string, string> }).nameAlts) setNameAlts((ms as { nameAlts?: Record<string, string> }).nameAlts!);
          if ((ms as { supplierAlt?: Record<string, string> }).supplierAlt) setSupplierAlt((ms as { supplierAlt?: Record<string, string> }).supplierAlt!);
          setPrimaryModelNames(ms.primaryModelNames || {});
          setModelNames((ms as { modelNames?: Record<string, string[]> }).modelNames || {});
          applyImgs(imgs);
        } catch { /* grid still renders without either */ }
        /* Released on the fallback too — otherwise a signals outage would
           leave every card stuck in the placeholder forever, which is worse
           than saying "no supplier linked". */
        if (!cancelled) setSignalsReady(true);
      });
    return () => { cancelled = true; ctrl.abort(); };
  }, [isInternal, retryKey]);

  /* Finish a SMALL catalogue in the background instead of waiting for scroll.
     Paging by 48 broke something the grid depends on: it groups by category,
     so with only the newest 48 rows loaded, whole categories are simply absent
     from the page. The owner opened Product Data, could not find Fabric
     Preparation, and reasonably concluded its 54 products had been deleted.
     Nothing was — they were on page 2 and 3.

     So: the first page still paints immediately (that is the part that has to
     be fast), and if the whole catalogue is small enough to hold, the rest
     streams in behind it and every category is complete a moment later. The
     scroll path below stays for the catalogue this was built for — at the
     owner's 3000 products the threshold stops applying and pages arrive on
     demand, which is the only thing that works at that size. */
  const AUTO_COMPLETE_MAX = 600;

  /* ONE implementation of "fetch the next page", shared by the background
     completion above and the scroll observer below, so they cannot disagree
     about the page counter or race each other into the same request.
     Resolves to whether more pages remain. */
  const loadNextPage = useCallback(async (): Promise<boolean> => {
    if (loadingMoreRef.current) return false;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    try {
      const res = await fetch(`/api/products?${serverParams}&page=${next}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        rows?: ProductRow[]; hasMore?: boolean;
        models?: { counts: Record<string, number>; primaryModelNames: Record<string, string>; modelNames: Record<string, string[]> };
      };
      const rows = json.rows ?? [];
      /* Merge, never replace: these maps already hold every earlier page. */
      if (json.models) {
        setModelCounts((prev) => ({ ...prev, ...json.models!.counts }));
        setPrimaryModelNames((prev) => ({ ...prev, ...json.models!.primaryModelNames }));
        setModelNames((prev) => ({ ...prev, ...json.models!.modelNames }));
      }
      pageRef.current = next;
      /* Append by id, never blindly: a product edited between two page
         requests can shift across the offset boundary and arrive twice, which
         would render duplicate cards with the same key. */
      setProducts((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...rows.filter((r) => !seen.has(r.id))];
      });
      setHasMore(Boolean(json.hasMore));
      return Boolean(json.hasMore);
    } catch {
      /* A failed page must not blank the grid — stop offering more and leave
         what is on screen. The user can filter or reload. */
      setHasMore(false);
      return false;
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [serverParams]);

  /* ── Global FOB for the catalogue cards ────────────────────────────────
     Fires only under /products, only for ids we do not already hold, and in
     ONE request for the whole visible batch — the same discipline the meta
     round-trip follows. Fire-and-forget: a slow or failed price call must
     never delay the grid, the cards just show "Price on request" until it
     lands. Ids already priced are skipped, so scrolling a paginated list
     asks for the new page only. */
  useEffect(() => {
    if (isInternal) return;
    const missing = products.map((p) => p.id).filter((id) => !(id in fobPrices));
    if (missing.length === 0) return;
    let cancelled = false;
    const ctrl = new AbortController();
    setFobPending(true);
    fetch("/api/products/fob-prices", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: missing }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { prices?: Record<string, { fobUsd: number | null; mode: string }> } | null) => {
        if (cancelled || !j?.prices) return;
        /* Merge, never replace — an earlier page's prices must survive. */
        setFobPrices((prev) => ({ ...prev, ...j.prices }));
      })
      .catch(() => { /* price is optional on the card */ })
      .finally(() => { if (!cancelled) setFobPending(false); });
    return () => { cancelled = true; ctrl.abort(); };
  }, [isInternal, products, fobPrices]);

  useEffect(() => {
    if (loading || loadError || !hasMore) return;
    if (total == null || total > AUTO_COMPLETE_MAX) return;
    let cancelled = false;
    void (async () => {
      /* One page at a time, so a slow link is not hit with ten parallel
         requests — the whole point of this work was fewer of them at once. */
      let more = true;
      while (!cancelled && more) more = await loadNextPage();
    })();
    return () => { cancelled = true; };
  }, [loading, loadError, hasMore, total, loadNextPage]);

  /* Infinite scroll — the owner's choice over a numbered pager: nothing new to
     learn, and it is the one that behaves on a phone. The sentinel sits after
     the grid; when it comes into view the next page appends.

     rootMargin 600px so the fetch starts BEFORE the user reaches the bottom —
     on this connection a page takes ~400ms from Tokyo and several seconds from
     the owner's link, and the point is that he never watches it happen. */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || loadError) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || cancelled) return;
        /* The in-flight guard lives inside loadNextPage, on a REF. It used to
           be the state updater — a side effect inside setLoadingMore(prev=>…),
           which React invokes twice in development, so every page was
           requested twice (verified: pages 2,2,3,3). The id-dedupe hid it in
           the result, which is exactly why it had to be caught here rather
           than by trusting the output. */
        void loadNextPage();
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [hasMore, loading, loadError, loadNextPage]);

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
  /* Taxonomy names in ALL interface languages, not just the active one — a
     Chinese operator must find 整烫 while the UI is English, and vice versa. */
  const triTaxonomyBySlug = useMemo(() => {
    const map: Record<string, string> = {};
    const put = (slug: string | null | undefined, row: { name?: string | null; name_zh?: string | null; name_ar?: string | null }) => {
      if (!slug) return;
      map[slug] = [row.name, (row as { name_zh?: string | null }).name_zh, (row as { name_ar?: string | null }).name_ar]
        .filter(Boolean).join(" ").toLowerCase();
    };
    for (const d of divisions) put(d.slug, d);
    for (const c of categories) put(c.slug, c);
    for (const sc of subcategories) put(sc.slug, sc);
    return map;
  }, [divisions, categories, subcategories]);

  const searchHaystack = useMemo(() => {
    const map: Record<string, { hay: string; sq: string }> = {};
    for (const p of products) {
      const mn = (primaryModelNames[p.id] || "").toLowerCase();
      const allModels = (modelNames[p.id] || []).join(" ").toLowerCase();
      const hay = [
        p.product_name.toLowerCase(),
        p.slug,
        mn,
        allModels,
        (p.brand || "").toLowerCase(),
        (p.excerpt || "").toLowerCase(),
        (p.description || "").toLowerCase(),
        (p.level || "").toLowerCase(),
        (p.status || "").toLowerCase(),
        triTaxonomyBySlug[p.division_slug] || divNameBySlug[p.division_slug] || "",
        triTaxonomyBySlug[p.category_slug] || catNameBySlug[p.category_slug] || "",
        triTaxonomyBySlug[p.subcategory_slug] || subNameBySlug[p.subcategory_slug] || "",
        (p.tags || []).join(" ").toLowerCase(),
        /* Chinese/other-language product names (熔接机 finds the fusing
           machine) — shipped in the slim list projection for exactly this. */
        ((p as { alternate_names?: string[] | null }).alternate_names || []).join(" ").toLowerCase(),
        (nameAlts[p.id] || "").toLowerCase(),
        /* Supplier names from the model rows — "yili" now finds every
           product that supplier makes. */
        (productSuppliers[p.id] || []).join(" ").toLowerCase(),
        (supplierAlt[p.id] || "").toLowerCase(),
      ].join(" ");
      /* Squashed twin: codes and names with all separators dropped, so any
         separator style the operator types still hits. */
      map[p.id] = { hay, sq: squash(p.product_name + " " + mn + " " + (p.slug || "")) };
    }
    return map;
  }, [products, primaryModelNames, modelNames, divNameBySlug, catNameBySlug, subNameBySlug, triTaxonomyBySlug, productSuppliers, nameAlts, supplierAlt]);

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
    | { kind: "supplier"; label: string; count: number }
    | { kind: "product"; id: string; slug: string; label: string; modelCode?: string; matchedModel?: string; thumb?: string };

  /* Tallies for the suggestion dropdown. They depend only on `products`, so
     keeping them inside the search-keyed memo meant a full 705-product pass
     on every keystroke for output that never changed. */
  const suggestionCounts = useMemo(() => {
    const categoryProductCounts: Record<string, number> = {};
    const subcategoryProductCounts: Record<string, number> = {};
    const brandProductCounts: Record<string, number> = {};
    const supplierProductCounts: Record<string, number> = {};
    for (const p of products) {
      categoryProductCounts[p.category_slug] = (categoryProductCounts[p.category_slug] || 0) + 1;
      subcategoryProductCounts[p.subcategory_slug] = (subcategoryProductCounts[p.subcategory_slug] || 0) + 1;
      if (p.brand) brandProductCounts[p.brand] = (brandProductCounts[p.brand] || 0) + 1;
      for (const sup of productSuppliers[p.id] || []) {
        supplierProductCounts[sup] = (supplierProductCounts[sup] || 0) + 1;
      }
    }
    return { categoryProductCounts, subcategoryProductCounts, brandProductCounts, supplierProductCounts };
  }, [products, productSuppliers]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q.length < 1) return [] as Suggestion[];

    const { categoryProductCounts, subcategoryProductCounts, brandProductCounts, supplierProductCounts } = suggestionCounts;

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

    /* Suppliers ride the same dropdown — clicking one filters the grid to
       that supplier's products, the same gesture brands already have.
       allSuppliers is cost-side data and only arrives for Product Data
       staff, so the section simply never exists on /products. */
    const sups = allSuppliers
      .map(name => ({ name, score: prefixThenContains(name, q) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(({ name }): Suggestion => ({ kind: "supplier", label: name, count: supplierProductCounts[name] || 0 }));

    const qSquashed = squash(q);
    const prods: Suggestion[] = [];
    for (const p of products) {
      const mn = primaryModelNames[p.id] || "";
      const roster = modelNames[p.id] || (mn ? [mn] : []);
      const sName = prefixThenContains(p.product_name, q);
      /* Match against EVERY family member, not just the primary — typing
         XF-600 must surface the family even though the card is headed
         XF-450. The member that matched becomes the suggestion's code and
         the profile deep-link target. */
      let sModel = -1;
      let matched: string | undefined;
      for (const name of roster) {
        const sc = prefixThenContains(name, q);
        if (sc >= 0 && (sModel === -1 || sc < sModel)) { sModel = sc; matched = name; }
      }
      /* Two extra ways in: the supplier's name ("yili" lists its machines)
         and the squashed code ("xprr2100" hits XPRR-2100EF-LC). Ranked after
         direct name/code hits so exact matches stay on top. */
      const sSupplier = (productSuppliers[p.id] || []).some(sup => prefixThenContains(sup, q) >= 0) ? 3 : -1;
      let sSquash = -1;
      if (qSquashed) {
        for (const name of roster) {
          if (squash(name).includes(qSquashed)) { sSquash = 3; if (!matched) matched = name; break; }
        }
      }
      /* Translated names too, so 熔接机 surfaces the product in the dropdown
         and not only in the grid filter. */
      const sAlt = (nameAlts[p.id] || "").toLowerCase().includes(q) ? 2 : -1;
      const score = Math.min(
        sName === -1 ? Infinity : sName,
        sModel === -1 ? Infinity : sModel,
        sSupplier === -1 ? Infinity : sSupplier,
        sSquash === -1 ? Infinity : sSquash,
        sAlt === -1 ? Infinity : sAlt,
      );
      if (!Number.isFinite(score)) continue;
      prods.push({ kind: "product", id: p.id, slug: p.slug || p.id, label: p.product_name, modelCode: matched || mn || undefined, matchedModel: matched && matched !== mn ? matched : undefined, thumb: mainImages[p.id], _score: score } as Suggestion & { _score: number });
    }
    (prods as (Suggestion & { _score: number })[]).sort((a, b) => a._score - b._score);
    const productSuggestions = prods.slice(0, 6);

    return [...cats, ...subs, ...brands, ...sups, ...productSuggestions];
  }, [search, categories, subcategories, allBrands, allSuppliers, products, primaryModelNames, modelNames, mainImages, productSuppliers, suggestionCounts, nameAlts]);

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
    } else if (s.kind === "supplier") {
      setFilterSupplier(s.label);
    } else if (s.kind === "product") {
      router.push(s.matchedModel
        ? `${baseRoute}/${s.slug}?model=${encodeURIComponent(s.matchedModel)}`
        : `${baseRoute}/${s.slug}`);
    }
  };

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    return products.filter(p => {
      /* /products is the customer-facing catalogue: only ACTIVE products
         exist there (the API already refuses others to unprivileged
         callers; this covers privileged staff AND the warm-start cache,
         which is shared with /product-data and may hold drafts). */
      if (!isInternal && (p.status || "draft") !== "active") return false;
      if (filterDiv && p.division_slug !== filterDiv) return false;
      if (filterCat && p.category_slug !== filterCat) return false;
      if (filterSub && p.subcategory_slug !== filterSub) return false;
      if (filterBrand && p.brand !== filterBrand) return false;
      if (filterLevel && p.level !== filterLevel) return false;
      if (filterSupplier && !(productSuppliers[p.id] || []).includes(filterSupplier)) return false;
      /* Status/visible are INTERNAL work filters, and the filter state is
         persisted and SHARED across both routes — without this guard, a
         "Draft" filter picked while working in /product-data silently
         empties the /products catalogue for the same operator. */
      if (isInternal) {
        if (filterVisible === "visible" && !p.visible) return false;
        if (filterVisible === "hidden" && p.visible) return false;
        if (filterStatus && (p.status || "draft") !== filterStatus) return false;
      }
      if (filterFeatured === "yes" && !p.featured) return false;
      if (filterFeatured === "no" && p.featured) return false;
      /* The SERVER already ran this query — across the products row, the
         model codes, the SKUs, the supplier names and the taxonomy names in
         three languages. Re-running the client token match on top of it would
         only ever REMOVE rows, and it would remove the right ones: the client
         haystack gets model codes and supplier names from the signals
         payload, which lands after the grid, so for those first moments it
         would reject every row the server matched by model code. */
      if (!serverSearchActive && tokens.length > 0) {
        const entry = searchHaystack[p.id];
        const hay = entry?.hay || "";
        const sq = entry?.sq || "";
        for (const t of tokens) {
          if (hay.includes(t)) continue;
          const st = squash(t);
          if (st && sq.includes(st)) continue;
          return false;
        }
      }
      return true;
    });
  }, [products, isInternal, filterDiv, filterCat, filterSub, filterBrand, filterLevel, filterSupplier, filterVisible, filterFeatured, filterStatus, deferredSearch, serverSearchActive, productSuppliers, searchHaystack]);

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
    /* How many of `total` are actually on screen. Equal to total until the
       catalogue outgrows one page — then the heading says so out loud instead
       of quietly showing a short category. */
    loaded: number;
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
    /* The group SET comes from the server when it sent one, not from the rows
       that happen to be loaded. Same numbers as before while everything fits
       on one page — and above that, a category no longer disappears just
       because the sort put it on page four. Search/filter narrow both sides
       identically, because the count query runs the same match set. */
    /* Only when the client predicate cannot remove rows the server counted,
       otherwise the heading would over-report — worse than under-reporting.
       Two narrowings live only in the browser: the supplier filter (it reads
       the signals map, which the server has no part in) and the active-only
       catalogue rule on /products, which the server applies for unprivileged
       callers but not for staff who are allowed to see drafts. In both cases
       the grid falls back to counting what it loaded, exactly as before. */
    const serverCats = isInternal && !filterSupplier ? groupCounts?.categories ?? null : null;
    const catSlugs = [...new Set([...Object.keys(catBuckets), ...Object.keys(serverCats ?? {})])]
      .sort((a, b) => rank(catRank, a) - rank(catRank, b));
    return catSlugs.map(catSlug => {
      const catName = catNameBySlug[catSlug] || (catSlug === "_uncategorized" ? t("list.uncategorized", "Uncategorized") : catSlug);
      const buckets = catBuckets[catSlug] ?? {};
      const subSlugs = Object.keys(buckets).sort((a, b) => rank(subRank, a) - rank(subRank, b));
      const subSections = subSlugs.map(subSlug => ({
        slug: subSlug,
        name: subMap[subSlug] || (subSlug === "_uncategorized" ? t("list.other", "Other") : subSlug),
        products: buckets[subSlug],
      }));
      const loaded = subSections.reduce((a, s) => a + s.products.length, 0);
      const total = serverCats?.[catSlug] ?? loaded;
      // Capitalise first letter of category name even if input is title cased lower in our map
      const displayName = catName.charAt(0).toUpperCase() + catName.slice(1);
      return { slug: catSlug, name: displayName, total, loaded, subSections };
    });
    /* `t` IS a dependency. It supplies the "Uncategorized" and "Other"
       fallback names above, so leaving it out meant switching language
       relaid the whole page and left those two group headings in the
       previous language until some unrelated filter happened to change. */
  }, [filtered, categories, subcategories, subMap, catNameBySlug, viewMode, groupCounts, isInternal, filterSupplier, t]);

  /* THE CONDITION HAS TO MATCH THE RENDER, EXACTLY.
     The category jump-nav below hosts this screen's long ramp, and it only
     renders when there is more than one category — in grid view, with results.
     Claiming the ramp unconditionally is what broke /products the first time
     this was wired: the main header pane stood down on the claim, nothing drew
     a ramp because the catalog was empty, and the page ended up with no blur
     over its header at all. Same expression as the JSX guard, deliberately. */
  useTopRampOwner(categoryTree.length > 1);

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
        if (json.length < 2_500_000) window.localStorage.setItem(listSnapshotKey, json);
      } catch { /* quota guard */ }
      return next;
    });
  };

  const selectClass = "h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-secondary)] outline-none focus:border-[var(--border-focus)]";

  return (
    <div className="kx-pd min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      <div className="relative z-[1] max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        {/* relative z-30: the top strip's ramp (z-20) runs BEHIND this. */}
        <div className="relative z-30 flex flex-wrap items-center gap-3 mb-1">
          {/* Matched to Inventory's PageHeader (owner, 2026-08-20: "compare with
              inventory app… make them same"): the BK-4 labeled back chip, the
              plain (non-glass) icon chip, the M-1 title rule and the
              kx-ph-search well — the four real deltas the comparison found.
              The divisions TabStrip already shared the canon recipe. */}
          {/* The recipe is IMPORTED, not re-typed. This row was hand-matched
              to PageHeader once and the class string copied along with it —
              which is exactly how the two drift the next time the canon moves.
              The arrangement below stays bespoke on purpose (the count and FX
              rate ride the title line to reclaim vertical space), but the
              control wears the shared definition. */}
          <Link href="/" aria-label="Back to Hub" className={BACK_CHROME}>
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span className="hidden text-[12px] font-medium sm:inline">Hub</span>
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] sm:h-10 sm:w-10 sm:rounded-xl">
              {isInternal ? <ProductDataIcon size={16} /> : <ProductsIcon size={16} />}
            </div>
            <h1 className="text-xl font-bold tracking-tight truncate md:sr-only">
              {isInternal ? t("list.productData") : t("list.products")}
            </h1>
            {/* Count and rate ride the TITLE line instead of owning a row of
                their own. Measured before this: the catalogue's first product
                started 597px down a 686px viewport — 87% of the opening screen
                was chrome. A row that carries two short facts is the cheapest
                of those bands to reclaim. They wrap away on a phone, where the
                title already needs the width. */}
            <span className="hidden sm:flex items-center gap-2 shrink-0 text-[12px] text-[var(--text-dim)]">
              <span className="tabular-nums">
                {total ?? (isInternal ? products.length : products.filter((p) => (p.status || "draft") === "active").length)}
              </span>
              {fx && (
                <span
                  className="px-1.5 py-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] text-[var(--text-subtle)] tabular-nums"
                  title={fxTitle}
                >
                  {formatRate(fx.rate)}
                  {fx.source === "fallback" && (
                    <span className="ms-1 text-[var(--text-ghost)]">{t("list.fxOffline", "(offline)")}</span>
                  )}
                </span>
              )}
            </span>
          </div>
          {/* On a phone this row had to hold back + icon + title + settings +
              "Add Product" in ~360px, which left the title about 60px and cut
              "Product Data" to "Pr…". The actions now take a row of their own
              below (w-full forces the wrap), so the title gets the full width
              of the first row. Desktop is untouched — one row, as before. */}
          {/* NO LONGER A ROW OF ITS OWN ON A PHONE. Giving the actions their
              own line cost a full band and let Add Product take 295px of a
              375px screen — 79% of the width for one button, the heaviest
              object on a page whose job is showing products. Below `sm` it
              becomes an icon, like Settings beside it, and both ride the title
              line: back+icon+title needs ~184px there, leaving room for two
              40px buttons. The label stays in aria-label and title. */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Settings + Add are admin tools — only surface them on
                the internal /product-data path. The public /products
                catalog is read-only for customers. */}
            {isInternal && (
              <>
                <Link href={`${baseRoute}/settings`} className="kx-glass kx-hover-glow h-10 px-4 max-sm:w-10 max-sm:px-0 max-sm:justify-center shrink-0 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[13px] font-medium flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all">
                  <SettingsIcon2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("list.controlPanel")}</span>
                </Link>
                {/* "Visual Library" button removed — it now lives in the
                    Database app (Database › Visual Library › Specs & Attributes;
                    /product-data/visual-mapping already redirects there), so a
                    duplicate entry point here was just header clutter. */}
                <Link
                  href={`${baseRoute}/new`}
                  aria-label={t("action.addProduct")}
                  title={t("action.addProduct")}
                  className="h-10 px-5 max-sm:w-10 max-sm:px-0 max-sm:justify-center shrink-0 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 transition-all shadow-lg"
                >
                  <PlusIcon className="h-4 w-4 shrink-0" />
                  <span className="max-sm:hidden">{t("action.addProduct")}</span>
                </Link>
              </>
            )}
          </div>
        </div>
        {/* Long catalogues need a way back up — one control serves both
            /products and /product-data since they share this component. */}
        <BackToTop label={t("list.backToTop", "Back to top")} />

        {/* Search + Filters — sticky to the top of the viewport so
            the user can refine the query without scrolling back up.
            z-30 sits above the category jump-nav (z-20) so the
            search row always wins when both stack. */}
        {/* Sticky toolbar. `pt-2` (not pt-1) so the search field doesn't sit
            4px under the app header when pinned — on a phone that read as the
            two bars touching. Its measured height feeds --kx-pd-tools-h, which
            is what the category nav below pins to. */}
        <div ref={toolbarRef} className="kx-bar-host kx-pd-toolbar sticky top-0 z-30 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 pt-2 pb-2 mb-3 bg-[var(--bg-primary)]">
          {/* NO layer of its own. This bar sits inside the category nav's
              ramp, which now reaches up over it (--kx-ramp-top) — one
              blurred edge for the whole top strip, owner's rule: "you are
              using three blur edge and this is wrong, you only can use one
              but more longer". */}
        <div>
          {/* On a phone this row had to hold the search field, the grid/list
              toggle and Filters in 375px, which left the input about 140px —
              its placeholder read "Search by" and stopped, so the one control
              that tells you what you can search by (name, model code, brand,
              category, tags) was the one cut off. It now takes a row of its
              own below 640px; desktop is unchanged. */}
          <div className="flex flex-wrap gap-3">
            <div className="relative basis-full sm:basis-0 sm:flex-1 min-w-0" ref={searchBoxRef}>
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)] z-10" />
              {/* role="combobox": this input already carries
                  aria-autocomplete and aria-expanded and drives a suggestion
                  list with the arrow keys, but a bare <input> is a textbox,
                  where neither property is allowed — so assistive tech was
                  being told about a listbox it had no way to reach. */}
              <input
                type="search"
                role="combobox"
                aria-controls="pl-search-suggestions"
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
                /* The full list of searchable fields — too long to fit the
                   placeholder on a phone, so it lives here and in the title
                   where it is never truncated. */
                aria-label={t("list.searchAria")}
                title={t("list.searchAria")}
                aria-autocomplete="list"
                aria-expanded={searchOpen && suggestions.length > 0}
                className="kx-ph-search w-full h-11 pl-10 pr-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none transition-colors duration-200 [&::-webkit-search-cancel-button]:hidden"
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
                  id="pl-search-suggestions"
                  role="listbox"
                  className="kx-glass-pop absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-[420px] overflow-y-auto rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-2xl"
                >
                  {(() => {
                    const groups: { title: string; items: Suggestion[] }[] = [];
                    const cats = suggestions.filter(s => s.kind === "category");
                    const subs = suggestions.filter(s => s.kind === "subcategory");
                    const brs  = suggestions.filter(s => s.kind === "brand");
                    const supsG = suggestions.filter(s => s.kind === "supplier");
                    const prs  = suggestions.filter(s => s.kind === "product");
                    if (cats.length) groups.push({ title: t("search.groupCategories"), items: cats });
                    if (subs.length) groups.push({ title: t("search.groupSubcategories"), items: subs });
                    if (brs.length)  groups.push({ title: t("search.groupBrands"), items: brs });
                    if (supsG.length) groups.push({ title: t("search.groupSuppliers", "Suppliers"), items: supsG });
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
                                  {/* Real Icon Hub icon per row (same source as the
                                      category rail); generic glyph only when none
                                      is assigned yet. */}
                                  {s.kind === "category" && (classIcons.category?.[s.slug]
                                    ? <ClassMonoIcon src={classIcons.category[s.slug]} className="h-4 w-4 text-[var(--text-muted)]" />
                                    : <LayersIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />)}
                                  {s.kind === "subcategory" && (classIcons.subcategory?.[s.slug]
                                    ? <ClassMonoIcon src={classIcons.subcategory[s.slug]} className="h-4 w-4 text-[var(--text-muted)]" />
                                    : <BoxesIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />)}
                                  {s.kind === "brand" && <TagsIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                  {s.kind === "supplier" && (supplierLogos[s.label]
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    ? <img src={supplierLogos[s.label]} alt="" className="h-full w-full object-contain rounded-md p-0.5" />
                                    : <FactoryIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" />)}
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
            {/* View Toggle. Aurora: the language-bar segment grammar — a
                padded shell with FREE rounded buttons, so the seg-on ring's
                corners never fight a clipping container (the owner's "UI
                bug": rounded ring inside overflow-hidden rounded-xl). Core:
                the original joined pair, untouched. */}
            <div className={aurora
              ? "kx-glass flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-1"
              : "flex rounded-xl border border-[var(--border-subtle)] overflow-hidden"}>
              <button
                onClick={() => setViewMode("grid")}
                /* Icon-only, so it needs a name of its own: measured on prod
                   both view buttons had no aria-label, no title and no text —
                   a screen reader announced two anonymous "button"s, and a
                   sighted user got no tooltip either. */
                aria-label={t("list.viewGrid", "Grid view")}
                title={t("list.viewGrid", "Grid view")}
                aria-pressed={viewMode === "grid"}
                className={aurora
                  ? `h-8 w-9 rounded-lg flex items-center justify-center transition-all ${
                      viewMode === "grid"
                        ? "kx-seg-on text-[var(--text-primary)]"
                        : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                    }`
                  : `h-10 w-10 flex items-center justify-center transition-all ${
                      viewMode === "grid"
                        ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                        : "bg-[var(--bg-surface-subtle)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                    }`}
              >
                <LayoutGridIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                aria-label={t("list.viewList", "List view")}
                title={t("list.viewList", "List view")}
                aria-pressed={viewMode === "list"}
                className={aurora
                  ? `h-8 w-9 rounded-lg flex items-center justify-center transition-all ${
                      viewMode === "list"
                        ? "kx-seg-on text-[var(--text-primary)]"
                        : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                    }`
                  : `h-10 w-10 flex items-center justify-center border-l border-[var(--border-subtle)] transition-all ${
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
              /* kx-glass only on the RESTING button: when it is on, kx-seg-on
                 owns the fill, and stacking a glass background over the
                 selection wash would erase the state. */
              className={`kx-hover-glow h-10 px-4 rounded-xl border text-[12px] font-medium flex items-center gap-2 transition-all ${
                showFilters || activeFilterCount > 0
                  ? aurora
                    ? "kx-seg-on border-transparent text-[var(--text-primary)]"
                    : "bg-[var(--bg-surface)] border-[var(--border-focus)] text-[var(--text-primary)]"
                  : `${aurora ? "kx-glass " : ""}bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-faint)] hover:text-[var(--text-muted)]`
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
            {/* Phone only — from `sm` up these two facts ride the title line.
                They sit at the END of this row rather than in a band of their
                own: the row carried just the view switch and Filters, 177px of
                controls in a 375px line, so 166px sat empty while this text
                paid for a whole band above it. Two half-empty rows became one
                full one. `ms-auto` pushes them to the far edge, and RTL flips
                with it because it is a logical property. */}
            <p className="sm:hidden ms-auto flex items-center gap-2 text-[12px] text-[var(--text-dim)]">
              <span className="tabular-nums">
                {total ?? (isInternal ? products.length : products.filter((p) => (p.status || "draft") === "active").length)}
              </span>
              {fx && (
                <span
                  className="px-1.5 py-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] text-[var(--text-subtle)] tabular-nums"
                  title={fxTitle}
                >
                  {formatRate(fx.rate)}
                </span>
              )}
            </p>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.division")}</label>
                  <KdsSelect value={filterDiv} onChange={(v) => { setFilterDiv(v); setFilterCat(""); setFilterSub(""); }}
                    options={orderedDivisions.map(d => ({ value: d.slug, label: localizedName(d, lang) }))}
                    placeholder={t("list.allOption")} triggerClassName={selectClass + " w-full pe-8 text-start"} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.category")}</label>
                  <KdsSelect value={filterCat} onChange={(v) => { setFilterCat(v); setFilterSub(""); }} disabled={!filterDiv}
                    options={filteredCats.map(c => ({ value: c.slug, label: localizedName(c, lang) }))}
                    placeholder={t("list.allOption")} triggerClassName={selectClass + " w-full pe-8 text-start"} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.subcategory")}</label>
                  <KdsSelect value={filterSub} onChange={setFilterSub} disabled={!filterCat}
                    options={filteredSubs.map(s => ({ value: s.slug, label: localizedName(s, lang) }))}
                    placeholder={t("list.allOption")} triggerClassName={selectClass + " w-full pe-8 text-start"} />
                </div>
                {/* Supplier filter is an internal concept — hide on
                    the public /products catalog. */}
                {isInternal && (
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.supplier")}</label>
                    <KdsSelect value={filterSupplier} onChange={setFilterSupplier} options={allSuppliers}
                      placeholder={t("list.allOption")} triggerClassName={selectClass + " w-full pe-8 text-start"} />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.brand")}</label>
                  <KdsSelect value={filterBrand} onChange={setFilterBrand} options={allBrands}
                    placeholder={t("list.allOption")} triggerClassName={selectClass + " w-full pe-8 text-start"} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.level")}</label>
                  <KdsSelect value={filterLevel} onChange={setFilterLevel}
                    options={allLevels.map(l => ({ value: l, label: l.charAt(0).toUpperCase() + l.slice(1) }))}
                    placeholder={t("list.allOption")} triggerClassName={selectClass + " w-full pe-8 text-start"} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.visibility")}</label>
                  <KdsSelect value={filterVisible} onChange={setFilterVisible}
                    options={[{ value: "visible", label: t("filter.visible") }, { value: "hidden", label: t("filter.hidden") }]}
                    placeholder={t("list.allOption")} triggerClassName={selectClass + " w-full pe-8 text-start"} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.status")}</label>
                  <KdsSelect value={filterStatus} onChange={setFilterStatus}
                    options={[{ value: "draft", label: t("status.draft") }, { value: "active", label: t("status.active") }, { value: "archived", label: t("status.archived") }]}
                    placeholder={t("list.allOption")} triggerClassName={selectClass + " w-full pe-8 text-start"} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-dim)] mb-1 uppercase tracking-wider">{t("filter.featured")}</label>
                  <KdsSelect value={filterFeatured} onChange={setFilterFeatured}
                    options={[{ value: "yes", label: t("filter.isFeatured") }, { value: "no", label: t("filter.notFeatured") }]}
                    placeholder={t("list.allOption")} triggerClassName={selectClass + " w-full pe-8 text-start"} />
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
          /* BETWEEN the two, and it has to be exactly that.
             ABOVE the category nav's ramp (z-20) — without that a 28px
             backdrop blur painted this whole row out of existence, which is
             why it was raised in the first place.
             BELOW the sticky search toolbar (z-30) — at z-30 it TIED with
             that bar and won on DOM order, being the later sibling. So on
             scroll it rode up over the toolbar's blurred edge and over the
             open filter panel instead of passing behind them. Owner: "this
             have bug when i scroll it's over the blur edge"; measured with
             elementsFromPoint, this strip sat above the filter <select> it
             was overlapping. */
          <div className="relative z-[25] mb-4">
            {/* Divisions ride the canonical TabStrip — under Aurora the
                selected state is the ONE Hub-Blue pill sliding between tabs
                (measured, labels vary), under Core the original filled pill,
                byte for byte. Bespoke tab markup deleted, per TabStrip's own
                doctrine. */}
            <TabStrip
              ariaLabel={t("list.divisions")}
              className="inline-flex max-w-full"
              items={[
                {
                  key: "",
                  label: t("list.allDivisions", "All divisions"),
                  icon: <LayoutGridIcon className="h-3.5 w-3.5 opacity-80 shrink-0" />,
                  active: filterDiv === "",
                  onClick: () => { setFilterDiv(""); setFilterCat(""); setFilterSub(""); },
                },
                ...orderedDivisions.map((d) => {
                  /* Prefer the icon saved for this division in the
                     Classification Icon Hub; fall back to a built-in keyword
                     icon. Fixed 16px slot so the pill width never changes
                     when the hub icon lands (no bar jitter). */
                  const savedIcon = classIcons.division?.[d.slug];
                  const DivIcon = divisionIcon(d.name);
                  return {
                    key: d.slug,
                    label: localizedName(d, lang),
                    icon: (
                      <span className="h-4 w-4 flex items-center justify-center shrink-0">
                        {savedIcon
                          ? <ClassMonoIcon src={savedIcon} className="h-4 w-4" />
                          : <DivIcon className="h-3.5 w-3.5 opacity-80" />}
                      </span>
                    ),
                    active: filterDiv === d.slug,
                    onClick: () => { setFilterDiv(d.slug); setFilterCat(""); setFilterSub(""); },
                  };
                }),
              ]}
            />
          </div>
        )}

        {/* Results count — live tally tied to the search/filter state.
            When a search is typed, surface the match count
            prominently so the user gets immediate feedback that
            the query is doing something. */}
        {(activeFilterCount > 0 || search) && (
          <p className="text-[12px] text-[var(--text-dim)] mb-4 px-1">
            {filtered.length === 0 ? (
              <span className="text-amber-400">{t("list.noMatchesFor")} <strong className="text-[var(--text-primary)]">&quot;{search}&quot;</strong></span>
            ) : (
              <>{t("list.showing")} <strong className="text-[var(--text-primary)] tabular-nums">{filtered.length}</strong> {t("list.ofProducts").replace("{total}", String(products.length))}{search ? <> {t("list.matching")} <strong className="text-[var(--text-primary)]">&quot;{search}&quot;</strong></> : null}</>
            )}
          </p>
        )}

        {/* Refresh failed but the catalogue is on screen from the warm-start
            cache. Say so quietly and offer another try — do NOT take the grid
            away, which is what this component used to do. */}
        {loadError && loadError !== "__auth__" && products.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5">
            <span className="text-[12.5px] text-[var(--text-secondary)]">
              {t("state.showingCached", "Showing your last loaded catalog — couldn't reach the server just now.")}
            </span>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="text-[12.5px] font-semibold text-[#7FA9D6] underline-offset-2 hover:underline"
            >
              {t("action.retry")}
            </button>
          </div>
        )}

        {/* Product Grid / List */}
        {loadError === "__auth__" ? (
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-16 text-center">
            <ProductsIcon size={48} className="text-[var(--text-barely)] mx-auto mb-4" />
            <p className="text-[var(--text-primary)] text-[14px] font-semibold">{t("state.sessionExpiredTitle", "Session expired")}</p>
            <p className="text-[var(--text-muted)] text-[13px] mt-1">{t("state.sessionExpiredHint", "Please sign in again to load the catalog.")}</p>
            {/* A real document load, NOT next/link: the session is gone, so
                the point is to drop all client state and let the root render
                the sign-in form fresh. A soft navigation would carry the dead
                session with it. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex items-center gap-2 mt-4 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold transition-all shadow-lg"
            >
              {t("action.signInAgain", "Sign in again")}
            </a>
          </div>
        ) : loadError && products.length === 0 ? (
          /* The full-panel error is ONLY for a screen with nothing on it. When
             the warm-start cache has already painted the catalogue, a failed
             REFRESH must not take it away — the owner watched 121 products get
             replaced by "Couldn't load products" because this branch sat above
             the grid and never looked at whether it had anything to show. That
             case now falls through to the grid and reports itself in the strip
             below, which is a statement about freshness, not availability. */
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-red-500/30 p-16 text-center">
            <ProductsIcon size={48} className="text-red-400/70 mx-auto mb-4" />
            <p className="text-[var(--text-primary)] text-[14px] font-semibold">{t("state.loadFailedTitle")}</p>
            <p className="text-[var(--text-muted)] text-[13px] mt-1">{loadError}</p>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="inline-flex items-center gap-2 mt-4 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold transition-all shadow-lg"
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
              <Link href={`${baseRoute}/new`} className="inline-flex items-center gap-2 mt-4 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold transition-all">
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
              <nav
                /* ONE ramp for the whole top strip, and it runs BEHIND every
                   component in that strip — owner: "put the blured edge on
                   the back of the top page components and make more longer".

                   --kx-ramp-top reaches well past the title block so the
                   frost starts at the top of the page whatever the title
                   wraps to; anything higher than needed is simply clipped
                   above the viewport. What made this a dark smear before was
                   not the height, it was z-order: the title, the count and
                   the divisions row sat BELOW the ramp and got blurred away
                   as if they were scrolled-under content. They now carry
                   `relative z-30` (above the ramp's z-20 host), so the frost
                   passes behind them and only real scrolling content
                   dissolves into it. */
                style={{ top: "var(--kx-pd-tools-h, 52px)", ["--kx-ramp-top" as string]: "26rem" }}
                /* The tail dies JUST UNDER the category cards. The fade runs
                   BEHIND the cards (they are this bar's own content, lifted
                   above the layer, so they stay crisp) and is fully clear
                   ~25px below them — measured, because at 5rem of overhang
                   the ramp reached y=451 and swallowed the "Fabric
                   preparation" heading at y=396, which is the same
                   blur-over-live-content defect one row further down.

                   --kx-ramp-fade must be a LENGTH here, not the default 45%:
                   a percentage is taken from the layer's own height, so once
                   the layer grew to cover the strip the fade grew with it. */
                className="kx-bar-host max-sm:static sticky z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 pt-1.5 pb-3.5 mb-5 bg-[var(--bg-primary)] [--kx-ramp-ext:1rem] [--kx-ramp-fade:4rem]"
                data-kx-progressive=""
                aria-label="Categories"
              >
                {/* The screen's ONE progressive edge: four masked layers
                    ramp 3→28px, stretched over the whole top strip. */}
                <div aria-hidden className="kx-glass-bar kx-bar-prog"><i /><i /><i /><i /></div>
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
                {/* UNIFORM GRID, owner's pick (2026-08-20, sample 2 of 4):
                    "I don't want have scrolling, I want all can show in the
                    page with organize way." Every category is visible — equal
                    columns, names truncating, counts on the trailing edge —
                    instead of the one scrolling pill row.

                    History, because this bar has flip-flopped: the original
                    88px tile grid died for pushing the first product to 597px
                    of a 686px viewport; the scrolling row that replaced it is
                    what the owner has now rejected. This grid is the middle:
                    ~2–3 rows of 38px on a laptop (~130px), never a sideways
                    scroll. On phones the same grid runs 2-up (~7 rows), so
                    there the bar goes STATIC (max-sm) — a ~320px block may
                    scroll away with the page, but it must not DOCK over it. */}
                <div className="hidden sm:grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-2 pb-0.5">
                  {categoryTree.map((cat) => (
                    <a
                      key={cat.slug}
                      href={`#cat-${cat.slug}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById(`cat-${cat.slug}`);
                        const sc = document.getElementById("main-scroll-container");
                        const navEl = e.currentTarget.closest("nav");
                        if (!el || !sc) return;
                        /* scrollIntoView put the title BEHIND the docked
                           chrome (owner: "it didn't take me to the right
                           place"): block:"start" aligns the section with the
                           scroller's top edge, and the sticky grid + tools
                           row then cover exactly that strip. The offset is
                           measured, not hardcoded, because the grid's height
                           is 2–3 rows depending on viewport — and on phones
                           the bar is static, so only a small clearance. */
                        const stuck = navEl && getComputedStyle(navEl).position === "sticky";
                        const offset = stuck
                          ? navEl.getBoundingClientRect().height +
                            (parseFloat(getComputedStyle(navEl).top) || 0) + 8
                          : 60;
                        const targetTop = () =>
                          el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - offset;
                        sc.scrollTo({ top: targetTop(), behavior: "smooth" });
                        /* Second half of the miss: the sections render with
                           content-visibility:auto, so everything below the
                           fold has an ESTIMATED height until it paints. The
                           first scroll lands on the estimate; as the passed
                           sections materialize, the real target moves. Wait
                           for the scroll to stop (scrollTop stable across a
                           few frames — works whether or not the browser has
                           scrollend), then snap the residual error. Bounded:
                           at most 4 corrections and ~5s of frames, and a
                           user grabbing the scrollbar mid-flight just makes
                           the loop finish early. */
                        let last = -1, still = 0, passes = 0, frames = 0;
                        const settle = () => {
                          if (++frames > 300) return;
                          const cur = sc.scrollTop;
                          if (cur === last) still += 1; else { still = 0; last = cur; }
                          if (still >= 3) {
                            const diff = targetTop() - cur;
                            if (Math.abs(diff) <= 4 || passes >= 4) return;
                            passes += 1; still = 0;
                            sc.scrollTop = cur + diff;
                          }
                          requestAnimationFrame(settle);
                        };
                        requestAnimationFrame(settle);
                      }}
                      className={`group relative flex flex-row items-center justify-start gap-1.5 h-[38px] min-w-0 px-3 rounded-xl kx-glass bg-[var(--bg-card)] border border-white/[0.06] kx-hover-card kx-hover-tile kx-tile-neon select-none transition-transform duration-75 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100`}
                    >
                      {classIcons.category?.[cat.slug] ? (
                        <ClassMonoIcon src={classIcons.category[cat.slug]} className="kx-neon-icon h-4 w-4 shrink-0 text-[var(--text-primary)] opacity-90" />
                      ) : (
                        <LayoutGridIcon className="kx-neon-svg h-4 w-4 shrink-0 text-[var(--text-primary)] opacity-90" />
                      )}
                      <span className="kx-neon-label flex-1 min-w-0 truncate text-[11px] font-medium leading-none text-[var(--text-muted)]">{cat.name}</span>
                      {/* The count earns the pill its keep: the row is now
                          navigation AND a size read, which the tile never was. */}
                      <span className="text-[10px] tabular-nums text-[var(--text-ghost)] shrink-0">{cat.total}</span>
                    </a>
                  ))}
                </div>
                {/* ── PHONES: ONE 40px row + the MN-5 dropdown ──
                    Third phone layout for this nav, and the owner rejected
                    the previous two on sight (the full grid ate half the
                    viewport; the two-row collapse was "still don't like").
                    Sample 1 of the mobile set: the row names the control,
                    the tap opens the one canonical dropdown (kx-glass-pop
                    material + kx-pop-panel shell, per MN-5) listing every
                    category with its count; picking one jumps and closes.
                    Desktop keeps the sample-2 grid untouched. */}
                <div className="sm:hidden relative">
                  <button
                    type="button"
                    aria-expanded={catsOpen}
                    data-kx-cats-trigger=""
                    onClick={() => setCatsOpen((o) => !o)}
                    className="w-full flex items-center gap-2 h-10 px-3 rounded-xl kx-glass bg-[var(--bg-card)] border border-white/[0.06] select-none active:scale-[0.99] transition-transform"
                  >
                    <LayoutGridIcon className="h-4 w-4 shrink-0 text-[var(--text-primary)] opacity-90" />
                    <span className="flex-1 text-start text-[12px] font-medium text-[var(--text-primary)]">
                      {t("list.allCategories")}
                    </span>
                    <span className="text-[11px] tabular-nums text-[var(--text-ghost)]">{categoryTree.length}</span>
                    <span aria-hidden className={`text-[11px] text-[var(--text-ghost)] transition-transform ${catsOpen ? "rotate-180" : ""}`}>⌄</span>
                  </button>
                  {catsOpen && (
                    <>
                      {/* NO fixed full-screen closer. The first version put an
                          invisible fixed button over the viewport; dragging on
                          a fixed element scrolls ITS scrollable ancestor — the
                          body, which in this shell never scrolls — so with the
                          panel open every touch-drag went dead. Outside-tap
                          closing is a document listener instead (below), which
                          eats nothing. */}
                      <div className="kx-glass-pop kx-pop-panel kx-pop-dense absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[60vh] overflow-y-auto p-1.5 rounded-2xl" data-kx-cats-menu="">
                        {categoryTree.map((cat) => (
                          <a
                            key={cat.slug}
                            href={`#cat-${cat.slug}`}
                            onClick={(e) => {
                              e.preventDefault();
                              setCatsOpen(false);
                              const el = document.getElementById(`cat-${cat.slug}`);
                              const sc = document.getElementById("main-scroll-container");
                              if (!el || !sc) return;
                              const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 60;
                              sc.scrollTo({ top, behavior: "smooth" });
                            }}
                            className="flex items-center gap-2 h-10 px-2.5 rounded-lg text-[12px] text-[var(--text-secondary)]"
                          >
                            {classIcons.category?.[cat.slug] ? (
                              <ClassMonoIcon src={classIcons.category[cat.slug]} className="h-4 w-4 shrink-0 text-[var(--text-primary)] opacity-90" />
                            ) : (
                              <LayoutGridIcon className="h-4 w-4 shrink-0 text-[var(--text-primary)] opacity-90" />
                            )}
                            <span className="flex-1 min-w-0 truncate">{cat.name}</span>
                            <span className="text-[10px] tabular-nums text-[var(--text-ghost)]">{cat.total}</span>
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </nav>
            )}

          {/* 8, not 14: each section now carries 24px of its own bottom padding
              so its cards' hover glow is not clipped by paint containment
              (see SECTION_CV). 32 + 24 = the 56px this used to be. */}
          {/* kx-flat-items: every product card below loses its blur pass and
              keeps its surface — one attribute covering all category
              sections at once. See the rule in globals for the measurement
              (cards flashing blank on a fast scroll: hundreds of live blur
              layers per frame). */}
          <div className="kx-flat-items space-y-8">
          {categoryTree.map((cat) => (
            /* Every section renders; content-visibility:auto skips the paint +
               layout of the offscreen ones. This replaced a progressive-mount
               scheme whose reserved-height placeholders collapsed to real size
               on mount and drove cold CLS to ~1.0 (measured). */
            <section
              key={cat.slug}
              id={`cat-${cat.slug}`}
              style={SECTION_CV}
              className="scroll-mt-[calc(var(--kx-header-h,3.5rem)+10.5rem)]"
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
                    {/* The sample I showed dropped this heading entirely, on the
                        grounds that the selected pill already says where you
                        are. Building it proved that wrong: these pills are JUMP
                        links, not filters, so this heading is the anchor they
                        scroll to — remove it and a 27,000px page loses its
                        milestones. Quieter instead of gone: it no longer
                        competes with the product names underneath it. */}
                    <h2 className="text-[15px] md:text-[17px] font-semibold tracking-tight text-[var(--text-primary)] truncate leading-tight">
                      {cat.name}
                    </h2>
                  </div>
                  {/* When the catalogue outgrows one page the heading says
                      "12 of 214" rather than showing 12 and letting the number
                      imply the category shrank. The count itself is SQL over
                      the whole match set, not a tally of what is on screen. */}
                  <span className="shrink-0 text-[11px] font-medium text-[var(--text-ghost)] tabular-nums whitespace-nowrap">
                    {cat.loaded < cat.total
                      ? `${cat.loaded} ${t("list.ofWord", "of")} ${cat.total} ${cat.total === 1 ? t("list.productOne", "product") : t("list.productMany", "products")}`
                      : `${cat.total} ${cat.total === 1 ? t("list.productOne", "product") : t("list.productMany", "products")}`}
                  </span>
                </div>
                <div className="mt-3 h-px bg-[var(--border-subtle)]" />
              </div>

              {/* A category the server counted but this page has not reached
                  yet. It gets one quiet line instead of an empty grid — the
                  point is that the category is visibly THERE, with its real
                  number, so a catalogue too big for one page never reads as
                  "these products are gone". No animation: this is reserved
                  space, not a loading state that will swap under the reader. */}
              {cat.subSections.length === 0 && (
                <p className="py-6 text-[12px] text-[var(--text-ghost)] tabular-nums">
                  {cat.total} {cat.total === 1 ? t("list.productOne", "product") : t("list.productMany", "products")}
                  {" · "}{t("list.scrollToLoad", "scroll to load")}
                </p>
              )}

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
                signalsPending={isInternal && !signalsReady}
                modelsPending={isInternal && !modelsReady}
                fob={fobPrices[p.id]}
                fobPending={!isInternal && fobPending}
                onCardAction={onCardAction}
                lvl={levelColors[p.level || ""] || ""}
                baseRoute={baseRoute}
                isInternal={isInternal}
                aurora={aurora}
                catMap={catMap}
                subMap={subMap}
                divMap={divMap}
                primaryModelNames={primaryModelNames}
                modelNamesList={modelNames[p.id]}
                signal={signals[p.id]}
                t={t}
                onAskDelete={askDelete}
                fx={fx}
                fxTitle={fxTitle}
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
            {/* The gap utilities MUST match the row's exactly. They did not:
                the header carried `gap-4` while the row carried
                `gap-3 md:gap-4`, and the header's resolved to 12px against the
                row's 16px — five columns of 4px drift, so every heading sat up
                to 12px off the content beneath it. */}
            <div className={`hidden md:grid ${LIST_COLS} gap-3 md:gap-4 items-center px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]`}>
              <span />
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("list.colProduct")}</span>
              <span className={`text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider ${isInternal ? "" : "hidden lg:block"}`}>{t("list.colCategory")}</span>
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                {isInternal ? t("list.colReady", "Ready") : t("card.globalFob", "Global FOB")}
              </span>
              <span className={`text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider ${isInternal ? "" : "hidden xl:block"}`}>
                {isInternal ? t("list.colCost", "Cost") : t("list.colModels")}
              </span>
              {/* Status is an internal concern — the catalogue row spends that
                  column on the actions instead. */}
              {isInternal && (
                <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">{t("list.colStatus")}</span>
              )}
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
                    /* items-start on phones: the catalogue row's meta line
                       (category · subcategory · models · price) makes the text
                       block taller than the photo, and centering left the photo
                       floating beside the middle of it. */
                    className={`group relative flex ${isInternal ? "items-center" : "items-start md:items-center"} gap-3 md:grid ${LIST_COLS} md:gap-4 px-4 md:px-5 py-3 hover:bg-[var(--bg-surface-subtle)] transition-colors`}
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
                    <div className={`rounded-xl bg-white border border-[var(--border-subtle)] overflow-hidden shrink-0 flex items-center justify-center ${
                      isInternal ? "h-12 w-12 md:h-14 md:w-14" : "h-16 w-16 md:h-20 md:w-20 lg:h-24 lg:w-24"
                    }`}>
                      {imgUrl ? (
                        <img
                          src={isInternal ? IMG.thumb(imgUrl) : IMG.row(imgUrl)}
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
                      {/* Family roster — same visibility the grid chips give:
                          every member code readable from the list row. */}
                      {/* Category caption — catalogue, md→xl only. Between
                          those widths the category has no column of its own
                          (the photo, price and actions need the room), so it
                          rides under the name instead of disappearing. */}
                      {!isInternal && (
                        <p className="hidden md:block lg:hidden text-[11px] text-[var(--text-dim)] truncate mt-0.5">
                          {catMap[p.category_slug] || p.category_slug}
                          {p.subcategory_slug && subMap[p.subcategory_slug] ? (
                            <span className="text-[var(--text-ghost)]"> · {subMap[p.subcategory_slug]}</span>
                          ) : null}
                        </p>
                      )}
                      {(modelNames[p.id]?.length ?? 0) > 1 && (
                        <p className="text-[10px] font-medium tabular-nums text-[var(--text-ghost)] truncate mt-0.5">
                          {modelNames[p.id].slice(0, 5).join(" · ")}
                          {modelNames[p.id].length > 5 ? ` · +${modelNames[p.id].length - 5}` : ""}
                        </p>
                      )}
                      {/* Mobile: show all meta inline */}
                      <div className="md:hidden flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-[var(--text-dim)]">{catMap[p.category_slug] || p.category_slug}</span>
                        {/* Brand on the catalogue row said "Koleex" on every
                            product; the subcategory actually narrows it. */}
                        {isInternal ? (p.brand && (
                          <>
                            <span className="text-[var(--text-ghost)]">·</span>
                            <span className="text-[11px] text-[var(--text-dim)]">{p.brand}</span>
                          </>
                        )) : (p.subcategory_slug && subMap[p.subcategory_slug] && (
                          <>
                            <span className="text-[var(--text-ghost)]">·</span>
                            <span className="text-[11px] text-[var(--text-dim)]">{subMap[p.subcategory_slug]}</span>
                          </>
                        ))}
                        <span className="text-[var(--text-ghost)]">·</span>
                        <span className="text-[11px] text-[var(--text-dim)]">{models} {models === 1 ? t("list.modelOne", "model") : t("list.modelMany", "models")}</span>
                        {/* Price rides the same line on phones — the desktop
                            price column does not exist at this width. */}
                        {!isInternal && fobPrices[p.id]?.fobUsd != null && (
                          <>
                            <span className="text-[var(--text-ghost)]">·</span>
                            <span className="text-[11px] font-bold tabular-nums text-[var(--text-primary)]">
                              ${fobPrices[p.id]!.fobUsd!.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </>
                        )}
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
                    <div className={`hidden ${isInternal ? "md:flex" : "lg:flex"} flex-col min-w-0 gap-0.5`}>
                      <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] truncate">
                        <LayersIcon className="h-3 w-3 text-[var(--text-ghost)] shrink-0" />
                        {catMap[p.category_slug] || p.category_slug}
                      </span>
                      {/* Subcategory — catalogue only. The internal table is
                          already grouped by subcategory heading. */}
                      {!isInternal && p.subcategory_slug && subMap[p.subcategory_slug] && (
                        <span className="text-[11px] text-[var(--text-dim)] truncate pl-[18px]">
                          {subMap[p.subcategory_slug]}
                        </span>
                      )}
                      {p.division_slug && p.division_slug !== FLAGSHIP_DIVISION_SLUG && divMap[p.division_slug] && (
                        <span className="text-[10px] text-[var(--text-ghost)] uppercase tracking-wider truncate pl-[18px]">
                          {divMap[p.division_slug]}
                        </span>
                      )}
                    </div>

                    {/* Readiness (internal) / Global FOB (catalogue) — desktop
                        only. justify-start so the figure sits under its own
                        column heading rather than drifting mid-cell. */}
                    <div className="hidden md:flex items-center justify-start gap-1.5 min-w-0">
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
                      })() : (() => {
                        /* Catalogue: this column carries the price, not the
                           brand — every product here is Koleex. Same live
                           Global FOB the grid card shows. */
                        const f = fobPrices[p.id];
                        if (fobPending && f === undefined) {
                          return <span className="h-4 w-16 rounded bg-[var(--bg-surface)] animate-pulse" aria-hidden="true" />;
                        }
                        return f?.fobUsd != null ? (
                          <span
                            className="text-[14px] font-bold tabular-nums tracking-tight text-[var(--text-primary)]"
                            title={fxTitle}
                          >
                            ${f.fobUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--text-dim)] truncate">
                            {t("card.priceOnRequest", "Price on request")}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Cost + models (internal) / models (public) — desktop only.
                        Catalogue: from xl only, so the name column keeps its
                        width at laptop sizes. */}
                    <div className={`hidden ${isInternal ? "md:flex" : "xl:flex"} items-center gap-1.5`}>
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
                      {/* Market level — INTERNAL only. It is a pricing-tier
                          label, it is not in the catalogue row's six fields,
                          and at this column width it pushed straight into the
                          action buttons. */}
                      {isInternal && p.level && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${lvl}`}>
                          {p.level}
                        </span>
                      )}
                    </div>

                    {/* Status (desktop only) — INTERNAL only: it is the
                        publishing state of our record, and a customer reads
                        it as stock. */}
                    <div className={`hidden ${isInternal ? "md:flex" : ""} items-center justify-center`}>
                      {isInternal && (() => {
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
                      {/* Catalogue: the same three actions the grid card
                          offers, so a customer is not forced back into grid
                          view to use them. Hidden on phones — the row is
                          already tight there and the card view carries them. */}
                      {!isInternal && (
                        <div className="hidden md:grid grid-cols-3 gap-1 w-full">
                          {([
                            {
                              key: "ask_ai",
                              label: t("card.askAi", "Ask AI"),
                              cls: "kx-ai-glow border-[var(--accent,#0066FF)]/40 text-[var(--accent,#0066FF)] hover:bg-[var(--accent,#0066FF)]/10",
                            },
                            {
                              key: "compare",
                              label: t("card.compare", "Compare"),
                              cls: "border-[var(--state-warning,#F59E0B)]/40 text-[var(--state-warning,#F59E0B)] hover:bg-[var(--state-warning,#F59E0B)]/10 hover:border-[var(--state-warning,#F59E0B)]/70",
                            },
                            {
                              key: "quote",
                              label: t("card.addToQuotation", "Quote"),
                              cls: "border-[var(--state-success,#10B981)]/40 text-[var(--state-success,#10B981)] hover:bg-[var(--state-success,#10B981)]/10 hover:border-[var(--state-success,#10B981)]/70",
                            },
                          ] as const).map((a) => (
                            <button
                              key={a.key}
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCardAction(a.key, p); }}
                              /* whitespace-nowrap, never truncate — truncate's
                                 overflow:hidden clips the AI glow ring away. */
                              className={`px-1.5 py-1.5 rounded-lg border bg-[var(--bg-surface-subtle)] text-[10px] font-bold whitespace-nowrap transition-all ${a.cls}`}
                              title={a.label}
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Infinite scroll. The sentinel is 600px of lead time (see the
            observer) so the next page is already on its way before the user
            reaches the bottom — on the owner's link a page is seconds, and he
            should never watch it arrive. Rendered only while more pages
            exist, so the observer has nothing to fire on at the end. */}
        {hasMore && !loading && !loadError && (
          <div ref={sentinelRef} className="pt-8 pb-2" aria-hidden>
            {loadingMore && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden animate-pulse">
                    <div className="aspect-[4/3] bg-[var(--bg-surface-subtle)]" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-[var(--bg-surface-subtle)] rounded w-3/4" />
                      <div className="h-3 bg-[var(--bg-surface-subtle)] rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Themed confirm for product delete — replaces window.confirm() */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : "Delete product?"}
        message="This also removes all its models, media, translations, and saved prices. This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}