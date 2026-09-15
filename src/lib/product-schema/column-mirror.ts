/* ---------------------------------------------------------------------------
   Schema ↔ legacy-column mirror — shared by the product editor and the
   product profile's in-place sheets, so a spec saved from either place lands
   in both homes. Moved out of ProductForm unchanged.
   --------------------------------------------------------------------------- */

import { PRODUCT_ARRAY_COLUMNS, toTextArray } from "@/lib/product-array-columns";

/* ═══════════════════════════════════════════════════════════════════
   SCHEMA ↔ LEGACY-COLUMN MIRROR
   ───────────────────────────────────────────────────────────────────
   The schema-driven Specs editor (products.schema_specs jsonb) and the
   legacy "Technical Details" block (typed products.* columns) historically
   captured the SAME ~20 fields, so an operator entered e.g. plug_types
   twice and the two copies could diverge.

   Resolution (no migration): the schema editor is the SINGLE input; the
   matching typed columns are hidden in the Technical block when the active
   schema covers them, and mirrored from schema_specs → columns at save so
   legacy readers (LegacyProductView, public API) keep working. Retiring the
   columns entirely is a later, sign-off step once those readers move to
   schema_specs.
   ═══════════════════════════════════════════════════════════════════ */
export const SCHEMA_KEY_TO_COLUMN: Record<string, string> = {
  voltage_options: "voltage",
  frequency_hz: "frequency_hz",
  motor_power_w: "motor_power_w",
  power_consumption_w: "power_consumption_w",
  phase: "phase",
  plug_types: "plug_types",
  pneumatic_supply_required: "pneumatic_supply",
  machine_dimensions: "machine_dimensions",
  machine_weight_kg: "machine_weight_kg",
  hs_code: "hs_code",
  ip_rating: "ip_rating",
  operating_temperature: "operating_temp",
  ce_certified: "ce_certified",
  rohs_compliant: "rohs_compliant",
  oil_mist_filter: "oil_mist_filter",
  colors: "colors",
  moq: "moq",
  lead_time: "lead_time",
  supports_head_only: "supports_head_only",
  supports_complete_set: "supports_complete_set",
};

/* Build the set of typed columns the active schema covers (so the Technical
   block can hide those fields). Empty set when no schema is resolved. */
/* One schema key can retire MULTIPLE legacy columns — e.g. the schema's
   power_consumption_w is THE power input, so the legacy "Motor Power" column
   must hide too; a bar-valued air_pressure supersedes the yes/no
   pneumatic_supply toggle. Pure de-duplication: one meaning, one input. */
const SCHEMA_KEY_COVERS_EXTRA: Record<string, string[]> = {
  power_consumption_w: ["motor_power_w"],
  air_pressure: ["pneumatic_supply"],
};

export function computeSchemaCoveredColumns(
  schema: { groups?: { fields?: { key: string }[] }[] } | null | undefined,
): Set<string> {
  if (!schema?.groups) return new Set();
  const keys = new Set(schema.groups.flatMap((g) => (g.fields ?? []).map((f) => f.key)));
  const covered = new Set(
    Object.entries(SCHEMA_KEY_TO_COLUMN)
      .filter(([sk]) => keys.has(sk))
      .map(([, col]) => col),
  );
  for (const [sk, cols] of Object.entries(SCHEMA_KEY_COVERS_EXTRA)) {
    if (keys.has(sk)) for (const c of cols) covered.add(c);
  }
  return covered;
}

/* Derive typed-column values from schema_specs for the overlap set, with the
   couple of shape conversions the columns need (dimension object → text,
   temperature range object → text). Only emits keys that are actually present
   in schema_specs so a partially-filled schema never nulls a legacy column. */

export function schemaColumnMirror(
  schema: { groups?: { fields?: { key: string }[] }[] } | null | undefined,
  specs: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!schema || !specs) return {};
  const out: Record<string, unknown> = {};
  for (const [sk, col] of Object.entries(SCHEMA_KEY_TO_COLUMN)) {
    const v = specs[sk];
    if (v === undefined || v === null || v === "") continue;
    if (col === "machine_dimensions" && typeof v === "object" && !Array.isArray(v)) {
      const d = v as { length?: number; width?: number; height?: number };
      const parts = [d.length, d.width, d.height].filter((n) => n != null);
      out[col] = parts.length ? `${parts.join(" × ")} mm` : null;
    } else if (col === "operating_temp" && typeof v === "object" && !Array.isArray(v)) {
      const r = v as { min?: number; max?: number };
      out[col] = `${r.min ?? ""}–${r.max ?? ""} °C`;
    } else if (sk === "power_consumption_w" && typeof v === "number") {
      /* The schema field is kilowatts (decimal ratings like 6.5 kW are real —
         see _shared-machine-groups suggestions), but this legacy column stores
         integer WATTS and its readers render "${v} W". Mirroring the raw kW
         value wrote 6.5 into an integer column and Postgres rejected the whole
         save: invalid input syntax for type integer: "6.5". */
      out[col] = Math.round(v * 1000);
    } else if (PRODUCT_ARRAY_COLUMNS.has(col)) {
      /* THE product-save killer (fixed 2026-08-03): these legacy columns
         are Postgres ARRAYs, but their schema fields are scalars —
         voltage_options is a `select`, frequency_hz a `unit_number`.
         Writing the raw scalar produced `malformed array literal: "220V"`
         → 500 → the operator only ever saw "Failed to create product".
         Coerce to a text array; drop empties so we never write [""]. */
      const arr = toTextArray(v);
      if (arr) out[col] = arr;
    } else if (Array.isArray(v)) {
      /* Mirror image: a multi-value spec pointed at a scalar column. */
      out[col] = v.map((x) => String(x)).join(", ");
    } else {
      out[col] = v;
    }
  }
  /* air_pressure isn't in the column map (different shapes) but a positive
     bar value means the machine needs compressed air — keep the legacy
     boolean truthful for its remaining readers. */
  const air = specs["air_pressure"];
  if (typeof air === "number" && air > 0) out["pneumatic_supply"] = true;
  return out;
}

