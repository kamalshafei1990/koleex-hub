/**
 * Finishing-equipment schema batch — 2026-08-05 (owner-approved).
 *
 * Seven schema families driven by the YILI catalog audit: the finishing
 * side of the taxonomy had 18 live fusing products and a whole incoming
 * catalog with no structured spec home. Field keys REUSE the frozen
 * vocabulary wherever it already exists (steam_consumption, steam_pressure,
 * air_pressure, control_system, suitable_garments, max_operating_temp,
 * vacuum_power_kw, touchscreen…) so spec-i18n and the mirror stay coherent;
 * only genuinely new specs mint new keys, all translated in spec-i18n.
 *
 * One file for the batch: these schemas share the machine-group factories
 * and were reviewed as one unit; splitting them into seven files would
 * scatter one decision across seven diffs.
 *
 * XFFP registers twice (finishing-equipment AND fabric-preparation) because
 * the live taxonomy carries the same token under both categories — the
 * known duplicate-code finding logged in CL-0016. One definition, two
 * registry keys, so BOTH homes resolve until the duplication is resolved
 * governance-side.
 *
 * XFIT and XFVT share one field family (a vacuum table IS an ironing table
 * with suction fitted — the approval matrix already notes "absorbs XFVT"),
 * so both bind to the same groups with their own ids.
 */

import type { ProductSchemaDefinition, SpecGroup } from "@/types/product-schema";
import { DEFAULT_PUBLIC_VISIBILITY } from "../visibility";
import {
  electricalGroup,
  packingShippingGroup,
  physicalGroup,
  safetyComplianceGroup,
} from "./_shared-machine-groups";

const pub = DEFAULT_PUBLIC_VISIBILITY;

/* ─────────────────────────────────────────────────────────────────────────
   1 · FUSING MACHINE (XFFP) — catalog pages 65–68
   ───────────────────────────────────────────────────────────────────────── */

