/* ---------------------------------------------------------------------------
   product-templates/validate.ts

   Server-side value validation. Runs before any upsert into
   product_field_values so the DB only ever stores shapes that match
   the field's declared field_type.

   Phase 1 keeps it intentionally simple: shape + basic constraint
   checks. Future phases can extend with regex / range / cross-field
   validation without changing call sites.

   Returns null when the value is valid; otherwise a short, human-
   readable error string ("Expected number", "Expected array of options").
   --------------------------------------------------------------------------- */

import type { ProductTemplateField } from "./types";

/* Soft cap on stringified value length BEFORE storage. The DB also
   enforces a column-size CHECK (~64 KB), but failing here gives a
   better error message. */
const MAX_TEXT_LEN = 10_000;
const MAX_REPEATER_ROWS = 200;

export function validateValueShape(
  field: ProductTemplateField,
  value: unknown,
): string | null {
  /* Null / undefined means "clear this field" — always allowed. The
     API caller maps undefined → delete. */
  if (value === null || value === undefined) return null;

  switch (field.field_type) {
    case "text":
    case "rich_text":
      if (typeof value !== "string") return "Expected string";
      if (value.length > MAX_TEXT_LEN)
        return `Text too long (max ${MAX_TEXT_LEN} chars)`;
      return null;

    case "number":
    case "measurement":
      if (typeof value !== "number" || !Number.isFinite(value))
        return "Expected a finite number";
      return null;

    case "boolean":
      if (typeof value !== "boolean") return "Expected true or false";
      return null;

    case "select":
    case "icon_select":
    case "image_select":
    case "color_select": {
      if (typeof value !== "string") return "Expected single option (string)";
      const allowed = extractOptionValues(field);
      if (allowed.length > 0 && !allowed.includes(value))
        return `Value "${value}" is not one of the allowed options`;
      return null;
    }

    case "multi_select": {
      if (!Array.isArray(value)) return "Expected an array of options";
      if (!value.every((v) => typeof v === "string"))
        return "All options must be strings";
      const allowed = extractOptionValues(field);
      if (allowed.length > 0) {
        const bad = (value as string[]).find((v) => !allowed.includes(v));
        if (bad) return `Value "${bad}" is not one of the allowed options`;
      }
      return null;
    }

    case "media":
    case "file":
      if (typeof value !== "string") return "Expected a URL string";
      if (!/^https?:\/\//i.test(value))
        return "URL must start with http:// or https://";
      if (value.length > 2048) return "URL too long";
      return null;

    case "repeater":
    case "feature_cards": {
      if (!Array.isArray(value)) return "Expected an array of rows";
      if (value.length > MAX_REPEATER_ROWS)
        return `Too many rows (max ${MAX_REPEATER_ROWS})`;
      for (let i = 0; i < value.length; i += 1) {
        const row = value[i];
        if (!row || typeof row !== "object" || Array.isArray(row))
          return `Row ${i + 1} must be an object`;
      }
      return null;
    }

    default:
      /* Forward-compat: if a new field_type lands in the DB before this
         switch is updated, accept the value but log it (the renderer's
         defensive default will flag it visually). */
      return null;
  }
}

function extractOptionValues(field: ProductTemplateField): string[] {
  const raw = field.options_json;
  if (!raw || typeof raw !== "object") return [];
  const arr = (raw as { options?: unknown }).options;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((o) =>
      o && typeof o === "object" && typeof (o as { value?: unknown }).value === "string"
        ? ((o as { value: string }).value)
        : null,
    )
    .filter((v): v is string => v !== null);
}
