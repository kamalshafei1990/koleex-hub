/* ---------------------------------------------------------------------------
   Overlock Glove — Tier 3

   Tiny-cylinder overlock specifically built for finger seams on
   industrial / gardening / sport gloves. Cylinder diameter is the
   defining spec — it has to clear the inside of a finger tube, so
   typically half the diameter of a regular cylinder-bed overlock.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const OVERLOCK_GLOVE_FIELDS: SpecField[] = [
  {
    key: "ov_gl_cylinder_diameter",
    label: "Glove Cylinder Diameter",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 28",
    tier: "essential",
    group: "Glove Specifics",
    helpText: "Outer diameter of the small cylinder — must clear finger tube interior.",
  },
  {
    key: "ov_gl_finger_clearance",
    label: "Finger Insertion Clearance",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 22",
    tier: "essential",
    group: "Glove Specifics",
    helpText: "Working clearance for the operator to slip a finger over the cylinder.",
  },
  {
    key: "ov_gl_glove_type",
    label: "Suitable Glove Types",
    type: "multi-select",
    options: [
      { value: "knit", label: "Knit / Cotton" },
      { value: "leather", label: "Leather" },
      { value: "industrial", label: "Industrial / PPE" },
      { value: "sport", label: "Sport / Athletic" },
      { value: "garden", label: "Garden / Work" },
    ],
    tier: "recommended",
    group: "Glove Specifics",
  },
];
