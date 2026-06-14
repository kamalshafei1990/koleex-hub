# Lockstitch — Master Specification Dictionary (GOLDEN TEMPLATE)

**Product Type:** Industrial Lockstitch Sewing Machine · **Code prefix:** `XSL` · Division X (Garment Machinery) → Sewing → Lockstitch.
**Status:** Source-of-truth reference dataset. **Documentation only — not applied** (no schema/migrations/code). Governed by [`../coding-change-governance.md`](../coding-change-governance.md); visuals per [`../../architecture/visual-product-experience.md`](../../architecture/visual-product-experience.md); facet types per [`../facet-dictionary-master.md`](../facet-dictionary-master.md).

> **This is the GOLDEN TEMPLATE.** Every future Product Type (Overlock, Interlock, Embroidery, Heat Press, Cutting, Fabric Inspection, Fabric Spreading, Needle Detection, …) is authored by **copying this structure** and substituting the type-specific specs. The *structure*, the *seven knowledge dimensions* (A–G), the *visual-metadata columns*, and the *required/optional discipline* are fixed; only the spec rows change.

---

## 0. Conventions (apply to every dictionary)

**Field row columns:**
- **Field** — stable snake_case key (reused from `facet-dictionary-master.md` where one exists; net-new keys flagged ⊕ for promotion).
- **Display name** — human label (the `display_name`).
- **Type** — `text · number · boolean · single_select · multi_select · range · measurement`.
- **Unit** — measurement unit where applicable.
- **Req** — ● Required · ○ Optional · ◐ Conditional (required when a parent value applies).
- **group** — the spec card / `presentation_group` it renders in.
- **icon_key** — Visual Library token (line style, monochrome) for the spec/option.
- **D / C / A** — `display_priority` / `comparison_priority` / `ai_priority`, scale **1–5** (1 = always-on / top; 5 = rarely / on-demand). These map to `spec_card_priority`, `comparison_display`, `ai_visual_hint` weight in the visual SoT.
- **Web / Quote** — `website_visibility` / `quotation_visibility`: ✓ default-visible · ○ visible on expand · — hidden.

**Display styles** (per facet): `value-unit · chip · boolean-icon · meter · swatch · enum-chip · hidden`.
**Inheritance:** values resolve `SKU ► Primary Model ► Family ► Product Type default` (specs and visual metadata both).

---

## 1. Executive Summary

The Lockstitch Master Specification Dictionary defines **everything KOLEEX must know, show, compare, and answer** about an industrial lockstitch sewing machine — the most common machine in any garment factory and the spec spine that ~80% of the other sewing types (Overlock, Interlock, Bartack, Buttonhole, Zigzag) reuse.

It is organised into **seven knowledge dimensions**, each a first-class part of "product knowledge" (not just A):

| Dim | Dimension | What it powers |
|---|---|---|
| **A** | Technical Specifications | Spec cards, datasheets, comparison |
| **B** | Commercial Specifications | Quotation, trade, logistics |
| **C** | Visual Specifications | Hero/gallery/diagram/video assets |
| **D** | Comparison Specifications | Product / AI / Website / Quotation compare |
| **E** | Compatibility Specifications | Devices, spares, needles, feet, motors, tables |
| **F** | Application Specifications | Garments, fabrics, operations, industries |
| **G** | AI Knowledge Specifications | The 5 assistants |

**Counts (this dictionary):** ~58 technical fields · 14 commercial · 8 visual asset roles · 22 compatibility link-fields · 5 application link-sets · AI metadata on every field. **Required core: 18 fields** make a lockstitch "listable"; **knowledge-ready** = required core + visual metadata + ≥1 application link + ≥1 compatibility class populated.

**Why lockstitch first:** flagship, highest catalog volume, and its Stitch/Needle/Feed/Drive/Speed spine is inherited by every other sewing type — so finishing this de-risks the whole sewing category.

---

## 2. Identity block (every Primary Model carries these)

| Field | Display name | Type | Req | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|
| `primary_model` | KOLEEX Model | text | ● | Identity | tag | 1/1/1 | ✓/✓ |
| `product_type` | Product Type | single_select | ● | Identity | category | 1/2/1 | ✓/○ |
| `family` | Series / Family | text | ○ | Identity | layers | 2/3/2 | ✓/— |
| `brand` | Brand | text | ● | Identity | brand | 2/4/3 | ✓/○ |
| `model_marketing_name` | Marketing name | text | ○ | Identity | type | 2/5/3 | ✓/— |
| `short_description` | Short description | text | ● | Identity | doc | 1/3/1 | ✓/✓ |
| `long_description` | Full description | text | ○ | Identity | doc | 3/5/2 | ✓/— |

