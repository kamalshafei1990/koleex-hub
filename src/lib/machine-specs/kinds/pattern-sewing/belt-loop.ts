/* ---------------------------------------------------------------------------
   Pattern Sewing — Belt Loop — Tier 3

   Auto-feeds belt-loop tape, cuts it to length, and tacks each end
   onto the trouser waistband in a programmed sequence. Buyer cares
   about loop length range, loops-per-minute, and whether the cycle
   automatically positions for the next loop.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const BELT_LOOP_FIELDS: SpecField[] = [
  {
    key: "ps_bl_loop_length_min",
    label: "Loop Length — Min",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 35",
    tier: "essential",
    group: "Belt Loop Station",
  },
  {
    key: "ps_bl_loop_length_max",
    label: "Loop Length — Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 90",
    tier: "essential",
    group: "Belt Loop Station",
  },
  {
    key: "ps_bl_loops_per_minute",
    label: "Loops per Minute",
    type: "number",
    placeholder: "e.g. 30",
    tier: "essential",
    group: "Belt Loop Station",
    helpText: "Production rate — defines how many waistbands can be looped per shift.",
  },
  {
    key: "ps_bl_auto_indexing",
    label: "Auto Indexing Between Loops",
    type: "boolean",
    tier: "recommended",
    group: "Belt Loop Station",
    helpText: "Clamp moves to the next loop position automatically — operator only loads the waistband.",
  },
  {
    key: "ps_bl_max_loops_per_garment",
    label: "Max Loops per Garment Program",
    type: "number",
    placeholder: "e.g. 8",
    tier: "advanced",
    group: "Belt Loop Station",
  },
];
