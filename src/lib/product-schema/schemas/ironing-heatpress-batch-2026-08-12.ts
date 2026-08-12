/**
 * Ironing + Heat-Press batch — 2026-08-12 (owner-approved).
 *
 * Four subcategories that hold live products and had NO spec template:
 *
 *   XFSI · Steam Irons                      (Ironing Systems)
 *   XFCP · Collar & Cuff Press Machines     (Ironing Systems)
 *   XPDH · Double Station Heat Press        (Printing & Heat Press)
 *   XPPH · Pneumatic Heat Press             (Printing & Heat Press)
 *
 * SOURCES — every field below is a printed column or a printed caption. Two
 * registered sources were read for each family, because they are complementary
 * rather than interchangeable (see docs/product-data-v2/reference-data/
 * source-catalogs.md):
 *
 *   S-001 Koleex Catalog 2025 — image-only, one model per page, one column.
 *     p121 irons     → Model · Voltage · Boiler Power · Iron Power ·
 *                      Water volume · Iron type
 *     p125 shirt press → Model · Steam wastage kg/h · Air pressure MPa ·
 *                      Electric heating power KW/V · Packing size · Weight,
 *                      over five printed presses (collar+sleeve, side,
 *                      collar ironing, back seam, shirt arm)
 *
 *   S-003 supplier library — text layer, and a MODEL MATRIX rather than a
 *     single column, which is what shows whether a field varies by model:
 *     specialist iron catalogue → adds Steam Pressure · Boiler Capacity ·
 *                      Usage Time, plus printed feature bullets (automatic
 *                      thermostat, indicator lamp, non-drip soleplate,
 *                      stainless housing, 4-level safety, auto water supply,
 *                      waste-water system) and the generator page (feeds 1–2
 *                      irons, pump or mains feed, ≥4 bar if mains)
 *     heat-press catalogue → one table repeated across 15 pages:
 *                      Heating plate size cm/inch · Voltage V · Power kW ·
 *                      Temperature range ℃ · Time range s · Weight kg ·
 *                      Packing size cm; the automatic label press adds
 *                      Way of working · Application material · Min/Max label
 *                      size · Motor · Air pressure 0.5 MPa · 56 L/min
 *
 * Nothing here is inferred from what a machine "probably" has. Where only one
 * source prints a field it is still included — the XFSI union of the two
 * sources is 8 fields where each source alone gives 6 or 7.
 *
 * Keys reuse the frozen vocabulary (voltage_phase, power_kw, air_pressure,
 * control_system, working_height…) so spec-i18n and the mirror stay coherent.
 * Logistics comes from the shared factories: physicalGroup and
 * packingShippingGroup both carry `formTab: "logistics"`, so dimensions, CBM
 * and weights land on the Logistics tab exactly as they do for spreading
 * machines — the pattern the owner asked to repeat.
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
   1 · STEAM IRONS (XFSI) — Ironing Systems
   S-001 p121 prints XI-825 / XI-5 / XI-826 / XI-525 as boiler-plus-iron sets,
   which is what this subcategory actually sells: the iron and the small
   boiler that feeds it are one product. S-003's specialist catalogue prints
   the same shape (2035 / 2005 / GT76-2 / GT76-4 / GT-6) and adds the three
   fields S-001 omits.
   ───────────────────────────────────────────────────────────────────────── */
