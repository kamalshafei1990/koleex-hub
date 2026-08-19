# S-LINGRAI — catalogue inventory (read 2026-08-20)

**Files:** `Lingrai (菱锐) 2024.pdf` (42 pp, 26 MB) · `Lingrai (菱锐) 2025.pdf` (50 pp, 62 MB)
**Maker:** Zhejiang Lingrui Sewing Machine Co., Ltd (浙江菱锐缝纫机有限公司), Taizhou.
Brands **LINGRAI 菱锐** · **SENTENG 森腾** (2010). Self-described: *"Focus on automation,
multi needle machines, interlock machines and other knitted fabric sewing equipment."*
**Declared scope:** MULTI-NEEDLE CHAINSTITCH is the house specialty (founded 2008 on the
008 series); interlock second; everything else is a trading line.

> **2024 vs 2025:** the 2024 index is a strict subset — same families, no automation
> section. The 2025 file supersedes it for taxonomy purposes; 2024 adds nothing that
> 2025 dropped. Both are in the image-only triage list (files 22/23).

> **Model codes are the SUPPLIER's.** Only the FIELDS and the type coverage are taken
> from these sheets. Nothing here is a product-entry instruction — see
> `feedback-templates-not-product-entry`.

---

## 1. Why this catalogue matters

**This is the library's deepest MULTI-NEEDLE CHAINSTITCH source — and multi-needle is
exactly where the Hub has live shelf space, a signed-off model (CL-0020: needle count is
a FACET of `XSC`, not a type), and ZERO spec templates.** The 008 section alone prints
spec tables for ~60 model variants from 4 needles to **118 needles**, plus the full
device system (16 devices), cam patterns (40), motor table, and table-board table. No
other file in the library documents the multi-needle device axis at this depth.

The keyword sweep already ranked it first for `XSM` (57 hits, now `XSC`+facet) and
top-five for `XSI`, `XAHM`, `XAPP`, `XCR` — this read confirms those hits are real
machines with real spec tables, not passing mentions.

## 2. Catalogue structure (2025)

| Pages | Section | Lands on |
|---|---|---|
| P07–18 | Automation equipment (6 stations, all 2023–2025 launches) | `automatic-sewing-systems` |
| P19–48 | 008 cylinder-bed multi-needle + devices + cams + motors + tables | `chainstitch-machines` |
| P49–56 | 1400/1508/2000C/4400 flat-bed multi-needle, waistbanding, beltloop, picoting | `chainstitch-machines` |
| P57–62 | 1500 feed-up-the-arm interlock | `interlock-machines` |
| P63–68 | 740 / 740DSX feed-off-the-arm 4N6T flat seamer | ⚠️ see §4 |
| P69–82 | 787 / 720 / 562 / 664 cylinder & flat-bed interlock | `interlock-machines` |
| P83–87 | 988A / 5214 / 5114 / 700 / 737 overlock | `overlock-machines` |
| P88–89 | Lockstitch family (9800/9300/9000/8700/5300/842/8422/591/0303…) | `lockstitch-machines` |
| P90–92 | Embroidery (1501CT / 1202 / 1204 / MINI1201) | `embroidery-equipment` |
| P93–96 | Buttonhole / bartack / button / zigzag / pattern / blindstitch / heat press / fur / carpet | mixed — see §4 |
| P97–98 | Cutting / spreading / boiler / ironing / thread suction / skiving / drill | mixed, all covered |

## 3. Coverage verdict — what the system already has

Checked against BOTH the live DB (categories/subcategories/product_templates on prod,
2026-08-20) and `product-types-master.md`. ✅ = live subcategory exists · ▲ = registry
type proposed, shelf exists or catch-all.

