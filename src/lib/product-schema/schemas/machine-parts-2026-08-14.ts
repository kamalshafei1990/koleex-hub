/**
 * XSPP · Machine Parts — spec template.
 *
 * ⚠️ THIS IS THE FIRST TEMPLATE IN THE HUB THAT IS NOT A SPEC TEMPLATE, AND THE
 * DIFFERENCE IS THE WHOLE POINT.
 *
 * SOURCE — `2025杰克零件手册` (JACK Spare Parts Catalogue), 82 pages, image-only,
 * surfaced by the cover triage of the 50 unread image-only files. Its directory
 * page is a clean printed taxonomy: 22 spare-part classes and 16 accessory
 * classes, which is where `part_class` below comes from — it is transcribed, not
 * invented.
 *
 * WHAT A PARTS CATALOGUE ACTUALLY PRINTS. Every one of the several hundred
 * entries carries exactly THREE lines and no more:
 *
 *     名称 / Description : Presser Foot (Heavy Duty)
 *     代码 / Part NO.    : 12121605400
 *     适配 / Machine Type: 798D/E4/E4S/C4/C5/C5S/C7-BK
 *
 * **No dimensions. No materials. No weights. No tolerances. Nothing measurable
 * at all.** Eighty-two pages and not one number that a spec field could hold.
 *
 * That is not a deficiency in the catalogue — it is what a part IS. **A machine
 * is defined by what it does; a part is defined by WHAT IT FITS.** A presser foot
 * has no performance to quote; its entire value is the list of machines it will
 * bolt onto, and a buyer searching for one searches by machine model, never by
 * millimetre. So this template is built around `compatible_machine_models`, and
 * the physical fields that carry every other template are absent by design.
 *
 * ⚠️ DO NOT "IMPROVE" THIS BY ADDING DIMENSIONS OR MATERIAL. Nothing in the
 * source prints them, and a field invented here gets filled with a guess and is
 * then wrong forever — the same rule that keeps `XSBL` blindstitch empty and
 * that stopped an ultrasonic frequency being invented for `XFSS`.
 *
 * THE SAME SHAPE SERVES THE OTHER THREE GAPS. `Spare Parts & Accessories` has
 * six codes: `XSPS` servo motors and `XSPD` direct drives were built from
 * S-HONGYU and are genuine spec templates, because a motor DOES publish torque
 * and speed. The remaining three — `XSPA` attachments & folders, `XSPC` control
 * panels, `XSPT` touch screens — are fitment products like this one. They are
 * NOT built here: control panels and touch screens will carry electrical and
 * display specs this catalogue does not print, and guessing which would repeat
 * the mistake above.
 *
 * ⚠️ THE GAP TABLE SAID 6 CODED / 0 TEMPLATED. IT WAS STALE — `XSPS` and `XSPD`
 * had already landed. Re-measure before quoting a gap.
 *
 * VALUES OBSERVED: part numbers 8 and 10 digits (2081600700, 30116006) ·
 * fitment strings from a single model ("798T") to a fourteen-model list
 * ("C3/C4/E4S/C5/C5S/C6/C8/C7-M04/435") · duty qualifiers 薄料 light / 厚料
 * heavy / 70款 "70 type" · thread groupings 4 / 5 / 6 thread and interlock.
 */

import type { ProductSchemaDefinition } from "@/types/product-schema";
import { DEFAULT_PUBLIC_VISIBILITY } from "../visibility";
import {
  packingShippingGroup,
  physicalGroup,
} from "./_shared-machine-groups";

const pub = DEFAULT_PUBLIC_VISIBILITY;

