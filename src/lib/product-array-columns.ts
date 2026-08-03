/* ---------------------------------------------------------------------------
   The `products` columns that are Postgres text[] rather than text.

   Verified against information_schema — these eight are the complete set:
     alternate_names, colors, frequency_hz, highlights,
     plug_types, support_channels, tags, voltage

   They matter because several of them are fed by SCALAR spec fields
   (voltage_options is a `select`, frequency_hz a `unit_number`). Writing a
   scalar straight into one produced `malformed array literal: "220V"`, a
   500, and an operator staring at "Failed to create product" with no way
   to know why. Both the form and the API now coerce through this one list,
   so the shape can't drift between them.
   --------------------------------------------------------------------------- */

export const PRODUCT_ARRAY_COLUMNS = new Set([
  "alternate_names",
  "colors",
  "frequency_hz",
  "highlights",
  "plug_types",
  "support_channels",
  "tags",
  "voltage",
]);

/** Coerce a value destined for a text[] column into a string array.
    Returns null when nothing meaningful is left (caller should omit the key). */
export function toTextArray(value: unknown): string[] | null {
  const arr = (Array.isArray(value) ? value : [value])
    .filter((x) => x !== null && x !== undefined && x !== "")
    .map((x) => String(x));
  return arr.length > 0 ? arr : null;
}

/** Server-side guard: whatever a caller sends, array columns receive arrays.
    Mutates and returns the same object for use right before insert/update. */
export function coerceProductArrayColumns(body: Record<string, unknown>): Record<string, unknown> {
  for (const col of PRODUCT_ARRAY_COLUMNS) {
    if (!(col in body)) continue;
    const v = body[col];
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) continue;
    const arr = toTextArray(v);
    if (arr) body[col] = arr;
    else delete body[col];
  }
  return body;
}
