# Master Specification Dictionary — Gap Analysis

> **Documentation only.** No schema, code, migration, or production change is implied or authorized by this file. This is a planning artifact that decides **which Product Types get a Master Specification Dictionary first** and **what each one is missing today**.
>
> Source-of-Truth inputs: [`product-types-master.md`](reference-data/product-types-master.md) · [`facet-dictionary-master.md`](reference-data/facet-dictionary-master.md) · [`application-dictionary-master.md`](reference-data/application-dictionary-master.md) · [`compatibility-rulebook.md`](reference-data/compatibility-rulebook.md) · [`device-dictionary-master.md`](reference-data/device-dictionary-master.md) · [`visual-product-experience.md`](architecture/visual-product-experience.md) · [`sku-strategy.md`](reference-data/sku-strategy.md).

---

## 0. What a "Master Specification Dictionary" means per Product Type

A type is **knowledge-ready** when it carries all five layers below — not just a spec list. This is the definition used to score "Missing" columns in §2.

| Layer | What it must define for the type | Drawn from |
|---|---|---|
| **1. Specification set** | The complete, ordered set of facets (required + comparison + descriptive) that fully describes a machine of this type, each typed and unit-bound. Includes the facets *missing* from the registry today (e.g. `needle_system`, `presser_foot_lift`, `power_consumption`). | facet-dictionary |
| **2. Visual metadata** | Per type: `icon_key` (+ `icon_style`), `diagram_image` placeholder, `presentation_group` ordering, `badge_style` vocabulary. Per facet: display style (chip/meter/boolean-icon/value-unit/swatch), `spec_card_priority`, per-option `icon_key`. | visual-product-experience §2–§8, §17 |
| **3. Comparison metadata** | Which facets compare and how — `comparison_display` (`always`/`highlight-diff`/`hidden`) on every comparison facet, aligned by `presentation_group`/`spec_card_priority` so two models of the type render diff-aware side-by-side. | visual-product-experience §11 |
| **4. Compatibility metadata** | The device list (factory-fit options) + part-fitment spine for the type: which `needle_system`/`gauge`/`hook_size` attributes drive attribute-fitment, which relations apply (Fits/Requires/Pairs/Upgrades), and the `presentation_group` each relation renders in. | compatibility-rulebook, device-dictionary |
| **5. AI metadata** | `ai_visual_hint` per type/facet (card / spec-card / compatibility-map / diagram / gallery), the `pd_ai_doc` field plan, and natural-language synonyms so the RAG/knowledge-graph layer can answer "fastest lockstitch for denim" from existing metadata only. | visual-product-experience §12 |

"Done" = all five present and passing the approval-matrix visual gate. Today **every** type has Layer 1 partially (required + comparison facets are listed in the registry) and **almost no type has Layers 2–5** — that asymmetry is the headline finding (§5).

---

## 1. Method note — how value was scored

Each Product Type was scored on four business signals, then bucketed **High / Med / Low**. Coding status (✅ live vs ▲ proposed) was *noted but not used* as the ranking driver — per instructions the priority is business value.

| Signal | Weight | Rationale |
|---|---|---|
| **Customer-facing demand** | Highest | How often a buyer/quotation actually selects this type. Driven by how many Applications in `application-dictionary-master.md` route to it. The industrial-sewing core (lockstitch/overlock/cover) appears in nearly every apparel/knit/woven row. |
| **Catalog volume** | High | How many Models/SKUs KOLEEX will hold of this type. Sewing heads and presses are high-volume, multi-model; ultrasonic or mattress machines are long-tail. |
| **Flagship status** | High | Whether the type anchors the brand story and is already ✅-live with a seed asset (Lockstitch PTE template, NEXD 9000 benchmark). |
| **Spec reuse across siblings** | Medium | Whether the dictionary, once built, seeds many neighbours cheaply. The sewing-head spec set (bed_type, needle/thread count, drive, speed, gauge, needle_system, devices) is ~80% shared across all of Category XS — build once, reuse ~18×. |

**Bucketing rule:** High = strong on demand **and** (volume or flagship). Med = strong on one signal, moderate elsewhere. Low = long-tail demand and volume, even if technically interesting.

---

