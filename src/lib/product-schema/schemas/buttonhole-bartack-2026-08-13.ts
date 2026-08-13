/**
 * XABH · Buttonhole Machines  and  XABT · Bartacking Machines — spec templates.
 *
 * Templates five and six in `Automatic Sewing Systems`, after XAPT / XAPW /
 * XAPP / XAPS. Both subcategories rendered a form with no fields until now.
 *
 * ⚠️ I PREVIOUSLY CONCLUDED THESE TWO HAD NO SOURCE, AND THAT WAS WRONG-BY-METHOD.
 * A keyword scan of 75 catalogues reported 8 "buttonhole" and 6 "bartack"
 * sources; I opened the two with the highest counts (Feiyue — a HOUSEHOLD
 * catalogue where "buttonhole" is a stitch function; Durkopp Adler — a 2009
 * program index with no tables) and dismissed the whole class on that basis.
 * The conclusion happened to hold for those 75 files, but the reasoning did
 * not: I generalised from the top two by count. Re-checked properly afterwards
 * against every candidate and both Chinese terms (锁眼机 / 套结机): 衬衫's
 * "buttonhole" pages are FUSING PRESSES, Sewpower's "bartack" pages are
 * INTERLOCK machines quoting a bought-in head, Bote's are section covers.
 *
 * SOURCE — S-GEMSY (SGGEMSY, Zhejiang Shanggong Gem Sewing Technology), 20-page
 * European catalogue, found in a Drive subfolder and NOT among the 75 local
 * files. It carries exactly the two machines nothing else had:
 *   XABH  SG 1790 SERIES — 6 models (1790A/1791A/1795A × S/K)
 *   XABT  SG 1900B SERIES — 11 models (1900B/1943B/1964B/1965B × JS/JH/JM/JF/JB)
 *
 * ⚠️ ITS SPEC TABLES ARE IMAGES, NOT TEXT. pdftotext returns the descriptions
 * and the model-code legend but NOTHING of the numbers — a text-only reading
 * would have declared this catalogue specless too. The tables were read by
 * rendering pages 17 and 19 to PNG and looking at them. Column headers are
 * PICTOGRAMS with no words; the front-of-book icon legend is what names them
 * (needle specification, stitch length, height of presser lift, speed, weight,
 * dimensions, button size, buttonhole gauge, power, single/double moving
 * knife...). Anyone extending these templates must render, not grep.
 *
 * VALUES READ FROM THE PRINTED TABLES:
 *   XABH  buttonhole length 25 / 70 / 120 mm · speed 4200 rpm
 *         needle bar stroke 34.6 mm · presser lift 14 mm (auto)
 *         needle DBX5 #11 (weavon) · DBX5KN #11 (knitted)
 *         550 W · 780×390×840 mm · 57/76 kg net/gross
 *   XABT  sewing area 30×40 / 40×30 / 60×40 / 60×50 mm · speed 3200 rpm
 *         needle bar stroke 41.2 mm · stitch length 0.1–10 mm · lift 14 mm
 *         needle DBX5 #14/#11, DBX17 #16/#21 · 550 W
 *         805×370×725 mm · 56/68 kg net/gross
 *
 * WHAT IS DELIBERATELY NOT HERE — the duty suffix. SG1900B-JH is "heavy duty"
 * and that is the `fabric_weight_class` FACET reaching the form through the
 * Machine Kind (CL-0020), not a field. JM knitted / JF underwear / XJ elastic
 * band are application variants of the same machine and belong to the model's
 * application text, not to a re-minted duty field.
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

/* Both classes are lockstitch heads driving a clamped work area, so the head
   block is identical apart from its numbers. Shared so they cannot drift. */
