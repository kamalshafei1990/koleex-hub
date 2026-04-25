/* ---------------------------------------------------------------------------
   Special Machines Family Specs — Tier 2

   Subcategory: special-machines.
   Kinds: buttonhole-shirt, buttonhole-eyelet, button-attach, bartack,
          blindstitch, felling, zigzag, smocking, picot, pleating,
          snap-rivet, elastic-cording, belt-loop-maker, sleeve-placket,
          collar-runstitcher, yoke-attach, basting, tape-edge-mattress,
          ultrasonic-bonding.

   The kinds in this subcategory are genuinely diverse. A thin
   family card with shared identity + drive + automation is the most
   honest model — most differentiation lives in per-kind extras.

   Three internal sub-groups (not enforced in code, just for mental
   model):
     · Cycle heads (buttonhole, bartack, button-attach, blindstitch)
       — sew a fixed cycle and stop.
     · Sub-station automation (felling, sleeve-placket, collar
       run-stitcher, yoke-attach, basting) — programmable substations
       with their own cycle envelopes.
     · Single-purpose decorative / specialty (zigzag, smocking, picot,
       pleating, snap-rivet, elastic-cording, belt-loop-maker,
       tape-edge-mattress, ultrasonic-bonding).

   Keys are prefixed `sp_` (Special) so nothing collides with sibling
   families. Cycle-head extras carry their own sub-prefixes
   (sp_bh_, sp_ba_, sp_btn_, sp_bs_, etc.) for clarity.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../types";

export const SPECIAL_FAMILY_FIELDS: SpecField[] = [
  // ══════════════════════════════════════════════════════════
  // Identity & Configuration
  // ══════════════════════════════════════════════════════════
  {
    key: "sp_machine_class",
    label: "Machine Class",
    type: "select",
    options: [
      { value: "cycle-head", label: "Cycle Head (Fixed Cycle)" },
      { value: "sub-station", label: "Sub-Station (Programmable)" },
      { value: "decorative", label: "Decorative / Specialty" },
      { value: "bonding", label: "Bonding / Welding" },
    ],
    required: true,
    tier: "essential",
    group: "Configuration",
    helpText: "Cycle heads sew a fixed cycle and stop; sub-stations run programmable sequences; decorative heads are continuous.",
  },
  {
    key: "sp_drive_type",
    label: "Drive & Automation",
    type: "select",
    options: [
      { value: "standard-clutch", label: "Standard Clutch" },
      { value: "direct-drive", label: "Direct-Drive Servo" },
      { value: "computerized", label: "Fully Automatic Computerized" },
      { value: "stepping-motor", label: "Intelligent Stepping Motor" },
    ],
    tier: "essential",
    group: "Configuration",
  },
  {
    key: "sp_max_material_thickness",
    label: "Max Material Thickness",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 5",
    tier: "recommended",
    group: "Configuration",
  },
  {
    key: "sp_underlying_stitch",
    label: "Underlying Stitch Class",
    type: "select",
    options: [
      { value: "lockstitch", label: "Lockstitch (Class 301)" },
      { value: "chainstitch", label: "Chainstitch (Class 401)" },
      { value: "zigzag", label: "Zig-Zag" },
      { value: "blindstitch", label: "Blind / Skip Stitch" },
      { value: "ultrasonic", label: "Ultrasonic (No Thread)" },
      { value: "none", label: "Setter (No Stitching)" },
    ],
    tier: "recommended",
    group: "Configuration",
  },

  // ══════════════════════════════════════════════════════════
  // Performance
  // ══════════════════════════════════════════════════════════
  {
    key: "sp_max_sewing_speed",
    label: "Max Sewing Speed",
    type: "number",
    unit: "spm",
    placeholder: "e.g. 3300",
    tier: "essential",
    group: "Performance",
    helpText: "Cycle heads run on a per-cycle SPM; bonding heads measure mm/min instead.",
  },
  {
    key: "sp_pieces_per_hour",
    label: "Pieces per Hour",
    type: "number",
    placeholder: "e.g. 1200",
    tier: "recommended",
    group: "Performance",
    helpText: "Wall-clock production rate at typical operator pace.",
  },

  // ══════════════════════════════════════════════════════════
  // Automation
  // ══════════════════════════════════════════════════════════
  {
    key: "sp_auto_thread_trimmer",
    label: "Auto Thread Trimmer",
    type: "boolean",
    tier: "essential",
    group: "Automation",
  },
  {
    key: "sp_auto_clamp",
    label: "Auto Clamp / Foot Lifter",
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
    key: "sp_pattern_memory",
    label: "Pattern Memory",
    type: "number",
    placeholder: "e.g. 50",
    tier: "recommended",
    group: "Automation",
    helpText: "Number of cycle programs the controller stores. N/A for non-programmable heads.",
  },
  {
    key: "sp_pneumatic_required",
    label: "Pneumatic Supply Required",
    type: "boolean",
    tier: "advanced",
    group: "Automation",
    helpText: "Most cycle heads + sub-stations need an air-compressor line.",
  },
];