## 2. Coverage matrix (grouped by category / subcategory, assessed at Product-Type level)

**Coverage legend** — *Existing spec coverage* reflects Layer 1 only (the registry already lists required + comparison facets). *Missing* columns reflect Layers 2–5, which are absent system-wide unless noted. "Spec coverage = Good" still means visual/comparison/compat/AI metadata is missing — see §5.

### A. Industrial Sewing Machines (XS)

| Product Type | Spec coverage | Missing specifications | Missing visual attrs | Missing comparison attrs | Missing compatibility attrs | Missing AI attrs | Value |
|---|---|---|---|---|---|---|---|
| **Lockstitch (XSL)** | Good | `needle_system`, `presser_foot_lift_mm`, `stitch_length_max`, `power_consumption`, `oil_system`(dry/lubricated) | per-option `icon_key` (bed_type/drive), `diagram_image`, `spec_card_priority` order | `comparison_display` on `max_speed`/`drive_type` (highlight-diff) | `needle_system`/`gauge`/`hook_size` not flagged as attribute-fitment keys; device `presentation_group` | `ai_visual_hint`, NL synonyms ("single needle") | **High** |
| **Overlock (XSO)** | Good | `needle_system`, `differential_ratio_range`, `stitch_width`, `presser_foot_lift_mm`, `power_consumption` | per-option icons, diagram, group order | `comparison_display` on `thread_count`/`differential_feed` | attribute-fitment keys (looper/feed-dog by family+gauge); device group | `ai_visual_hint`, synonyms ("serger") | **High** |
| **Interlock/Coverstitch (XSI)** | Good | `needle_system`, `gauge_value`, `top_cover_width`, `presser_foot_lift_mm` | per-option icons, diagram, group order | `comparison_display` on `needle_count`/`top_cover`/`gauge` | gauge as attribute-fitment key; binder/folder fit | `ai_visual_hint`, synonyms ("coverstitch") | **High** |
| **Chainstitch (XSC)** | Partial | `needle_system`, `gauge_value`, `feed_off_arm` value, `max_speed`(missing from required) | icons, diagram, group order | `comparison_display` on FOA/gauge | folder/tape-feeder attribute fit | `ai_visual_hint`, synonyms | **High** |
| **Flatlock (XSF)** ▲ | Partial | `needle_system`, `gauge_value`, `max_speed`, `differential_ratio_range` | full visual set | comparison_display all | attribute keys + device group | full AI set | Med |
| Buttonhole / Eyelet / Button / Bartack (XSBH/XSEB/XSBA/XSBT) ▲ | Partial | `programmable_memory`, `sewing_area_mm`, `cycle_time`, `max_speed`(where absent) | full visual set | electronic-vs-mechanical compare hint | programmable-pattern device group | full AI set | Med |
| Blind / Zigzag / Picot (XSBL/XSZ/XSPC) ▲ | Partial | `needle_system`, `max_speed`, `stitch_geometry` | full visual set | comparison_display | device attribute fit | full AI set | Low |
| Elastic / Waistband / Belt-loop / Smocking (XSEA/XSWB/XSBLP/XSSM) ▲ | Partial | `gauge_value`, `metering_type`, `needle_count` value | full visual set | comparison_display | feeder/puller device group | full AI set | Med |
| Bag-closing / Mattress / Ultrasonic (XSBG/XSMT/XSUS) ▲ | None–Partial | type-specific (`max_thickness`, `working_width`, `power`) under-specified; need `power_consumption`, `air_pressure` | full visual set | comparison_display | device group | full AI set | Low |

### B. Automatic Sewing Systems (XA) — all ▲ proposed

| Product Type | Spec coverage | Missing specifications | Missing visual attrs | Missing comparison attrs | Missing compatibility attrs | Missing AI attrs | Value |
|---|---|---|---|---|---|---|---|
| **Programmable Pattern Sewing (XAPS)** | Partial | `working_field` value, `head_type` detail, `programmable_memory`, `cycle_time`, `power_consumption`, `air_pressure` | full visual set + `diagram_image` (work envelope) | `comparison_display` on `working_field`/`max_speed` | stacker/laser-marker `Requires`/`Pairs` rules + group | `ai_visual_hint` (compatibility-map), synonyms | **Med-High** |
| Pocket Welt / Patch Pocket / Placket / Collar-Cuff / Sleeve / Hemming / Label / Dart / Indexer (XAPW…XAIX) | Partial | per-type: `working_field`, stage/`operation_stage`, `stacker` value, `cycle_time`, `air_pressure` | full visual set | comparison_display | inline-device `Requires`/`Pairs` + group | full AI set | Med |

