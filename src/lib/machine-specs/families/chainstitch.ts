/* ---------------------------------------------------------------------------
   Chainstitch Family Specs — Tier 2

   Industrial chainstitch heads — Class 401 (two-thread chain) is the
   common production stitch (denim waistbands, workwear, sportswear).
   Class 101 (single-thread chain) appears mainly on basting and
   decorative heads — included as a stitch-class option.

   Differs from lockstitch in that there's no bobbin — a looper
   underneath the throat plate forms the chain on the back of the
   work. Chainstitch has more stretch than lockstitch, which is why
   it's preferred for elastic-waistband seams.

   Keys are prefixed `cs_` (ChainStitch) so nothing collides with the
   common (no prefix), `ls_`, `ov_`, `il_`, `dn_` tiers when
   serialised into the same template_specs JSON column.

   Geometric kind-extras (walking-foot, long-arm, cylinder-bed,
   post-bed, feed-off-arm, heavy-duty) REUSE the lockstitch extras
   directly — same physical mechanism. Wired in the resolver.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../types";

export const CHAINSTITCH_FAMILY_FIELDS: SpecField[] = [
  // ══════════════════════════════════════════════════════════
  // Configuration
  // ══════════════════════════════════════════════════════════
  {
    key: "cs_needle_count",
    label: "Needle Count",
    type: "select",
    options: [
      { value: "1", label: "1 Needle" },
      { value: "2", label: "2 Needles" },
      { value: "3", label: "3+ Needles (see Multi-Needle family)" },
    ],
    required: true,
    tier: "essential",
    group: "Configuration",
  },
  {
    key: "cs_thread_class",
    label: "Stitch Class",
    type: "select",
    options: [
      { value: "101", label: "Class 101 — Single-Thread Chain" },
      { value: "401", label: "Class 401 — Two-Thread Chain" },
      { value: "401-multi", label: "Class 401 — Multi-Thread Chain" },
    ],
    required: true,
    tier: "essential",
    group: "Configuration",
    helpText: "401 (two-thread) is the production workhorse. 101 is mostly basting / decorative.",
  },
  {
    key: "cs_needle_gauge",
    label: "Needle Gauge",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 4.8",
    step: 0.1,
    tier: "recommended",
    group: "Configuration",
    helpText: "Distance between needles on multi-needle chainstitch heads. N/A for single-needle.",
  },
  {
    key: "cs_looper_type",
    label: "Looper Configuration",
    type: "select",
    options: [
      { value: "single", label: "Single Looper" },
      { value: "per-needle", label: "Looper per Needle" },
      { value: "shared", label: "Shared Looper" },
    ],
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "cs_bed_type",
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
    key: "cs_max_material_thickness",
    label: "Max Material Thickness",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 8",
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "cs_drive_type",
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
    key: "cs_stitch_length_min",
    label: "Stitch Length — Min",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 1.4",
    step: 0.1,
    tier: "essential",
    group: "Stitch & Feed",
  },
  {
    key: "cs_stitch_length_max",
    label: "Stitch Length — Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 4.6",
    step: 0.1,
    tier: "essential",
    group: "Stitch & Feed",
  },
  {
    key: "cs_differential_feed_ratio",
    label: "Differential Feed Ratio",
    type: "text",
    placeholder: "e.g. 1:0.7 – 1:2",
    tier: "recommended",
    group: "Stitch & Feed",
    helpText: "When fitted — defines stretch/gather range on knit fabrics.",
  },
  {
    key: "cs_feed_dog_type",
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
    key: "cs_auto_thread_trimmer",
    label: "Auto Thread / Chain Trimmer",
    type: "boolean",
    tier: "essential",
    group: "Automation",
  },
  {
    key: "cs_auto_presser_foot_lifter",
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
    key: "cs_auto_back_suction",
    label: "Auto Back Suction",
    type: "boolean",
    tier: "recommended",
    group: "Automation",
    helpText: "Vacuums the trimmed chain at seam end — clean delivery.",
  },
  {
    key: "cs_lubrication_system",
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
    key: "cs_low_thread_sensor",
    label: "Low-Thread Sensor",
    type: "boolean",
    tier: "advanced",
    group: "Automation",
    helpText: "Stops the head before the looper thread runs out.",
  },
];
