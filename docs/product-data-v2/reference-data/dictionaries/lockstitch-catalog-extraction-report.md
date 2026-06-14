# Lockstitch — Master Specification Extraction Report (real-catalog gap analysis)

**Purpose:** validate + enrich the [Lockstitch Master Specification Dictionary](./lockstitch-master-spec-dictionary.md) (Golden Template) against **real manufacturer catalogs**. Knowledge extraction only — **the dictionary is NOT modified here**; this report drives a future, governed update. Documentation only · no DB · no migrations.

**Source:** `~/Documents/Supplier Catalogs/` (supplier set). **Coverage — Wave 1: 12 catalogs read; 7 contained genuine lockstitch data.** Spec vocabulary saturated within this wave (the same missing fields recurred across ≥3 manufacturers). ~40 supplier PDFs remain unread (Wave 2 offered) — **no silent truncation**: the unread set is listed in §10.

| Read & lockstitch ✅ | Read, NOT lockstitch (skipped) |
|---|---|
| MAQI (美机) · Bote (博特) · Goldsew (金梭) · Jaki (佳岛) · Durkopp Adler · Yongxing (永兴) · FDK (缝得快, CNC/template lockstitch) | Siruba=coverstitch · Sewpower=interlock · Feiyue=domestic · KILO=printing/heat-press · Zusun=mostly chainstitch (only twin-needle CM-8452) |

---

## 1. Executive Summary

The Golden Template **holds up very well** against real catalogs: every mainstream single-needle flat-bed lockstitch spec a buyer sees (stitch type, bed, needle system/size, feed, stitch length, hook, drive/motor, speed, foot lift hand+knee, lubrication, the auto-function set, voltage/phase, weights, packing dims) is **already present and correctly named**. Chinese catalogs even encode these as the exact icon-columns our visual metadata anticipated.

The gaps are **not in the mainstream profile** — they are in **(a) a few mechanical-stroke specs** every spec sheet prints, **(b) the heavy-duty / cylinder / post-bed / long-arm sub-variants**, and **(c) the CNC/template "lockstitch workstation" sub-profile** (Bote, FDK, Jaki, Goldsew) that uses a 301 lockstitch head on a programmable XY frame. ~22 new facets and ~6 enrich-existing changes are recommended; none invalidate the template.

**Highest-confidence single addition:** `needle_bar_stroke` (针杆行程) — printed by **5 of 7** lockstitch manufacturers (MAQI 33.4–38 mm · Bote 42 mm · Yongxing 50.8–58 mm · Goldsew + Jaki in their icon legends). It is a vendor-standard spec sheet row and is currently absent.

## 2. Specification Coverage Score

| Scope | Coverage | Basis |
|---|---|---|
| **Mainstream single-needle flat-bed lockstitch** | **~95%** | ~38 of ~40 observed core fields already in the template |
| **Full lockstitch family** (incl. heavy / cylinder / post-bed / long-arm / CNC-template) | **~76%** | the sub-variant + CNC-template fields below are the shortfall |
| New facets recommended | **22** | §5 |
| Existing-but-needs-improvement | **6** | §4-B |
| Net: template is **structurally sound** | — | no field had to be removed or renamed |

Classification of every observed spec → **A. Already Exists · B. Exists But Needs Improvement · C. Missing (New Facet)** is folded into §3–§5.

## 3. Existing Fields — CONFIRMED by real catalogs (Class A)

These template fields appeared, correctly, across catalogs (manufacturer · example values seen):

