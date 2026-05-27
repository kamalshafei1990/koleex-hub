"use client";

/* ---------------------------------------------------------------------------
   SectionRenderer — one collapsible card per template section.

   Renders the section header (with title, optional description, a
   per-section "X/Y filled" pill, and a chevron) + a grid of
   FieldRenderers. Phase 2.1 adds collapse/expand and progress.

   Single-column on mobile, two-column on desktop. Future phases can
   introduce per-field layout hints (column-span, inline groups) via
   field.options_json without changing this file.
   --------------------------------------------------------------------------- */

import { useState } from "react";
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
  /** Initial expand state. Default true. */
  defaultOpen?: boolean;
}

const FULL_WIDTH_TYPES = new Set([
  "rich_text",
  "multi_select",
  "icon_select",
  "image_select",
  "color_select",
  "repeater",
  "feature_cards",
]);

function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "boolean") return v === true;
  return true;
}

export default function SectionRenderer({
  section,
  values,
  onFieldChange,
  disabled,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const total = section.fields.length;
  const filled = section.fields.reduce(
    (n, f) => (isFilled(values[f.field_key]) ? n + 1 : n),
    0,
  );
  const complete = total > 0 && filled === total;

  return (
    <section
      id={`section-${section.slug}`}
      className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden"
    >
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-3 p-4 sm:p-5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-black dark:text-white">
            {section.title}
          </h2>
          {section.description && (
            <p className="mt-0.5 text-[11.5px] text-black/50 dark:text-white/45">
              {section.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${
              complete
                ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
                : filled > 0
                  ? "bg-black/[0.05] text-black/65 dark:bg-white/[0.06] dark:text-white/65"
                  : "bg-black/[0.03] text-black/40 dark:bg-white/[0.04] dark:text-white/40"
            }`}
          >
            {filled}/{total}
          </span>
          <span
            aria-hidden
            className={`text-black/50 dark:text-white/45 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {section.fields.map((field) => (
              <div
                key={field.id}
                className={
                  FULL_WIDTH_TYPES.has(field.field_type) ? "sm:col-span-2" : ""
                }
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
        </div>
      )}
    </section>
  );
}
