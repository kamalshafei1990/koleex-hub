/* ---------------------------------------------------------------------------
   Special — Blindstitch — Tier 3

   Hemming machine that catches one or two threads of the outer
   fabric so the hem is near-invisible from the right side. Curved
   needle. Used for skirts, trousers, jackets, drapery hems.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const BLINDSTITCH_FIELDS: SpecField[] = [
  {
    key: "sp_bs_skip_stitch_ratio",
    label: "Skip-Stitch Ratio",
    type: "select",
    options: [
      { value: "1-1", label: "1:1 (Every Stitch Visible)" },
      { value: "2-1", label: "2:1 (Skip Every Other)" },
      { value: "3-1", label: "3:1 (Decorative)" },
      { value: "adjustable", label: "Adjustable" },
    ],
    tier: "essential",
    group: "Blindstitch Cycle",
    helpText: "How often the curved needle catches the outer fabric. Higher skip = more invisible.",
  },
  {
    key: "sp_bs_hem_depth_max",
    label: "Hem Depth Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 50",
    tier: "essential",
    group: "Blindstitch Cycle",
    helpText: "Deepest hem fold the head accepts.",
  },
  {
    key: "sp_bs_penetration_depth",
    label: "Penetration Depth",
    type: "select",
    options: [
      { value: "shallow", label: "Shallow (Light Fabric)" },
      { value: "medium", label: "Medium (Apparel)" },
      { value: "deep", label: "Deep (Heavy Drapery)" },
      { value: "adjustable", label: "Adjustable" },
    ],
    tier: "recommended",
    group: "Blindstitch Cycle",
    helpText: "How deep the curved needle goes — too deep shows on the right side.",
  },
];
