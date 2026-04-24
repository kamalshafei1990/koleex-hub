/* ---------------------------------------------------------------------------
   Feed-Off-the-Arm Lockstitch — Kind Extras (Tier 3)

   Narrow arm extends to the operator; fabric exits off the end of
   the arm. Used for jeans inseams, shirt side-seams, tubular bottom
   hems. Arm geometry drives what fits.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const FEED_OFF_ARM_FIELDS: SpecField[] = [
  {
    key: "foa_arm_length",
    label: "Arm Length",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 250",
    required: true,
    tier: "essential",
    group: "Feed-Off-Arm Geometry",
  },
  {
    key: "foa_arm_clearance",
    label: "Arm Clearance",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 100",
    tier: "recommended",
    group: "Feed-Off-Arm Geometry",
    helpText: "Vertical clearance above the arm — affects how fabric feeds.",
  },
  {
    key: "foa_feed_direction",
    label: "Feed Direction",
    type: "select",
    options: [
      { value: "left", label: "Feeds to the Left" },
      { value: "right", label: "Feeds to the Right" },
    ],
    tier: "advanced",
    group: "Feed-Off-Arm Geometry",
  },
];
