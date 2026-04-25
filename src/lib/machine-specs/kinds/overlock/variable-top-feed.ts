/* ---------------------------------------------------------------------------
   Overlock Variable Top-Feed — Tier 3

   The defining feature is an ADJUSTABLE top feed that runs at a
   different rate from the bottom feed — it eases or stretches the
   top ply on knit fabrics so the seam doesn't pucker. Spec sheet
   needs to expose travel + ratio + lock for buyers comparing
   knit-fabric specialists.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const VARIABLE_TOP_FEED_FIELDS: SpecField[] = [
  {
    key: "ov_vtf_top_feed_travel",
    label: "Top-Feed Travel",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 6",
    step: 0.1,
    tier: "essential",
    group: "Variable Top-Feed",
    helpText: "Stroke length of the top feed dog.",
  },
  {
    key: "ov_vtf_feed_ratio_min",
    label: "Top-Feed Ratio — Min",
    type: "text",
    placeholder: "e.g. 0.5",
    tier: "recommended",
    group: "Variable Top-Feed",
    helpText: "Minimum ratio of top feed to bottom feed (stretch).",
  },
  {
    key: "ov_vtf_feed_ratio_max",
    label: "Top-Feed Ratio — Max",
    type: "text",
    placeholder: "e.g. 4.0",
    tier: "recommended",
    group: "Variable Top-Feed",
    helpText: "Maximum ratio of top feed to bottom feed (gather).",
  },
  {
    key: "ov_vtf_quick_lock",
    label: "Quick-Lock Adjustment",
    type: "boolean",
    tier: "advanced",
    group: "Variable Top-Feed",
    helpText: "Operator can set + lock feed ratio without tools.",
  },
];
