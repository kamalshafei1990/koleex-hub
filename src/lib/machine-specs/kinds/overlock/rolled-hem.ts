/* ---------------------------------------------------------------------------
   Overlock Rolled-Hem — Tier 3

   Specifics for narrow rolled-hem overlocks (chiffon, silk, scarves,
   napkin edges). The rolled-hem tongue + plate is what differentiates
   this kind — getting those dimensions right is the difference
   between a clean rolled hem and a puckered mess.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const ROLLED_HEM_FIELDS: SpecField[] = [
  {
    key: "ov_rh_hem_width",
    label: "Rolled Hem Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 2",
    step: 0.1,
    tier: "essential",
    group: "Rolled Hem",
    helpText: "Finished hem width — typical range 1.5 – 3 mm.",
  },
  {
    key: "ov_rh_plate_type",
    label: "Hem Plate / Tongue",
    type: "select",
    options: [
      { value: "fixed", label: "Fixed Plate" },
      { value: "interchangeable", label: "Interchangeable Plate" },
      { value: "wide-narrow", label: "Wide / Narrow Convertible" },
    ],
    tier: "recommended",
    group: "Rolled Hem",
  },
  {
    key: "ov_rh_pico_edge",
    label: "Picot / Lettuce Edge",
    type: "boolean",
    tier: "recommended",
    group: "Rolled Hem",
    helpText: "Decorative edge effect on stretchy fabric.",
  },
];