---

## 3. (A) Technical Specifications — full dictionary

> Grouped logically. Shared facets reuse `facet-dictionary-master.md`; ⊕ marks net-new lockstitch facets to promote into the master facet dictionary.

### A1 · Stitch & Configuration
| Field | Display name | Type | Unit | Req | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `stitch_type` | Stitch type | single_select | — | ● | Stitch | stitch | 1/1/1 | ✓/✓ |
| `bed_type` | Bed type | single_select | — | ● | Stitch | bed | 1/1/1 | ✓/✓ |
| `needle_count` | Needles | number | — | ● | Stitch | needle | 1/1/1 | ✓/✓ |
| `needle_gauge` ⊕ | Needle gauge (twin) | measurement | mm | ◐ | Stitch | gauge | 2/2/2 | ✓/○ |
| `seam_type_support` ⊕ | Seam classes | multi_select | — | ○ | Stitch | seam | 3/3/2 | ✓/— |

### A2 · Needle & Thread
| Field | Display name | Type | Unit | Req | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `needle_system` | Needle system | text | — | ● | Needle&Thread | needle | 1/1/1 | ✓/✓ |
| `needle_size_range` ⊕ | Needle size range | range | Nm | ● | Needle&Thread | ruler | 2/2/2 | ✓/○ |
| `thread_type_support` ⊕ | Thread types | multi_select | — | ○ | Needle&Thread | thread | 3/3/2 | ✓/— |
| `thread_size_range` ⊕ | Thread size range | range | Tex/Nm | ○ | Needle&Thread | thread | 3/3/2 | ✓/— |
| `threading_path` ⊕ | Threading type | single_select | — | ○ | Needle&Thread | route | 4/5/3 | ○/— |

### A3 · Feed System
| Field | Display name | Type | Unit | Req | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `feed_type` | Feed mechanism | single_select | — | ● | Feed | feed | 1/1/1 | ✓/✓ |
| `feed_dog_rows` ⊕ | Feed-dog rows | number | — | ○ | Feed | feed | 4/4/3 | ○/— |
| `stitch_length_max` ⊕ | Max stitch length | measurement | mm | ● | Feed | ruler | 1/1/1 | ✓/✓ |
| `feed_adjust_method` ⊕ | Stitch-length adjust | single_select | — | ○ | Feed | dial | 4/4/3 | ○/— |
| `differential_ratio` | Differential ratio | range | — | ◐ | Feed | ratio | 3/3/2 | ✓/— |
| `reverse_feed` ⊕ | Reverse feed | boolean | — | ● | Feed | reverse | 2/2/1 | ✓/○ |

### A4 · Bed, Hook & Lubrication
| Field | Display name | Type | Unit | Req | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `hook_size` | Rotary hook size | single_select | — | ● | Mechanics | hook | 2/2/1 | ✓/○ |
| `hook_type` ⊕ | Hook type | single_select | — | ○ | Mechanics | hook | 3/3/2 | ✓/— |
| `presser_foot_lift_manual` ⊕ | Foot lift (manual) | measurement | mm | ● | Mechanics | lift | 2/2/1 | ✓/○ |
| `presser_foot_lift_knee` ⊕ | Foot lift (knee/auto) | measurement | mm | ○ | Mechanics | lift | 3/3/2 | ✓/— |
| `lubrication_type` ⊕ | Lubrication | single_select | — | ● | Mechanics | oil | 2/2/1 | ✓/○ |
| `arm_clearance` ⊕ | Work space (arm) | measurement | mm | ○ | Mechanics | ruler | 3/4/3 | ○/— |

`hook_type` values: Standard rotary · Large rotary · Vertical-axis. `lubrication_type`: Full auto-lube · Semi-dry · Dry-head · Minimal.