const FUSING_GROUPS: SpecGroup[] = [
  {
    id: "fusing-configuration",
    title: "Fusing Configuration",
    order: 10,
    fields: [
      {
        id: "fusing_type", key: "fusing_type", label: "Fusing Type", order: 10,
        fieldType: "select", dataType: "string", required: true,
        anchor: true, importance: "high", anchorPriority: 10,
        description: "Press architecture of the fusing machine.",
        options: [
          { value: "continuous_belt", label: "Continuous Belt" },
          { value: "flat_press", label: "Flat Press" },
          { value: "rotary", label: "Rotary Drum" },
        ],
        ...pub, comparable: true, filterVisible: true, visualRenderType: "technical_badge",
      },
      {
        id: "belt_width", key: "belt_width", label: "Belt Width", order: 20,
        fieldType: "unit_number", dataType: "number", unit: "mm", required: true,
        anchor: true, importance: "high", anchorPriority: 20,
        description: "Usable fusing belt width.",
        suggestions: [500, 600, 900, 1000, 1200, 1400, 1600],
        ...pub, comparable: true, visualRenderType: "spec_card",
      },
      {
        id: "heating_method", key: "heating_method", label: "Heating Method", order: 30,
        fieldType: "select", dataType: "string", required: false,
        description: "How the fusing zone is heated.",
        options: [
          { value: "electric", label: "Electric Elements" },
          { value: "oil_heated", label: "Oil-Circulation Heated" },
        ],
        ...pub, visualRenderType: "technical_badge",
      },
      {
        id: "heating_zones", key: "heating_zones", label: "Heating Zones", order: 40,
        fieldType: "number", dataType: "number", required: false,
        description: "Independently controlled heating zones.",
        suggestions: [1, 2, 4],
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "belt_material", key: "belt_material", label: "Belt Material", order: 50,
        fieldType: "select", dataType: "string", required: false,
        description: "Fusing belt construction.",
        options: [
          { value: "ptfe_glass", label: "PTFE Glass Fibre" },
          { value: "teflon", label: "Teflon-Coated" },
          { value: "silicone", label: "Silicone" },
        ],
        ...pub, visualRenderType: "technical_badge",
      },
    ],
  },
  {
    id: "fusing-performance",
    title: "Fusing Performance",
    order: 20,
    fields: [
      {
        id: "max_operating_temp", key: "max_operating_temp", label: "Max Fusing Temperature", order: 10,
        fieldType: "unit_number", dataType: "number", unit: "°C", required: false,
        description: "Maximum fusing temperature.",
        suggestions: [180, 200, 220],
        ...pub, comparable: true, visualRenderType: "spec_card",
      },
      {
        id: "fusing_speed", key: "fusing_speed", label: "Fusing Speed", order: 20,
        fieldType: "unit_number", dataType: "number", unit: "m/min", required: false,
        description: "Belt speed range top end.",
        suggestions: [6, 10, 12, 18],
        ...pub, comparable: true, visualRenderType: "spec_card",
      },
      {
        id: "fusing_pressure", key: "fusing_pressure", label: "Fusing Pressure", order: 30,
        fieldType: "text", dataType: "string", required: false,
        description: "Roller pressure range (e.g. 0.1–0.6 MPa).",
        ...pub, visualRenderType: "spec_card",
      },
      {
        /* The catalog's per-model table splits motor power from heating-plate
           power (60 W motor vs 24 kW plates) — collapsing them into one
           "power" number would make every model comparison wrong. */
        id: "heating_plate_power", key: "heating_plate_power", label: "Heating Plate Power", order: 32,
        fieldType: "unit_number", dataType: "number", unit: "kW", required: false,
        description: "Heating-plate power (separate from the drive motor).",
        suggestions: [3.6, 6, 7.2, 9, 12, 16, 20, 24],
        ...pub, comparable: true, visualRenderType: "spec_card",
      },
      {
        id: "fusing_time", key: "fusing_time", label: "Fusing Time", order: 34,
        fieldType: "text", dataType: "string", required: false,
        description: "Dwell-time range (e.g. 5–20 sec, 7–34 sec).",
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "pressurization_method", key: "pressurization_method", label: "Pressurization Method", order: 36,
        fieldType: "select", dataType: "string", required: false,
        description: "How roller pressure is generated.",
        options: [
          { value: "spring", label: "Spring Pressurization" },
          { value: "pneumatic", label: "Pneumatic Pressurization" },
        ],
        ...pub, comparable: true, visualRenderType: "technical_badge",
      },
      {
        id: "cooling_section", key: "cooling_section", label: "Cooling Section", order: 40,
        fieldType: "boolean", dataType: "boolean", required: false,
        description: "Built-in cooling zone after the fusing zone.",
        ...pub, visualRenderType: "boolean_feature",
      },
      {
        id: "return_conveyor", key: "return_conveyor", label: "Return Conveyor", order: 50,
        fieldType: "boolean", dataType: "boolean", required: false,
        description: "Returns fused panels to the operator side.",
        ...pub, visualRenderType: "boolean_feature",
      },
    ],
  },
  electricalGroup(40),
  physicalGroup(60),
  packingShippingGroup(65),
  safetyComplianceGroup(70),
];

export const FUSING_MACHINE_SCHEMA: ProductSchemaDefinition = {
  id: "fusing-machine.v1",
  divisionCode: "garment-machinery",
  categoryCode: "finishing-equipment",
  subcategoryCode: "XFFP",
  name: "Fusing Machine",
  version: "1.0.0",
  appliesTo: { description: "Belt and press fusing machines bonding interlining to fabric panels." },
  groups: FUSING_GROUPS,
};

/** Same token lives under Fabric Preparation too (CL-0016 open finding) —
 *  both homes must resolve the same fields. */
export const FUSING_MACHINE_FABRIC_PREP_SCHEMA: ProductSchemaDefinition = {
  ...FUSING_MACHINE_SCHEMA,
  id: "fusing-machine.fabric-prep.v1",
  categoryCode: "fabric-preparation",
};

/* ─────────────────────────────────────────────────────────────────────────
   2 · IRONING TABLES (XFIT + XFVT) — catalog pages 71–81
   ───────────────────────────────────────────────────────────────────────── */

