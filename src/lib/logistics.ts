/* ---------------------------------------------------------------------------
   logistics — the packing & shipping model shared by every product.

   One shape, one set of sums, one loading calculation, used by the Product
   Data form today and by whatever prints a packing list tomorrow. No React
   here on purpose: the same numbers have to come out on the server.
   --------------------------------------------------------------------------- */

/* What is inside a crate, and inside the boxes inside it.
 *
 * A packing list is a nesting, not a flat list: the machine crate holds the
 * machine and an accessories box, and the accessories box holds the cover, the
 * tool kit, the spare needles. One level of children covers every case the Hub
 * actually ships; anything deeper is a second crate in practice. */
export interface ContentItem {
  label?: string;
  qty?: number | string;
  /** Uploaded photo of the item. Takes precedence over `kind`. */
  photo_url?: string | null;
  /** Fallback glyph when there is no photo — see ITEM_KINDS. */
  kind?: string;
  /** What is inside THIS item, when it is itself a box. */
  items?: ContentItem[];
}

export interface PackageRow {
  /** What is in this crate — "Machine", "Table & rails", "Accessories". */
  label?: string;
  /** How many crates of THIS kind ship with one unit of the product. */
  qty?: number | string;
  l_cm?: number | string;
  w_cm?: number | string;
  h_cm?: number | string;
  /** Gross weight of ONE crate of this kind. */
  gross_kg?: number | string;
  /** Photo of this crate, packed. */
  photo_url?: string | null;
  /** The packing list for this crate. */
  contents?: ContentItem[];
}

export interface DangerousGoods {
  has?: boolean;
  /** lithium_battery | oil_filled | magnet | aerosol | flammable | other */
  kinds?: string[];
  un_numbers?: string;
  notes?: string;
}

/* HOW THE PRODUCT RELATES TO ITS PACKAGE — the two cases are opposites and a
 * single model cannot serve both.
 *
 *   per_unit    one unit of the product occupies N packages. A spreader is
 *               machine + table + accessory box: three crates, one machine.
 *   per_package one package holds N units. The owner's case: "the product
 *               itself is small and the box can take 25, 50 or 100 pieces
 *               depending on the box size." The customer asks how many per
 *               carton, and the container count is packages × pieces.
 *
 * Everything downstream — volume per unit, weight per unit, units per
 * container — depends on which of the two this product is. */
export type PackingMode = "per_unit" | "per_package";

export interface ProductLogistics {
  packing_mode?: PackingMode;
  /** per_package only: pieces of the product in ONE package. */
  units_per_package?: number | string;
  /** The big sample photo of how this product is packed. */
  packing_photo_url?: string | null;
  packing_type?: string;
  wood_treatment?: string;
  packages?: PackageRow[];
  net_weight_kg?: number | string;
  gross_weight_kg?: number | string;
  cbm?: number | string;
  volumetric_kg?: number | string;
  stackable?: boolean;
  stack_max?: number | string;
  qty_20ft?: number | string;
  qty_40ft?: number | string;
  qty_40hq?: number | string;
  dangerous_goods?: DangerousGoods;
  port_of_loading?: string;
  origin_certificate?: string;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
};

/* ── containers ────────────────────────────────────────────────────────────
   Internal usable dimensions in cm and practical payload in kg. Payload is
   the container's own limit; a road leg can be stricter (many countries cap a
   loaded 20ft below its sea payload), which is why every derived quantity on
   the form stays editable.

   THE PAYLOAD LINE IS THE POINT OF THIS TABLE. The old calculation divided the
   container's cubic metres by the product's CBM and stopped there, so a 1 m³
   machine weighing 1.5 t came out at 28 per 20ft — 42 tonnes in a box that
   carries 25. That number could go out in a quotation and only be discovered
   at the port. */
export const CONTAINERS = {
  c20:   { label: "20ft",  l: 589, w: 234, h: 239, payload_kg: 25_000 },
  c40:   { label: "40ft",  l: 1203, w: 234, h: 239, payload_kg: 26_000 },
  c40hq: { label: "40HQ", l: 1203, w: 234, h: 269, payload_kg: 26_000 },
} as const;

/* Stuffing is never perfect: crates do not tessellate, dunnage and door
   clearance eat space. Applied to the floor count, not the weight. */