export const STEAM_IRON_SCHEMA: ProductSchemaDefinition = {
  id: "steam-iron.v1",
  name: "Steam Iron / Boiler-Iron Set",
  divisionCode: "garment-machinery",
  categoryCode: "ironing-systems",
  subcategoryCode: "XFSI",
  version: "1",
  groups: [
    {
      id: "iron-configuration",
      title: "Iron Configuration",
      order: 10,
      fields: [
        {
          id: "iron_type", key: "iron_type", label: "Iron Type", order: 10,
          fieldType: "select", dataType: "string", required: false,
          description: "S-001 prints an 'Iron type' column with two values: electrically heated (电加热) and all-steam (全蒸汽).",
          options: [
            { value: "electric_heated", label: "Electrically Heated" },
            { value: "all_steam", label: "All Steam" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "boiler_feed_mode", key: "boiler_feed_mode", label: "Water Feed", order: 20,
          fieldType: "select", dataType: "string", required: false,
          description: "How the boiler is filled. The generator page prints: by pump from a built-in tank, or connected directly to the mains supply.",
          options: [
            { value: "manual_tank", label: "Manual Fill (Tank)" },
            { value: "pump_from_tank", label: "Pump from Built-in Tank" },
            { value: "mains_connected", label: "Connected to Water Mains" },
            { value: "automatic", label: "Automatic Water Supply" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "irons_supported", key: "irons_supported", label: "Irons Supported", order: 30,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "How many irons one boiler can feed — printed as 'Can feed 1 or 2 steam irons'.",
          suggestions: [1, 2], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "housing_material", key: "housing_material", label: "Housing", order: 40,
          fieldType: "select", dataType: "string", required: false,
          description: "Printed as a distinct model variant: the stainless-steel housing is sold alongside the painted one.",
          options: [
            { value: "painted_steel", label: "Painted Steel" },
            { value: "stainless_steel", label: "Stainless Steel" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "iron_features", key: "iron_features", label: "Fitted Features", order: 50,
          fieldType: "multi_select", dataType: "json", required: false,
          description: "Feature bullets printed on the page. Every option below is quoted from a source; do not extend this list without one.",
          options: [
            { value: "auto_thermostat", label: "Automatic Thermostat Control" },
            { value: "heating_indicator_lamp", label: "Heating Indicator Lamp" },
            { value: "non_drip_soleplate", label: "Non-Drip Treated Soleplate" },
            { value: "visible_water_level", label: "Visible Water Level Gauge" },
            { value: "pressure_gauge", label: "Pressure Gauge" },
            { value: "safety_valve", label: "Thermostat Safety Valve" },
            { value: "auto_water_supply_led", label: "Auto Water-Supply LED" },
            { value: "waste_water_system", label: "Waste Water System" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
      ],
    },
    {
      id: "iron-performance",
      title: "Boiler & Iron Performance",
      order: 20,
      fields: [
        {
          id: "boiler_power_w", key: "boiler_power_w", label: "Boiler Power", order: 10,
          fieldType: "unit_number", dataType: "number", unit: "W", required: false,
          description: "Printed in both sources. S-001 prints ranges (6–9 kW); S-003 prints single values (1250 W, 1500 W, 2250 W).",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "iron_power_w", key: "iron_power_w", label: "Iron Power", order: 20,
          fieldType: "unit_number", dataType: "number", unit: "W", required: false,
          description: "The iron head alone, separate from the boiler. Printed 800–900 W across both sources.",
          suggestions: [800, 850, 900], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "boiler_capacity_l", key: "boiler_capacity_l", label: "Boiler Capacity", order: 30,
          fieldType: "unit_number", dataType: "number", unit: "L", required: false,
          description: "S-001 calls this 'Water volume', S-003 'Boiler capacity' — same measurement, printed 2.0–7 L.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "steam_pressure", key: "steam_pressure", label: "Steam Pressure", order: 40,
          fieldType: "unit_number", dataType: "number", unit: "bar", required: false,
          description: "S-003 only — S-001 omits it. Printed 4 bar on every model of the specialist range.",
          suggestions: [4], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "continuous_usage_hours", key: "continuous_usage_hours", label: "Usage Time per Fill", order: 50,
          fieldType: "unit_number", dataType: "number", unit: "h", required: false,
          description: "S-003 only. How long one water fill lasts — printed 3, 7 and 8 hours depending on model.",
          suggestions: [3, 6, 7, 8], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "supply_water_pressure_bar", key: "supply_water_pressure_bar", label: "Required Mains Pressure", order: 60,
          fieldType: "unit_number", dataType: "number", unit: "bar", required: false,
          description: "Only when mains-connected: 'a minimum pressure of 4 bar is required'.",
          suggestions: [4], ...pub, visualRenderType: "spec_card",
        },
      ],
    },
    electricalGroup(30),
    physicalGroup(60),
    packingShippingGroup(65),
    safetyComplianceGroup(70, [
      { value: "four_level_safety", label: "4-Level Safety System" },
      { value: "boiler_safety_valve", label: "Boiler Safety Valve" },
    ]),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   2 · COLLAR & CUFF PRESS (XFCP) — Ironing Systems
   S-001 p125 "Shirt Heat Ironing Machine Series" is the primary source: five
   printed presses sharing ONE spec table of five measured columns. The press
   TYPE is not a column — it is the printed caption under each model, so it is
   modelled as a select whose options are exactly those five captions.
   ───────────────────────────────────────────────────────────────────────── */
export const COLLAR_CUFF_PRESS_SCHEMA: ProductSchemaDefinition = {
  id: "collar-cuff-press.v1",
  name: "Collar & Cuff Press Machine",
  divisionCode: "garment-machinery",
  categoryCode: "ironing-systems",
  subcategoryCode: "XFCP",
  version: "1",
  groups: [
    {
      id: "press-configuration",
      title: "Press Configuration",
      order: 10,
      fields: [
        {
          id: "press_type", key: "press_type", label: "Press Type", order: 10,
          fieldType: "select", dataType: "string", required: false,
          description: "The five presses printed under the one series heading. Each caption is one option — this is what separates the models, and it is the field to fill first.",
          options: [
            { value: "collar_and_sleeve", label: "Collar & Sleeve Press" },
            { value: "collar_ironing", label: "Collar Ironing" },
            { value: "side_press", label: "Side Press" },
            { value: "back_seam_press", label: "Back Seam Press" },
            { value: "shirt_arm_press", label: "Shirt Arm Press" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "control_system", key: "control_system", label: "Control", order: 20,
          fieldType: "select", dataType: "string", required: false,
          description: "Every model on the page is captioned 'Computer …', i.e. programmable control rather than a timer.",
          options: [
            { value: "computer", label: "Computer / Programmable" },
            { value: "plc_touchscreen", label: "PLC + Touch Screen" },
            { value: "manual_timer", label: "Manual Timer" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "steam_source", key: "steam_source", label: "Steam Source", order: 30,
          fieldType: "select", dataType: "string", required: false,
          description: "A press with a printed steam-consumption figure has to be fed from somewhere — external boiler or a built-in generator.",
          options: [
            { value: "external_boiler", label: "External Boiler" },
            { value: "built_in_generator", label: "Built-in Steam Generator" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
      ],
    },
    {
      id: "press-performance",
      title: "Press Performance",
      order: 20,
      fields: [
        {
          id: "steam_consumption_kg_h", key: "steam_consumption_kg_h", label: "Steam Consumption", order: 10,
          fieldType: "unit_number", dataType: "number", unit: "kg/h", required: false,
          description: "Printed column '蒸汽消耗量 / Steam wastage (kg/h)' — 10 kg/h across all five printed models.",
          suggestions: [10], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "air_pressure", key: "air_pressure", label: "Air Pressure", order: 20,
          fieldType: "text", dataType: "string", unit: "MPa", required: false,
          description: "Printed column '空气压力 / Air Pressure (Mpa)'. Text, not a number: the page prints a working RANGE (0.3–0.5).",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "electric_heating_power_kw", key: "electric_heating_power_kw", label: "Electric Heating Power", order: 30,
          fieldType: "unit_number", dataType: "number", unit: "kW", required: false,
          description: "Printed column '电热功率 / Electric heating power (KW/V)' — 1.6, 3.2 and 4.8 kW across the printed models.",
          suggestions: [1.6, 3.2, 4.8], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "heating_voltage_v", key: "heating_voltage_v", label: "Heating Voltage", order: 40,
          fieldType: "unit_number", dataType: "number", unit: "V", required: false,
          description: "The second half of the same printed cell (KW/V): 220 V on most models, 380 V on the 3.2 kW one.",
          suggestions: [220, 380], ...pub, visualRenderType: "spec_card",
        },
      ],
    },
    electricalGroup(30),
    physicalGroup(60),
    packingShippingGroup(65),
    safetyComplianceGroup(70),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   3 · DOUBLE STATION HEAT PRESS (XPDH) — Printing & Heat Press
   S-003's heat-press catalogue repeats ONE table on fifteen pages, so the
   performance group below is that table, unchanged. What separates a
   double-station machine from the rest of the family is the frame and the
   drive, which the catalogue prints in the model captions.
   ───────────────────────────────────────────────────────────────────────── */
export const DOUBLE_STATION_HEAT_PRESS_SCHEMA: ProductSchemaDefinition = {
  id: "double-station-heat-press.v1",
  name: "Double Station Heat Press Machine",
  divisionCode: "garment-machinery",
  categoryCode: "printing-heat-press-equipment",
  subcategoryCode: "XPDH",
  version: "1",
  groups: [
    {
      id: "heat-press-configuration",
      title: "Heat Press Configuration",
      order: 10,
      fields: [
        {
          id: "frame_type", key: "frame_type", label: "Frame Type", order: 10,
          fieldType: "select", dataType: "string", required: false,
          description: "Printed model captions: gantry-type (龙门式) and up-sliding (上滑式) are the two double-station frames; the rotary/carousel frames are the multi-station siblings.",
          options: [
            { value: "gantry", label: "Gantry Type" },
            { value: "up_sliding", label: "Up-Sliding" },
            { value: "swing_away", label: "Swing-Away" },
            { value: "rotary_carousel", label: "Rotary Carousel" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "drive_type", key: "drive_type", label: "Drive", order: 20,
          fieldType: "select", dataType: "string", required: false,
          description: "Printed in the caption of every model: hydraulic (液压), pneumatic (气动), electric/servo (电动) or manual (手动).",
          options: [
            { value: "hydraulic", label: "Hydraulic" },
            { value: "pneumatic_drive", label: "Pneumatic" },
            { value: "electric_servo", label: "Electric / Servo" },
            { value: "manual", label: "Manual" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "station_count", key: "station_count", label: "Stations", order: 30,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "Lower stations served by the heating plate. Two for this subcategory; the catalogue also prints four-, five- and six-station siblings.",
          suggestions: [2], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "heating_plate_count", key: "heating_plate_count", label: "Heating Plates", order: 40,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "Printed as a selling point — 'single hot upper mold with double lower molds saves power', so plate count and station count are NOT the same number.",
          suggestions: [1, 2], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "heat_press_features", key: "heat_press_features", label: "Fitted Features", order: 50,
          fieldType: "multi_select", dataType: "json", required: false,
          description: "Feature bullets printed on the heat-press pages. Every option is quoted; do not extend without a printed line.",
          options: [
            { value: "digital_temp_control", label: "Digital Constant-Temperature Control" },
            { value: "segmented_temp_control", label: "Segmented Independent Temperature Control" },
            { value: "oil_heated_plate", label: "Oil-Heated Plate" },
            { value: "laser_positioning", label: "Laser Positioning" },
            { value: "infrared_positioning", label: "Infrared Positioning" },
            { value: "auto_plate_descent", label: "Automatic Plate Descent" },
            { value: "triple_thermal_protection", label: "Triple Thermal Protection" },
            { value: "photoelectric_guard", label: "Photoelectric Safety Guard" },
            { value: "dual_emergency_stop", label: "Dual Emergency Stop" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
      ],
    },
    {
      id: "heat-press-performance",
      title: "Heat Press Performance",
      order: 20,
      fields: [
        {
          id: "heating_plate_size", key: "heating_plate_size", label: "Heating Plate Size", order: 10,
          fieldType: "text", dataType: "string", unit: "cm", required: false,
          description: "Printed column '加热板尺寸 (cm/inch)'. Text because the page prints both units in one cell (e.g. 80x100 / 32x40).",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "temperature_range", key: "temperature_range", label: "Temperature Range", order: 20,
          fieldType: "text", dataType: "string", unit: "°C", required: false,
          description: "Printed column '温度范围 (℃)' — 0–299 on every model in the table.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "time_range", key: "time_range", label: "Time Range", order: 30,
          fieldType: "text", dataType: "string", unit: "s", required: false,
          description: "Printed column '时间范围 (s)' — 0–999 on every model in the table.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "max_pressure", key: "max_pressure", label: "Maximum Pressure", order: 40,
          fieldType: "text", dataType: "string", required: false,
          description: "Printed only on the hydraulic models: 'pressure of up to 35 kg/cm², suitable for hot-fix crystals and composite materials'.",
          ...pub, visualRenderType: "spec_card",
        },
      ],
    },
    electricalGroup(30),
    physicalGroup(60),
    packingShippingGroup(65),
    safetyComplianceGroup(70, [
      { value: "photoelectric_guard", label: "Photoelectric Safety Guard" },
      { value: "thermal_cutoff", label: "Heating-Plate Thermal Cut-Off" },
    ]),
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
   4 · PNEUMATIC HEAT PRESS (XPPH) — Printing & Heat Press
   Same performance table as XPDH (it is the same catalogue), plus the
   air-side numbers that only a pneumatic machine has, plus the label-work
   fields the automatic label presses print: way of working, application
   material, minimum and maximum label size.
   ───────────────────────────────────────────────────────────────────────── */
export const PNEUMATIC_HEAT_PRESS_SCHEMA: ProductSchemaDefinition = {
  id: "pneumatic-heat-press.v1",
  name: "Pneumatic Heat Press Machine",
  divisionCode: "garment-machinery",
  categoryCode: "printing-heat-press-equipment",
  subcategoryCode: "XPPH",
  version: "1",
  groups: [
    {
      id: "pneumatic-press-configuration",
      title: "Pneumatic Press Configuration",
      order: 10,
      fields: [
        {
          id: "press_head_count", key: "press_head_count", label: "Press Heads", order: 10,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "Printed captions: 'pneumatic SINGLE-head' and 'pneumatic DOUBLE-head automatic label heat press'.",
          suggestions: [1, 2], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "way_of_working", key: "way_of_working", label: "Way of Working", order: 20,
          fieldType: "select", dataType: "string", required: false,
          description: "Printed row '工作方式 / Way of working' — the automatic label press prints 'Automatic rotating'.",
          options: [
            { value: "manual", label: "Manual" },
            { value: "semi_automatic", label: "Semi-Automatic" },
            { value: "automatic_rotating", label: "Automatic Rotating" },
            { value: "sliding", label: "Sliding Table" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "station_count", key: "station_count", label: "Stations", order: 30,
          fieldType: "unit_number", dataType: "number", unit: "pcs", required: false,
          description: "Printed in captions from single up to a five-station automatic label press.",
          suggestions: [1, 2, 4, 5], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "auto_functions", key: "auto_functions", label: "Automated Steps", order: 40,
          fieldType: "multi_select", dataType: "json", required: false,
          description: "Printed as the machine's automation chain: 'AUTO LABEL SUCTION, HEAT PRESSING, FILM PEELING, MATERIAL COLLECTION'.",
          options: [
            { value: "label_suction", label: "Automatic Label Suction" },
            { value: "heat_pressing", label: "Automatic Heat Pressing" },
            { value: "film_peeling", label: "Automatic Film Peeling" },
            { value: "material_collection", label: "Automatic Material Collection" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
        {
          id: "applicable_material", key: "applicable_material", label: "Applicable Material", order: 50,
          fieldType: "multi_select", dataType: "json", required: false,
          description: "Printed row '适用材质 / Application' — 'Knitted fabric and woven fabric'.",
          options: [
            { value: "knitted", label: "Knitted Fabric" },
            { value: "woven", label: "Woven Fabric" },
            { value: "finished_garment", label: "Finished Garment" },
          ],
          ...pub, visualRenderType: "icon_chip",
        },
      ],
    },
    {
      id: "pneumatic-press-performance",
      title: "Press & Air Performance",
      order: 20,
      fields: [
        {
          id: "heating_plate_size", key: "heating_plate_size", label: "Heating Plate Size", order: 10,
          fieldType: "text", dataType: "string", unit: "cm", required: false,
          description: "Printed column '加热板尺寸 (cm/inch)' — the same table the rest of the family uses.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "temperature_range", key: "temperature_range", label: "Temperature Range", order: 20,
          fieldType: "text", dataType: "string", unit: "°C", required: false,
          description: "Printed column '温度范围 (℃)' — 0–299.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "time_range", key: "time_range", label: "Time Range", order: 30,
          fieldType: "text", dataType: "string", unit: "s", required: false,
          description: "Printed column '时间范围 (s)' — 0–999.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "air_pressure", key: "air_pressure", label: "Air Pressure", order: 40,
          fieldType: "text", dataType: "string", unit: "MPa", required: false,
          description: "Printed row '气压 / Air pressure' — 0.5 MPa. Text because pages print either a value or a working range.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "air_consumption_l_min", key: "air_consumption_l_min", label: "Air Consumption", order: 50,
          fieldType: "unit_number", dataType: "number", unit: "L/min", required: false,
          description: "Printed alongside the air pressure — 56 L/min. This is the number that sizes the workshop compressor, and no other source prints it.",
          suggestions: [56], ...pub, visualRenderType: "spec_card",
        },
        {
          id: "min_label_size", key: "min_label_size", label: "Minimum Label Size", order: 60,
          fieldType: "text", dataType: "string", unit: "mm", required: false,
          description: "Printed row '最小标尺寸 / Minimum label size' — 16x16 mm.",
          ...pub, visualRenderType: "spec_card",
        },
        {
          id: "max_label_size", key: "max_label_size", label: "Maximum Label Size", order: 70,
          fieldType: "text", dataType: "string", unit: "mm", required: false,
          description: "Printed row '最大标尺寸 / Maximum label size' — 150x150 mm.",
          ...pub, visualRenderType: "spec_card",
        },
      ],
    },
    electricalGroup(30, { motorLabel: "Drive Motor" }),
    physicalGroup(60),
    packingShippingGroup(65),
    safetyComplianceGroup(70, [
      { value: "photoelectric_guard", label: "Photoelectric Safety Guard" },
      { value: "dual_hand_control", label: "Two-Hand Control" },
    ]),
  ],
};

export const IRONING_HEATPRESS_BATCH_SCHEMAS: ProductSchemaDefinition[] = [
  STEAM_IRON_SCHEMA,
  COLLAR_CUFF_PRESS_SCHEMA,
  DOUBLE_STATION_HEAT_PRESS_SCHEMA,
  PNEUMATIC_HEAT_PRESS_SCHEMA,
];
