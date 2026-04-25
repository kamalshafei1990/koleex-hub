/* ---------------------------------------------------------------------------
   Interlock Feed-Off-the-Arm — Tier 3

   Narrow-arm coverstitch where the work feeds OFF the end of a
   tubular arm — used for joining tubular hems (jeans inseams,
   T-shirt side-seams). The arm geometry IS the differentiator:
   narrower arm = tighter tubes; longer arm = larger pieces.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const INTERLOCK_FEED_OFF_ARM_FIELDS: SpecField[] = [
  {
    key: "il_foa_arm_length",
    label: "Arm Length",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 220",
    tier: "essential",
    group: "Feed-Off-Arm Geometry",
  },
  {
    key: "il_foa_arm_clearance",
    label: "Arm Clearance",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 90",
    tier: "essential",
    group: "Feed-Off-Arm Geometry",
    helpText: "Vertical clearance under the arm — defines the largest tube the head can run.",
  },
  {
    key: "il_foa_feed_direction",
    label: "Feed Direction",
    type: "select",
    options: [
      { value: "off-arm", label: "Off-Arm (Forward)" },
      { value: "reverse-off-arm", label: "Reverse Off-Arm" },
      { value: "bi-directional", label: "Bi-Directional" },
    ],
    tier: "recommended",
    group: "Feed-Off-Arm Geometry",
  },
];