### A5 · Drive, Motor & Speed
| Field | Display name | Type | Unit | Req | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `drive_type` | Drive | single_select | — | ● | Drive | motor | 1/1/1 | ✓/✓ |
| `motor_type` ⊕ | Motor type | single_select | — | ● | Drive | motor | 2/2/1 | ✓/○ |
| `motor_power` ⊕ | Motor power | measurement | W | ○ | Drive | power | 3/3/2 | ✓/— |
| `max_speed` | Max sewing speed | measurement | spm | ● | Performance | speed | 1/1/1 | ✓/✓ |
| `recommended_speed` ⊕ | Recommended speed | measurement | spm | ○ | Performance | speed | 3/4/3 | ○/— |
| `noise_level` ⊕ | Noise level | measurement | dB(A) | ○ | Performance | sound | 4/5/3 | ○/— |

`motor_type`: Clutch · Servo (integrated) · Direct-drive (built-in).

### A6 · Automation & Electronics
| Field | Display name | Type | Unit | Req | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `automation_level` | Automation | single_select | — | ● | Automation | automation | 1/1/1 | ✓/✓ |
| `auto_thread_trim` ⊕ | Auto thread trimmer | boolean | — | ● | Automation | scissors | 1/1/1 | ✓/✓ |
| `auto_backtack` ⊕ | Auto back-tack | boolean | — | ● | Automation | reverse | 2/2/1 | ✓/○ |
| `auto_foot_lift` ⊕ | Auto presser lift | boolean | — | ● | Automation | lift | 2/2/1 | ✓/○ |
| `needle_positioner` ⊕ | Needle up/down | boolean | — | ● | Automation | needle | 2/2/1 | ✓/○ |
| `thread_wiper` ⊕ | Thread wiper | boolean | — | ○ | Automation | wipe | 3/3/2 | ✓/— |
| `programmable_panel` ⊕ | Control panel | single_select | — | ○ | Automation | panel | 2/3/2 | ✓/○ |
| `pattern_memory` ⊕ | Pattern/stitch memory | boolean | — | ○ | Automation | memory | 3/3/2 | ✓/— |
| `ai_thread_break_detect` ⊕ | Thread-break detection | boolean | — | ○ | Automation | sensor | 3/3/2 | ✓/— |

`programmable_panel`: None · LED · Touchscreen.

### A7 · Utilities & Electrical (facet-exposed)
| Field | Display name | Type | Unit | Req | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `voltage` | Voltage | multi_select | V | ● | Power | power | 2/4/2 | ✓/○ |
| `frequency` | Frequency | multi_select | Hz | ○ | Power | power | 4/5/3 | ○/— |
| `phase` | Phase | single_select | — | ● | Power | power | 3/4/2 | ✓/○ |
| `power_consumption` | Power consumption | measurement | W | ○ | Power | power | 3/4/2 | ✓/— |
| `plug_type` | Plug type | single_select | — | ○ | Power | plug | 5/5/3 | —/— |
| `air_pressure` | Air requirement | measurement | MPa | ◐ | Power | air | 4/4/3 | ○/— |

`air_pressure` conditional: required when any pneumatic auto-function is present.

### A8 · Physical / Dimensions
| Field | Display name | Type | Unit | Req | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `head_dimensions` ⊕ | Head L×W×H | text | mm | ○ | Physical | ruler | 4/5/3 | ○/— |
| `table_size` ⊕ | Table size | text | mm | ○ | Physical | table | 4/5/3 | ○/— |
| `net_weight` | Net weight (head) | measurement | kg | ○ | Physical | weight | 3/4/3 | ✓/— |

---

## 4. (B) Commercial Specifications

| Field | Display name | Type | Unit | Req | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `moq` | MOQ | number | units | ● | Commercial | box | 2/4/2 | —/✓ |
| `warranty` | Warranty | text | months | ● | Commercial | shield | 2/3/2 | ✓/✓ |
| `certification` ⊕ | Certifications | multi_select | — | ● | Commercial | certificate | 2/3/2 | ✓/○ |
| `country_of_origin` | Origin | text | — | ● | Commercial | globe | 3/4/2 | ✓/✓ |
| `lead_time` | Lead time | text | days | ● | Commercial | clock | 2/4/2 | ○/✓ |
| `market_availability` | Availability | single_select | — | ● | Commercial | status | 2/4/2 | ✓/○ |
| `hs_code` | HS code | text | — | ● | Logistics | customs | 4/5/3 | —/✓ |
| `weight_net` | Net weight | measurement | kg | ● | Logistics | weight | 3/4/2 | ○/✓ |
| `weight_gross` | Gross weight | measurement | kg | ● | Logistics | weight | 3/5/3 | —/✓ |
| `cbm` | CBM | measurement | m³ | ● | Logistics | cube | 3/5/3 | —/✓ |
| `packing_type` | Packing | text | — | ● | Logistics | package | 3/5/3 | —/✓ |
| `packing_size` | Packing size | text | mm | ○ | Logistics | package | 4/5/3 | —/○ |
| `container_20ft_qty` | Qty / 20ft | number | — | ○ | Logistics | container | 4/5/3 | —/○ |
| `container_40ft_qty` | Qty / 40ft | number | — | ○ | Logistics | container | 4/5/3 | —/○ |

