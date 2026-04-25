/* ---------------------------------------------------------------------------
   Heavy-Duty Carpet / Rug Binding — Tier 3

   Specialized head for binding carpet + rug edges. Folds binding
   tape over the cut edge and stitches it on. Buyer cares about
   max carpet thickness (deep pile + backing), max binding tape
   width, and whether the feed handles loose-pile fabrics without
   skipping.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const HD_CARPET_BINDING_FIELDS: SpecField[] = [
  {
    key: "hd_cb_max_carpet_thickness",
    label: "Max Carpet Thickness",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 30",
    tier: "essential",
    group: "Carpet Binding",
    helpText: "Combined pile + primary + secondary backing the head can pierce.",
  },
  {
    key: "hd_cb_binding_tape_width",
    label: "Binding Tape Width",
    type: "text",
    placeholder: "e.g. 38 / 50 / 75 mm",
    tier: "essential",
    group: "Carpet Binding",
  },
  {
    key: "hd_cb_pile_handling",
    label: "Loose-Pile Feed Handling",
    type: "select",
    options: [
      { value: "standard", label: "Standard Feed" },
      { value: "puller", label: "Top Puller" },
      { value: "puller-presser", label: "Top Puller + Heavy Presser" },
    ],
    tier: "recommended",
    group: "Carpet Binding",
  },
  {
    key: "hd_cb_serging_option",
    label: "Serging Option",
    type: "boolean",
    tier: "advanced",
    group: "Carpet Binding",
    helpText: "Adds an overlock / serge before binding for fray-resistant edges.",
  },
];
