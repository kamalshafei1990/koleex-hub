/* ---------------------------------------------------------------------------
   Special — Picot / Scallop Edging — Tier 3

   Decorative edge head that produces a scalloped or picot finish.
   Used for lingerie, couture, bridalwear. Buyer cares about scallop
   shape, scallop width, and whether the head produces a single side
   or both edges in one pass.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const PICOT_FIELDS: SpecField[] = [
  {
    key: "sp_pc_scallop_shape",
    label: "Scallop Shape",
    type: "select",
    options: [
      { value: "round", label: "Round Scallop" },
      { value: "pointed", label: "Pointed Scallop" },
      { value: "square", label: "Square / Castellated" },
      { value: "interchangeable", label: "Interchangeable Cam" },
    ],
    tier: "essential",
    group: "Picot Edging",
  },
  {
    key: "sp_pc_scallop_width",
    label: "Scallop Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 5",
    step: 0.1,
    tier: "essential",
    group: "Picot Edging",
  },
  {
    key: "sp_pc_scallop_depth",
    label: "Scallop Depth",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 3",
    step: 0.1,
    tier: "recommended",
    group: "Picot Edging",
  },
  {
    key: "sp_pc_double_edge",
    label: "Double-Edge Mode",
    type: "boolean",
    tier: "advanced",
    group: "Picot Edging",
    helpText: "Produces a scalloped edge on both sides simultaneously (sandwich mode).",
  },
];
