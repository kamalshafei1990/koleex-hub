/* ---------------------------------------------------------------------------
   Double Needle Family Specs — Tier 2

   Lockstitch lineage with TWO needles in parallel. Used for:
     · denim / jeans topstitching
     · upholstery double rows
     · workwear waistbands
     · suitcase / luggage
     · footwear post-bed work

   The single biggest SKU differentiator on a double-needle head is
   NEEDLE DISTANCE (gauge). A 4.8 mm gauge is a different SKU from
   a 6.4 mm even with everything else identical. SPLIT-BAR vs FIXED
   matters second — split-bar lets the operator stop one needle
   independently for clean corners.

   Keys are prefixed `dn_` (Double Needle) so nothing collides with
   the common (no prefix), `ls_`, `ov_`, `il_` tiers when serialised
   into the same template_specs JSON column.

   Geometric kind-extras (walking-foot, long-arm, cylinder-bed,
   post-bed, feed-off-arm, heavy-duty) REUSE the lockstitch extras
   directly — the underlying mechanism is identical regardless of
   needle count. Wired in the resolver. Chainstitch double needle
   gets its own extras since it's a different stitch class.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../types";

export const DOUBLE_NEEDLE_FAMILY_FIELDS: SpecField[] = [
  // ══════════════════════════════════════════════════════════
  // Configuration
  // ══════════════════════════════════════════════════════════
  {
    key: "dn_needle_distance",
    label: "Needle Distance (Gauge)",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 4.8",
    step: 0.1,
    required: true,
    tier: "essential",
    group: "Configuration",
    helpText:
      "Distance between the two needles. The single biggest SKU differentiator. Common: 1.6 / 3.2 / 4.0 / 4.8 / 6.4 / 9.5 mm.",
  },
  {
    key: "dn_needle_bar_type",
    label: "Needle Bar Type",
    type: "select",
    options: [
      { value: "fixed", label: "Fixed Bar (Both move together)" },
      { value: "split", label: "Split Bar (Independent stop)" },
    ],
    required: true,
    tier: "essential",
    group: "Configuration",
    helpText: "Split-bar lets each needle stop independently for clean corners without skips.",
  },
  {
    key: "dn_stitch_class",
    label: "Stitch Class",
    type: "select",
    options: [
      { value: "lockstitch", label: "Lockstitch (Class 301)" },
      { value: "chainstitch", label: "Chainstitch (Class 401)" },
    ],
    tier: "essential",
    group: "Configuration",
    helpText: "Chainstitch double needle has no bobbin thread — used for denim waistbands.",
  },
  {
    key: "dn_hook_size",
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
    key: "dn_bobbin_type",
    label: "Bobbin Type",
    type: "select",
    options: [
      { value: "standard", label: "Standard (10 mm)" },
      { value: "large-capacity", label: "Large Capacity (15–20 mm)" },
    ],
    tier: "recommended",
    group: "Configuration",
    helpText: "N/A for chainstitch double-needle heads.",
  },
  {
    key: "dn_bed_type",
    label: "Bed Type",
    type: "select",
    options: [
      { value: "flat-bed", label: "Flat Bed" },
      { value: "cylinder-bed", label: "Cylinder Bed" },
      { value: "post-bed", label: "Post Bed" },
      { value: "feed-off-arm", label: "Feed-Off-the-Arm" },
    ],
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "dn_max_material_thickness",
    label: "Max Material Thickness",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 8",
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "dn_drive_type",
    label: "Drive & Automation",
    type: "select",
    options: [
      { value: "standard-clutch", label: "Standard High-Speed (Clutch)" },
      { value: "direct-drive", label: "Direct-Drive Servo" },
      { value: "computerized", label: "Fully Automatic Computerized" },
      { value: "stepping-motor", label: "Intelligent Stepping Motor" },
    ],
    tier: "essential",
    group: "Configuration",
  },

  // ══════════════════════════════════════════════════════════
  // Stitch & Feed
  // ══════════════════════════════════════════════════════════
  {
    key: "dn_reverse_feed",
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
    key: "dn_feed_dog_type",
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
  // Automation
  // ══════════════════════════════════════════════════════════
  {
    key: "dn_auto_thread_trimmer",
    label: "Auto Thread Trimmer",
    type: "boolean",
    tier: "essential",
    group: "Automation",
  },
  {
    key: "dn_auto_backtack",
    label: "Auto Back-tack",
    type: "boolean",
    helpText: "Automatic reinforcement at seam start / end.",
    tier: "essential",
    group: "Automation",
  },
  {
    key: "dn_auto_presser_foot_lifter",
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
    key: "dn_auto_thread_wiper",
    label: "Auto Thread Wiper",
    type: "boolean",
    tier: "recommended",
    group: "Automation",
  },
  {
    key: "dn_needle_positioning",
    label: "Needle Positioning (stop-up / stop-down)",
    type: "boolean",
    tier: "essential",
    group: "Automation",
  },
  {
    key: "dn_auto_bobbin_winder",
    label: "Auto Bobbin Winder",
    type: "boolean",
    tier: "advanced",
    group: "Automation",
  },
  {
    key: "dn_low_bobbin_sensor",
    label: "Low-Bobbin Sensor",
    type: "boolean",
    tier: "advanced",
    group: "Automation",
  },
];
