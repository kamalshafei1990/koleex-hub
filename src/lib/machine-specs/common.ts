/* ---------------------------------------------------------------------------
   Common Sewing Specs — Tier 1

   Fields that apply to every sewing machine, regardless of family.
   These mirror the old COMMON_SEWING_FIELDS data so existing saved
   products don't need migration — same keys, same value shapes.

   Organised into groups (Performance / Needle & Thread / Mechanical /
   Physical / Material / Application) that render as sub-headings
   inside the Common card.

   Tier assignments:
     · essential   → shown first, often required
     · recommended → shown by default but OK to skip
     · advanced    → collapsed behind "Show advanced" in the form
   --------------------------------------------------------------------------- */

import type { SpecField } from "./types";

export const COMMON_FIELDS: SpecField[] = [
  // ══════════════════════════════════════════════════════════
  // Performance
  // ══════════════════════════════════════════════════════════
  {
    key: "max_sewing_speed",
    label: "Max Sewing Speed",
    type: "number",
    unit: "spm",
    placeholder: "e.g. 5000",
    required: true,
    tier: "essential",
    group: "Performance",
  },
  {
    key: "stitch_length_min",
    label: "Stitch Length (Min)",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 0.2",
    step: 0.1,
    tier: "essential",
    group: "Performance",
  },
  {
    key: "stitch_length_max",
    label: "Stitch Length (Max)",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 5.0",
    step: 0.1,
    tier: "essential",
    group: "Performance",
  },
  {
    key: "presser_foot_lift",
    label: "Presser Foot Lift (knee)",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 13",
    tier: "recommended",
    group: "Performance",
  },

  // ══════════════════════════════════════════════════════════
  // Needle & Thread
  // ══════════════════════════════════════════════════════════
  {
    key: "needle_system",
    label: "Needle System",
    type: "text",
    placeholder: "e.g. DB×1, DC×27, UY128GAS",
    required: true,
    tier: "essential",
    group: "Needle & Thread",
  },
  {
    key: "needle_size_range",
    label: "Needle Size Range",
    type: "text",
    placeholder: "e.g. #9 ~ #18 (65 ~ 110)",
    tier: "recommended",
    group: "Needle & Thread",
  },
  {
    key: "thread_type",
    label: "Thread Type Supported",
    type: "multi-select",
    options: [
      { value: "polyester", label: "Polyester" },
      { value: "cotton", label: "Cotton" },
      { value: "nylon", label: "Nylon" },
      { value: "kevlar", label: "Kevlar" },
      { value: "silk", label: "Silk" },
      { value: "bonded", label: "Bonded Nylon" },
    ],
    tier: "recommended",
    group: "Needle & Thread",
  },
  {
    key: "thread_count_tex",
    label: "Thread Count / Tex",
    type: "text",
    placeholder: "e.g. Tkt 30-60 / Tex 21-40",
    tier: "advanced",
    group: "Needle & Thread",
  },

  // ══════════════════════════════════════════════════════════
  // Mechanical
  // ══════════════════════════════════════════════════════════
  {
    key: "motor_type",
    label: "Motor Type",
    type: "select",
    options: [
      { value: "servo", label: "Servo Motor" },
      { value: "direct-drive", label: "Direct Drive" },
      { value: "clutch", label: "Clutch Motor" },
      { value: "built-in", label: "Built-in Motor" },
      { value: "stepping", label: "Stepping Motor" },
      { value: "brushless", label: "Brushless" },
    ],
    required: true,
    tier: "essential",
    group: "Mechanical",
  },
  {
    key: "feed_mechanism",
    label: "Feed Mechanism",
    type: "select",
    options: [
      { value: "drop-feed", label: "Drop Feed" },
      { value: "needle-feed", label: "Needle Feed" },
      { value: "compound-feed", label: "Compound Feed" },
      { value: "walking-foot", label: "Walking Foot" },
      { value: "unison-feed", label: "Unison Feed" },
      { value: "puller-feed", label: "Puller Feed" },
      { value: "top-bottom-feed", label: "Top & Bottom Feed" },
      { value: "differential", label: "Differential Feed" },
    ],
    tier: "essential",
    group: "Mechanical",
  },
  {
    key: "hook_type",
    label: "Hook / Looper Type",
    type: "select",
    options: [
      { value: "rotary-hook", label: "Rotary Hook" },
      { value: "vertical-hook", label: "Vertical Hook" },
      { value: "horizontal-hook", label: "Horizontal Hook" },
      { value: "large-hook", label: "Large Rotary Hook" },
      { value: "looper", label: "Looper" },
    ],
    tier: "recommended",
    group: "Mechanical",
  },
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
    tier: "recommended",
    group: "Mechanical",
  },
  // NOTE: motor_power, power_consumption, machine_dimensions,
  // machine_weight, ce_certified and rohs_compliant USED to live here.
  // They moved to the Technical & Compliance step (typed columns on
  // products) in the audit pass that consolidated electrical /
  // physical / regulatory data. Sewing-specific perf specs that DON'T
  // generalize to other appliance categories stay here.

  // ══════════════════════════════════════════════════════════
  // Physical (sewing-specific only — overall machine
  // dimensions/weight are on Technical step)
  // ══════════════════════════════════════════════════════════
  {
    key: "noise_level",
    label: "Noise Level (at max speed)",
    type: "number",
    unit: "dB",
    placeholder: "e.g. 72",
    tier: "advanced",
    group: "Physical",
  },

  // ══════════════════════════════════════════════════════════
  // Material Compatibility
  // ══════════════════════════════════════════════════════════
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
    tier: "essential",
    group: "Material",
  },
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
      { value: "vinyl", label: "Vinyl" },
      { value: "synthetic", label: "Synthetic" },
    ],
    tier: "recommended",
    group: "Material",
  },

  // ══════════════════════════════════════════════════════════
  // Application
  // ══════════════════════════════════════════════════════════
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
    tier: "essential",
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
    tier: "recommended",
    group: "Application",
  },
  {
    key: "suitable_operations",
    label: "Suitable Operations",
    type: "multi-select",
    options: [
      { value: "seaming", label: "Seaming" },
      { value: "topstitching", label: "Topstitching" },
      { value: "hemming", label: "Hemming" },
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
    tier: "advanced",
    group: "Application",
  },

  // CE / RoHS certifications moved to the Technical & Compliance
  // step (typed columns on products). They're regulatory facts about
  // the machine, not performance specs — they belong with voltage
  // and plug types, not with stitch length and thread type.
];
