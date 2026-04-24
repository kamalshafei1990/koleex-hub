/* ---------------------------------------------------------------------------
   Long-Arm Lockstitch — Kind Extras (Tier 3)

   Long-arm machines let oversized work (quilts, sails, tarps,
   upholstery panels) pass through the throat. The extended reach is
   the defining spec, so capture arm length + throat depth.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const LONG_ARM_FIELDS: SpecField[] = [
  {
    key: "la_arm_length",
    label: "Arm Length",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 750",
    required: true,
    tier: "essential",
    group: "Long-Arm Geometry",
    helpText: "Distance from the needle to the vertical column — the \"reach\" of the machine.",
  },
  {
    key: "la_throat_depth",
    label: "Throat Depth (Clearance)",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 300",
    tier: "recommended",
    group: "Long-Arm Geometry",
    helpText: "Useful vertical space between table and arm.",
  },
];
