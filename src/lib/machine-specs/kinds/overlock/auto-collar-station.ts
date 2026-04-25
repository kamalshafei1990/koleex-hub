/* ---------------------------------------------------------------------------
   Overlock Auto Round-Collar / Waistband Station — Tier 3

   Fully programmable workstation that loads, sews, and stacks round
   collars or waistbands on a cycle without operator intervention.
   Sold as a complete cell, not a head — the spec sheet exposes the
   automation envelope (cycle time, programmable patterns, max work
   diameter) that justifies the price step over a standard overlock.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const OVERLOCK_AUTO_COLLAR_STATION_FIELDS: SpecField[] = [
  {
    key: "ov_acs_max_work_diameter",
    label: "Max Work Diameter",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 320",
    tier: "essential",
    group: "Auto Station",
    helpText: "Largest collar / waistband ring the station can handle.",
  },
  {
    key: "ov_acs_cycle_time",
    label: "Cycle Time per Piece",
    type: "text",
    placeholder: "e.g. 6 – 9 s",
    tier: "essential",
    group: "Auto Station",
    helpText: "Wall-clock time per finished piece at production speed.",
  },
  {
    key: "ov_acs_programmable_patterns",
    label: "Programmable Patterns",
    type: "number",
    placeholder: "e.g. 99",
    tier: "recommended",
    group: "Auto Station",
    helpText: "Number of cycle programs the controller can store.",
  },
  {
    key: "ov_acs_jig_change_time",
    label: "Jig Change Time",
    type: "text",
    placeholder: "e.g. < 30 s",
    tier: "advanced",
    group: "Auto Station",
    helpText: "Operator changeover time between jig sizes.",
  },
  {
    key: "ov_acs_auto_stacker",
    label: "Auto Stacker",
    type: "boolean",
    tier: "recommended",
    group: "Auto Station",
    helpText: "Receives finished pieces in a stacked pile without operator action.",
  },
];
