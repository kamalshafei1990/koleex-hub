# S-003 — Supplier catalogue library: what covers what

Companion to [`source-catalogs.md`](./source-catalogs.md). Answers one question
before any spec template is built: **is there a page for this subcategory, and
can it be read?**

| | |
|---|---|
| **Location** | Google Drive → `Supplier Catalogs/` (inside the S-001 folder) |
| **Swept** | 2026-08-12 |
| **Size** | **75 catalogues · 1,843 pages · 2.3 GB** |
| **Result** | 54 of 64 probed subcategories have at least one source; **489** catalogue×subcategory links |

## How readable are they

| | count | meaning |
|---|---|---|
| Text layer | **24** | tables extract directly — no reading by eye |
| Partial | 1 | headline text only, tables are images |
| Image-only | **50** | OCR'd for this sweep (`chi_sim+eng`, 150 dpi) |

**The Chinese OCR pack is not optional.** The first pass ran English-only and
produced 385 chars/page on the YILI catalogue — and *missed the thread-sucking
pages I had personally built a template from three days earlier*. A proven false
negative. With `chi_sim` the same file yields 4,780 chars/page (12× more) and the
pages surface. Install: drop `chi_sim.traineddata` (tessdata_fast) into
`/opt/homebrew/share/tessdata/`.

## READ THIS BEFORE TRUSTING A "—"

A dash means *this sweep did not find it*, *not* *it does not exist*. Two
demonstrated ways the sweep under-reports:

1. **Vocabulary.** YILI calls its pneumatic press a "heat **transfer** machine",
   never a "heat press". The first pattern set scored it zero. Nine patterns were
   widened after that, but the next catalogue will invent its own wording.
2. **Threshold.** A hit needs **≥3 mentions** so a passing cross-reference is not
   counted as coverage. `XFSP` (Spotting) shows as "—" even though YILI's own
   contents page reads *"Series Spot Removing Machine — 82"*: one real page,
   scored below the bar. **`XFSP` already has a live template built from that very
   page.** So the "—" is wrong there, and may be wrong elsewhere the same way.

Treat the table as a **lower bound**. Before declaring a subcategory sourceless,
open the two or three catalogues whose supplier plausibly makes that machine.

## Subcategory → catalogues

