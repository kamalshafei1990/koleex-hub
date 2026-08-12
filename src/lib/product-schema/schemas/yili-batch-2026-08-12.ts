/**
 * YILI catalog batch — 2026-08-12 (owner-approved).
 *
 * Two subcategories that hold live YILI products and had NO spec template,
 * so their operators had nowhere structured to type what the catalog says:
 *
 *   XFSP · Spotting Machines        — catalog pages 81–82 (spread 45)
 *   XFTS · Thread Sucking Machines  — catalog pages 87–88 (spread 48)
 *
 * EVERY FIELD BELOW COMES OFF THE CATALOG PAGE, not from a guess. The YILI
 * PDF is a scan (zero extractable text), so the tables were read from
 * rendered page images and each field is traceable to a printed column:
 *
 *   XFSP "MAIN CONFIGURATION"     → solution guns/bottles, steam & hot-air
 *                                   gun, suction, blowing, lamp, heated table
 *   XFSP "TECHNICAL SPECIFICATION"→ voltage, suction motor power, external
 *                                   steam pressure, external air pressure,
 *                                   suction pressure, working table height,
 *                                   dimensions
 *   XFTS "TECHNICAL SPECIFICATION"→ voltage, motor power & speed, nozzle
 *                                   inlet size, sucking area size, pedestal
 *                                   size, nozzle suction pressure, noise,
 *                                   drawer / chimney / electric-eye options
 *
 * The XFTS page prints TWO machines under one heading — thread SUCKING
 * (YL-01A/B/C) and thread BRUSHING (YL-02A/B). They are one subcategory in
 * the live taxonomy, so one schema carries both: a `machine_variant` selector
 * switches which half an operator fills, and the brushing-only fields sit in
 * their own group rather than forcing empty columns on a sucking machine.
 *
 * Keys REUSE the frozen vocabulary wherever it exists (voltage_phase,
 * power_kw, noise_level, suction_pressure, working_height, control_system)
 * so spec-i18n and the mirror stay coherent; only genuinely new specs mint
 * new keys, and every one of those is translated in spec-i18n.
 *
 * Logistics comes from the shared factories — physicalGroup and
 * packingShippingGroup both carry `formTab: "logistics"`, so machine
 * dimensions, packing dimensions, CBM, net and gross weight land on the
 * Logistics tab of the product form exactly as they do for spreading
 * machines and fabric inspection, which is the pattern the owner asked to
 * repeat.
 */

import type { ProductSchemaDefinition } from "@/types/product-schema";
import { DEFAULT_PUBLIC_VISIBILITY } from "../visibility";
import {
  electricalGroup,
  packingShippingGroup,
  physicalGroup,
  safetyComplianceGroup,
} from "./_shared-machine-groups";

const pub = DEFAULT_PUBLIC_VISIBILITY;

/* ─────────────────────────────────────────────────────────────────────────
   1 · SPOTTING / SPOT REMOVING MACHINE (XFSP) — catalog pages 81–82
   Printed models: YL-YZT-A (steam & hot-air gun, suction) and YL-YZT-B
   (suction, blowing, lamp, electrically heated worktable).
   ───────────────────────────────────────────────────────────────────────── */
