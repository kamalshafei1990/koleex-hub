"use client";

/* ---------------------------------------------------------------------------
   ProductPreview — the product page (redesign 19/09/2026).

   ONE SHAPE. The page is a data sheet, not a scroll of set pieces: a hero,
   then a pinned rail (the machine, its models, the section index) beside a
   single column of uniform sections, each opened by the same heading and
   built from the same atoms — a fact list, a chip row, a table, a card.
   Nothing is centred, nothing is animated for its own sake, nothing uses a
   colour beyond the brand's neutrals except the one blue for "you are
   here" and links, and the functional colours the card actions already own.

   Order (every section renders only when it has data):
     Key figures · Highlights · Specifications (chips, sheet, models)
     · Options · Packing & Logistics · Compliance · Knowledge · Media & Files
     · Compare · Price sheet (internal)

   Everything shown arrives with the server props (product-detail.ts). This
   file localises (language, schema labels, knowledge overlays), derives
   (anchors, chip rows, spec groups, family diffs) and composes. It fetches
   nothing but the reader's spec-label dictionary for zh/ar and the icon
   bindings.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProductKnowledgeBlock, ProductSchemaDefinition, ProductSchemaSurface, SpecField } from "@/types/product-schema";
/* ⚠️ LEAF MODULES, NOT THE BARREL — the barrel imports every spec template
   (validate:schema-barrel). */
import { filterFieldsForSurface, filterKnowledgeForSurface } from "@/lib/product-schema/visibility";
import { collectAnchors, emphasisForGroup } from "@/lib/product-schema/visual-options";
import { useTranslation, type Translations } from "@/lib/i18n";
import { PRODUCTS_PREVIEW_I18N } from "@/lib/products-preview-i18n";
import { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import type { ProductAudience, ProductDetailSections } from "@/lib/server/product-detail";
import ProductHero, { type HeroAction } from "./ProductHero";
import ProductRail, { type RailSection } from "./ProductRail";
import ProductKeyFigures from "./ProductKeyFigures";
import ProductHighlights from "./ProductHighlights";
import ProductSpecs, { type SpecChipRow } from "./ProductSpecs";
import ProductOptions from "./ProductOptions";
import ProductPacking from "./ProductPacking";
import ProductCompliance from "./ProductCompliance";
import ProductKnowledge from "./ProductKnowledge";
import ProductMedia from "./ProductMedia";
import ProductCompare from "./ProductCompare";
import ProductPriceInternal from "./ProductPriceInternal";
import { formatSpecValue, isEmptyValue, labelForOption, selectedValuesOf, useSpecGlyphs } from "./shared";

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
  posterUrl?: string | null;
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
  variants?: Array<{ photo?: string | null; primary?: boolean; code: string; tagline: string | null; overrides: Record<string, unknown> }>;
  siblings?: { name: string; slug: string; imageUrl?: string | null; values: Record<string, unknown> }[];
  productId?: string;
  slug?: string;
  audience?: ProductAudience;
  sections?: ProductDetailSections;
}

const EMPTY_SPEC_I18N: Translations = Object.freeze({}) as Translations;

/* The spec facts that are lists of things render as chip rows, not table
   rows; metric_block fields are the key figures; the rest belong to no
   section of their own. */
const CHIP_RENDER_TYPES = new Set(["material_card", "application_card"]);
const DEDICATED_RENDER_TYPES = new Set([
  "boolean_feature", "material_card", "application_card", "metric_block",
  "gallery_block", "packing_block", "download_block", "ai_fact", "brochure_block",
]);

