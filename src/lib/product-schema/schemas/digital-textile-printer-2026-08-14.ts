/**
 * XPDT · Digital Textile Printers (DTG) — spec template.
 *
 * SOURCE — `KILO (麒龙) 2024` pages 3–10, image-only, from the cover triage.
 * Three families, each with a full printed table: **DTF** direct-to-film
 * (DTF-60-2PCS-EH2-1600 · DTF-30-2PCS-A3 · DTF-30-1PC-1080), **DTG**
 * direct-to-garment (DTG-2PCS-DI · DTG-2PCS-PRO I · DTG-3PCS-PRO II) and
 * **UV-DTF** (UV-DTF-30-3PCS · UV-DTF-A3-1PC).
 *
 * ⚠️ DTF AND DTG ARE OPPOSITE WORKFLOWS SHARING ONE SHELF, AND `print_process`
 * IS THEREFORE THE FIRST FIELD. DTF prints onto PET **film**, dusts it with
 * adhesive powder, cures it, and the film is later pressed onto the garment —
 * so a DTF printer is useless without a heat press and a powder shaker. DTG
 * prints **straight onto the garment** on a tray and needs neither. Two machines
 * on this shelf quoting "5 sqm/h" are not comparable until this field says which
 * process produced the number.
 *
 * ⚠️⚠️ PRINT SPEED IS QUOTED **PER PASS** AND A BARE NUMBER IS MEANINGLESS.
 * The sheet prints "4pass 720*1200 DPI **7 sqm/h** · 6pass 720*1800 DPI
 * **5 sqm/h** · 8pass 720*2400 DPI **3.5 sqm/h**" — the SAME machine, twice as
 * fast at half the quality. Recording 7 sqm/h without "4-pass" makes this
 * printer look twice as productive as an identical one honestly quoted at
 * 8-pass. **Always store the pass count with the speed.**
 *
 * ⚠️ A DTF MACHINE IS TWO UNITS, AND THE CATALOGUE GIVES THE SECOND ITS OWN
 * TABLE. The printer is sold with a **powder shaker / dryer** (EH2 economic,
 * VH2 vertical, A3) carrying its own media width, wattage, size and weight —
 * 2500 W or 4000 W against the printer's own supply, and up to 150 kg. Record a
 * DTF printer without its shaker and half the purchase, half the floor space and
 * most of the power draw are missing.
 *
 * ⚠️ "UNLIMITED PRINTING LENGTH" IS PRINTED AND IT IS LITERAL. These are
 * roll-fed: only the WIDTH bounds the image, so `max_print_width` is the real
 * format spec and length is not a dimension at all. The DTG machines are the
 * opposite — a fixed tray (406×457 mm, 450×600 mm) with both dimensions bounded.
 *
 * ⚠️ THE WORKING-ENVIRONMENT ROW IS A SPECIFICATION HERE, NOT BOILERPLATE.
 * 18–30 °C and 35–65 % RH, printed on every model. White pigment ink settles and
 * clogs outside that band, which is why every one of these machines also lists
 * automatic white-ink stirring and circulation. A workshop that cannot hold the
 * band will destroy print heads, so it belongs on the record.
 *
 * ⚠️ TAXONOMY FLAG, NOT ACTED ON. The **UV-DTF** machines print on acrylic,
 * aluminium board, ceramic tile, glass, wood and leather, and one does 360°
 * printing on bottles — that is **not textile**, and `XPDT` is named "Digital
 * Textile Printers (DTG)". They are covered here because the catalogue sells
 * them in the same family and no better code exists, but a `UV printer` code may
 * be the honest answer later. Owner decision, like the `XEC` overlap.
 *
 * VALUES OBSERVED:
 *   DTF    heads 1–2 × EPSON I1600-A1 / F1080-A1 · width 300 / 330 / 615 mm
 *          media ≤700 mm · 3200 DPI (720–1440 modes) · 3.5–7 sqm/h by pass
 *          CMYK+W · PET film · water-based pigment ink · 18–30 °C / 35–65 %
 *          printer 38–160 kg + shaker 50–150 kg
 *   DTG    heads 2–3 × EPSON I3200-A1 · tray 406×457 → 450×600 mm
 *          print thickness 0–30 mm · 720×1200 (4pass) / 720×1800 (6pass)
 *          1 min per chart · WWWW+CMYK · 125–252 kg
 *   UV-DTF 3 × I1600-U1 CMYK+W+**V** (varnish) · width 300 mm · 3–5 sqm/h
 *          media thickness 1–95 mm · acrylic, glass, ceramic, wood, leather
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

export const DIGITAL_TEXTILE_PRINTER_SCHEMA: ProductSchemaDefinition = {
  id: "digital-textile-printer.v1",
  name: "Digital Textile Printer",
  divisionCode: "garment-machinery",
  categoryCode: "printing-heat-press-equipment",
  subcategoryCode: "XPDT",
  version: "1",
  groups: [
    {
      id: "dtp-process",
      title: "Print Process & Format",
      order: 10,
      fields: [
        {
          id: "print_process", key: "print_process", label: "Print Process", order: 10,
          fieldType: "select" as const, dataType: "string" as const, required: false,
          options: [
            { value: "print_proc_dtf", label: "DTF — Direct to Film" },
            { value: "print_proc_dtg", label: "DTG — Direct to Garment" },
            { value: "print_proc_uv_dtf", label: "UV-DTF — UV Transfer / Hard Substrate" },
          ],
          description: "⭐ FILL THIS FIRST — it changes what every field below means. DTF prints onto PET film, powders it, cures it, and the film is heat-pressed onto the garment LATER, so a DTF printer is useless without a press and a shaker. DTG prints straight onto the garment on a tray and needs neither. Two machines here quoting \"5 sqm/h\" are not comparable until this field says which process produced the number.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "print_head_model", key: "print_head_model", label: "Print Head Model", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "EPSON I1600-A1, F1080-A1, I3200-A1, I1600-U1. The head is the wear item and the single biggest spare-part cost on the machine, so the model number matters more than the printer's own name — a customer replaces heads for years and buys the printer once.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "print_head_count", key: "print_head_count", label: "Print Head Count", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "1, 2 or 3 (printed \"PCS\", and visible in the model name: DTF-30-**2PCS**-A3, DTG-**3PCS**-PRO II). Head count multiplies throughput at the same resolution and is the main thing separating otherwise identical models in this range.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_print_width", key: "max_print_width", label: "Maximum Print Width", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "300, 330 or 615 mm on the roll machines. ⚠️ On DTF and UV-DTF this is the ONLY dimension that bounds the image — the sheet prints \"**Unlimited Printing Length**\" and means it, because the film is roll-fed. On DTG use the tray size instead: those are bounded both ways (406×457 mm, 450×600 mm).",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "max_media_width", key: "max_media_width", label: "Maximum Media Width", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "700 mm where the print width is 615 mm — the roll is always wider than the image because the film needs an unprinted margin to feed on. Record both: ordering film to the print width instead of the media width buys stock the machine cannot grip.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "media_thickness_range", key: "media_thickness_range", label: "Media Thickness Range", order: 60,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "0–30 mm on the DTG machines (a garment on a tray, plus the tray travel) and **1–95 mm** on the UV-DTF flatbed, which prints onto phone cases and boards. Leave BLANK on a roll-fed DTF machine — film thickness is not quoted and a value here would be invented.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "dtp-output",
      title: "Resolution & Output",
      order: 20,
      fields: [
        {
          id: "print_speed_by_pass", key: "print_speed_by_pass", label: "Print Speed (by Pass)", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "⚠️⚠️ QUOTED PER PASS — A BARE SPEED IS MEANINGLESS. The sheet prints \"4pass 720×1200 DPI 7 sqm/h · 6pass 720×1800 DPI 5 sqm/h · 8pass 720×2400 DPI 3.5 sqm/h\" for ONE machine: twice as fast at half the quality. Store the whole printed string, pass counts and all. A record saying \"7 sqm/h\" makes this printer look twice as productive as an identical one honestly quoted at 8-pass.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "print_resolution", key: "print_resolution", label: "Print Resolution", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Printed two different ways and they are not the same claim: a single figure (3200 DPI) is the machine's mechanical addressability, while a list (720 / 1080 / 1440 DPI, or 720×1800 dpi 6pass) is the selectable print MODES. Copy the printed form rather than reducing it to one number — a 3200 DPI machine may still only offer three usable modes.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "colour_configuration", key: "colour_configuration", label: "Colour Configuration", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "CMYK+**W** on DTF, **WWWW**+CMYK on the DTG (four white channels — white is the underbase on dark garments and needs the most ink), and CMYK+W+**V** on UV-DTF where V is varnish. The white and varnish channels are what distinguish these from an office printer, so record the full printed string, not just \"CMYK\".",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "print_media", key: "print_media", label: "Print Media", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "PET film on DTF, the garment itself on DTG, and on UV-DTF \"acrylic, aluminium board, ceramic tile, glass, wood board, leather\". ⚠️ That last list is NOT textile — see the taxonomy note in this file's header. Record what the sheet claims rather than what the subcategory name implies.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "ink_type", key: "ink_type", label: "Ink Type", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "Water-based pigment (DTF), eco-friendly textile paint (DTG), UV curing ink (UV-DTF). The ink is a consumable the customer is locked into for the life of the machine, and the three are not interchangeable in any direction — putting UV ink through a water-based head destroys it.",
          ...pub, visualRenderType: "spec_card" as const,
        },
      ],
    },
    {
      id: "dtp-ink-system",
      title: "Ink System, Software & Environment",
      order: 30,
      fields: [
        {
          id: "ink_supply_system", key: "ink_supply_system", label: "Ink Supply System", order: 10,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Automatic ink supply, white ink automatic stirring & circulation, all-colour ink shortage alarm.\" The white-ink circulation is the load-bearing part: white pigment SETTLES if it stops moving, and a machine without circulation clogs its heads overnight. Record whether stirring and circulation are present, not just that ink is fed.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "maintenance_system", key: "maintenance_system", label: "Maintenance System", order: 20,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"Print head automatic cleaning, scraping ink, moisturizing, anti-collision.\" Anti-collision is a head-protection feature, not a safety one — it stops the carriage striking a wrinkled garment, and a head costs a significant fraction of the printer.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "rip_software", key: "rip_software", label: "RIP Software", order: 30,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "\"RIIN (standard), PP / Sai Flexi Photoprint as the option\", or PowerPlotter 7 / Maintop. The RIP is what converts artwork into the white underbase and the colour pass, and machines are effectively locked to theirs. Record standard AND optional — the option is usually a paid licence.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "working_environment", key: "working_environment", label: "Working Environment", order: 40,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "⚠️ A SPECIFICATION, NOT BOILERPLATE. 18–30 °C and 35–65 % RH, printed on every model in the range. White pigment ink settles and clogs outside that band — a workshop that cannot hold it will destroy heads regardless of how the machine is maintained. This is a site-survey question at quotation time, which is why it is a field.",
          ...pub, visualRenderType: "spec_card" as const,
        },
        {
          id: "powder_shaker_unit", key: "powder_shaker_unit", label: "Powder Shaker / Dryer Unit", order: 50,
          fieldType: "text" as const, dataType: "string" as const, required: false,
          description: "⚠️ A DTF MACHINE IS TWO UNITS AND THE CATALOGUE GIVES THE SECOND ITS OWN TABLE — EH2 economic, VH2 vertical or A3, each with its own media width, wattage (800 / 2500 / 4000 W), footprint and weight (50–150 kg). Record the model and its figures here. A DTF printer entered without its shaker is missing half the purchase, half the floor space and most of the power draw. Leave BLANK on DTG and UV-DTF, which need no shaker.",
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

export const DIGITAL_TEXTILE_PRINTER_SCHEMAS: ProductSchemaDefinition[] = [
  DIGITAL_TEXTILE_PRINTER_SCHEMA,
];
