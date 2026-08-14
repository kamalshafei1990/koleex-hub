/**
 * XFSS · Seam Sealing & Bonding — spec template.
 *
 * `Finishing Equipment` had five coded subcategories and three templates. This
 * closes one of the two gaps; `XFWM` Washing Machines is the other and still has
 * no source.
 *
 * SOURCE — `中性款.pdf`, 8 pages, image-only, found by the cover triage of the 50
 * unread image-only catalogues (`docs/product-data-v2/reference-data/
 * image-only-catalog-triage.md`). Every machine on every page carries a full
 * printed spec table, which is why this was built before the other four leads.
 *
 * ⚠️ THE CATALOGUE HAS NO MAKER NAME ON ANY PAGE. `中性款` means "neutral
 * edition" — an unbranded catalogue a trader prints its own cover onto. The DL
 * model codes are therefore **generic to the trade, not one supplier's range**,
 * and two suppliers may ship the same DL8601 with different internals. Only the
 * FIELDS are taken from it.
 *
 * ⚠️ THE THREE SEALERS ARE ONE FRAME AT THREE SPEEDS, AND THE SPEED IS THE ONLY
 * THING THAT MOVES. DL8601 (flat), DL8602 (horizontal cylinder) and DL8603 (shoe)
 * all print 3 kW, 700 °C, the same tape range and 123–128 kg — but the shoe
 * machine runs **1–16 m/min against the other two's 1–40**. It is not a slower
 * build; it seals a curved shoe seam where the others run a straight garment one.
 * **A throughput figure recorded without `machine_configuration` is not
 * comparable to another machine's**, which is why that field is first.
 *
 * ⚠️ THIS TEMPLATE SERVES A METHOD THAT HAS NO SHEET HERE. The subcategory holds
 * two Machine Kinds — Heat-Seam Sealing and **Ultrasonic Bonding** — and this
 * catalogue prints only hot-air machines. `bonding_method` therefore exists so an
 * ultrasonic machine can be filed and its shared facts recorded, but **no
 * ultrasonic-specific field (horn frequency, amplitude, anvil pattern) is
 * invented here**. Those wait for a printed ultrasonic sheet, exactly as `XSBL`
 * blindstitch waits for one.
 *
 * NOT IN THIS TEMPLATE, deliberately: the DL3540 / DL3560 / DLR200 hot-and-cold
 * dual-mode presses printed in the same catalogue. They press, they do not seal a
 * seam, and they belong to Printing & Heat Press — which already has templates.
 *
 * VALUES OBSERVED:
 *   AC 220 V 50/60 Hz · 3 kW · stepless room temp → 700 °C · ±1 °C with
 *   over-temperature alarm · 1–40 m/min (1–16 shoe) · 0.35–0.5 MPa
 *   pressure wheel 25 mm standard, 20/28/35/55 custom · tape 10–25 mm
 *   upper roller lift 10–30 mm · dual 86–110 stepper motors
 *   1200×540×1550 mm · packing 1230×620×1600 mm · 123–128 kg
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

export const SEAM_SEALING_SCHEMA: ProductSchemaDefinition = {
  id: "seam-sealing.v1",
  name: "Seam Sealing & Bonding Machine",
  divisionCode: "garment-machinery",
  categoryCode: "finishing-equipment",
  subcategoryCode: "XFSS",
  version: "1",
  groups: [
    {
      id: "seal-process",
      title: "Sealing Process",
      order: 10,
      fields: [
        {
          id: "bonding_method", key: "bonding_method", label: "Bonding Method", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "bond_hot_air", label: "Hot Air" },
            { value: "bond_ultrasonic", label: "Ultrasonic" },
            { value: "bond_heat_seal", label: "Heat Seal / Contact" },
          ],
          description: "Fill this FIRST — it decides which of the fields below mean anything. A hot-air machine melts an adhesive tape onto the seam and is described by temperature and tape width; an ultrasonic machine welds the fabric to itself with vibration and has neither. Only the hot-air machines are printed in the source catalogue, so an ultrasonic entry will leave several fields blank, and blank is the correct record.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "machine_configuration", key: "machine_configuration", label: "Machine Configuration", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "seal_config_flat", label: "Flat / Standard" },
            { value: "seal_config_cylinder", label: "Horizontal Cylinder" },
            { value: "seal_config_shoe", label: "Shoe Machine" },
          ],
          description: "The three machines share a frame, a power rating and a temperature range and differ HERE — flat for garment panels, horizontal cylinder for tubular work such as a sleeve, shoe for a lasted upper. Read it together with the sealing speed: the shoe model runs at a quarter of the flat model's rate, and without this field the two speeds look like a quality difference instead of two different jobs.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "sealing_speed", key: "sealing_speed", label: "Sealing Speed", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "1–40 m/min on the flat and cylinder machines, 1–16 m/min on the shoe machine. In METRES PER MINUTE, not stitches — nothing here sews, so a rpm figure in this field means the wrong machine was entered. Keep the printed range: the low end is as much a specification as the high one, because a thick laminate has to be run slowly enough to melt through.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_temperature", key: "max_temperature", label: "Maximum Temperature", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed as \"无段可调，常温～700°C\" — steplessly adjustable from ambient to 700 °C. Record the phrase, not just 700: the fact that it is STEPLESS rather than switched is what lets one machine handle both a delicate laminate and a heavy waterproof, and a machine with fixed steps is a different proposition at the same peak figure.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "temperature_control_accuracy", key: "temperature_control_accuracy", label: "Temperature Control", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"±1 °C fluctuation, with over-temperature alarm protecting the heating tube.\" On a machine whose entire job is melting adhesive to a precise temperature, the TOLERANCE is the specification and the peak is only its ceiling. The alarm is worth recording separately — it is what stops a stalled machine from burning the tube.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "working_air_pressure", key: "working_air_pressure", label: "Working Air Pressure", order: 60,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "0.35–0.5 MPa across the family. Kept as the printed phrase, consistent with every other pneumatic machine in the Hub.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "seal-tape-rollers",
      title: "Tape & Rollers",
      order: 20,
      fields: [
        {
          id: "tape_width_range", key: "tape_width_range", label: "Tape Width Range", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "10–25 mm standard, with 10–25 mm quoted again as an optional extra — the catalogue prints both, so record what the sheet says rather than tidying it. This is the CONSUMABLE the machine is bought around: a factory already stocking 22 mm tape cannot use a machine that stops at 20.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "pressure_wheel_width", key: "pressure_wheel_width", label: "Pressure Wheel Width", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "25 mm standard, customisable to 20, 28, 35 or 55 mm. Distinct from tape width and easy to confuse with it: the tape is the material laid down, the wheel is the tool that presses it. A wheel narrower than the tape leaves the edges unbonded.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "upper_roller_lift", key: "upper_roller_lift", label: "Upper Roller Lift", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "10–30 mm — how far the top roller rises to admit the work. It is this class's equivalent of a presser foot lift, and it sets the maximum assembled thickness the machine will take.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "tape_feed_system", key: "tape_feed_system", label: "Tape Feed System", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Triple air-blow function added for tape feeding, ensuring stable feeding of adhesive tapes\", with automatic feeding, cutting and tail sealing. Adhesive tape sticks to everything including the machine, so how it is transported is a real differentiator rather than a feature list entry.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "auto_tape_cutting", key: "auto_tape_cutting", label: "Automatic Tape Cutting", order: 50,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "standard", label: "Standard" },
            { value: "optional", label: "Optional" },
          ],
          description: "\"Automatic tape cutting by fixed length: 8 built-in length-setting pages for cyclic operation per process needs, saving tape costs.\" Tape is the running cost of this machine, so cutting to length rather than by eye is what the payback argument rests on.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "roller_drive_motors", key: "roller_drive_motors", label: "Roller Drive Motors", order: 60,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Dual 86–110 stepper motors: synchronized torque for upper/lower rollers.\" Two motors held in sync rather than one driving through a linkage — that is what keeps the top and bottom of the seam travelling at the same rate, and a mismatch there is the classic cause of a puckered seal.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "seal-control-frame",
      title: "Control & Frame",
      order: 30,
      fields: [
        {
          id: "control_interface", key: "control_interface", label: "Control Interface", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"PLC-based high-clarity touchscreen shows speed, temperature and operation parameters\", with a USB port for system upgrades. The USB is worth recording: it is the difference between a machine that can receive a firmware fix and one that cannot.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "nozzle_adjustment", key: "nozzle_adjustment", label: "Nozzle Adjustment", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "360° adjustable hot-air nozzle on a double link swing arm. The nozzle angle is how the operator follows a curve; on the shoe machine it is the whole reason the model exists.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "air_intake_filtration", key: "air_intake_filtration", label: "Air Intake Filtration", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "standard", label: "Standard" },
            { value: "optional", label: "Optional" },
          ],
          description: "\"Unique heating tube structure with filtered air intake to prevent moisture and oil entry.\" Compressed-air lines in a garment factory carry both; either one reaching a 700 °C tube shortens its life sharply, so this is a maintenance-cost fact, not a comfort feature.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "frame_height_adjustable", key: "frame_height_adjustable", label: "Height-Adjustable Frame", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "standard", label: "Standard" },
            { value: "optional", label: "Optional" },
          ],
          description: "\"Height-adjustable frame: wider user adaptability, customizable height for comfortable operation.\" Paired in the source with dual-foot-pedal control and printed as an ergonomic pair — this is a machine an operator stands at for a full shift.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "foot_pedal_control", key: "foot_pedal_control", label: "Foot Pedal Control", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Ergonomic dual-foot pedal control.\" Two pedals, because both hands are guiding the seam past the nozzle and nothing is left to operate the machine with.",
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

export const SEAM_SEALING_SCHEMAS: ProductSchemaDefinition[] = [SEAM_SEALING_SCHEMA];