export const MACHINE_PARTS_SCHEMA: ProductSchemaDefinition = {
  id: "machine-parts.v1",
  name: "Sewing Machine Part",
  divisionCode: "garment-machinery",
  categoryCode: "spare-parts-accessories",
  subcategoryCode: "XSPP",
  version: "1",
  groups: [
    {
      id: "part-identity",
      title: "Part Identity",
      order: 10,
      fields: [
        {
          id: "part_class", key: "part_class", label: "Part Class", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "part_bobbin_case", label: "Bobbin / Bobbin Case" },
            { value: "part_hook", label: "Hook" },
            { value: "part_presser_foot", label: "Presser Foot" },
            { value: "part_needle_plate", label: "Needle Plate" },
            { value: "part_feed_dog", label: "Feed Dog" },
            { value: "part_knife_set", label: "Knives / Needle Protecting Patch" },
            { value: "part_blade", label: "Knife / Blade" },
            { value: "part_looper", label: "Looper" },
            { value: "part_needle_clamp", label: "Needle Clamp" },
            { value: "part_needle_bar", label: "Needle Bar" },
            { value: "part_needle_gauge_set", label: "Needle Gauge Set" },
            { value: "part_thread_tension", label: "Thread Tension" },
            { value: "part_bobbin_winder", label: "Bobbin Winder" },
            { value: "part_solenoid", label: "Solenoid" },
            { value: "part_overlock_conrod", label: "Overlock Connecting Rod" },
            { value: "part_thread_trimmer_asm", label: "Thread Trimmer Assembly" },
            { value: "part_upper_looper_holder", label: "Upper Looper Holder Assembly" },
            { value: "part_led_switch", label: "LED & Switch" },
            { value: "part_sensor", label: "Sensor" },
            { value: "part_thread_takeup", label: "Thread Take-up" },
            { value: "part_thread_stand", label: "Thread Stand" },
            { value: "part_auxiliary_device", label: "Auxiliary Device" },
          ],
          description: "The twenty-two classes printed in the source catalogue's own directory, transcribed rather than invented. Pick the class before anything else: it is what a mechanic searches by, and it is the only field on a part that behaves like a category.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "manufacturer_part_number", key: "manufacturer_part_number", label: "Manufacturer Part Number", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "The maker's own code — 8 or 10 digits in this catalogue (2081600700, 30116006). Enter it EXACTLY, including leading zeros: it is the string a customer quotes down the phone and the only key that matches a Koleex line to a supplier invoice. It is not a KOLEEX code and never becomes one.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "part_variant", key: "part_variant", label: "Variant / Duty", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "The qualifier printed in brackets after the name — 薄料 light duty, 厚料 heavy duty, 70款 \"70 type\". Two parts can share a name, a class and nearly the same part number and differ only here, so a record without it is ambiguous exactly where it matters.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "part-fitment",
      title: "Fitment",
      order: 20,
      fields: [
        {
          id: "compatible_machine_models", key: "compatible_machine_models", label: "Compatible Machine Models", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "⭐ THE FIELD THIS WHOLE TEMPLATE EXISTS FOR. Printed as 适配 / Machine Type, and it runs from a single model (\"798T\") to a fourteen-model list (\"C3/C4/E4S/C5/C5S/C6/C8/C7-M04/435\"). Copy the printed string whole, separators and all — do not tidy it, do not split it, and do not drop the tail after a dash: \"C7-M04/435\" is a different fit from bare \"C7\". A part with this field blank cannot be sold, because nobody can tell what it goes on.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "fitment_scope", key: "fitment_scope", label: "Fitment Scope", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "fitment_single_model", label: "Single Model" },
            { value: "fitment_model_series", label: "Model Series" },
            { value: "fitment_cross_brand", label: "Cross-Brand / Universal" },
          ],
          description: "How wide the list above reaches. It is the commercial fact hiding inside a fitment string: a part that fits one model is a service item held for one customer, and a part that fits a whole series is stock that turns. Read it off the printed list rather than assuming — a long list of models from one series is still one series.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "thread_count_fitment", key: "thread_count_fitment", label: "Thread Count (Fitment Group)", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "thread_group_4", label: "4 Thread" },
            { value: "thread_group_5", label: "5 Thread" },
            { value: "thread_group_6", label: "6 Thread" },
            { value: "thread_group_interlock", label: "Interlock / Coverstitch" },
          ],
          description: "⚠️ These values are `thread_group_*`, NOT the `fit_*` family — `o:fit_interlock` already exists on the motor templates meaning \"fits an interlock MACHINE\", which is a different claim from \"belongs to the interlock section of a parts book\". A shared value is only shared if the meaning is shared. The catalogue groups overlock and interlock parts under 四线/五线/六线 headings before it lists them, because a 5-thread foot will not serve a 4-thread machine. Leave BLANK on a lockstitch part — the grouping only exists where thread count changes the fit, and a value here on a part that has none is noise.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "oem_status", key: "oem_status", label: "OEM / Aftermarket", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "part_oem_original", label: "OEM / Original" },
            { value: "part_aftermarket", label: "Aftermarket" },
          ],
          description: "This catalogue is a maker's own parts book, so everything in it is original. Recorded anyway because the same part class is sold both ways at very different prices, and a parts line that cannot say which is a warranty argument waiting to happen.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    physicalGroup(30),
    packingShippingGroup(40),
  ],
};

export const MACHINE_PARTS_SCHEMAS: ProductSchemaDefinition[] = [MACHINE_PARTS_SCHEMA];
