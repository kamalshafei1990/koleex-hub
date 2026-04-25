/* ---------------------------------------------------------------------------
   Overlock Family Specs — Tier 2

   Fields shared by every overlock / serger kind:
     · 1n-2t, 1n-3t, 2n-4t, 5t-safety, rolled-hem, variable-top-feed,
       cylinder-bed, heavy-duty.

   Kind-specific extras (rolled-hem plate sizes, variable-top-feed
   travel, cylinder dimensions, heavy-duty thresholds, 5-thread
   chain stitch geometry) layer on top via the `kinds/overlock/`
   folder.

   Keys are prefixed `ov_` (OVerlock) so nothing collides with the
   Common tier's universal keys when both are serialised into the
   same `template_specs` JSON column.

   Why these fields:
     · A buyer evaluating an overlock cares about thread/needle
       count FIRST (defines what stitch types are achievable),
       then differential feed (knit fabric quality), then stitch
       width/length range, then automation level.
     · Cutting (knife) parameters get their own group because
       overlocks always trim while sewing — the knife geometry is
       commercially differentiating, not an afterthought.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../types";

export const OVERLOCK_FAMILY_FIELDS: SpecField[] = [
  // ══════════════════════════════════════════════════════════
  // Configuration
  // ══════════════════════════════════════════════════════════
  {
    key: "ov_thread_count",
    label: "Thread Count",
    type: "select",
    options: [
      { value: "2", label: "2 Threads" },
      { value: "3", label: "3 Threads" },
      { value: "4", label: "4 Threads" },
      { value: "5", label: "5 Threads (Safety Stitch)" },
      { value: "6", label: "6 Threads" },
    ],
    required: true,
    tier: "essential",
    group: "Configuration",
    helpText: "Total threads engaged at once. Defines achievable stitch types.",
  },
  {
    key: "ov_needle_count",
    label: "Needle Count",
    type: "select",
    options: [
      { value: "1", label: "1 Needle" },
      { value: "2", label: "2 Needles" },
      { value: "3", label: "3 Needles" },
    ],
    required: true,
    tier: "essential",
    group: "Configuration",
  },
  {
    key: "ov_looper_config",
    label: "Looper Configuration",
    type: "select",
    options: [
      { value: "single-lower", label: "Single Lower Looper" },
      { value: "upper-lower", label: "Upper + Lower Looper" },
      { value: "upper-lower-chain", label: "Upper + Lower + Chain Looper" },
      { value: "double-chain", label: "Double Chain (Safety Stitch)" },
    ],
    tier: "recommended",
    group: "Configuration",
    helpText: "Looper stack drives which stitch class the machine produces.",
  },
  {
    key: "ov_bed_type",
    label: "Bed Type",
    type: "select",
    options: [
      { value: "flat-bed", label: "Flat Bed" },
      { value: "cylinder-bed", label: "Cylinder Bed" },
      { value: "curved", label: "Curved Bed" },
    ],
    tier: "recommended",
    group: "Configuration",
    helpText: "Usually dictated by the Machine Kind picked in Classify.",
  },
  {
    key: "ov_max_material_thickness",
    label: "Max Material Thickness",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 5",
    tier: "recommended",
    group: "Configuration",
    helpText: "Maximum stack of fabric layers the machine can penetrate.",
  },

  // ══════════════════════════════════════════════════════════
  // Stitch & Feed
  // ══════════════════════════════════════════════════════════
  {
    key: "ov_stitch_width_min",
    label: "Stitch Width — Min",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 1.5",
    step: 0.1,
    tier: "essential",
    group: "Stitch & Feed",
  },
  {
    key: "ov_stitch_width_max",
    label: "Stitch Width — Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 7",
    step: 0.1,
    tier: "essential",
    group: "Stitch & Feed",
  },
  {
    key: "ov_stitch_length_min",
    label: "Stitch Length — Min",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 0.8",
    step: 0.1,
    tier: "essential",
    group: "Stitch & Feed",
  },
  {
    key: "ov_stitch_length_max",
    label: "Stitch Length — Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 4",
    step: 0.1,
    tier: "essential",
    group: "Stitch & Feed",
  },
  {
    key: "ov_differential_feed_ratio",
    label: "Differential Feed Ratio",
    type: "text",
    placeholder: "e.g. 0.7 – 2.0",
    tier: "essential",
    group: "Stitch & Feed",
    helpText: "Range from gathering (>1) to stretching (<1). Defines knit-fabric quality.",
  },
  {
    key: "ov_feed_dog_type",
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
  // Cutting (overlocks always trim while sewing)
  // ══════════════════════════════════════════════════════════
  {
    key: "ov_cutting_width",
    label: "Cutting Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 4",
    step: 0.1,
    tier: "recommended",
    group: "Cutting",
    helpText: "Distance from needle line to the edge knife.",
  },
  {
    key: "ov_knife_type",
    label: "Knife Type",
    type: "select",
    options: [
      { value: "fixed-upper", label: "Fixed Upper" },
      { value: "moving-upper", label: "Moving Upper" },
      { value: "fixed-lower", label: "Fixed Lower" },
      { value: "moving-lower", label: "Moving Lower" },
      { value: "carbide", label: "Carbide-Tipped" },
    ],
    tier: "recommended",
    group: "Cutting",
  },
  {
    key: "ov_knife_disengage",
    label: "Knife Disengage",
    type: "boolean",
    tier: "advanced",
    group: "Cutting",
    helpText: "Operator can lift the knife out of action without removal.",
  },

  // ══════════════════════════════════════════════════════════
  // Automation
  // ══════════════════════════════════════════════════════════
  {
    key: "ov_auto_thread_trimmer",
    label: "Auto Thread / Chain Trimmer",
    type: "boolean",
    tier: "essential",
    group: "Automation",
    helpText: "Cuts the thread chain at seam end without operator pull.",
  },
  {
    key: "ov_auto_presser_foot_lifter",
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
    key: "ov_auto_back_suction",
    label: "Auto Back Suction",
    type: "boolean",
    tier: "recommended",
    group: "Automation",
    helpText: "Vacuums the trimmed chain at seam end — clean delivery.",
  },
  {
    key: "ov_lubrication_system",
    label: "Lubrication System",
    type: "select",
    options: [
      { value: "oiled", label: "Fully-oiled" },
      { value: "semi-dry", label: "Semi-Dry" },
      { value: "dry", label: "Dry / Oil-Less" },
    ],
    tier: "recommended",
    group: "Automation",
    helpText: "Dry / oil-less heads avoid oil staining on light-colour fabrics.",
  },
  {
    key: "ov_needle_cooler",
    label: "Needle Cooler",
    type: "boolean",
    tier: "advanced",
    group: "Automation",
    helpText: "Air-cooled needle for synthetic fabrics at high RPM.",
  },
];