| Field | Confirmed by | Example values |
|---|---|---|
| `stitch_type` | all | lockstitch / 锁式线迹 / ISO **301** |
| `bed_type` | all | flat · cylinder · post-bed · long-arm |
| `needle_count` | all | 1 · 2 |
| `needle_system` | MAQI, Bote, Goldsew, Jaki, Yongxing, FDK | DB×1 · DP×5 · DP×17 · DY×3 |
| `needle_size_range` | MAQI, Bote, Jaki, Goldsew | 9#–18# · 11#–24# · 20#–23# |
| `needle_gauge` | Bote, DA | 1/8″ · 5/32″ · 1.6–50.8 mm |
| `feed_type` | all | drop · needle · compound(unison) · top+bottom · differential |
| `stitch_length_max` | all | 5 · 6 · 8 · 12 · 0–15 mm |
| `hook_type` / `hook_size` | all | horizontal std/large · vertical · shuttle · 大梭/小梭 |
| `max_speed` | all | 5000 · 4500 · 4000 · 2000 spm |
| `presser_foot_lift_manual` / `_knee` | MAQI, Goldsew, Jaki, Yongxing | 6/13 · 5/13 · 13/20 mm (hand/knee) |
| `drive_type` / `motor_type` / `motor_power` | all | direct-drive · servo · 550W · 750W |
| `automation_level` + `auto_thread_trim` / `auto_backtack` / `auto_foot_lift` / `needle_positioner` / `thread_wiper` | MAQI, Bote, Jaki, DA | ★ per spec column |
| `lubrication_type` | all | auto-lube · sealed oil pan · semi-dry · dry-head |
| `voltage` / `phase` / `air_pressure` | MAQI, Goldsew, Bote, FDK | 220V/380V · 0.5 MPa |
| `net_weight` / `weight_net`/`weight_gross` | all | 33/40 · 45/56 kg |
| `head_dimensions` / packing dims | all | 620×280×550 mm · carton sizes |
| `pattern_memory` / `programmable_panel` | Bote, Jaki, FDK | 8 patterns · 999 patterns |
| applications `fabric_type` / `garment_type` / `industry` | all | denim · knit · leather · shirts · suits |

## 4. Missing Fields & weak spots

**B — Exists But Needs Improvement (6):**
1. `lubrication_type` → make it a **richer enum**: `dry-head (oil-free) · semi-dry (hook-only) · micro-oil · sealed-oil-pan · auto-lube · manual`. (DA "Dry/Semi-Dry-Head", MAQI 头部微油/封闭油盘, Yongxing manual.)
2. `arm_clearance` → support **W × H** (操作空间, Goldsew 258×110 / 260×390) **and** a separate `max_sewing_thickness` (MAQI "26 mm feeding space / 16 layers denim").
3. `needle_gauge` → allow **inch** values (1/8″, 5/32″, 7/32″) alongside mm (Bote двойн-needle).
4. `stitch_type` → optionally carry the **ISO stitch class number** (301 lockstitch) as an attribute (printed explicitly by Bote/Yongxing/FDK).
5. `needle_system` controlled list → **expand** (see §6).
6. `table_surface_type` → add **"ball-bearing (钢珠)"** alongside Static/Vacuum/Air-float (Bote table options: ordinary / 钢珠 / 气浮).

**C — Missing (new facets):** see §5 (the core deliverable).

## 5. Recommended New Facets (Class C)

Ranked by cross-manufacturer frequency (n = how many of the 7 lockstitch catalogs showed it):

