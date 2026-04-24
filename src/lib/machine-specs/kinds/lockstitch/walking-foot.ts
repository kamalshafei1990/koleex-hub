/* ---------------------------------------------------------------------------
   Walking-Foot Lockstitch — Kind Extras (Tier 3)

   Adds compound-feed / triple-feed specifics that only matter when
   the kind is Walking-Foot. Keys are prefixed `wf_` so they don't
   collide with the Lockstitch family fields when both are saved
   into the same `template_specs` JSON payload.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const WALKING_FOOT_FIELDS: SpecField[] = [
  {
    key: "wf_triple_feed",
    label: "Triple Feed (Compound)",
    type: "boolean",
    helpText: "Needle + walking foot + feed dog all move together — stops layer shift.",
    tier: "essential",
    group: "Walking-Foot Mechanism",
  },
  {
    key: "wf_walking_foot_travel",
    label: "Walking Foot Alternating Travel",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 5",
    tier: "recommended",
    group: "Walking-Foot Mechanism",
  },
  {
    key: "wf_max_layer_count",
    label: "Max Fabric Layers",
    type: "number",
    placeholder: "e.g. 8",
    tier: "recommended",
    group: "Walking-Foot Mechanism",
  },
  {
    key: "wf_compound_feed_type",
    label: "Compound Feed Type",
    type: "select",
    options: [
      { value: "upper-lower", label: "Upper + Lower Feed" },
      { value: "needle-upper-lower", label: "Needle + Upper + Lower (Triple)" },
    ],
    tier: "advanced",
    group: "Walking-Foot Mechanism",
  },
];
