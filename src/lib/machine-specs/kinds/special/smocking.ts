/* ---------------------------------------------------------------------------
   Special — Smocking / Shirring — Tier 3

   Multi-row elastic gathering for blouses, children's wear, dresses.
   Lays parallel rows of elastic thread that contract the fabric
   into uniform gathers. Buyer cares about row count, row spacing,
   and whether the elastic feed is independently tensioned per row.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const SMOCKING_FIELDS: SpecField[] = [
  {
    key: "sp_sm_row_count",
    label: "Row Count",
    type: "number",
    placeholder: "e.g. 12",
    tier: "essential",
    group: "Smocking Mechanism",
    helpText: "Number of parallel elastic rows the head lays in one pass.",
  },
  {
    key: "sp_sm_row_spacing",
    label: "Row Spacing",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 6",
    step: 0.1,
    tier: "essential",
    group: "Smocking Mechanism",
  },
  {
    key: "sp_sm_independent_tension",
    label: "Independent Per-Row Tension",
    type: "boolean",
    tier: "recommended",
    group: "Smocking Mechanism",
    helpText: "Separate tension dial per row so gathers are uniform across the panel.",
  },
  {
    key: "sp_sm_elastic_thickness",
    label: "Max Elastic Thickness",
    type: "text",
    placeholder: "e.g. 0.6 mm",
    tier: "advanced",
    group: "Smocking Mechanism",
  },
];
