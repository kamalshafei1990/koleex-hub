/* ---------------------------------------------------------------------------
   Multi-Needle Family Specs — Tier 2

   Heads with 3+ needles running in parallel. Includes:
     · 3 / 4 / 6 / 8 / 12-needle chainstitch waistband heads
     · multi-needle coverstitch
     · multi-needle lockstitch (jeans / topstitch decoration)
     · multi-needle quilting heads (12 – 32+ needles for mattress
       and puffer-jacket panel quilting)
     · picot / fagoting decorative heads

   The KEY differentiator is needle count + needle gauge — those two
   together define the working width and the SKU. Stitch class
   (lockstitch / chainstitch / coverstitch) varies across kinds so
   it sits as a family-level field too.

   Keys are prefixed `mn_` (Multi-Needle) so nothing collides with
   sibling families when serialised into the same template_specs
   JSON column.

   Geometric kind-extras for the standard mechanical variants
   (long-arm, etc.) REUSE the lockstitch extras directly. Quilting
   and picot/fagoting get their own kind-extras files because their
   field shape is genuinely different (panel area, pattern memory,
   fagoting gauge — none of which exist in lockstitch).
   --------------------------------------------------------------------------- */

import type { SpecField } from "../types";

export const MULTI_NEEDLE_FAMILY_FIELDS: SpecField[] = [
  // ══════════════════════════════════════════════════════════
  // Configuration
  // ══════════════════════════════════════════════════════════
  {
    key: "mn_needle_count",
    label: "Needle Count",
    type: "number",
    placeholder: "e.g. 12",
    min: 3,
    required: true,
    tier: "essential",
    group: "Configuration",
    helpText: "Total needles in the head. Quilting heads can run up to 32+.",
  },
  {
    key: "mn_needle_gauge",
    label: "Needle Gauge",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 6.4",
    step: 0.1,
    required: true,
    tier: "essential",
    group: "Configuration",
    helpText: "Distance between needles. Defines the working width together with needle count.",
  },
  {
    key: "mn_working_width",
    label: "Total Working Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 76.8",
    step: 0.1,
    tier: "recommended",
    group: "Configuration",
    helpText: "Edge-to-edge width covered by the needle bar (gauge × (count-1)).",
  },
  {
    key: "mn_stitch_class",
    label: "Stitch Class",
    type: "select",
    options: [
      { value: "lockstitch", label: "Lockstitch (Class 301)" },
      { value: "chainstitch", label: "Chainstitch (Class 401)" },
      { value: "coverstitch", label: "Coverstitch (Class 602)" },
    ],
    required: true,
    tier: "essential",
    group: "Configuration",
  },
  {
    key: "mn_looper_config",
    label: "Looper Configuration",
    type: "select",
    options: [
      { value: "single-shared", label: "Single Shared Looper" },
      { value: "per-needle", label: "Looper per Needle" },
      { value: "top-bottom", label: "Top + Bottom Looper" },
    ],
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "mn_bed_type",
    label: "Bed Type",
    type: "select",
    options: [
      { value: "flat-bed", label: "Flat Bed" },
      { value: "cylinder-bed", label: "Cylinder Bed" },
      { value: "long-arm", label: "Long Arm" },
      { value: "panel", label: "Panel / Quilting Bed" },
    ],
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "mn_max_material_thickness",
    label: "Max Material Thickness",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 12",
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "mn_drive_type",
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
    key: "mn_stitch_length_min",
    label: "Stitch Length — Min",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 1.4",
    step: 0.1,
    tier: "essential",
    group: "Stitch & Feed",
  },
  {
    key: "mn_stitch_length_max",
    label: "Stitch Length — Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 5",
    step: 0.1,
    tier: "essential",
    group: "Stitch & Feed",
  },
  {
    key: "mn_differential_feed",
    label: "Differential Feed",
    type: "boolean",
    tier: "recommended",
    group: "Stitch & Feed",
    helpText: "Some chainstitch waistband heads have differential feed for stretch fabrics.",
  },
  {
    key: "mn_top_cover_stitch",
    label: "Top Cover Stitch",
    type: "boolean",
    tier: "recommended",
    group: "Stitch & Feed",
    helpText: "True for multi-needle coverstitch + decorative top-cover heads.",
  },

  // ══════════════════════════════════════════════════════════
  // Automation
  // ══════════════════════════════════════════════════════════
  {
    key: "mn_auto_thread_trimmer",
    label: "Auto Thread / Chain Trimmer",
    type: "boolean",
    tier: "essential",
    group: "Automation",
  },
  {
    key: "mn_auto_presser_foot_lifter",
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
    key: "mn_lubrication_system",
    label: "Lubrication System",
    type: "select",
    options: [
      { value: "oiled", label: "Fully-oiled" },
      { value: "semi-dry", label: "Semi-Dry" },
      { value: "dry", label: "Dry / Oil-Less" },
    ],
    tier: "recommended",
    group: "Automation",
  },
  {
    key: "mn_individual_needle_disengage",
    label: "Per-Needle Disengage",
    type: "boolean",
    tier: "advanced",
    group: "Automation",
    helpText: "Operator can lift any single needle out of action — useful for narrowing rows on the fly.",
  },
];