`certification`: CE · CCC · UL · RoHS · ISO9001. **Supplier fields** (sourcing, internal — never customer-facing): `supplier_id`, `supplier_model_code`, `supplier_moq`, `supplier_lead_time`, `factory_unit` — live on the SKU/sourcing layer (`web=—`, `quote=—`); see `device-dictionary`/sourcing docs. Pricing is **not** here — it lives in Commercial Policy.

---

## 5. (C) Visual Specifications

Asset roles attach to `product_media` via `image_role` (visual SoT §3). Resolution order `SKU ► Model ► Family ► Type ► icon fallback`.

| Asset role (`image_role`) | Purpose | Req | Surfaces | Notes |
|---|---|---|---|---|
| `hero` | Primary product image | ● | Card, Website, Quote | 1 per Model; clean white-bg, ¾ angle |
| `gallery` | Additional product views | ● (≥2) | Website, Card | front / side / panel / bed |
| `detail` ⊕ | Machine detail close-ups | ○ | Website, Spec card | hook, feed-dog, panel, trimmer |
| `diagram` | Technical / line diagram | ○ | Spec card, Catalog, AI | dimensioned line art (monochrome) |
| `application` ⊕ | In-use / on-garment | ○ | Website, AI, Catalog | shows the seam/garment it makes |
| `spare_part` ⊕ | Part/exploded view | ○ | Compatibility, BOM | seeds spare-part cards |
| `packing` ⊕ | Packing / crate | ○ | Quote, Logistics | carton & wooden-case shots |
| `video` ⊕ | Demo / operation video | ○ | Website, AI | URL asset; `image_role=video` |

Each Model also carries `icon_key` + `icon_style` (line) as the **fallback identity** and dense-list marker; `badge_style` badges (e.g. "Direct-Drive", "Auto-Trim", "Heavy-Duty") derive from facets.

---

## 6. (D) Comparison Specifications

Which fields appear in each comparison surface (driven by `comparison_priority` + per-facet `comparison_display`). **Diff-aware:** differing values highlight.

| Field | Product compare | AI compare | Website compare | Quotation compare |
|---|---|---|---|---|
| `max_speed` | ✓ | ✓ | ✓ | ✓ |
| `bed_type` | ✓ | ✓ | ✓ | ✓ |
| `feed_type` | ✓ | ✓ | ✓ | ○ |
| `needle_count` | ✓ | ✓ | ✓ | ✓ |
| `drive_type` / `motor_type` | ✓ | ✓ | ✓ | ✓ |
| `automation_level` | ✓ | ✓ | ✓ | ✓ |
| `auto_thread_trim` | ✓ | ✓ | ✓ | ○ |
| `stitch_length_max` | ✓ | ✓ | ○ | — |
| `presser_foot_lift_manual` | ✓ | ✓ | ○ | — |
| `hook_size` | ✓ | ✓ | ○ | — |
| `needle_system` | ○ | ✓ | ○ | — |
| `warranty` | ○ | ✓ | ✓ | ✓ |
| `country_of_origin` | ○ | ✓ | ✓ | ✓ |
| `voltage` / `phase` | ○ | ✓ | ○ | ○ |
| `certification` | — | ✓ | ✓ | ○ |

**Comparison rule of thumb:** Product/Website compare = differentiators a buyer chooses on (speed, bed, feed, automation, drive). Quotation compare = decision + trade fields (speed, automation, warranty, origin, price-relevant). AI compare = the widest set (it reasons over everything, surfaces the meaningful diffs).

---

## 7. (E) Compatibility Specifications

