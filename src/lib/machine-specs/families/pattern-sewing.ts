/* ---------------------------------------------------------------------------
   Pattern Sewing Family Specs — Tier 2

   Programmable XY pattern stitchers — the head sits still while a
   work clamp moves the fabric in X and Y to trace a pre-programmed
   pattern. Used for:
     · emblems, labels, military patches
     · pocket welts, darts, belt loops
     · auto sleeve setting, waistband attaching
     · custom decorative stitching

   Differs structurally from every other family: the WORK AREA
   (X × Y envelope) is the headline spec, not stitch geometry.
   Buyers compare these on:
     · work area dimensions
     · max stitches per pattern
     · pattern memory + programming method
     · max XY clamp speed (separate from sewing speed)

   Keys are prefixed `ps_` (Pattern Sewing) so nothing collides with
   sibling families when serialised into the same template_specs
   JSON column.

   Specialized stations (pocket welt, dart, belt loop, sleeve setter,
   waistband, label patch, vision, template, tacking) get their own
   kind-extras in `kinds/pattern-sewing/` because their field shape
   diverges meaningfully from the generic XY envelope.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../types";

export const PATTERN_SEWING_FAMILY_FIELDS: SpecField[] = [
  // ══════════════════════════════════════════════════════════
  // Work Area
  // ══════════════════════════════════════════════════════════
  {
    key: "ps_work_area_x",
    label: "Work Area — X (Width)",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 300",
    required: true,
    tier: "essential",
    group: "Work Area",
    helpText: "Maximum X-axis clamp travel — sets the widest pattern the head can sew.",
  },
  {
    key: "ps_work_area_y",
    label: "Work Area — Y (Length)",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 200",
    required: true,
    tier: "essential",
    group: "Work Area",
    helpText: "Maximum Y-axis clamp travel — sets the longest pattern the head can sew.",
  },
  {
    key: "ps_max_stitches_per_pattern",
    label: "Max Stitches per Pattern",
    type: "number",
    placeholder: "e.g. 20000",
    tier: "recommended",
    group: "Work Area",
    helpText: "Total stitches the head can run in a single programmed pattern.",
  },

  // ══════════════════════════════════════════════════════════
  // Programming
  // ══════════════════════════════════════════════════════════
  {
    key: "ps_pattern_memory",
    label: "Pattern Memory",
    type: "number",
    placeholder: "e.g. 999",
    tier: "essential",
    group: "Programming",
    helpText: "Number of programmed patterns the controller can store.",
  },
  {
    key: "ps_programming_methods",
    label: "Programming Methods",
    type: "multi-select",
    options: [
      { value: "control-panel", label: "Control Panel / Keypad" },
      { value: "usb", label: "USB Drive" },
      { value: "network", label: "Network (LAN / WiFi)" },
      { value: "cad-import", label: "CAD File Import (DXF / DST)" },
      { value: "teach-mode", label: "Teach Mode (Trace + Save)" },
    ],
    tier: "recommended",
    group: "Programming",
  },
  {
    key: "ps_pattern_scaling",
    label: "Pattern Scaling / Rotation",
    type: "boolean",
    tier: "recommended",
    group: "Programming",
    helpText: "Controller can scale and rotate stored patterns without re-programming.",
  },

  // ══════════════════════════════════════════════════════════
  // Performance
  // ══════════════════════════════════════════════════════════
  {
    key: "ps_max_sewing_speed",
    label: "Max Sewing Speed",
    type: "number",
    unit: "spm",
    placeholder: "e.g. 2700",
    tier: "essential",
    group: "Performance",
    helpText: "Stitches per minute. Lower than a flat lockstitch because the XY clamp adds inertia.",
  },
  {
    key: "ps_max_xy_speed",
    label: "Max XY Clamp Speed",
    type: "number",
    unit: "mm/s",
    placeholder: "e.g. 350",
    tier: "advanced",
    group: "Performance",
    helpText: "Top speed of the work-clamp travel between stitches.",
  },
  {
    key: "ps_stitch_length_max",
    label: "Stitch Length Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 12.7",
    step: 0.1,
    tier: "recommended",
    group: "Performance",
  },

  // ══════════════════════════════════════════════════════════
  // Configuration
  // ══════════════════════════════════════════════════════════
  {
    key: "ps_head_type",
    label: "Sewing Head Type",
    type: "select",
    options: [
      { value: "lockstitch", label: "Lockstitch" },
      { value: "chainstitch", label: "Chainstitch" },
      { value: "zigzag", label: "Zig-Zag" },
      { value: "double-needle", label: "Double Needle" },
    ],
    required: true,
    tier: "essential",
    group: "Configuration",
  },
  {
    key: "ps_drive_type",
    label: "Drive & Automation",
    type: "select",
    options: [
      { value: "direct-drive", label: "Direct-Drive Servo" },
      { value: "computerized", label: "Fully Automatic Computerized" },
      { value: "stepping-motor", label: "Intelligent Stepping Motor" },
    ],
    tier: "essential",
    group: "Configuration",
    helpText: "Pattern sewers are always electronically driven — clutch motors don't apply.",
  },
  {
    key: "ps_clamp_type",
    label: "Work Clamp Type",
    type: "select",
    options: [
      { value: "single", label: "Single Clamp" },
      { value: "split", label: "Split / Two-Piece Clamp" },
      { value: "interchangeable", label: "Interchangeable Clamp Set" },
      { value: "vacuum", label: "Vacuum Hold-Down" },
    ],
    tier: "recommended",
    group: "Configuration",
  },

  // ══════════════════════════════════════════════════════════
  // Automation
  // ══════════════════════════════════════════════════════════
  {
    key: "ps_auto_thread_trimmer",
    label: "Auto Thread Trimmer",
    type: "boolean",
    tier: "essential",
    group: "Automation",
  },
  {
    key: "ps_auto_clamp_open",
    label: "Auto Clamp Open at End",
    type: "boolean",
    tier: "recommended",
    group: "Automation",
  },
  {
    key: "ps_laser_pointer",
    label: "Laser Pointer",
    type: "boolean",
    tier: "recommended",
    group: "Automation",
    helpText: "Cross-hair laser shows where the next stitch will land — speeds operator setup.",
  },
  {
    key: "ps_auto_lubrication",
    label: "Auto Lubrication",
    type: "boolean",
    tier: "advanced",
    group: "Automation",
  },
];