### C. Cutting Equipment (XC)

| Product Type | Spec coverage | Missing specifications | Missing visual attrs | Missing comparison attrs | Missing compatibility attrs | Missing AI attrs | Value |
|---|---|---|---|---|---|---|---|
| **Straight / Round / Band Knife (XCS/XCR/XCB)** ✅ | Good | `power_consumption`, `weight`, `blade_material` (facet exists, not wired to type), `noise_level` | per-option icons, diagram, group order | `comparison_display` on `cutting_height`/`blade_size`/`auto_sharpening` | auto-sharpener `Pairs`; blade attribute-fit | `ai_visual_hint`, synonyms | **High** |
| **Automatic Multi-Ply Cutter (XCCM)** ▲ | Partial | `working_width` value, `vacuum_power` value, `conveyor` spec, `power_consumption`, `air_pressure`, integrated-head list | full visual set + work-envelope diagram | `comparison_display` on width/height/heads | drill/notch/labeler `Requires`+group; `Pairs` spreader | AI compatibility-map | **High** |
| **Laser Cutter (XCL)** ✅ | Good | `laser_power` value, `working_width` value, `fume_extraction` spec, `power_consumption` | full visual set | comparison_display galvo-vs-flatbed | vision/conveyor/fume `Requires`+group | AI set | Med-High |
| Single-Ply Cutter / Die Press / End/Strip/Tape Cutter / Drill / Notcher (XCCS/XCDP/XCE/XCST/XCTC/XCD/XCN) | Partial–Good | per-type values; `cutting_force`, `tool_type`, `power_consumption` | full visual set | comparison_display | device `Requires`/`Pairs` | full AI set | Med (XCD ✅ Med) |

### D. Fabric Preparation (XPR)

| Product Type | Spec coverage | Missing specifications | Missing visual attrs | Missing comparison attrs | Missing compatibility attrs | Missing AI attrs | Value |
|---|---|---|---|---|---|---|---|
| **Spreading Machine (XPRS)** ✅ | Good | `max_width` value, `spreading_mode`, `power_consumption`, `roll_weight_max` | per-option icons, diagram, group order | `comparison_display` on width/automation/mode | `Pairs-With` cutter + spreading table; device group | AI set + synonyms | **High** |
| **Inspection Machine (XPRI)** ✅ | Good | `max_width` value, `measuring` accuracy, `inspection_method` (AI) detail, `power_consumption` | full visual set | comparison_display | ai_defect/auto-measuring device group | **AI defect** answer hint (flagship AI story) | **High** |
| **Spreading/Cutting Table (XPRT)** ✅ | Good | `length`/`width` values, `surface_type` (facet `table_surface_type` not wired), sectioned-vacuum spec | full visual set | comparison_display | `Pairs-With` spreader+cutter | AI set | Med |
| Relaxing / Winding / Tubular / Storage / Cradle (XPRR/XPRL/XPRK/XPRSR/XPRCF) | Partial–Good | `max_width`, `roll_capacity`, `winding_type`, `power_consumption` values | full visual set | comparison_display | device + `Pairs` rules | full AI set | Med |

### E. Finishing Equipment (XF)

| Product Type | Spec coverage | Missing specifications | Missing visual attrs | Missing comparison attrs | Missing compatibility attrs | Missing AI attrs | Value |
|---|---|---|---|---|---|---|---|
| **Fusing Machine (XFFP)** ✅ | Good | `belt_width` value, `temperature_range` value, `belt_speed`, `power_consumption`, `working_width` | per-option icons, diagram, group order | `comparison_display` on fusing_type/belt_width/temp | double-belt/cooling `Requires`+group | AI set | **High** |
| **Steam Boiler/Generator (XFSB)** ✅ | Good | `boiler_capacity` value, `irons_supported` value, `heating_method` value, `power_consumption`, `pressure` | full visual set | comparison_display | **`Pairs-With` iron/table** (key relation); auto-fill device | AI compatibility-map | Med-High |
| Steam Iron / Ironing Table / Collar-Cuff Press / Press / Finishers / Tunnel / Thread-suck / Spotting (XFSI/XFIT/XFCP/XFPB/XFFF/XFSH/XFTT/XFST/XFTS/XFSP) | Partial–Good | per-type values; `steam_source`, `actuation`, `tensioning_method`, `power_consumption`, `air_pressure` | full visual set | comparison_display | device `Requires`/`Pairs` + group | full AI set | Med (Iron/Table/Press) → Low (tunnel/spotting) |

