/* ---------------------------------------------------------------------------
   Multi-Needle Picot / Fagoting — Tier 3

   Decorative openwork heads. "Fagoting" joins two pieces of fabric
   with a decorative gap; "picot" produces a tiny scalloped edge
   loop. Both are couture/lingerie features. The differentiators
   are the gap/picot dimensions and whether the operator can swap
   pattern plates without tools.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const MULTI_NEEDLE_PICOT_FAGOTING_FIELDS: SpecField[] = [
  {
    key: "mn_pf_pattern_type",
    label: "Pattern Type",
    type: "select",
    options: [
      { value: "picot", label: "Picot (Edge Loops)" },
      { value: "fagoting", label: "Fagoting (Open Joining)" },
      { value: "both", label: "Both — Interchangeable" },
    ],
    tier: "essential",
    group: "Decorative Specifics",
  },
  {
    key: "mn_pf_gap_width",
    label: "Fagoting Gap / Picot Loop Size",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 3.5",
    step: 0.1,
    tier: "essential",
    group: "Decorative Specifics",
    helpText: "Width of the decorative gap (fagoting) or loop (picot).",
  },
  {
    key: "mn_pf_plate_swap",
    label: "Tool-Less Plate Swap",
    type: "boolean",
    tier: "recommended",
    group: "Decorative Specifics",
    helpText: "Operator changes pattern plates without tools.",
  },
];
