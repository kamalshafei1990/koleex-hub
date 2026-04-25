/* ---------------------------------------------------------------------------
   Interlock / Coverstitch Family Specs — Tier 2

   "Interlock" in our taxonomy = the coverstitch / flatlock head class:
   2+ needles driving parallel top stitches, with a single bottom
   looper (and optionally a top spreader for flatlock) that catches
   all needle threads in one interlocked bottom row.

     · 2N / 3N / 4N coverstitch
     · top-and-bottom coverstitch (flatlock)
     · cylinder-bed, feed-off-arm
     · rib-binding, tape-binding, elastic-attach

   Kind-specific extras (cylinder dims, top spreader specifics, tape
   feeder geometry, elastic feeder ratio, etc.) layer on top via
   the `kinds/interlock/` folder.

   Keys are prefixed `il_` (InterLock) so nothing collides with the
   common (no prefix), `ls_` (lockstitch), or `ov_` (overlock) tiers
   when they share the same template_specs JSON column.

   Why these fields are FAMILY-level:
     · NEEDLE GAUGE is the single biggest differentiator across
       coverstitch heads — a 6.4 mm gauge is a different SKU than a
       3.2 mm gauge even with identical needle count. It belongs at
       the family tier because every kind below carries one.
     · TOP COVER and DIFFERENTIAL FEED define what stitch types and
       what fabrics the head can run. These are universal across
       interlock kinds.
     · DRIVE TYPE / AUTOMATION mirrors the overlock family so the
       admin form has parity across families.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../types";

export const INTERLOCK_FAMILY_FIELDS: SpecField[] = [
  // ══════════════════════════════════════════════════════════
  // Configuration
  // ══════════════════════════════════════════════════════════
  {
    key: "il_needle_count",
    label: "Needle Count",
    type: "select",
    options: [
      { value: "2", label: "2 Needles" },
      { value: "3", label: "3 Needles" },
      { value: "4", label: "4 Needles" },
    ],
    required: true,
    tier: "essential",
    group: "Configuration",
    helpText: "Each needle drives one parallel top row. 3-needle is the cover-seam workhorse.",
  },
  {
    key: "il_needle_gauge",
    label: "Needle Gauge",
    type: "select",
    options: [
      { value: "3.2", label: "3.2 mm" },
      { value: "4.0", label: "4.0 mm" },
      { value: "4.8", label: "4.8 mm" },
      { value: "5.6", label: "5.6 mm" },
      { value: "6.4", label: "6.4 mm" },
    ],
    required: true,
    tier: "essential",
    group: "Configuration",
    helpText: "Distance between needles. The single biggest SKU differentiator on a coverstitch head.",
  },
  {
    key: "il_thread_count",
    label: "Thread Count",
    type: "select",
    options: [
      { value: "3", label: "3 Threads" },
      { value: "4", label: "4 Threads" },
      { value: "5", label: "5 Threads" },
      { value: "6", label: "6 Threads (Top + Bottom Cover)" },
    ],
    tier: "essential",
    group: "Configuration",
  },
  {
    key: "il_looper_config",
    label: "Looper Configuration",
    type: "select",
    options: [
      { value: "bottom-only", label: "Bottom Looper Only" },
      { value: "bottom-spreader", label: "Bottom Looper + Top Spreader" },
      { value: "top-bottom-cover", label: "Top + Bottom Cover (Flatlock)" },
    ],
    tier: "recommended",
    group: "Configuration",
    helpText: "Top spreader / cover decides whether the seam shows a decorative top row.",
  },
  {
    key: "il_bed_type",
    label: "Bed Type",
    type: "select",
    options: [
      { value: "flat-bed", label: "Flat Bed" },
      { value: "cylinder-bed", label: "Cylinder Bed" },
      { value: "feed-off-arm", label: "Feed-Off-the-Arm" },
    ],
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "il_max_material_thickness",
    label: "Max Material Thickness",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 5",
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "il_drive_type",
    label: "Drive & Automation",
    type: "select",
    options: [
      { value: "standard-clutch", label: "Standard High-Speed (Clutch)" },
      { value: "direct-drive", label: "Direct-Drive Servo" },
      { value: "computerized", label: "Fully Automatic Computerized" },
      { value: "stepping-motor", label: "Intelligent Stepping Motor" },
      { value: "air-purify", label: "Air-Purify Computerized" },
    ],
    tier: "essential",
    group: "Configuration",
    helpText: "Same five-tier drive ladder used across overlock + interlock families.",
  },

  // ══════════════════════════════════════════════════════════
  // Stitch & Feed
  // ══════════════════════════════════════════════════════════
  {
    key: "il_stitch_length_min",
    label: "Stitch Length — Min",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 1.4",
    step: 0.1,
    tier: "essential",
    group: "Stitch & Feed",
  },
  {
    key: "il_stitch_length_max",
    label: "Stitch Length — Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 4.4",
    step: 0.1,
    tier: "essential",
    group: "Stitch & Feed",
  },
  {
    key: "il_differential_feed_ratio",
    label: "Differential Feed Ratio",
    type: "text",
    placeholder: "e.g. 0.7 – 1.3",
    tier: "essential",
    group: "Stitch & Feed",
    helpText: "Stretch (<1) and gather (>1) range — defines knit-fabric quality.",
  },
  {
    key: "il_top_cover_stitch",
    label: "Top Cover Stitch",
    type: "boolean",
    tier: "recommended",
    group: "Stitch & Feed",
    helpText: "True when the head produces a decorative top cover row in addition to bottom cover.",
  },
  {
    key: "il_feed_dog_type",
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
    key: "il_auto_thread_trimmer",
    label: "Auto Thread / Chain Trimmer",
    type: "boolean",
    tier: "essential",
    group: "Automation",
  },
  {
    key: "il_auto_presser_foot_lifter",
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
    key: "il_auto_back_suction",
    label: "Auto Back Suction",
    type: "boolean",
    tier: "recommended",
    group: "Automation",
    helpText: "Vacuums the trimmed chain at seam end — clean delivery.",
  },
  {
    key: "il_lubrication_system",
    label: "Lubrication System",
    type: "select",
    options: [
      { value: "oiled", label: "Fully-oiled" },
      { value: "semi-dry", label: "Semi-Dry" },
      { value: "dry", label: "Dry / Oil-Less" },
    ],
    tier: "recommended",
    group: "Automation",
    helpText: "Dry / oil-less heads avoid oil staining on light-colour cover seams.",
  },
  {
    key: "il_needle_cooler",
    label: "Needle Cooler",
    type: "boolean",
    tier: "advanced",
    group: "Automation",
    helpText: "Air-cooled needles for synthetic / sportswear fabrics at high RPM.",
  },
];