### F. Embroidery Equipment (XE)

| Product Type | Spec coverage | Missing specifications | Missing visual attrs | Missing comparison attrs | Missing compatibility attrs | Missing AI attrs | Value |
|---|---|---|---|---|---|---|---|
| **Multi-Head Embroidery (XEM)** ✅ | Good | `head_count` value, `head_pitch` value, `field_size` value, `needle_count` value, `power_consumption` | per-option icons, diagram, **device `Yes`/SKU-affecting** badge | `comparison_display` on heads/pitch/needle/speed | sequin/cording/boring **SKU-affecting** device rules + group | AI set + synonyms | **High** |
| **Single-Head Embroidery (XES)** ✅ | Good | same set as XEM (single-head scope), `tubular_vs_flat` | full visual set | comparison_display | cap/sequin/cording device + group | AI set | Med-High |
| Chenille / Combination (XEB/XEC) | Partial | `pile_height`, `technique_set`, `stitch_capability` | full visual set | comparison_display | combination/cording device | full AI set | Med |

### G. Printing & Heat Transfer (XP)

| Product Type | Spec coverage | Missing specifications | Missing visual attrs | Missing comparison attrs | Missing compatibility attrs | Missing AI attrs | Value |
|---|---|---|---|---|---|---|---|
| **Heat Press — Flat (XPH)** ✅ | Good | `platen_size` value, `temperature_range`, `pressure`, `stations` value, `power_consumption` | per-option icons (platen_shape), diagram, group | `comparison_display` on platen/actuation/stations | cap/mug/plate platen **interchange** device + group | AI set + synonyms | **High** |
| **DTG Printer (XPDT)** ✅ | Good | `print_area` value, `ink_set`, `resolution`, `throughput` value, `power_consumption` | full visual set | comparison_display white-ink/throughput | pretreat/bulk-ink + **`Requires` pretreat workflow** | AI compatibility-map | Med-High |
| **DTF Printer (XPDF)** ▲ | Partial | `film_width` value, `ink_set`, `resolution`, `roll_fed`, `power_consumption` | full visual set | comparison_display roll-vs-sheet/white-ink | **`Requires` Powder Shaker + Heat Press** (flagship multi-machine rule) + group | AI compatibility-map | Med-High |
| Screen / Sublimation / Dryer / Powder-Shaker / Calender (XPSP/XPSU/XPCD/XPPS/XPRH) | Partial–Good | per-type values; `color_count`, `print_width`, `belt_width`, `max_temp`, `power_consumption` | full visual set | comparison_display | dryer/take-up/cure `Requires`/`Pairs` + group | full AI set | Med |

### H. Packing & Inspection (XPC)

| Product Type | Spec coverage | Missing specifications | Missing visual attrs | Missing comparison attrs | Missing compatibility attrs | Missing AI attrs | Value |
|---|---|---|---|---|---|---|---|
| **Needle Detector (XPCN)** ✅ | Good | `belt_width` value, `sensitivity` value, `aperture`, `power_consumption`, conveyor speed | per-option icons (form), diagram, group | `comparison_display` on belt_width/sensitivity | auto-reject/marking **SKU-affecting** device + group | AI set + **mandatory-for-baby/medical** answer hint | **High** |
| **Folding Machine (XPCF)** ✅ | Good | `garment_type`, `automation_level` value, `throughput` value, `power_consumption`, footprint | full visual set | comparison_display garment/automation/throughput | inline-bagging/conveyor `Pairs` + group | AI set | Med-High |
| Metal / X-Ray / Checkweigher (XPCM/XPCX/XPCW) | Good | `aperture`, `resolution`, `weight_range`, `accuracy`, `power_consumption` | full visual set | comparison_display | auto-reject/combo `Requires`+group | AI + mandatory-detection hint | Med-High |
| Carton Seal / Bagging / Sealing / Shrink / Vacuum / Strapping (XPCC/XPCB/XPCS/XPCW2/XPCV/XPCT) | Partial–Good | per-type values; `carton_range`, `seal_length`, `throughput`, `power_consumption` | full visual set | comparison_display | device `Requires`/`Pairs` + group | full AI set | Med (XPCC ✅) → Low |

