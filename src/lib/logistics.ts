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

/* ── UNITS ARE A DISPLAY CHOICE, NEVER A STORAGE ONE ───────────────────────
   Supplier catalogues do not agree with each other: one prints the crate in
   mm, the next in cm, a third in metres, and weights come as grams or kilos.
   The operator must be able to type what the catalogue says without doing
   arithmetic in their head — that mental conversion is where a 1,200 becomes
   a 120.

   So the FORM lets them pick the unit, and the FILE keeps one: centimetres
   and kilograms, the units the field names already promise (l_cm, gross_kg).
   Everything downstream — CBM, container loading, the packing list — keeps
   reading canonical numbers and needs no idea a choice was ever made. Picking
   a different unit re-displays the same physical size; it never rewrites it. */
/* Units live in src/lib/entry-units.ts now: one preference for the whole form,
   shared with the schema-driven fields (machine dimensions, machine weight),
   so the two halves of the Packing & Logistics tab can never disagree about
   what a number means. This file keeps only what it stores: cm and kg. */

export interface ProductLogistics {
  packing_mode?: PackingMode;
  /* The entry unit is NOT stored on the product. It is how the operator reads
     a catalogue, not a fact about the goods, so it follows the person —
     src/lib/entry-units.ts. Stored lengths are always cm, weights always kg. */
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
/* ISO internal dimensions (cm) — the ones that give the CBM figures every
   forwarder quotes: 20ft 33.2, 40ft 67.7, 40HQ 76.4. */
export const CONTAINERS = {
  c20:   { label: "20ft",  l: 589.8, w: 235.2, h: 239.3, payload_kg: 25_000 },
  c40:   { label: "40ft",  l: 1203.2, w: 235.2, h: 239.3, payload_kg: 26_000 },
  c40hq: { label: "40HQ", l: 1203.2, w: 235.2, h: 269.8, payload_kg: 26_000 },
} as const;

/* Stuffing is never perfect: crates do not tessellate, dunnage and door
   clearance eat space. Applied to the floor count, not the weight. */
export const STUFFING_EFFICIENCY = 0.9;

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
  limit: "weight" | "space" | "none";
  /** The two ceilings the count was cut from — shown beside the number so the
   *  operator can see which one decided it and why. */
  byVolume: number;
  byWeight: number;
  /** m³ of one UNIT of the product (all its packages together). */
  unitCbm: number;
  /** Internal volume of the container, m³. */
  containerCbm: number;
}

export const containerCbm = (c: { l: number; w: number; h: number }): number =>
  Math.round((c.l * c.w * c.h) / 1_000_000 * 10) / 10;

/* HOW MANY UNITS FIT — BY VOLUME. Owner, 2026-09-14: "it's totally about the
   CBM." The earlier version counted footprint × layers and treated a crate
   as unstackable unless told otherwise, so a 0.254 m³ carton came out at 29
   per 20ft — one layer on the floor, the rest of the box air. This is the
   number every supplier and forwarder quotes: the container's cubic metres,
   less a stuffing allowance, divided by the unit's cubic metres — and then
   the payload, which the volume figure alone will happily exceed (a 1 m³
   machine at 1.5 t is 28 by volume and 16 by weight in a 20ft). */
export function unitsPerContainer(
  rows: PackageRow[] | undefined | null,
  container: { l: number; w: number; h: number; payload_kg: number },
): LoadResult {
  const cCbm = containerCbm(container);
  const list = (rows ?? []).filter((r) => num(r.l_cm) > 0 && num(r.w_cm) > 0 && num(r.h_cm) > 0);
  const none = { byVolume: 0, byWeight: 0, unitCbm: 0, containerCbm: cCbm };
  if (list.length === 0) return { qty: 0, limit: "none", ...none };
  /* A package larger than the door in every orientation does not go in at
     any count. Sorted-dimension check: the longest side against the longest
     inner dimension, and so on. */
  const inner = [container.l, container.w, container.h].sort((a, b) => b - a);
  for (const r of list) {
    const dims = [num(r.l_cm), num(r.w_cm), num(r.h_cm)].sort((a, b) => b - a);
    if (dims[0] > inner[0] || dims[1] > inner[1] || dims[2] > inner[2]) {
      return { qty: 0, limit: "space", ...none };
    }
  }
  const sums = sumPackages(list);
  const unitCbm = sums.cbm;
  if (unitCbm <= 0) return { qty: 0, limit: "none", ...none };
  const byVolume = Math.floor((cCbm * STUFFING_EFFICIENCY) / unitCbm);
  const byWeight = sums.grossKg > 0 ? Math.floor(container.payload_kg / sums.grossKg) : Infinity;
  const qty = Math.max(0, Math.min(byVolume, byWeight));
  return {
    qty,
    limit: byWeight < byVolume ? "weight" : "space",
    byVolume,
    byWeight: Number.isFinite(byWeight) ? byWeight : 0,
    unitCbm,
    containerCbm: cCbm,
  };
}

/* The plan for the three standard boxes. For a product packed many to a
   carton, the count is in PIECES (cartons × pieces per carton). */
export function loadPlan(
  rows: PackageRow[] | undefined | null,
  opts: { unitsPerPackage?: number } = {},
): { c20: LoadResult; c40: LoadResult; c40hq: LoadResult } {
  const per = Math.max(1, Math.floor(num(opts.unitsPerPackage) || 1));
  const scale = (r: LoadResult): LoadResult => (per === 1 ? r : { ...r, qty: r.qty * per, byVolume: r.byVolume * per, byWeight: r.byWeight * per });
  return {
    c20: scale(unitsPerContainer(rows, CONTAINERS.c20)),
    c40: scale(unitsPerContainer(rows, CONTAINERS.c40)),
    c40hq: scale(unitsPerContainer(rows, CONTAINERS.c40hq)),
  };
}

/* ── item glyphs ───────────────────────────────────────────────────────────
   A photo beats an icon every time, and the owner will have photos for the
   crate and the machine. But nobody photographs a tool kit, so an item with
   no photo still needs to be recognisable at a glance in a list. */
/* SEVEN KINDS WAS TOO COARSE, AND THE LIST ITSELF CAUSED THE REPEATS. Spare
   blades, a rail set and a bag of bolts are three different things, and with
   only "spare parts" to choose from all three wore the same glyph — the
   operator was not being careless, the list left them no other answer. These
   are the distinctions a machine's packing list actually makes. */
export const ITEM_KINDS = [
  { value: "machine",     label: "Machine / main unit" },
  { value: "box",         label: "Box / carton" },
  { value: "tools",       label: "Tools" },
  { value: "cable",       label: "Cable / power" },
  { value: "cover",       label: "Cover / protection" },
  { value: "parts",       label: "Spare parts" },
  { value: "blade",       label: "Blades / cutting" },
  { value: "fastener",    label: "Fasteners / fixings" },
  { value: "frame",       label: "Frame / table / rails" },
  { value: "electronics", label: "Electronics / control" },
  { value: "consumable",  label: "Oil / consumables" },
  { value: "wheel",       label: "Wheels / casters" },
  { value: "docs",        label: "Manual / documents" },
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
