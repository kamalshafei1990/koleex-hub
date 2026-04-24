/* ---------------------------------------------------------------------------
   Lockstitch Family Specs — Tier 2

   Fields shared by ALL lockstitch kinds (Standard, Walking-Foot,
   Long-Arm, Cylinder-Bed, Post-Bed, Feed-Off-Arm, Zig-Zag, Heavy-
   Duty, etc.). Kind-specific extras layer on top via the `kinds/`
   folder.

   Keys are prefixed `ls_` (LockStitch) so nothing collides with the
   Common tier's universal keys when both are serialised into the
   same `template_specs` JSON column.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../types";

export const LOCKSTITCH_FAMILY_FIELDS: SpecField[] = [
  // ══════════════════════════════════════════════════════════
  // Configuration
  // ══════════════════════════════════════════════════════════
  {
    key: "ls_bed_type",
    label: "Bed Type",
    type: "select",
    options: [
      { value: "flat-bed", label: "Flat Bed" },
      { value: "cylinder-bed", label: "Cylinder Bed" },
      { value: "post-bed", label: "Post Bed" },
      { value: "feed-off-arm", label: "Feed-Off-the-Arm" },
    ],
    required: true,
    tier: "essential",
    group: "Configuration",
    helpText: "Usually dictated by the Machine Kind you picked in Classify.",
  },
  {
    key: "ls_hook_size",
    label: "Hook Size",
    type: "select",
    options: [
      { value: "standard", label: "Standard (M-style)" },
      { value: "large", label: "Large (L-style)" },
      { value: "extra-large", label: "Extra Large (XXL)" },
    ],
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "ls_bobbin_type",
    label: "Bobbin Type",
    type: "select",
    options: [
      { value: "standard", label: "Standard (10 mm)" },
      { value: "large-capacity", label: "Large Capacity (15–20 mm)" },
    ],
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "ls_max_material_thickness",
    label: "Max Material Thickness",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 8",
    tier: "recommended",
    group: "Configuration",
    helpText: "Maximum stack of fabric layers the machine can penetrate.",
  },

  // ══════════════════════════════════════════════════════════
  // Stitch & Feed
  // ══════════════════════════════════════════════════════════
  {
    key: "ls_stitch_pattern",
    label: "Stitch Pattern",
    type: "select",
    options: [
      { value: "straight", label: "Straight Stitch" },
      { value: "zigzag", label: "Zigzag" },
      { value: "programmable", label: "Programmable" },
    ],
    tier: "essential",
    group: "Stitch & Feed",
  },
  {
    key: "ls_reverse_feed",
    label: "Reverse Feed",
    type: "select",
    options: [
      { value: "lever", label: "Lever (Manual)" },
      { value: "electronic", label: "Electronic" },
      { value: "none", label: "None" },
    ],
    tier: "recommended",
    group: "Stitch & Feed",
  },
  {
    key: "ls_feed_dog_type",
    label: "Feed Dog Type",
    type: "select",
    options: [
      { value: "standard", label: "Standard" },
      { value: "fine", label: "Fine Pitch" },
      { value: "large", label: "Large Pitch" },
      { value: "teflon", label: "Teflon-Coated" },
    ],
    tier: "advanced",
    group: "Stitch & Feed",
  },

  // ══════════════════════════════════════════════════════════
  // Automation (core)
  // ══════════════════════════════════════════════════════════
  {
    key: "ls_auto_thread_trimmer",
    label: "Auto Thread Trimmer",
    type: "boolean",
    tier: "essential",
    group: "Automation",
  },
  {
    key: "ls_auto_backtack",
    label: "Auto Back-tack",
    type: "boolean",
    helpText: "Automatic reinforcement at seam start / end.",
    tier: "essential",
    group: "Automation",
  },
  {
    key: "ls_auto_presser_foot_lifter",
    label: "Auto Presser Foot Lifter",
    type: "select",
    options: [
      { value: "none", label: "Manual only" },
      { value: "pneumatic", label: "Pneumatic" },
      { value: "electronic", label: "Electronic" },
    ],
    tier: "essential",
    group: "Automation",
  },
  {
    key: "ls_auto_thread_wiper",
    label: "Auto Thread Wiper",
    type: "boolean",
    tier: "recommended",
    group: "Automation",
  },
  {
    key: "ls_needle_positioning",
    label: "Needle Positioning (stop-up / stop-down)",
    type: "boolean",
    tier: "essential",
    group: "Automation",
  },

  // ══════════════════════════════════════════════════════════
  // Automation (optional)
  // ══════════════════════════════════════════════════════════
  {
    key: "ls_auto_bobbin_winder",
    label: "Auto Bobbin Winder",
    type: "boolean",
    tier: "advanced",
    group: "Automation",
  },
  {
    key: "ls_auto_backstitch_start_end",
    label: "Auto Back-stitch at Start/End",
    type: "boolean",
    tier: "advanced",
    group: "Automation",
  },
  {
    key: "ls_low_bobbin_sensor",
    label: "Low-Bobbin Sensor",
    type: "boolean",
    tier: "advanced",
    group: "Automation",
  },
];
