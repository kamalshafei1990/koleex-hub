# Source-catalogue inventory — S-JOOKE (英文画册-20260722.pdf)

**Status:** inventory only. **Nothing has been created, coded or populated.**
Every code proposal below is a QUESTION for the owner, because KOLEEX codes are
never recycled and a wrong prefix is permanent.

**Source:** 62-page English catalogue, 140MB, dated 2026-07-22. Read in full via
per-column text extraction (the pages are two-column; a naive extraction
interleaves the two products on each spread and silently corrupts every spec
table — see *Method* at the end).

**Confidential.** Supplier identity and model codes are internal-only and must
not leave the Hub.

---

## 1. What the catalogue actually contains

| Section | Pages | Distinct products | Nature |
|---|---|---|---|
| Garment Automation | 6–35 | ~48 | CNC/template sewing + dedicated automation units |
| Seamless Ultrasonic Series | 36–39 | 7 | Ultrasonic welding / bonding / cutting |
| Intimates Automation | 40–51 | ~22 | Bra hardware, glue dispensing, pressing |
| Automation Analysis | 52–61 | 0 new | **Solution maps, not products** |
| Corporate / market | 1–5, 62 | 0 | Company, market tracker |

**~77 distinct machines on product pages.** Pages 52–61 are line-layout
proposals per garment type (dress shirt, polo, dress pant, sweat suit, shorts,
T-shirt, coat) and introduce **no new machine** — they cite model codes, some of
which never appear on a product page. Treat them as SALES COLLATERAL, not a
product source: entering from them would create products with a code and no
specification.

---

## 2. The two findings that matter

### 2.1 The category this catalogue mostly lands in has ZERO spec templates

70% of these machines belong under **Automatic Sewing Systems**. That category
has 11 subcategories and **not one of them has a spec template**. The Hub has 26
templates today and they are concentrated in Finishing (XF*), Printing (XP*) and
Industrial Sewing (XS*).

This is the single highest-value gap the catalogue exposes, and it is not
specific to this supplier — it blocks structured entry for every automation
machine from every source.

### 2.2 The spec tables are strong enough to build from

The template/CNC family alone yields a consistent column set across 14 machines:

> Max. Sewing Speed (r/min) · Sewing Area (cm) · Max. Stitches per Sewing
> Pattern · Stitch Length (mm) · Hook Specification · Compatible Needle Type ·
> Outer Presser Foot Stroke (mm) · Motor-driven Middle Presser Foot ·
> Electronic Thread Tensioner · Thread Trimmer · Thread Wiper · Thread Break
> Detection · Bobbin Thread Counting · Pattern Input Method · Pattern Storage ·
> Template Switching Mode · X/Y Axis Drive Type · Y Table Drive Mode ·
> Operation Mode · Working Air Pressure (MPa) · Power Supply · Rated Power (W) ·
> Overall Dimensions (mm) · Total Machine Weight (Kg) · Operating Temperature

That is a **buildable XAPT template today** — 25 fields, each appearing on 6–14
of the 14 machines, which is denser evidence than the zigzag table we built the
XSZ template from.

---

## 3. Mapping: what already has a home

No new codes needed. These can be entered as soon as a template exists.

| Catalogue family | Pages | Home | Template? |
|---|---|---|---|
| CNC / Intelligent Template Sewing (≈20 models) | 6–16 | `XAPT` Programmable / CNC Sewing | ❌ none |
| Visual Recognition Pattern Sewing | 18–19 | `XAPT` | ❌ |
| CNC Pattern Sewing | 19–20 | `XAPT` | ❌ |
| Sleeve Placket · Auto Placket · Front Placket Box Stitch | 17, 20, 26 | `XAPP` Placket Sewing Units | ❌ |
| Pocket Welt / Placket (auto + semi) | 23–24 | `XAPW` Pocket Welting | ❌ |
| Kangaroo Pocket Setter · Pocket Setter | 25 | `XAPS` Pocket Setter | ❌ |
| Boxers Leg / Circular Bottom / Flat Hemming | 27–28, 30 | `XAHM` Hemming Machines | ❌ |
| Polo Button Attaching · Button Loading & Attaching | 32–33 | `XABA` Button Attaching | ❌ |
| Template Cutting Machine | 29 | `XCC` CNC Cutting Machines | ❌ |
| Fusing Machine (collar / placket) | 33, 49, 53 | `XFFP` Fusing Press | ✅ exists |
| Vacuum Table | 35 | `XAST` Stands & Tables | ❌ |
| Underwear Pressing · Folding & Pressing · Side Seam Heat Press | 49–51 | `XPH` / `XPPH` Heat Press | ✅ XPPH exists |

**Note the pattern:** every ❌ above is in `XA*` or `XC*`. Fixing §2.1 unblocks
this entire block at once.

---

## 4. Gaps: what has NO home in the taxonomy

**This is the decision list. Each row is a proposal, not a decision.**