const IRONING_TABLE_GROUPS: SpecGroup[] = [
  {
    id: "table-configuration",
    title: "Table Configuration",
    order: 10,
    fields: [
      {
        id: "table_type", key: "table_type", label: "Table Type", order: 10,
        fieldType: "select", dataType: "string", required: true,
        anchor: true, importance: "high", anchorPriority: 10,
        description: "Table architecture.",
        options: [
          { value: "flat_rectangular", label: "Flat Rectangular" },
          { value: "bridge", label: "Bridge (Inbuilt Boiler)" },
          { value: "special_buck", label: "Special Buck (Shaped)" },
        ],
        ...pub, comparable: true, filterVisible: true, visualRenderType: "technical_badge",
      },
      {
        id: "surface_features", key: "surface_features", label: "Surface Features", order: 20,
        fieldType: "multi_select", dataType: "json", required: true,
        anchor: true, importance: "high", anchorPriority: 20,
        description: "Working-surface capabilities fitted to the table.",
        options: [
          { value: "vacuum_suction", label: "Vacuum Suction" },
          { value: "heated_surface", label: "Heated Surface" },
          { value: "up_blowing", label: "Up-Blowing" },
          { value: "sleeve_buck", label: "Sleeve Buck / Arm" },
          { value: "iron_rest", label: "Iron Rest" },
          { value: "light_boom", label: "Lamp / Hose Boom" },
        ],
        ...pub, comparable: true, visualRenderType: "icon_chip",
      },
      {
        id: "buck_size", key: "buck_size", label: "Buck / Table Size", order: 30,
        fieldType: "dimension", dataType: "string", unit: "mm", required: false,
        description: "Working-surface dimensions in mm.",
        ...pub, visualRenderType: "packing_block",
      },
      {
        id: "included_iron", key: "included_iron", label: "Steam Iron Included", order: 40,
        fieldType: "boolean", dataType: "boolean", required: false,
        description: "Ships with a full steam iron and hose set.",
        ...pub, visualRenderType: "boolean_feature",
      },
      {
        id: "height_adjustable", key: "height_adjustable", label: "Height Adjustable", order: 50,
        fieldType: "boolean", dataType: "boolean", required: false,
        description: "Working height can be adjusted.",
        ...pub, visualRenderType: "boolean_feature",
      },
    ],
  },
  {
    id: "steam-utilities",
    title: "Steam & Utilities",
    order: 20,
    fields: [
      {
        id: "steam_source", key: "steam_source", label: "Steam Source", order: 10,
        fieldType: "select", dataType: "string", required: false,
        description: "Where the table's steam comes from.",
        options: [
          { value: "built_in_boiler", label: "Built-in Boiler" },
          { value: "central_steam", label: "Central Steam Line" },
          { value: "electric_iron_only", label: "Electric Iron Only" },
        ],
        ...pub, comparable: true, filterVisible: true, visualRenderType: "technical_badge",
      },
      {
        id: "boiler_power", key: "boiler_power", label: "Boiler Heating Power", order: 20,
        fieldType: "unit_number", dataType: "number", unit: "kW", required: false,
        description: "Inbuilt boiler heating power.",
        suggestions: [3, 5, 6],
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "vacuum_power_kw", key: "vacuum_power_kw", label: "Vacuum Motor Power", order: 30,
        fieldType: "unit_number", dataType: "number", unit: "kW", required: false,
        description: "Suction motor power.",
        suggestions: [0.55, 0.75],
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "table_heating_power", key: "table_heating_power", label: "Surface Heating Power", order: 40,
        fieldType: "unit_number", dataType: "number", unit: "kW", required: false,
        description: "Electric surface-heating power.",
        suggestions: [0.5, 1],
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "max_operating_temp", key: "max_operating_temp", label: "Surface Temperature (max)", order: 50,
        fieldType: "unit_number", dataType: "number", unit: "°C", required: false,
        description: "Adjustable surface-heating ceiling.",
        suggestions: [110],
        ...pub, visualRenderType: "spec_card",
      },
    ],
  },
  electricalGroup(40),
  physicalGroup(60),
  packingShippingGroup(65),
  safetyComplianceGroup(70),
];

export const IRONING_TABLE_SCHEMA: ProductSchemaDefinition = {
  id: "ironing-table.v1",
  divisionCode: "garment-machinery",
  categoryCode: "finishing-equipment",
  subcategoryCode: "XFIT",
  name: "Ironing Table",
  version: "1.0.0",
  appliesTo: { description: "Ironing tables — flat, bridge (inbuilt boiler) and shaped bucks, with vacuum/heat/blow options." },
  groups: IRONING_TABLE_GROUPS,
};

/** XFVT shares the family: a vacuum table is an ironing table with suction
 *  fitted (approval matrix: XFIT "absorbs XFVT"). */