---

## 3. Priority list — highest → lowest business value

1. **Lockstitch (XSL)** — flagship, already seeded (PTE template + NEXD 9000), routes to nearly every application, spec set seeds all of XS.
2. **Overlock (XSO)** — second-most-selected sewing head; in every knit/apparel bill.
3. **Interlock / Coverstitch (XSI)** — core knitwear/sportswear/underwear trio with XSL/XSO.
4. **Multi-Head Embroidery (XEM)** — high-value, high-margin flagship; device-config drives SKU economics.
5. **Heat Press — Flat (XPH)** — highest-volume transfer machine; clean enumerated specs.
6. **Straight Knife Cutter (XCS)** + Round/Band siblings — cutting room is in every factory bill; specs reuse 3×.
7. **Needle Detector (XPCN)** — mandatory for baby/medical/PPE; compliance-critical buyer question.
8. **Fabric Spreading Machine (XPRS)** — anchors the cutting-room `Pairs-With` story; high attach rate to cutters.
9. **Fabric Inspection Machine (XPRI)** — flagship AI story (AI defect detection) — best showcase for the AI metadata layer.
10. **Fusing Machine (XFFP)** — high-volume finishing; clean spec set; clear device upgrades.
11. **Chainstitch (XSC)** — denim/heavy core; completes the XS sewing-head family.
12. **DTF Printer (XPDF)** — fast-growing demand; flagship multi-machine `Requires` rule (Powder Shaker + Heat Press).
13. **Folding Machine (XPCF)** — high attach rate in packing lines.
14. **Programmable Pattern Sewing (XAPS)** — anchors the entire XA automation division.
15. **Automatic Multi-Ply Cutter (XCCM)** — high-ticket, high-margin; anchors automated cutting.
16. *(Long-tail: remaining XA/XF/XPC/XS proposed types — build as their parent dictionary is reused.)*

---

## 4. TOP 10 — build Master Specification Dictionaries first

