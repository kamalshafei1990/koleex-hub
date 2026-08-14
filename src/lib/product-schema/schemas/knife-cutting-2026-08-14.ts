/**
 * XCS · Straight Knife Cutting Machines  and  XCR · Round Knife Cutting Machines
 * — spec templates.
 *
 * WHY THESE FIRST. Measured across the whole Hub: 82 subcategories carry a code,
 * 30 have a spec template, 52 do not. **`Cutting Equipment` is the largest
 * single gap — 9 subcategories, ZERO templates.** Straight knife and round knife
 * are the two densest of the nine, so they go first.
 *
 * SOURCE — the Koleex 2025 catalogue's Cutting Machines section (PDF pages
 * 37–39), read by rendering: the file has no extractable text at all. See
 * docs/product-data-v2/reference-data/koleex-catalog-2025-inventory.md.
 *
 * ⚠️ THE SOURCE CATALOGUE'S MODEL CODES ARE OLD AND ARE BEING RENUMBERED. Only
 * the FIELDS are taken from it, never the codes — a code from that edition is
 * not a product identifier. The physics does not renumber: a straight knife will
 * publish a blade length list and a round knife a blade diameter whatever the
 * new code says.
 *
 * ⚠️ "CUTTING HEIGHT" MEANS TWO DIFFERENT THINGS ON THESE TWO MACHINES, IN TWO
 * DIFFERENT UNITS, AND THE CATALOGUE USES ONE COLUMN HEADING FOR BOTH.
 *   · Straight knife — printed in INCHES as a LIST of the blade lengths the
 *     machine accepts (5/6/8/10/12/13/15/17"). It is a fitment range, not a
 *     measurement, and no single number can express it.
 *   · Round knife — printed in MILLIMETRES as ONE number, the maximum fabric
 *     stack the blade will cut (10–48 mm).
 * They are therefore two DIFFERENT fields with different keys. Collapsing them
 * into one "cutting height" would put 17 and 48 in the same column meaning
 * opposite things, and the larger number would belong to the weaker machine.
 *
 * VALUES OBSERVED:
 *   straight  blade lengths 5–17 inch · speed 3500–5400 rpm · 750–2200 W
 *             110/220 V · 50/60 Hz · 15–17.5 kg
 *   round     cut height 10–48 mm · blade ⌀100/110/125 mm
 *             mechanical 360–2400 rpm · servo 600–1500 rpm · 90–350 W
 *             1.1–4.2 kg
 *
 * WHAT IS DELIBERATELY NOT HERE — bed/table type and duty. Neither machine has
 * a bed; both are hand-guided over the spread. Nothing in this class maps to
 * `bed_type`, and inventing one would create a facet with no meaning here.
 */

import type { ProductSchemaDefinition } from "@/types/product-schema";
import { DEFAULT_PUBLIC_VISIBILITY } from "../visibility";
import {
  electricalGroup,
  packingShippingGroup,
  physicalGroup,
  safetyComplianceGroup,
  FITMENT_OPTIONS,
} from "./_shared-machine-groups";

const pub = DEFAULT_PUBLIC_VISIBILITY;

/* Both classes are hand-held motors driving a blade, so the motor block is
   identical apart from its numbers. Shared so the two cannot drift. */
function cuttingMotorGroup(order: number, opts: { speedNote: string; powerNote: string }) {
  return {
    id: "cutting-motor",
    title: "Motor & Drive",
    order,
    fields: [
      {
        id: "motor_power_w", key: "motor_power_w", label: "Motor Power", order: 10,
        fieldType: "unit_number" as const, dataType: "number" as const, unit: "W", required: false,
        description: opts.powerNote,
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "max_cutting_speed", key: "max_cutting_speed", label: "Blade Speed", order: 20,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: opts.speedNote,
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "speed_regulation", key: "speed_regulation", label: "Speed Regulation", order: 30,
        fieldType: "select" as const, dataType: "string" as const, required: false,
        options: [
          { value: "stepless_variable", label: "Stepless / Variable" },
          { value: "fixed_speed_drive", label: "Fixed" },
        ],
        description: "\"Stepless frequency conversion speed regulation\" on the servo models against a fixed-speed motor on the basic ones. On a cutter this is not comfort: a fixed-speed blade scorches synthetics that a slowed blade cuts clean.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "power_source", key: "power_source", label: "Power Source", order: 40,
        fieldType: "select" as const, dataType: "string" as const, required: false,
        options: [
          { value: "mains_corded", label: "Mains (corded)" },
          { value: "lithium_battery", label: "Lithium Battery" },
        ],
        description: "A cordless lithium series exists alongside the corded one and the catalogue quotes \"2500 mAh, 2–3 hours of continuous work\". This is a working-pattern difference, not a trim level — a battery cutter is bought to move around a spread without a trailing lead.",
        ...pub, visualRenderType: "spec_card" as const,
      },
    ],
  };
}

/* Printed as a features list rather than a table column, but it separates whole
   machine families on the page ("Auto-Sharpening Cutting Machine" is a title,
   not a footnote), so it is a field on both. */
const knifeSharpeningField = {
  id: "knife_sharpening", key: "knife_sharpening", label: "Knife Sharpening", order: 90,
  fieldType: "select" as const, dataType: "string" as const, required: false,
  options: [
    { value: "sharpening_automatic", label: "Automatic" },
    { value: "sharpening_manual", label: "Manual" },
  ],
  description: "\"Auto-Sharpening Cutting Machine\" is the TITLE of a whole family in this catalogue, not a feature line. A blade that dulls mid-spread drags the fabric and ruins the cut, so automatic sharpening is what lets one operator run a long lay unattended.",
  ...pub, visualRenderType: "spec_card" as const,
};

