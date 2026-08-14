# The 50 unread image-only catalogues — cover triage (2026-08-14)

**Why this exists.** Every "this subcategory has no source" verdict in the gap memo
came from a **text sweep**, and a text sweep sees **24 of 75** catalogues. The other
**51 are image-only** (`pdftotext` → 0 characters) and had never been opened. That
method was proven wrong once already: Leather & Footwear was recorded as *"searched
and confirmed empty"* and S-GOLDSEW — 52 pages, 150 models, 11 spec tables — was
sitting in the library the whole time.

**Method.** Page 1 of each file rendered at 40 dpi and tiled into five contact
sheets, ten covers per sheet. Cheap enough to look at all fifty; precise enough to
tell a spare-parts manual from an embroidery machine. **A cover is a lead, not a
verdict** — nothing below is a source until its interior pages are read.

**Library count corrected:** 76 files, **75 unique catalogues** — `Goldsew (金梭).pdf`
and `金梭样册定稿文件.pdf` are byte-identical (same MD5). One file, two names.

---

## ⭐ Leads that hit an EMPTY subcategory

| # | Catalogue | Pages | Points at | That category today |
|---|---|---|---|---|
| **43** | `中性款` — **DL8601/8602/8603 Hot Air Seam Sealing** + DL3540/3560/R200 dual-mode presses | 8 | **`XFSS` Seam Sealing & Bonding** | 1 coded · **0 templated** |
| **2** | `2025杰克零件手册` — **JACK Spare Parts Catalogue** | **82** | **Spare Parts & Accessories** | 6 coded · **0 templated** |
| **47** | `琴工电子版` — QINGONG **机架台板** *machine stands & table tops* | 10 | **Stands & Tables** | 2 coded · **0 templated** |
| **12** | `FNZ (芬瓷)` — 刺绣机 **embroidery machines** | 6 | **Embroidery Equipment** | 5 coded · **0 templated** |
| **18** | `KILO (麒龙) 2024` — **PRINTING · HEAT PRESS · EMBROIDERY** | 36 | **Printing & Heat Press** + Embroidery | 6 coded · 2 templated |
| **49** | `飞利仕 PHLPS 2025` — sewing equipment **and parts** | 14 | Spare Parts (second look) | — |

### #43 is already confirmed — its interior was read

**Every machine on all 8 pages carries a full printed spec table.** This is the
strongest single source found so far for an untouched code:

| Model | What it is | Printed |
|---|---|---|
| **DL8601** | Hot Air Seam Sealing, standard | 220 V 50/60 Hz · **3 kW** · up to **700 °C** · **1–40 m/min** · 0.35–0.5 MPa · wheel 25 mm (20/28/35/55 custom) · tape **10–25 mm** · roller lift 10–30 mm · 1200×540×1550 · **123 kg** |
| **DL8602** | horizontal cylinder | as above · **128 kg** |
| **DL8603** | shoe machine | **1–16 m/min** — a *quarter* the standard model · 123 kg |
| DL3540 / DL3560 | hot-and-cold dual-mode flat press | 2.5 / **3.7 kW** · 350×400 / 350×600 mm · room–250 °C · chiller room–10 °C · 178 / 189 kg |
| DLR200 | dual-mode **visor** press | 2.5 kW · 370×125 mm · 163 kg |
| 2700DA-1/2/3 · 2700DB | automatic strip cutting | → `XCT`, **already templated** |
| 2000D · 1700D · FH9000D · 911A | batching, folding-stitching, strip cutting | Fabric Preparation, already complete |

⚠️ **The catalogue has no maker name on any page** — the filename `中性款` literally
means *"neutral edition"*, an unbranded catalogue a trader rebrands. Treat the model
codes as **generic**, not as one supplier's range.

⚠️ **DL8603 runs 1–16 m/min against the standard model's 1–40.** Same frame, same
kW, same temperature — a quarter of the speed, because it seals a curved shoe seam
rather than a straight garment one. Recording the speed without the variant makes
the two incomparable.

---

## Leads that point at ALREADY-TEMPLATED categories

Recorded so they are not re-opened hoping for something new: **41** iECHO GLSC
multi-ply cutting · **6** Bangzheng multi-layer cutter · **29** Sertol DX cutter ·
**44** Eastman straight knife → all `XCS`/`XCC`, done. **7** Brexthxr BR-1900-1
spreader · **32** Stao AO3-6 AI fabric inspection · **33** Weijie irons → Fabric
Preparation and Ironing, both complete. **5** ATP inkjet plotter → plotters.

## Whole-catalogue sewing ranges (no empty code implied)

