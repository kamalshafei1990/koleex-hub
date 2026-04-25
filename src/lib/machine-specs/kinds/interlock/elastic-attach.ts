/* ---------------------------------------------------------------------------
   Interlock Elastic-Attaching Coverstitch — Tier 3

   Built-in elastic feeder lays elastic tape under the cover stitch
   in a single pass — the standard waistband-finish on swimwear
   and underwear. The elastic stretch ratio and whether the feed
   includes a metering wheel define the precision the seam achieves.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const INTERLOCK_ELASTIC_ATTACH_FIELDS: SpecField[] = [
  {
    key: "il_ea_max_elastic_width",
    label: "Max Elastic Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 25",
    tier: "essential",
    group: "Elastic Feeder",
  },
  {
    key: "il_ea_stretch_ratio",
    label: "Elastic Stretch Ratio",
    type: "text",
    placeholder: "e.g. 1:1.2 – 1:3",
    tier: "essential",
    group: "Elastic Feeder",
    helpText: "Range from light support (1:1.2) to high compression (1:3+).",
  },
  {
    key: "il_ea_metering_wheel",
    label: "Metering Wheel",
    type: "boolean",
    tier: "recommended",
    group: "Elastic Feeder",
    helpText: "Driven feed wheel keeps elastic at a constant ratio independent of operator pull.",
  },
  {
    key: "il_ea_tension_control",
    label: "Tension Control",
    type: "select",
    options: [
      { value: "manual", label: "Manual Dial" },
      { value: "pneumatic", label: "Pneumatic" },
      { value: "electronic", label: "Electronic / Programmable" },
    ],
    tier: "recommended",
    group: "Elastic Feeder",
  },
];
