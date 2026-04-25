/* ---------------------------------------------------------------------------
   Pattern Sewing — Dart Sewer — Tier 3

   Programmable dart-sewing station — sews tapered darts on trousers,
   skirts, blazers. The dart length range and auto-thread-trim at
   the dart point are the defining specs.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const DART_SEWER_FIELDS: SpecField[] = [
  {
    key: "ps_ds_dart_length_min",
    label: "Dart Length — Min",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 30",
    tier: "essential",
    group: "Dart Station",
  },
  {
    key: "ps_ds_dart_length_max",
    label: "Dart Length — Max",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 180",
    tier: "essential",
    group: "Dart Station",
  },
  {
    key: "ps_ds_taper_pattern_count",
    label: "Taper Pattern Memory",
    type: "number",
    placeholder: "e.g. 50",
    tier: "recommended",
    group: "Dart Station",
    helpText: "Number of taper profiles the controller can store.",
  },
  {
    key: "ps_ds_auto_trim_at_point",
    label: "Auto Trim at Dart Point",
    type: "boolean",
    tier: "essential",
    group: "Dart Station",
    helpText: "Trims thread cleanly at the dart point without operator action.",
  },
];
