/* ---------------------------------------------------------------------------
   Lockstitch with Edge Trimmer — Kind Extras (Tier 3)

   Integrated knife trims excess fabric as the seam is sewn.
   Knife geometry + cutting width are the distinctive specs.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const EDGE_TRIMMER_FIELDS: SpecField[] = [
  {
    key: "et_knife_type",
    label: "Knife Type",
    type: "select",
    options: [
      { value: "vertical", label: "Vertical Knife" },
      { value: "side", label: "Side Knife" },
      { value: "rotary", label: "Rotary Knife" },
    ],
    tier: "essential",
    group: "Edge Trimmer",
  },
  {
    key: "et_cutting_width",
    label: "Cutting Width (from seam)",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 5",
    tier: "recommended",
    group: "Edge Trimmer",
  },
  {
    key: "et_quick_release",
    label: "Quick-Release Knife",
    type: "boolean",
    helpText: "Admins can disengage the knife without removing it for seams that shouldn't trim.",
    tier: "recommended",
    group: "Edge Trimmer",
  },
];