| # | Proposed facet | Type · Unit | Example values | Seen in (n) |
|---|---|---|---|---|
| 1 | `needle_bar_stroke` 针杆行程 | measurement · mm | 33.4 · 38 · 42 · 50.8 · 56 · 58 | **5** (MAQI, Bote, Yongxing, Goldsew, Jaki) |
| 2 | `presser_foot_stroke` 压脚行程 (alternating/walking) | measurement · mm | 20 (DA); FDK follow-up 0–6 | 3 (DA, FDK, Bote) |
| 3 | `thread_take_up_stroke` 挑线杆行程 | measurement · mm | 96 | 1 (Yongxing) — but a standard sheet row |
| 4 | `fabric_weight_class` 用途厚薄 | single_select | Light(薄) · Medium(中厚) · Heavy(厚) · Extra-heavy(极厚) | **6** (universal duty tiering) |
| 5 | `cylinder_diameter` 筒径 | measurement · mm | 46 · 64 · 81 | 3 (Goldsew, Yongxing, Bote) |
| 6 | `post_height` 柱高 | measurement · mm | 120 · 180 · 320 · 420 | 2 (Goldsew, Yongxing) |
| 7 | `arm_length` 臂长 (long-arm) | measurement · mm | 560 · 780 · 802 | 3 (Bote, Jaki, MAQI) |
| 8 | `side_cutter_edge_width` 切边宽度 | measurement · mm | 3.2 | 3 (MAQI, Jaki, Bote) |
| 9 | `cloth_cutting_thickness` 切布厚度 | measurement · mm | 4.0 | 2 (MAQI, Jaki) |
| 10 | `electronic_thread_clamp` 电子夹线 | boolean | ★ | 2 (MAQI, Jaki) |
| 11 | `piece_counter` / `bobbin_thread_counter` 自动计件/底线计数 | boolean / number | ★ · 1–999999 | 3 (MAQI, Bote, DA) |
| 12 | `bobbin_thread_monitor` / `needle_thread_monitor` | boolean | ★ | 2 (DA, MAQI) |
| 13 | `stitch_condensing` 密缝/缩缝 (end-lock, ≠ backtack) | boolean | ★ | 3 (DA, Bote, MAQI) |
| 14 | `acceleration_time` 0→max | measurement · ms | 94 ms (0→7000) | 1 (MAQI) |
| 15 | `productivity` 产能 | measurement · pcs/h or s/pc | 150–600 pcs/h · 10 s/pc | 2 (Zusun, FDK) |
| **CNC / template lockstitch sub-profile** ||||
| 16 | `sewing_field_xy` 缝制范围 | text · mm | 500×300 · 1300×900 · 1400×950 | **4** (Bote, FDK, Jaki, Goldsew) |
| 17 | `max_stitches_per_pattern` 最大针数 | number | 8,000 · 80,000 · 210,000 | 3 (Bote, FDK, Zusun) |
| 18 | `pattern_storage_count` 花样储存 | number | 999 · 100,000 | 3 (Bote, FDK, Jaki) |
| 19 | `pattern_file_format` 文件格式 | multi_select | DXF · PLT · DST · NTP · DHP · SLW | 2 (Bote, FDK) |
| 20 | `pattern_scaling_range` 缩放 | range · % | 10–200% | 2 (Bote, FDK) |
| 21 | `template_recognition` 模板识别 | single_select | RFID · none | 2 (Bote, FDK) |
| 22 | `controller_brand` 控制系统 | text | DAHAO(大豪) · 誉财 · 星火 · SYSTEMTOP | 2 (FDK, Bote) |

*Premium / niche (DA pictogram legend), lower priority but cataloged: `thread_nipper`, `light_stroke_system`, `cross_seam_climbing`, `second_thread_tension`, `needle_cooler`, `integrated_led_lamp`, `dual_stitch_length`, `air_free_actuation` (all-electromagnet, no compressed air).*

## 6. Compatibility Additions

- **Expand `needle_system` controlled list** — observed beyond the current set (DBx1/DPx5/DCx27/UYx128/TVx7): add **DP×17 · DY×3 · CP×5 · TV×64 · TV×5 · TQ×1 · LW×6T · 7×23/7×25/7×30** (extra-heavy leather), **DV×57**. (MAQI, Goldsew, Yongxing, Jaki, FDK.)
- **Hook as model+brand** — real catalogs cite hook *models*: KSP-204N · KSP-204N-T · KRT132, and brand (Hirose/广濑). Add `hook_model` + `hook_brand` to the compatibility/spare layer.
- **`mountable_head_compat`** — CNC/template frames (FDK) accept third-party heads: JUKI · SIRUBA · PEGASUS · HIKARI(富山) · LIJIA(力佳) · KANSAI. New compatibility field for template/automation frames.
- **`controller_brand`** (also §5-22) is a compatibility axis (DAHAO/誉财/星火/SYSTEMTOP).
- **Table options** — add `table_mount_type`: ordinary · ball-bearing(钢珠) · air-float(气浮); plus integrated stand vs cart.
- Confirmed compatibility classes already in the template (needles, presser feet, attachments, side-cutter, puller/roller, motors, tables, hooks, bobbin winder) all appear — **no class missing**, only the value lists deepen.

## 7. Application Additions

- **Add `fabric_weight_class`** (Light/Medium/Heavy/Extra-heavy) as a **coded duty tier** — every catalog grades lockstitch models this way (薄/中厚/厚/极厚); more reliable than free-text `fabric_type`.
- **Expand `industry` + `application` vocab** with the real lockstitch demand seen: **footwear, leather goods, luggage/bags, automotive interiors (seats/mats), technical textiles (tents/sails/FIBC container bags/parachutes), military & safety (harness/belts), furniture/upholstery (sofas), bedding/mattress, wigs, gloves, sporting goods (baseballs)** — beyond apparel.
- **Operations** seen (feed into `operation-library`): side-seam, decorative topstitch, **corner sewing (360° rotary, no reverse)**, French-roll hemming, edge-binding, welt/zipper pocket, placket, collar/cuff, dart pleating, **trademark/badge attaching**, waistband, felled seam.

