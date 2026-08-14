/**
 * XPHR · Rotary Heat Press Machines  and  XPH · Heat Press Machines
 * — spec templates.
 *
 * `Printing & Heat Press` has SEVEN coded subcategories (the gap memo said six —
 * re-measure) and had two templates, `XPPH` pneumatic and `XPDH` double-station.
 * This closes two more. Still open: `XPDT` digital textile (DTG), `XPSP` screen
 * printing, `XPSU` sublimation printers.
 *
 * ⚠️ THE LIVE CATEGORY SLUG IS `printing-heat-press-equipment`, NOT
 * `printing-heat-press`. This file was written with the shorter one and both
 * templates resolved to NOTHING when probed with the slug the DB actually
 * stores — `ProductForm` passes `product.category_slug` straight through, so a
 * category code that is one word off is a template that silently never appears.
 * Caught by probing `resolveSchema` with the DB's own slug BEFORE committing.
 * The check that finds it: schema `categoryCode` values minus live category
 * slugs must be the empty set.
 *
 * SOURCE — `KILO (麒龙) 2024`, 36 pages, image-only, from the cover triage.
 * Pages 33–44 carry dozens of models under **two different table shapes**, and
 * that is exactly why this is two templates and not one:
 *
 *   ROLLER (pages 33–36)  规格CM · 功率KW · 工作台尺寸m · 电压V ·
 *                         工作压力kg/cm² · 定时关机h · 温度范围°C · 包装尺寸
 *   MANUAL (pages 37–44)  加热板尺寸cm/inch · 电压V · 功率kw ·
 *                         温度范围°C · 时间范围s · 重量kg · 包装尺寸
 *
 * **The two sheets share only voltage and packing size.** A roller machine is
 * specified by pressure and table length because material runs THROUGH it
 * continuously; a flat press is specified by plate size and dwell time because
 * material sits IN it. Forcing both into one template would leave half the
 * fields blank on every product and would hide that difference.
 *
 * ⚠️ THE ROLLER'S "规格(CM)" COLUMN IS NOT A PLATE SIZE. It prints `60*190`,
 * `80*320`, `120*190` — that is **drum diameter × working width in cm**, not a
 * bed. Reading it as a plate size makes a 120 cm drum look like a 120 cm platen,
 * which is the wrong machine by an order of magnitude in throughput.
 *
 * ⚠️ THE TWO CLASSES HAVE DIFFERENT TEMPERATURE CEILINGS AND IT IS NOT A TYPO.
 * Roller machines print **0–399 °C**, flat presses **0–299 °C**, consistently
 * across every model on every page. A 399 on a flat-press row, or a 299 on a
 * roller row, means the row was read off the wrong table.
 *
 * ⚠️ THE FLAT PRESS PRINTS PLATE SIZE TWICE, IN TWO UNITS: `38x38 / 15x15` is
 * centimetres THEN inches, `100x120 / 40x48` likewise. Both belong in the field;
 * dropping the inches loses the number the trade actually quotes, and dropping
 * the centimetres loses the one that matches the packing size.
 *
 * VALUES OBSERVED:
 *   ROLLER  20×120 → 120×190 cm · 6–120 kW · table 1.5 / 2.65 / 3.35 m
 *           0–8 kg/cm² · timed shutdown 0–4 h · 0–399 °C · 220/380 V
 *           oil-heated stainless pipe, ~200 °C in 45 min · 10 mm blanket
 *           Teflon-plated drum · conveyor belt for proofing AND batch work
 *   FLAT    plate 8×15 → 100×120 cm (3.2×6 → 40×48 in) · 0.3–12 kW
 *           0–299 °C · time 0–999 s · 6–230 kg · 110/220/380 V
 *           forms: flat · mug (11/20/30 oz) · cap · label
 *           multi-function 5-in-1 · 8-in-1 · 11-in-1 (swappable platens)
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

export const ROTARY_HEAT_PRESS_SCHEMA: ProductSchemaDefinition = {
  id: "rotary-heat-press.v1",
  name: "Rotary / Roller Heat Transfer Machine",
  divisionCode: "garment-machinery",
  categoryCode: "printing-heat-press-equipment",
  subcategoryCode: "XPHR",
  version: "1",
  groups: [
    {
      id: "roller-transfer",
      title: "Roller & Transfer",
      order: 10,
      fields: [
        {
          id: "roller_specification", key: "roller_specification", label: "Roller Specification (⌀ × Width)", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "⚠️ Printed as \"规格(CM)\" — 20*120, 60*190, 120*190 — and it is **drum diameter × working width in centimetres, NOT a plate size**. Read as a platen it makes a 120 cm drum look like a 120 cm bed, which is the wrong machine by an order of magnitude in throughput. The first number sets the contact area and therefore the dwell at a given speed; the second sets the widest roll the machine will take.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "table_size", key: "table_size", label: "Table Size", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "1.5, 2.65 or 3.35 metres — printed in METRES while everything else on the sheet is centimetres. Only three values across the whole range, so it is effectively a frame class: the table is what supports the fabric on its way in and out, and it decides the floor space long before the drum does.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "temperature_range", key: "temperature_range", label: "Temperature Range", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "0–399 °C on every roller model. ⚠️ The flat presses in the same catalogue print 0–299 °C — a 299 in this field means the row was read off the manual-press table instead. The heating is oil through a stainless pipe, and the sheet claims about 200 °C in 45 minutes, so the warm-up is a real production cost worth recording alongside the ceiling.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "working_pressure", key: "working_pressure", label: "Working Pressure", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "0–8 kg/cm², pneumatically applied through a silicone roller. This field exists on the roller sheet and NOT on the flat-press sheet, because a flat press applies force by a lever the operator pulls and never publishes a figure for it. Pressure and speed trade against each other on a continuous machine — the catalogue says higher pressure lets it run faster with more vivid colour.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "timed_shutdown", key: "timed_shutdown", label: "Timed Shutdown", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "0–4 hours. An unattended-running feature, not a safety cut-out: the machine finishes a roll and switches itself off. On a machine that takes 45 minutes to reach temperature, the shutdown timer is what makes a night shift viable.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "blanket_specification", key: "blanket_specification", label: "Blanket", order: 60,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Raw materials blanket with the thickness of 10 mm\" — the felt belt that presses the transfer paper against the drum. It is a CONSUMABLE and the catalogue sells its thickness as the reason for both transfer quality and service life, so it belongs on the record rather than in a footnote.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "drum_surface_treatment", key: "drum_surface_treatment", label: "Drum Surface Treatment", order: 70,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"The drum adopts Teflon-plated technology, which has strong hardness, wear resistance, anti-sticking.\" Anti-stick is the working property: dye-sublimation ink that grips the drum transfers onto the NEXT metre of fabric, so this is a defect-rate fact rather than a finish.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "conveyor_belt_fitted", key: "conveyor_belt_fitted", label: "Conveyor Belt", order: 80,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "standard", label: "Standard" },
            { value: "optional", label: "Optional" },
          ],
          description: "\"Increase conveyor belt device, that is, proofing, but also batch production, a dual-purpose.\" With the belt the same machine runs single proofs and continuous rolls; without it, it is a roll machine only. That is a purchasing decision, which is why it is a field rather than a feature bullet.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "over_temperature_alarm", key: "over_temperature_alarm", label: "Over-Temperature Alarm", order: 90,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "standard", label: "Standard" },
            { value: "optional", label: "Optional" },
          ],
          description: "\"Automatic alarm device can display the current temperature. If the temperature overpasses the set temperature, it will output signal promptly.\" On an oil-heated machine running unattended to a 4-hour timer, this is the only thing standing between an overshoot and a fire.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    electricalGroup(20),
    physicalGroup(30),
    packingShippingGroup(40),
    safetyComplianceGroup(50),
  ],
};

export const HEAT_PRESS_SCHEMA: ProductSchemaDefinition = {
  id: "heat-press.v1",
  name: "Heat Press Machine",
  divisionCode: "garment-machinery",
  categoryCode: "printing-heat-press-equipment",
  subcategoryCode: "XPH",
  version: "1",
  groups: [
    {
      id: "press-platen",
      title: "Platen & Cycle",
      order: 10,
      fields: [
        {
          id: "heating_plate_size", key: "heating_plate_size", label: "Heating Plate Size", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "⚠️ PRINTED TWICE, IN TWO UNITS: \"38x38 / 15x15\" is centimetres then inches; \"100x120 / 40x48\" likewise. **Record both.** The inch pair is what the trade quotes and what transfer paper is sold in; the centimetre pair is what matches the packing size on the same row. Dropping either loses a number somebody will need. Range across the catalogue: 8×15 cm (3.2×6 in) to 100×120 cm (40×48 in).",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "temperature_range", key: "temperature_range", label: "Temperature Range", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "0–299 °C on every flat press in the catalogue. ⚠️ The roller machines print 0–399 °C — a 399 in this field means the row came off the roller table. The ceiling is lower because a flat press holds the work still and has time; a roller has to reach transfer temperature in the seconds the fabric is in contact.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "time_range", key: "time_range", label: "Time Range", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "0–999 SECONDS. This field is the flat press's equivalent of the roller's speed, and it is the one the operator actually sets per job: temperature is a property of the material, dwell is a property of the job. Note the unit — the roller sheet's comparable column is a shutdown timer in HOURS, which is a different thing entirely.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "press_form_factor", key: "press_form_factor", label: "Press Form", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "press_form_flat", label: "Flat Platen" },
            { value: "press_form_mug", label: "Mug / Cup" },
            { value: "press_form_cap", label: "Cap" },
            { value: "press_form_label", label: "Label / Small Format" },
            { value: "press_form_vertical", label: "Vertical Garment Insert" },
          ],
          description: "The catalogue's forms, and they are different machines sharing a controller rather than options: a mug press is a curved clamp quoted in OUNCES (11, 20, 30 oz) with no plate dimension at all, a cap press has a curved lower platen, and the vertical type takes a finished T-shirt over a post. A mug press row with a cm plate size in it has been mis-entered.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "press-mechanism",
      title: "Mechanism & Configuration",
      order: 20,
      fields: [
        {
          id: "press_actuation", key: "press_actuation", label: "Actuation", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "press_act_manual", label: "Manual Lever" },
            { value: "press_act_semi_auto", label: "Semi-Auto (magnetic, auto-open)" },
            { value: "press_act_swing", label: "Swing-Away Head" },
          ],
          description: "Manual lever, or SEMI-AUTO where a magnetic catch releases and the head opens itself when the timer ends. Auto-open is what stops a scorched garment when the operator turns away, so it is a quality control rather than a comfort feature. ⚠️ A fully PNEUMATIC press is a different subcategory — XPPH — and does not belong here.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "base_configuration", key: "base_configuration", label: "Base Configuration", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "press_base_fixed", label: "Fixed" },
            { value: "press_base_slide_out", label: "Slide-Out Drawer" },
            { value: "press_base_double_station", label: "Double Station" },
          ],
          description: "\"With slide-out base\" appears in half the model names, because pulling the lower platen out from under a 299 °C head is how the operator loads without reaching under it. ⚠️ A true DOUBLE-STATION press — two beds sharing one head — is coded separately as XPDH; the value here is for a press that merely offers the second bed as a variant.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "heating_plate_coating", key: "heating_plate_coating", label: "Heating Plate Coating", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Teflon heating plate\" is called out in the model names of the H series and nowhere else, so it is a real variant rather than a universal. A coated plate releases transfer film without a cover sheet; an uncoated one needs one, which is a consumable the customer then buys forever.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "multi_function_kit", key: "multi_function_kit", label: "Multi-Function Kit", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed as 5-in-1, 8-in-1 and 11-in-1 — ONE press shipped with a set of swappable platens (flat, mug in several diameters, cap, plate). Record the printed count: it is the difference between one machine and five, and the price follows the accessories rather than the press. Leave BLANK on a single-purpose press rather than entering 1.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    electricalGroup(30),
    physicalGroup(40),
    packingShippingGroup(50),
    safetyComplianceGroup(60),
  ],
};

export const HEAT_PRESS_SCHEMAS: ProductSchemaDefinition[] = [
  ROTARY_HEAT_PRESS_SCHEMA,
  HEAT_PRESS_SCHEMA,
];