Lockstitch is a **source machine**; compatibility links it to parts/devices. Per the compatibility rulebook, each link is `source → target` with `comp_type ∈ {fits, requires, pairs, alt, supersedes, upgrades}`, a typed match-spec, exclusions, and confidence. Fields needed:

| Linked class | Match/identity fields | Link type | Notes |
|---|---|---|---|
| **Needles** | `needle_system`, `needle_size_range`, `point_type` | requires | the gating compatibility key for sewing |
| **Presser feet** | `function_token=PSF`, `bed_type`, `gauge`, `attachment_mount` ⊕ | fits | gauge + bed must match |
| **Spare parts** | `function_token` (HOK/FDG/NPL/BBN/…), `needle_system`, `oem_vs_aftermarket` | fits | exploded-diagram callout → part |
| **Attachments / folders** | `function_token=FLD`, `bed_type`, `application` | pairs | binders, hemmers, guides |
| **Devices** (factory-fit) | `device_id`, `function_token`, `sku_affecting` | upgrades | edge-cutter, puller, tape-feeder (see device-dictionary) |
| **Motors** | `motor_type`, `voltage`, `phase`, `mount_type` ⊕ | fits/requires | servo/direct-drive retrofits |
| **Tables / stands** | `table_size`, `bed_type`, `cutout_type` ⊕ | requires | stand + table assembly |
| **Bobbins / hooks** | `hook_size`, `hook_type` | requires | consumable + rotary hook |

Net-new compatibility facets to promote ⊕: `attachment_mount`, `mount_type` (motor), `cutout_type` (table). Compatibility results render as **linked cards** (icon + photo of the partner) — visual SoT §9.

---

## 8. (F) Application Specifications

Link-sets connecting the machine to *what it makes* — power the Application cards, website "used for", and the Factory Builder. All reference controlled vocabularies.

| Link-set | Field | Type | Source vocabulary |
|---|---|---|---|
| **Garment types** | `garment_type` | multi_select | shirts, trousers, denim, knitwear, outerwear, bags, leather goods … |
| **Fabrics** | `fabric_type` | multi_select | `facet-dictionary` (Woven · Knit · Denim · Leather · Nonwoven · Technical) |
| **Operations** | `operation` | multi_select | `operation-library-master.md` (seaming, hemming, topstitch, attach, edge-join …) |
| **Applications** | `application` | multi_select | `application-dictionary-master.md` |
| **Industries** | `industry` | multi_select | `facet-dictionary` (Apparel · Home Textile · Automotive · Medical · Safety · Leather …) |

Each link can carry `suitability` ⊕ (Recommended · Capable · Not-recommended) and a `presentation_group` so the resolver lands it in the right Application-card section. Application images (`image_role=application`) illustrate the seam/garment.

---

## 9. (G) AI Knowledge Specifications

The `pd_ai_doc` projection carries every field above plus the AI-specific metadata below, so each of the 5 assistants can answer with **structured visual cards, never invented specs**.

| AI metadata field | Purpose |
|---|---|
| `ai_priority` (per field) | which specs the AI leads with (set in §3–§4) |
| `ai_visual_hint` (per field/type) | which visual to attach (card · spec-card · compatibility-map · diagram · gallery) |
| `ai_synonyms` ⊕ | alternate/market terms ("single needle", "DDL", "flat-bed lockstitch") for retrieval |
| `ai_summary` ⊕ | one-paragraph plain-language model summary |
| `ai_use_when` ⊕ | guidance phrases ("use for woven shirts, light–medium fabric") |
| `ai_not_for` ⊕ | negative guidance ("not for heavy leather / multi-ply") |
| `ai_faq` ⊕ | curated Q→A pairs (needle system? max thickness? trimmer?) |
| `confidence` | per-fact confidence (resolver) |

**Per-assistant field needs:**

| Assistant | Needs from this dictionary |
|---|---|
| **Product Assistant** | identity, A1–A6 technical, `ai_summary`/`ai_use_when`/`ai_not_for`, hero/diagram |
| **Spare Parts Assistant** | §7 needles/feet/spares (`needle_system`, `function_token`, `hook_size`), spare_part images, exploded diagram |
| **Factory Builder Assistant** | §8 applications/operations/garments + throughput, `automation_level`, `suitability` (which machine for which line) |
| **Quotation Assistant** | identity, comparison set (§6 quote column), §4 commercial (MOQ/warranty/origin/lead-time/packing), quotation_display_hint |
| **Service Assistant** | §7 spares + `lubrication_type`, `needle_system`, `programmable_panel`, error/maintenance FAQ (`ai_faq`), diagram |

