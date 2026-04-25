/* ---------------------------------------------------------------------------
   Special — Button Attach — Tier 3

   Sews 2-hole / 4-hole buttons (and shanks, snap fasteners) onto
   garments programmatically. Buyer cares about button hole-pattern
   support, max button diameter, and whether the head includes an
   automatic button feeder.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const BUTTON_ATTACH_FIELDS: SpecField[] = [
  {
    key: "sp_btn_button_types",
    label: "Supported Button Types",
    type: "multi-select",
    options: [
      { value: "2-hole-flat", label: "2-Hole Flat" },
      { value: "4-hole-flat", label: "4-Hole Flat" },
      { value: "shank", label: "Shank Buttons" },
      { value: "snap", label: "Snap Buttons" },
      { value: "decorative", label: "Decorative / Jewel" },
    ],
    tier: "essential",
    group: "Button-Attach Cycle",
  },
  {
    key: "sp_btn_max_button_diameter",
    label: "Max Button Diameter",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 32",
    tier: "essential",
    group: "Button-Attach Cycle",
  },
  {
    key: "sp_btn_min_button_diameter",
    label: "Min Button Diameter",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 8",
    tier: "recommended",
    group: "Button-Attach Cycle",
  },
  {
    key: "sp_btn_auto_feeder",
    label: "Auto Button Feeder",
    type: "boolean",
    tier: "recommended",
    group: "Button-Attach Cycle",
    helpText: "Feeds buttons from a bowl / track without operator placement.",
  },
  {
    key: "sp_btn_thread_wrap",
    label: "Thread-Wrap Capability",
    type: "boolean",
    tier: "advanced",
    group: "Button-Attach Cycle",
    helpText: "Wraps a thread shank under the button — required for thick coats.",
  },
];
