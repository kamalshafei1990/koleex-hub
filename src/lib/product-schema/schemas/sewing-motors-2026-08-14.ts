/**
 * XSPS · Servo Motors  and  XSPD · Direct Drive Motors — spec templates.
 *
 * The first two templates in `Spare Parts & Accessories`, which had none.
 *
 * SOURCE — S-HONGYU (弘宇 / HYO, Hongyu Taizhou Electromechanical Technology),
 * a 6-page motor specialist catalogue supplied by the owner. Image-only, no
 * extractable text; read by rendering at -r 130. It is the FIRST usable motor
 * source in the library: every earlier "motor" keyword hit was an interlock
 * sewing machine quoting its own servo, and the Koleex motor page is a photo
 * grid with no tables at all.
 *
 * ⚠️ A DIRECT DRIVE MOTOR AND A SERVO MOTOR ARE NOT TWO GRADES OF ONE THING,
 * and the two templates are shaped around the difference:
 *   · A SERVO (XSPS) hangs under the table and drives by belt. It fits any head
 *     with a pulley, so it is described by power, speed and torque alone.
 *   · A DIRECT DRIVE (XSPD) is built INTO a specific machine head. It has an
 *     `adaptable_machine_models` list — PEGASUS 600/700/800, SIRUBA 747E, JUKI
 *     6714, BROTHER C21/C31 … — and outside that list it does not fit at all.
 * That field is the whole buying question on XSPD and is meaningless on XSPS.
 *
 * ⚠️ TORQUE IS QUOTED AT A SPEED AND IS MEANINGLESS WITHOUT IT. The sheets say
 * "1.05 N.m (5000RPM)" and "1.42 N.m (3700RPM)" — the parenthetical is part of
 * the specification, not a note. A servo's torque falls as it speeds up, so
 * 1.42 N.m at 3700 rpm and 1.05 N.m at 5000 rpm may be the same motor family
 * measured at two points. Store the pair.
 *
 * VALUES OBSERVED:
 *   servo        450 / 550 / 750 / 1000 W · 200–6500 r/min (7000 on L type)
 *                3.5–3.6 N.m · 220 V ±20% or 110 V ±20% · 50/60 Hz
 *   direct drive 550 W · 100–7000 rpm (overlock) · 100–5000 rpm (lockstitch)
 *                1.05 N.m @5000 · 1.42 N.m @3700 · AC220V std, AC110V custom
 *
 * ⚠️ A THIRD MOTOR CLASS IN THIS CATALOGUE HAS NO CODE IN THE HUB. Pages 9–10
 * carry CLUTCH motors (DOL 13H series: 250–550 W, 2- or 4-pole, 1425–3450
 * r/min, with capacitance and frame diameter) and FRACTIONAL-HORSEPOWER
 * INDUCTION motors (YL 4824 series, quoting locked-rotor and holding torque
 * ratios). Neither is a servo and neither is direct drive, so filing them under
 * `XSPS` would be wrong. Recorded here as an owner decision, NOT acted on.
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

/* Both motor classes publish the same four electrical numbers; only their
   values and their meaning differ. Shared so the pair cannot drift. */
function motorRatingGroup(order: number, opts: { powerNote: string; speedNote: string; torqueNote: string }) {
  return {
    id: "motor-rating",
    title: "Motor Rating",
    order,
    fields: [
      {
        id: "rated_power_w", key: "rated_power_w", label: "Rated Power", order: 10,
        fieldType: "unit_number" as const, dataType: "number" as const, unit: "W", required: false,
        description: opts.powerNote,
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "speed_range", key: "speed_range", label: "Speed Range", order: 20,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: opts.speedNote,
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "rated_torque", key: "rated_torque", label: "Rated Torque", order: 30,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: opts.torqueNote,
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "supply_voltage", key: "supply_voltage", label: "Supply Voltage", order: 40,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: "Printed WITH its tolerance — \"220 V ±20% (110 V ±20%)\" or \"AC 220 V ±10%\". The tolerance is the specification on an export motor: a ±10% motor on a mains supply that sags 15% stops, and a ±20% one does not. Never record the nominal alone.",
        ...pub, visualRenderType: "spec_card" as const,
      },
    ],
  };
}