| # | Product Type | Why (1 line) | Core specs to define | What already exists to seed it |
|---|---|---|---|---|
| 1 | **Lockstitch (XSL)** | Flagship sewing head, in almost every application bill; its dictionary seeds all of Category XS. | ~14 (stitch_type, bed_type, drive_type, max_speed, needle_count, hook_size, gauge, **needle_system**, **presser_foot_lift_mm**, stitch_length_max, oil_system, power_consumption, voltage, dimensions) | **Lockstitch PTE template** (live, PTE-1) + **NEXD 9000 benchmark product** (PD-INTEL-BENCHMARK) + registry required/comparison facets + device list. |
| 2 | **Overlock (XSO)** | Second sewing head in every knit/apparel bill; ~80% spec reuse from Lockstitch. | ~13 (thread_count, differential_feed, max_speed, bed_type, needle_count, gauge, needle_system, differential_ratio_range, stitch_width, presser_foot_lift_mm, power_consumption, automation_level, dims) | Lockstitch dictionary as parent template; registry facets; Auto-Trimmer/Differential/Puller devices. |
| 3 | **Interlock / Coverstitch (XSI)** | Completes the knit core (XSL+XSO+XSI cover the largest application set). | ~12 (needle_count, thread_count, top_cover, bed_type, gauge, needle_system, top_cover_width, presser_foot_lift_mm, power_consumption, automation_level, dims) | Overlock dictionary as sibling; Top-Cover/Puller/Binder devices; registry facets. |
| 4 | **Multi-Head Embroidery (XEM)** | High-value/high-margin flagship; device config (sequin/cording) is SKU-defining → richest compatibility story. | ~12 (head_count, head_pitch, needle_count, field_size, max_speed, tubular_vs_flat, power_consumption, frame_type, dims) + SKU-affecting device flags | ✅-live registry rows; device-dictionary SKU-affecting flags; sku-strategy embroidery rule. |
| 5 | **Heat Press — Flat (XPH)** | Highest-volume transfer machine; clean, well-bounded enumerated spec set. | ~10 (platen_size, opening_type, actuation, stations, platen_shape, temperature_range, pressure, power_consumption, dims) | ✅-live registry; interchangeable-platen device list (cap/mug/plate). |
| 6 | **Straight Knife Cutter (XCS)** | Cutting room is in every factory bill; dictionary reuses 3× across Round/Band. | ~10 (cutting_height, blade_size, drive, blade_material, auto_sharpening, power_consumption, weight, dims) | ✅-live registry + auto-sharpener device; shared with XCR/XCB. |
| 7 | **Needle Detector (XPCN)** | Compliance-critical: mandatory for Baby Wear / Medical / PPE — a recurring hard buyer question. | ~9 (form, belt_width, sensitivity, aperture, conveyor_speed, auto_reject, power_consumption, dims) | ✅-live registry; auto-reject/marking devices; application-dictionary mandatory-detection flags. |
| 8 | **Fabric Spreading Machine (XPRS)** | Anchors the cutting-room `Pairs-With` story; high attach rate to cutters. | ~9 (fabric_suitability, max_width, automation_level, spreading_mode, roll_weight_max, edge_alignment, power_consumption, dims) | ✅-live registry; `Pairs-With` cutter/table rule; spreader devices. |
| 9 | **Fabric Inspection Machine (XPRI)** | Best showcase for the AI metadata layer (AI defect detection) — flagship "smart" story. | ~9 (max_width, inspection_method, measuring_accuracy, with_rolling, fabric_suitability, ai_defect, power_consumption, dims) | ✅-live registry; ai_defect/auto-measuring devices; AI-answer requirement in visual-product-experience §12. |
| 10 | **Fusing Machine (XFFP)** | High-volume finishing with a clean spec set and clear device upgrades. | ~10 (fusing_type, belt_width, temperature_range, belt_speed, working_width, power_consumption, double_belt, cooling_section, dims) | ✅-live registry; double-belt/cooling device list. |

**Build sequence note:** items 1–3 share one parent template (the sewing-head spec spine), so building #1 fully de-risks #2–#3 and the rest of Category XS. Start the program with **Lockstitch** because the seed assets (PTE template + NEXD 9000) already exist.

---

## 5. Biggest cross-cutting gap

**Visual + comparison + AI presentation metadata is missing for essentially every Product Type.** The registry already names *required* and *comparison* facets (Layer 1), but **not one facet carries its `comparison_display`, `presentation_group`, `spec_card_priority`, display-style, per-option `icon_key`, or `ai_visual_hint`** at the type level. `visual-product-experience.md` makes these mandatory for "done" (§19 approval gate), yet they are undefined across all ~80 types. This single attribute class blocks the visual spec cards, diff-aware comparison, and AI answers that are the *stated* north-star — far more than any individual missing spec like `needle_system`. The second cross-cutting gap is **`power_consumption` / utility values** (voltage, air_pressure) being facet-defined but not wired onto most types.

---

## 6. Is dictionary-building blocked by anything technical?

**No. It can start now as pure documentation.** Master Spec Dictionaries are reference datasets in `docs/product-data-v2/reference-data/` — the same governed, documentation-only layer this analysis lives in. Building them requires **no schema, migration, code, or production change**: each dictionary is a markdown spec-set per type, authored against the existing facet/device/compatibility/visual SoT and routed through the established governance loop (update docs → approval matrix → change log → conflict scan).

Caveats (governance, not technical blockers): (a) new facets such as `needle_system` exposure, `presser_foot_lift_mm`, or `power_consumption` wiring must be **added in `facet-dictionary-master.md` first** (facets are added there only); (b) any ▲-proposed type needs governance sign-off before its dictionary is import-ready; and (c) the broader Product Data V2 *implementation* (projections, UI) remains gated on the production baseline (Stage 1.5) — but that gate does **not** block authoring the dictionaries themselves.
