"use client";

import { useMemo } from "react";
import type {
  ProductSchemaDefinition,
  ProductKnowledgeBlock,
  ProductSchemaSurface,
  SpecField,
  SpecGroup,
} from "@/types/product-schema";
import {
  filterFieldsForSurface,
  filterKnowledgeForSurface,
  resolveOptionVisual,
} from "@/lib/product-schema";
import VisualGlyph from "./VisualGlyph";

interface ProductPreviewProps {
  // --- MUST STAY (Review-step call site, A4) ---
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

  // --- NEW (additive, all optional → call site unaffected) ---
  videoUrls?: string[];
  manuals?: { url: string; label?: string | null }[];
  ar3dUrl?: string | null;
  countryOfOrigin?: string | null;
  warranty?: string | null;
}

/* The canonical SpecField type is imported from "@/types/product-schema".
   We do not redeclare it here — drift between local and canonical shapes
   was the root cause of the build failure. */

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
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
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

/* Shared section heading. */
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
    {children}
  </h3>
);

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
    const all = schema.groups.flatMap((g) => g.fields);
    return filterFieldsForSurface(all, effectiveSurface);
  }, [schema, effectiveSurface]);

  const visibleKnowledge = useMemo(
    () => filterKnowledgeForSurface(knowledge, effectiveSurface),
    [knowledge, effectiveSurface],
  );

  // Fast lookup of which fields survived surface filtering.
  const visibleFieldKeys = useMemo(
    () => new Set(visibleFields.map((f) => f.key)),
    [visibleFields],
  );

  const isEmptyState =
    !schema &&
    Object.keys(values || {}).length === 0 &&
    (!knowledge || knowledge.length === 0);

  if (isEmptyState) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 p-6 md:p-8">
        <p className="text-sm text-[var(--text-secondary)]">
          No schema for this classification. The public preview will appear
          once a schema is registered for this subcategory.
        </p>
      </div>
    );
  }

  // ---- Boolean / compliance feature badges (true booleans only) ----
  const trueBooleanFields = visibleFields.filter(
    (f) => f.visualRenderType === "boolean_feature" && values[f.key] === true,
  );
  const badgeFields = trueBooleanFields.slice(0, 8);
  const badgeKeys = new Set(badgeFields.map((f) => f.key));
  const remainingBooleanFields = trueBooleanFields.filter(
    (f) => !badgeKeys.has(f.key),
  );

  // ---- Field renderer keyed by visualRenderType ----
  // Used both inside grouped sections and any flat fallback.
  const renderField = (f: SpecField): React.ReactNode => {
    const raw = values[f.key];
    if (isEmptyValue(raw)) return null;

    switch (f.visualRenderType) {
      case "metric_block": {
        return (
          <div
            key={f.key}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-1"
          >
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                {displayScalar(raw)}
              </span>
              {f.unit ? (
                <span className="text-xs text-[var(--text-ghost)]">
                  {f.unit}
                </span>
              ) : null}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-ghost)]">
              {f.label ?? f.key}
            </div>
          </div>
        );
      }

      case "technical_badge": {
        // For single-select badges, resolve a glyph + the option's label
        // from the visual registry so e.g. motor_type shows a motor icon
        // and the human label ("Direct Drive") rather than the raw value.
        const singleVal = typeof raw === "string" ? raw : null;
        const option = singleVal
          ? f.options?.find((o) => o.value === singleVal)
          : undefined;
        const visual = singleVal ? resolveOptionVisual(f, option, singleVal) : {};
        const display = option?.label ?? displayScalar(raw);
        return (
          <div
            key={f.key}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2"
            title={visual.description ?? undefined}
          >
            {visual.icon ? (
              <VisualGlyph token={visual.icon} className="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
            ) : null}
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">
              {f.label ?? f.key}
            </span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {display}
              {f.unit ? (
                <span className="ms-1 text-xs font-normal text-[var(--text-ghost)]">
                  {f.unit}
                </span>
              ) : null}
            </span>
          </div>
        );
      }

      case "icon_chip":
      case "image_chip": {
        const selected = selectedValuesOf(raw);
        return (
          <div key={f.key} className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">
              {f.label ?? f.key}
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.map((val) => {
                const option = f.options?.find((o) => o.value === val);
                const label = option?.label ?? val;
                const visual = resolveOptionVisual(f, option, val);
                const image =
                  f.visualRenderType === "image_chip"
                    ? option?.image
                    : undefined;
                return (
                  <span
                    key={`${f.key}-${val}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] ps-1.5 pe-2.5 py-1 text-xs text-[var(--text-primary)]"
                    title={visual.description ?? label}
                  >
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className="h-4 w-4 rounded object-cover" />
                    ) : visual.swatch ? (
                      <span
                        className="h-3.5 w-3.5 rounded-sm border border-black/10 shrink-0"
                        style={{ backgroundColor: visual.swatch }}
                      />
                    ) : visual.icon ? (
                      <VisualGlyph token={visual.icon} className="h-4 w-4 text-[var(--text-secondary)] shrink-0" />
                    ) : null}
                    {label}
                    {visual.badge ? (
                      <span className="ms-0.5 rounded-sm bg-[var(--bg-primary)] px-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-ghost)]">
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

      // spec_card + plain_text + range (fieldType) + any other scalar
      // renderer fall here. Note "range" is a SpecFieldType, not a
      // VisualRenderType, so it is handled generically by default.
      default: {
        return (
          <div
            key={f.key}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-1"
          >
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">
              {f.label ?? f.key}
            </div>
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {displayScalar(raw)}
              {f.unit ? (
                <span className="ms-1 text-xs text-[var(--text-ghost)]">
                  {f.unit}
                </span>
              ) : null}
            </div>
          </div>
        );
      }
    }
  };

  // Render-types that are handled by dedicated sections below, not in the
  // generic grouped grid.
  const dedicatedRenderTypes = new Set([
    "boolean_feature",
    "material_card",
    "application_card",
    "comparison_row",
    "gallery_block",
    "packing_block",
    "download_block",
    "ai_fact",
    "brochure_block",
  ]);

  // ---- Grouped spec sections (ordered) ----
  type GroupBundle = { group: SpecGroup; fields: SpecField[] };
  const groupedSpecSections: GroupBundle[] = (schema?.groups ?? [])
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
            !isEmptyValue(values[f.key]),
        );
      return { group, fields };
    })
    .filter((b) => b.fields.length > 0);

  // ---- Material cards ----
  const materialEntries = visibleFields
    .filter((f) => f.visualRenderType === "material_card")
    .map((field) => ({ field, selected: selectedValuesOf(values[field.key]) }))
    .filter((e) => e.selected.length > 0);

  // ---- Application cards ----
  const applicationEntries = visibleFields
    .filter((f) => f.visualRenderType === "application_card")
    .map((field) => ({ field, selected: selectedValuesOf(values[field.key]) }))
    .filter((e) => e.selected.length > 0);

  // ---- Comparison rows ----
  const comparisonFields = visibleFields.filter(
    (f) =>
      f.visualRenderType === "comparison_row" && !isEmptyValue(values[f.key]),
  );

  // ---- Media-derived flags ----
  const hasGallery = Array.isArray(galleryUrls) && galleryUrls.length > 0;
  const hasVideos = Array.isArray(videoUrls) && videoUrls.length > 0;
  const hasManuals = Array.isArray(manuals) && manuals.length > 0;

  // ---- Hero meta chips ----
  const machineKindLabel = schema?.name ?? schema?.machineKindId ?? null;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 p-6 md:p-8 space-y-8">
      {/* 1. Hero */}
      <div className="rounded-2xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-surface-subtle)]">
        <div className="relative w-full aspect-[16/9] bg-[var(--bg-primary)] flex items-center justify-center">
          {mainImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mainImageUrl}
              alt={productName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm text-[var(--text-faint)]">
              No main image
            </span>
          )}
        </div>
        <div className="p-5 md:p-6 space-y-3">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] leading-tight">
              {productName || "Untitled product"}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              {primaryModel ? (
                <span className="font-mono text-sm text-[var(--text-ghost)]">
                  {primaryModel}
                </span>
              ) : null}
              {brand ? (
                <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                  {brand}
                </span>
              ) : null}
              {machineKindLabel ? (
                <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                  {machineKindLabel}
                </span>
              ) : null}
            </div>
          </div>
          {tagline ? (
            <p className="text-base italic text-[var(--text-secondary)]">
              {tagline}
            </p>
          ) : null}
          {warranty || countryOfOrigin ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {warranty ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                  <span className="uppercase tracking-wider text-[var(--text-ghost)]">
                    Warranty
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {warranty}
                  </span>
                </span>
              ) : null}
              {countryOfOrigin ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                  <span className="uppercase tracking-wider text-[var(--text-ghost)]">
                    Origin
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {countryOfOrigin}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* 2. Compliance & feature badges */}
      {badgeFields.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {badgeFields.map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center rounded-full border border-emerald-500/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300"
            >
              {f.label ?? f.key}
            </span>
          ))}
        </div>
      ) : null}

      {/* 3. Material cards */}
      {materialEntries.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Suitable Materials</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {materialEntries.flatMap(({ field, selected }) =>
              selected.map((val) => {
                const option = field.options?.find((o) => o.value === val);
                const label = labelForOption(field, val);
                const visual = resolveOptionVisual(field, option, val);
                return (
                  <div
                    key={`${field.key}-${val}`}
                    className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2"
                    title={visual.description ?? label}
                  >
                    <div
                      className="relative flex items-center justify-center rounded-lg overflow-hidden border border-[var(--border-subtle)]"
                      style={{ width: 80, height: 80 }}
                    >
                      {option?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={option.image}
                          alt={label}
                          className="h-full w-full object-cover"
                        />
                      ) : visual.swatch ? (
                        /* Muted material swatch + subtle woven texture. */
                        <div
                          className="h-full w-full"
                          style={{
                            backgroundColor: visual.swatch,
                            backgroundImage:
                              "repeating-linear-gradient(45deg, rgba(0,0,0,0.10) 0 2px, transparent 2px 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 4px)",
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono font-bold">
                          <span className="text-lg">{getInitials(label)}</span>
                        </div>
                      )}
                    </div>
                    <span className="mt-2 text-[11px] font-medium text-[var(--text-primary)] text-center">
                      {label}
                    </span>
                    {visual.description ? (
                      <span className="mt-0.5 text-[9.5px] leading-tight text-[var(--text-ghost)] text-center line-clamp-2">
                        {visual.description}
                      </span>
                    ) : null}
                  </div>
                );
              }),
            )}
          </div>
        </section>
      ) : null}

      {/* 4. Application cards */}
      {applicationEntries.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Applications</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {applicationEntries.flatMap(({ field, selected }) =>
              selected.map((val) => {
                const option = field.options?.find((o) => o.value === val);
                const label = labelForOption(field, val);
                const visual = resolveOptionVisual(field, option, val);
                return (
                  <div
                    key={`${field.key}-${val}`}
                    className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2"
                    title={visual.description ?? label}
                  >
                    <div
                      className="flex items-center justify-center rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden"
                      style={{ width: 80, height: 80 }}
                    >
                      {option?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={option.image}
                          alt={label}
                          className="h-full w-full object-cover"
                        />
                      ) : visual.icon ? (
                        <VisualGlyph token={visual.icon} className="h-9 w-9 text-[var(--text-secondary)]" />
                      ) : (
                        <span className="font-mono font-bold text-lg">{getInitials(label)}</span>
                      )}
                    </div>
                    <span className="mt-2 text-[11px] font-medium text-[var(--text-primary)] text-center">
                      {label}
                    </span>
                  </div>
                );
              }),
            )}
          </div>
        </section>
      ) : null}

      {/* 5. Grouped visual spec sections (ordered) */}
      {groupedSpecSections.map(({ group, fields }) => (
        <section key={group.id} className="space-y-3">
          <SectionTitle>{group.title}</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {fields.map((f) => renderField(f))}
          </div>
        </section>
      ))}

      {/* 6. Comparison rows */}
      {comparisonFields.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Comparison</SectionTitle>
          <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
            {comparisonFields.map((f, idx) => (
              <div
                key={f.key}
                className={`flex items-center justify-between gap-4 px-4 py-2.5 ${
                  idx % 2 === 0 ? "bg-[var(--bg-surface-subtle)]" : ""
                }`}
              >
                <span className="text-xs text-[var(--text-secondary)]">
                  {f.label ?? f.key}
                </span>
                <span className="text-sm font-medium text-[var(--text-primary)] text-end">
                  {displayScalar(values[f.key])}
                  {f.unit ? (
                    <span className="ms-1 text-xs text-[var(--text-ghost)]">
                      {f.unit}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 7. Feature list (overflow booleans) */}
      {remainingBooleanFields.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Features</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {remainingBooleanFields.map((f) => (
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

      {/* 8. Gallery grid */}
      {hasGallery ? (
        <section className="space-y-3">
          <SectionTitle>Gallery</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {galleryUrls!.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="aspect-square overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${productName} ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 9. Videos */}
      {hasVideos ? (
        <section className="space-y-3">
          <SectionTitle>Videos</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {videoUrls!.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]"
              >
                <video
                  controls
                  preload="metadata"
                  className="h-full w-full"
                  src={url}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 10. AR / 3D placeholder */}
      {ar3dUrl ? (
        <section className="space-y-3">
          <SectionTitle>3D / AR</SectionTitle>
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-6 text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              3D / AR view available
            </p>
            <p className="mt-1 text-xs text-[var(--text-ghost)]">
              Interactive model attached to this product.
            </p>
          </div>
        </section>
      ) : null}

      {/* 11. Manuals / datasheets */}
      {hasManuals ? (
        <section className="space-y-3">
          <SectionTitle>Manuals &amp; Datasheets</SectionTitle>
          <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
            {manuals!.map((m, i) => (
              <a
                key={`${m.url}-${i}`}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className={`flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-[var(--bg-surface)] ${
                  i > 0 ? "border-t border-[var(--border-subtle)]" : ""
                }`}
              >
                <span className="truncate text-[var(--text-primary)]">
                  {m.label || fileNameFromUrl(m.url)}
                </span>
                <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                  Download
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* 12. Knowledge blocks (all surface-visible types) */}
      {visibleKnowledge.length > 0 ? (
        <section className="space-y-6">
          {visibleKnowledge.map((block, idx) => {
            const content = block.content as unknown;

            // buyer_questions: { questions: [{ question, answer }] }
            const questions =
              content &&
              typeof content === "object" &&
              !Array.isArray(content) &&
              Array.isArray(
                (content as { questions?: unknown }).questions,
              )
                ? ((content as { questions: unknown[] }).questions as Array<{
                    question?: string;
                    answer?: string;
                  }>)
                : null;

            const recordEntries =
              !questions &&
              content &&
              typeof content === "object" &&
              !Array.isArray(content)
                ? Object.entries(content as Record<string, unknown>)
                : null;

            return (
              <div key={`${block.type}-${idx}`} className="space-y-2">
                {block.title ? (
                  <SectionTitle>{block.title}</SectionTitle>
                ) : null}

                {typeof content === "string" ? (
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
                    {content}
                  </p>
                ) : Array.isArray(content) ? (
                  <ul className="list-disc ps-5 space-y-1 text-sm text-[var(--text-primary)]">
                    {(content as unknown[]).map((item, i) => (
                      <li key={i}>{String(item)}</li>
                    ))}
                  </ul>
                ) : questions ? (
                  <div className="space-y-3">
                    {questions.map((qa, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-1"
                      >
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {qa.question}
                        </p>
                        {qa.answer ? (
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            {qa.answer}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : recordEntries ? (
                  <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
                    {recordEntries.map(([k, v], i) => (
                      <div
                        key={k}
                        className={`flex items-start justify-between gap-4 px-4 py-2.5 ${
                          i % 2 === 0 ? "bg-[var(--bg-surface-subtle)]" : ""
                        }`}
                      >
                        <span className="text-xs text-[var(--text-secondary)]">
                          {k}
                        </span>
                        <span className="text-sm text-[var(--text-primary)] text-end">
                          {Array.isArray(v)
                            ? (v as unknown[]).map((x) => String(x)).join(", ")
                            : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}

      {/* 13. Media count strip */}
      {mediaCounts ? (
        <div className="border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-ghost)]">
          {`${mediaCounts.photos ?? 0} photos · ${mediaCounts.videos ?? 0} videos · ${mediaCounts.manuals ?? 0} manuals`}
        </div>
      ) : null}
    </div>
  );
};

export default ProductPreview;