| code | subcategory | catalogues carrying it (ᴼ = read by OCR) |
|---|---|---|
| `XFSI` | Steam Irons | sertol-2025 ᴼ(20), krico ᴼ(19), weitejie-威特捷(11), yili ᴼ(11), weijie ᴼ(7) |
| `XFSB` | Steam Boilers | sertol-2025 ᴼ(49), weijie ᴼ(27), krico ᴼ(15), koleex-2023 ᴼ(8), yili ᴼ(6) |
| `XFSG` | Steam Generators | sertol-2025 ᴼ(27), yili ᴼ(15), weijie ᴼ(10), weitejie-威特捷(6), dison ᴼ(3) |
| `XFCP` | Collar & Cuff Press | shirt-衬衫(22), shirt(22), bote(4), kilo(3), sewpower(3) |
| `XFIT` | Ironing Tables | yili ᴼ(43), sertol-2025 ᴼ(36), dison ᴼ(8), koleex-2023 ᴼ(6), krico ᴼ(5) |
| `XFVT` | Vacuum Ironing Tables | yili ᴼ(31), sertol-2025 ᴼ(25), koleex-2023 ᴼ(7), krico ᴼ(6) |
| `XFTT` | Trouser Pressing | — |
| `XFFF` | Form Finishing | — |
| `XFSP` | Spotting Machines | — |
| `XFFP` | Fusing Press | kilo(34), weijie ᴼ(32), sertol-2025 ᴼ(29), dison ᴼ(12), kilo-2024 ᴼ(11) |
| `XFGR` | Garment Reversing | — |
| `XFTS` | Thread Sucking | yili ᴼ(6), sertol-2025 ᴼ(4) |
| `XFWM` | Washing Machines | — |
| `XPDH` | Double Station Heat Press | kilo(9), kilo-2024 ᴼ(7), koleex-2023 ᴼ(5) |
| `XPPH` | Pneumatic Heat Press | kilo-2024 ᴼ(23), kilo(22), koleex-2023 ᴼ(7), sertol-2025 ᴼ(6), yili ᴼ(4) |
| `XPH` | Heat Press | kilo(161), kilo-2024 ᴼ(75), sertol-2025 ᴼ(17), koleex-2023 ᴼ(13), krico ᴼ(13) |
| `XPRH` | Rotary Heat Press | kilo(7) |
| `XPDT` | Digital Textile (DTG) | kilo-2024 ᴼ(36), kilo(7) |
| `XPSU` | Sublimation Printers | kilo(33), kilo-2024 ᴼ(15) |
| `XPSP` | Screen Printing | hanhai ᴼ(7) |
| `XCT` | Strip Cutting | zhongxingkuan-中性款 ᴼ(12), dison ᴼ(11), weijie ᴼ(9) |
| `XCB` | Band Knife Cutting | sertol-2025 ᴼ(12) |
| `XCC` | CNC Cutting | sertol-cutter-2024(8) |
| `XCS` | Straight Knife Cutting | 2025-07-01-doc(5) |
| `XCR` | Round Knife Cutting | krico ᴼ(10), 2025-07-01-doc(7), dison ᴼ(6), lingrai-2025 ᴼ(4) |
| `XCL` | Laser Cutting | fdk(8), koleex-2023 ᴼ(8), kilo(6), sewpower(6), dison ᴼ(5) |
| `XCE` | End Cutters | stao ᴼ(13), feilishi-飞利仕 ᴼ(12), tefeila(11), stao-2025 ᴼ(9), catalogue-new ᴼ(6) |
| `XCD` | Fabric Drilling | tefeila(8), feilishi-飞利仕 ᴼ(7) |
| `XCP` | Tape Cutting | dison ᴼ(7), krico ᴼ(7), weijie ᴼ(5), kilo-2024 ᴼ(4), zhongxingkuan-中性款 ᴼ(4) |
| `XPRS` | Spreading Machines | ktec ᴼ(5), brexthxr ᴼ(3), dison ᴼ(3), feilishi-飞利仕 ᴼ(3), yili ᴼ(3) |
| `XPRI` | Fabric Inspection | yili ᴼ(32), stao ᴼ(15), stao-2025 ᴼ(12), dison ᴼ(8), kilo(3) |
| `XPRL` | Fabric Rolling | yili ᴼ(23), zhongxingkuan-中性款 ᴼ(3) |
| `XPRR` | Fabric Relaxing | yili ᴼ(13), kilo(3), dison ᴼ(3), stao ᴼ(3) |
| `XPRP` | Fabric Shrinking | yili ᴼ(22), dison ᴼ(4) |
| `XPRT` | Fabric Cutting Tables | sertol-2025 ᴼ(3) |
| `XPCH` | Garment Hanging | maqi ᴼ(4) |
| `XPCF` | Folding Machines | krico ᴼ(10), dison ᴼ(5), hanhai ᴼ(3) |
| `XPCN` | Needle Detectors | dison ᴼ(17), krico ᴼ(11), yili ᴼ(4), koleex-2023 ᴼ(3) |
| `XPCM` | Metal Detectors | — |
| `XPCC` | Carton Sealing | — |
| `XPCX` | X-Ray Inspection | — |
| `XAPW` | Pocket Welting | fdk(11), jack-parts-manual ᴼ(4), krico ᴼ(4), maqi ᴼ(4) |
| `XAPS` | Pocket Setter | pocket-贴袋机(9), fdk(8), pft-2018 ᴼ(5), pft ᴼ(5), dison ᴼ(4) |
| `XABH` | Buttonhole | durkopp-adler(36), feiyue(20), shirt-衬衫(18), shirt(18), acme ᴼ(12) |
| `XABA` | Button Attaching | dison ᴼ(28), sertol-2025 ᴼ(27), sewpower(16), maqi ᴼ(12), catalogue-new ᴼ(11) |
| `XABT` | Bartacking | fdk(19), sewpower(19), maqi ᴼ(19), durkopp-adler(18), dison ᴼ(17) |
| `XACL` | Collar Machines | shirt-衬衫(3), shirt(3) |
| `XAHM` | Hemming Machines | ihg ᴼ(27), fdk(8), pft-2018 ᴼ(6), krico ᴼ(5), lingrai-2025 ᴼ(3) |
| `XAPP` | Placket Sewing | fdk(75), shirt-衬衫(61), shirt(61), lingrai-2025 ᴼ(11), dison ᴼ(10) |
| `XASL` | Sleeve Setting | — |
| `XSL` | Lockstitch | krico ᴼ(157), jack-parts-manual ᴼ(120), bote(57), dison ᴼ(48), goldsew ᴼ(47) |
| `XSO` | Overlock | krico ᴼ(94), bote(91), sewpower(55), fdk(53), koleex-2023 ᴼ(48) |
| `XSI` | Interlock | sewpower(71), krico ᴼ(30), bote(28), limandi-利满弟 ᴼ(25), lingrai-2025 ᴼ(23) |
| `XSD` | Double Needle | jack-parts-manual ᴼ(66), dison ᴼ(43), goldsew ᴼ(36), topeagle-stands(30), sibyer ᴼ(29) |
| `XSC` | Chainstitch | krico ᴼ(55), durkopp-adler(22), dison ᴼ(16), koleex-2023 ᴼ(15), ihg ᴼ(14) |
| `XSM` | Multi-Needle | lingrai-2025 ᴼ(57), sewpower(32), lingrai-2024 ᴼ(31), dison ᴼ(16), jaki ᴼ(15) |
| `XSH` | Heavy Duty | jack-parts-manual ᴼ(85), topeagle-stands(55), krico ᴼ(42), dison ᴼ(41), dingxin-鼎鑫 ᴼ(39) |
| `XSPA_pat` | Pattern Sewing | jack-parts-manual ᴼ(48), fdk(32), dison ᴼ(20), maqi ᴼ(16), sewpower(9) |
| `XEC` | Computerized Embroidery | dison ᴼ(9), kilo-2024 ᴼ(7), feiyue(6), lingrai-2025 ᴼ(6), koleex-2023 ᴼ(5) |
| `XEM` | Multi Head Embroidery | — |
| `XAS` | Stands | kilo(29), kilo-2024 ᴼ(23), krico ᴼ(11), qingong-琴工 ᴼ(11), shirt-衬衫(9) |
| `XAT` | Tables | doc-0902(40), sertol-2025 ᴼ(24), qingong-琴工 ᴼ(13), maqi-ls31016-manual ᴼ(9), shirt-衬衫(8) |
| `XSPS` | Servo Motors | sewpower(31), koleex-2023 ᴼ(26), feiyue(21), jaki ᴼ(21), bote(18) |
| `XSPD` | Direct Drive Motors | krico ᴼ(146), lingrai-2025 ᴼ(93), yaho ᴼ(91), dison ᴼ(71), dulipu ᴼ(66) |

