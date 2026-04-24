/* ---------------------------------------------------------------------------
   Cylinder-Bed Lockstitch — Kind Extras (Tier 3)

   Cylinder bed lets tubular work (cuffs, sleeves, gloves, small
   leather goods) wrap around the arm. Cylinder diameter + length
   dictate what fits.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const CYLINDER_BED_FIELDS: SpecField[] = [
  {
    key: "cb_cylinder_diameter",
    label: "Cylinder Diameter",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 50",
    required: true,
    tier: "essential",
    group: "Cylinder Bed Geometry",
    helpText: "Diameter of the narrow horizontal arm — smaller fits tighter tubular work.",
  },
  {
    key: "cb_cylinder_length",
    label: "Cylinder Length",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 280",
    tier: "recommended",
    group: "Cylinder Bed Geometry",
  },
];