| Lingrai family | Live subcategory | Registry type |
|---|---|---|
| 008 / 1400 / 4400 / 25-33P / 927D-928D FOA multi-needle | ✅ `chainstitch-machines` | `XSC` ✅ + `needle_count` facet (CL-0020) |
| 1508/1509 waistbanding · 2000C beltloop · 4404 elastic | ✅ `chainstitch-machines` | `XSC` by stitch class; XSWB/XSBLP/XSEA rows are pre-CL-0020 application overlays |
| 1301/1302/1303 picoting | ✅ `special-machines` (catch-all) | `XSPC` ▲ |
| 1500 / 787 / 720 / 562 / 664 interlock | ✅ `interlock-machines` | `XSI` ✅ |
| 988A / 5214 / 5114 / 700 / 737 overlock | ✅ `overlock-machines` | `XSO` ✅ |
| Lockstitch family incl. twin-needle, post-bed 591/592, compound-feed 0303 | ✅ `lockstitch-machines` + `heavy-duty-machines` | `XSL` ✅ |
| 3800 3-needle chainstitch | ✅ `chainstitch-machines` | `XSC` ✅ |
| 2530D / 2284N / 20U zigzag | ✅ `zigzag-machines` | `XSZ` ▲ (CL-0020) |
| LR-500 / LR-101 blindstitch | ✅ `blindstitch-machines` | `XSBL` ▲ (CL-0020) |
| 1790A buttonhole · 9820 eyelet | ✅ `buttonhole-machines` | `XABH` ✅ · `XSEB` ▲ |
| 430D/438D/1900A bartack | ✅ `bartacking-machines` | `XABT` ✅ |
| 977 / 373D / 818XM button | ✅ `button-attaching-machines` | `XABA` ✅ |
| 2210 / 2516 / 6040 pattern machines | ✅ `programmable-cnc-sewing` | `XAPT` (CL-0012) |
| LR-2000-603 placket station | ✅ `placket-sewing-units` | `XAPL` ▲ |
| LR-4800-787-600UT hemming station · LR-899-2SD 2-in-1 fold+hem | ✅ `hemming-machines` | `XAHM` ▲ |
| Embroidery 1501CT/1202/1204/MINI1201 · ES5 domestic | ✅ single/multi-head + `household-embroidery-machines` | `XES`/`XEM` ✅ |
| Heat press 4060/2030/38/62 · fusing 450CS | ✅ heat-press subs + `fusing-press-machines` | `XPH` ✅ · `XFFP` ✅ |
| Cutting: straight 3/103/988 · band 900BK · round 120-50 · end DB-1 · tape 801A/120H · drill 1-1A | ✅ all six cutting subs | `XCS`/`XCB`/`XCR`/`XCE`/`XCTC`/`XCD` |
| LR-160 spreading | ✅ `spreading-machines` | `XPRS` ✅ |
| LR-805 leather skiving | ✅ `skiving-edge-trimming-machines` | XSEK shelf (leather) |
| DLD boiler · TDG/TDZ ironing tables | ✅ `steam-boilers` · `vacuum-ironing-tables` | `XFSB` · `XFIT` ✅ |
| 806/807 thread suction/shearing | ✅ `thread-sucking-machines` | `XFTS` ✅ |
| Clutch/servo/simplified-servo motors · tables · pullers · folders | ✅ `servo-motors` etc. + `attachments-folders` | `XMD` family · device dictionary |

**Verdict: the taxonomy tree holds ~95% of this catalogue.** The shelves exist. What is
missing is below — and it is mostly TEMPLATES, not shelves.

## 4. Gaps — what the system does NOT have

### 4a. Machine classes with no home anywhere (registry AND live)
| # | Machines (pages) | What it is | Why no home |
|---|---|---|---|
| 1 | **Fur sewing** — LR-1-1 · 4-4/4-5/4-6 · 2600 · 402/202/302/600 (P96) | Fur/skin overseaming (Bonis class) | No fur/skin type in any registry section; no subcategory |
| 2 | **Carpet overedging** — LR-20-2B (2-thread) · LR-20-3 (3-thread) (P96) | Carpet whipping/serging | Not overlock (different bed/purpose); nothing in registry |
| 3 | **Automatic tape-attaching stations** — LR-008-13032P-VPLSDk / VPLSDC (P11–12) | Robotic multi-needle cell for reflective/sport tapes, 12s/pc | `XALB` is LABEL attaching; leather `XSET` is a different shelf. No automatic-tape type or subcategory |
| 4 | **Automatic pintuck station** — LR-3000-1400 (P15–16) | Standalone PLC pintuck cell, JUKI/Brother head | Pintuck exists only as the VPT *device* on multi-needle; the automated station has no type |
| 5 | **Thread distributor** — LR-20S (P98) | Thread winding/distribution bench unit | Minor "before/after" gear, no type (candidate: device/parts shelf, not a type) |

### 4b. Registry-proposed but no live shelf
| Machines | Registry | Live gap |
|---|---|---|
| **740 / 740DSX feed-off-the-arm 4N6T flat seamer** (P63–68) | `XSF` ▲ Flatlock (Flat Seamer) | No flatlock/flat-seamer subcategory; `interlock-machines` is the wrong shelf per CL-0020's own relabel note |
| **LR-988A-4-FOUR four-sided template edging** (P17–18) | `XATM` ▲ Template Sewing | No template-sewing subcategory (`programmable-cnc-sewing` is the lockstitch pattern class) |

