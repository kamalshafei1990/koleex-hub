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

import { useMemo, useState } from "react";
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

interface ProductPreviewProps {
  productName: string;
  primaryModel?: string | null;
  tagline?: string | null;
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

/* Eyebrow + title section header — the single rhythm device for every
   major band so vertical pacing stays consistent. */
const SectionHead = ({
  eyebrow,
  title,
}: {
  eyebrow?: string;
  title: string;
}) => (
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
    <section className="rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[var(--bg-surface-hover)] transition-colors"
        aria-expanded={open}
      >
        <span className="text-left">
          {eyebrow ? (
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {eyebrow}
            </span>
          ) : null}
          <span className="block text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            {title}
          </span>
        </span>
        <span
          className={`text-[var(--text-ghost)] transition-transform ${open ? "rotate-45" : ""}`}
          aria-hidden
        >
          {/* plus → x on open */}
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      {open ? <div className="px-5 pb-5 pt-1">{children}</div> : null}
    </section>
  );
};

export const ProductPreview = (props: ProductPreviewProps) => {
  const {
    productName,
    primaryModel,
    tagline,
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
  } = props;

  const effectiveSurface: ProductSchemaSurface = surface ?? "website";

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

  /* ── derived: material + application cards ── */
  const materialEntries = visibleFields
    .filter((f) => f.visualRenderType === "material_card")
    .map((field) => ({ field, selected: selectedValuesOf(values[field.key]) }))
    .filter((e) => e.selected.length > 0);

  const applicationEntries = visibleFields
    .filter((f) => f.visualRenderType === "application_card")
    .map((field) => ({ field, selected: selectedValuesOf(values[field.key]) }))
    .filter((e) => e.selected.length > 0);

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
          No schema for this classification. The public preview will appear once
          a schema is registered for this subcategory.
        </p>
      </div>
    );
  }

  /* ── value renderer for a single non-dedicated field ── */
  const renderFieldValue = (f: SpecField): React.ReactNode => {
    const raw = values[f.key];
    if (isEmptyValue(raw)) return null;

    if (f.visualRenderType === "technical_badge") {
      const singleVal = typeof raw === "string" ? raw : null;
      const option = singleVal ? f.options?.find((o) => o.value === singleVal) : undefined;
      const visual = singleVal ? resolveOptionVisual(f, option, singleVal) : {};
      const display = option?.label ?? displayScalar(raw);
      return (
        <div className="flex items-center gap-2.5">
          {visual.icon ? (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)]">
              <VisualGlyph token={visual.icon} className="h-4 w-4" />
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">
              {f.label ?? f.key}
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {display}
              {f.unit ? <span className="ms-1 text-xs font-normal text-[var(--text-ghost)]">{f.unit}</span> : null}
            </div>
          </div>
        </div>
      );
    }

    if (f.visualRenderType === "icon_chip" || f.visualRenderType === "image_chip") {
      const selected = selectedValuesOf(raw);
      return (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-ghost)] mb-1.5">
            {f.label ?? f.key}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map((val) => {
              const option = f.options?.find((o) => o.value === val);
              const label = option?.label ?? val;
              const visual = resolveOptionVisual(f, option, val);
              return (
                <span
                  key={`${f.key}-${val}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] ps-1.5 pe-2.5 py-1 text-xs text-[var(--text-primary)]"
                  title={visual.description ?? label}
                >
                  {visual.swatch ? (
                    <span className="h-3.5 w-3.5 rounded-sm border border-black/10 shrink-0" style={{ backgroundColor: visual.swatch }} />
                  ) : visual.icon ? (
                    <VisualGlyph token={visual.icon} className="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
                  ) : null}
                  {label}
                  {visual.badge ? (
                    <span className="ms-0.5 rounded-sm bg-[var(--bg-surface-subtle)] px-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-ghost)]">
                      {visual.badge}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      );
    }

    // spec_card / plain_text / range / comparison_row / fallback
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">
          {f.label ?? f.key}
        </div>
        <div className="text-sm font-medium text-[var(--text-primary)]">
          {displayScalar(raw)}
          {f.unit ? <span className="ms-1 text-xs text-[var(--text-ghost)]">{f.unit}</span> : null}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12 md:space-y-16">
      {/* ═══ 1. CINEMATIC HERO ═══
          The machine is the main character: a dominant render with two
          floating intelligence cards overlapping it (desktop), an
          asymmetric identity column, and generous breathing room. */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-2 md:pt-4">
        {/* LEFT — identity */}
        <div className="order-2 lg:order-1 lg:col-span-5 space-y-6">
          <div className="space-y-3">
            {(machineKindLabel || brand) ? (
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                {brand ? <span>{brand}</span> : null}
                {brand && machineKindLabel ? <span className="text-[var(--border-subtle)]">/</span> : null}
                {machineKindLabel ? <span>{machineKindLabel}</span> : null}
              </div>
            ) : null}
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] leading-[1.04]">
              {productName || "Untitled product"}
            </h1>
            {tagline ? (
              <p className="text-lg md:text-xl font-light text-[var(--text-secondary)] leading-relaxed">
                {tagline}
              </p>
            ) : null}
            {primaryModel ? (
              <div className="font-mono text-sm text-[var(--text-ghost)] tracking-wide">{primaryModel}</div>
            ) : null}
          </div>

          {heroHighlights.length > 0 ? (
            <ul className="space-y-2.5">
              {heroHighlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[15px] text-[var(--text-primary)]">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    <VisualGlyph token="check" className="h-2.5 w-2.5" />
                  </span>
                  <span className="leading-snug">{h}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {(warranty || countryOfOrigin) ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {warranty ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                  <span className="uppercase tracking-wider text-[var(--text-ghost)]">Warranty</span>
                  <span className="font-medium text-[var(--text-primary)]">{warranty}</span>
                </span>
              ) : null}
              {countryOfOrigin ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                  <span className="uppercase tracking-wider text-[var(--text-ghost)]">Origin</span>
                  <span className="font-medium text-[var(--text-primary)]">{countryOfOrigin}</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* RIGHT — dominant render + floating intelligence cards */}
        <div className="order-1 lg:order-2 lg:col-span-7">
          <div className="relative">
            <div className="relative w-full aspect-[4/3] md:aspect-[5/4] overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex items-center justify-center">
              {mainImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mainImageUrl} alt={productName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm text-[var(--text-faint)]">No main image</span>
              )}
              {/* subtle inner edge for depth (monochrome, no gradient fill) */}
              <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-black/5" />
            </div>

            {/* Floating intelligence cards — desktop only; mobile uses the
                anchor band below. Pulls the top 2 anchors. */}
            {coreAnchors.length > 0 ? (
              <div className="hidden lg:flex absolute -bottom-6 left-6 right-6 gap-3">
                {coreAnchors.slice(0, 2).map(({ field: f, kind }) => {
                  const raw = values[f.key];
                  let icon: string | null = null;
                  let headline: string;
                  if (kind === "metric") {
                    headline = `${displayScalar(raw)}${f.unit ? " " + f.unit : ""}`;
                  } else if (kind === "boolean") {
                    icon = "automation";
                    headline = f.label ?? f.key;
                  } else {
                    const single = typeof raw === "string" ? raw : selectedValuesOf(raw)[0] ?? "";
                    const opt = f.options?.find((o) => o.value === single);
                    const v = resolveOptionVisual(f, opt, single);
                    icon = v.icon ?? null;
                    headline = opt?.label ?? displayScalar(raw);
                  }
                  return (
                    <div
                      key={f.key}
                      className="flex-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        {icon ? (
                          <VisualGlyph token={icon} className="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
                        ) : null}
                        <span className="text-lg font-bold font-mono text-[var(--text-primary)] leading-none truncate">
                          {headline}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-ghost)]">
                        {f.label ?? f.key}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ═══ 2. AT A GLANCE — airy, glyph-forward stat band (no table lines) ═══ */}
      {coreAnchors.length > 0 ? (
        <section className="border-y border-[var(--border-subtle)] py-8 md:py-10 space-y-7">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-9">
            {coreAnchors.map(({ field: f, kind }) => {
              const raw = values[f.key];
              let glyph: string | null = null;
              let swatch: string | null = null;
              let big = "";
              let bigClass = "text-2xl md:text-[28px] font-bold font-mono leading-none";
              let meterPct: number | null = null;

              if (kind === "metric") {
                glyph = "gauge";
                {
                  const n = typeof raw === "number" ? raw : Number(raw);
                  const mx = f.validation?.max;
                  if (Number.isFinite(n) && typeof mx === "number" && mx > 0) {
                    meterPct = Math.max(4, Math.min(100, Math.round((n / mx) * 100)));
                  }
                }
                big = `${displayScalar(raw)}${f.unit ? ` ${f.unit}` : ""}`;
              } else if (kind === "boolean") {
                glyph = "automation";
                big = f.label ?? f.key;
                bigClass = "text-[15px] font-semibold leading-snug";
              } else {
                const single = typeof raw === "string" ? raw : selectedValuesOf(raw)[0] ?? "";
                const opt = f.options?.find((o) => o.value === single);
                const v = resolveOptionVisual(f, opt, single);
                glyph = v.icon ?? null;
                swatch = v.swatch ?? null;
                big = opt?.label ?? displayScalar(raw);
                bigClass = "text-lg font-semibold leading-snug";
              }

              return (
                <div key={f.key} className="flex flex-col items-start gap-3">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"
                    aria-hidden
                  >
                    {swatch ? (
                      <span
                        className="h-6 w-6 rounded-lg"
                        style={{
                          backgroundColor: swatch,
                          backgroundImage:
                            "repeating-linear-gradient(45deg, rgba(0,0,0,0.10) 0 2px, transparent 2px 4px)",
                        }}
                      />
                    ) : glyph ? (
                      <VisualGlyph token={glyph} className="h-6 w-6" />
                    ) : null}
                  </span>
                  <div className="space-y-1">
                    <div className={`text-[var(--text-primary)] ${bigClass}`}>{big}</div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-ghost)]">
                      {f.label ?? f.key}
                    </div>
                    {meterPct !== null ? (
                      <div className="mt-1.5 h-1 w-24 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--text-primary)]"
                          style={{ width: `${meterPct}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* secondary anchors — quiet chip row */}
          {secondaryAnchors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {secondaryAnchors.map(({ field: f, kind }) => {
                const raw = values[f.key];
                let label = f.label ?? f.key;
                let icon: string | null = null;
                if (kind === "boolean") {
                  icon = "automation";
                } else if (kind === "badge") {
                  const single = typeof raw === "string" ? raw : selectedValuesOf(raw)[0] ?? "";
                  const option = f.options?.find((o) => o.value === single);
                  const v = resolveOptionVisual(f, option, single);
                  icon = v.icon ?? null;
                  label = option?.label ?? displayScalar(raw);
                } else {
                  icon = "gauge";
                  label = `${displayScalar(raw)}${f.unit ? " " + f.unit : ""}`;
                }
                return (
                  <span
                    key={f.key}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)]"
                  >
                    {icon ? <VisualGlyph token={icon} className="h-3.5 w-3.5" /> : null}
                    {label}
                  </span>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ═══ 3. OVERVIEW ═══ */}
      {firstKb("overview") ? (
        <section className="max-w-3xl">
          <p className="text-lg md:text-xl font-light leading-relaxed text-[var(--text-secondary)]">
            {asKnowledgeList(firstKb("overview")!.content).join(" ")}
          </p>
        </section>
      ) : null}

      {/* ═══ 4. MATERIALS ═══ */}
      {materialEntries.length > 0 ? (
        <section className="space-y-4">
          <SectionHead eyebrow="Capability" title="Suitable Materials" />
          {/* Filmstrip — large material swatches, horizontally scrollable. */}
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {materialEntries.flatMap(({ field, selected }) =>
              selected.map((val) => {
                const option = field.options?.find((o) => o.value === val);
                const label = labelForOption(field, val);
                const visual = resolveOptionVisual(field, option, val);
                return (
                  <div
                    key={`${field.key}-${val}`}
                    className="snap-start shrink-0 w-36 md:w-40"
                    title={visual.description ?? label}
                  >
                    <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
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
              }),
            )}
          </div>
        </section>
      ) : null}

      {/* ═══ 5. APPLICATIONS ═══ */}
      {applicationEntries.length > 0 ? (
        <section className="space-y-4">
          <SectionHead eyebrow="Built for" title="Applications" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {applicationEntries.flatMap(({ field, selected }) =>
              selected.map((val) => {
                const option = field.options?.find((o) => o.value === val);
                const label = labelForOption(field, val);
                const visual = resolveOptionVisual(field, option, val);
                return (
                  <div
                    key={`${field.key}-${val}`}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-3"
                    title={visual.description ?? label}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
                      {visual.icon ? (
                        <VisualGlyph token={visual.icon} className="h-5 w-5" />
                      ) : (
                        <span className="font-mono text-xs font-bold">{getInitials(label)}</span>
                      )}
                    </span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
                  </div>
                );
              }),
            )}
          </div>
        </section>
      ) : null}

      {/* ═══ 6. AUTOMATION — workflow row (connected nodes) ═══ */}
      {automationFeatures.length > 0 ? (
        <section className="space-y-5">
          <SectionHead eyebrow="Hands-off" title="Automation workflow" />
          <div className="relative overflow-x-auto pb-1">
            <div className="relative min-w-[460px]">
              {/* connector line running through the node centers (h-14 → 28px) */}
              <div className="absolute left-7 right-7 top-7 h-px bg-[var(--border-subtle)]" />
              <div className="relative flex justify-between gap-3">
                {automationFeatures.map((f, i) => (
                  <div key={f.key} className="flex flex-1 flex-col items-center text-center gap-2.5">
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                      <VisualGlyph token="automation" className="h-5 w-5" />
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
        <section className="space-y-4">
          <SectionHead eyebrow="Why it wins" title="Advantages" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ...asKnowledgeList(firstKb("selling_points")?.content),
              ...asKnowledgeList(firstKb("technical_advantages")?.content),
            ].map((point, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-sm leading-relaxed text-[var(--text-primary)]"
              >
                {point}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ═══ LAYER 2 — SMART PRODUCT INTELLIGENCE ═══
          Interpreted, benefit-oriented summaries (schema-driven via insight). */}
      {intelligence.length > 0 ? (
        <section className="space-y-4">
          <SectionHead eyebrow="What it means for you" title="Product Intelligence" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {intelligence.map((it) => (
              <div
                key={it.key}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-ghost)]">
                    {it.label}
                  </span>
                  <span className="text-sm font-semibold font-mono text-[var(--text-primary)] shrink-0">
                    {it.headline}
                  </span>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-secondary)]">
                  {it.insight}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ═══ LAYER 3 — ADVANCED TECHNICAL DATA (progressive disclosure) ═══
          Primary groups open by default; standard/quiet collapsed so the
          page reads simple-first, deep-on-demand. */}
      {specGroups.length > 0 ? (
        <div className="space-y-3">
          <SectionHead eyebrow="Layer 3" title="Technical Specifications" />
          {specGroups.map(({ group, fields, emphasis }) => (
            <Disclosure
              key={group.id}
              title={group.title}
              eyebrow={emphasis === "primary" ? "Core" : undefined}
              defaultOpen={emphasis === "primary"}
            >
              {emphasis === "quiet" ? (
                <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
                  {fields.map((f, idx) => {
                    const raw = values[f.key];
                    const single = typeof raw === "string" ? raw : null;
                    const opt = single ? f.options?.find((o) => o.value === single) : undefined;
                    const display = opt?.label ?? displayScalar(raw);
                    return (
                      <div
                        key={f.key}
                        className={`flex items-center justify-between gap-4 px-4 py-2.5 ${
                          idx % 2 === 0 ? "bg-[var(--bg-surface-subtle)]/50" : ""
                        }`}
                      >
                        <span className="text-xs text-[var(--text-ghost)]">{f.label ?? f.key}</span>
                        <span className="text-sm font-medium text-[var(--text-primary)] text-end">
                          {display}
                          {f.unit ? <span className="ms-1 text-xs text-[var(--text-ghost)]">{f.unit}</span> : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className={`grid gap-3 ${
                    emphasis === "primary"
                      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-4"
                  }`}
                >
                  {fields.map((f) => (
                    <div
                      key={f.key}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
                    >
                      {renderFieldValue(f)}
                    </div>
                  ))}
                </div>
              )}
            </Disclosure>
          ))}
        </div>
      ) : null}

      {/* ═══ 9. APPLICATIONS DETAIL / OTHER FEATURES ═══ */}
      {otherFeatures.length > 0 ? (
        <section className="space-y-4">
          <SectionHead title="Features" />
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
            <SectionHead eyebrow="Good to know" title="Buyer Questions" />
            <div className="space-y-2.5">
              {qs.map((q, i) => (
                <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{q.question}</div>
                  <div className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{q.answer}</div>
                </div>
              ))}
            </div>
          </section>
        );
      })() : null}

      {/* ═══ 11. WHAT'S INCLUDED / WARRANTY (knowledge) ═══ */}
      {(firstKb("package_contents") || firstKb("warranty_notes")) ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {firstKb("package_contents") ? (
            <div className="space-y-3">
              <SectionHead title="What's Included" />
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
              <SectionHead title="Warranty" />
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {asKnowledgeList(firstKb("warranty_notes")!.content).join(" ")}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ═══ 12. GALLERY ═══ */}
      {hasGallery ? (
        <section className="space-y-4">
          <SectionHead title="Gallery" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {galleryUrls!.map((url, i) => (
              <div key={`${url}-${i}`} className="aspect-square overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${productName} ${i + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ═══ 13. VIDEO + AR ═══ */}
      {(hasVideos || ar3dUrl) ? (
        <section className="space-y-4">
          <SectionHead title="Media" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hasVideos
              ? videoUrls!.map((url, i) => (
                  <div key={`${url}-${i}`} className="aspect-video overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Video ${i + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))
              : null}
            {ar3dUrl ? (
              <div className="aspect-video overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex items-center justify-center">
                <span className="text-xs uppercase tracking-wider text-[var(--text-ghost)]">3D / AR view available</span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ═══ 14. DOWNLOADS ═══ */}
      {hasManuals ? (
        <section className="space-y-4">
          <SectionHead title="Documents" />
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
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-ghost)] shrink-0">Download</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* ═══ 15. COMPLIANCE (quiet) ═══ */}
      {complianceFeatures.length > 0 ? (
        <section className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-6">
          <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)] me-1">Compliance</span>
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
            mediaCounts.photos ? `${mediaCounts.photos} photos` : null,
            mediaCounts.videos ? `${mediaCounts.videos} videos` : null,
            mediaCounts.manuals ? `${mediaCounts.manuals} documents` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      ) : null}
    </div>
  );
};

export default ProductPreview;