export const VACUUM_IRONING_TABLE_SCHEMA: ProductSchemaDefinition = {
  ...IRONING_TABLE_SCHEMA,
  id: "vacuum-ironing-table.v1",
  subcategoryCode: "XFVT",
  name: "Vacuum Ironing Table",
};

/* ─────────────────────────────────────────────────────────────────────────
   3 · TROUSER PRESSING (XFTT) — catalog pages 5–8
   ───────────────────────────────────────────────────────────────────────── */

const TROUSER_GROUPS: SpecGroup[] = [
  {
    id: "pressing-configuration",
    title: "Pressing Configuration",
    order: 10,
    fields: [
      {
        id: "press_type", key: "press_type", label: "Press Type", order: 10,
        fieldType: "select", dataType: "string", required: true,
        anchor: true, importance: "high", anchorPriority: 10,
        description: "Which part of the trouser the machine presses.",
        options: [
          { value: "topper", label: "Topper (Waist / Seat)" },
          { value: "legger", label: "Legger (Legs / Creases)" },
          { value: "topper_legger", label: "Topper + Legger" },
        ],
        ...pub, comparable: true, filterVisible: true, visualRenderType: "technical_badge",
      },
      {
        id: "station_count", key: "station_count", label: "Stations", order: 20,
        fieldType: "number", dataType: "number", required: true,
        anchor: true, importance: "high", anchorPriority: 20,
        description: "Working stations (rotary multi-station lines press continuously).",
        suggestions: [1, 3],
        ...pub, comparable: true, visualRenderType: "spec_card",
      },
      {
        id: "throughput", key: "throughput", label: "Throughput", order: 30,
        fieldType: "unit_number", dataType: "number", unit: "pcs/h", required: false,
        anchor: true, importance: "high", anchorPriority: 30,
        description: "Rated garments per hour.",
        suggestions: [180, 240, 300],
        ...pub, comparable: true, visualRenderType: "spec_card",
      },
      {
        id: "robot_handling", key: "robot_handling", label: "Robotic Handling", order: 40,
        fieldType: "boolean", dataType: "boolean", required: false,
        description: "Robotic seam pressing / auto load-unload.",
        ...pub, visualRenderType: "boolean_feature",
      },
      {
        id: "suitable_garments", key: "suitable_garments", label: "Suitable Garments", order: 50,
        fieldType: "multi_select", dataType: "json", required: false,
        description: "Trouser types the machine handles.",
        options: [
          { value: "jeans", label: "Jeans" },
          { value: "knit_pants", label: "Knitted Pants" },
          { value: "casual_pants", label: "Sports / Casual Pants" },
          { value: "yoga_pants", label: "Yoga Pants" },
        ],
        ...pub, visualRenderType: "application_card",
      },
      {
        id: "waistband_range", key: "waistband_range", label: "Waistband Circumference", order: 60,
        fieldType: "text", dataType: "string", required: false,
        description: "Supported waistband range (e.g. 750–1100 mm, sizes 30–40).",
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "trouser_length_range", key: "trouser_length_range", label: "Trouser Length", order: 70,
        fieldType: "text", dataType: "string", required: false,
        description: "Supported trouser length range in mm.",
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "press_features", key: "press_features", label: "Pressing Devices", order: 80,
        fieldType: "multi_select", dataType: "json", required: false,
        description: "Clamps and shaping devices fitted.",
        options: [
          { value: "waist_expansion", label: "Waist Expansion Device" },
          { value: "leg_pulldown_clamp", label: "Leg Pull-Down Clamp" },
          { value: "waist_side_clamp", label: "Waist Side Clamp" },
          { value: "front_placket_fixing", label: "Front Placket Fixing" },
          { value: "hem_heating", label: "Dedicated Hem Heating" },
          { value: "auto_unload_conveyor", label: "Auto-Unload + Conveyor" },
        ],
        ...pub, visualRenderType: "icon_chip",
      },
      {
        id: "control_system", key: "control_system", label: "Control System", order: 90,
        fieldType: "select", dataType: "string", required: false,
        description: "Machine control architecture.",
        options: [
          { value: "plc_hmi_servo", label: "PLC + HMI + Servo" },
          { value: "plc_touchscreen", label: "PLC + Touchscreen" },
        ],
        ...pub, visualRenderType: "technical_badge",
      },
    ],
  },
  {
    id: "steam-air",
    title: "Steam & Air",
    order: 20,
    fields: [
      {
        id: "steam_consumption", key: "steam_consumption", label: "Steam Consumption", order: 10,
        fieldType: "unit_number", dataType: "number", unit: "kg/h", required: false,
        description: "Rated steam consumption.",
        suggestions: [15, 60],
        ...pub, comparable: true, visualRenderType: "spec_card",
      },
      {
        id: "steam_pressure", key: "steam_pressure", label: "Steam Pressure", order: 20,
        fieldType: "text", dataType: "string", required: false,
        description: "Working steam pressure (e.g. 0.4–0.7 MPa).",
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "air_pressure", key: "air_pressure", label: "Air Pressure", order: 30,
        fieldType: "text", dataType: "string", required: false,
        description: "Working compressed-air pressure (e.g. 0.4–0.7 MPa).",
        ...pub, visualRenderType: "spec_card",
      },
    ],
  },
  electricalGroup(40),
  physicalGroup(60),
  packingShippingGroup(65),
  safetyComplianceGroup(70),
];

