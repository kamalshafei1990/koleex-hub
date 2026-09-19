"use client";

/* ---------------------------------------------------------------------------
   ProductPreview — the single, schema-driven product experience surface.

   Renders a resolved ProductSchemaDefinition + values + knowledge + media
   into a premium, scan-first industrial product page. Used by the admin
   Review step AND the public /products/preview/[slug] page; both pass a
   `surface` and the component filters visibility internally.

   This file is PRESENTATION ONLY — no fetch, no Supabase, no Lockstitch
   literals. Visual metadata (swatches/glyphs/emphasis) comes from the
   central visual-options registry, so every schema inherits the same
   visual language without re-declaring it.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ProductSchemaDefinition,
  ProductKnowledgeBlock,
  ProductSchemaSurface,
  SpecField,
} from "@/types/product-schema";
/* ⚠️ LEAF MODULES, NOT THE BARREL. "@/lib/product-schema" (index.ts) imports
   every spec template in the system — 532 KB of source — to build the
   registry that resolveSchema() needs ON THE SERVER. This page only needs
   five pure helpers, and they live in two files with type-only imports.
   Importing them through the barrel put the whole registry into the
   browser bundle of the heaviest page in the Hub (measured 19/09/2026).
   validate:product-page-images §3 keeps the barrel out of this tree. */
import { filterFieldsForSurface, filterKnowledgeForSurface } from "@/lib/product-schema/visibility";
import { resolveOptionVisual, emphasisForGroup, collectAnchors } from "@/lib/product-schema/visual-options";
import VisualGlyph from "./VisualGlyph";
import { useTranslation, type Translations } from "@/lib/i18n";
/* ⚠️ THE PREVIEW'S OWN DICTIONARY, NOT THE EDITOR'S. This read 52 keys out of
   1,070 — the rest are packing, supplier, variant and review strings this page
   never renders. See the header of products-preview-i18n.ts. */
import { PRODUCTS_PREVIEW_I18N } from "@/lib/products-preview-i18n";
import { fetchIconBindings, type BindingsMap } from "@/lib/visual-bindings";
import { IMG } from "@/lib/cdn";
import { BrandMark } from "@/components/brand/KoleexMark";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import ProductHero, { type HeroAction } from "./ProductHero";
import ProductHighlights from "./ProductHighlights";
import ProductOptions from "./ProductOptions";
import ProductPacking from "./ProductPacking";
import ProductCompliance from "./ProductCompliance";
import ProductPriceInternal from "./ProductPriceInternal";
import type { ProductAudience, ProductDetailSections } from "@/lib/server/product-detail";

interface ProductLocaleText {
  locale: string;
  product_name?: string | null;
  tagline?: string | null;
  excerpt?: string | null;
  description?: string | null;
}

interface ProductPreviewProps {
  productName: string;
  primaryModel?: string | null;
  tagline?: string | null;
  /** Optional designed poster/banner shown full-bleed as the page header. */
  posterUrl?: string | null;
  /** Localized overlays keyed by locale; English props stay the base. */
  translations?: ProductLocaleText[];
  brand?: string | null;
  schema: ProductSchemaDefinition | null;
  values: Record<string, unknown>;
  knowledge: ProductKnowledgeBlock[];
  mainImageUrl?: string | null;
  galleryUrls?: string[];
  mediaCounts?: { photos?: number; videos?: number; manuals?: number };
  surface?: ProductSchemaSurface;
  videoUrls?: string[];
  manuals?: { url: string; label?: string | null }[];
  ar3dUrl?: string | null;
  countryOfOrigin?: string | null;
  warranty?: string | null;
  /** Model lineup with per-model technical overrides — "Choose your model". */
  variants?: Array<{
    photo?: string | null;
    primary?: boolean;
    code: string;
    tagline: string | null;
    overrides: Record<string, unknown>;
  }>;
  /** Same-subcategory public products for the Apple-style compare band. */
  siblings?: {
    name: string;
    slug: string;
    imageUrl?: string | null;
    values: Record<string, unknown>;
  }[];
  /* Product-page rebuild (19/09/2026). Optional so /products/preview/[slug]
     keeps working unchanged; without `sections` the hero draws no
     classification, no price and no family table. */
  productId?: string;
  slug?: string;
  audience?: ProductAudience;
  sections?: ProductDetailSections;
}

/* ── value helpers ─────────────────────────────────────────────── */