function headAndStitchGroup(order: number, opts: { speedNote: string; strokeNote: string; needleNote: string }) {
  return {
    id: "head-stitch",
    title: "Sewing Head & Stitch",
    order,
    fields: [
      {
        id: "max_sewing_speed", key: "max_sewing_speed", label: "Max Sewing Speed", order: 10,
        fieldType: "unit_number" as const, dataType: "number" as const, unit: "rpm", required: false,
        description: opts.speedNote,
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "needle_bar_stroke", key: "needle_bar_stroke", label: "Needle Bar Stroke", order: 20,
        fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
        description: opts.strokeNote,
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "needle_system", key: "needle_system", label: "Needle System", order: 30,
        fieldType: "text" as const, dataType: "string" as const, required: false,
        description: opts.needleNote,
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "presser_foot_lift", key: "presser_foot_lift", label: "Presser Foot Lift", order: 40,
        fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
        description: "14 mm on every model of both series, and the pictogram marks it AUTO — the foot lifts under program control, which is what lets the operator load with both hands.",
        ...pub, visualRenderType: "spec_card" as const,
      },
      {
        id: "auto_thread_trimmer", key: "auto_thread_trimmer", label: "Thread Trimmer", order: 50,
        fieldType: "select" as const, dataType: "string" as const, required: false,
        options: FITMENT_OPTIONS,
        description: "Marked ★ (standard) on every model of both series. Recorded rather than assumed, because a star on one sheet is not a star on the next supplier's.",
        ...pub, visualRenderType: "spec_card" as const,
      },
    ],
  };
}