const STUFFING_EFFICIENCY = 0.9;

export interface PackageSums {
  /** Crates per unit of product (sum of each row's qty). */
  packageCount: number;
  /** m³ for ONE unit of the product, all its crates together. */
  cbm: number;
  /** kg for ONE unit, all crates together. */
  grossKg: number;
  /** Air-freight chargeable weight, cm³ / 6000. */
  volumetricKg: number;
}

export function sumPackages(rows: PackageRow[] | undefined | null): PackageSums {
  let packageCount = 0, cm3 = 0, grossKg = 0;
  for (const r of rows ?? []) {
    const qty = Math.max(0, num(r.qty) || (r.qty === undefined ? 1 : 0));
    const v = num(r.l_cm) * num(r.w_cm) * num(r.h_cm);
    packageCount += qty;
    cm3 += v * qty;
    grossKg += num(r.gross_kg) * qty;
  }
  return {
    packageCount,
    cbm: Math.round((cm3 / 1_000_000) * 1000) / 1000,
    grossKg: Math.round(grossKg * 100) / 100,
    volumetricKg: Math.round((cm3 / 6000) * 100) / 100,
  };
}

export interface LoadResult {
  qty: number;
  /** Which limit decided it — what to tell the operator. */
  limit: "weight" | "space" | "none";
}

/* How many UNITS of the product fit in one container.
 *
 * Geometry first, by footprint and layers rather than by raw volume: a crate
 * that cannot be stacked wastes everything above it, and dividing cubic metres
 * silently pretends it does not. Then the payload cap, and the smaller of the
 * two wins — which is the answer a forwarder would give.
 *
 * A product whose crates differ (machine + table + accessories) is loaded as a
 * SET: the set's footprint is the sum of its crates' footprints, so the count
 * is how many complete machines fit, never a mix of loose crates. */
export function unitsPerContainer(
  rows: PackageRow[] | undefined | null,
  container: { l: number; w: number; h: number; payload_kg: number },
  opts: { stackable?: boolean; stackMax?: number } = {},
): LoadResult {
  const list = (rows ?? []).filter((r) => num(r.l_cm) > 0 && num(r.w_cm) > 0 && num(r.h_cm) > 0);
  if (list.length === 0) return { qty: 0, limit: "none" };

  const floorArea = container.l * container.w * STUFFING_EFFICIENCY;
  const layersFor = (hCm: number) => {
    if (hCm <= 0) return 0;
    const fit = Math.floor(container.h / hCm);
    if (fit < 1) return 0;                       // taller than the container
    if (!opts.stackable) return 1;               // one layer, the rest is air
    const cap = Math.max(1, Math.floor(num(opts.stackMax) || 0) || fit);
    return Math.max(1, Math.min(fit, cap));
  };

  /* Footprint the SET needs, with each crate laid out in its own best layer
     count — a short accessory box stacks higher than the machine crate. */
  let areaPerUnit = 0;
  for (const r of list) {
    const qty = Math.max(1, num(r.qty) || 1);
    const layers = layersFor(num(r.h_cm));
    if (layers === 0) return { qty: 0, limit: "space" };
    areaPerUnit += (num(r.l_cm) * num(r.w_cm) * qty) / layers;
  }
  if (areaPerUnit <= 0) return { qty: 0, limit: "none" };

  const bySpace = Math.floor(floorArea / areaPerUnit);
  const grossPerUnit = sumPackages(list).grossKg;
  const byWeight = grossPerUnit > 0 ? Math.floor(container.payload_kg / grossPerUnit) : Infinity;

  const qty = Math.max(0, Math.min(bySpace, byWeight));
  return { qty, limit: byWeight < bySpace ? "weight" : "space" };
}

/** All three containers at once — what the form shows.
 *
 *  `unitsPerPackage` turns the answer from "how many SETS fit" into "how many
 *  PIECES fit" for a product that ships many to a carton: the geometry is the
 *  same, the multiplier is not. Without it the form would tell a customer a
 *  container holds 1,300 cartons and leave them to do the arithmetic that
 *  actually matters. */
