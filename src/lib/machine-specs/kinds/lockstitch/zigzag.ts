/* ---------------------------------------------------------------------------
   Zig-Zag Lockstitch — Kind Extras (Tier 3)

   Lockstitch head with a zigzag swing. Used for elastic attachment,
   decorative seams, safety gear. The sweep width + programmability
   define the machine's capability.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const ZIGZAG_FIELDS: SpecField[] = [
  {
    key: "zz_zigzag_width",
    label: "Zigzag Width (Max)",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 10",
    required: true,
    tier: "essential",
    group: "Zig-Zag Stitch",
  },
  {
    key: "zz_stitch_patterns_count",
    label: "Built-in Stitch Patterns",
    type: "number",
    placeholder: "e.g. 20",
    tier: "recommended",
    group: "Zig-Zag Stitch",
    helpText: "Number of preset zigzag / decorative stitch patterns.",
  },
  {
    key: "zz_programmable",
    label: "Programmable Zigzag",
    type: "boolean",
    helpText: "Electronic pattern storage with custom programming.",
    tier: "recommended",
    group: "Zig-Zag Stitch",
  },
];