export const BUTTONHOLE_SCHEMA: ProductSchemaDefinition = {
  id: "buttonhole.v1",
  name: "Buttonhole Machine",
  divisionCode: "garment-machinery",
  categoryCode: "automatic-sewing-systems",
  subcategoryCode: "XABH",
  version: "1",
  groups: [
    {
      id: "buttonhole-work",
      title: "Buttonhole Capability",
      order: 10,
      fields: [
        {
          id: "buttonhole_length_max", key: "buttonhole_length_max", label: "Max Buttonhole Length", order: 10,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "25 mm (SG1790), 70 mm (SG1791) or 120 mm (SG1795) — the ONLY number that separates the three models in the series, and the one a buyer matches to their garment. A 120 mm machine buttonholes a coat front; a 25 mm machine does not.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "presser_foot_length", key: "presser_foot_length", label: "Presser Foot Length", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Encoded in the model number itself: 0 = under 70 mm, 1 = 70 mm, 5 = 120 mm. It tracks the buttonhole length because the foot must span the hole, so recording both is not duplication — a mismatched foot is the commonest wrong-part order on this machine.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "buttonhole_shape", key: "buttonhole_shape", label: "Buttonhole Shape", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "straight_flat", label: "Straight / Flat (lockstitch)" },
            { value: "eyelet", label: "Eyelet (keyhole)" },
          ],
          description: "The SG 1790 is a straight (flat) buttonholer. Eyelet machines are a different mechanism entirely — tailored jackets and jeans need them — and the two are NOT interchangeable, so this field must be filled before a quotation is trusted. Left as a field rather than split into two subcategories because the taxonomy prefixes are frozen.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "material_class", key: "material_class", label: "Material Class", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            /* Field-scoped values: bare "woven"/"knitted" already name a
               FABRIC on applicable_material and suitable_fabrics. Here they
               name the MACHINE BUILD (-S vs -K, which changes the needle), so
               gate I is right to refuse the collision. */
            { value: "build_woven", label: "Woven" },
            { value: "build_knitted", label: "Knitted" },
          ],
          description: "The -S / -K suffix (\"weavon\" i.e. woven, or knitted), which changes the NEEDLE — DBX5 #11 against DBX5KN #11. This is fabric TYPE and it separates models inside one series, so it is a field; fabric WEIGHT (heavy duty) is the `fabric_weight_class` facet and must not be re-minted here.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "multi_cut_function", key: "multi_cut_function", label: "Multi-Cut Function", order: 50,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "The knife cuts a long hole in several strokes, so one cutter covers every length — \"no necessary to change cutter\". On a machine whose cutter is a consumable matched to hole length, this is a running-cost fact, not a convenience.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    headAndStitchGroup(20, {
      speedNote: "4200 rpm across the whole SG 1790 series, from a high-speed servo motor. Notably faster than the bartacker beside it (3200 rpm) — a buttonholer sews a short fixed path and is built for cycle time.",
      strokeNote: "34.6 mm throughout the series.",
      needleNote: "DBX5 #11 on woven (-S) models and DBX5KN #11 on knitted (-K) — the KN point is what stops a knit ladder running from the hole.",
    }),
    {
      id: "buttonhole-control",
      title: "Control & Construction",
      order: 30,
      fields: [
        {
          id: "control_panel_type", key: "control_panel_type", label: "Control Panel", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"LCD touch panel with USB port\", listed as optional on some models. The USB port is how patterns and settings move between machines on a line.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "dry_head_mechanism", key: "dry_head_mechanism", label: "Dry-Head Mechanism", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "A dry head carries no oil at the needle bar, so it cannot stain the garment — decisive on light and pale fabric, and the reason it is printed as a headline feature rather than a lubrication note.",
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

export const BARTACK_SCHEMA: ProductSchemaDefinition = {
  id: "bartack.v1",
  name: "Bartacking Machine",
  divisionCode: "garment-machinery",
  categoryCode: "automatic-sewing-systems",
  subcategoryCode: "XABT",
  version: "1",
  groups: [
    {
      id: "bartack-work",
      title: "Tacking Area & Stitch",
      order: 10,
      fields: [
        {
          id: "sewing_area", key: "sewing_area", label: "Sewing Area", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "30×40 (std), 40×30 (SG1943B), 60×40 (SG1964B) or 60×50 mm (SG1965B) — the number encoded in the model code and the only structural difference across the series. Note 30×40 and 40×30 are NOT the same machine: the pair is oriented, so the printed order must be preserved.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "stitch_length_max", key: "stitch_length_max", label: "Max Stitch Length", order: 20,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "Printed as a 0.1–10 mm range; record the maximum. Ten millimetres is long for a tack and is what lets the same machine attach elastic (the XJ variant).",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "hook_type", key: "hook_type", label: "Hook Type", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "standard_hook", label: "Standard Hook" },
            { value: "large_hook", label: "Large Hook" },
          ],
          description: "The pictogram table marks standard hook ★ on most models and large hook ★ only on the -JB. A larger hook holds more bobbin thread — on a machine that fires thousands of short tacks a shift, that is bobbin changes per operator per day.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "tack_applications", key: "tack_applications", label: "Applications", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "The suffix says what the machine is built for: JM knitted material, JF underwear, XJ elastic band, JB large hook. Free text and NOT a duty field — JH \"heavy duty\" is the `fabric_weight_class` facet arriving through the Machine Kind, and re-minting it here would give the Hub two answers to one question.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    headAndStitchGroup(20, {
      speedNote: "3200 rpm across the whole SG 1900B series. Lower than the buttonholer beside it because a tack is a dense cluster of stitches in one spot, where speed costs thread control.",
      strokeNote: "41.2 mm throughout the series.",
      needleNote: "Varies by variant, and that IS the point of the variant: DBX5 #14 standard, DBX17 #16 heavy duty, DBX5 #11 knitted and underwear, DBX17 #21 large hook. Record what the quoted variant carries.",
    }),
    {
      id: "bartack-automation",
      title: "Automation",
      order: 30,
      fields: [
        {
          id: "auto_presser_foot_lift", key: "auto_presser_foot_lift", label: "Auto Presser Foot Lift", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "Marked ★ across the series.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "control_panel_type", key: "control_panel_type", label: "Control Panel", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Optional LCD control panel\" — the base machine ships with a segment display, so a quotation that assumes a colour panel is a quotation for a different price.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "electronic_thread_clipper", key: "electronic_thread_clipper", label: "Electronic Thread Clipper", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "Printed as a distinct feature from the thread trimmer above: the clipper shortens the thread tail electronically after the trim, which is what stops a tack ending in a visible whisker.",
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

export const BUTTONHOLE_BARTACK_SCHEMAS: ProductSchemaDefinition[] = [
  BUTTONHOLE_SCHEMA,
  BARTACK_SCHEMA,
];
