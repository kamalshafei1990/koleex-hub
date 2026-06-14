# Lockstitch — Master Specification Dictionary (GOLDEN TEMPLATE) · v1.1 — FROZEN

**Product Type:** Industrial Lockstitch Sewing Machine · **Code prefix:** `XSL` · Division X → Sewing → Lockstitch.
**Version:** **1.1 (FROZEN 2026-06-14)** — supersedes v1.0. Enriched from real supplier catalogs (see [`lockstitch-catalog-extraction-report.md`](./lockstitch-catalog-extraction-report.md), CL-0004). This is the **official template** for Overlock (XSO), Interlock (XSI), and all future sewing types.
**Status:** Source-of-truth reference dataset. **Documentation only — not applied** (no schema/migrations/code). Governed by [`../coding-change-governance.md`](../coding-change-governance.md); visuals per [`../../architecture/visual-product-experience.md`](../../architecture/visual-product-experience.md); facets per [`../facet-dictionary-master.md`](../facet-dictionary-master.md).

### v1.1 change summary (vs v1.0)
- **+22 new facets** (real-catalog validated), grouped into the 7 lockstitch tiers (§1).
- **6 improvements:** richer `lubrication_type` enum · `arm_clearance` as W×H + new `max_sewing_thickness` · inch-capable `needle_gauge` · ISO stitch-class on `stitch_type` · expanded `needle_system` list · ball-bearing `table_mount_type`.
- New **CNC / Pattern-Sewing Lockstitch** facet group (A9).
- Compatibility, application, visual & AI metadata updated. **No field removed or renamed** — purely additive.

---

## 0. Conventions
Columns: **Field** (snake_case; ⊕ = new in v1.1) · **Display name** · **Type** · **Unit** · **Req** (● required · ○ optional · ◐ conditional) · **Tier** (§1) · **group** (`presentation_group`) · **icon_key** · **D/C/A** = display/comparison/ai priority (1 top–5 rare) · **Web/Quote** = visibility (✓ default · ○ on-expand · — hidden). Inheritance: `SKU ► Primary Model ► Family ► Product Type`.

## 1. Field Tier Categorization (every field belongs to one)

| Tier | Code | Meaning | Defining facets |
|---|---|---|---|
| **Core Lockstitch** | `Core` | base single-needle flat-bed essentials — apply to EVERY lockstitch (and inherited by all sewing types) | identity, stitch_type, bed_type, needle_count/system/size, feed_type, stitch_length_max, reverse_feed, hook_size, presser_foot_lift_manual, **needle_bar_stroke ⊕**, lubrication_type, drive_type, motor_type, max_speed, automation_level, voltage, weights, dims, fabric_weight_class ⊕ |
| **Advanced Lockstitch** | `Adv` | electronic / programmable / monitored | auto_thread_trim, auto_backtack, auto_foot_lift, needle_positioner, thread_wiper, programmable_panel, pattern_memory, **electronic_thread_clamp ⊕**, **piece_counter ⊕**, **bobbin_thread_counter ⊕**, **bobbin_thread_monitor ⊕**, **needle_thread_monitor ⊕**, **stitch_condensing ⊕**, **acceleration_time ⊕**, presser_foot_lift_knee, **thread_take_up_stroke ⊕** |
| **Heavy-Duty Lockstitch** | `HD` | compound-feed / thick-material | feed_type=compound, hook_size=large, needle_system∈{DP×17,DY×3,7×30}, **presser_foot_stroke ⊕** (walking foot), **max_sewing_thickness ⊕**, differential_ratio, air_pressure |
| **Cylinder-Bed Lockstitch** | `Cyl` | cylinder/筒型 | bed_type=Cylinder, **cylinder_diameter ⊕**, **cylinder_circumference ⊕** |
| **Post-Bed Lockstitch** | `Post` | post/柱型 | bed_type=Post, **post_height ⊕** |
| **Long-Arm Lockstitch** | `LA` | extended arm | bed_type=Long-arm, **arm_length ⊕**, arm_clearance(W×H) |
| **CNC / Pattern-Sewing Lockstitch** | `CNC` | 301 head on programmable XY frame / template | **sewing_field_xy ⊕**, **max_stitches_per_pattern ⊕**, **pattern_storage_count ⊕**, **pattern_file_format ⊕**, **pattern_scaling_range ⊕**, **template_recognition ⊕**, **controller_brand ⊕**, **mountable_head_compat ⊕**, **side_cutter_edge_width ⊕**, **cloth_cutting_thickness ⊕**, **productivity ⊕** |