export const TROUSER_PRESSING_SCHEMA: ProductSchemaDefinition = {
  id: "trouser-pressing.v1",
  divisionCode: "garment-machinery",
  categoryCode: "finishing-equipment",
  subcategoryCode: "XFTT",
  name: "Trouser Pressing Machine",
  version: "1.0.0",
  appliesTo: { description: "Trouser toppers and leggers — single-station steam-integrated units to rotary robotic lines." },
  groups: TROUSER_GROUPS,
};

/* ─────────────────────────────────────────────────────────────────────────
   4 · ELECTRIC STEAM GENERATOR (XFSB) — catalog pages 83–84
   ───────────────────────────────────────────────────────────────────────── */

const STEAM_GENERATOR_GROUPS: SpecGroup[] = [
  {
    id: "steam-output",
    title: "Steam Output",
    order: 10,
    fields: [
      {
        id: "heating_power", key: "heating_power", label: "Heating Power", order: 10,
        fieldType: "unit_number", dataType: "number", unit: "kW", required: true,
        anchor: true, importance: "high", anchorPriority: 10,
        description: "Heating-pipe power — the series' sizing spec.",
        suggestions: [3, 6, 9, 12, 18, 24, 36, 48, 72, 108],
        ...pub, comparable: true, filterVisible: true, visualRenderType: "spec_card",
      },
      {
        id: "evaporation_capacity", key: "evaporation_capacity", label: "Evaporation Capacity", order: 20,
        fieldType: "unit_number", dataType: "number", unit: "kg/h", required: true,
        anchor: true, importance: "high", anchorPriority: 20,
        description: "Rated steam output.",
        suggestions: [4, 8, 12, 16, 25, 32, 50, 66, 100, 150],
        ...pub, comparable: true, visualRenderType: "spec_card",
      },
      {
        id: "steam_pressure", key: "steam_pressure", label: "Steam Pressure", order: 30,
        fieldType: "text", dataType: "string", required: false,
        description: "Working steam pressure (e.g. 0.4 / 0.7 MPa).",
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "steam_temperature", key: "steam_temperature", label: "Steam Temperature", order: 40,
        fieldType: "unit_number", dataType: "number", unit: "°C", required: false,
        description: "Output steam temperature.",
        suggestions: [151, 170],
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "irons_supported", key: "irons_supported", label: "Irons Supported", order: 50,
        fieldType: "number", dataType: "number", required: false,
        description: "How many steam irons the generator can feed at once.",
        suggestions: [1, 2, 4, 6],
        ...pub, comparable: true, visualRenderType: "spec_card",
      },
    ],
  },
  {
    id: "water-system",
    title: "Water System",
    order: 20,
    fields: [
      {
        id: "furnace_water_capacity", key: "furnace_water_capacity", label: "Furnace Water Capacity", order: 10,
        fieldType: "unit_number", dataType: "number", unit: "L", required: false,
        description: "Furnace water volume.",
        suggestions: [16, 24, 29],
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "water_pump_power", key: "water_pump_power", label: "Water Pump Power", order: 20,
        fieldType: "unit_number", dataType: "number", unit: "kW", required: false,
        description: "High-temperature-resistant feed pump power.",
        suggestions: [0.75, 1.1],
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "auto_water_feed", key: "auto_water_feed", label: "Automatic Water Feed", order: 30,
        fieldType: "boolean", dataType: "boolean", required: false,
        description: "Liquid-level controlled automatic refill.",
        ...pub, visualRenderType: "boolean_feature",
      },
    ],
  },
  electricalGroup(40),
  physicalGroup(60),
  packingShippingGroup(65),
  safetyComplianceGroup(70, [
    { value: "safety_valve", label: "Safety Valve" },
    { value: "pressure_controller", label: "Pressure Controller" },
    { value: "water_shortage_alarm", label: "Water-Shortage Alarm" },
    { value: "liquid_level_controller", label: "Liquid-Level Controller" },
  ]),
];