export function loadPlan(
  rows: PackageRow[] | undefined | null,
  opts: { stackable?: boolean; stackMax?: number; unitsPerPackage?: number } = {},
): { c20: LoadResult; c40: LoadResult; c40hq: LoadResult } {
  const per = Math.max(1, Math.floor(num(opts.unitsPerPackage) || 1));
  const scale = (r: LoadResult): LoadResult => (per === 1 ? r : { ...r, qty: r.qty * per });
  return {
    c20: scale(unitsPerContainer(rows, CONTAINERS.c20, opts)),
    c40: scale(unitsPerContainer(rows, CONTAINERS.c40, opts)),
    c40hq: scale(unitsPerContainer(rows, CONTAINERS.c40hq, opts)),
  };
}

/* ── item glyphs ───────────────────────────────────────────────────────────
   A photo beats an icon every time, and the owner will have photos for the
   crate and the machine. But nobody photographs a tool kit, so an item with
   no photo still needs to be recognisable at a glance in a list. */
export const ITEM_KINDS = [
  { value: "machine",  label: "Machine / main unit" },
  { value: "box",      label: "Box / carton" },
  { value: "tools",    label: "Tools" },
  { value: "cable",    label: "Cable / power" },
  { value: "cover",    label: "Cover / protection" },
  { value: "parts",    label: "Spare parts" },
  { value: "docs",     label: "Manual / documents" },
] as const;

/** Flatten a package's contents for a packing list — parents first, then what
 *  is inside them, with quantities multiplied through the nesting. */
export function flattenContents(
  items: ContentItem[] | undefined | null,
  parentQty = 1,
): { label: string; qty: number; depth: number }[] {
  const out: { label: string; qty: number; depth: number }[] = [];
  const walk = (list: ContentItem[], mult: number, depth: number) => {
    for (const it of list ?? []) {
      const q = (num(it.qty) || 1) * mult;
      out.push({ label: (it.label || "").trim() || "—", qty: q, depth });
      if (it.items?.length) walk(it.items, q, depth + 1);
    }
  };
  walk(items ?? [], parentQty, 0);
  return out;
}

/* ── closed lists ──────────────────────────────────────────────────────── */

export const PACKING_TYPES = [
  { value: "wooden_case",   label: "Wooden Case" },
  { value: "plywood_crate", label: "Plywood Crate" },
  { value: "wooden_pallet", label: "Wooden Pallet (open)" },
  { value: "pallet_film",   label: "Pallet + Stretch Film" },
  { value: "carton",        label: "Carton" },
  { value: "foam_carton",   label: "Carton + Foam Inserts" },
  { value: "metal_frame",   label: "Metal Frame Crate" },
  { value: "bulk_loose",    label: "Container Bulk (unpacked)" },
] as const;

/* ISPM-15. Solid wood packaging crossing a border must be treated AND bear the
   IPPC mark; plywood, OSB and particleboard are manufactured and exempt. The
   answer belongs to the product because it is a property of how it is crated,
   and a shipment without it is held, fumigated at the port, or returned. */
export const WOOD_TREATMENTS = [
  { value: "not_wood",        label: "No wood packaging" },
  { value: "plywood_exempt",  label: "Plywood / processed — ISPM-15 exempt" },
  { value: "heat_treated",    label: "Solid wood — heat treated (HT)" },
  { value: "fumigated",       label: "Solid wood — fumigated (MB)" },
  { value: "untreated",       label: "Solid wood — untreated ⚠" },
] as const;

export const DG_KINDS = [
  { value: "lithium_battery", label: "Lithium battery (UN3480 / UN3481)" },
  { value: "oil_filled",      label: "Ships with oil / lubricant inside" },
  { value: "magnet",          label: "Strong magnets" },
  { value: "aerosol",         label: "Aerosol / pressurised" },
  { value: "flammable",       label: "Flammable liquid or solid" },
  { value: "other",           label: "Other regulated content" },
] as const;

/* What proves origin at the buyer's customs. Form E (ASEAN–China) and Form A
   carry a duty reduction; a plain CO does not. Egypt-bound shipments ask for
   it by name, which is why it is a field and not a note. */
export const ORIGIN_CERTIFICATES = [
  { value: "none",   label: "None" },
  { value: "co",     label: "Certificate of Origin (CO)" },
  { value: "form_a", label: "Form A (GSP)" },
  { value: "form_e", label: "Form E (ASEAN–China)" },
  { value: "eur1",   label: "EUR.1 movement certificate" },
] as const;
