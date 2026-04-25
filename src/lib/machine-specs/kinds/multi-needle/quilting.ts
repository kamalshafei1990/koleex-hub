/* ---------------------------------------------------------------------------
   Multi-Needle Quilting — Tier 3

   Industrial panel-quilting heads (12 / 16 / 20 / 32-needle) for
   mattresses, duvets, comforters, and puffer-jacket panels. Buyers
   compare these on:
     · panel WIDTH × LENGTH the head can run
     · pattern memory (how many programmable patterns)
     · automatic panel handling (loader / stacker)
     · max layers (foam + ticking + backing) the head can pierce
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const MULTI_NEEDLE_QUILTING_FIELDS: SpecField[] = [
  {
    key: "mn_q_panel_width",
    label: "Max Panel Width",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 2400",
    tier: "essential",
    group: "Quilting Panel",
    helpText: "Maximum panel width the bed and frame accept.",
  },
  {
    key: "mn_q_panel_length",
    label: "Max Panel Length",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 4200",
    tier: "essential",
    group: "Quilting Panel",
    helpText: "Maximum panel length per cycle (or continuous if roll-to-roll).",
  },
  {
    key: "mn_q_max_layers",
    label: "Max Layer Stack",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 80",
    tier: "essential",
    group: "Quilting Panel",
    helpText: "Total stack height of foam + ticking + backing the needles can pierce.",
  },
  {
    key: "mn_q_pattern_memory",
    label: "Pattern Memory",
    type: "number",
    placeholder: "e.g. 99",
    tier: "recommended",
    group: "Quilting Panel",
    helpText: "Number of quilting patterns the controller can store.",
  },
  {
    key: "mn_q_auto_loader",
    label: "Auto Panel Loader",
    type: "boolean",
    tier: "advanced",
    group: "Quilting Panel",
    helpText: "Loads panels onto the frame without operator action.",
  },
  {
    key: "mn_q_auto_stacker",
    label: "Auto Stacker",
    type: "boolean",
    tier: "advanced",
    group: "Quilting Panel",
    helpText: "Receives finished panels stacked off the head.",
  },
];