### 4c. Spec templates — the real gap
**Live `product_templates` today: 1 (lockstitch).** Everything else in this catalogue
has a shelf but **no template**, while the catalogue itself prints full spec tables:

| Template candidate | Source tables in this file | Columns the tables print |
|---|---|---|
| **Multi-needle chainstitch** (`chainstitch-machines`) | P21–22 (008 gauge chart, 26-column needle-position diagram!), P23–36 per-device tables, P49–52 (1400/1508), P55–56 (4400) | needles · threads · gauge (inch+mm) · stitch range · presser lift · needle system · max spm · device suffix |
| **Interlock** (`interlock-machines`) | P57–58 (1500 code breakdown diagram), P69–70 (787 code breakdown), P77–82 (562/664) | needles · threads · gauge · stitch range · differential · presser lift · spm · trimmer/device codes · dimensions · weight |
| **Overlock** (`overlock-machines`) | P83–87 (988A/5214/700/737 — 30-row master table) | threads · needles · stitch class · stitch length · differential · presser lift · spm · dimensions · net/gross weight |
| Embroidery | P90–92 | field size · needles · heads · speed · weight · packing |
| Devices (multi-needle) | P39–46 | 16 device codes with thread-configuration matrix (P39 Type Identification table is a ready-made device dictionary section) |

The 008 **model-code grammar** (P20: `LR-008 - 13 032 P / VSF` = needles · gauge ·
puller · device) and the 1500/787 grammar diagrams (P57, P69) are exactly the
witness-material the lockstitch dictionary was built from.

## 5. Traps for the next reader

1. **Needle counts are NOT types.** 04→118 needles is one `XSC` shelf + `needle_count`
   facet (CL-0020). Do not resurrect per-needle-count subcategories from this file.
2. **Waistbanding / beltloop / elastic / shirring machines here are all multi-needle
   chainstitch by stitch class.** The V-suffix (VSQ/VPQ/VSM…) is a DEVICE, and P39's
   Type Identification table proves the same base machine takes them all. Shelve by
   stitch, overlay by device.
3. **Two catalogues, one supplier.** 2024 adds nothing taxonomically; don't inventory
   it separately or the model counts double — same trap as the JOOKE/XAPT count split.
4. **The P21 gauge chart's 26 columns are 1/8" grid positions,** not 26 models — a
   needle-position diagram. An OCR sweep reads it as a wall of numbers.

## 6. Proposals (not applied — governance-gated)

1. ✅ **BUILT 2026-08-20** (owner-approved) — live template
   `multi-needle-chainstitch-machine` on `chainstitch-machines`: 11 sections,
   29 fields, mirroring the lockstitch template's structure. Field set is this
   file's tables verbatim: needle configuration from the P21–22 gauge charts,
   devices multi-select from the P39–46 device dictionary (13 V-codes), rear
   puller options from the P42 VCL roller table, motors from P47. Prod now
   holds TWO templates. The static form map (`sewing-machine-templates.ts`)
   still routes `chainstitch-machines` → `flatlock-interlock` — that layer is
   the in-form witness, deliberately untouched (CL-0023: templateSlug is a
   witness, not a defect).
2. ✅ **BUILT 2026-08-20** (owner-approved continuation) — `interlock-sewing-machine`
   (11 sections, 26 fields: gauge ladder 4.0–6.4, cylinder circumference, the
   EST/EWT/AST/AWT trimmer axis and 14-device list from P69–76) and
   `overlock-sewing-machine` (10 sections, 24 fields: thread ladder 2–6, the
   /UT /EXT /DET/DPT automation axis and 12-device list from P83–87).
   **Prod now holds FOUR templates** — Lingrai's core three all covered.
3. **Decide homes for fur sewing and carpet overedging** (4a-1/2) — new types need
   sign-off per `coding-change-governance.md`.
4. **Decide the automation-station question once** (4a-3/4 + 4b-2): either a
   `tape-attaching-stations` + `template-sewing` pair under Automatic Sewing Systems,
   or a single "application station" overlay — same decision the XAPT/JOOKE open item
   already needs.
5. **`XSF` flat-seamer shelf** (4b-1) — the 740 family is real, priced, and current.
