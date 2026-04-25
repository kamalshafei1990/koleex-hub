/* ---------------------------------------------------------------------------
   Overlock Elastic / Tape Attaching — Tier 3

   Built-in tape feeder + tension system attaches elastic, binding
   tape, or edge tape while overlocking in one operation. Buyer
   cares about max tape width (defines garment compatibility), tape
   stretch ratio (gives elastic compression), tension control type,
   and whether a guillotine cutter is integrated.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const OVERLOCK_ELASTIC_TAPE_FIELDS: SpecField[] = [
  {
    key: "ov_et_max_tape_width",
    label: "Max Tape Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 25",
    tier: "essential",
    group: "Tape Feeder",
    helpText: "Widest elastic / binding tape the feeder accepts.",
  },
  {
    key: "ov_et_tape_stretch_ratio",
    label: "Tape Stretch Ratio",
    type: "text",
    placeholder: "e.g. 1:1 – 1:3",
    tier: "essential",
    group: "Tape Feeder",
    helpText: "Range from no-stretch binding to high-compression elastic.",
  },
  {
    key: "ov_et_tension_control",
    label: "Tape Tension Control",
    type: "select",
    options: [
      { value: "manual", label: "Manual Dial" },
      { value: "pneumatic", label: "Pneumatic" },
      { value: "electronic", label: "Electronic / Programmable" },
    ],
    tier: "recommended",
    group: "Tape Feeder",
  },
  {
    key: "ov_et_integrated_cutter",
    label: "Integrated Tape Cutter",
    type: "boolean",
    tier: "recommended",
    group: "Tape Feeder",
    helpText: "Auto-trims the tape at seam end without operator scissors.",
  },
];
