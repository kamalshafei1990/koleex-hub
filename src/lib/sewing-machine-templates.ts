/* ---------------------------------------------------------------------------
   Sewing Machine Template Definitions

   9 subcategory templates, each with specific technical fields.
   A shared set of "common" sewing machine fields is always shown.
   --------------------------------------------------------------------------- */

/* ── Field Types ── */

export type FieldType =
  | "text"
  | "number"
  | "select"
  | "multi-select"
  | "boolean"
  | "range";     // min / max pair

export interface FieldOption {
  value: string;
  label: string;
}

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  unit?: string;         // e.g. "spm", "mm", "dB"
  options?: FieldOption[];
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  helpText?: string;
  group?: string;        // visual grouping header
}

export interface SewingMachineTemplate {
  slug: string;
  name: string;
  description: string;
  fields: TemplateField[];
  /* The `icon` emoji used to live here, rendered by the old
     Template Picker card grid on the Machine Type step. That
     picker was replaced by the Machine Kind picker (custom SVG
     icons from src/components/icons/machine-kinds/), so the
     emoji is dead weight. Dropped so templates don't carry
     unused fields. */
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMMON FIELDS — shown for ALL sewing machine subcategories
   ═══════════════════════════════════════════════════════════════════════════ */

/* `required: true` surfaces a red "*" next to the field label in
   the rendered form AND blocks the Specs step from completing
   until the field has a non-empty value. Don't overdo it — only
   the specs a customer genuinely expects on a product page (and
   a salesperson needs to quote) are marked required. Nice-to-
   have specs stay optional so admins can publish drafts without
   every single field filled. */
export const COMMON_SEWING_FIELDS: TemplateField[] = [
  // Performance
  {
    key: "max_sewing_speed",
    label: "Max Sewing Speed",
    type: "number",
    unit: "spm",
    placeholder: "e.g. 5000",
    required: true,
    group: "Performance",
  },
  {
    key: "stitch_length_min",
    label: "Stitch Length (Min)",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 0.5",
    step: 0.1,
    group: "Performance",
  },
  {
    key: "stitch_length_max",
    label: "Stitch Length (Max)",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 5.0",
    step: 0.1,
    group: "Performance",
  },
  {
    key: "presser_foot_lift",
    label: "Presser Foot Lift",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 13",
    group: "Performance",
  },

  // Needle & Thread
  {
    key: "needle_system",
    label: "Needle System",
    type: "text",
    placeholder: "e.g. DB×1, DC×27, UY128GAS",
    required: true,
    group: "Needle & Thread",
  },
  {
    key: "needle_size_range",
    label: "Needle Size Range",
    type: "text",
    placeholder: "e.g. #9 ~ #18",
    group: "Needle & Thread",
  },
  {
    key: "thread_type",
    label: "Thread Type",
    type: "text",
    placeholder: "e.g. Polyester, Cotton, Nylon",
    group: "Needle & Thread",
  },

  // Mechanical
  {
    key: "lubrication_system",
    label: "Lubrication System",
    type: "select",
    options: [
      { value: "automatic", label: "Automatic (Fully Sealed)" },
      { value: "semi-automatic", label: "Semi-Automatic" },
      { value: "manual", label: "Manual Oil" },
      { value: "dry-head", label: "Dry Head (Oil-Free)" },
    ],
    group: "Mechanical",
  },
  {
    key: "motor_type",
    label: "Motor Type",
    type: "select",
    options: [
      { value: "servo", label: "Servo Motor" },
      { value: "clutch", label: "Clutch Motor" },
      { value: "direct-drive", label: "Direct Drive" },
      { value: "built-in", label: "Built-in Motor" },
      { value: "stepping", label: "Stepping Motor" },
    ],
    required: true,
    group: "Mechanical",
  },
  {
    key: "feed_mechanism",
    label: "Feed Mechanism",
    type: "select",
    options: [
      { value: "drop-feed", label: "Drop Feed" },
      { value: "differential", label: "Differential Feed" },
      { value: "compound-feed", label: "Compound Feed" },
      { value: "walking-foot", label: "Walking Foot" },
      { value: "unison-feed", label: "Unison Feed" },
      { value: "needle-feed", label: "Needle Feed" },
      { value: "puller-feed", label: "Puller Feed" },
    ],
    group: "Mechanical",
  },
  {
    key: "hook_type",
    label: "Hook / Looper Type",
    type: "select",
    options: [
      { value: "rotary-hook", label: "Rotary Hook" },
      { value: "shuttle-hook", label: "Shuttle Hook" },
      { value: "large-hook", label: "Large Rotary Hook" },
      { value: "looper", label: "Looper" },
    ],
    group: "Mechanical",
  },

  // Physical
  {
    key: "machine_dimensions",
    label: "Machine Dimensions (L×W×H)",
    type: "text",
    placeholder: "e.g. 480×180×360 mm",
    group: "Physical",
  },
  {
    key: "machine_weight",
    label: "Machine Head Weight",
    type: "number",
    unit: "kg",
    placeholder: "e.g. 32",
    group: "Physical",
  },
  {
    key: "power_consumption",
    label: "Power Consumption",
    type: "number",
    unit: "W",
    placeholder: "e.g. 550",
    group: "Physical",
  },
  {
    key: "noise_level",
    label: "Noise Level",
    type: "number",
    unit: "dB",
    placeholder: "e.g. 72",
    group: "Physical",
  },

  // Application
  {
    key: "material_weight",
    label: "Material Weight",
    type: "multi-select",
    options: [
      { value: "light", label: "Light (Silk, Chiffon)" },
      { value: "medium", label: "Medium (Cotton, Linen)" },
      { value: "heavy", label: "Heavy (Denim, Canvas)" },
      { value: "extra-heavy", label: "Extra Heavy (Leather, Multi-Layer)" },
    ],
    group: "Application",
  },
  {
    key: "application_industries",
    label: "Industry Applications",
    type: "multi-select",
    options: [
      { value: "garment", label: "Garment" },
      { value: "denim", label: "Denim & Jeans" },
      { value: "knitwear", label: "Knitwear" },
      { value: "sportswear", label: "Sportswear" },
      { value: "underwear", label: "Underwear & Lingerie" },
      { value: "leather", label: "Leather & Bags" },
      { value: "shoes", label: "Shoes & Footwear" },
      { value: "upholstery", label: "Upholstery" },
      { value: "automotive", label: "Automotive" },
      { value: "tent", label: "Tents & Outdoor" },
      { value: "filter", label: "Filters & Technical" },
    ],
    group: "Application",
  },

  // Application — Suitable Fabrics, Garments & Operations
  {
    key: "suitable_fabrics",
    label: "Suitable Fabrics",
    type: "multi-select",
    options: [
      { value: "cotton", label: "Cotton" },
      { value: "polyester", label: "Polyester" },
      { value: "silk", label: "Silk" },
      { value: "denim", label: "Denim" },
      { value: "leather", label: "Leather" },
      { value: "knit", label: "Knit" },
      { value: "woven", label: "Woven" },
      { value: "stretch", label: "Stretch" },
      { value: "nylon", label: "Nylon" },
      { value: "canvas", label: "Canvas" },
      { value: "chiffon", label: "Chiffon" },
      { value: "linen", label: "Linen" },
      { value: "wool", label: "Wool" },
      { value: "fleece", label: "Fleece" },
      { value: "mesh", label: "Mesh" },
    ],
    group: "Application",
  },
  {
    key: "suitable_garments",
    label: "Suitable Garments",
    type: "multi-select",
    options: [
      { value: "t-shirts", label: "T-Shirts" },
      { value: "jeans", label: "Jeans" },
      { value: "dresses", label: "Dresses" },
      { value: "shirts", label: "Shirts" },
      { value: "jackets", label: "Jackets" },
      { value: "underwear", label: "Underwear" },
      { value: "sportswear", label: "Sportswear" },
      { value: "workwear", label: "Workwear" },
      { value: "suits", label: "Suits" },
      { value: "bags", label: "Bags" },
      { value: "shoes", label: "Shoes" },
      { value: "curtains", label: "Curtains" },
      { value: "upholstery", label: "Upholstery" },
      { value: "tents", label: "Tents" },
    ],
    group: "Application",
  },
  {
    key: "suitable_operations",
    label: "Suitable Operations",
    type: "multi-select",
    options: [
      { value: "hemming", label: "Hemming" },
      { value: "seaming", label: "Seaming" },
      { value: "topstitching", label: "Topstitching" },
      { value: "edge-finishing", label: "Edge Finishing" },
      { value: "binding", label: "Binding" },
      { value: "bartacking", label: "Bartacking" },
      { value: "buttonholing", label: "Buttonholing" },
      { value: "attaching", label: "Attaching" },
      { value: "quilting", label: "Quilting" },
      { value: "embroidery", label: "Embroidery" },
      { value: "gathering", label: "Gathering" },
      { value: "pleating", label: "Pleating" },
    ],
    group: "Application",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   TEMPLATE DEFINITIONS — per subcategory
   ═══════════════════════════════════════════════════════════════════════════ */

export const SEWING_MACHINE_TEMPLATES: SewingMachineTemplate[] = [
  /* ── 1. Single Needle Lockstitch ── */
  {
    slug: "single-needle-lockstitch",
    name: "Single Needle Lockstitch",
    description: "Standard lockstitch machines for straight stitching",
    fields: [
      {
        key: "auto_thread_trimmer",
        label: "Auto Thread Trimmer",
        type: "boolean",
        group: "Automation",
      },
      {
        key: "auto_backtack",
        label: "Auto Backtack",
        type: "boolean",
        group: "Automation",
      },
      {
        key: "auto_presser_foot_lifter",
        label: "Auto Presser Foot Lifter",
        type: "boolean",
        group: "Automation",
      },
      {
        key: "auto_bobbin_winder",
        label: "Auto Bobbin Winder",
        type: "boolean",
        group: "Automation",
      },
      {
        key: "stitch_pattern",
        label: "Stitch Pattern",
        type: "select",
        options: [
          { value: "straight", label: "Straight Stitch" },
          { value: "zigzag", label: "Zigzag" },
          { value: "programmable", label: "Programmable" },
        ],
        group: "Stitch",
      },
      {
        key: "max_material_thickness",
        label: "Max Material Thickness",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 8",
        group: "Capacity",
      },
      {
        key: "bobbin_type",
        label: "Bobbin Type",
        type: "select",
        options: [
          { value: "standard", label: "Standard" },
          { value: "large-capacity", label: "Large Capacity" },
        ],
        group: "Stitch",
      },
      {
        key: "bed_type",
        label: "Bed Type",
        type: "select",
        options: [
          { value: "flat-bed", label: "Flat Bed" },
          { value: "cylinder-bed", label: "Cylinder Bed" },
          { value: "post-bed", label: "Post Bed" },
        ],
        group: "Configuration",
      },
    ],
  },

  /* ── 2. Double Needle Lockstitch ── */
  {
    slug: "double-needle-lockstitch",
    name: "Double Needle Lockstitch",
    description: "Twin needle parallel stitching machines",
    fields: [
      {
        key: "needle_gauge",
        label: "Needle Gauge (Distance)",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 6.4",
        step: 0.1,
        group: "Needle Setup",
      },
      {
        key: "split_needle_bar",
        label: "Split Needle Bar",
        type: "boolean",
        helpText: "Allows independent needle operation",
        group: "Needle Setup",
      },
      {
        key: "auto_thread_trimmer",
        label: "Auto Thread Trimmer",
        type: "boolean",
        group: "Automation",
      },
      {
        key: "auto_backtack",
        label: "Auto Backtack",
        type: "boolean",
        group: "Automation",
      },
      {
        key: "large_hook",
        label: "Large Rotary Hook",
        type: "boolean",
        group: "Configuration",
      },
      {
        key: "bed_type",
        label: "Bed Type",
        type: "select",
        options: [
          { value: "flat-bed", label: "Flat Bed" },
          { value: "cylinder-bed", label: "Cylinder Bed" },
          { value: "post-bed", label: "Post Bed" },
        ],
        group: "Configuration",
      },
    ],
  },

  /* ── 3. Overlock (Serger) ── */
  {
    slug: "overlock",
    name: "Overlock (Serger)",
    description: "Edge finishing and seaming machines",
    fields: [
      {
        key: "number_of_threads",
        label: "Number of Threads",
        type: "select",
        options: [
          { value: "2", label: "2-Thread" },
          { value: "3", label: "3-Thread" },
          { value: "4", label: "4-Thread" },
          { value: "5", label: "5-Thread" },
          { value: "3-4", label: "3/4-Thread Convertible" },
          { value: "3-5", label: "3/4/5-Thread Convertible" },
        ],
        group: "Thread Configuration",
      },
      {
        key: "number_of_needles",
        label: "Number of Needles",
        type: "select",
        options: [
          { value: "1", label: "1 Needle" },
          { value: "2", label: "2 Needles" },
          { value: "1-2", label: "1/2 Convertible" },
        ],
        group: "Thread Configuration",
      },
      {
        key: "stitch_width_min",
        label: "Stitch Width (Min)",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 2.0",
        step: 0.1,
        group: "Stitch",
      },
      {
        key: "stitch_width_max",
        label: "Stitch Width (Max)",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 5.0",
        step: 0.1,
        group: "Stitch",
      },
      {
        key: "differential_feed_ratio",
        label: "Differential Feed Ratio",
        type: "text",
        placeholder: "e.g. 0.7 ~ 2.0",
        group: "Feed",
      },
      {
        key: "knife_system",
        label: "Knife System",
        type: "select",
        options: [
          { value: "upper-lower", label: "Upper & Lower Knife" },
          { value: "upper-only", label: "Upper Knife Only" },
          { value: "movable-upper", label: "Movable Upper Knife" },
        ],
        group: "Cutting",
      },
      {
        key: "auto_thread_trimmer",
        label: "Auto Thread Trimmer",
        type: "boolean",
        group: "Automation",
      },
      {
        key: "safety_stitch",
        label: "Safety Stitch Capable",
        type: "boolean",
        group: "Stitch",
      },
      {
        key: "overedge_width",
        label: "Overedge Width",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 5.0",
        group: "Stitch",
      },
      {
        key: "trimming_width",
        label: "Trimming Width",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 3.2",
        group: "Cutting",
      },
      {
        key: "bed_type",
        label: "Bed Type",
        type: "select",
        options: [
          { value: "flatbed", label: "Flatbed" },
          { value: "cylinder-bed", label: "Cylinder Bed" },
        ],
        group: "Configuration",
      },
    ],
  },

  /* ── 4. Flatlock / Interlock ── */
  {
    slug: "flatlock-interlock",
    name: "Flatlock / Interlock",
    description: "Flat seaming and decorative stretch stitching",
    fields: [
      {
        key: "number_of_needles",
        label: "Number of Needles",
        type: "select",
        options: [
          { value: "2", label: "2 Needles" },
          { value: "3", label: "3 Needles" },
          { value: "4", label: "4 Needles" },
          { value: "5", label: "5 Needles" },
          { value: "2-3", label: "2/3 Convertible" },
        ],
        group: "Needle Configuration",
      },
      {
        key: "number_of_threads",
        label: "Number of Threads",
        type: "select",
        options: [
          { value: "3", label: "3-Thread" },
          { value: "4", label: "4-Thread" },
          { value: "5", label: "5-Thread" },
          { value: "6", label: "6-Thread" },
          { value: "7", label: "7-Thread" },
          { value: "8", label: "8-Thread" },
        ],
        group: "Needle Configuration",
      },
      {
        key: "gauge",
        label: "Gauge (Needle Distance)",
        type: "text",
        placeholder: "e.g. 5.6mm, 6.4mm",
        group: "Needle Configuration",
      },
      {
        key: "stitch_width",
        label: "Stitch Width",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 5.6",
        step: 0.1,
        group: "Stitch",
      },
      {
        key: "differential_feed_ratio",
        label: "Differential Feed Ratio",
        type: "text",
        placeholder: "e.g. 0.7 ~ 2.0",
        group: "Feed",
      },
      {
        key: "bed_type",
        label: "Bed Type",
        type: "select",
        options: [
          { value: "flat-bed", label: "Flat Bed" },
          { value: "cylinder-bed", label: "Cylinder Bed" },
        ],
        group: "Configuration",
      },
      {
        key: "top_cover_stitch",
        label: "Top Cover Stitch",
        type: "boolean",
        group: "Stitch",
      },
      {
        key: "bottom_cover_stitch",
        label: "Bottom Cover Stitch",
        type: "boolean",
        group: "Stitch",
      },
      {
        key: "bottom_hemming",
        label: "Bottom Hemming Support",
        type: "boolean",
        group: "Stitch",
      },
      {
        key: "binding_support",
        label: "Binding Support",
        type: "boolean",
        group: "Stitch",
      },
    ],
  },

  /* ── 5. Coverstitch ── */
  {
    slug: "coverstitch",
    name: "Coverstitch",
    description: "Hemming and cover seam machines for knitwear",
    fields: [
      {
        key: "number_of_needles",
        label: "Number of Needles",
        type: "select",
        options: [
          { value: "1", label: "1 Needle" },
          { value: "2", label: "2 Needles" },
          { value: "3", label: "3 Needles" },
          { value: "2-3", label: "2/3 Convertible" },
          { value: "1-2-3", label: "1/2/3 Convertible" },
        ],
        group: "Configuration",
      },
      {
        key: "number_of_threads",
        label: "Number of Threads",
        type: "select",
        options: [
          { value: "2", label: "2-Thread" },
          { value: "3", label: "3-Thread" },
          { value: "4", label: "4-Thread" },
          { value: "5", label: "5-Thread" },
        ],
        group: "Configuration",
      },
      {
        key: "stitch_width_options",
        label: "Stitch Width Options",
        type: "text",
        placeholder: "e.g. 3.2mm, 5.6mm, 6.4mm",
        group: "Stitch",
      },
      {
        key: "top_cover_stitch",
        label: "Top Cover Stitch",
        type: "boolean",
        group: "Stitch",
      },
      {
        key: "differential_feed_ratio",
        label: "Differential Feed Ratio",
        type: "text",
        placeholder: "e.g. 0.7 ~ 2.0",
        group: "Feed",
      },
      {
        key: "bed_type",
        label: "Bed Type",
        type: "select",
        options: [
          { value: "flat-bed", label: "Flat Bed" },
          { value: "cylinder-bed", label: "Cylinder Bed" },
        ],
        group: "Configuration",
      },
      {
        key: "auto_thread_trimmer",
        label: "Auto Thread Trimmer",
        type: "boolean",
        group: "Automation",
      },
    ],
  },

  /* ── 6. Button Hole ──
     Earlier revisions of this template accidentally had:
       · both `buttonhole_type` (multi-select) and `buttonhole_shape`
         (single select) capturing the same taxonomy
       · both `max_buttonhole_length`+`min_buttonhole_length` pairs
         AND a text `buttonhole_length_range` that says the same thing
       · both `clamping_device` and `clamp_type` selects
       · `eye_size_adjustable` + `eyelet_option` as two booleans for
         overlapping concepts
     Cleaned up below to a single canonical shape per concept. */
  {
    slug: "button-hole",
    name: "Button Hole",
    description: "Buttonhole making machines",
    fields: [
      {
        key: "buttonhole_type",
        label: "Buttonhole Type",
        type: "multi-select",
        options: [
          { value: "straight", label: "Straight" },
          { value: "round-end", label: "Round End" },
          { value: "keyhole", label: "Keyhole (Eyelet)" },
          { value: "fancy", label: "Fancy / Decorative" },
        ],
        group: "Buttonhole",
      },
      {
        key: "min_buttonhole_length",
        label: "Buttonhole Length (Min)",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 6",
        group: "Buttonhole",
      },
      {
        key: "max_buttonhole_length",
        label: "Buttonhole Length (Max)",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 40",
        group: "Buttonhole",
      },
      {
        key: "eye_size_adjustable",
        label: "Eye Size Adjustable",
        type: "boolean",
        helpText: "Covers the separate \"eyelet option\" we used to track as a second flag.",
        group: "Buttonhole",
      },
      {
        key: "gimp_thread",
        label: "Gimp Thread Support",
        type: "boolean",
        helpText: "Corded buttonhole capability",
        group: "Buttonhole",
      },
      {
        key: "cutting_system",
        label: "Cutting System",
        type: "select",
        options: [
          { value: "auto-before", label: "Auto Cut Before Sewing" },
          { value: "auto-after", label: "Auto Cut After Sewing" },
          { value: "manual", label: "Manual" },
          { value: "none", label: "No Cutter" },
        ],
        group: "Cutting",
      },
      {
        key: "clamping_device",
        label: "Clamping Device",
        type: "select",
        options: [
          { value: "auto", label: "Automatic Clamp" },
          { value: "manual", label: "Manual Clamp" },
          { value: "pneumatic", label: "Pneumatic" },
        ],
        group: "Mechanism",
      },
      {
        key: "programming_type",
        label: "Control Type",
        type: "select",
        options: [
          { value: "electronic", label: "Electronic (Programmable)" },
          { value: "mechanical", label: "Mechanical" },
          { value: "computerized", label: "Computerized" },
        ],
        group: "Control",
      },
    ],
  },

  /* ── 7. Button Attach / Sewing ──
     Earlier revisions had the following duplicate pairs, each
     removed in this cleanup:
       · `button_types` (multi-select) AND `hole_count_support`
         (multi-select) — same taxonomy twice.
       · `button_size_min`+`button_size_max` number pair AND a
         free-text `button_size_range` saying the same thing.
       · `stitches_per_cycle` (text) AND `stitch_count` (number) —
         same concept, number is the right shape.
       · `auto_clamp` (boolean) AND `clamp_type` (select) —
         the select subsumes the boolean.
     Consolidated to the single canonical field per concept. */
  {
    slug: "button-attach",
    name: "Button Attach",
    description: "Button sewing and attaching machines",
    fields: [
      {
        key: "button_types",
        label: "Button Types",
        type: "multi-select",
        options: [
          { value: "2-hole", label: "2-Hole" },
          { value: "4-hole", label: "4-Hole" },
          { value: "shank", label: "Shank / Wrapped" },
          { value: "snap", label: "Snap" },
          { value: "metal", label: "Metal" },
        ],
        group: "Button",
      },
      {
        key: "button_size_min",
        label: "Button Size (Min)",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 10",
        group: "Button",
      },
      {
        key: "button_size_max",
        label: "Button Size (Max)",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 28",
        group: "Button",
      },
      {
        key: "stacking_height",
        label: "Stacking Height (Shank)",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 3.5",
        step: 0.1,
        group: "Button",
      },
      {
        key: "stitch_count",
        label: "Stitch Count (per cycle)",
        type: "number",
        placeholder: "e.g. 16",
        helpText: "Typical values: 8, 16, 32",
        group: "Performance",
      },
      {
        key: "cross_pattern",
        label: "Cross Stitch Pattern",
        type: "boolean",
        helpText: "4-hole cross-stitch capability",
        group: "Stitch",
      },
      {
        key: "clamp_type",
        label: "Clamp Type",
        type: "select",
        options: [
          { value: "auto-clamp", label: "Auto Clamp" },
          { value: "manual-clamp", label: "Manual Clamp" },
          { value: "universal", label: "Universal" },
        ],
        group: "Automation",
      },
      {
        key: "button_feeder",
        label: "Button Feeder",
        type: "select",
        options: [
          { value: "none", label: "No Feeder" },
          { value: "manual", label: "Manual Feed" },
          { value: "auto-hopper", label: "Automatic Hopper" },
        ],
        group: "Automation",
      },
    ],
  },

  /* ── 8. Bartacking ──
     Earlier template had `sewing_area_x`/`sewing_area_y` AND
     `bartack_length`/`bartack_width` — two different names for
     the same physical dimensions (the max X/Y travel of the
     sewing head IS the max bartack length/width). Consolidated to
     the clearer bartack length/width naming. */
  {
    slug: "bartacking",
    name: "Bartacking",
    description: "Reinforcement and bartack sewing machines",
    fields: [
      {
        key: "bartack_length",
        label: "Max Bartack Length (X)",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 30",
        group: "Sewing Area",
      },
      {
        key: "bartack_width",
        label: "Max Bartack Width (Y)",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 20",
        group: "Sewing Area",
      },
      {
        key: "stitch_count",
        label: "Stitch Count (per bartack)",
        type: "number",
        placeholder: "e.g. 42",
        group: "Performance",
      },
      {
        key: "number_of_patterns",
        label: "Number of Built-in Patterns",
        type: "number",
        placeholder: "e.g. 36",
        group: "Patterns",
      },
      {
        key: "pattern_storage",
        label: "Pattern Storage Capacity",
        type: "number",
        placeholder: "e.g. 999",
        group: "Patterns",
      },
      {
        key: "pattern_type",
        label: "Pattern Type",
        type: "multi-select",
        options: [
          { value: "rectangle", label: "Rectangle" },
          { value: "circle", label: "Circle" },
          { value: "triangle", label: "Triangle" },
          { value: "custom", label: "Custom" },
        ],
        group: "Patterns",
      },
      {
        key: "input_method",
        label: "Input Method",
        type: "multi-select",
        options: [
          { value: "usb", label: "USB" },
          { value: "sd", label: "SD Card" },
          { value: "panel", label: "Panel Input" },
          { value: "pc-link", label: "PC Connection" },
        ],
        group: "Interface",
      },
      {
        key: "display_type",
        label: "Display Type",
        type: "select",
        options: [
          { value: "lcd", label: "LCD" },
          { value: "led", label: "LED" },
          { value: "touch", label: "Touch Panel" },
          { value: "none", label: "No Display" },
        ],
        group: "Interface",
      },
      {
        key: "auto_thread_trimmer",
        label: "Auto Thread Trimmer",
        type: "boolean",
        group: "Automation",
      },
      {
        key: "auto_presser_foot",
        label: "Auto Presser Foot",
        type: "boolean",
        group: "Automation",
      },
      {
        key: "stacker",
        label: "Stacker",
        type: "boolean",
        group: "Automation",
      },
    ],
  },

  /* ── 9. Feed of the Arm ──
     Dropped two redundant booleans in this cleanup:
       · `puller_support` (boolean) — already implied by the
         `puller` select having a non-"none" value.
       · `tubular_sewing` (boolean) — feed-of-the-arm machines
         ARE tubular sewing machines, the category itself makes
         this redundant. Admins can still call out specific use
         cases in `specialized_use`. */
  {
    slug: "feed-of-the-arm",
    name: "Feed of the Arm",
    description: "Cylinder arm and lap seam machines",
    fields: [
      {
        key: "arm_type",
        label: "Arm Type",
        type: "select",
        options: [
          { value: "cylinder-arm", label: "Cylinder Arm" },
          { value: "flat-bed", label: "Flat Bed Convertible" },
        ],
        group: "Configuration",
      },
      {
        key: "cylinder_diameter",
        label: "Cylinder Diameter",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 50",
        group: "Configuration",
      },
      {
        key: "arm_dimensions",
        label: "Arm Length",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 250",
        group: "Configuration",
      },
      {
        key: "number_of_needles",
        label: "Number of Needles",
        type: "select",
        options: [
          { value: "1", label: "1 Needle" },
          { value: "2", label: "2 Needles" },
          { value: "3", label: "3 Needles" },
          { value: "1-2", label: "1/2 Convertible" },
        ],
        group: "Needle Setup",
      },
      {
        key: "number_of_threads",
        label: "Number of Threads",
        type: "select",
        options: [
          { value: "2", label: "2-Thread" },
          { value: "3", label: "3-Thread" },
          { value: "4", label: "4-Thread" },
        ],
        group: "Needle Setup",
      },
      {
        key: "puller",
        label: "Puller Device",
        type: "select",
        options: [
          { value: "none", label: "Without Puller" },
          { value: "top-puller", label: "Top Puller" },
          { value: "rear-puller", label: "Rear Puller" },
          { value: "built-in", label: "Built-in Puller" },
        ],
        group: "Feed",
      },
      {
        key: "lap_seam",
        label: "Lap Seam Capable",
        type: "boolean",
        group: "Stitch",
      },
      {
        key: "folder_type",
        label: "Folder Type",
        type: "select",
        options: [
          { value: "none", label: "No Folder" },
          { value: "single-fold", label: "Single Fold" },
          { value: "double-fold", label: "Double Fold" },
          { value: "metering", label: "Metering Device" },
        ],
        group: "Accessories",
      },
      {
        key: "auto_thread_trimmer",
        label: "Auto Thread Trimmer",
        type: "boolean",
        group: "Automation",
      },
      {
        key: "specialized_use",
        label: "Specialized Use",
        type: "multi-select",
        options: [
          { value: "jeans-side-seam", label: "Jeans Side Seam" },
          { value: "sleeve-attach", label: "Sleeve Attach" },
          { value: "waistband", label: "Waistband" },
          { value: "tubular-hemming", label: "Tubular Hemming" },
          { value: "lap-seam", label: "Lap Seam" },
        ],
        group: "Application",
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Maps subcategory slugs to template slugs.
 * Multiple subcategory slugs can map to the same template.
 */
const SUBCATEGORY_TO_TEMPLATE: Record<string, string> = {
  // Direct matches from actual DB subcategories
  "lockstitch-machines": "single-needle-lockstitch",
  "single-needle-lockstitch": "single-needle-lockstitch",
  "lockstitch": "single-needle-lockstitch",
  "household-lockstitch-machines": "single-needle-lockstitch",

  "double-needle-machines": "double-needle-lockstitch",
  "double-needle-lockstitch": "double-needle-lockstitch",
  "twin-needle-lockstitch": "double-needle-lockstitch",
  "multi-needle-machines": "double-needle-lockstitch",

  "overlock-machines": "overlock",
  "overlock": "overlock",
  "serger": "overlock",
  "overlock-serger": "overlock",
  "household-overlock-machines": "overlock",

  "interlock-machines": "flatlock-interlock",
  "flatlock": "flatlock-interlock",
  "interlock": "flatlock-interlock",
  "flatlock-interlock": "flatlock-interlock",
  "flat-lock": "flatlock-interlock",

  "hemming-machines": "coverstitch",
  "coverstitch": "coverstitch",
  "cover-stitch": "coverstitch",
  "cover-hem": "coverstitch",

  "buttonhole-machines": "button-hole",
  "button-hole": "button-hole",
  "buttonhole": "button-hole",
  "button-holer": "button-hole",

  "button-attaching-machines": "button-attach",
  "button-attach": "button-attach",
  "button-sewing": "button-attach",
  "button-sew": "button-attach",

  "bartacking-machines": "bartacking",
  "bartacking": "bartacking",
  "bartack": "bartacking",
  "bar-tack": "bartacking",

  "feed-of-the-arm": "feed-of-the-arm",
  "feed-off-the-arm": "feed-of-the-arm",
  "cylinder-arm": "feed-of-the-arm",
  "cylinder-bed": "feed-of-the-arm",

  // Pattern / Special / Heavy duty — map to single needle as closest
  "pattern-sewing-machines": "single-needle-lockstitch",
  "special-machines": "single-needle-lockstitch",
  "heavy-duty-machines": "single-needle-lockstitch",
  "chainstitch-machines": "flatlock-interlock",

  // Automatic sewing systems
  "pocket-setter-machines": "bartacking",
  "pocket-welting-machines": "bartacking",
  "placket-sewing-units": "single-needle-lockstitch",
  "side-seam-units": "single-needle-lockstitch",
  "collar-machines": "single-needle-lockstitch",
  "sleeve-setting-machines": "single-needle-lockstitch",

  // Leather & footwear
  "shoe-sewing-machines": "single-needle-lockstitch",
  "bag-sewing-machines": "single-needle-lockstitch",
  "leather-sewing-machines": "single-needle-lockstitch",
  "edge-binding-machines": "coverstitch",
  "tape-attaching-machines": "coverstitch",
};

/**
 * Category slugs that should show sewing machine specs.
 * Matches the actual Supabase category slugs under "Garment Machinery".
 */
const SEWING_CATEGORY_SLUGS = new Set([
  "industrial-sewing-machines",
  "automatic-sewing-systems",
  "domestic-sewing-machines",
  "leather-footwear-machinery",
]);

/**
 * Check if a product should show sewing machine specs.
 * Works by checking division + category slug combination.
 */
export function isSewingMachineSubcategory(
  subcategorySlug: string,
  divisionSlug: string,
  categorySlug?: string,
): boolean {
  // Division must be "garment-machinery" (or similar sewing-focused divisions)
  const sewingDivisionSlugs = [
    "garment-machinery",
    "sewing-machines",
    "sewing-machine",
    "sewing",
    "industrial-sewing-machines",
    "industrial-sewing",
  ];

  if (!sewingDivisionSlugs.includes(divisionSlug)) return false;

  // If category is provided, check if it's a sewing-related category
  if (categorySlug) {
    return SEWING_CATEGORY_SLUGS.has(categorySlug);
  }

  // If no category provided, check subcategory against known mappings
  if (subcategorySlug && SUBCATEGORY_TO_TEMPLATE[subcategorySlug]) return true;

  // Default: if division matches, show sewing specs
  return true;
}

/** Get the template for a given subcategory slug. Returns null if no template found. */
export function getTemplateForSubcategory(subcategorySlug: string): SewingMachineTemplate | null {
  const templateSlug = SUBCATEGORY_TO_TEMPLATE[subcategorySlug];
  if (!templateSlug) {
    // Try fuzzy match: find a template whose slug is contained in the subcategory slug
    const match = SEWING_MACHINE_TEMPLATES.find(t =>
      subcategorySlug.includes(t.slug) || t.slug.includes(subcategorySlug)
    );
    return match || null;
  }
  return SEWING_MACHINE_TEMPLATES.find(t => t.slug === templateSlug) || null;
}

/* `getAllTemplates()` used to feed the Template Picker card grid on
   the Machine Type step. That picker was replaced by the Machine
   Kind picker — which scopes to the chosen subcategory — so this
   helper is dead. Keeping the removal in the same commit as the
   `icon` field removal so the "template picker" concept exits
   cleanly and nothing references the old shape. */

/** Group fields by their group property */
export function groupFields(fields: TemplateField[]): { group: string; fields: TemplateField[] }[] {
  const groups: { group: string; fields: TemplateField[] }[] = [];
  const map = new Map<string, TemplateField[]>();

  for (const field of fields) {
    const g = field.group || "General";
    if (!map.has(g)) {
      map.set(g, []);
      groups.push({ group: g, fields: map.get(g)! });
    }
    map.get(g)!.push(field);
  }

  return groups;
}
