/* ---------------------------------------------------------------------------
   Heavy-Duty Lockstitch — Kind Extras (Tier 3)

   Reinforced build for leather, canvas, webbing, and other thick
   materials. Thread + material thickness limits are the decisive
   specs — they're how a buyer knows whether the machine can actually
   handle their material.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const HEAVY_DUTY_FIELDS: SpecField[] = [
  {
    key: "hd_max_thread_thickness",
    label: "Max Thread Thickness (Tex)",
    type: "text",
    placeholder: "e.g. Tex 135 / Tkt 15",
    required: true,
    tier: "essential",
    group: "Heavy-Duty Capacity",
    helpText: "Heavier thread = stronger seams. Bonded nylon Tex 135 is typical for leather goods.",
  },
  {
    key: "hd_max_material_thickness_heavy",
    label: "Max Material Thickness (Heavy)",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 15",
    required: true,
    tier: "essential",
    group: "Heavy-Duty Capacity",
    helpText: "Thickest stack the machine can sew through without skipping.",
  },
  {
    key: "hd_reinforced_frame",
    label: "Reinforced Cast-Iron Frame",
    type: "boolean",
    tier: "recommended",
    group: "Heavy-Duty Capacity",
  },
  {
    key: "hd_large_hook",
    label: "Extra-Large Rotary Hook",
    type: "boolean",
    helpText: "Oversized hook supports heavier thread without skipping.",
    tier: "recommended",
    group: "Heavy-Duty Capacity",
  },
];
