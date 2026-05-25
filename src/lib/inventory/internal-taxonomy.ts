/* ===========================================================================
   PHASE INV-H10 — Internal-use inventory taxonomy (18 categories, 3 levels).

   Maps each internal-use system type_key to a list of suggested subcategories
   and, where natural, a third level of variant labels (sub_subcategories) so
   operators can pick "Uniforms → Shirts" instead of typing it out.

   Storage shape: inventory_items.subcategory (TEXT, nullable). When a
   sub-sub is picked, the picker combines them as "Subcategory · Sub-sub"
   before saving — the column accepts any string.
   ========================================================================== */

export interface InternalCategoryHint {
  type_key: string;
  /** Display label — falls back to the inventory_item_types.type_name. */
  label: string;
  /** Single-line description shown in the picker. */
  hint: string;
  /** Suggested subcategories. Order matters: most common first. */
  subcategories: string[];
  /**
   * Optional third level. Keyed by subcategory label (must match an entry
   * in `subcategories` exactly). UI shows it as a 3rd step when present.
   */
  sub_subcategories?: Record<string, string[]>;
}

/**
 * 18 categories (10 from INV-H5C + 8 added in INV-H10).
 * Aimed at furniture / sewing-machine business operations.
 */
export const INTERNAL_TAXONOMY: InternalCategoryHint[] = [
  {
    type_key: "office_supply",
    label: "Office Supplies",
    hint: "Paper, pens, files, desk items.",
    subcategories: [
      "Printer Paper", "Pens", "Pencils", "Notebooks", "Files",
      "Envelopes", "Folders", "Ink", "Toner", "Desk Accessories",
      "Sticky Notes", "Staplers", "Binders",
    ],
    sub_subcategories: {
      "Printer Paper": ["A4", "A3", "Letter", "Legal", "Photo"],
      "Pens":          ["Ballpoint", "Gel", "Marker", "Highlighter", "Whiteboard"],
      "Folders":       ["Plastic", "Manila", "Hanging", "Expanding"],
    },
  },
  {
    type_key: "marketing_material",
    label: "Marketing Materials",
    hint: "Catalogs, flyers, samples, promo gifts.",
    subcategories: [
      "Catalogs", "Flyers", "Brochures", "Posters", "Samples",
      "Rollups", "Stickers", "Promotional Gifts", "Banners", "Business Cards",
    ],
    sub_subcategories: {
      "Posters":  ["A1", "A2", "A3", "Custom"],
      "Banners":  ["Vertical Roll-up", "Horizontal", "X-stand", "Wall"],
      "Stickers": ["Logo", "Promo", "Warning Labels", "Custom"],
    },
  },
  {
    type_key: "exhibition_material",
    label: "Exhibition Materials",
    hint: "Booth, lighting, demo gear.",
    subcategories: [
      "Booth Parts", "Lighting", "Screens", "Demo Units",
      "Display Stands", "Furniture", "Power Strips", "Carpets",
    ],
  },
  {
    type_key: "employee_item",
    label: "Employee Items",
    hint: "Uniforms, IDs, safety gear, kits.",
    subcategories: [
      "Uniforms", "ID Cards", "Safety Shoes", "Helmets", "Gloves",
      "Employee Kits", "Lanyards", "Welcome Packs",
    ],
    sub_subcategories: {
      "Uniforms":     ["Shirts", "Pants", "Jackets", "Caps", "Aprons", "Coveralls"],
      "Safety Shoes": ["Standard", "Steel-toe", "Electrical Hazard", "Slip-resistant"],
      "Gloves":       ["Cotton", "Nitrile", "Leather", "Cut-resistant", "Heat-resistant"],
    },
  },
  {
    type_key: "packaging_material",
    label: "Packaging",
    hint: "Cartons, foam, tape, labels.",
    subcategories: [
      "Cartons", "Tape", "Foam", "Labels", "Wrapping",
      "Pallets", "Bags", "Bubble Wrap", "Strapping", "Stretch Film",
    ],
    sub_subcategories: {
      "Cartons":  ["Small", "Medium", "Large", "Double-wall", "Custom"],
      "Tape":     ["Clear", "Brown", "Fragile", "Branded"],
      "Pallets":  ["Wood", "Plastic", "Euro", "One-way"],
    },
  },
  {
    type_key: "maintenance_item",
    label: "Maintenance",
    hint: "Repair kits, lubricants, spare consumables.",
    subcategories: [
      "Repair Kits", "Lubricants", "Spare Consumables",
      "Adhesives", "Sealants", "Fasteners", "Belts", "Filters",
    ],
  },
  {
    type_key: "it_equipment",
    label: "IT & Electronics",
    hint: "Laptops, monitors, peripherals.",
    subcategories: [
      "Laptops", "Desktops", "Tablets", "Monitors", "Keyboards", "Mice",
      "Routers", "Switches", "Cables", "Chargers", "Docking Stations", "Webcams",
      "Hard Drives", "USB Sticks", "Memory Cards",
    ],
    sub_subcategories: {
      "Cables":      ["HDMI", "USB-C", "USB-A", "Ethernet", "Power", "DisplayPort"],
      "Hard Drives": ["External HDD", "External SSD", "Internal HDD", "Internal SSD"],
      "Monitors":    ["24-inch", "27-inch", "32-inch", "Ultrawide"],
    },
  },
  {
    type_key: "printed_material",
    label: "Documents & Printing",
    hint: "Manuals, certificates, warranty cards.",
    subcategories: [
      "Manuals", "Certificates", "Printed Labels",
      "Warranty Cards", "Internal Documents", "Training Booklets",
      "Compliance Sheets", "Tags",
    ],
  },
  {
    type_key: "safety_equipment",
    label: "Safety & Facility",
    hint: "Fire, medical, PPE, signage.",
    subcategories: [
      "Fire Extinguishers", "Smoke Detectors", "First Aid Stations",
      "Safety Glasses", "Hard Hats", "Earplugs", "Reflective Vests",
      "Safety Harnesses", "Emergency Lights", "Safety Signs",
    ],
  },
  {
    type_key: "internal_asset",
    label: "Internal Assets",
    hint: "Equipment, racks, company tools.",
    subcategories: [
      "Office Equipment", "Storage Racks", "Company Tools",
      "Whiteboards", "Projectors", "Conference Phones", "TVs",
    ],
  },
  /* ── INV-H10 additions ─────────────────────────────────────── */
  {
    type_key: "branded_merchandise",
    label: "Branded Merchandise",
    hint: "Mugs, t-shirts, pens, gifts.",
    subcategories: [
      "Mugs", "T-Shirts", "Pens", "USB Sticks", "Notebooks",
      "Lanyards", "Bags", "Caps", "Water Bottles", "Keychains",
      "Calendars", "Stickers",
    ],
    sub_subcategories: {
      "T-Shirts":   ["S", "M", "L", "XL", "XXL"],
      "Mugs":       ["Ceramic", "Travel", "Glass", "Insulated"],
      "Bags":       ["Tote", "Backpack", "Drawstring", "Laptop"],
    },
  },
  {
    type_key: "workshop_tools",
    label: "Workshop & Tools",
    hint: "Hand tools, power tools, measuring gear.",
    subcategories: [
      "Hand Tools", "Power Tools", "Measuring Instruments",
      "Cutting Tools", "Welding Equipment", "Drill Bits",
      "Workbenches", "Tool Boxes", "Safety Harnesses", "Ladders",
    ],
    sub_subcategories: {
      "Hand Tools":             ["Screwdrivers", "Wrenches", "Hammers", "Pliers", "Files"],
      "Power Tools":            ["Drills", "Saws", "Grinders", "Sanders", "Impact Drivers"],
      "Measuring Instruments":  ["Tape Measure", "Caliper", "Level", "Multimeter", "Laser Distance"],
    },
  },
  {
    type_key: "cleaning_supply",
    label: "Cleaning Supplies",
    hint: "Detergents, brooms, gloves, sanitizers.",
    subcategories: [
      "Detergents", "Brooms", "Mops", "Cleaning Cloths", "Gloves",
      "Trash Bags", "Sanitizers", "Disinfectants", "Vacuum Bags",
      "Glass Cleaner", "Floor Cleaner", "Air Fresheners",
    ],
    sub_subcategories: {
      "Trash Bags":  ["Small", "Medium", "Large", "Industrial"],
      "Gloves":      ["Latex", "Nitrile", "Rubber", "Heavy-duty"],
    },
  },
  {
    type_key: "kitchen_pantry",
    label: "Kitchen & Pantry",
    hint: "Coffee, tea, snacks, cups, cutlery.",
    subcategories: [
      "Coffee", "Tea", "Snacks", "Sugar", "Milk", "Cups",
      "Cutlery", "Plates", "Water Dispenser", "Paper Towels",
      "Napkins", "Bottled Water", "Cleaning Sponges",
    ],
    sub_subcategories: {
      "Coffee":   ["Beans", "Ground", "Capsules", "Instant"],
      "Tea":      ["Black", "Green", "Herbal", "Bags", "Loose"],
      "Cups":     ["Paper", "Ceramic", "Glass", "Plastic"],
    },
  },
  {
    type_key: "first_aid",
    label: "First Aid",
    hint: "Bandages, antiseptics, kits.",
    subcategories: [
      "Bandages", "Antiseptics", "Painkillers", "Thermometers",
      "First Aid Kits", "Burn Cream", "Eye Wash", "Cold Packs",
      "Sterile Gauze", "Medical Tape", "Defibrillators",
    ],
    sub_subcategories: {
      "First Aid Kits": ["Small (1-5 people)", "Medium (6-25)", "Large (26+)", "Travel"],
      "Bandages":       ["Adhesive Strips", "Sterile Pads", "Elastic", "Triangular"],
    },
  },
  {
    type_key: "vehicle_fleet",
    label: "Vehicle & Fleet",
    hint: "Fuel cards, oil, tires, vehicle tools.",
    subcategories: [
      "Fuel Cards", "Motor Oil", "Tires", "Vehicle Tools",
      "Dashcams", "Car Cleaning", "Engine Coolant", "Wiper Blades",
      "Spare Bulbs", "Jumper Cables", "First Aid (Vehicle)",
    ],
    sub_subcategories: {
      "Tires":     ["Summer", "Winter", "All-Season", "Spare"],
      "Motor Oil": ["5W-30", "10W-40", "Synthetic", "Diesel"],
    },
  },
  {
    type_key: "photo_video",
    label: "Photography & Video",
    hint: "Cameras, tripods, lights, microphones.",
    subcategories: [
      "Cameras", "Lenses", "Tripods", "Studio Lights", "Microphones",
      "SD Cards", "Camera Batteries", "Memory Card Readers",
      "Light Stands", "Reflectors", "Backdrops", "Gimbal Stabilizers",
    ],
    sub_subcategories: {
      "Microphones": ["Lavalier", "Shotgun", "Handheld", "USB"],
      "SD Cards":    ["32GB", "64GB", "128GB", "256GB"],
    },
  },
  {
    type_key: "furniture",
    label: "Furniture",
    hint: "Chairs, desks, shelves, racks.",
    subcategories: [
      "Office Chairs", "Desks", "Conference Tables", "Shelves",
      "Storage Racks", "Partitions", "Filing Cabinets", "Sofas",
      "Stools", "Side Tables", "Reception Furniture", "Bookcases",
    ],
    sub_subcategories: {
      "Office Chairs": ["Executive", "Task", "Ergonomic", "Visitor", "Stool"],
      "Desks":         ["Single", "L-shape", "Standing", "Bench"],
      "Shelves":       ["Wall", "Floor", "Modular", "Heavy-duty"],
    },
  },
];

/** Quick lookup — case-insensitive. */
export function suggestSubcategories(typeKey: string | null | undefined): string[] {
  if (!typeKey) return [];
  const t = INTERNAL_TAXONOMY.find((c) => c.type_key === typeKey);
  return t?.subcategories ?? [];
}

/** Sub-subcategory lookup for the picker's third step. */
export function suggestSubSubcategories(
  typeKey: string | null | undefined,
  subcategory: string | null | undefined,
): string[] {
  if (!typeKey || !subcategory) return [];
  const t = INTERNAL_TAXONOMY.find((c) => c.type_key === typeKey);
  return t?.sub_subcategories?.[subcategory] ?? [];
}

/** The set of system type_keys recognised as internal-use.
 *  Used by the items list query + the New Item drawer to know which
 *  types should show the simplified internal flow. */
export const INTERNAL_TYPE_KEYS = new Set<string>(
  INTERNAL_TAXONOMY.map((c) => c.type_key),
);