export const STEAM_GENERATOR_SCHEMA: ProductSchemaDefinition = {
  id: "steam-generator.v1",
  divisionCode: "garment-machinery",
  categoryCode: "finishing-equipment",
  subcategoryCode: "XFSB",
  name: "Electric Steam Generator",
  version: "1.0.0",
  appliesTo: { description: "Electric steam boilers/generators feeding irons, tables and finishing lines." },
  groups: STEAM_GENERATOR_GROUPS,
};

/* ─────────────────────────────────────────────────────────────────────────
   5 · FORM FINISHING (XFFF) — catalog pages 9–13 (mannequin / T-shirt /
       tunnel-class, until the proposed XFST steam-tunnel token goes live)
   ───────────────────────────────────────────────────────────────────────── */

const FORM_FINISHING_GROUPS: SpecGroup[] = [
  {
    id: "finishing-configuration",
    title: "Finishing Configuration",
    order: 10,
    fields: [
      {
        id: "finisher_type", key: "finisher_type", label: "Finisher Type", order: 10,
        fieldType: "select", dataType: "string", required: true,
        anchor: true, importance: "high", anchorPriority: 10,
        description: "Machine architecture. Tunnel systems park here until the XFST token is confirmed (see approval matrix).",
        options: [
          { value: "mannequin_steam_air", label: "Mannequin Steam-Air" },
          { value: "tshirt_press", label: "T-Shirt Ironing & Pressing" },
          { value: "tunnel_conveyor", label: "Tunnel (Conveyor)" },
        ],
        ...pub, comparable: true, filterVisible: true, visualRenderType: "technical_badge",
      },
      {
        id: "suitable_garments", key: "suitable_garments", label: "Suitable Garments", order: 20,
        fieldType: "multi_select", dataType: "json", required: true,
        anchor: true, importance: "high", anchorPriority: 20,
        description: "Garment types the finisher shapes.",
        options: [
          { value: "suits_jackets", label: "Suits / Jackets" },
          { value: "shirts", label: "Shirts" },
          { value: "tshirts", label: "T-Shirts / Knitwear" },
          { value: "dresses", label: "Dresses" },
          { value: "outdoorwear", label: "Outdoorwear" },
          { value: "casualwear", label: "Casualwear" },
        ],
        ...pub, visualRenderType: "application_card",
      },
      {
        id: "tensioning_method", key: "tensioning_method", label: "Tensioning Method", order: 30,
        fieldType: "multi_select", dataType: "json", required: false,
        description: "How the garment is held in shape while steamed.",
        options: [
          { value: "air_bag", label: "Air-Bag Inflation" },
          { value: "clamps", label: "Multi-Directional Clamps" },
          { value: "width_expansion", label: "Auto Width Expansion" },
        ],
        ...pub, comparable: true, visualRenderType: "icon_chip",
      },
      {
        id: "throughput", key: "throughput", label: "Throughput", order: 40,
        fieldType: "unit_number", dataType: "number", unit: "pcs/h", required: false,
        description: "Rated garments per hour.",
        suggestions: [150, 300, 600, 1000, 1200],
        ...pub, comparable: true, visualRenderType: "spec_card",
      },
      {
        id: "rotation_180", key: "rotation_180", label: "180° Rotation", order: 50,
        fieldType: "boolean", dataType: "boolean", required: false,
        description: "Rotatable mannequin for all-round access.",
        ...pub, visualRenderType: "boolean_feature",
      },
      {
        id: "twin_station", key: "twin_station", label: "Twin Station", order: 60,
        fieldType: "boolean", dataType: "boolean", required: false,
        description: "Two stations alternate for continuous output.",
        ...pub, visualRenderType: "boolean_feature",
      },
      {
        id: "foot_pedal", key: "foot_pedal", label: "Foot-Pedal Operation", order: 70,
        fieldType: "boolean", dataType: "boolean", required: false,
        description: "Hands-free pedal control.",
        ...pub, visualRenderType: "boolean_feature",
      },
      {
        id: "touchscreen", key: "touchscreen", label: "Touchscreen HMI", order: 80,
        fieldType: "boolean", dataType: "boolean", required: false,
        description: "Touchscreen + PLC control.",
        ...pub, visualRenderType: "boolean_feature",
      },
    ],
  },
  {
    id: "steam-air",
    title: "Steam & Air",
    order: 20,
    fields: [
      {
        id: "steam_consumption", key: "steam_consumption", label: "Steam Consumption", order: 10,
        fieldType: "unit_number", dataType: "number", unit: "kg/h", required: false,
        description: "Rated steam consumption.",
        suggestions: [12, 36, 80, 120, 250],
        ...pub, comparable: true, visualRenderType: "spec_card",
      },
      {
        id: "steam_pressure", key: "steam_pressure", label: "Steam Pressure", order: 20,
        fieldType: "text", dataType: "string", required: false,
        description: "Working steam pressure (e.g. 0.4–0.6 MPa).",
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "air_consumption", key: "air_consumption", label: "Air Consumption", order: 30,
        fieldType: "text", dataType: "string", required: false,
        description: "Compressed-air consumption (e.g. 5 L/min, 25 L/h).",
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "air_pressure", key: "air_pressure", label: "Air Pressure", order: 40,
        fieldType: "text", dataType: "string", required: false,
        description: "Working compressed-air pressure.",
        ...pub, visualRenderType: "spec_card",
      },
    ],
  },
  electricalGroup(40),
  physicalGroup(60),
  packingShippingGroup(65),
  safetyComplianceGroup(70),
];