---

## 10. Required vs Optional (summary)

**Required core — 18 fields (a lockstitch is not "listable" without these):**
`primary_model`, `product_type`, `brand`, `short_description`, `stitch_type`, `bed_type`, `needle_count`, `needle_system`, `feed_type`, `stitch_length_max`, `reverse_feed`, `hook_size`, `presser_foot_lift_manual`, `lubrication_type`, `drive_type`, `motor_type`, `max_speed`, `automation_level` (+ the auto-function booleans `auto_thread_trim`, `auto_backtack`, `auto_foot_lift`, `needle_positioner` default to `false` so they're always answerable).

**Required commercial — `moq`, `warranty`, `certification`, `country_of_origin`, `lead_time`, `market_availability`, `hs_code`, `weight_net`, `weight_gross`, `cbm`, `packing_type`** (SKU-level for logistics).

**Required visual — `hero` + ≥2 `gallery` + `icon_key`.**

**Optional / enrichment** — everything marked ○ above (detail specs, video, FAQ, second-order dimensions). **Conditional ◐** — `needle_gauge` (twin-needle), `differential_ratio` (differential feed), `air_pressure` (pneumatic functions).

**"Knowledge-ready" definition (the bar for every type):** required core + required commercial + required visual + full visual presentation metadata on every field + ≥1 application link-set populated + ≥1 compatibility class (needles) populated + `ai_summary`/`ai_use_when`.

---

## 11. Visual Metadata Dictionary (consolidated)

Every field above carries the full presentation-metadata set; consolidated definition of each attribute (the columns used throughout):

| Attribute | Meaning | Domain |
|---|---|---|
| `icon_key` | Visual Library line icon for the spec/option | token |
| `display_name` | human label | text |
| `group` (`presentation_group`) | spec card it renders in | Identity · Stitch · Needle&Thread · Feed · Mechanics · Drive · Performance · Automation · Power · Physical · Commercial · Logistics |
| `display_priority` | order/openness on the product page (1 top) | 1–5 |
| `comparison_priority` | weight in compare tables (1 = always shown, diff-highlighted) | 1–5 |
| `ai_priority` | how prominently the AI leads with it | 1–5 |
| `website_visibility` | ✓ default · ○ on-expand · — hidden | enum |
| `quotation_visibility` | ✓ default · ○ on-expand · — hidden | enum |
| `display_style` | chip · value-unit · boolean-icon · meter · swatch · enum-chip | enum |

---

## 12. Recommendations for Product Data V2

1. **Promote the ⊕ net-new facets** (≈30: `needle_size_range`, `presser_foot_lift_manual/knee`, `lubrication_type`, `motor_type`, the auto-function booleans, `programmable_panel`, the AI `ai_*` fields, the compatibility `*_mount`/`cutout_type`, `suitability`, the `image_role` extensions) into `facet-dictionary-master.md` so they're shared across types — **before** Stage 2 import (governance §3 + a `CL-####` entry).
2. **Adopt the seven-dimension structure (A–G) as the schema for `pd_facet_links` + projections** — the dictionary maps 1:1 to facets + facet-links + media roles + applications + compatibility, so it loads without reshaping.
3. **Use this as the literal copy-template** for Overlock → Interlock → Embroidery → Heat Press → Cutting → Inspection → Spreading → Needle-Detection. Sewing types (Overlock/Interlock/Bartack/Buttonhole) inherit A2–A6 almost wholesale; only A1 Stitch and §7 compatibility keys change.
4. **Author the visual presentation metadata at the facet level once** (it's mostly type-independent — `max_speed` is always a high-comparison value-unit), so new types inherit sane defaults and only override exceptions.
5. **Wire the 5-assistant `ai_*` fields into `pd_ai_doc`** so AI answers are renderable and grounded (no invented specs) from day one.
6. **Sequencing:** this is documentation and is **not blocked** by the production baseline or Stage 2 — author the next dictionaries now; the baseline only gates *applying* them. (See `../../executive-roadmap.md` Phase B.)

> **Not applied.** This dictionary defines the knowledge structure; turning it into `pd_` rows/projections/UI happens in the gated implementation stages. No Stage 2 work is started by this document.
