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