## No source found in this sweep (10)

`XFTT` Trouser Pressing · `XFFF` Form Finishing · `XFSP` Spotting *(false negative — see above)* ·
`XFGR` Garment Reversing · `XFWM` Washing Machines · `XPCM` Metal Detectors ·
`XPCC` Carton Sealing · `XPCX` X-Ray Inspection · `XASL` Sleeve Setting ·
`XEM` Multi-Head Embroidery

`XFTT`, `XFFF` and `XFGR` already have live templates (built from the YILI
catalogue under CL-0016) — further evidence that these dashes are threshold
artefacts, not absence.

## Spec vocabulary the supplier catalogues add

The shared groups (`electrical`, `physical`, `packing-shipping`, `safety`) already
cover voltage · power · frequency · machine dimensions · net/gross weight ·
packing dimensions · CBM · container quantities · certifications.

**Not yet in any shared group**, ranked by how many catalogues use them:

| field | catalogues | note |
|---|---|---|
| `motor` (type/model) | 19 | near-universal; candidate for the electrical group |
| `stitch_length` | 8 | sewing families |
| `max_speed` (rpm / spm) | 10 | sewing + cutting + transfer |
| `power_supply` (phase+V+Hz as one string) | 11 | overlaps the split fields we already have — decide one form |
| `air_pressure` | 5 | **candidate shared group: pneumatics** |
| `air_consumption` | 1 | same group |
| `throughput_per_hour` | 7 | pcs/hour — the commercial number, and we capture it nowhere |
| `sewing_range` / `cutting_range` | 4 / 4 | working envelope |
| `needle_type` | 4 | |
| `cutting_height` | 5 | |
| `heating_plate_size`, `temperature_range`, `time_range`, `max_pressure` | 1–2 | heat-press family (XPDH/XPPH/XPH) |
| `steam_pressure`, `boiler_power`, `boiler_capacity`, `iron_power`, `usage_time` | 1–2 | ironing family (XFSI/XFSB/XFSG) |
| `belt_width`, `working_width` | 4 / 6 | continuous-feed machines |

## The structural advantage over S-001

The Koleex catalogue gives **one model per page, one column**. The supplier
catalogues give a **model matrix** — e.g. five heat-press models × seven fields in
one table. That matrix is what tells you which field *varies across models* and
therefore belongs on the model override rather than on the family. S-001 cannot
answer that question at all.

Worked example, `XFSI`:

| | fields |
|---|---|
| S-001 (Koleex p121) | Model · Voltage · Boiler Power · Iron Power · Water volume · **Iron type** |
| S-003 (specialist iron catalogue) | Model · Voltage · Boiler Wattage · Iron Wattage · **Steam Pressure** · **Boiler Capacity** · **Usage Time** |
| union | **8** — the two sources are complementary, neither replaces the other |

## Reproducing this sweep

Scripts live in the session scratchpad, not the repo (2.3 GB of PDFs is not a
repo artefact). The method: download by Drive id → `pdfinfo` + `pdftotext` to
classify the layer → `pdftoppm -gray -r 150` + `tesseract -l chi_sim+eng` for the
image-only ones → regex vocabulary per subcategory code, `≥3` hits to count.
