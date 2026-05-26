"use client";

/* ---------------------------------------------------------------------------
   SectionRenderer — one card per template section.

   Renders the section header + a grid of FieldRenderers. The grid is
   single-column on mobile and two-column on desktop. Keep it simple —
   future phases can introduce per-field layout hints (column-span,
   inline groups) via field.options_json without changing this file.
   --------------------------------------------------------------------------- */

import FieldRenderer from "./FieldRenderer";
import type {
  ProductTemplateField,
  ProductTemplateSection,
  FieldValueMap,
} from "@/lib/product-templates/types";

interface Props {
  section: ProductTemplateSection & { fields: ProductTemplateField[] };
  values: FieldValueMap;
  onFieldChange: (key: string, next: unknown) => void;
  disabled?: boolean;
}

/* Field types that work best at full width because they're inherently
   wide / multi-row. */
const FULL_WIDTH_TYPES = new Set([
  "rich_text",
  "multi_select",
  "icon_select",
  "image_select",
  "color_select",
  "repeater",
  "feature_cards",
]);

export default function SectionRenderer({
  section,
  values,
  onFieldChange,
  disabled,
}: Props) {
  return (
    <section
      id={`section-${section.slug}`}
      className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 sm:p-5"
    >
      {/* Section header */}
      <header className="mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-black dark:text-white">
          {section.title}
        </h2>
        {section.description && (
          <p className="mt-0.5 text-[11.5px] text-black/50 dark:text-white/45">
            {section.description}
          </p>
        )}
      </header>

      {/* Fields grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {section.fields.map((field) => (
          <div
            key={field.id}
            className={FULL_WIDTH_TYPES.has(field.field_type) ? "sm:col-span-2" : ""}
          >
            <FieldRenderer
              field={field}
              value={values[field.field_key]}
              onChange={(v) => onFieldChange(field.field_key, v)}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
