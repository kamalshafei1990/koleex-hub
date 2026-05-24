/* ===========================================================================
   PHASE INV-H5C — Internal-use inventory taxonomy.

   Maps each internal-use system type_key to a short list of suggested
   subcategories. The New Item drawer reads from this when the operator
   picks an internal-use type so the subcategory field is an autocomplete
   instead of a blank text input.

   Storage shape: inventory_items.subcategory (TEXT, nullable). The list
   here is purely a UI hint — the column accepts any string.
   ========================================================================== */

export interface InternalCategoryHint {
  type_key: string;
  /** Display label — falls back to the inventory_item_types.type_name. */
  label: string;
  /** Single-line description shown in the picker. */
  hint: string;
  /** Suggested subcategories. Order matters: most common first. */
  subcategories: string[];
}

/** Ordered to match the 10 categories laid out in the INV-H5C plan. */
export const INTERNAL_TAXONOMY: InternalCategoryHint[] = [
  {
    type_key: "office_supply",
    label: "Office Supplies",
    hint: "Paper, pens, files, desk items.",
    subcategories: [
      "Printer Paper", "Pens", "Notebooks", "Files", "Envelopes",
      "Folders", "Ink", "Toner", "Desk Accessories",
    ],
  },
  {
    type_key: "marketing_material",
    label: "Marketing Materials",
    hint: "Catalogs, flyers, samples, promo gifts.",
    subcategories: [
      "Catalogs", "Flyers", "Brochures", "Posters", "Samples",
      "Rollups", "Stickers", "Promotional Gifts",
    ],
  },
  {
    type_key: "exhibition_material",
    label: "Exhibition Materials",
    hint: "Booth, lighting, demo gear.",
    subcategories: [
      "Booth Parts", "Lighting", "Screens", "Demo Units",
      "Display Stands", "Furniture",
    ],
  },
  {
    type_key: "employee_item",
    label: "Employee Items",
    hint: "Uniforms, IDs, safety gear, kits.",
    subcategories: [
      "Uniforms", "ID Cards", "Safety Shoes", "Helmets", "Gloves",
      "Employee Kits",
    ],
  },
  {
    type_key: "packaging_material",
    label: "Packaging",
    hint: "Cartons, foam, tape, labels.",
    subcategories: [
      "Cartons", "Tape", "Foam", "Labels", "Wrapping", "Pallets", "Bags",
    ],
  },
  {
    type_key: "maintenance_item",
    label: "Maintenance",
    hint: "Tools, repair kits, cleaning supplies.",
    subcategories: [
      "Tools", "Repair Kits", "Lubricants",
      "Cleaning Equipment", "Spare Consumables",
    ],
  },
  {
    type_key: "it_equipment",
    label: "IT & Electronics",
    hint: "Laptops, monitors, peripherals.",
    subcategories: [
      "Laptops", "Tablets", "Monitors", "Keyboards", "Mice",
      "Routers", "Cables", "Chargers",
    ],
  },
  {
    type_key: "printed_material",
    label: "Documents & Printing",
    hint: "Manuals, certificates, warranty cards.",
    subcategories: [
      "Manuals", "Certificates", "Printed Labels",
      "Warranty Cards", "Internal Documents",
    ],
  },
  {
    type_key: "safety_equipment",
    label: "Safety & Facility",
    hint: "Fire, medical, cleaning supplies.",
    subcategories: [
      "Fire Extinguishers", "Medical Kits",
      "Safety Equipment", "Cleaning Supplies",
    ],
  },
  {
    type_key: "internal_asset",
    label: "Internal Assets",
    hint: "Furniture, equipment, racks, tools.",
    subcategories: [
      "Furniture", "Office Equipment",
      "Storage Racks", "Company Tools",
    ],
  },
];

/** Quick lookup — case-insensitive. */
export function suggestSubcategories(typeKey: string | null | undefined): string[] {
  if (!typeKey) return [];
  const t = INTERNAL_TAXONOMY.find((c) => c.type_key === typeKey);
  return t?.subcategories ?? [];
}

/** The set of system type_keys recognised as internal-use by INV-H5C.
 *  Used by the items list query + the New Item drawer to know which
 *  types should show the simplified internal flow. */
export const INTERNAL_TYPE_KEYS = new Set<string>(
  INTERNAL_TAXONOMY.map((c) => c.type_key),
);