**3** Stao · **4** ACME · **9** Dison · **10** Doso · **11** Dulipu · **13** Hanhai ·
**14** Hank · **16** IHG · **17** Jaki · **21** Krico · **22/23** Lingrai 2024+2025 ·
**24** Linjian · **25/26** MAQI · **27/28** PFT (pocket setters — `XAPS`, templated) ·
**30** Sibyer · **31** Snoke · **34** YILI · **35** Yaho · **36** Yongxing ·
**37/38** Yuegong + Yuemu (both "Hello Zigzag" — `XSZ`, templated) · **39** Zhongke
Xinli · **40** Zusun · **42** iYOU · **45** Limanwi · **46** Baoming · **50** DXing.

**15** Hongyu = the motor source already used for `XSPS`/`XSPD`. **20** Koleex 2025 =
own catalogue, inventoried. **48** = Goldsew, inventoried. **19** KTEC is **lighting
busway for workshops** — not garment machinery at all.

---

## What this changes

The gap memo's "confirmed empty" list must be read as **"no keyword hit in the 24
readable files"**, never as "no source exists". Four categories that were recorded
as sourceless now have a named lead each, and one of them (`XFSS`) has confirmed
spec tables.

**Next, in value order:** `XFSS` (confirmed, tables in hand) → Spare Parts (82 pages
to read) → Stands & Tables → Embroidery.

---

## Follow-up: `2025杰克零件手册` read in full (2026-08-14)

**82 pages. Its directory page is a printed taxonomy — 22 spare-part classes and
16 accessory classes** — and that list is now `part_class` in the `XSPP` template,
transcribed rather than invented.

**⚠️ THE GAP TABLE'S "SPARE PARTS 6 CODED / 0 TEMPLATED" WAS STALE.** `XSPS`
servo motors and `XSPD` direct drives had already landed from S-HONGYU. The real
gap was **4**, and is now **3**: `XSPA` attachments & folders · `XSPC` control
panels · `XSPT` touch screens. **Re-measure before quoting a gap.**

### ⭐ What a parts catalogue actually prints — and why it changes the template shape

Every one of the several hundred entries carries **exactly three lines**:

```
名称 / Description : Presser Foot (Heavy Duty)
代码 / Part NO.    : 12121605400
适配 / Machine Type: 798D/E4/E4S/C4/C5/C5S/C7-BK
```

**No dimensions. No materials. No weights. No tolerances.** Eighty-two pages and
not one number a spec field could hold.

That is not a gap in the catalogue — **it is what a part is**. A machine is
defined by what it *does*; a part is defined by **what it FITS**. A presser foot
has no performance to quote; its whole value is the list of machines it bolts
onto, and a buyer searches by machine model, never by millimetre.

So `XSPP` is the Hub's **first fitment template rather than spec template** —
built around `compatible_machine_models`, with the physical fields that carry
every other template absent by design. **Do not "improve" it by adding dimensions
or material:** nothing in the source prints them, and an invented field gets
filled with a guess and is wrong forever.

### The gate earned its keep on this one

`validate:budgets` section G rejected the build twice before it landed:
1. **A duplicate i18n key** — `o:fit_interlock`. It already exists on the motor
   templates meaning *"fits an interlock MACHINE"*, which is **not** the same
   claim as *"belongs to the interlock section of a parts book"*. Renamed to
   `thread_group_*`. **A value is only shared if the MEANING is shared.**
2. **A stale description key** — editing a field's description silently orphans
   its `SPEC_DESC_I18N` entry, because that map is keyed by the exact English
   sentence. Change a description, change the key.

**Result:** `XSPP` 4 groups / 17 fields. Spare Parts 2/6 → **3/6**.

---

## Follow-up: QINGONG and FNZ read in full (2026-08-14)

### ⛔ `琴工电子版` QINGONG — Stands & Tables stays UNBUILDABLE

10 pages. Six of them are factory photography (punch presses, saw plate, edge
banding, flame plating, ball blasting). The product pages give **series names and
model codes and nothing else**:

- **Tableboards** (`XAT`): three named series — *New Design*, **HY Potenuse PVC
  (斜边 bevelled edge)**, **Straight Edge PVC (直边)**.
- **Stands** (`XAS`): ~16 coded models — GI-2-01/02/03/04/05 · GZ-2 · GI-591 ·
  GI2-4-01/02/03 · EU-302 · GD-2HH · GI-2M · GK-2 · GI-2 全沉式 (fully submerged) ·
  GI-2-9270.

**Not one dimension, board thickness, height range, load rating or material grade
is printed anywhere.** The bevelled/straight distinction is real printed data —
it is in the series names — but one attribute is not a template. Building from
the photographs would mean inventing every field, which is the rule that keeps
`XSEK` and `XSBL` empty. **Recorded so the catalogue is not re-opened hoping for
a table: there isn't one.**

### ✅ `FNZ (芬瓷)` — Embroidery Equipment 0/5 → **2/5**

6 pages, and **every one of five series carries a printed spec table with the
same seven columns**: series · model · head count · needle count · embroidery
area (Y×X mm) · gross weight · overall size.

