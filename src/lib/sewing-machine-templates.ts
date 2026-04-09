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
  icon: string;          // emoji
  fields: TemplateField[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMMON FIELDS — shown for ALL sewing machine subcategories
   ═══════════════════════════════════════════════════════════════════════════ */

export const COMMON_SEWING_FIELDS: TemplateField[] = [
  // Performance
  {
    key: "max_sewing_speed",
    label: "Max Sewing Speed",
    type: "number",
    unit: "spm",
    placeholder: "e.g. 5000",
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
    icon: "1️⃣",
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
    icon: "2️⃣",
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
    icon: "🔗",
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
    ],
  },

  /* ── 4. Flatlock / Interlock ── */
  {
    slug: "flatlock-interlock",
    name: "Flatlock / Interlock",
    description: "Flat seaming and decorative stretch stitching",
    icon: "🔄",
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
    ],
  },

  /* ── 5. Coverstitch ── */
  {
    slug: "coverstitch",
    name: "Coverstitch",
    description: "Hemming and cover seam machines for knitwear",
    icon: "📏",
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

  /* ── 6. Button Hole ── */
  {
    slug: "button-hole",
    name: "Button Hole",
    description: "Buttonhole making machines",
    icon: "🕳️",
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
        key: "max_buttonhole_length",
        label: "Max Buttonhole Length",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 40",
        group: "Buttonhole",
      },
      {
        key: "min_buttonhole_length",
        label: "Min Buttonhole Length",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 6",
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
      {
        key: "eye_size_adjustable",
        label: "Eye Size Adjustable",
        type: "boolean",
        group: "Buttonhole",
      },
      {
        key: "gimp_thread",
        label: "Gimp Thread Support",
        type: "boolean",
        helpText: "Corded buttonhole capability",
        group: "Buttonhole",
      },
    ],
  },

  /* ── 7. Button Attach / Sewing ── */
  {
    slug: "button-attach",
    name: "Button Attach",
    description: "Button sewing and attaching machines",
    icon: "🔘",
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
        key: "stitches_per_cycle",
        label: "Stitches per Cycle",
        type: "text",
        placeholder: "e.g. 8, 16, 32",
        group: "Performance",
      },
      {
        key: "auto_clamp",
        label: "Auto Button Clamp",
        type: "boolean",
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
      {
        key: "cross_pattern",
        label: "Cross Stitch Pattern",
        type: "boolean",
        helpText: "4-hole cross-stitch capability",
        group: "Stitch",
      },
    ],
  },

  /* ── 8. Bartacking ── */
  {
    slug: "bartacking",
    name: "Bartacking",
    description: "Reinforcement and bartack sewing machines",
    icon: "⬛",
    fields: [
      {
        key: "sewing_area_x",
        label: "Sewing Area X",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 30",
        group: "Sewing Area",
      },
      {
        key: "sewing_area_y",
        label: "Sewing Area Y",
        type: "number",
        unit: "mm",
        placeholder: "e.g. 20",
        group: "Sewing Area",
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

  /* ── 9. Feed of the Arm ── */
  {
    slug: "feed-of-the-arm",
    name: "Feed of the Arm",
    description: "Cylinder arm and lap seam machines",
    icon: "💪",
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
  // Direct matches
  "single-needle-lockstitch": "single-needle-lockstitch",
  "lockstitch": "single-needle-lockstitch",
  "double-needle-lockstitch": "double-needle-lockstitch",
  "twin-needle-lockstitch": "double-needle-lockstitch",
  "overlock": "overlock",
  "serger": "overlock",
  "overlock-serger": "overlock",
  "flatlock": "flatlock-interlock",
  "interlock": "flatlock-interlock",
  "flatlock-interlock": "flatlock-interlock",
  "flat-lock": "flatlock-interlock",
  "coverstitch": "coverstitch",
  "cover-stitch": "coverstitch",
  "cover-hem": "coverstitch",
  "button-hole": "button-hole",
  "buttonhole": "button-hole",
  "button-holer": "button-hole",
  "button-attach": "button-attach",
  "button-sewing": "button-attach",
  "button-sew": "button-attach",
  "bartacking": "bartacking",
  "bartack": "bartacking",
  "bar-tack": "bartacking",
  "feed-of-the-arm": "feed-of-the-arm",
  "feed-off-the-arm": "feed-of-the-arm",
  "cylinder-arm": "feed-of-the-arm",
  "cylinder-bed": "feed-of-the-arm",
};

/** Check if a subcategory belongs to the sewing machines division */
export function isSewingMachineSubcategory(subcategorySlug: string, divisionSlug: string): boolean {
  // Check if the division is "sewing-machines" or similar
  const sewingDivisionSlugs = [
    "sewing-machines",
    "sewing-machine",
    "sewing",
    "industrial-sewing-machines",
    "industrial-sewing",
  ];
  return sewingDivisionSlugs.includes(divisionSlug);
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

/** Get all available template options (for a dropdown or template picker) */
export function getAllTemplates(): { slug: string; name: string; icon: string }[] {
  return SEWING_MACHINE_TEMPLATES.map(t => ({
    slug: t.slug,
    name: t.name,
    icon: t.icon,
  }));
}

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
