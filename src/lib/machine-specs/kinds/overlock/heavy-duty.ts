/* ---------------------------------------------------------------------------
   Overlock Heavy-Duty — Tier 3

   What makes a heavy-duty overlock heavy-duty: thicker thread,
   denser stack penetration, reinforced frame and looper geometry,
   larger hooks. These are the differentiators when comparing a
   jeans / canvas / upholstery overlock against a standard apparel
   one.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const OVERLOCK_HEAVY_DUTY_FIELDS: SpecField[] = [
  {
    key: "ov_hd_max_thread_thickness",
    label: "Max Thread Thickness",
    type: "text",
    placeholder: "e.g. Tex 80",
    tier: "essential",
    group: "Heavy-Duty Capacity",
    helpText: "Heaviest thread the loopers can drive (Tex / Tkt).",
  },
  {
    key: "ov_hd_max_material_thickness",
    label: "Max Material Thickness — Heavy",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 10",
    tier: "essential",
    group: "Heavy-Duty Capacity",
  },
  {
    key: "ov_hd_reinforced_frame",
    label: "Reinforced Frame",
    type: "boolean",
    tier: "recommended",
    group: "Heavy-Duty Capacity",
  },
  {
    key: "ov_hd_large_loopers",
    label: "Oversized Loopers",
    type: "boolean",
    tier: "recommended",
    group: "Heavy-Duty Capacity",
    helpText: "Larger looper geometry for thick thread / dense stacks.",
  },
];