export const FORM_FINISHING_SCHEMA: ProductSchemaDefinition = {
  id: "form-finishing.v1",
  divisionCode: "garment-machinery",
  categoryCode: "finishing-equipment",
  subcategoryCode: "XFFF",
  name: "Form Finishing Machine",
  version: "1.0.0",
  appliesTo: { description: "Steam-air garment finishers — mannequin dollies, T-shirt pressing cells, tunnel finishing systems." },
  groups: FORM_FINISHING_GROUPS,
};

/* ─────────────────────────────────────────────────────────────────────────
   6 · NEEDLE DETECTOR (XPCN) — catalog page 86
   ───────────────────────────────────────────────────────────────────────── */

const NEEDLE_DETECTOR_GROUPS: SpecGroup[] = [
  {
    id: "detection-performance",
    title: "Detection Performance",
    order: 10,
    fields: [
      {
        id: "detection_sensitivity", key: "detection_sensitivity", label: "Detection Sensitivity", order: 10,
        fieldType: "select", dataType: "string", required: true,
        anchor: true, importance: "high", anchorPriority: 10,
        description: "Smallest ferrous ball reliably detected.",
        options: [
          { value: "fe_0_8", label: "Fe ball Ø0.8 mm" },
          { value: "fe_1_0", label: "Fe ball Ø1.0 mm" },
          { value: "fe_1_2", label: "Fe ball Ø1.2 mm" },
        ],
        ...pub, comparable: true, filterVisible: true, visualRenderType: "technical_badge",
      },
      {
        id: "head_count", key: "head_count", label: "Detection Heads", order: 20,
        fieldType: "select", dataType: "string", required: true,
        anchor: true, importance: "high", anchorPriority: 20,
        description: "Single head (one probe layer) or double head (two layers, higher sensitivity).",
        options: [
          { value: "single", label: "Single Head" },
          { value: "double", label: "Double Head" },
        ],
        ...pub, comparable: true, visualRenderType: "technical_badge",
      },
      {
        id: "detect_width", key: "detect_width", label: "Detection Width", order: 30,
        fieldType: "unit_number", dataType: "number", unit: "mm", required: false,
        description: "Usable detection surface width.",
        suggestions: [600],
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "detect_height", key: "detect_height", label: "Detection Height", order: 40,
        fieldType: "unit_number", dataType: "number", unit: "mm", required: false,
        description: "Detection tunnel clearance height.",
        suggestions: [100, 120, 150],
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "belt_speed", key: "belt_speed", label: "Belt Speed", order: 50,
        fieldType: "text", dataType: "string", required: false,
        description: "Conveyor transfer speed (e.g. 32 m/min @50Hz, 40 m/min @60Hz).",
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "sensitivity_levels", key: "sensitivity_levels", label: "Sensitivity Levels", order: 60,
        fieldType: "number", dataType: "number", required: false,
        description: "Adjustable sensitivity steps.",
        suggestions: [10],
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "alarm_mode", key: "alarm_mode", label: "Alarm Mode", order: 70,
        fieldType: "multi_select", dataType: "json", required: false,
        description: "What happens when metal is detected.",
        options: [
          { value: "buzzer", label: "Buzzer" },
          { value: "indicator_light", label: "Indicator Light" },
          { value: "belt_stop_return", label: "Belt Stop & Return" },
        ],
        ...pub, visualRenderType: "icon_chip",
      },
    ],
  },
  electricalGroup(40),
  physicalGroup(60),
  packingShippingGroup(65),
  safetyComplianceGroup(70),
];

