/* ---------------------------------------------------------------------------
   Heavy-Duty Family Specs — Tier 2

   Subcategory: heavy-duty-machines.
   Kinds: hd-snls, hd-dnls, hd-walking-foot, hd-long-arm, hd-post-bed,
          hd-cylinder-bed, hd-zigzag, hd-extra, hd-tape-edge,
          hd-carpet-binding.

   Most heavy-duty kinds are heavy-duty VARIANTS of mechanisms we
   already model (lockstitch single needle, double needle, walking-
   foot, long-arm, cylinder-bed, post-bed, zig-zag). Their geometric
   field shape is identical to the standard variant — we reuse the
   lockstitch geometry kind-extras directly in the resolver. What
   stays family-level here is what makes a head HEAVY-DUTY: max
   material thickness, max thread thickness, frame reinforcement,
   large hooks, cooling system.

   Keys are prefixed `hd2_` (Heavy-Duty tier-2) so they don't
   collide with the existing `hd_` prefix used by the lockstitch
   heavy-duty KIND extras (kinds/lockstitch/heavy-duty.ts) — both
   need to coexist when a heavy-duty product is also a lockstitch
   walking-foot, etc.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../types";

export const HEAVY_DUTY_FAMILY_FIELDS: SpecField[] = [
  // ══════════════════════════════════════════════════════════
  // Configuration
  // ══════════════════════════════════════════════════════════
  {
    key: "hd2_underlying_class",
    label: "Underlying Stitch Class",
    type: "select",
    options: [
      { value: "lockstitch-single", label: "Single Needle Lockstitch" },
      { value: "lockstitch-double", label: "Double Needle Lockstitch" },
      { value: "walking-foot", label: "Walking-Foot Lockstitch" },
      { value: "zigzag", label: "Zig-Zag Lockstitch" },
      { value: "chainstitch", label: "Chainstitch" },
    ],
    required: true,
    tier: "essential",
    group: "Configuration",
    helpText: "Heavy-duty heads are reinforced versions of standard mechanisms.",
  },
  {
    key: "hd2_bed_type",
    label: "Bed Type",
    type: "select",
    options: [
      { value: "flat-bed", label: "Flat Bed" },
      { value: "cylinder-bed", label: "Cylinder Bed" },
      { value: "post-bed", label: "Post Bed" },
      { value: "long-arm", label: "Long Arm" },
      { value: "tape-edge", label: "Tape-Edge / Mattress" },
    ],
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "hd2_drive_type",
    label: "Drive & Automation",
    type: "select",
    options: [
      { value: "standard-clutch", label: "Standard Clutch" },
      { value: "direct-drive", label: "Direct-Drive Servo" },
      { value: "computerized", label: "Fully Automatic Computerized" },
    ],
    tier: "essential",
    group: "Configuration",
  },

  // ══════════════════════════════════════════════════════════
  // Heavy-Duty Capacity (the headline specs for this family)
  // ══════════════════════════════════════════════════════════
  {
    key: "hd2_max_material_thickness",
    label: "Max Material Thickness",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 14",
    required: true,
    tier: "essential",
    group: "Heavy-Duty Capacity",
    helpText: "Maximum stack of fabric / leather / canvas the head can penetrate.",
  },
  {
    key: "hd2_max_thread_thickness",
    label: "Max Thread Thickness",
    type: "text",
    placeholder: "e.g. Tex 138",
    tier: "essential",
    group: "Heavy-Duty Capacity",
    helpText: "Heaviest thread the head can drive (Tex / Tkt).",
  },
  {
    key: "hd2_reinforced_frame",
    label: "Reinforced Frame",
    type: "boolean",
    tier: "essential",
    group: "Heavy-Duty Capacity",
    helpText: "Cast / welded reinforcement vs. standard stamped frame.",
  },
  {
    key: "hd2_oversized_hook",
    label: "Oversized Hook / Looper",
    type: "boolean",
    tier: "recommended",
    group: "Heavy-Duty Capacity",
    helpText: "Larger hook geometry for thick thread + dense stacks.",
  },
  {
    key: "hd2_needle_cooling",
    label: "Needle Cooling System",
    type: "select",
    options: [
      { value: "none", label: "None" },
      { value: "air", label: "Air-Cooled" },
      { value: "silicone", label: "Silicone Lubrication" },
      { value: "hybrid", label: "Air + Silicone" },
    ],
    tier: "recommended",
    group: "Heavy-Duty Capacity",
    helpText: "Heavy thread + thick stacks generate heat — cooling prevents needle break.",
  },

  // ══════════════════════════════════════════════════════════
  // Performance
  // ══════════════════════════════════════════════════════════
  {
    key: "hd2_max_sewing_speed",
    label: "Max Sewing Speed",
    type: "number",
    unit: "spm",
    placeholder: "e.g. 2500",
    tier: "essential",
    group: "Performance",
    helpText: "Heavy-duty heads run slower than light-fabric — torque comes first.",
  },
  {
    key: "hd2_stitch_length_max",
    label: "Stitch Length Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 12",
    step: 0.1,
    tier: "recommended",
    group: "Performance",
  },

  // ══════════════════════════════════════════════════════════
  // Application
  // ══════════════════════════════════════════════════════════
  {
    key: "hd2_intended_materials",
    label: "Intended Materials",
    type: "multi-select",
    options: [
      { value: "denim", label: "Denim / Jeans" },
      { value: "canvas", label: "Canvas" },
      { value: "leather", label: "Leather" },
      { value: "webbing", label: "Webbing / Strapping" },
      { value: "upholstery", label: "Upholstery" },
      { value: "sail", label: "Sail / Tarpaulin" },
      { value: "automotive", label: "Automotive Trim" },
      { value: "harness", label: "Harness / PPE" },
      { value: "carpet", label: "Carpet / Rug" },
      { value: "mattress", label: "Mattress / Bedding" },
    ],
    tier: "essential",
    group: "Application",
  },
];
