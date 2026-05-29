"use client";

import { useMemo } from "react";
import type {
  ProductSchemaDefinition,
  ProductKnowledgeBlock,
  ProductSchemaSurface,
  SpecField,
} from "@/types/product-schema";
import {
  filterFieldsForSurface,
  filterKnowledgeForSurface,
} from "@/lib/product-schema";

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

const labelForOption = (
  field: SpecField,
  optionValue: string,
): string => {
  const found = field.options?.find((o) => o.value === optionValue);
  return found?.label ?? optionValue;
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
    mediaCounts,
    surface,
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

  // Compliance / boolean feature badges (true booleans only)
  const booleanFields = visibleFields.filter(
    (f) => f.visualRenderType === "boolean_feature",
  );
  const trueBooleanFields = booleanFields.filter(
    (f) => values[f.key] === true,
  );
  const badgeFields = trueBooleanFields.slice(0, 8);
  const badgeKeys = new Set(badgeFields.map((f) => f.key));
  const remainingBooleanFields = trueBooleanFields.filter(
    (f) => !badgeKeys.has(f.key),
  );

  // Material cards
  const materialFields = visibleFields.filter(
    (f) => f.visualRenderType === "material_card",
  );
  const materialEntries: Array<{ field: SpecField; selected: string[] }> =
    materialFields
      .map((f) => {
        const raw = values[f.key];
        const selected = Array.isArray(raw)
          ? (raw as string[])
          : typeof raw === "string" && raw
            ? [raw]
            : [];
        return { field: f, selected };
      })
      .filter((e) => e.selected.length > 0);

  // Application cards
  const applicationFields = visibleFields.filter(
    (f) => f.visualRenderType === "application_card",
  );
  const applicationEntries: Array<{
    field: SpecField;
    selected: string[];
  }> = applicationFields
    .map((f) => {
      const raw = values[f.key];
      const selected = Array.isArray(raw)
        ? (raw as string[])
        : typeof raw === "string" && raw
          ? [raw]
          : [];
      return { field: f, selected };
    })
    .filter((e) => e.selected.length > 0);

  // Specs (metric_block + spec_card)
  const specFields = visibleFields.filter(
    (f) =>
      (f.visualRenderType === "metric_block" ||
        f.visualRenderType === "spec_card") &&
      !isEmptyValue(values[f.key]),
  );

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
            </div>
          </div>
          {tagline ? (
            <p className="text-base italic text-[var(--text-secondary)]">
              {tagline}
            </p>
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

      {/* 3. Material chips */}
      {materialEntries.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Suitable Materials
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {materialEntries.flatMap(({ field, selected }) =>
              selected.map((val) => {
                const label = labelForOption(field, val);
                return (
                  <div
                    key={`${field.key}-${val}`}
                    className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2"
                  >
                    <div
                      className="flex items-center justify-center rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono font-bold"
                      style={{ width: 80, height: 80 }}
                    >
                      <span className="text-lg">{getInitials(label)}</span>
                    </div>
                    <span className="mt-2 text-[11px] text-[var(--text-secondary)] text-center">
                      {label}
                    </span>
                  </div>
                );
              }),
            )}
          </div>
        </section>
      ) : null}

      {/* 4. Application chips */}
      {applicationEntries.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Applications
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {applicationEntries.flatMap(({ field, selected }) =>
              selected.map((val) => {
                const label = labelForOption(field, val);
                return (
                  <div
                    key={`${field.key}-${val}`}
                    className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2"
                  >
                    <div
                      className="flex items-center justify-center rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono font-bold"
                      style={{ width: 80, height: 80 }}
                    >
                      <span className="text-lg">{getInitials(label)}</span>
                    </div>
                    <span className="mt-2 text-[11px] text-[var(--text-secondary)] text-center">
                      {label}
                    </span>
                  </div>
                );
              }),
            )}
          </div>
        </section>
      ) : null}

      {/* 5. Key Specs */}
      {specFields.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Key Specs
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {specFields.map((f) => {
              const raw = values[f.key];
              const displayValue = Array.isArray(raw)
                ? raw.join(", ")
                : String(raw);
              if (f.visualRenderType === "metric_block") {
                return (
                  <div
                    key={f.key}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-1"
                  >
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                        {displayValue}
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
              return (
                <div
                  key={f.key}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-1"
                >
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-ghost)]">
                    {f.label ?? f.key}
                  </div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {displayValue}
                    {f.unit ? (
                      <span className="ml-1 text-xs text-[var(--text-ghost)]">
                        {f.unit}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 6. Feature list */}
      {remainingBooleanFields.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Features
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {remainingBooleanFields.map((f) => (
              <div
                key={f.key}
                className="flex items-center gap-2 text-sm text-[var(--text-primary)]"
              >
                <span className="text-emerald-600 dark:text-emerald-300">
                  ✓
                </span>
                <span>{f.label ?? f.key}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 7. Knowledge blocks */}
      {visibleKnowledge.length > 0 ? (
        <section className="space-y-6">
          {visibleKnowledge
            .filter(
              (b) => b.type === "overview" || b.type === "key_features",
            )
            .map((block, idx) => {
              const content = block.content as unknown;
              return (
                <div
                  key={`${block.type}-${idx}`}
                  className="space-y-2"
                >
                  {block.title ? (
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      {block.title}
                    </h3>
                  ) : null}
                  {typeof content === "string" ? (
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                      {content}
                    </p>
                  ) : Array.isArray(content) ? (
                    <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-primary)]">
                      {(content as unknown[]).map((item, i) => (
                        <li key={i}>{String(item)}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
        </section>
      ) : null}

      {/* 8. Media count strip */}
      {mediaCounts ? (
        <div className="border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-ghost)]">
          {`${mediaCounts.photos ?? 0} photos · ${mediaCounts.videos ?? 0} videos · ${mediaCounts.manuals ?? 0} manuals`}
        </div>
      ) : null}
    </div>
  );
};

export default ProductPreview;