> **2026-08-20 reconciliation:** G1→`XSUS`, G4→`XABL`, G5→`XADT`, G9→`XSEA`
> (CL-0025, were already Approved) and G10's tape half→`XATA` (CL-0024) are
> **live**. The remaining 23 machines (G2, G3, G6, G7, G8, G11, G10's oven) are
> in `jooke-taxonomy-decision-paper.md` — awaiting owner decision.

| # | Family | Pages | Models | Why it has no home |
|---|---|---|---|---|
| G1 | **Ultrasonic welding / bonding / die-cut** | 37–39, 43, 60 | 7 | `XFSS` Seam Sealing & Bonding is the nearest, but these are machine-shaped like template sewing units, not finishing presses. Genuine fork. |
| G2 | **Glue dispensing / coating** (single, double, AB-glue, visual) | 35, 45–48 | 9 | Nothing in the taxonomy dispenses adhesive. |
| G3 | **Intimates hardware** — hook & eye, 8/9/0-ring bra strap buckle, round hole | 41–44 | 6 | No home. Adjacent to `XFAS` Snap/Rivet/Eyelet Setters but the workpiece and mechanism differ. |
| G4 | **Belt loop attaching** | 32 | 2 | No home. |
| G5 | **Dart machine** | 30 | 2 | No home. |
| G6 | **Zipper pre-expansion · cord inserting** | 31 | 3 | No home. |
| G7 | **Velcro cutting & sewing** (hybrid cut+sew) | 21 | 2 | Sits across `XC*` and `XA*`. |
| G8 | **Creasing machine** | 17 | 1 | No home. |
| G9 | **Elastic band splicing / attaching** | 26–27 | 3 | No home. |
| G10 | **Tape attaching · seamless underwear oven** | 50–51 | 2 | No home. |
| G11 | **Label pad printing** | 34 | 1 | `XPSP` is screen printing; pad printing is a different process. |

**~38 machines — half the catalogue — cannot be filed today.**

### Recommendation on how to open these

Do **not** mint 11 codes. Per CL-0020, a code is earned by a *stitch/process
class*, not by a product name. My reading:

- **G1 + G2 + G10** are one thing: **joining without a needle** (ultrasonic,
  adhesive, heat). That is a coherent process family and arguably ONE new
  category with 3–4 subcategories.
- **G3 + G4 + G9** are **component attaching** — hardware and elastic applied to
  a garment. Possibly extensions of the existing `XFAS` shelf rather than new
  codes.
- **G5, G6, G8** are single-purpose shaping/preparation units — these look like
  candidates for one `XA*` subcategory, not three.
- **G7** and **G11** are one-offs; park them until a second source appears.

That would be roughly **3 new categories / 8 subcategories** instead of 11
scattered codes — but it is the owner's call, and it is worth an hour of
discussion because it cannot be undone.

---

## 5. Template feasibility, by family

| Family | Models | Params/model | Verdict |
|---|---|---|---|
| CNC / Template sewing | 20 | 9–25 | **Build now.** Densest evidence in the Hub. |
| Glue dispensing | 9 | 7–10 | Buildable once G2 is coded. |
| Bra strap buckle / hook & eye | 6 | 8–12 | Buildable once G3 is coded. |
| Ultrasonic | 7 | 5–15 | Buildable once G1 is coded. |
| Pocket welt / placket / setter | 8 | 7–13 | Buildable — codes already exist. |
| Hemming, dart, zipper, cord, elastic | 12 | 3–5 | **Too thin.** A template would be mostly empty; wait for a second source. |

---

## 6. What I recommend doing first

1. ✅ **BUILT 2026-08-20** (owner-approved) — live template
   `programmable-cnc-sewing-machine` on `programmable-cnc-sewing`: 10 sections,
   30 fields, the §2.2 column set verbatim (sewing area, pattern capacity/input/
   switching, rpm, hook, presser strokes, the 5-sensor boolean block, X/Y drive,
   air + power). **Prod now holds FIVE templates**, and Automatic Sewing
   Systems has its first.
2. **Then** the owner decision on §4, which is the real bottleneck for the other
   half.
3. **Do not** enter any product until its template exists — entering first and
   templating later is what produced the uncategorised backlog that
   `project_product_data_cleanup` had to close.

---

## Method (so this is reproducible and its limits are visible)

- `pdftotext -layout` on the whole file **is wrong here** and quietly so: the
  pages are two-column, so it interleaves the left and right products' spec
  tables into single lines. Every table read that way is corrupt in a way that
  still looks plausible.
- Correct approach: page size is 1201.89 × 819.213 pt, so extract each column
  separately with `-x 0 -W 600` and `-x 600 -W 602`. An earlier attempt used
  `-W 800` and silently truncated every right-hand column mid-word — the output
  looked fine at a glance.
- Model codes were harvested only from the first 8 lines of each column (the
  "Display Model:" block). Codes appearing solely in §52–61 solution maps were
  deliberately excluded — see §1.
- Parameter counts are the number of `label␣␣␣value` pairs after a "Parameter
  Information" / "Device Function Classification" heading. They measure table
  RICHNESS, not correctness; the values themselves were not transcribed.