## 8. AI Knowledge Additions

- **Garment-process diagrams** (MAQI, FDK, Jaki: operation → specific model maps) are gold for the **Factory Builder Assistant** — capture as a structured `operation→model` relation + `process_diagram` visual.
- **Symbol/pictogram legends** (Durkopp pp.72–73, MAQI p.8, Jaki p.13, Goldsew p.26) are ready-made **controlled vocabularies + icon sets** — feed `icon_key` population and the AI's spec-explanation answers.
- **Duty class + `ai_use_when`/`ai_not_for`** — catalogs explicitly state suitable/unsuitable material weight; populate these so the **Product & Quotation Assistants** recommend correctly (e.g. "DP×17 + 8 mm stitch + 13 mm lift → heavy denim/leather; not for fine knit").
- **Needle↔fabric mapping** (DB×1 light/medium, DP×5 medium-heavy, DP×17/DY×3/7×30 heavy-leather) — a high-value rule set for the **Spare Parts & Service Assistants** (needle selection).
- **Controller brand + pattern file format** — the **Service Assistant** needs these for template-machine support.

## 9. Visual Metadata Additions

Observed asset types map mostly onto the template's `image_role` set (hero/gallery/detail/diagram/application/spare_part/packing/video). **New visual roles to add:**
- `stitch_sample` — seam/stitch swatch photos (Jaki, Bote, Sewpower) — "what the seam looks like."
- `process_diagram` — operation→model garment-process maps (MAQI, FDK).
- `symbol_legend` — the pictogram glossary page (every catalog) — drives the icon system.
- `parts_chart` — spare-parts photo charts (Yongxing pp.31–32).
- `code_builder` — model-code-builder diagrams (FDK MS-13090R/MS-12M) — directly informs KOLEEX coding/SKU logic.

All real catalogs use **icon-column spec tables**, validating the Golden Template's per-spec `icon_key` requirement; the legends are a turnkey icon source.

## 10. Final Recommendation

1. **Promote into the Golden Template + facet dictionary** (one governed `CL-####` update): the **22 new facets** (§5), the **6 improvements** (§4-B), the **needle_system list expansion** + hook model/brand + `mountable_head_compat` + `controller_brand` (§6), `fabric_weight_class` + vocab expansion (§7), and the **5 new visual roles** (§9). Recommend a clean split: a **"core lockstitch +"** group (needle_bar_stroke, presser_foot_stroke, thread_take_up_stroke, fabric_weight_class, lubrication enum, ISO class) applied to ALL sewing types, and a **"CNC/template lockstitch" facet group** (§5 #16–22) applied only to template/pattern variants.
2. **The Golden Template stands** — no removal/rename needed; it covered ~95% of mainstream lockstitch out of the box. Apply these as **additive enrichment**, then it becomes the validated template for Overlock/Interlock/etc.
3. **Coverage / Wave 2 (no silent truncation):** 12 of ~52 supplier catalogs read this wave; the lockstitch spec vocabulary **saturated** (recurrence ≥3 manufacturers). The **~40 unread** include: Krico, Dison, Doso, 中性款, Hank, Lingrai 2024/2025, Tefeila, iYOU, Hongyu, Dulipu, Snoke, FNZ, Stao, KTEC, Duma, KILO 2024, YILI, Yuegong, Linjian, Sibyer, Bangzheng, PFT/PFT 2018, Deyee, Yaho, Brexthxr, Zusun(done), IHG, Jiake, Yuemu, Hanhai, Zhongke Xinli, plus cutter/plotter sets (Sertol ×3, ATP, iECHO, ACME) which are **not lockstitch** and can be skipped. I expect Wave 2 to mostly **re-confirm** these fields (diminishing returns) and possibly surface a few more heavy-duty/leather specifics. **Recommend: apply the §5 additions now; run Wave 2 only if exhaustive frequency counts are required.**

> **Not applied.** The Lockstitch Dictionary is unchanged. This report is the evidence base for the next governed enrichment PR.
