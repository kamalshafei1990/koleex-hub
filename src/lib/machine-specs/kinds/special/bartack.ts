/* ---------------------------------------------------------------------------
   Special — Bartack — Tier 3

   Electronic bartack head. Reinforces stress points (belt loop ends,
   pocket corners, fly closures, decorative bartacks). Differs from
   the pattern-sewing tacking station in that it's a fixed-cycle head
   (each press of the pedal produces one tack), not a programmable
   XY pattern.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const BARTACK_FIELDS: SpecField[] = [
  {
    key: "sp_ba_max_tack_length",
    label: "Max Tack Length",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 40",
    tier: "essential",
    group: "Bartack Cycle",
  },
  {
    key: "sp_ba_max_tack_width",
    label: "Max Tack Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 6",
    tier: "essential",
    group: "Bartack Cycle",
  },
  {
    key: "sp_ba_max_stitches_per_tack",
    label: "Max Stitches per Tack",
    type: "number",
    placeholder: "e.g. 100",
    tier: "essential",
    group: "Bartack Cycle",
  },
  {
    key: "sp_ba_built_in_patterns",
    label: "Built-in Tack Patterns",
    type: "number",
    placeholder: "e.g. 99",
    tier: "recommended",
    group: "Bartack Cycle",
    helpText: "Pre-loaded shapes (bar / cross / round / decorative).",
  },
];