const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const getInitials = (label: string): string => {
  const cleaned = label.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const labelForOption = (field: SpecField, optionValue: string): string => {
  const found = field.options?.find((o) => o.value === optionValue);
  return found?.label ?? optionValue;
};

/* Rotating glyph set for the Apple-style advantage grid — varied large
   icons instead of one repeated spark. Tokens resolve via VisualGlyph. */
const ADVANTAGE_GLYPHS = ["spark", "automation", "check", "question", "spark", "automation"];

const selectedValuesOf = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? (raw as unknown[]).map((v) => String(v))
    : typeof raw === "string" && raw
      ? [raw]
      : [];

const displayScalar = (raw: unknown): string =>
  Array.isArray(raw) ? raw.map((v) => String(v)).join(", ") : String(raw);

const fileNameFromUrl = (url: string): string => {
  try {
    const path = url.split("?")[0].split("#")[0];
    const last = path.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : url;
  } catch {
    return url;
  }
};

const asKnowledgeList = (
  content: ProductKnowledgeBlock["content"] | undefined,
): string[] => {
  if (Array.isArray(content)) return content.map((c) => String(c));
  if (typeof content === "string") return content.trim() ? [content] : [];
  return [];
};

/* ── small presentational atoms ────────────────────────────────── */

/* Apple-style horizontal snap scroller with dot pagination. Children are
   the slides (each should be shrink-0 snap-start). Dot tracking uses
   bounding rects so it stays correct in RTL. */
const SnapCarousel = ({ children }: { children: React.ReactNode[] }) => {
  const railRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const syncDots = () => {
    const el = railRef.current;
    if (!el) return;
    const left = el.getBoundingClientRect().left;
    let best = 0;
    let bestD = Infinity;
    Array.from(el.children).forEach((kid, i) => {
      const d = Math.abs((kid as HTMLElement).getBoundingClientRect().left - left);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setIdx(best);
  };
  const goTo = (i: number) => {
    const el = railRef.current;
    const kid = el?.children[i] as HTMLElement | undefined;
    if (!el || !kid) return;
    el.scrollBy({
      left: kid.getBoundingClientRect().left - el.getBoundingClientRect().left,
      behavior: "smooth",
    });
  };
  return (
    <div className="space-y-5">
      <div
        ref={railRef}
        onScroll={syncDots}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {children.length > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {children.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all ${
                idx === i
                  ? "w-6 bg-[var(--text-primary)]"
                  : "w-2 bg-[var(--border-strong)] hover:bg-[var(--text-faint)]"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

/* Eyebrow + title section header — the single rhythm device for every
   major band so vertical pacing stays consistent. */
const SectionHead = ({
  eyebrow,
  title,
  hero,
}: {
  eyebrow?: string;
  title: string;
  /** Apple-style major section head: centered, Hub-Blue kicker, huge title. */
  hero?: boolean;
}) => hero ? (
  <div className="space-y-2 text-center">
    {eyebrow ? (
      <div className="text-[13px] md:text-[15px] font-semibold text-[#7FA9D6]">
        {eyebrow}
      </div>
    ) : null}
    <h3 className="text-4xl md:text-6xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] leading-[1.05]">
      {title}
    </h3>
  </div>
) : (
  <div className="space-y-1">
    {eyebrow ? (
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
        {eyebrow}
      </div>
    ) : null}
    <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
      {title}
    </h3>
  </div>
);

/* Progressive-disclosure section — "simple first, deep later". Layer-3
   technical groups mount collapsed; the operator expands on demand. */
const Disclosure = ({
  title,
  eyebrow,
  glyph,
  defaultOpen = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  /* Group mark from the Visual Library. Optional on purpose — a group with no
     binding shows no icon rather than a placeholder. */
  glyph?: string | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-[var(--border-subtle)] last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group w-full flex items-center justify-between gap-3 py-5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3 min-w-0">
          {glyph ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-faint)] transition-colors group-hover:text-[var(--text-secondary)]">
              <Glyph src={glyph} className="h-[18px] w-[18px]" />
            </span>
          ) : null}
          <span className="min-w-0">
            {eyebrow ? (
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                {eyebrow}
              </span>
            ) : null}
            <span className="block text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
              {title}
            </span>
          </span>
        </span>
        <span
          className={`shrink-0 text-[var(--text-ghost)] transition-transform duration-300 group-hover:text-[var(--text-secondary)] ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          {/* chevron — rotates 180° when open */}
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open ? <div className="pb-7 -mt-1">{children}</div> : null}
    </section>
  );
};

/* ── Spec glyphs ────────────────────────────────────────────────────────
   Icons come from the SAME owner-managed registry the internal profile
   reads, so an icon changed once in the Visual Library changes everywhere.
   fetchIconBindings is cached and rides the shell batch every screen already
   requests, so this costs no extra round-trip on the customer page.
   Mask-based, not <img>: the glyph inherits currentColor and stays inside the
   monochrome icon rule (no colour icons, one stroke language). */
function Glyph({ src, className = "h-4 w-4" }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current align-middle ${className}`}
      style={{
        maskImage: `url("${src}")`, maskRepeat: "no-repeat", maskPosition: "center", maskSize: "contain",
        WebkitMaskImage: `url("${src}")`, WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center", WebkitMaskSize: "contain",
      }}
    />
  );
}

/* Group titles are free text, so they resolve by MEANING, not by key: a
   "Packing & Shipping" group and a "Packing and shipping" group get the same
   box. Field icons are keyed exactly (`spec.<key>`) — those keys are canonical.

   Each rule names a Visual Library binding key FIRST and a real library path
   as the fallback, the same registry-then-fallback order the internal profile
   uses. Today the registry holds only `field.*` and `classification.*` keys
   (556 of them, no `group.*`), so every icon below comes from the fallback —
   but the moment someone binds `group.electrical` in the Visual Library, that
   choice wins here with no code change.
   The paths are ones confirmed to exist in the library; a wrong path would
   render an empty mask, i.e. silently no icon at all. */
const VL_BASE = "https://yxyizbnfjrwrnmwhkvme.supabase.co/storage/v1/object/public/media/visual-library/";
const GROUP_ICON_RULES: Array<[RegExp, string, string]> = [
  /* ORDER IS THE LOGIC — first match wins, so the specific measures come
     before the broad subject rules. "max_fabric_width" has to reach the ruler,
     not the fabric rule; "inspection_method" the eye, not performance. */
  [/inspect|detect|vision|scan|camera|sensor/i, "group.inspection", "general/security/eye.svg"],
  [/width|length|diameter|dimension|weight|size|physical/i, "group.physical", "pack/manufacturing/ruler-combined.svg"],
  [/pack|ship|logisti|carton|crate/i, "group.packing", "pack/misc/container-storage.svg"],
  [/electric|power|utilit|voltage|pneumatic|frequency|phase/i, "group.electrical", "pack/manufacturing/bolt.svg"],
  [/safe|complian|certif|standard/i, "group.compliance", "general/security/shield.svg"],
  [/perform|speed|capacit|output|precision/i, "group.performance", "general/time/timer.svg"],
  [/handl|feed|discharge|tension|transport|roll/i, "group.handling", "general/inventory/pallet.svg"],
  [/option|equipment|accessor|configur/i, "group.options", "pack/actions/settings-sliders.svg"],
  [/type|applicat|categor|material|fabric/i, "group.type", "pack/actions/layers.svg"],
];

function useSpecGlyphs() {
  const [bindings, setBindings] = useState<BindingsMap>({});
  useEffect(() => {
    let alive = true;
    fetchIconBindings()
      .then((b) => { if (alive) setBindings(b); })
      .catch(() => { /* the page reads fine without glyphs */ });
    return () => { alive = false; };
  }, []);
  /* A spec field resolves by its own key first; failing that it borrows its
     group's meaning from the label, so "Max Fabric Width" still gets the ruler
     even though no `spec.max_fabric_width` binding exists yet. */
  const fieldGlyph = useCallback(
    (key: string, label?: string) => {
      const direct = bindings[`spec.${key}`] || bindings[`field.${key}`];
      if (direct) return direct;
      const hay = `${key} ${label ?? ""}`;
      for (const [re, k, fallback] of GROUP_ICON_RULES) {
        if (re.test(hay)) return bindings[k] || VL_BASE + fallback;
      }
      return null;
    },
    [bindings],
  );
  const groupGlyph = useCallback((title: string) => {
    for (const [re, k, fallback] of GROUP_ICON_RULES) {
      if (re.test(title)) return bindings[k] || VL_BASE + fallback;
    }
    return null;
  }, [bindings]);
  return { fieldGlyph, groupGlyph };
}

/* Frozen, so the hook's dependency does not change identity every render
   while English is showing. */
const EMPTY_SPEC_I18N: Translations = Object.freeze({}) as Translations;

export const ProductPreview = (props: ProductPreviewProps) => {
  const { t, lang } = useTranslation(PRODUCTS_PREVIEW_I18N);
  /* Spec content (group titles, field labels, option labels) is localized by
     the same dictionary the admin Specs editor uses. It used to be admin-only,
     so the CUSTOMER page rendered every spec in English even in zh/ar — the
     translations existed and were simply never read here.

     ⚠️ ENGLISH DOES NOT LOAD IT, AND ENGLISH IS NOT MISSING ANYTHING.
     spec-i18n is 1,688 keys x 3 languages — 445 KB of source — holding spec
     labels for EVERY machine kind in the catalogue, downloaded to render one
     product. 95% of its English is the schema's own label repeated back.

     The other 5% was worse than redundant: `ts(key, fallback)` prefers the
     dictionary, so wherever the two disagreed the dictionary OVERRODE the
     schema. `f:power_consumption_w` is one slot, and six schemas label it
     "Power Consumption" / "Total Installed Power" / "Suction Motor Power" /
     "Drive Motor" / "Total Power" / "Power" — all six rendered as "Motor
     Power" on the live site. `o:large` flattened "Large Format" on a spreader
     and "Large Hook" on a sewing machine into "Large". 61 distinct labels were
     being covered this way.

     Owner's call (17/09/2026): the SCHEMA wins in English. So English reads
     the fallback — which is the schema's own, more specific label — and the
     dictionary is fetched only for zh/ar, where it is the only source of the
     translation. An empty dictionary makes `t(key, fallback)` return the
     fallback, so English needs no branch beyond never loading the file. */
  const [specDict, setSpecDict] = useState<Translations | null>(null);
  useEffect(() => {
    if (lang === "en") return;            // the schema is already the answer
    let alive = true;
    void import("@/lib/product-schema/spec-i18n")
      .then((m) => { if (alive) setSpecDict(m.SPEC_I18N); })
      .catch(() => { /* a failed fetch leaves the English labels up, not a blank */ });
    return () => { alive = false; };
  }, [lang]);
  const { t: ts } = useTranslation(specDict ?? EMPTY_SPEC_I18N);
  const { fieldGlyph, groupGlyph } = useSpecGlyphs();
  const {
    productName,
    primaryModel,
    tagline,
    posterUrl,
    translations,
    brand,
    schema: rawSchema,
    values: familyValues,
    knowledge,
    mainImageUrl,
    galleryUrls,
    mediaCounts,
    surface,
    videoUrls,
    manuals,
    ar3dUrl,
    countryOfOrigin,
    warranty,
    variants,
    siblings,
    productId,
    slug,
    sections,
    audience,
  } = props;
  /* The website reader (phase 7). No session, no Hub tools: Ask AI is not
     offered, and Quote becomes a written request to the company inbox —
     the one path that works without an account. */
  const isPublicReader = audience === "public";

  /* Localize the schema ONCE, at the source: every downstream read of
     group.title / f.label / option.label then shows the reader's language
     without touching the ~18 render sites. Keys and stored values stay
     canonical English — this is display only.
     Option keys are FIELD-SCOPED first (`o:<field>.<value>`) then shared
     (`o:<value>`), the same order the admin editor uses: two fields can
     legitimately share a value and mean different things (a `single` head
     count once rendered as "single phase" in zh/ar). */
  const schema = useMemo(() => {
    if (!rawSchema?.groups) return rawSchema;
    return {
      ...rawSchema,
      groups: rawSchema.groups.map((g) => ({
        ...g,
        title: ts(`g:${g.title}`, g.title),
        fields: (g.fields ?? []).map((f) => ({
          ...f,
          label: ts(`f:${f.key}`, f.label ?? f.key),
          options: f.options?.map((o) => ({
            ...o,
            label: ts(`o:${f.key}.${o.value}`, ts(`o:${o.value}`, o.label)),
          })),
        })),
      })),
    };
  }, [rawSchema, ts]);

  /* Localized overlay: when the active language has a filled-in
     translation, show it; otherwise fall back to the English base.
     English (lang === "en") always uses the base props. */
  const localized = (translations ?? []).find((tr) => tr.locale === lang) ?? null;
  const displayName = (localized?.product_name || "").trim() || productName;
  const displayTagline = (localized?.tagline || "").trim() || tagline;

  const effectiveSurface: ProductSchemaSurface = surface ?? "website";

  /* ?model= deep-link (family chips / search) — highlight that row in the
     lineup table. Read-once from location; server render sees null and the
     client adds the highlight after hydration, which is exactly when the
     visitor can perceive it. */
  const wantedModel = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const v = new URLSearchParams(window.location.search).get("model");
      return v ? v.trim().toLowerCase() : null;
    } catch { return null; }
  }, []);

  /* ── Selected member ── clicking a lineup row points the WHOLE page at
     that model: the spec sheet re-resolves (family ⊕ overrides), the hero
     code and photo follow. ?model= pre-selects (chips / search links). */
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  /* Seed ONCE: a ?model= deep-link wins; otherwise the PRIMARY member is
     the page's opening state — the family's headline machine is what a
     visitor sees first. The ref keeps a manual unselect from being
     re-seeded on the next render. */
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const list = variants ?? [];
    if (list.length === 0) return;
    const linked = wantedModel ? list.find((v) => v.code.trim().toLowerCase() === wantedModel) : null;
    const prim = list.find((v) => v.primary) ?? null;
    const seed = linked ?? prim;
    if (seed) setSelectedCode(seed.code);
    seededRef.current = true;
  }, [wantedModel, variants]);
  const activeVariant = useMemo(
    () => (variants ?? []).find((v) => v.code === selectedCode) ?? null,
    [variants, selectedCode],
  );

  /* ── Sticky-pill scroll spy ──────────────────────────────────────────
     The pill's three anchors always scrolled correctly, but Gallery was
     hard-styled as the filled pill, so it read as "selected" no matter
     where the reader was — click Specs, Gallery stays lit, and the bar
     looks like broken tabs. Track which section owns the viewport and
     light THAT one. IntersectionObserver watches the viewport, so it is
     immune to the app shell scrolling an inner container rather than the
     document (a plain scroll listener on window would never fire here). */
  const [activeSection, setActiveSection] = useState<string>("overview");
  useEffect(() => {
    const ids = ["overview", "specs", "gallery"];
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((n): n is HTMLElement => !!n);
    if (nodes.length === 0) return;
    /* Top-biased band: a section counts as current once its top passes
       under the pinned header, so the highlight flips as a heading
       arrives rather than when the section happens to fill the screen. */
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit?.target.id) setActiveSection(hit.target.id);
      },
      { rootMargin: "-120px 0px -65% 0px", threshold: 0 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [surface]);
  /* Every consumer below reads `values` — the RESOLVED view of whichever
     member is selected; no selection = the family baseline. */
  const values = useMemo(
    () => (activeVariant ? { ...familyValues, ...activeVariant.overrides } : familyValues),
    [familyValues, activeVariant],
  );

  /* ── Apple-style scroll choreography ──
     One IntersectionObserver arms every top-level band: sections drift up
     and fade in as the reader reaches them (.kx-rev/.kx-rev-in in
     globals.css). Transform+opacity only (no layout, no CLS), skipped
     entirely for prefers-reduced-motion. The sticky product pill is a
     plain div sibling so it is never transformed (sticky would break). */
  const flowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = flowRef.current;
    if (!root) return;
    const kids = Array.from(root.children).filter(
      (el) => el.tagName === "SECTION" || el.hasAttribute("data-reveal"),
    );
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    kids.forEach((el) => el.classList.add("kx-rev"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("kx-rev-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );
    kids.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* First uploaded video doubles as the living hero (Apple product film).
     Falls back to the still poster when the product has no video. */
  const heroVideoUrl =
    (videoUrls ?? []).find((u) => /\.(mp4|webm|mov)(\?|$)/i.test(u)) ?? null;

  const visibleFields = useMemo<SpecField[]>(() => {
    if (!schema) return [];
    return filterFieldsForSurface(schema.groups.flatMap((g) => g.fields), effectiveSurface);
  }, [schema, effectiveSurface]);

  const visibleFieldKeys = useMemo(
    () => new Set(visibleFields.map((f) => f.key)),
    [visibleFields],
  );

  const visibleKnowledge = useMemo(
    () => filterKnowledgeForSurface(knowledge, effectiveSurface),
    [knowledge, effectiveSurface],
  );

  // key → group id (drives emphasis + automation/compliance split)
  const fieldGroupId = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of schema?.groups ?? []) {
      for (const f of g.fields) m.set(f.key, g.id);
    }
    return m;
  }, [schema]);

  const isEmptyState =
    !schema &&
    Object.keys(values || {}).length === 0 &&
    (!knowledge || knowledge.length === 0);

  /* ── derived: knowledge by type ── */
  const kbByType = useMemo(() => {
    const m = new Map<string, ProductKnowledgeBlock[]>();
    for (const b of visibleKnowledge) {
      /* Overlay the reader's language when the block carries it; English
         stays the fallback so a half-translated product still reads. One
         swap here covers every knowledge surface below (hero chips,
         highlights deck, overview, applications, FAQ …). */
      const loc = lang === "en"
        ? b
        : {
            ...b,
            title: b.title_i18n?.[lang]?.trim() || b.title,
            content: (() => {
              const c = b.content_i18n?.[lang];
              if (Array.isArray(c)) return c.length ? c : b.content;
              return typeof c === "string" && c.trim() ? c : b.content;
            })(),
          };
      const arr = m.get(b.type) ?? [];
      arr.push(loc);
      m.set(b.type, arr);
    }
    return m;
  }, [visibleKnowledge, lang]);
  const firstKb = (t: string) => kbByType.get(t)?.[0];

  /* ── derived: anchors (schema-driven importance — any field type) ──
       Quiet groups (compliance/customs/fulfillment) never auto-anchor.
       Split into a prominent CORE band + a compact SECONDARY chip row. */
  const anchors = useMemo(
    () =>
      collectAnchors(visibleFields, values, {
        limit: 10,
        groupOf: (k) => fieldGroupId.get(k),
        isQuietGroup: (k) => emphasisForGroup(fieldGroupId.get(k) ?? "") === "quiet",
      }),
    [visibleFields, values, fieldGroupId],
  );
  const coreAnchors = anchors.slice(0, 6);
  const secondaryAnchors = anchors.slice(6);
  const anchorKeys = useMemo(() => new Set(anchors.map((a) => a.field.key)), [anchors]);

  /* ── LAYER 2: Smart Intelligence — interpreted, benefit-oriented
       summaries (schema-driven via field.insight). Any field carrying an
       insight surfaces here; ordered by anchor priority when it is also an
       anchor, else appended. Generic — zero product-specific logic. */
  /* Feature-explorer active chip (Apple 'Take a closer look'). */
  const [explorerIdx, setExplorerIdx] = useState(0);
  /* Compare band — which sibling is selected (Apple 'Worth the upgrade?'). */
  const [compareIdx, setCompareIdx] = useState(0);

  /* Human display for any field value — option labels, joined multis,
     localized booleans, units. Shared by the compare band. */
  const displayFieldValue = (f: SpecField, raw: unknown): string => {
    if (isEmptyValue(raw)) return "—";
    if (Array.isArray(raw))
      return raw
        .map((v) => f.options?.find((o) => o.value === String(v))?.label ?? String(v))
        .join(", ");
    if (typeof raw === "string") return f.options?.find((o) => o.value === raw)?.label ?? raw;
    if (typeof raw === "boolean") return raw ? t("preview.yes", "Yes") : t("preview.no", "No");
    return `${displayScalar(raw)}${f.unit ? " " + f.unit : ""}`;
  };

  const intelligence = useMemo(() => {
    const seen = new Set<string>();
    const items: { key: string; label: string; headline: string; insight: string }[] = [];
    const pushField = (f: SpecField) => {
      if (!f.insight || seen.has(f.key) || isEmptyValue(values[f.key])) return;
      seen.add(f.key);
      const raw = values[f.key];
      const single = typeof raw === "string" ? raw : selectedValuesOf(raw)[0] ?? "";
      const opt = f.options?.find((o) => o.value === single);
      const headline =
        f.fieldType === "boolean"
          ? (f.label ?? f.key)
          : opt?.label ?? `${displayScalar(raw)}${f.unit ? " " + f.unit : ""}`;
      items.push({ key: f.key, label: f.label ?? f.key, headline, insight: f.insight });
    };
    // anchored insights first (priority order), then any other insight fields
    anchors.forEach((a) => pushField(a.field));
    visibleFields.forEach(pushField);
    return items;
  }, [anchors, visibleFields, values]);

  /* ── derived: booleans split by group (anchored ones excluded) ── */
  const trueBooleans = visibleFields.filter(
    (f) =>
      f.visualRenderType === "boolean_feature" &&
      values[f.key] === true &&
      !anchorKeys.has(f.key),
  );
  const automationFeatures = trueBooleans.filter(
    (f) => fieldGroupId.get(f.key) === "automation",
  );
  const complianceFeatures = trueBooleans.filter((f) => {
    const g = fieldGroupId.get(f.key);
    return g === "compliance" || g === "customs";
  });
  const otherFeatures = trueBooleans.filter(
    (f) => !automationFeatures.includes(f) && !complianceFeatures.includes(f),
  );

  /* ── derived: material + application cards ──
     Flattened to a single de-duplicated list of {field, value} so the same
     option label can't surface twice (e.g. "Shirts" from two fields). */
  type VisualPick = { field: SpecField; value: string; label: string };
  const flattenPicks = (renderType: string): VisualPick[] => {
    const seen = new Set<string>();
    const out: VisualPick[] = [];
    for (const field of visibleFields.filter((f) => f.visualRenderType === renderType)) {
      for (const value of selectedValuesOf(values[field.key])) {
        const label = labelForOption(field, value);
        const dedupeKey = label.trim().toLowerCase();
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        out.push({ field, value, label });
      }
    }
    return out;
  };
  const materialPicks = flattenPicks("material_card");
  const applicationPicks = flattenPicks("application_card");

  /* ── derived: grouped spec sections (excluding fields rendered in
       dedicated bands above), carrying their emphasis tier ── */
  const dedicatedRenderTypes = new Set([
    "boolean_feature",
    "material_card",
    "application_card",
    "metric_block", // promoted into the anchors strip
    "gallery_block",
    "packing_block",
    "download_block",
    "ai_fact",
    "brochure_block",
  ]);

  const specGroups = (schema?.groups ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((group) => {
      const fields = group.fields
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .filter(
          (f) =>
            visibleFieldKeys.has(f.key) &&
            !dedicatedRenderTypes.has(f.visualRenderType) &&
            !anchorKeys.has(f.key) &&
            !isEmptyValue(values[f.key]),
        );
      return { group, fields, emphasis: emphasisForGroup(group.id) };
    })
    .filter((b) => b.fields.length > 0);

  /* ── derived: hero highlight chips (from key_features) ── */
  /* ── Hero plumbing ──
     The family table's difference columns read the members' overrides by
     CODE; labels and values are formatted by the same rules as the spec
     sheet below, so a figure never reads differently in the two places. */
  const overridesByCode = useMemo(() => {
    const out: Record<string, Record<string, unknown>> = {};
    for (const v of variants ?? []) out[v.code] = v.overrides ?? {};
    return out;
  }, [variants]);
  const fieldByKey = useMemo(() => new Map(visibleFields.map((f) => [f.key, f] as const)), [visibleFields]);
  const heroFieldLabel = useCallback((key: string) => fieldByKey.get(key)?.label ?? key, [fieldByKey]);
  const heroFormatValue = useCallback((key: string, raw: unknown): string => {
    const f = fieldByKey.get(key);
    let display: string;
    if (Array.isArray(raw)) {
      display = raw.map((v) => f?.options?.find((o) => o.value === String(v))?.label ?? String(v)).join(", ");
    } else if (typeof raw === "string") {
      display = f?.options?.find((o) => o.value === raw)?.label ?? raw;
    } else if (typeof raw === "boolean") {
      display = raw ? t("preview.yes", "Yes") : t("preview.no", "No");
    } else {
      display = displayScalar(raw);
    }
    return f?.unit && display ? `${display} ${f.unit}` : display;
  }, [fieldByKey, t]);

  /* The three actions. Ask AI opens the floating panel on the AI tab with
     the product already in the composer (placed, never sent). Compare
     scrolls to the on-page compare band. Quote announces the product to
     whichever quotation flow listens — the flow itself is the owner's to
     specify (same contract as the catalogue card). */
  const onHeroAction = useCallback((action: HeroAction, modelCode?: string) => {
    if (typeof window === "undefined") return;
    const subject = modelCode ? `${displayName} (${modelCode})` : displayName;
    if (action === "ask_ai") {
      window.dispatchEvent(new CustomEvent("koleex:ai-open", {
        detail: {
          draft: `${t("preview.heroAiDraft", "Tell me about")} ${subject}`,
          hints: [{ key: `product:${productId ?? slug ?? subject}`, text: subject, severity: "info" }],
        },
      }));
      return;
    }
    if (action === "compare") {
      document.getElementById("kx-compare-pick")?.closest("section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (isPublicReader) {
      const model = modelCode ?? primaryModel ?? "";
      const subject = encodeURIComponent(`Quotation request: ${displayName}${model ? ` (${model})` : ""}`);
      const body = encodeURIComponent(`${displayName}${model ? ` — ${model}` : ""}\n${typeof window !== "undefined" ? window.location.href : ""}\n\n`);
      window.location.href = `mailto:${KOLEEX_COMPANY.email}?subject=${subject}&body=${body}`;
      return;
    }
    window.dispatchEvent(new CustomEvent("koleex:quote-product", {
      detail: { productId: productId ?? null, slug: slug ?? null, name: displayName, model: modelCode ?? primaryModel ?? null },
    }));
  }, [displayName, primaryModel, productId, slug, t, isPublicReader]);

  /* ── media flags ── */
  const hasGallery = Array.isArray(galleryUrls) && galleryUrls.length > 0;
  const hasVideos = Array.isArray(videoUrls) && videoUrls.length > 0;
  const hasManuals = Array.isArray(manuals) && manuals.length > 0;

  const machineKindLabel = schema?.name ?? null;

  /* A product without a template used to bounce to an empty-state box
     ("no schema for this classification"). The hero, highlights, knowledge,
     options, packing and compliance never needed the schema; only the spec
     sheet does, and it simply does not render. `isEmptyState` stays as a
     signal for the sticky pill (no specs anchor to offer). */

  return (
    <div ref={flowRef} className="space-y-20 md:space-y-36 pb-24">
      {/* ═══ HERO (rebuild phase 1) — poster when there is one, identity,
          the photo big and clear, the Global FOB, the family table and the
          three actions. Everything it shows arrived with the server props. */}
      <ProductHero
        name={displayName || t("preview.untitledProduct", "Untitled product")}
        model={primaryModel ?? null}
        tagline={displayTagline ?? null}
        excerpt={(localized?.excerpt || "").trim() || sections?.excerpt || null}
        brand={brand ?? null}
        classification={sections?.classification ?? { division: null, category: null, subcategory: null }}
        lang={lang}
        posterUrl={posterUrl ?? null}
        videoUrl={heroVideoUrl}
        image={mainImageUrl ?? null}
        models={sections?.models ?? []}
        overridesByCode={overridesByCode}
        fieldLabel={heroFieldLabel}
        formatValue={heroFormatValue}
        fob={sections?.fob ?? null}
        selectedCode={selectedCode}
        onSelectModel={(code) => setSelectedCode((prev) => (prev === code ? null : code))}
        canCompare={(siblings ?? []).length > 0}
        showAskAi={!isPublicReader}
        onAction={onHeroAction}
        t={t}
      />

      {/* ── Sticky product pill (Apple pattern): the product's own bar —
          name at the start, section anchors at the end. Lives BELOW the
          hero (owner rule: nothing overlays the header photo) and pins
          under the hub header once the reader scrolls past it. */}
      <div className="sticky top-2 z-30 -mb-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/90 px-5 py-2.5 shadow-lg backdrop-blur-xl">
          <span className="truncate text-[14px] font-semibold text-[var(--text-primary)]">
            {displayName || productName}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {([
              { id: "overview", label: t("preview.stickyOverview", "Overview") },
              { id: "specs", label: t("preview.stickySpecs", "Specs") },
              { id: "gallery", label: t("preview.stickyGallery", "Gallery") },
            ] as const).map((s) => {
              const isActive = activeSection === s.id;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => setActiveSection(s.id)}
                  className={`items-center rounded-full py-1.5 text-[12px] transition-all ${
                    /* Gallery stays visible on phones — the other two are the
                       first to go when the pill runs out of room. */
                    s.id === "gallery" ? "inline-flex" : "hidden sm:inline-flex"
                  } ${
                    isActive
                      ? "bg-[var(--bg-inverted)] px-4 font-semibold text-[var(--text-inverted)] hover:opacity-90"
                      : "px-3 font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {s.label}
                </a>
              );
            })}
          </span>
        </div>
      </div>

      {/* Anchor target for the poster "Learn more" CTA. */}
      <div id="overview" className="scroll-mt-32" />

      {/* ═══ 2. AT A GLANCE — airy, glyph-forward stat band (no table lines) ═══ */}
      {coreAnchors.length > 0 ? (
        <section className="border-y border-[var(--border-subtle)]">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-[var(--border-subtle)]">
            {coreAnchors.map(({ field: f, kind }) => {
              const raw = values[f.key];
              let value = "";
              let unit = "";
              let big = true;
              let meterPct: number | null = null;

              if (kind === "metric") {
                {
                  const n = typeof raw === "number" ? raw : Number(raw);
                  const mx = f.validation?.max;
                  if (Number.isFinite(n) && typeof mx === "number" && mx > 0) {
                    meterPct = Math.max(4, Math.min(100, Math.round((n / mx) * 100)));
                  }
                }
                value = displayScalar(raw);
                unit = f.unit ?? "";
              } else if (kind === "boolean") {
                value = f.label ?? f.key;
                big = false;
              } else {
                const single = typeof raw === "string" ? raw : selectedValuesOf(raw)[0] ?? "";
                const opt = f.options?.find((o) => o.value === single);
                value = opt?.label ?? displayScalar(raw);
                big = false;
              }

              const glyph = fieldGlyph(f.key, f.label);
              return (
                <div key={f.key} className="flex min-h-[7.5rem] flex-col justify-between gap-3 px-5 py-7 md:py-9">
                  {/* The glyph names the measure before the number is read —
                      the band is the page's opening claim, so it has to be
                      scannable without the caption. Absent binding = no icon,
                      never a placeholder box. */}
                  {glyph ? <Glyph src={glyph} className="h-5 w-5 text-[var(--text-faint)]" /> : null}
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={
                        big
                          ? "text-3xl leading-none font-semibold tracking-[-0.02em] text-[var(--text-primary)] md:text-[2.5rem]"
                          : "text-lg leading-tight font-semibold tracking-tight text-[var(--text-primary)] md:text-xl"
                      }
                    >
                      {value}
                    </span>
                    {unit ? <span className="text-sm font-medium text-[var(--text-faint)]">{unit}</span> : null}
                  </div>
                  <div className="space-y-2">
                    {meterPct !== null ? (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                        <div className="h-full rounded-full bg-[#567FB2] transition-all" style={{ width: `${meterPct}%` }} />
                      </div>
                    ) : null}
                    {(f.label ?? f.key).trim().toLowerCase() !== value.trim().toLowerCase() ? (
                      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-faint)]">
                        {f.label ?? f.key}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* secondary anchors — quiet caption row */}
          {secondaryAnchors.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-[var(--border-subtle)] px-5 py-4">
              {secondaryAnchors.map(({ field: f, kind }) => {
                const raw = values[f.key];
                let label = f.label ?? f.key;
                if (kind === "boolean") {
                  label = t("preview.yes", "Yes");
                } else if (kind === "badge") {
                  const single = typeof raw === "string" ? raw : selectedValuesOf(raw)[0] ?? "";
                  const option = f.options?.find((o) => o.value === single);
                  label = option?.label ?? displayScalar(raw);
                } else {
                  label = `${displayScalar(raw)}${f.unit ? " " + f.unit : ""}`;
                }
                return (
                  <span key={f.key} className="text-[12px]">
                    <span className="text-[var(--text-faint)]">{f.label ?? f.key}</span>
                    <span className="ms-2 font-medium text-[var(--text-primary)]">{label}</span>
                  </span>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ═══ HIGHLIGHTS (rebuild phase 2) — the photo cards with title and
          description, then the highlight bullets. Product Data's own
          "Main Devices & Functions" and "Key Highlights", in that order. */}
      <ProductHighlights
        cards={sections?.featureCards ?? []}
        bullets={sections?.highlights ?? []}
        t={t}
      />

      {/* ═══ 4. MATERIALS ═══ */}
      {materialPicks.length > 0 ? (
        <section className="space-y-6">
          <SectionHead eyebrow={t("preview.eyebrowCapability", "Capability")} title={t("preview.suitableMaterials", "Suitable Materials")} />
          {/* Filmstrip — large material swatches, horizontally scrollable. */}
          <div className="flex gap-5 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {materialPicks.map(({ field, value: val, label }) => {
                const option = field.options?.find((o) => o.value === val);
                const visual = resolveOptionVisual(field, option, val);
                return (
                  <div
                    key={`${field.key}-${val}`}
                    className="snap-start shrink-0 w-40 md:w-44"
                    title={visual.description ?? label}
                  >
                    <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl">
                      {option?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={IMG.card(option.image)} alt={label} className="h-full w-full object-cover" />
                      ) : visual.swatch ? (
                        <div
                          className="h-full w-full"
                          style={{
                            backgroundColor: visual.swatch,
                            backgroundImage:
                              "repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0 2px, transparent 2px 5px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.07) 0 2px, transparent 2px 5px)",
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[var(--bg-surface-subtle)] font-mono font-bold text-2xl text-[var(--text-primary)]">
                          {getInitials(label)}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{label}</div>
                    {visual.description ? (
                      <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-ghost)]">
                        {visual.description}
                      </div>
                    ) : null}
                  </div>
                );
            })}
          </div>
        </section>
      ) : null}

      {/* ═══ 5. APPLICATIONS ═══ */}
      {applicationPicks.length > 0 ? (
        <section className="space-y-6">
          <SectionHead eyebrow={t("preview.eyebrowBuiltFor", "Built for")} title={t("preview.applications", "Applications")} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {applicationPicks.map(({ field, value: val, label }) => {
                const option = field.options?.find((o) => o.value === val);
                const visual = resolveOptionVisual(field, option, val);
                return (
                  <div
                    key={`${field.key}-${val}`}
                    className="flex items-center gap-3 rounded-2xl bg-[var(--bg-surface-subtle)] px-4 py-3.5"
                    title={visual.description ?? label}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                      {visual.icon ? (
                        <VisualGlyph token={visual.icon} className="h-5 w-5" />
                      ) : (
                        <span className="font-mono text-xs font-bold">{getInitials(label)}</span>
                      )}
                    </span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
                  </div>
                );
            })}
          </div>
        </section>
      ) : null}

      {/* ═══ 6. AUTOMATION — workflow row (connected nodes) ═══ */}
      {automationFeatures.length > 0 ? (
        <section className="space-y-5">
          <SectionHead eyebrow={t("preview.eyebrowHandsOff", "Hands-off")} title={t("preview.automationWorkflow", "Automation workflow")} />
          <div className="relative overflow-x-auto pb-1">
            <div className="relative min-w-[460px]">
              {/* connector line running through the node centers (h-14 → 28px) */}
              <div className="absolute left-10 right-10 top-10 h-px bg-[var(--border-subtle)]" />
              <div className="relative flex justify-between gap-3">
                {automationFeatures.map((f, i) => (
                  <div key={f.key} className="flex flex-1 flex-col items-center text-center gap-2.5">
                    <span className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                      <VisualGlyph token="automation" className="h-8 w-8" />
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--text-primary)] text-[9px] font-bold text-[var(--text-inverted)]">
                        {i + 1}
                      </span>
                    </span>
                    <span className="text-[12px] font-medium leading-snug text-[var(--text-primary)] max-w-[120px]">
                      {f.label ?? f.key}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══ THE TECHNICAL SPINE — pinned media, scrolling detail ═══
          Owner direction (2026-09-04): the reader must never lose sight of the
          machine while working through its record. XPRI-01 alone carries seven
          spec groups plus features, Q&A, safety and warranty; read as a single
          column, a buyer four screens into Electrical has long lost the thing
          they are reading about.
          The rail pins the photo, its gallery and the model roster while every
          section below scrolls past it. One column below lg — sticky on a phone
          would eat the screen the detail needs. */}
      {/* A FIXED rail track, not minmax(0,320px): a flexible lower bound let the
          rail collapse to 60px at 1024 — the photo became a sliver — because the
          spec tables happily claimed the rest. The rail's job is to hold a
          readable photo, so its width is not negotiable; only the detail column
          flexes. */}
      <div className="md:grid md:grid-cols-[236px_minmax(0,1fr)] lg:grid-cols-[288px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] md:gap-8 lg:gap-12 xl:gap-20 md:items-start">
        {/* From md, not lg. Gating the spine at 1024 meant a 900px laptop — and
            the preview pane itself — saw the OLD single column and nothing of
            this design at all. The rail narrows to 236px there instead of
            disappearing; below md it does step out, where a sticky column
            would eat the screen the detail needs. */}
        <aside className="hidden md:flex md:sticky md:top-24 flex-col gap-4 lg:gap-5">
          {mainImageUrl ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={IMG.row(mainImageUrl)}
                alt={displayName || productName}
                className="aspect-[4/3] w-full object-contain p-4"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : null}

          {(galleryUrls ?? []).length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {(galleryUrls ?? []).slice(0, 4).map((u, i) => (
                <div key={`${u}-${i}`} className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={IMG.thumb(u)} alt="" className="aspect-square w-full object-contain p-1.5" loading="lazy" decoding="async" />
                </div>
              ))}
            </div>
          ) : null}

          <div className="border-t border-[var(--border-subtle)] pt-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
              {primaryModel ? t("preview.model", "Model") : null}
            </div>
            <div className="mt-1 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
              {primaryModel || displayName || productName}
            </div>
          </div>

          {/* The family roster stays reachable from the rail: a reader deep in
              the specs can switch member without scrolling back up. */}
          {(variants ?? []).length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {(variants ?? []).map((v) => (
                <button
                  key={v.code}
                  type="button"
                  onClick={() => setSelectedCode(v.code)}
                  aria-pressed={v.code === selectedCode}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold tabular-nums tracking-tight transition-colors ${
                    v.code === selectedCode
                      ? "border-[var(--accent,#0066FF)] text-[var(--accent,#0066FF)]"
                      : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {v.code}
                </button>
              ))}
            </div>
          ) : null}

          {warranty || countryOfOrigin ? (
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border-subtle)] pt-4">
              {warranty ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                    {t("preview.warranty", "Warranty")}
                  </div>
                  <div className="mt-0.5 text-[13px] font-medium text-[var(--text-primary)]">{warranty}</div>
                </div>
              ) : null}
              {countryOfOrigin ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                    {t("preview.origin", "Origin")}
                  </div>
                  <div className="mt-0.5 text-[13px] font-medium text-[var(--text-primary)]">{countryOfOrigin}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>

        <div className="space-y-16 md:space-y-24 min-w-0">

      {/* ═══ BASIC FACTS — a product without a spec template (schema null)
          shows its typed legacy columns here, where the spec sheet would
          be: voltage, power, weight, dimensions. Empty when a template
          exists; the schema then owns these facts. ═══ */}
      {(sections?.legacyFacts ?? []).length > 0 ? (
        <section className="space-y-4">
          <SectionHead eyebrow={t("preview.eyebrowLayer3", "In depth")} title={t("preview.technicalSpecifications", "Technical Specifications")} />
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 max-w-3xl">
            {(sections?.legacyFacts ?? []).map((f) => (
              <div key={f.key} className="flex justify-between gap-4 border-b border-[var(--border-subtle)] py-2.5 text-sm">
                <dt className="text-[var(--text-ghost)]">{t(`preview.fact.${f.key}`, { voltage: "Voltage", power: "Power", weight: "Weight", dimensions: "Dimensions" }[f.key])}</dt>
                <dd className="font-medium text-[var(--text-primary)] text-end">{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* ═══ LAYER 3 — ADVANCED TECHNICAL DATA (progressive disclosure) ═══
          Primary groups open by default; standard/quiet collapsed so the
          page reads simple-first, deep-on-demand. */}
      {specGroups.length > 0 ? (

        <div id="specs" data-reveal className="scroll-mt-32">
          <SectionHead hero eyebrow={t("preview.eyebrowLayer3", "In depth")} title={t("preview.technicalSpecifications", "Technical Specifications")} />
          <div className="mt-3 border-t border-[var(--border-subtle)]">
          {specGroups.map(({ group, fields, emphasis }) => (
            <Disclosure
              key={group.id}
              title={group.title}
              eyebrow={emphasis === "primary" ? t("preview.eyebrowCore", "Core") : undefined}
              glyph={groupGlyph(group.title)}
              defaultOpen={emphasis === "primary"}
            >
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {fields.map((f) => {
                    const raw = values[f.key];
                    // Resolve a human display value: option labels for
                    // single/multi selects, joined; else the raw scalar.
                    let display: string;
                    if (Array.isArray(raw)) {
                      display = raw
                        .map((v) => f.options?.find((o) => o.value === String(v))?.label ?? String(v))
                        .join(", ");
                    } else if (typeof raw === "string") {
                      display = f.options?.find((o) => o.value === raw)?.label ?? raw;
                    } else if (typeof raw === "boolean") {
                      display = raw ? t("preview.yes", "Yes") : t("preview.no", "No");
                    } else {
                      display = displayScalar(raw);
                    }
                    return (
                      <tr key={f.key} className="border-b border-[var(--border-subtle)] last:border-0">
                        <th
                          scope="row"
                          className="w-[45%] py-3 pe-4 text-start align-top font-normal text-[var(--text-ghost)]"
                        >
                          {f.label ?? f.key}
                        </th>
                        <td className="py-3 align-top font-medium text-[var(--text-primary)]">
                          {display}
                          {f.unit ? (
                            <span className="ms-1 text-xs font-normal text-[var(--text-ghost)]">{f.unit}</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Disclosure>
          ))}
          </div>
        </div>
      ) : null}

      {/* ═══ KNOWLEDGE (rebuild phase 2) — the public knowledge blocks,
          AFTER the specifications (owner order: Highlights → Specs →
          Knowledge). Selling points, advantages, overview, intelligence,
          features, buyer questions, safety, what's included. ═══ */}
      {/* ═══ 3. HIGHLIGHTS — Apple "Get the highlights." snap carousel:
          the strongest claims as swipeable cards, each closing on a shot
          of the machine. Dots paginate; the rail scrolls free. ═══ */}
      {(() => {
        const points = [
          ...asKnowledgeList(firstKb("selling_points")?.content),
          ...asKnowledgeList(firstKb("technical_advantages")?.content),
        ].slice(0, 5);
        /* Owner rule (2026-08-29): a card shows a photo only when that photo
           belongs to it. These points come from the knowledge lists, which
           carry no image of their own — the deck used to borrow gallery and
           main-render shots by index, pairing e.g. a detection-accuracy claim
           with whatever photo landed at that position. Text-only cards
           instead; per-highlight photos live in the Highlights tab. */
        if (points.length < 2) return null;
        return (
          <section className="space-y-8">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {t("preview.getHighlights", "Get the highlights.")}
            </h2>
            <SnapCarousel>
              {points.map((point, i) => {
                // Apple shop-card anatomy: bold claim on the card surface,
                // supporting clause below it.
                // Theme-aware surface so it reads right in light AND dark.
                const parts = point.split(/\s+—\s+/);
                const head = parts[0];
                const body = parts.slice(1).join(" — ");
                return (
                  <div
                    key={i}
                    /* Text-only deck: sized to the copy (a photo-height box
                       with no photo left a tall empty card). */
                    className="flex min-h-[260px] w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-[28px] bg-[var(--bg-surface-subtle)] sm:w-[440px]"
                  >
                    <div className="p-7 md:p-8">
                      <h3 className="text-xl md:text-[24px] font-semibold leading-snug tracking-[-0.01em] text-[var(--text-primary)]">
                        {head}
                        {/[.!?]$/.test(head) ? "" : "."}
                      </h3>
                      {body ? (
                        <p className="mt-3 text-[14px] md:text-[15px] leading-relaxed text-[var(--text-secondary)]">
                          {body.charAt(0).toUpperCase() + body.slice(1)}
                          {/[.!?]$/.test(body) ? "" : "."}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </SnapCarousel>
          </section>
        );
      })()}

      {/* ═══ 3b. PERFORMANCE STATEMENT — Apple gradient headline built from
          the schema's own top metrics (no hardcoded copy). ═══ */}
      {(() => {
        const metrics = coreAnchors
          .filter(({ kind, field: f }) => kind === "metric" && !isEmptyValue(values[f.key]))
          .slice(0, 3)
          .map(({ field: f }) => `${displayScalar(values[f.key])}${f.unit ? " " + f.unit : ""}`);
        if (metrics.length < 2) return null;
        return (
          <section data-cascade className="mx-auto max-w-5xl space-y-6 text-center">
            <div className="text-[13px] md:text-[15px] font-semibold text-[#7FA9D6]">
              {t("preview.eyebrowPerformance", "Performance")}
            </div>
            <p className="bg-gradient-to-r from-[#567FB2] via-[#7FA9D6] to-[#BCD8F0] bg-clip-text text-4xl md:text-8xl font-semibold tracking-[-0.025em] leading-[1.05] text-transparent">
              {metrics.join(". ")}.
            </p>
            {asKnowledgeList(firstKb("technical_advantages")?.content)[0] ? (
              <p className="mx-auto max-w-2xl text-base md:text-xl font-light leading-relaxed text-[var(--text-muted)]">
                {asKnowledgeList(firstKb("technical_advantages")!.content)[0]}
              </p>
            ) : null}
          </section>
        );
      })()}

      {/* ═══ 3c. EDITORIAL — Apple left-aligned story (headline stack +
          copy column + full-bleed shot). Headline = the tagline split at
          its dash; body = the overview knowledge block. ═══ */}
      {firstKb("overview") ? (
        <section data-cascade className="space-y-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-12">
            <h2 className="md:col-span-5 text-4xl md:text-[3.6rem] font-semibold tracking-[-0.025em] leading-[1.06] text-[var(--text-primary)]">
              {(displayTagline || displayName)
                .split("—")
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part, i) => (
                  <span key={i} className="block">
                    {part}
                    {/[.!?]$/.test(part) ? "" : "."}
                  </span>
                ))}
            </h2>
            <p className="md:col-span-7 md:pt-2 text-base md:text-xl font-light leading-relaxed text-[var(--text-secondary)]">
              {asKnowledgeList(firstKb("overview")!.content).join(" ")}
            </p>
          </div>
          {(galleryUrls ?? [])[0] ? (
            <div className="overflow-hidden rounded-3xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={IMG.gallery(galleryUrls![0])}
                alt={displayName}
                className="aspect-[16/9] md:aspect-[21/10] w-full object-cover"
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ═══ 7. SELLING POINTS / TECHNICAL ADVANTAGES (knowledge cards) ═══ */}
      {(firstKb("selling_points") || firstKb("technical_advantages")) ? (
        <section className="space-y-8">
          <SectionHead hero eyebrow={t("preview.eyebrowWhyItWins", "Why it wins")} title={t("preview.advantages", "Advantages")} />
          {/* Apple-style benefit grid: oversized glyph leading each card. */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              ...asKnowledgeList(firstKb("selling_points")?.content),
              ...asKnowledgeList(firstKb("technical_advantages")?.content),
            ].map((point, i) => (
              <div
                key={i}
                className="flex flex-col gap-5 rounded-3xl bg-[var(--bg-surface-subtle)] p-8"
              >
                <VisualGlyph token={ADVANTAGE_GLYPHS[i % ADVANTAGE_GLYPHS.length]} className="h-11 w-11 text-[var(--text-primary)]" />
                <p className="text-[15px] md:text-base leading-relaxed text-[var(--text-primary)]">{point}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ═══ LAYER 2 — SMART PRODUCT INTELLIGENCE ═══
          Interpreted, benefit-oriented summaries (schema-driven via insight). */}
      {intelligence.length > 0 ? (
        <section className="space-y-8">
          <SectionHead hero eyebrow={t("preview.eyebrowWhatItMeans", "What it means for you")} title={t("preview.takeCloserLook", "Take a closer look.")} />
          <div className="rounded-3xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-6 md:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-12">
              {/* chip rail — Apple's (+) explorer list */}
              <div className="order-2 lg:order-1 lg:col-span-5 space-y-2.5">
                {intelligence.map((it, i) => (
                  <div key={it.key}>
                    <button
                      type="button"
                      onClick={() => setExplorerIdx(explorerIdx === i ? -1 : i)}
                      aria-expanded={explorerIdx === i}
                      className={`inline-flex items-center gap-3 rounded-full border px-2 py-2 pe-5 text-start transition-all ${
                        explorerIdx === i
                          ? "border-[var(--border-focus)] bg-[var(--bg-surface)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:border-[var(--border-focus)]"
                      }`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px] leading-none transition-colors ${
                        explorerIdx === i ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      }`}>{explorerIdx === i ? "–" : "+"}</span>
                      <span className="text-[14px] md:text-[15px] font-semibold text-[var(--text-primary)]">{it.label}</span>
                      <span className="ms-auto text-[12px] font-medium text-[#7FA9D6]">{it.headline}</span>
                    </button>
                    {explorerIdx === i ? (
                      <div className="mt-2.5 rounded-2xl bg-[var(--bg-surface-subtle)] p-5">
                        <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
                          <span className="font-semibold text-[var(--text-primary)]">{it.label}. </span>
                          {it.insight}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {/* the product itself */}
              <div className="order-1 lg:order-2 lg:col-span-7">
                {mainImageUrl ? (
                  <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-white to-[#f1f2f4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={IMG.gallery(mainImageUrl)} alt={displayName} className="mx-auto max-h-[420px] w-auto object-contain px-6 py-8" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══ 9. APPLICATIONS DETAIL / OTHER FEATURES ═══ */}
      {otherFeatures.length > 0 ? (
        <section className="space-y-4">
          <SectionHead title={t("preview.features", "Features")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {otherFeatures.map((f) => (
              <div
                key={f.key}
                className="flex items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] shrink-0">
                  <VisualGlyph token="check" className="h-3 w-3" />
                </span>
                <span>{f.label ?? f.key}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ═══ 10. BUYER QUESTIONS ═══ */}
      {firstKb("buyer_questions") ? (() => {
        const c = firstKb("buyer_questions")!.content;
        const qs =
          c && typeof c === "object" && !Array.isArray(c) && Array.isArray((c as Record<string, unknown>).questions)
            ? ((c as Record<string, unknown>).questions as { question: string; answer: string }[])
            : [];
        if (qs.length === 0) return null;
        return (
          <section className="space-y-4">
            <SectionHead eyebrow={t("preview.eyebrowGoodToKnow", "Good to know")} title={t("preview.buyerQuestions", "Buyer Questions")} />
            <div className="space-y-3">
              {qs.map((q, i) => (
                <div key={i} className="flex items-start gap-4 rounded-2xl bg-[var(--bg-surface-subtle)] p-6">
                  <VisualGlyph token="question" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-primary)]" />
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-[var(--text-primary)]">{q.question}</div>
                    <div className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{q.answer}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })() : null}


      {/* ═══ 10b. WARNINGS & SAFETY (knowledge) ═══ */}
      {firstKb("warnings") ? (
        <section className="space-y-4">
          <SectionHead eyebrow={t("preview.eyebrowSafety", "Before you run it")} title={t("preview.warnings", "Warnings & Safety")} />
          <ul className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-5">
            {asKnowledgeList(firstKb("warnings")!.content).map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--text-primary)]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-primary)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ═══ 11. WHAT'S INCLUDED / WARRANTY (knowledge) ═══ */}
      {(firstKb("package_contents") || firstKb("warranty_notes")) ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {firstKb("package_contents") ? (
            <div className="space-y-3">
              <SectionHead title={t("preview.whatsIncluded", "What's Included")} />
              <ul className="space-y-2">
                {asKnowledgeList(firstKb("package_contents")!.content).map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--text-primary)]">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      <VisualGlyph token="check" className="h-2.5 w-2.5" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {firstKb("warranty_notes") ? (
            <div className="space-y-3">
              <SectionHead title={t("preview.warranty", "Warranty")} />
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {asKnowledgeList(firstKb("warranty_notes")!.content).join(" ")}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ═══ 10c. COMPARE — Apple "Worth the upgrade?" against machines of
          the same family. Dropdown picks the rival; both columns read the
          SAME core-anchor fields so the comparison is apples-to-apples. ═══ */}
      {siblings && siblings.length > 0 && coreAnchors.length > 0 ? (
        <section className="space-y-8">
          <SectionHead
            hero
            eyebrow={t("preview.eyebrowCompare", "Compare")}
            title={t("preview.compareTitle", "How it stacks up.")}
          />
          <div className="mx-auto flex max-w-md items-center justify-center gap-3">
            <label htmlFor="kx-compare-pick" className="shrink-0 text-[13px] text-[var(--text-muted)]">
              {t("preview.compareWith", "Compare with")}
            </label>
            <select
              id="kx-compare-pick"
              value={Math.min(compareIdx, siblings.length - 1)}
              onChange={(e) => setCompareIdx(Number(e.target.value))}
              className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 text-sm font-medium text-[var(--text-primary)] outline-none transition-all focus:border-[#567FB2]/60 focus:shadow-[0_0_0_4px_rgba(86,127,178,0.16)]"
            >
              {siblings.map((s, i) => (
                <option key={s.slug} value={i}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {(() => {
            const rival = siblings[Math.min(compareIdx, siblings.length - 1)];
            const cols = [
              { key: "self", name: displayName, imageUrl: mainImageUrl, vals: familyValues, self: true },
              { key: "rival", name: rival.name, imageUrl: rival.imageUrl ?? null, vals: rival.values, self: false },
            ];
            return (
              <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:gap-10">
                {cols.map((c) => (
                  <div key={c.key} className="space-y-6 text-center">
                    <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-white to-[#f1f2f4] md:h-56">
                      {c.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={IMG.card(c.imageUrl)} alt={c.name} className="h-full w-full object-contain p-4" />
                      ) : (
                        <span className="text-sm text-[#8a8f98]">{t("preview.noImage", "No image")}</span>
                      )}
                    </div>
                    <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                      {c.self ? displayName : c.name}
                    </div>
                    <div className="space-y-5">
                      {coreAnchors.slice(0, 5).map(({ field: f }) => (
                        <div key={f.key}>
                          <div className="text-xl font-semibold text-[var(--text-primary)] md:text-2xl">
                            {displayFieldValue(f, c.vals[f.key])}
                          </div>
                          <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-[var(--text-faint)]">
                            {f.label ?? f.key}
                          </div>
                        </div>
                      ))}
                    </div>
                    {!c.self ? (
                      <a
                        href={`/products/${rival.slug}`}
                        className="inline-flex items-center rounded-full bg-[var(--bg-inverted)] px-4 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
                      >
                        {t("preview.viewProduct", "View")}
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      ) : null}

        </div>
      </div>
      {/* ═══ end of the pinned spine — media and downloads go full width ═══ */}

      {/* ═══ PHASE 3 — the conditional sections, each gone entirely when its
          data is empty: Options · Packing & Logistics · Compliance. Media &
          Files are the gallery / media / documents sections that follow;
          the internal Price sheet closes the page. ═══ */}
      <ProductOptions options={sections?.options ?? []} lang={lang} t={t} />
      <ProductPacking packing={sections?.packing ?? null} t={t} />
      <ProductCompliance
        compliance={sections?.compliance ?? { ce: null, rohs: null, ipRating: null, hsCode: null, countryOfOrigin: countryOfOrigin ?? null, warranty: warranty ?? null }}
        warrantyMonths={sections?.warrantyMonths ?? null}
        schemaMarks={complianceFeatures.map((f) => f.label ?? f.key)}
        t={t}
      />

      {/* ═══ 12. GALLERY ═══ */}
      {hasGallery ? (
        <section id="gallery" className="scroll-mt-32 space-y-8">
          <SectionHead hero eyebrow={t("preview.eyebrowUpClose", "Up close")} title={t("view.gallery", "Gallery")} />
          {/* Apple "Up close" rail — large snap cards instead of a grid. */}
          <SnapCarousel>
            {galleryUrls!.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="aspect-[4/3] w-[85%] shrink-0 snap-start overflow-hidden rounded-3xl bg-[var(--bg-surface-subtle)] sm:w-[480px] md:w-[640px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={IMG.gallery(url)} alt={`${productName} ${i + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </SnapCarousel>
        </section>
      ) : null}

      {/* ═══ 13. VIDEO + AR ═══ */}
      {(hasVideos || ar3dUrl) ? (
        <section className="space-y-4">
          <SectionHead title={t("preview.media", "Media")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hasVideos
              ? videoUrls!.map((url, i) => (
                  <div key={`${url}-${i}`} className="aspect-video overflow-hidden rounded-2xl bg-[var(--bg-surface-subtle)]">
                    {/* Real playable video (was an <img> pointing at an
                        .mp4 — rendered as a broken image). */}
                    <video src={url} controls preload="metadata" playsInline className="h-full w-full object-cover" />
                  </div>
                ))
              : null}
            {ar3dUrl ? (
              <a
                href={ar3dUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex aspect-video flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[var(--bg-surface-subtle)] transition-colors hover:bg-[var(--bg-surface-hover)]"
              >
                <VisualGlyph token="spark" className="h-6 w-6 text-[var(--text-secondary)]" />
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--text-ghost)] group-hover:text-[var(--text-secondary)]">{t("preview.viewIn3dAr", "View in 3D / AR")}</span>
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ═══ 14. DOWNLOADS ═══ */}
      {hasManuals ? (
        <section className="space-y-4">
          <SectionHead title={t("preview.documents", "Documents")} />
          <div className="space-y-2">
            {manuals!.map((m, i) => (
              <a
                key={`${m.url}-${i}`}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {m.label || fileNameFromUrl(m.url)}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-ghost)] shrink-0">{t("preview.download", "Download")}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <ProductPriceInternal modelPrices={sections?.modelPrices ?? null} t={t} />

      {/* ═══ 16. MEDIA COUNT FOOTER ═══ */}
      {mediaCounts && (mediaCounts.photos || mediaCounts.videos || mediaCounts.manuals) ? (
        <div className="text-xs text-[var(--text-ghost)]">
          {[
            mediaCounts.photos
              ? t("preview.countPhotos", "{n} photos").replace("{n}", String(mediaCounts.photos))
              : null,
            mediaCounts.videos
              ? t("preview.countVideos", "{n} videos").replace("{n}", String(mediaCounts.videos))
              : null,
            mediaCounts.manuals
              ? t("preview.countDocuments", "{n} documents").replace("{n}", String(mediaCounts.manuals))
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      ) : null}
    </div>
  );
};

export default ProductPreview;