export const STRAIGHT_KNIFE_SCHEMA: ProductSchemaDefinition = {
  id: "straight-knife-cutting.v1",
  name: "Straight Knife Cutting Machine",
  divisionCode: "garment-machinery",
  categoryCode: "cutting-equipment",
  subcategoryCode: "XCS",
  version: "1",
  groups: [
    {
      id: "straight-knife-blade",
      title: "Blade & Cutting Capacity",
      order: 10,
      fields: [
        {
          id: "blade_length_options", key: "blade_length_options", label: "Blade Lengths Available", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed in INCHES as the LIST the machine accepts — 5/6/8/10/12/13/15/17\". It is a fitment range, not a measurement: the same machine takes several blades and the customer picks by lay height. Record the printed list, not one number, and NEVER convert it to millimetres — the trade quotes this class in inches and a converted figure will not match any blade on the shelf.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_lay_height", key: "max_lay_height", label: "Max Lay Height", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "The usable stack a given blade will cut, always LESS than the blade length because the stroke and the presser foot take part of it. Left as text and separate from the blade list because the catalogue does not print a fixed pair — it depends on the fabric.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        knifeSharpeningField,
      ],
    },
    cuttingMotorGroup(20, {
      powerNote: "750 to 2200 W across the range, and some sheets print a PAIR (e.g. 1650/2000) because the same frame is offered with two motors. Record the motor actually fitted; the pair belongs in the model notes.",
      speedNote: "4500–5000 rpm on fixed-speed models; the auto-sharpening ones print a BAND (3500–5400 rpm) because the speed varies with the sharpening cycle. Kept as text so the band survives.",
    }),
    {
      id: "straight-knife-safety",
      title: "Operator Safety",
      order: 30,
      fields: [
        {
          id: "operator_safety_devices", key: "operator_safety_devices", label: "Safety Devices", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Foot-press limit, palm infrared thermal sensing, blade protection, and fingerprint or ID-card unlock. On a machine whose blade is exposed at hand height these are the specification, not an accessory list — and the ID unlock is also who is ALLOWED to run it, which a factory audit will ask about.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "operator_lock_type", key: "operator_lock_type", label: "Operator Lock", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "lock_fingerprint", label: "Fingerprint" },
            { value: "lock_id_card", label: "ID Card" },
            { value: "lock_none", label: "None" },
          ],
          description: "\"Fingerprint unlock / ID card unlock (choose one)\" — the catalogue prints them as alternatives, so the two must not both be ticked. Blank means UNKNOWN; \"None\" is a real and different answer.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "lubrication_system", key: "lubrication_system", label: "Lubrication", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Spray lubrication with large oil hole\" or \"centralized lubrication\". Quoted because oil reaching the blade guide is what the service interval is really about on this machine.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    electricalGroup(40),
    physicalGroup(50),
    packingShippingGroup(60),
    safetyComplianceGroup(70),
  ],
};

export const ROUND_KNIFE_SCHEMA: ProductSchemaDefinition = {
  id: "round-knife-cutting.v1",
  name: "Round Knife Cutting Machine",
  divisionCode: "garment-machinery",
  categoryCode: "cutting-equipment",
  subcategoryCode: "XCR",
  version: "1",
  groups: [
    {
      id: "round-knife-blade",
      title: "Blade & Cutting Capacity",
      order: 10,
      fields: [
        {
          id: "blade_diameter_mm", key: "blade_diameter_mm", label: "Blade Diameter", order: 10,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "100, 110 or 125 mm on the servo series, and on the mechanical series THE MODEL NUMBER IS THE DIAMETER (XC-90 = 90 mm … XC-125 = 125 mm). Record it explicitly anyway: the new coding will renumber the models and the diameter must survive that.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_cutting_height_mm", key: "max_cutting_height_mm", label: "Max Cutting Height", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "10 mm on the smallest to 48 mm on the largest — the fabric stack the blade clears, in MILLIMETRES and as ONE number. ⚠️ This is NOT the straight knife's \"cutting height\": that one is a list of blade LENGTHS in inches. Same column heading in the catalogue, two different facts, which is why they are separate fields.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        knifeSharpeningField,
      ],
    },
    cuttingMotorGroup(20, {
      powerNote: "90 W on the smallest hand cutter to 350 W on the 125 mm. Power tracks blade diameter closely, so a figure far off that line is worth re-reading before it is entered.",
      speedNote: "The two families differ sharply: mechanical 360–2400 rpm, servo brushless 600–1500 rpm ADJUSTABLE. Kept as text because a fixed figure and an adjustable band are not the same claim.",
    }),
    {
      id: "round-knife-safety",
      title: "Operator Safety",
      order: 30,
      fields: [
        {
          id: "operator_safety_devices", key: "operator_safety_devices", label: "Safety Devices", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Dual protection: child lock switch and liftable guard.\" Different devices from the straight knife's, because the hazard is different — a round blade is small, fast and easy to start by accident.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "base_plate_adjustment", key: "base_plate_adjustment", label: "Base Plate Adjustment", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"Adjustment block on the base plate to minimise blade wear.\" It sets how far the blade stands proud of the plate, which is what stops the edge grinding into the table — a consumables fact.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "work_light", key: "work_light", label: "Work Light", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"LED cold light for wider application\" — cold specifically, because a warm lamp this close to synthetic fabric marks it.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    electricalGroup(40),
    physicalGroup(50),
    packingShippingGroup(60),
    safetyComplianceGroup(70),
  ],
};

export const KNIFE_CUTTING_SCHEMAS: ProductSchemaDefinition[] = [
  STRAIGHT_KNIFE_SCHEMA,
  ROUND_KNIFE_SCHEMA,
];
