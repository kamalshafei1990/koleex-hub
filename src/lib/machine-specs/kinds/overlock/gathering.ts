/* ---------------------------------------------------------------------------
   Overlock Gathering / Ruffling — Tier 3

   The gathering attachment ruffles the bottom ply while overlocking
   the top ply onto it in a single pass. Buyers care about gather
   ratio range (light shirring vs. heavy ruffles), foot type, and
   whether the ratio is mechanically lockable so production stays
   consistent.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const OVERLOCK_GATHERING_FIELDS: SpecField[] = [
  {
    key: "ov_g_ratio_min",
    label: "Gathering Ratio — Min",
    type: "text",
    placeholder: "e.g. 1:1.5",
    tier: "essential",
    group: "Gathering Mechanism",
    helpText: "Light shirring at the low end of the range.",
  },
  {
    key: "ov_g_ratio_max",
    label: "Gathering Ratio — Max",
    type: "text",
    placeholder: "e.g. 1:5",
    tier: "essential",
    group: "Gathering Mechanism",
    helpText: "Maximum gather density the mechanism produces.",
  },
  {
    key: "ov_g_foot_type",
    label: "Gathering Foot",
    type: "select",
    options: [
      { value: "fixed", label: "Fixed Gathering Foot" },
      { value: "swing", label: "Swing-Out Foot" },
      { value: "interchangeable", label: "Interchangeable Foot Set" },
    ],
    tier: "recommended",
    group: "Gathering Mechanism",
  },
  {
    key: "ov_g_lockable_ratio",
    label: "Lockable Ratio",
    type: "boolean",
    tier: "advanced",
    group: "Gathering Mechanism",
    helpText: "Mechanically locks the gather ratio so it doesn't drift mid-run.",
  },
];