export const SERVO_MOTOR_SCHEMA: ProductSchemaDefinition = {
  id: "servo-motor.v1",
  name: "Servo Motor",
  divisionCode: "garment-machinery",
  categoryCode: "spare-parts-accessories",
  subcategoryCode: "XSPS",
  version: "1",
  groups: [
    {
      id: "servo-construction",
      title: "Construction & Mounting",
      order: 10,
      fields: [
        {
          id: "motor_construction", key: "motor_construction", label: "Construction", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "motor_split", label: "Split (separate control box)" },
            { value: "motor_integrated", label: "Integrated (control on motor)" },
          ],
          description: "分体式 SPLIT — motor under the table, control box mounted separately — against 一体式 INTEGRATED, where the panel sits on the motor itself. It decides where the box is drilled to the table, so a customer replacing one type with the other rebuilds the table.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "needle_positioner", key: "needle_positioner", label: "Needle Positioner", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"External needle setter\" (外置定针器) — a separate sensor clamped to the machine's handwheel that tells the motor where the needle is. Recorded because it is a SEPARATE PART that can be lost or omitted from a shipment, and without it the up/down stop function does nothing.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "energy_saving_claim", key: "energy_saving_claim", label: "Energy Saving vs Clutch", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"75% saving against a clutch motor\", and up to 71% on the integrated L type. Kept as the printed phrase WITH its baseline: a percentage saving with no stated comparator is a marketing number, and the comparator here is specifically the old clutch motor, not another servo.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    motorRatingGroup(20, {
      powerNote: "450, 550, 750 or 1000 W. It is also the model number — HY-450S is 450 W — but record it explicitly: model numbering will not survive a supplier change and the rating must.",
      speedNote: "200–6500 r/min across the S and K series; the integrated L type reaches 7000 and the sheet claims 35–100% faster than an ordinary motor. Kept as text because the LOWER bound matters as much: a motor that will not run below 200 rpm cannot creep into a corner.",
      torqueNote: "3.5 N.m on the belt-drive series, 3.6 N.m on the HY-200 system. Text rather than a number so the unit and any speed qualifier travel with the value.",
    }),
    {
      id: "servo-control",
      title: "Control & Protection",
      order: 30,
      fields: [
        {
          id: "control_loop_type", key: "control_loop_type", label: "Control Loop", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Speed and position closed-loop control.\" Closed-loop on POSITION is what makes the needle stop in the same place every time; a speed-only loop cannot promise that.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "protection_functions", key: "protection_functions", label: "Protection Functions", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Overcurrent, overvoltage, undervoltage, overheat, overload. Held as one field because the sheets list them as a set and a customer asks \"is it protected\" rather than asking about each — but the SET differs between motors, so it is copied, not assumed.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "position_feedback", key: "position_feedback", label: "Position Feedback", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Absolute value encoder, proximity switch.\" An ABSOLUTE encoder knows the needle position at power-on; an incremental one has to find it first. On a machine that stops needle-down mid-seam, that difference is visible to the operator.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "brake_type", key: "brake_type", label: "Brake", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Self-locking electronic mechanical brake\" with a \"manual release handle\". The release handle matters in practice: without it a jammed machine cannot be turned by hand to clear the thread.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "operating_temperature", key: "operating_temperature", label: "Operating Temperature", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"−10 °C to 40 °C, and 40–50 °C at HALF the rating.\" The derating clause is the important half and a bare range hides it — a 750 W motor in a 45 °C Gulf workshop is a 375 W motor.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "led_lamp_support", key: "led_lamp_support", label: "LED Lamp Support", order: 60,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"Supports external DC 5 V LED lamp, with brightness adjustment.\" The motor powers and dims the machine's work light, so a lamp bought separately has to match this supply.",
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

export const DIRECT_DRIVE_MOTOR_SCHEMA: ProductSchemaDefinition = {
  id: "direct-drive-motor.v1",
  name: "Direct Drive Motor",
  divisionCode: "garment-machinery",
  categoryCode: "spare-parts-accessories",
  subcategoryCode: "XSPD",
  version: "1",
  groups: [
    {
      id: "dd-fitment",
      title: "Machine Fitment",
      order: 10,
      fields: [
        {
          id: "adaptable_machine_models", key: "adaptable_machine_models", label: "Adaptable Machine Models", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "THE buying question for a direct drive, and it does not exist for a belt servo. The sheet prints an explicit list per motor — PEGASUS 600/700/800/EX/MX, SIRUBA 747E/747F/737/757/988, BROTHER C21/C31, JUKI 6714/6800/6814/3300, YAMATO 8403/8020/6125, KINGTEX 6000–9000, JACK 768, SHUNFA 958 — and the motor fits NOTHING outside it. Copy the list verbatim; a motor sold against a head that is not on it comes straight back.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "machine_class_fit", key: "machine_class_fit", label: "Machine Class", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "fit_overlock", label: "Overlock" },
            { value: "fit_interlock", label: "Interlock / Coverstitch" },
            { value: "fit_lockstitch", label: "Lockstitch" },
          ],
          description: "The catalogue builds a different motor for each: HY-700D overlock, HY-500D interlock, HY-8700B lockstitch. It is the coarse filter above the model list — get this wrong and the model list will never match.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    motorRatingGroup(20, {
      powerNote: "550 W across the direct-drive range read. Lower than the belt servos because a direct drive loses nothing to the belt.",
      speedNote: "100–7000 rpm on the overlock motors, 100–5000 on the lockstitch. Kept as text: the two ends are both specifications, and a lockstitch head physically cannot take the overlock motor's top speed.",
      torqueNote: "⚠️ ALWAYS QUOTED AT A SPEED — \"1.05 N.m (5000 RPM)\", \"1.42 N.m (3700 RPM)\". The parenthetical is part of the spec, not a note: torque falls as a servo speeds up, so a bare 1.42 compared against a bare 1.05 compares two different operating points and reaches the wrong answer. Store the pair.",
    }),
    {
      id: "dd-functions",
      title: "Sewing Functions",
      order: 30,
      fields: [
        {
          id: "needle_stop_function", key: "needle_stop_function", label: "Needle Stop", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Stop needle up and down\", plus \"inching needle compensation\" on the lockstitch motor. Automatic up/down stop is what removes the hand-wheel step at the end of every seam, so it is a cycle-time fact.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "slow_start_function", key: "slow_start_function", label: "Slow Start", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"Start sewing slowly\" — the motor eases into the first stitches so the thread does not snap on a heavy start. Standard on these, and worth recording because a customer replacing an old motor notices its absence immediately.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "emergency_stop_function", key: "emergency_stop_function", label: "Fault Emergency Stop", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"Fault emergency stop can effectively protect the sewing process interrupted or broken needle thread trimming knife assembly.\" It stops the machine before a broken needle takes the trimmer with it — a parts-cost feature, not a safety one.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "led_lamp_support", key: "led_lamp_support", label: "LED Lamp Support", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"External 5 V LED lamp supported\", with brightness adjustment on some models. The motor supplies the work light, so a separately bought lamp must match it.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "operation_interface", key: "operation_interface", label: "Operation Interface", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Can be equipped with a variety of operation interfaces.\" The panel is a CHOICE on these motors, so a quotation that does not name it is incomplete — the same motor ships with a segment display or a full panel at different prices.",
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

export const SEWING_MOTOR_SCHEMAS: ProductSchemaDefinition[] = [
  SERVO_MOTOR_SCHEMA,
  DIRECT_DRIVE_MOTOR_SCHEMA,
];
