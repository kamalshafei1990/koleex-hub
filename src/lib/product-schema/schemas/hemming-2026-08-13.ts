/**
 * XAHM · Hemming Machines — spec template.
 *
 * Template eight in `Automatic Sewing Systems`, and the last one the current
 * catalogue library can support: XACL (collar), XASL (sleeve setting) and XASS
 * (side seam) have NO source with a printed spec table anywhere in the 75 local
 * files or the Drive subfolders, and are deliberately left empty rather than
 * invented.
 *
 * SOURCE — S-JOOKE, three hemming machines each with a full parameter table:
 *   JK-BXH-9811  boxers leg hemming  — tubular, narrow mouth
 *   JK-3008      circular bottom hemming — tubular, knit T-shirt / polo
 *   JK-3422      flat hemming — programmed, flat panel
 * A fourth (pocket + short-sleeve hemming, p.30) prints a table but is a
 * combination machine; its fields are covered here without it being the basis.
 *
 * ⚠️ FLAT AND TUBULAR HEMMING ARE DIFFERENT MACHINES, and the template says so
 * structurally. A tubular hemmer quotes a CIRCUMFERENCE range (20–38 cm — the
 * leg opening it can pass over its cylinder) and cannot hem a flat panel; a
 * flat hemmer quotes a LENGTH range (100–900 mm) and cannot close a tube.
 * Filling the wrong one of those two fields describes a machine that does not
 * exist, which is why they are separate fields with `hemming_type` above them
 * rather than one "sewing range" that silently means two things.
 *
 * ⚠️ HEM WIDTH IS PRINTED IN TWO UNITS AND THAT IS NOT A TYPO. JK-BXH-9811 says
 * 1.5–2.2 cm; JK-3008 says 13–28 mm; JK-3422 says 15–30 mm. Same fact, two
 * units, on pages of the SAME catalogue. The field is millimetres and the
 * description says so — anyone entering 1.5 from the first sheet would record a
 * 1.5 mm hem, an order of magnitude wrong and entirely plausible-looking.
 *
 * VALUES OBSERVED:
 *   hem width 15–30 mm · circumference 20–38 cm · length 100–900 mm
 *   head speed 3500–4500 rpm · needle pitch 1.00–4.4 mm
 *   air 0.5–0.6 MPa · 220 V · 0.6–0.66 kW · 150–213 kg
 *   output 150–200 pieces/hour
 *
 * WHAT IS DELIBERATELY NOT HERE — the stitch class. JK-3008 runs a 2-needle
 * 3-thread or 3-needle 5-thread coverstitch head; that is the `XSI` stitch
 * TYPE arriving through the bought-in head, recorded in sewing_head_model and
 * needle_thread_configuration, not re-minted as a stitch taxonomy here.
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

export const HEMMING_SCHEMA: ProductSchemaDefinition = {
  id: "hemming.v1",
  name: "Hemming Machine",
  divisionCode: "garment-machinery",
  categoryCode: "automatic-sewing-systems",
  subcategoryCode: "XAHM",
  version: "1",
  groups: [
    {
      id: "hem-geometry",
      title: "Hem Geometry",
      order: 10,
      fields: [
        {
          id: "hemming_type", key: "hemming_type", label: "Hemming Type", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "hem_tubular", label: "Tubular / Circular" },
            { value: "hem_flat", label: "Flat Panel" },
          ],
          description: "THE first question about a hemming machine. A tubular hemmer passes a closed leg or body over a cylinder and cannot hem a flat panel; a flat hemmer runs an open edge and cannot close a tube. Fill this before either range field below — the two are mutually exclusive, and the wrong one describes a machine that does not exist.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "hem_width_range", key: "hem_width_range", label: "Hem Width", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "IN MILLIMETRES: 13–28 mm (JK-3008), 15–30 mm (JK-3422). ⚠️ The JK-BXH-9811 sheet prints the SAME fact in centimetres (1.5–2.2 cm) — convert it. Entering 1.5 straight from that page records a 1.5 mm hem, ten times too small and entirely plausible-looking on screen. Kept as text because it is a range and the range is what the folder is set to.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "tube_circumference_range", key: "tube_circumference_range", label: "Tube Circumference Range", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "TUBULAR MACHINES ONLY — 20–38 cm on the JK-BXH-9811, the leg opening it can pass over its cylinder. The lower bound matters as much as the upper: below it the tube will not stay on the cylinder, which is why the sheet advertises \"small sizes can also be sewn\". Leave BLANK on a flat hemmer rather than entering 0.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "hem_sewing_length_range", key: "hem_sewing_length_range", label: "Sewing Length Range", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "FLAT MACHINES ONLY — 100–900 mm on the JK-3422. The JK-3008 prints TWO ranges because the figure depends on the roller fitted: \"320–900 mm face; small roller 280–360 mm\". Record the printed phrase including which roller, not one of the two numbers.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "hem-head",
      title: "Sewing Head & Stitch",
      order: 20,
      fields: [
        {
          id: "sewing_head_model", key: "sewing_head_model", label: "Sewing Head", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "A bought-in head — \"PEGASUS W3662P-35B\" on the JK-3008. It decides the stitch, the spare-parts channel and a large share of the price; two units with the same frame and different heads are not the same machine.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "needle_thread_configuration", key: "needle_thread_configuration", label: "Needle / Thread Configuration", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"2-needle 3-thread\" or \"3-needle 5-thread\" coverstitch. This is what the finished hem LOOKS like on the garment face, so it is a customer-visible fact rather than an internal one. The stitch CLASS itself belongs to the head, not re-minted here as a taxonomy.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_sewing_speed", key: "max_sewing_speed", label: "Max Head Speed", order: 30,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "rpm", required: false,
          description: "Printed as a band on two of the three (3500–4500 rpm) and a single figure on the JK-3008 (4500). Record the maximum.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "stitch_length_max", key: "stitch_length_max", label: "Max Stitch Length", order: 40,
          fieldType: "unit_number" as const, dataType: "number" as const, unit: "mm", required: false,
          description: "Printed \"Needle Pitch 1.00–4.4 mm\" on the JK-3008 — the same fact under a different name. Record the maximum.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "hem-automation",
      title: "Automation & Handling",
      order: 30,
      fields: [
        {
          id: "size_control_mode", key: "size_control_mode", label: "Size Control", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "size_electric", label: "Electric" },
            { value: "size_pneumatic", label: "Pneumatic" },
            { value: "size_manual", label: "Manual" },
          ],
          description: "\"Electric or pneumatic automatic size control\" — the machine resizes itself between garment sizes instead of being re-set by hand. On a hemming line that runs a size curve, this is the difference between a changeover and a button press.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "side_seam_detection", key: "side_seam_detection", label: "Side-Seam Start/Stop", order: 20,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"Auto start-stop according to the position of side seam\" — the machine finds the seam and starts the hem there, so the overlap lands where it is hidden. Specific to tubular hemming and printed on both tubular machines; absent from the flat one.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "auto_fabric_guide_folding", key: "auto_fabric_guide_folding", label: "Automatic Guide & Folding", order: 30,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "\"Automatic fabric guiding and folding design\" — the folder turns the hem allowance without an operator holding it, which is what removes the skill from the job. The catalogue sells the whole class on this line.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "auto_garment_collection", key: "auto_garment_collection", label: "Automatic Garment Collection", order: 40,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: FITMENT_OPTIONS,
          description: "Stacks the finished piece itself. Recorded because it is the fitment that lets \"one person operate two machines\" — a labour-cost fact, and the claim the sheet makes right beside it.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "production_output", key: "production_output", label: "Production Output", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"150–200 pieces per hour\" on the JK-3008. Kept as the printed phrase with its basis, like every other output figure in this category — a bare number invites comparison between two machines counting different things.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "working_air_pressure", key: "working_air_pressure", label: "Working Air Pressure", order: 60,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "0.5–0.6 MPa across all three. Kept as the printed phrase because two of the sheets state it as a minimum (\"> 0.5 MPa\") and a bare number loses the \"greater than\".",
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

export const HEMMING_SCHEMAS: ProductSchemaDefinition[] = [HEMMING_SCHEMA];