export const ProductPreview = (props: ProductPreviewProps) => {
  const { t, lang } = useTranslation(PRODUCTS_PREVIEW_I18N);
  /* zh/ar spec labels come from the 445 KB spec dictionary, fetched only
     then; English reads the schema's own labels (owner: the schema wins). */
  const [specDict, setSpecDict] = useState<Translations | null>(null);
  useEffect(() => {
    if (lang === "en") return;
    let alive = true;
    void import("@/lib/product-schema/spec-i18n").then((m) => { if (alive) setSpecDict(m.SPEC_I18N); }).catch(() => {});
    return () => { alive = false; };
  }, [lang]);
  const { t: ts } = useTranslation(specDict ?? EMPTY_SPEC_I18N);
  const { fieldGlyph, groupGlyph } = useSpecGlyphs();

  const {
    productName, primaryModel, tagline, posterUrl, translations, brand, schema: rawSchema, values: familyValues,
    knowledge, mainImageUrl, galleryUrls, surface, videoUrls, manuals, ar3dUrl, countryOfOrigin, warranty,
    variants, siblings, productId, slug, sections, audience,
  } = props;
  const isPublicReader = audience === "public";
  const yes = t("preview.yes", "Yes");
  const no = t("preview.no", "No");

  /* ── localisation ── */
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
          options: f.options?.map((o) => ({ ...o, label: ts(`o:${f.key}.${o.value}`, ts(`o:${o.value}`, o.label)) })),
        })),
      })),
    };
  }, [rawSchema, ts]);
  const localized = (translations ?? []).find((tr) => tr.locale === lang) ?? null;
  const displayName = (localized?.product_name || "").trim() || productName;
  const displayTagline = (localized?.tagline || "").trim() || tagline;
  const effectiveSurface: ProductSchemaSurface = surface ?? "website";

  /* ── model selection (?model= pre-selects; the primary otherwise) ── */
  const wantedModel = useMemo(() => {
    if (typeof window === "undefined") return null;
    try { const v = new URLSearchParams(window.location.search).get("model"); return v ? v.trim().toLowerCase() : null; } catch { return null; }
  }, []);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const list = variants ?? [];
    if (list.length === 0) return;
    const linked = wantedModel ? list.find((v) => v.code.trim().toLowerCase() === wantedModel) : null;
    const seed = linked ?? list.find((v) => v.primary) ?? null;
    if (seed) setSelectedCode(seed.code);
    seededRef.current = true;
  }, [wantedModel, variants]);
  const activeVariant = useMemo(() => (variants ?? []).find((v) => v.code === selectedCode) ?? null, [variants, selectedCode]);
  const values = useMemo(() => (activeVariant ? { ...familyValues, ...activeVariant.overrides } : familyValues), [familyValues, activeVariant]);

  /* ── derivations ── */
  const visibleFields = useMemo<SpecField[]>(() => (schema ? filterFieldsForSurface(schema.groups.flatMap((g) => g.fields), effectiveSurface) : []), [schema, effectiveSurface]);
  const visibleFieldKeys = useMemo(() => new Set(visibleFields.map((f) => f.key)), [visibleFields]);
  const fieldGroupId = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of schema?.groups ?? []) for (const f of g.fields) m.set(f.key, g.id);
    return m;
  }, [schema]);
  const kbByType = useMemo(() => {
    const m = new Map<string, ProductKnowledgeBlock[]>();
    for (const b of filterKnowledgeForSurface(knowledge, effectiveSurface)) {
      const loc = lang === "en" ? b : {
        ...b,
        title: b.title_i18n?.[lang]?.trim() || b.title,
        content: (() => { const c = b.content_i18n?.[lang]; if (Array.isArray(c)) return c.length ? c : b.content; return typeof c === "string" && c.trim() ? c : b.content; })(),
      };
      const arr = m.get(b.type) ?? []; arr.push(loc); m.set(b.type, arr);
    }
    return m;
  }, [knowledge, effectiveSurface, lang]);

  const anchors = useMemo(() => collectAnchors(visibleFields, values, {
    limit: 6,
    groupOf: (k) => fieldGroupId.get(k),
    isQuietGroup: (k) => emphasisForGroup(fieldGroupId.get(k) ?? "") === "quiet",
  }), [visibleFields, values, fieldGroupId]);
  const anchorKeys = useMemo(() => new Set(anchors.map((a) => a.field.key)), [anchors]);

  const chipRows = useMemo<SpecChipRow[]>(() => {
    const rows: SpecChipRow[] = [];
    const picks = (renderType: string) => {
      const seen = new Set<string>();
      const out: SpecChipRow["items"] = [];
      for (const field of visibleFields.filter((f) => f.visualRenderType === renderType)) {
        for (const value of selectedValuesOf(values[field.key])) {
          const label = labelForOption(field, value);
          const k = label.trim().toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({ key: `${field.key}:${value}`, label, glyph: null });
        }
      }
      return out;
    };
    const materials = picks("material_card");
    if (materials.length) rows.push({ key: "materials", label: t("preview.suitableMaterials", "Suitable materials"), items: materials });
    const applications = picks("application_card");
    if (applications.length) rows.push({ key: "applications", label: t("preview.applications", "Applications"), items: applications });
    const trueBooleans = visibleFields.filter((f) => f.visualRenderType === "boolean_feature" && values[f.key] === true && !anchorKeys.has(f.key));
    const automation = trueBooleans.filter((f) => fieldGroupId.get(f.key) === "automation");
    const compliance = trueBooleans.filter((f) => { const g = fieldGroupId.get(f.key); return g === "compliance" || g === "customs"; });
    const other = trueBooleans.filter((f) => !automation.includes(f) && !compliance.includes(f));
    if (automation.length) rows.push({ key: "automation", label: t("preview.automationWorkflow", "Automation"), items: automation.map((f) => ({ key: f.key, label: f.label ?? f.key, glyph: fieldGlyph(f.key, f.label) })) });
    if (other.length) rows.push({ key: "features", label: t("preview.features", "Features"), items: other.map((f) => ({ key: f.key, label: f.label ?? f.key, glyph: fieldGlyph(f.key, f.label) })) });
    return rows;
  }, [visibleFields, values, anchorKeys, fieldGroupId, fieldGlyph, t]);
  const complianceMarks = useMemo(() => visibleFields
    .filter((f) => f.visualRenderType === "boolean_feature" && values[f.key] === true)
    .filter((f) => { const g = fieldGroupId.get(f.key); return g === "compliance" || g === "customs"; })
    .map((f) => f.label ?? f.key), [visibleFields, values, fieldGroupId]);

  const specGroups = useMemo(() => (schema?.groups ?? [])
    .slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((group) => ({
      group,
      fields: group.fields.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .filter((f) => visibleFieldKeys.has(f.key) && !DEDICATED_RENDER_TYPES.has(f.visualRenderType) && !anchorKeys.has(f.key) && !isEmptyValue(values[f.key])),
    }))
    .filter((b) => b.fields.length > 0), [schema, visibleFieldKeys, anchorKeys, values]);

  /* Family: the keys members differ on. The hero shows three; the sheet
     shows the full comparison only when there are more than three. */
  const fieldByKey = useMemo(() => new Map(visibleFields.map((f) => [f.key, f] as const)), [visibleFields]);
  const overridesByCode = useMemo(() => { const out: Record<string, Record<string, unknown>> = {}; for (const v of variants ?? []) out[v.code] = v.overrides ?? {}; return out; }, [variants]);
  const diffKeys = useMemo(() => {
    const seen = new Map<string, number>();
    for (const v of variants ?? []) for (const k of Object.keys(v.overrides ?? {})) if (fieldByKey.has(k)) seen.set(k, (seen.get(k) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [variants, fieldByKey]);
  const comparison = useMemo(() => {
    if (!variants || variants.length < 2 || diffKeys.length <= 3) return null;
    return {
      models: variants.map((v) => ({ code: v.code, primary: !!v.primary, values: { ...familyValues, ...(v.overrides ?? {}) } })),
      fields: diffKeys.map((k) => fieldByKey.get(k)!).filter(Boolean),
    };
  }, [variants, diffKeys, familyValues, fieldByKey]);
  const heroFieldLabel = useCallback((key: string) => fieldByKey.get(key)?.label ?? key, [fieldByKey]);
  const heroFormatValue = useCallback((key: string, raw: unknown) => formatSpecValue(fieldByKey.get(key), raw, yes, no), [fieldByKey, yes, no]);

  const legacyFacts = useMemo(() => (sections?.legacyFacts ?? []).map((f) => ({
    key: f.key,
    label: t(`preview.fact.${f.key}`, { voltage: "Voltage", power: "Power", weight: "Weight", dimensions: "Dimensions" }[f.key]),
    value: f.value,
  })), [sections?.legacyFacts, t]);

  /* ── actions ── */
  const onHeroAction = useCallback((action: HeroAction, modelCode?: string) => {
    if (typeof window === "undefined") return;
    const subject = modelCode ? `${displayName} (${modelCode})` : displayName;
    if (action === "ask_ai") {
      window.dispatchEvent(new CustomEvent("koleex:ai-open", {
        detail: { draft: `${t("preview.heroAiDraft", "Tell me about")} ${subject}`, hints: [{ key: `product:${productId ?? slug ?? subject}`, text: subject, severity: "info" }] },
      }));
      return;
    }
    if (action === "compare") {
      document.getElementById("compare")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (isPublicReader) {
      const model = modelCode ?? primaryModel ?? "";
      const subj = encodeURIComponent(`Quotation request: ${displayName}${model ? ` (${model})` : ""}`);
      const body = encodeURIComponent(`${displayName}${model ? ` — ${model}` : ""}\n${window.location.href}\n\n`);
      window.location.href = `mailto:${KOLEEX_COMPANY.email}?subject=${subj}&body=${body}`;
      return;
    }
    window.dispatchEvent(new CustomEvent("koleex:quote-product", {
      detail: { productId: productId ?? null, slug: slug ?? null, name: displayName, model: modelCode ?? primaryModel ?? null },
    }));
  }, [displayName, primaryModel, productId, slug, t, isPublicReader]);

  /* ── which sections exist → the rail's index ── */
  const hasKnowledge = [...kbByType.values()].some((arr) => arr.length > 0);
  const hasMedia = (galleryUrls?.length ?? 0) > 0 || (videoUrls?.length ?? 0) > 0 || !!ar3dUrl || (manuals?.length ?? 0) > 0;
  const hasCompliance = !!(sections?.compliance.ce || sections?.compliance.rohs || sections?.compliance.ipRating || sections?.compliance.hsCode || sections?.compliance.countryOfOrigin || sections?.compliance.warranty || sections?.warrantyMonths || complianceMarks.length || countryOfOrigin || warranty);
  const hasPrice = !!(sections?.modelPrices && sections.modelPrices.some((m) => m.globalPrice != null || m.headOnlyPrice != null || m.completeSetPrice != null || m.priceNote));
  const railSections = useMemo<RailSection[]>(() => [
    anchors.length > 0 ? { id: "overview", label: t("preview.navOverview", "Key figures") } : null,
    (sections?.featureCards.length || sections?.highlights.length) ? { id: "highlights", label: t("preview.navHighlights", "Highlights") } : null,
    (specGroups.length > 0 || chipRows.length > 0 || legacyFacts.length > 0) ? { id: "specs", label: t("preview.navSpecs", "Specifications") } : null,
    comparison ? { id: "models", label: t("preview.navModels", "Models") } : null,
    sections?.options.length ? { id: "options", label: t("preview.navOptions", "Options") } : null,
    sections?.packing ? { id: "packing", label: t("preview.navPacking", "Packing") } : null,
    hasCompliance ? { id: "compliance", label: t("preview.navCompliance", "Compliance") } : null,
    hasKnowledge ? { id: "knowledge", label: t("preview.navKnowledge", "Knowledge") } : null,
    hasMedia ? { id: "media", label: t("preview.navMedia", "Media & Files") } : null,
    (siblings?.length && anchors.length) ? { id: "compare", label: t("preview.navCompare", "Compare") } : null,
    hasPrice ? { id: "price", label: t("preview.navPrice", "Price sheet") } : null,
  ].filter((s): s is RailSection => !!s), [anchors.length, sections, specGroups.length, chipRows.length, legacyFacts.length, comparison, hasCompliance, hasKnowledge, hasMedia, siblings?.length, hasPrice, t]);

  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    const ids = railSections.map((s) => s.id);
    const nodes = ids.map((id) => document.getElementById(id)).filter((n): n is HTMLElement => !!n);
    if (nodes.length === 0) return;
    const io = new IntersectionObserver((entries) => {
      const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit?.target.id) setActiveId(hit.target.id);
    }, { rootMargin: "-120px 0px -65% 0px", threshold: 0 });
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [railSections]);

  /* Sections drift up as the reader reaches them — transform + opacity only,
     off under prefers-reduced-motion (.kx-rev in globals.css). */
  const flowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = flowRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const kids = Array.from(root.querySelectorAll<HTMLElement>(":scope > section"));
    kids.forEach((el) => el.classList.add("kx-rev"));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("kx-rev-in"); io.unobserve(e.target); }
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
    kids.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [railSections]);

  const heroVideoUrl = (videoUrls ?? []).find((u) => /\.(mp4|webm|mov)(\?|$)/i.test(u)) ?? null;
  const models = sections?.models ?? [];

  return (
    <div className="pb-24">
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
        models={models}
        overridesByCode={overridesByCode}
        fieldLabel={heroFieldLabel}
        formatValue={heroFormatValue}
        fob={sections?.fob ?? null}
        selectedCode={selectedCode}
        onSelectModel={(code) => setSelectedCode((prev) => (prev === code ? null : code))}
        canCompare={(siblings ?? []).length > 0 && anchors.length > 0}
        showAskAi={!isPublicReader}
        onAction={onHeroAction}
        t={t}
      />

      <div className="mt-16 lg:mt-20 grid grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)] gap-8 lg:gap-16 items-start">
        <ProductRail
          image={activeVariant?.photo || mainImageUrl || null}
          name={displayName}
          models={models.map((m) => ({ code: m.code }))}
          selectedCode={selectedCode}
          onSelectModel={(code) => setSelectedCode((prev) => (prev === code ? null : code))}
          sections={railSections}
          activeId={activeId}
        />

        <div ref={flowRef} className="min-w-0 space-y-16 lg:space-y-20">
          <ProductKeyFigures anchors={anchors} values={values} fieldGlyph={fieldGlyph} />
          <ProductHighlights cards={sections?.featureCards ?? []} bullets={sections?.highlights ?? []} t={t} />
          <ProductSpecs
            groups={specGroups}
            values={values}
            chipRows={chipRows}
            comparison={comparison}
            legacyFacts={legacyFacts}
            groupGlyph={groupGlyph}
            yes={yes}
            no={no}
            t={t}
          />
          <ProductOptions options={sections?.options ?? []} lang={lang} t={t} />
          <ProductPacking packing={sections?.packing ?? null} t={t} />
          <ProductCompliance
            compliance={sections?.compliance ?? { ce: null, rohs: null, ipRating: null, hsCode: null, countryOfOrigin: countryOfOrigin ?? null, warranty: warranty ?? null }}
            warrantyMonths={sections?.warrantyMonths ?? null}
            schemaMarks={complianceMarks}
            t={t}
          />
          <ProductKnowledge byType={kbByType} t={t} />
          <ProductMedia
            name={displayName}
            gallery={galleryUrls ?? []}
            videos={videoUrls ?? []}
            ar3dUrl={ar3dUrl ?? null}
            manuals={manuals ?? []}
            t={t}
          />
          <ProductCompare
            name={displayName}
            imageUrl={mainImageUrl ?? null}
            values={familyValues}
            siblings={siblings ?? []}
            anchors={anchors}
            yes={yes}
            no={no}
            t={t}
          />
          <ProductPriceInternal modelPrices={sections?.modelPrices ?? null} t={t} />
        </div>
      </div>
    </div>
  );
};