export const SPOTTING_MACHINE_SCHEMA: ProductSchemaDefinition = {
  id: "spotting-machine.v1",
  name: "Spotting / Stain Removal Machine",
  divisionCode: "garment-machinery",
  categoryCode: "ironing-systems",
  subcategoryCode: "XFSP",
  version: "1",
  groups: [
    {
      id: "spotting-configuration",
      title: "Spotting Configuration",
      order: 10,
      fields: [
        {
          id: "gun_types", key: "gun_types", label: "Gun Types", order: 10,
          fieldType: "multi_select", dataType: "json", required: false,
          description: "Applicator guns fitted. The catalog's A model carries a steam & hot-air gun; both models carry solution guns.",
          options: [
            { value: "solution_gun", label: "Solution Gun" },
            { value: "steam_hot_air_gun", label: "Steam & Hot Air Gun" },
            { value: "cold_air_gun", label: "Cold Air Gun" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "solution_gun_count", key: "solution_gun_count", label: "Solution Guns", order: 20,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "Number of solution guns supplied (catalog: two).",
          suggestions: [1, 2], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "solution_bottle_count", key: "solution_bottle_count", label: "Solution Bottles", order: 30,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "Number of solution bottles supplied (catalog: two).",
          suggestions: [1, 2], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "with_vacuum_table", key: "with_vacuum_table", label: "Suction Function", order: 40,
          fieldType: "boolean", dataType: "boolean", required: false,
          description: "Worktable suction that pulls solution and vapour through the fabric.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "blowing_function", key: "blowing_function", label: "Blowing Function", order: 50,
          fieldType: "boolean", dataType: "boolean", required: false,
          description: "Air blowing through the table (catalog: B model only).",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "heated_table", key: "heated_table", label: "Worktable with Electric Heater", order: 60,
          fieldType: "boolean", dataType: "boolean", required: false,
          description: "Electrically heated worktable to speed drying (catalog: B model only).",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "work_lamp", key: "work_lamp", label: "Work Lamp", order: 70,
          fieldType: "boolean", dataType: "boolean", required: false,
          description: "Overhead lamp over the spotting area (catalog: B model only).",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "table_material", key: "table_material", label: "Worktable Material", order: 80,
          fieldType: "select", dataType: "string", required: false,
          description: "Catalog states stainless steel with an inbuilt suction device.",
          options: [
            { value: "stainless_steel", label: "Stainless Steel" },
            { value: "painted_steel", label: "Painted Steel" },
            { value: "aluminium", label: "Aluminium" },
          ],
          ...pub, visualRenderType: "spec_card",
        },
      ],
    },
    {
      id: "spotting-performance",
      title: "Performance & Utilities",
      order: 20,
      fields: [
        {
          id: "suction_pressure", key: "suction_pressure", label: "Suction Pressure", order: 10,
          fieldType: "text", dataType: "string", required: false,
          description: "Negative pressure at the table, as printed (catalog: −300Pa to −400Pa).",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "suction_motor_power", key: "suction_motor_power", label: "Suction Motor Power", order: 20,
          fieldType: "unit_number", dataType: "number", unit: "kW", required: false,
          description: "Suction motor rating (catalog: 0.75 kW).",
          suggestions: [0.75, 1.1, 1.5], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "steam_pressure", key: "steam_pressure", label: "External Steam Pressure", order: 30,
          fieldType: "unit_number", dataType: "number", unit: "MPa", required: false,
          description: "Steam supply the machine expects from an external generator (catalog: 0.5 MPa).",
          suggestions: [0.4, 0.5, 0.6], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "air_pressure", key: "air_pressure", label: "External Air Pressure", order: 40,
          fieldType: "unit_number", dataType: "number", unit: "MPa", required: false,
          description: "Compressed-air supply expected from an external compressor (catalog: 0.6 MPa).",
          suggestions: [0.5, 0.6, 0.8], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "working_height", key: "working_height", label: "Working Table Height", order: 50,
          fieldType: "unit_number", dataType: "number", unit: "mm", required: false,
          description: "Height of the work surface (catalog: 980 mm).",
          suggestions: [900, 950, 980], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "requires_external_supply", key: "requires_external_supply", label: "Requires External Steam & Air", order: 60,
          fieldType: "boolean", dataType: "boolean", required: false,
          description: "Catalog note: the A model must be connected to a steam generator and an air compressor.",
          ...pub, visualRenderType: "spec_card",
        },
      ],
    },
    electricalGroup(30, { motorLabel: "Suction Motor Power" }),
    physicalGroup(60),
    packingShippingGroup(65),
    safetyComplianceGroup(70),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   2 · THREAD SUCKING / BRUSHING MACHINE (XFTS) — catalog pages 87–88
   Printed models: YL-01A/B/C (sucking, three body types) and YL-02A/B
   (brushing, fixed vs adjustable speed).
   ───────────────────────────────────────────────────────────────────────── */
export const THREAD_SUCKING_SCHEMA: ProductSchemaDefinition = {
  id: "thread-sucking.v1",
  name: "Thread Sucking / Brushing Machine",
  divisionCode: "garment-machinery",
  categoryCode: "finishing-equipment",
  subcategoryCode: "XFTS",
  version: "1",
  groups: [
    {
      id: "thread-machine-type",
      title: "Machine Type",
      order: 10,
      fields: [
        {
          id: "machine_variant", key: "machine_variant", label: "Machine Variant", order: 10,
          fieldType: "select", dataType: "string", required: false,
          description: "The catalog prints two machines under one heading. Pick which one this product is — it decides which groups below apply.",
          options: [
            { value: "thread_sucking", label: "Thread Sucking Machine" },
            { value: "thread_brushing", label: "Thread Brushing Machine" },
            { value: "combined", label: "Combined Sucking & Brushing" },
          ],
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "body_type", key: "body_type", label: "Body Type", order: 20,
          fieldType: "select", dataType: "string", required: false,
          description: "Sucking machines are printed in three body types (catalog photos).",
          options: [
            { value: "general", label: "General Type" },
            { value: "with_drawer", label: "With Drawer" },
            { value: "with_chimney", label: "With Chimney" },
          ],
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "optional_features", key: "optional_features", label: "Optional Features", order: 30,
          fieldType: "multi_select", dataType: "json", required: false,
          description: "Printed as \"Option\" in the specification table.",
          options: [
            { value: "drawer", label: "Drawer" },
            { value: "chimney", label: "Chimney" },
            { value: "electric_eye_induction", label: "Electric Eye Induction" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "auto_stop_safety", key: "auto_stop_safety", label: "Auto-Stop on Garment Intake", order: 40,
          fieldType: "boolean", dataType: "boolean", required: false,
          description: "Catalog safety note: the machine stops automatically if it sucks in a garment.",
          ...pub, visualRenderType: "spec_card",
        },
      ],
    },
    {
      id: "suction-performance",
      title: "Suction Performance",
      order: 20,
      fields: [
        {
          id: "power_kw", key: "power_kw", label: "Motor Power", order: 10,
          fieldType: "unit_number", dataType: "number", unit: "kW", required: false,
          description: "Suction motor rating (catalog: 2.2 / 4 / 5 kW across YL-01A/B/C).",
          suggestions: [0.8, 2.2, 4, 5], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "motor_speed_rpm", key: "motor_speed_rpm", label: "Motor Speed", order: 20,
          fieldType: "unit_number", dataType: "number", unit: "r/min", required: false,
          description: "Suction motor speed (catalog: 1400 r/min).",
          suggestions: [1400, 2800], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "nozzle_inlet_size", key: "nozzle_inlet_size", label: "Nozzle Inlet Size", order: 30,
          fieldType: "text", dataType: "string", unit: "mm", required: false,
          description: "Inlet opening as printed (catalog: 520*140 mm or 550*160 mm).",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "sucking_area_size", key: "sucking_area_size", label: "Sucking Area Size", order: 40,
          fieldType: "text", dataType: "string", unit: "mm", required: false,
          description: "Working suction area as printed (catalog: 1500*520*140 or 1500*550*160).",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "pedestal_size", key: "pedestal_size", label: "Pedestal Size", order: 50,
          fieldType: "text", dataType: "string", unit: "mm", required: false,
          description: "Base/pedestal footprint as printed (catalog: 590*590*1000 or 660*600*1000).",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "suction_pressure", key: "suction_pressure", label: "Nozzle Suction Pressure", order: 60,
          fieldType: "text", dataType: "string", required: false,
          description: "Suction at the nozzle as printed (catalog: >650 Pa).",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "noise_level", key: "noise_level", label: "Noise Level", order: 70,
          fieldType: "unit_number", dataType: "number", unit: "dB", required: false,
          description: "Operating noise (catalog: <85 dB).",
          suggestions: [75, 80, 85], ...pub, visualRenderType: "spec_card",
        },
      ],
    },
    {
      id: "brushing-performance",
      title: "Brushing Performance",
      order: 30,
      fields: [
        {
          id: "brush_roller_power", key: "brush_roller_power", label: "Brush Roller Power", order: 10,
          fieldType: "unit_number", dataType: "number", unit: "kW", required: false,
          description: "Brush roller motor rating (catalog: 0.55 kW). Brushing machines only.",
          suggestions: [0.55, 0.75], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "brush_roller_speed", key: "brush_roller_speed", label: "Brush Roller Speed", order: 20,
          fieldType: "unit_number", dataType: "number", unit: "r/min", required: false,
          description: "Brush roller rotating speed (catalog: max 600 r/min).",
          suggestions: [400, 600], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "brush_roller_length", key: "brush_roller_length", label: "Brush Roller Length", order: 30,
          fieldType: "unit_number", dataType: "number", unit: "mm", required: false,
          description: "Working length of the brush roller (catalog: 720 mm).",
          suggestions: [720], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "speed_control", key: "speed_control", label: "Speed Control", order: 40,
          fieldType: "select", dataType: "string", required: false,
          description: "Catalog distinguishes YL-02A (fixed) from YL-02B (adjustable).",
          options: [
            { value: "fixed", label: "Fixed Speed" },
            { value: "adjustable", label: "Speed Adjustable" },
          ],
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "working_table_size", key: "working_table_size", label: "Working Table Size", order: 50,
          fieldType: "text", dataType: "string", unit: "mm", required: false,
          description: "Table size as printed (catalog: 1160X750 mm).",
          ...pub, visualRenderType: "spec_card",
        },
      ],
    },
    electricalGroup(40),
    physicalGroup(60),
    packingShippingGroup(65),
    safetyComplianceGroup(70),
  ],
};

/* Ironing-Systems binding for XFSP — the category is a shelf and the token is
   the identity (CL-0018), and CL-0019 put Spotting Machines on the Ironing
   shelf. Registered under that category so the classify tab resolves it. */
export const YILI_BATCH_SCHEMAS: ProductSchemaDefinition[] = [
  SPOTTING_MACHINE_SCHEMA,
  THREAD_SUCKING_SCHEMA,
];