A Primary Model carries **Core** always + the tier(s) matching its bed/feed/control. A model can hold multiple tiers (e.g. a cylinder-bed heavy-duty = Core+HD+Cyl).

---

## 2. Executive Summary
A product has three identities (Product Type / Primary Model / SKU). This dictionary defines **everything KOLEEX knows, shows, compares, and answers** about an industrial lockstitch machine across **seven knowledge dimensions** — **A** Technical · **B** Commercial · **C** Visual · **D** Comparison · **E** Compatibility · **F** Application · **G** AI. v1.1 counts: **~80 technical fields** (58 v1.0 + 22 v1.1) · 14 commercial · 13 visual roles · 22 compatibility link-fields · 5 application link-sets · AI metadata on every field. **Required core: 19** (v1.0's 18 + `needle_bar_stroke`). Knowledge-ready = required core + commercial + visual + full presentation metadata + ≥1 application link + needles populated + `ai_summary`/`ai_use_when`.

## 3. Identity block
| Field | Display | Type | Req | Tier | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `primary_model` | KOLEEX Model | text | ● | Core | Identity | tag | 1/1/1 | ✓/✓ |
| `product_type` | Product Type | single_select | ● | Core | Identity | category | 1/2/1 | ✓/○ |
| `family` | Series / Family | text | ○ | Core | Identity | layers | 2/3/2 | ✓/— |
| `brand` | Brand | text | ● | Core | Identity | brand | 2/4/3 | ✓/○ |
| `short_description` | Short description | text | ● | Core | Identity | doc | 1/3/1 | ✓/✓ |
| `long_description` | Full description | text | ○ | Core | Identity | doc | 3/5/2 | ✓/— |

---

## 4. (A) Technical Specifications

### A1 · Stitch & Configuration
| Field | Display | Type · Unit | Req | Tier | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `stitch_type` | Stitch type (+ **ISO class 301** ⊕-improved) | single_select | ● | Core | Stitch | stitch | 1/1/1 | ✓/✓ |
| `bed_type` | Bed type | single_select | ● | Core | Stitch | bed | 1/1/1 | ✓/✓ |
| `needle_count` | Needles | number | ● | Core | Stitch | needle | 1/1/1 | ✓/✓ |
| `needle_gauge` | Needle gauge (twin) **— now mm OR inch** ⊕-improved | measurement · mm/inch | ◐ | Adv | Stitch | gauge | 2/2/2 | ✓/○ |
| `seam_type_support` | Seam classes | multi_select | ○ | Adv | Stitch | seam | 3/3/2 | ✓/— |

`stitch_type` improvement: carries `iso_stitch_class` (301 lockstitch). `needle_gauge` improvement: accepts inch values (1/8″, 5/32″, 7/32″) and mm.

### A2 · Needle & Thread
| Field | Display | Type · Unit | Req | Tier | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `needle_system` | Needle system **(expanded list)** ⊕-improved | text | ● | Core | Needle&Thread | needle | 1/1/1 | ✓/✓ |
| `needle_size_range` | Needle size range | range · Nm | ● | Core | Needle&Thread | ruler | 2/2/2 | ✓/○ |
| `thread_type_support` | Thread types | multi_select | ○ | Core | Needle&Thread | thread | 3/3/2 | ✓/— |
| `thread_size_range` | Thread size range | range · Tex/Nm | ○ | Core | Needle&Thread | thread | 3/3/2 | ✓/— |
| `threading_path` | Threading type | single_select | ○ | Adv | Needle&Thread | route | 4/5/3 | ○/— |
| `thread_take_up_stroke` ⊕ | Thread take-up lever stroke | measurement · mm | ○ | Adv | Needle&Thread | lever | 4/4/3 | ○/— |

`needle_system` expanded controlled list: **DB×1 · DP×5 · DP×17 ⊕ · DC×27 · DY×3 ⊕ · CP×5 ⊕ · TV×7 · TV×5 ⊕ · TV×64 ⊕ · TQ×1 ⊕ · LW×6T ⊕ · UY×128 · DV×57 ⊕ · 7×23/7×25/7×30 ⊕ (extra-heavy leather)**.

### A3 · Feed System
| Field | Display | Type · Unit | Req | Tier | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `feed_type` | Feed mechanism | single_select | ● | Core | Feed | feed | 1/1/1 | ✓/✓ |
| `feed_dog_rows` | Feed-dog rows | number | ○ | Core | Feed | feed | 4/4/3 | ○/— |
| `stitch_length_max` | Max stitch length | measurement · mm | ● | Core | Feed | ruler | 1/1/1 | ✓/✓ |
| `feed_adjust_method` | Stitch-length adjust | single_select | ○ | Adv | Feed | dial | 4/4/3 | ○/— |
| `differential_ratio` | Differential ratio | range | ◐ | HD | Feed | ratio | 3/3/2 | ✓/— |
| `reverse_feed` | Reverse feed | boolean | ● | Core | Feed | reverse | 2/2/1 | ✓/○ |

### A4 · Bed, Hook, Lubrication & Geometry
| Field | Display | Type · Unit | Req | Tier | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `hook_size` | Rotary hook size | single_select | ● | Core | Mechanics | hook | 2/2/1 | ✓/○ |
| `hook_type` | Hook type | single_select | ○ | Core | Mechanics | hook | 3/3/2 | ✓/— |
| `needle_bar_stroke` ⊕ | Needle bar stroke | measurement · mm | ● | Core | Mechanics | stroke | 2/2/1 | ✓/○ |
| `presser_foot_lift_manual` | Foot lift (manual) | measurement · mm | ● | Core | Mechanics | lift | 2/2/1 | ✓/○ |
| `presser_foot_lift_knee` | Foot lift (knee/auto) | measurement · mm | ○ | Adv | Mechanics | lift | 3/3/2 | ✓/— |
| `presser_foot_stroke` ⊕ | Presser-foot (walking) stroke | measurement · mm | ◐ | HD | Mechanics | lift | 3/3/2 | ✓/— |
| `lubrication_type` | Lubrication **(richer enum)** ⊕-improved | single_select | ● | Core | Mechanics | oil | 2/2/1 | ✓/○ |
| `arm_clearance` | Work space (arm) **W × H** ⊕-improved | measurement · mm | ○ | LA | Mechanics | ruler | 3/4/3 | ○/— |
| `max_sewing_thickness` ⊕ | Max sewing thickness / feeding space | measurement · mm | ○ | HD | Mechanics | layers | 3/3/2 | ✓/— |
| `cylinder_diameter` ⊕ | Cylinder diameter | measurement · mm | ◐ | Cyl | Mechanics | cylinder | 2/3/2 | ✓/○ |
| `cylinder_circumference` ⊕ | Cylinder circumference | measurement · mm | ○ | Cyl | Mechanics | cylinder | 4/4/3 | ○/— |
| `post_height` ⊕ | Post height | measurement · mm | ◐ | Post | Mechanics | post | 2/3/2 | ✓/○ |
| `arm_length` ⊕ | Arm length (long-arm) | measurement · mm | ◐ | LA | Mechanics | arm | 2/3/2 | ✓/○ |

`hook_type`: Standard rotary · Large rotary · Vertical-axis · Shuttle. `lubrication_type` (improved): **Dry-head (oil-free) · Semi-dry (hook-only) · Micro-oil · Sealed-oil-pan · Auto-lube · Manual**. `cylinder_diameter`/`post_height`/`arm_length` required (◐) when `bed_type` = Cylinder/Post/Long-arm respectively.

### A5 · Drive, Motor & Speed
| Field | Display | Type · Unit | Req | Tier | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `drive_type` | Drive | single_select | ● | Core | Drive | motor | 1/1/1 | ✓/✓ |
| `motor_type` | Motor type | single_select | ● | Core | Drive | motor | 2/2/1 | ✓/○ |
| `motor_power` | Motor power | measurement · W | ○ | Core | Drive | power | 3/3/2 | ✓/— |
| `max_speed` | Max sewing speed | measurement · spm | ● | Core | Performance | speed | 1/1/1 | ✓/✓ |
| `recommended_speed` | Recommended speed | measurement · spm | ○ | Adv | Performance | speed | 3/4/3 | ○/— |
| `acceleration_time` ⊕ | Acceleration (0→max) | measurement · ms | ○ | Adv | Performance | bolt | 4/4/3 | ○/— |
| `noise_level` | Noise level | measurement · dB(A) | ○ | Adv | Performance | sound | 4/5/3 | ○/— |
| `productivity` ⊕ | Output / cycle | measurement · pcs/h or s/pc | ○ | CNC | Performance | gauge | 3/4/2 | ✓/○ |

### A6 · Automation & Electronics
| Field | Display | Type | Req | Tier | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `automation_level` | Automation | single_select | ● | Core | Automation | automation | 1/1/1 | ✓/✓ |
| `auto_thread_trim` | Auto thread trimmer | boolean | ● | Adv | Automation | scissors | 1/1/1 | ✓/✓ |
| `auto_backtack` | Auto back-tack | boolean | ● | Adv | Automation | reverse | 2/2/1 | ✓/○ |
| `auto_foot_lift` | Auto presser lift | boolean | ● | Adv | Automation | lift | 2/2/1 | ✓/○ |
| `needle_positioner` | Needle up/down | boolean | ● | Adv | Automation | needle | 2/2/1 | ✓/○ |
| `thread_wiper` | Thread wiper | boolean | ○ | Adv | Automation | wipe | 3/3/2 | ✓/— |
| `electronic_thread_clamp` ⊕ | Electronic thread clamp/tension | boolean | ○ | Adv | Automation | clamp | 3/3/2 | ✓/— |
| `stitch_condensing` ⊕ | Stitch condensing (end-lock) | boolean | ○ | Adv | Automation | condense | 3/3/2 | ✓/— |
| `programmable_panel` | Control panel | single_select | ○ | Adv | Automation | panel | 2/3/2 | ✓/○ |
| `pattern_memory` | Pattern/stitch memory | boolean | ○ | Adv | Automation | memory | 3/3/2 | ✓/— |
| `piece_counter` ⊕ | Piece counter | boolean | ○ | Adv | Automation | counter | 4/4/3 | ○/— |
| `bobbin_thread_counter` ⊕ | Bobbin-thread counter | number | ○ | Adv | Automation | counter | 4/4/3 | ○/— |
| `bobbin_thread_monitor` ⊕ | Bobbin-thread monitor | boolean | ○ | Adv | Automation | sensor | 4/4/3 | ○/— |
| `needle_thread_monitor` ⊕ | Needle-thread/break monitor | boolean | ○ | Adv | Automation | sensor | 4/4/3 | ○/— |

`programmable_panel`: None · LED · Touchscreen.

### A7 · Utilities & Electrical
| Field | Display | Type · Unit | Req | Tier | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `voltage` | Voltage | multi_select · V | ● | Core | Power | power | 2/4/2 | ✓/○ |
| `frequency` | Frequency | multi_select · Hz | ○ | Core | Power | power | 4/5/3 | ○/— |
| `phase` | Phase | single_select | ● | Core | Power | power | 3/4/2 | ✓/○ |
| `power_consumption` | Power consumption | measurement · W | ○ | Core | Power | power | 3/4/2 | ✓/— |
| `air_pressure` | Air requirement | measurement · MPa | ◐ | HD | Power | air | 4/4/3 | ○/— |
| `air_consumption` ⊕ | Air consumption | measurement · L/min | ○ | CNC | Power | air | 5/5/3 | —/— |
| `plug_type` | Plug type | single_select | ○ | Core | Power | plug | 5/5/3 | —/— |

### A8 · Physical / Dimensions
| Field | Display | Type · Unit | Req | Tier | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|---|
| `head_dimensions` | Head L×W×H | text · mm | ○ | Core | Physical | ruler | 4/5/3 | ○/— |
| `table_size` | Table size | text · mm | ○ | Core | Physical | table | 4/5/3 | ○/— |
| `net_weight` | Net weight (head) | measurement · kg | ○ | Core | Physical | weight | 3/4/3 | ✓/— |

### A9 ⊕ · CNC / Pattern-Sewing Lockstitch (Tier = CNC)
*Applies only to 301-head machines on a programmable XY frame / template (Bote, FDK, Jaki, Goldsew template lines).*
| Field | Display | Type · Unit | Req | group | icon_key | D/C/A | Web/Quote |
|---|---|---|---|---|---|---|---|
| `sewing_field_xy` ⊕ | Sewing area X×Y | text · mm | ● (CNC) | CNC | field | 1/2/1 | ✓/✓ |
| `max_stitches_per_pattern` ⊕ | Max stitches / pattern | number | ○ | CNC | memory | 3/3/2 | ✓/— |
| `pattern_storage_count` ⊕ | Pattern storage | number | ○ | CNC | memory | 3/4/3 | ✓/— |
| `pattern_file_format` ⊕ | Pattern file formats | multi_select | ○ | CNC | file | 4/4/3 | ○/— |
| `pattern_scaling_range` ⊕ | Scaling range | range · % | ○ | CNC | scale | 4/4/3 | ○/— |
| `template_recognition` ⊕ | Template recognition | single_select | ○ | CNC | rfid | 3/4/3 | ✓/— |
| `side_cutter_edge_width` ⊕ | Side-cutter edge width | measurement · mm | ◐ | CNC | knife | 3/3/2 | ✓/— |
| `cloth_cutting_thickness` ⊕ | Cloth-cutting thickness | measurement · mm | ○ | CNC | knife | 4/4/3 | ○/— |

`pattern_file_format`: DXF · PLT · DST · NTP · DHP · SLW. `template_recognition`: RFID · none.

---

## 5. (B) Commercial Specifications
*(unchanged from v1.0 — all Core/commercial)* `moq` ● · `warranty` ● · `certification` ● (CE/CCC/UL/RoHS/ISO9001) · `country_of_origin` ● · `lead_time` ● · `market_availability` ● · `hs_code` ● · `weight_net`/`weight_gross` ● · `cbm` ● · `packing_type` ● · `packing_size` ○ · `container_20ft_qty`/`container_40ft_qty` ○. Supplier fields (`supplier_id`, `supplier_model_code`, `supplier_moq`, `factory_unit`) = internal SKU/sourcing layer (web —/quote —). Pricing lives in Commercial Policy.

## 6. (C) Visual Specifications
Asset roles attach to `product_media` via `image_role`; resolution `SKU ► Model ► Family ► Type ► icon`.
| `image_role` | Purpose | Req | Surfaces |
|---|---|---|---|
| `hero` | Primary product image | ● | Card · Website · Quote |
| `gallery` | Product views (≥2) | ● | Website · Card |
| `detail` | Machine detail close-ups (hook/feed/panel) | ○ | Website · Spec card |
| `diagram` | Technical / line / dimension diagram | ○ | Spec card · Catalog · AI |
| `application` | In-use / on-garment | ○ | Website · AI · Catalog |
| `spare_part` | Part / exploded view | ○ | Compatibility · BOM |
| `packing` | Packing / crate | ○ | Quote · Logistics |
| `video` | Demo / operation (URL) | ○ | Website · AI |
| `stitch_sample` ⊕ | Seam/stitch swatch | ○ | Website · AI · Compare |
| `process_diagram` ⊕ | Operation→model garment-process map | ○ | AI (Factory Builder) · Website |
| `symbol_legend` ⊕ | Spec pictogram glossary | ○ | (icon-system source) |
| `parts_chart` ⊕ | Spare-parts photo chart | ○ | Compatibility · Service |
| `code_builder` ⊕ | Model-code-builder diagram | ○ | (coding/SKU logic) |

## 7. (D) Comparison Specifications
Product / AI / Website / Quotation compare matrix unchanged from v1.0 (max_speed, bed_type, feed_type, needle_count, drive/motor, automation_level, auto_thread_trim, warranty, origin lead all). **v1.1 additions to compare:** `needle_bar_stroke` (Product+AI), `fabric_weight_class` (all four — key buyer filter), `max_sewing_thickness` (Product+AI for HD), `sewing_field_xy` (Product+AI for CNC). `comparison_display = highlight-diff` on differentiators.

## 8. (E) Compatibility Specifications
Per the [compatibility rulebook](../compatibility-rulebook.md): `source → target`, `comp_type ∈ {fits,requires,pairs,alt,supersedes,upgrades}`, typed match-spec, exclusions, confidence.
| Linked class | Match/identity fields | Link type |
|---|---|---|
| Needles | `needle_system` (expanded list §A2), `needle_size_range`, `point_type` | requires |
| Presser feet | `function_token=PSF`, `bed_type`, `gauge`, `attachment_mount` | fits |
| Spare parts | `function_token`, `needle_system`, `oem_vs_aftermarket` | fits |
| Attachments / folders | `function_token=FLD`, `bed_type`, `application` | pairs |
| Devices (factory-fit) | `device_id`, `function_token`, `sku_affecting` | upgrades |
| Motors | `motor_type`, `voltage`, `phase`, `mount_type` | fits/requires |
| Tables / stands | `table_size`, `bed_type`, `cutout_type`, **`table_mount_type` ⊕** (ordinary/ball-bearing/air-float) | requires |
| Bobbins / hooks | `hook_size`, `hook_type`, **`hook_model` ⊕**, **`hook_brand` ⊕** (e.g. KSP-204N, KRT132, Hirose) | requires |
| **Mountable head (CNC frames)** ⊕ | **`mountable_head_compat`** (JUKI·SIRUBA·PEGASUS·HIKARI·LIJIA·KANSAI) | fits |
| **Controller** ⊕ | **`controller_brand`** (DAHAO/大豪·誉财·星火·SYSTEMTOP) | requires |

## 9. (F) Application Specifications
| Link-set | Field | Source |
|---|---|---|
| Fabric duty class ⊕ | **`fabric_weight_class`** (Light·Medium·Heavy·Extra-heavy) | coded tier (every catalog grades this) |
| Garment types | `garment_type` | controlled list |
| Fabrics | `fabric_type` | facet dictionary |
| Operations | `operation` | operation-library (+ corner-sew, French-roll hem, edge-bind, welt pocket, placket, dart pleat, trademark attach, waistband, felled seam) |
| Applications | `application` | application-dictionary |
| Industries ⊕-expanded | `industry` | Apparel · Footwear · Leather goods · Luggage · **Automotive interiors** · **Technical textiles** (tents/sails/FIBC/parachute) · **Military & safety** · Furniture/upholstery · Bedding/mattress · Home textile |

## 10. (G) AI Knowledge Specifications
`pd_ai_doc` carries all fields + AI metadata: `ai_priority` (per field) · `ai_visual_hint` · `ai_synonyms` · `ai_summary` · `ai_use_when` · `ai_not_for` · `ai_faq` · `confidence`.
**v1.1 AI additions:**
- **Needle↔fabric rule set** — `needle_system` × `fabric_weight_class` mapping (DB×1 light/medium · DP×5 medium-heavy · DP×17/DY×3/7×30 heavy-leather) → powers Spare-Parts & Service Assistants' needle selection.
- **`process_diagram` (operation→model)** → Factory Builder Assistant.
- **`symbol_legend`** → consistent iconography + spec-explanation answers.
- **`fabric_weight_class` + `ai_use_when`/`ai_not_for`** → Product & Quotation Assistants recommend by duty (e.g. "DP×17 + 8 mm stitch + 13 mm lift → heavy denim/leather; not fine knit").
- **`controller_brand` + `pattern_file_format`** → Service Assistant (template-machine support).
Per-assistant needs (Product / Spare-Parts / Factory-Builder / Quotation / Service) per v1.0 §9, now enriched with the above.

---

## 11. Required vs Optional (v1.1)
**Required core — 19:** `primary_model`, `product_type`, `brand`, `short_description`, `stitch_type`, `bed_type`, `needle_count`, `needle_system`, `feed_type`, `stitch_length_max`, `reverse_feed`, `hook_size`, `needle_bar_stroke` ⊕, `presser_foot_lift_manual`, `lubrication_type`, `drive_type`, `motor_type`, `max_speed`, `automation_level` (auto-function booleans default `false`).
**Required commercial:** moq, warranty, certification, country_of_origin, lead_time, market_availability, hs_code, weight_net, weight_gross, cbm, packing_type. **Required visual:** hero + ≥2 gallery + icon_key.
**Conditional ◐:** `needle_gauge` (twin) · `differential_ratio` (differential) · `air_pressure` (pneumatic) · `cylinder_diameter`/`cylinder_circumference` (Cyl) · `post_height` (Post) · `arm_length` (LA) · `presser_foot_stroke` (walking foot) · `sewing_field_xy` (CNC) · `side_cutter_edge_width` (side-cutter).
**Tier-gated requirement:** a model is "knowledge-ready for its tier" only when its tier's defining facets (§1) are populated.

## 12. New Facets Added (22) · Existing Improved (6)
**New (⊕):** needle_bar_stroke · presser_foot_stroke · thread_take_up_stroke · fabric_weight_class · cylinder_diameter · cylinder_circumference · post_height · arm_length · max_sewing_thickness · side_cutter_edge_width · cloth_cutting_thickness · electronic_thread_clamp · piece_counter · bobbin_thread_counter · bobbin_thread_monitor · needle_thread_monitor · stitch_condensing · acceleration_time · productivity · sewing_field_xy · max_stitches_per_pattern · pattern_storage_count · pattern_file_format · pattern_scaling_range · template_recognition · controller_brand · air_consumption · mountable_head_compat · hook_model · hook_brand · table_mount_type.
*(Headline 22 are the spec facets; the compatibility/visual ones above are promoted alongside.)*
**Improved (6):** `lubrication_type` (6-value enum) · `arm_clearance` (W×H) + `max_sewing_thickness` · `needle_gauge` (mm/inch) · `stitch_type` (+ISO 301) · `needle_system` (expanded list) · `table_mount_type` (ball-bearing).

## 13. Final Coverage Assessment
Lockstitch single-needle mainstream **~99%** (v1.1 closes the mechanical-stroke + duty-class gaps). Full lockstitch family incl. heavy/cylinder/post/long-arm/CNC-template **~95%** (v1.0 was ~76%). Remaining ~5% = ultra-niche premium features cataloged but deferred (thread_nipper, light_stroke_system, cross_seam_climbing, second_thread_tension, needle_cooler, integrated_led_lamp, dual_stitch_length, air_free_actuation) — listed for a future minor bump if demanded.

---

## 14. FREEZE — v1.1
**Lockstitch (XSL) Master Specification Dictionary is FROZEN at v1.1 (2026-06-14).** It is the **official copy-template** for Overlock (XSO) → Interlock (XSI) → Embroidery → Heat Press → Cutting → Fabric Inspection → Fabric Spreading → Needle Detection → all future types. Sewing types inherit Core + Advanced (A2–A6) almost wholesale; only A1 Stitch and §8 compatibility keys change per type. Changes follow `../coding-change-governance.md` (a new `CL-####` per change). **Not applied** — implementation lands with the gated `pd_` stages; no Stage 2 started by this document.
