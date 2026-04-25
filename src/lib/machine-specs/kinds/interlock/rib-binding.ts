/* ---------------------------------------------------------------------------
   Interlock Rib-Binding Coverstitch — Tier 3

   Built-in rib-tape feeder that lays ribbed binding tape across
   the seam (necks and armholes) while the coverstitch closes it.
   Buyer cares about max rib width (defines garment compatibility),
   tape stretch ratio (T-shirt necks need a small stretch), and
   whether the feed includes a tension control + integrated cutter.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const INTERLOCK_RIB_BINDING_FIELDS: SpecField[] = [
  {
    key: "il_rb_max_rib_width",
    label: "Max Rib Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 30",
    tier: "essential",
    group: "Rib-Tape Feeder",
    helpText: "Widest rib tape the feeder accepts.",
  },
  {
    key: "il_rb_stretch_ratio",
    label: "Tape Stretch Ratio",
    type: "text",
    placeholder: "e.g. 1:1 – 1:1.5",
    tier: "recommended",
    group: "Rib-Tape Feeder",
  },
  {
    key: "il_rb_tension_control",
    label: "Tape Tension Control",
    type: "select",
    options: [
      { value: "manual", label: "Manual Dial" },
      { value: "pneumatic", label: "Pneumatic" },
      { value: "electronic", label: "Electronic / Programmable" },
    ],
    tier: "recommended",
    group: "Rib-Tape Feeder",
  },
  {
    key: "il_rb_integrated_cutter",
    label: "Integrated Tape Cutter",
    type: "boolean",
    tier: "advanced",
    group: "Rib-Tape Feeder",
  },
];