export const NEEDLE_DETECTOR_SCHEMA: ProductSchemaDefinition = {
  id: "needle-detector.v1",
  divisionCode: "garment-machinery",
  categoryCode: "packing-inspection",
  subcategoryCode: "XPCN",
  name: "Needle Detector",
  version: "1.0.0",
  appliesTo: { description: "Conveyor needle detectors finding broken needles and ferrous fragments in finished goods." },
  groups: NEEDLE_DETECTOR_GROUPS,
};

/* ─────────────────────────────────────────────────────────────────────────
   7 · GARMENT REVERSING (XFGR) — catalog page 85 (token minted CL-0016)
   ───────────────────────────────────────────────────────────────────────── */

const REVERSING_GROUPS: SpecGroup[] = [
  {
    id: "reversing-configuration",
    title: "Reversing Configuration",
    order: 10,
    fields: [
      {
        id: "suitable_for", key: "suitable_for", label: "Suitable For", order: 10,
        fieldType: "multi_select", dataType: "json", required: true,
        anchor: true, importance: "high", anchorPriority: 10,
        description: "Piece types the machine turns right-side-out.",
        options: [
          { value: "tops", label: "Tops / Shirts" },
          { value: "trousers", label: "Trousers" },
          { value: "pillowcases", label: "Pillowcases" },
        ],
        ...pub, comparable: true, filterVisible: true, visualRenderType: "application_card",
      },
      {
        id: "inversion_method", key: "inversion_method", label: "Inversion Method", order: 20,
        fieldType: "select", dataType: "string", required: false,
        description: "How the piece is inverted.",
        options: [
          { value: "vacuum_suction", label: "Vacuum Suction" },
        ],
        ...pub, visualRenderType: "technical_badge",
      },
      {
        id: "suction_pressure", key: "suction_pressure", label: "Suction Pressure", order: 30,
        fieldType: "text", dataType: "string", required: false,
        description: "Negative suction pressure (e.g. −1000 mm).",
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "air_pressure", key: "air_pressure", label: "Input Air Pressure", order: 40,
        fieldType: "text", dataType: "string", required: false,
        description: "Working compressed-air pressure (e.g. 0.3–0.7 MPa).",
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "noise_level", key: "noise_level", label: "Noise Level", order: 50,
        fieldType: "unit_number", dataType: "number", unit: "dB", required: false,
        description: "Operating noise ceiling.",
        suggestions: [85],
        ...pub, visualRenderType: "spec_card",
      },
      {
        id: "electric_eye_sensor", key: "electric_eye_sensor", label: "Electric-Eye Sensor", order: 60,
        fieldType: "boolean", dataType: "boolean", required: false,
        description: "Optional sensor for automatic start/stop and waistband locating.",
        ...pub, visualRenderType: "boolean_feature",
      },
    ],
  },
  electricalGroup(40, { motorLabel: "Motor Power" }),
  physicalGroup(60),
  packingShippingGroup(65),
  safetyComplianceGroup(70),
];

export const GARMENT_REVERSING_SCHEMA: ProductSchemaDefinition = {
  id: "garment-reversing.v1",
  divisionCode: "garment-machinery",
  categoryCode: "finishing-equipment",
  subcategoryCode: "XFGR",
  name: "Garment Reversing Machine",
  version: "1.0.0",
  appliesTo: { description: "Vacuum turning machines inverting sewn pieces right-side-out — tops, trousers, pillowcases." },
  groups: REVERSING_GROUPS,
};