| Series | Models | Heads | Area | Weight |
|---|---|---|---|---|
| PRINCIPAL 马头机 (cantilever) | P106–P115 | 1 | 300×(400–600) → 500×(500–800) | 150–210 kg |
| CLASSICAL 铝盆机 (basin) | C106–C115 | 1 | 500×1200 · 500×800 | 210 kg |
| MAESTRO 龙门机 (gantry) | M106–M1215 | **1 → 12** | 400×500 → 800×1600 | 220–**1500 kg** |
| PRINCIPAL PLUS 大行程 | P106–P115 plus | 1 | 500×(500–800) → **1000×2000** | 200–430 kg |
| SOLO 桌面台式机 (desktop) | S106–S115 | 1 | 200×360 → 400×600 | **120 kg** |

Built as **one field set under two codes** (`XES` + `XEM`), the XSES/XSEB
reasoning: the catalogue prints *the same table* from a 1-head desktop to a
12-head gantry, so head count is a column of it, not a different document.

**Three traps recorded in the schema header:**
1. **`体积(mm)` is labelled *volume* and is not one.** It prints `1120*880*910` —
   L×W×H in millimetres. Converting it to m³ produces nonsense.
2. **The model code encodes the spec and proofreads the row.** `M106` = 1 head,
   06 needles; `M1215` = 12 heads, 15 needles. If code and columns disagree, the
   row was mis-transcribed. `M130` at **30 needles** is the deliberate exception.
3. **`f:head_count` was already taken — meaning "Detection Heads"** (探头层数) on
   the needle-detector template. The gate caught it as a duplicate key, and the
   naive fix would have left this field silently rendering as *Detection Heads*
   in all three languages. Renamed `embroidery_head_count`.

### ⚠️ Taxonomy flag for the owner — `XEC` overlaps, it does not sit beside

Embroidery's five codes are `XES` single-head · `XEM` multi-head · **`XEC`
computerized** · `XEB` cording/beading · `XEQ` sequin. **"Computerized" is a
CONTROL attribute, and every machine in this catalogue is computerized** — so
`XEC` completely overlaps `XES` and `XEM` rather than being a sibling of them.
That is the same defect CL-0020 removed from sewing when `needle_count` and
`duty` were demoted from subcategories to facets. **Not acted on: retiring a live
code is an owner decision.** The template deliberately does not register under
`XEC`. `XEB` and `XEQ` are genuinely different devices; this catalogue prints
neither.

---

## Follow-up: `KILO (麒龙) 2024` read (2026-08-14) — Printing & Heat Press 2/7 → 4/7

36 pages, image-only. Pages 33–44 carry dozens of heat-press models under **two
different table shapes**, which is why this landed as two templates:

| | Roller sheet (pp. 33–36) | Flat sheet (pp. 37–44) |
|---|---|---|
| size column | **规格CM = drum ⌀ × working width** | 加热板尺寸 **cm AND inch** |
| force | 工作压力 **0–8 kg/cm²** | — (operator's lever) |
| time | 定时关机 **0–4 HOURS** | 时间范围 **0–999 SECONDS** |
| temperature | **0–399 °C** | **0–299 °C** |
| extent | 工作台尺寸 1.5 / 2.65 / 3.35 **m** | — |

**They share only voltage and packing size.** A roller is specified by pressure
and table length because material runs THROUGH it; a flat press by plate size and
dwell because material sits IN it.

**Traps recorded in the schema header:**
1. **规格(CM) on the roller is NOT a plate size** — `120*190` is a 120 cm drum
   diameter × 190 cm width. Read as a platen it is the wrong machine by an order
   of magnitude in throughput.
2. **The temperature ceilings differ by class and it is not a typo** — 399 on a
   flat-press row means the row came off the roller table, and vice versa.
3. **The flat press prints plate size twice, in two units** — `38x38 / 15x15` is
   cm then inches. Record both: inches is what the trade quotes and what transfer
   paper is sold in; centimetres is what matches the packing size on the row.

### ⚠️ The check that caught a template which would never have appeared

Written with `categoryCode: "printing-heat-press"`. **The live DB slug is
`printing-heat-press-equipment`** — and `ProductForm` passes
`product.category_slug` straight into `resolveSchema`, so a category code one
word off is a template that **silently never renders**. Probing with the DB's own
slug returned NO TEMPLATE for both new schemas while returning the existing
`XPPH`/`XPDH` correctly, which is what exposed it.

**The check, worth running after every new schema:** the set of schema
`categoryCode` values minus the set of live category slugs must be **empty**.
It is now.

### Still open in this category

`XPDT` digital textile (DTG) · `XPSP` screen printing · `XPSU` sublimation.
KILO pages 5–20 do carry DTF/DTG/UV printers with spec tables, so **`XPDT` is
sourced and buildable** — it was not built in this pass only to keep the change
reviewable.
