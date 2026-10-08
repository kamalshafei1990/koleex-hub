/* ---------------------------------------------------------------------------
   Computed spec fields — derive one field's value from another (CBM from a
   packing L×W×H, container quantities from CBM).

   Lives in its own module because BOTH front-ends need it: the editor's
   SchemaSpecsSection and the profile's in-place Specs sheet. Importing it from
   the editor's 995-line component pulled that whole component — and its portal,
   visual-option registry and unit pickers — into the record's paint path for
   the sake of one pure function.
   --------------------------------------------------------------------------- */

import type { SpecField } from "@/types/product-schema";

/* ── computed fields ───────────────────────────────────────────────
   Derive one field's value from another (e.g. CBM from packing L×W×H). */

/* Parse an "L×W×H" string in mm (any separator: × x * , space) → m³, or null
   when fewer than three positive numbers are present. Rounded to 3 dp. */
const cbmFromMmDimensions = (raw: unknown): number | null => {
  if (typeof raw !== "string") return null;
  const nums = (raw.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0);
  if (nums.length < 3) return null;
  const [l, w, h] = nums;
  const cbm = (l * w * h) / 1_000_000_000;
  if (!Number.isFinite(cbm) || cbm <= 0) return null;
  return Math.round(cbm * 1000) / 1000;
};

/* PRACTICAL loading capacity (m³), not the brochure volume: real stuffing of
   crated machinery loses space to crate shape, dunnage and door clearance.
   Industry rule-of-thumb usable volumes — the operator can always override
   the result by typing (e.g. when units stack or interlock). */
const CONTAINER_USABLE_CBM = { c20: 28, c40: 58, c40hq: 68 } as const;

const qtyFromCbm = (raw: unknown, capacity: number): number | null => {
  const cbm = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(cbm) || cbm <= 0) return null;
  const qty = Math.floor(capacity / cbm);
  return qty >= 1 ? qty : 0;
};

export const computeDerivedValue = (
  formula: NonNullable<SpecField["computed"]>["formula"],
  sourceRaw: unknown,
): number | null => {
  switch (formula) {
    case "cbm_m3_from_mm_dimensions":
      return cbmFromMmDimensions(sourceRaw);
    case "qty_per_20ft_from_cbm":
      return qtyFromCbm(sourceRaw, CONTAINER_USABLE_CBM.c20);
    case "qty_per_40ft_from_cbm":
      return qtyFromCbm(sourceRaw, CONTAINER_USABLE_CBM.c40);
    case "qty_per_40hq_from_cbm":
      return qtyFromCbm(sourceRaw, CONTAINER_USABLE_CBM.c40hq);
    case "copy_number": {
      const n = typeof sourceRaw === "number" ? sourceRaw : Number(sourceRaw);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    default:
      return null;
  }
};
