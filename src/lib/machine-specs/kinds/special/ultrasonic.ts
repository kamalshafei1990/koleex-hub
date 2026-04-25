/* ---------------------------------------------------------------------------
   Special — Ultrasonic Bonding — Tier 3

   Seamless bonding head that joins synthetic fabric layers using
   high-frequency ultrasonic vibration instead of thread. Used for
   sportswear, PPE, lingerie, medical drapes. Speed is measured in
   mm/min (continuous) instead of stitches per minute.
   --------------------------------------------------------------------------- */

import type { SpecField } from "../../types";

export const ULTRASONIC_FIELDS: SpecField[] = [
  {
    key: "sp_us_frequency",
    label: "Operating Frequency",
    type: "select",
    options: [
      { value: "20khz", label: "20 kHz" },
      { value: "30khz", label: "30 kHz" },
      { value: "35khz", label: "35 kHz" },
      { value: "40khz", label: "40 kHz" },
    ],
    tier: "essential",
    group: "Ultrasonic Bonding",
    helpText: "Higher frequency = finer welds for thin synthetics; lower = thicker capacity.",
  },
  {
    key: "sp_us_max_speed",
    label: "Max Bonding Speed",
    type: "number",
    unit: "mm/min",
    placeholder: "e.g. 25000",
    tier: "essential",
    group: "Ultrasonic Bonding",
  },
  {
    key: "sp_us_max_layer_thickness",
    label: "Max Layer Thickness",
    type: "number",
    unit: "mm",
    placeholder: "e.g. 4",
    tier: "essential",
    group: "Ultrasonic Bonding",
  },
  {
    key: "sp_us_pattern_wheels",
    label: "Pattern Wheel Set",
    type: "number",
    placeholder: "e.g. 12",
    tier: "recommended",
    group: "Ultrasonic Bonding",
    helpText: "Number of interchangeable embossing wheels supplied (or supported).",
  },
  {
    key: "sp_us_supported_fabrics",
    label: "Supported Fabric Types",
    type: "multi-select",
    options: [
      { value: "polyester", label: "Polyester" },
      { value: "nylon", label: "Nylon" },
      { value: "tpu-coated", label: "TPU-Coated" },
      { value: "pe-laminated", label: "PE-Laminated" },
      { value: "non-woven", label: "Non-Woven" },
    ],
    tier: "recommended",
    group: "Ultrasonic Bonding",
    helpText: "Ultrasonic only welds thermoplastic synthetics — natural fibers don't bond.",
  },
];
