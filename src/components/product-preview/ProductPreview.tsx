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

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ProductSchemaDefinition,
  ProductKnowledgeBlock,
  ProductSchemaSurface,
  SpecField,
} from "@/types/product-schema";
import {
  filterFieldsForSurface,
  filterKnowledgeForSurface,
  resolveOptionVisual,
  emphasisForGroup,
  collectAnchors,
} from "@/lib/product-schema";
import VisualGlyph from "./VisualGlyph";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";

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
  /** Same-subcategory public products for the Apple-style compare band. */
  siblings?: {
    name: string;
    slug: string;
    imageUrl?: string | null;
    values: Record<string, unknown>;
  }[];
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
  defaultOpen = false,
  children,
}: {
  title: string;
  eyebrow?: string;
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
        <span>
          {eyebrow ? (
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {eyebrow}
            </span>
          ) : null}
          <span className="block text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
            {title}
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

export const ProductPreview = (props: ProductPreviewProps) => {
  const { t, lang } = useTranslation(PRODUCTS_UI_I18N);
  const {
    productName,
    primaryModel,
    tagline,
    posterUrl,
    translations,
    brand,
    schema,
    values,
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
    siblings,
  } = props;

  /* Localized overlay: when the active language has a filled-in
     translation, show it; otherwise fall back to the English base.
     English (lang === "en") always uses the base props. */
  const localized = (translations ?? []).find((tr) => tr.locale === lang) ?? null;
  const displayName = (localized?.product_name || "").trim() || productName;
  const displayTagline = (localized?.tagline || "").trim() || tagline;

  const effectiveSurface: ProductSchemaSurface = surface ?? "website";

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
      const arr = m.get(b.type) ?? [];
      arr.push(b);
      m.set(b.type, arr);
    }
    return m;
  }, [visibleKnowledge]);
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
  const heroHighlights = asKnowledgeList(firstKb("key_features")?.content).slice(0, 4);

  /* ── media flags ── */
  const hasGallery = Array.isArray(galleryUrls) && galleryUrls.length > 0;
  const hasVideos = Array.isArray(videoUrls) && videoUrls.length > 0;
  const hasManuals = Array.isArray(manuals) && manuals.length > 0;

  const machineKindLabel = schema?.name ?? null;

  if (isEmptyState) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 p-6 md:p-8">
        <p className="text-sm text-[var(--text-secondary)]">
          {t(
            "preview.emptyState",
            "No schema for this classification. The public preview will appear once a schema is registered for this subcategory.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div ref={flowRef} className="space-y-16 md:space-y-24 pb-20">
      {/* ═══ 0. POSTER HEADER (optional) ═══
          When an admin uploads a designed poster/banner, it leads the page
          full-bleed with an overlaid identity block + CTA — the "shop window".
          A subtle bottom scrim keeps the text legible over any image. When no
          poster is set, the auto-composed cinematic hero below takes over. */}
      {posterUrl ? (
        <div data-reveal className="space-y-7">
          {/* The poster is the photo, nothing else (owner rule): no scrim, no
              overlaid copy. Identity + CTA live in their own block below it,
              where they are readable regardless of what the image shows. */}
          <section className="relative w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] aspect-[21/9] bg-[var(--bg-secondary)]">
            {heroVideoUrl ? (
              /* The product film IS the hero: autoplaying, silent, looping —
                 still photo-only per the owner rule (no overlaid copy). */
              <video
                src={heroVideoUrl}
                poster={posterUrl}
                autoPlay
                muted
                loop
                playsInline
                /* React never serialises the muted ATTRIBUTE (facebook/react
                   #10389), so autoplay policies see an unmuted video and
                   block it — force the property and kick playback here. */
                ref={(el) => {
                  if (el) {
                    el.muted = true;
                    el.play().catch(() => {});
                  }
                }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl} alt={displayName} className="absolute inset-0 h-full w-full object-cover" />
            )}
          </section>
          {/* Apple-style identity: centered stack — kicker, huge name,
              light tagline, one CTA. */}
          <div className="mx-auto max-w-3xl space-y-4 pt-4 text-center">
            {(brand || machineKindLabel) ? (
              <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
                {brand ? <span>{brand}</span> : null}
                {brand && machineKindLabel ? <span className="text-[var(--text-ghost)]">/</span> : null}
                {machineKindLabel ? <span>{machineKindLabel}</span> : null}
              </div>
            ) : null}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold tracking-[-0.025em] text-[var(--text-primary)] leading-[1.02]">
              {displayName || t("preview.untitledProduct", "Untitled product")}
            </h1>
            {displayTagline ? (
              <p className="mx-auto max-w-2xl text-lg md:text-2xl font-light text-[var(--text-muted)] leading-snug">{displayTagline}</p>
            ) : null}
            <div className="pt-2">
              <a href="#overview" className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg">
                {t("preview.learnMore", "Learn more")}
              </a>
            </div>
          </div>

          {/* THE main product photo — the floating studio shot on a light
              well (this is where the primary image lives; the poster above
              is the campaign banner, this is the product itself). */}
          {mainImageUrl ? (
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-white to-[#f1f2f4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mainImageUrl}
                alt={displayName}
                className="mx-auto max-h-[560px] w-auto object-contain px-8 py-12 md:py-16"
              />
            </section>
          ) : null}
        </div>
      ) : null}

      {/* ═══ 1. CINEMATIC HERO (auto-composed; hidden when a custom poster is set) ═══
          The machine is the protagonist. Generous negative space, a large
          unframed render, and a calm identity column. No floating cards —
          the headline stats live in the dedicated band below so nothing
          duplicates or collides. */}
      {!posterUrl ? (
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center pt-2 md:pt-6">
        {/* LEFT — identity */}
        <div className="order-2 lg:order-1 lg:col-span-5 space-y-7">
          <div className="space-y-4">
            {(machineKindLabel || brand) ? (
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
                {brand ? <span>{brand}</span> : null}
                {brand && machineKindLabel ? <span className="text-[var(--border-subtle)]">/</span> : null}
                {machineKindLabel ? <span>{machineKindLabel}</span> : null}
              </div>
            ) : null}
            <h1 className="text-[2.75rem] leading-[1.02] md:text-6xl md:leading-[0.98] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {displayName || t("preview.untitledProduct", "Untitled product")}
            </h1>
            {displayTagline ? (
              <p className="text-xl md:text-2xl font-light text-[var(--text-secondary)] leading-snug max-w-xl">
                {displayTagline}
              </p>
            ) : null}
            {primaryModel ? (
              <div className="font-mono text-xs text-[var(--text-faint)] tracking-[0.12em] pt-1">{primaryModel}</div>
            ) : null}
          </div>

          {heroHighlights.length > 0 ? (
            <ul className="space-y-3 pt-1">
              {heroHighlights.map((h, i) => (
                <li key={i} className="flex items-start gap-3 text-[15px] leading-snug text-[var(--text-secondary)]">
                  <VisualGlyph token="check" className="mt-[3px] h-4 w-4 shrink-0 text-[var(--text-primary)]" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {(warranty || countryOfOrigin) ? (
            <div className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
              {warranty ? (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">{t("preview.warranty", "Warranty")}</div>
                  <div className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{warranty}</div>
                </div>
              ) : null}
              {countryOfOrigin ? (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">{t("preview.origin", "Origin")}</div>
                  <div className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{countryOfOrigin}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* RIGHT — dominant unframed render */}
        <div className="order-1 lg:order-2 lg:col-span-7">
          <div className="relative w-full aspect-[4/3] md:aspect-[5/4] flex items-center justify-center">
            {mainImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mainImageUrl} alt={displayName} className="h-full w-full object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.25)]" />
            ) : (
              <span className="text-sm text-[var(--text-faint)]">{t("preview.noMainImage", "No main image")}</span>
            )}
          </div>
        </div>
      </section>
      ) : null}

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
            <a href="#overview" className="hidden sm:inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
              {t("preview.stickyOverview", "Overview")}
            </a>
            <a href="#specs" className="hidden sm:inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
              {t("preview.stickySpecs", "Specs")}
            </a>
            <a href="#gallery" className="inline-flex items-center rounded-full bg-[var(--bg-inverted)] px-4 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90">
              {t("preview.stickyGallery", "Gallery")}
            </a>
          </span>
        </div>
      </div>

      {/* Anchor target for the poster "Learn more" CTA. */}
      <div id="overview" className="scroll-mt-24" />

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

              return (
                <div key={f.key} className="flex min-h-[7.5rem] flex-col justify-between gap-3 px-5 py-7 md:py-9">
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

      {/* ═══ 3. HIGHLIGHTS — Apple "Get the highlights." snap carousel:
          the strongest claims as swipeable cards, each closing on a shot
          of the machine. Dots paginate; the rail scrolls free. ═══ */}
      {(() => {
        const points = [
          ...asKnowledgeList(firstKb("selling_points")?.content),
          ...asKnowledgeList(firstKb("technical_advantages")?.content),
        ].slice(0, 5);
        // Close-up detail shots lead the deck (they make the strongest
        // cards); wide studio shots and the main render fill the rest.
        const g = galleryUrls ?? [];
        const detailShots = g.filter((u) => u.includes("/products/details/"));
        const otherShots = g.filter((u) => !u.includes("/products/details/"));
        const imgs = [...detailShots, ...otherShots, ...(mainImageUrl ? [mainImageUrl] : [])];
        if (points.length < 2) return null;
        return (
          <section className="space-y-8">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {t("preview.getHighlights", "Get the highlights.")}
            </h2>
            <SnapCarousel>
              {points.map((point, i) => {
                const img = imgs.length > 0 ? imgs[i % imgs.length] : null;
                // Apple shop-card anatomy: bold claim on the card surface,
                // supporting clause below it, photo grounded at the bottom.
                // Theme-aware surface so it reads right in light AND dark.
                const parts = point.split(/\s+—\s+/);
                const head = parts[0];
                const body = parts.slice(1).join(" — ");
                return (
                  <div
                    key={i}
                    className="flex h-[500px] md:h-[560px] w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-[28px] bg-[var(--bg-surface-subtle)] sm:w-[440px]"
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
                    {img ? (
                      <div className="mt-auto h-[240px] md:h-[280px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : null}
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
          <section className="mx-auto max-w-4xl space-y-6 text-center">
            <div className="text-[13px] md:text-[15px] font-semibold text-[#7FA9D6]">
              {t("preview.eyebrowPerformance", "Performance")}
            </div>
            <p className="bg-gradient-to-r from-[#567FB2] via-[#7FA9D6] to-[#BCD8F0] bg-clip-text text-4xl md:text-7xl font-semibold tracking-[-0.02em] leading-[1.08] text-transparent">
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
        <section className="space-y-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-12">
            <h2 className="md:col-span-5 text-4xl md:text-[3.2rem] font-semibold tracking-[-0.02em] leading-[1.08] text-[var(--text-primary)]">
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
                src={galleryUrls![0]}
                alt={displayName}
                className="aspect-[16/9] md:aspect-[21/10] w-full object-cover"
              />
            </div>
          ) : null}
        </section>
      ) : null}

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
                        <img src={option.image} alt={label} className="h-full w-full object-cover" />
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
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--text-primary)] text-[9px] font-bold text-[var(--bg-primary)]">
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
                    <img src={mainImageUrl} alt={displayName} className="mx-auto max-h-[420px] w-auto object-contain px-6 py-8" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══ FULL-BLEED DETAIL INTERLUDE — Apple-style giant close-up
          breathing room between the story and the data. ═══ */}
      {(() => {
        const shot = (galleryUrls ?? []).filter((u) => u.includes("/products/details/")).slice(-1)[0];
        if (!shot) return null;
        return (
          <section className="overflow-hidden rounded-[28px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot} alt={displayName} className="aspect-[16/9] md:aspect-[21/9] w-full object-cover" />
          </section>
        );
      })()}

      {/* ═══ LAYER 3 — ADVANCED TECHNICAL DATA (progressive disclosure) ═══
          Primary groups open by default; standard/quiet collapsed so the
          page reads simple-first, deep-on-demand. */}
      {specGroups.length > 0 ? (
        <div id="specs" data-reveal className="scroll-mt-24">
          <SectionHead hero eyebrow={t("preview.eyebrowLayer3", "In depth")} title={t("preview.technicalSpecifications", "Technical Specifications")} />
          <div className="mt-3 border-t border-[var(--border-subtle)]">
          {specGroups.map(({ group, fields, emphasis }) => (
            <Disclosure
              key={group.id}
              title={group.title}
              eyebrow={emphasis === "primary" ? t("preview.eyebrowCore", "Core") : undefined}
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
              { key: "self", name: displayName, imageUrl: mainImageUrl, vals: values, self: true },
              { key: "rival", name: rival.name, imageUrl: rival.imageUrl ?? null, vals: rival.values, self: false },
            ];
            return (
              <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:gap-10">
                {cols.map((c) => (
                  <div key={c.key} className="space-y-6 text-center">
                    <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-white to-[#f1f2f4] md:h-56">
                      {c.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt={c.name} className="h-full w-full object-contain p-4" />
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

      {/* ═══ 12. GALLERY ═══ */}
      {hasGallery ? (
        <section id="gallery" className="scroll-mt-24 space-y-8">
          <SectionHead hero eyebrow={t("preview.eyebrowUpClose", "Up close")} title={t("view.gallery", "Gallery")} />
          {/* Apple "Up close" rail — large snap cards instead of a grid. */}
          <SnapCarousel>
            {galleryUrls!.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="aspect-[4/3] w-[85%] shrink-0 snap-start overflow-hidden rounded-3xl bg-[var(--bg-surface-subtle)] sm:w-[480px] md:w-[640px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${productName} ${i + 1}`} className="h-full w-full object-cover" />
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Video ${i + 1}`} className="h-full w-full object-cover" />
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

      {/* ═══ 15. COMPLIANCE (quiet) ═══ */}
      {complianceFeatures.length > 0 ? (
        <section className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-6">
          <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)] me-1">{t("preview.compliance", "Compliance")}</span>
          {complianceFeatures.map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]"
            >
              <VisualGlyph token="check" className="h-3 w-3" />
              {f.label ?? f.key}
            </span>
          ))}
        </section>
      ) : null}

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
