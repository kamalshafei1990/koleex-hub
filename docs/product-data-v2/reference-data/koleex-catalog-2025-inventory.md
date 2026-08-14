# Koleex Catalog 2025 — read as a TEMPLATE source only

**Status:** inventory only. Nothing created, coded or populated.

**Source:** `Koleex Catalog 2025.pdf` — 138 spread pages (printed pages 1–271),
80MB, in Drive and in `~/Documents/Supplier Catalogs/`.

---

## ⚠️ TWO OWNER CONSTRAINTS THAT GOVERN THIS DOCUMENT (2026-08-14)

**1. THIS CATALOGUE IS THE OLD ONE AND ITS MODEL CODES ARE OLD.** A new Koleex
catalogue will be created. Every `XA-…`, `XSL-…`, `XSO-…` code quoted below is
therefore a SUPERSEDED reference, useful for finding a machine on the page and
for nothing else. **Do not treat any code here as a product identifier, do not
seed anything from it, and do not cite it to anyone outside this document.**

**2. WE WORK ON TEMPLATES, NOT ON ADDING PRODUCTS.** Product entry is the
owner's, done manually, unless he explicitly asks for a specific item. This
catalogue is read for ONE purpose: to learn **which fields a machine class
actually publishes**, so a spec template can be built from evidence. It is not
an entry queue and this document must never be used as one.

Both constraints are why §4 of the first draft — a recommended order for
entering products from this catalogue — has been removed rather than reworded.

---

## 0. Read this before searching this catalogue again

**IT CONTAINS ZERO EXTRACTABLE TEXT.** `pdftotext` returns nothing — not one
character, on any of the 138 pages. Every keyword scan run across the catalogue
library was **completely blind to it**, which is why it took until now to
inventory the one catalogue that is entirely our own range.

**How to read it:**

```
pdftoppm -r 22 -png "Koleex Catalog 2025.pdf" out/k     # all 138 pages
# then tile 18 pages per sheet, 3 columns, with Pillow
```

At `-r 22` tiled 3-up, section headings and model codes are legible; a single
spread at `-r 55`–`60` is fully readable including spec tables. Pages are large
spreads (6617 × 2480 pt), two printed pages each.

**Printed page → PDF page:** `pdf = (printed + 5) / 2`. Verified against three
spreads (printed 163/164 → PDF 94; 175/176 → 90; 187/188 → 96).

---

## 1. Structure (from the catalogue's own Products Catalog contents, printed p.47)

| Section | Printed | PDF pages |
|---|---|---|
| Front matter (company, vision, structure, clients) | 1–46 | 1–25 |
| Pre-Sewing Equipment | 49–66 | 27–35 |
| Cutting Machines | 67–88 | 36–46 |
| Industrial Sewing Machines | 89–170 | 47–87 |
| **Automatic Sewing Units** | **171–204** | **88–104** |
| Shoes & Bags Machinery | 205–219 | 105–112 |
| Embroidery Machines | 220–225 | 112–115 |
| Printing & Heat Pressing Machines | 226–233 | 115–119 |
| Ironing & Finishing Equipment | 234–245 | 119–125 |
| Packing Equipment | 246–251 | 125–128 |
| Household Sewing Machines | 252–257 | 128–131 |
| Accessories & Spare Parts | 258–271 | 131–138 |

**The model prefixes are already ours** and map cleanly onto the taxonomy:
`XF-` pre-sewing · `XC-` cutting · `XSL-` lockstitch · `XSO-` overlock ·
`XSI-` interlock/coverstitch · `XSS-` special · `XA-` automatic units ·
`XSE-`/`XS-` shoes & bags · `XE-` embroidery · `XP-` printing ·
`XI-` ironing · `XSH-` household · `XR-`/`XSU-` accessories.

⚠️ `XSS-` in the catalogue is the SPECIAL-machine prefix and covers buttonhole,
bartack, button attaching, blindstitch, zigzag and pattern machines. In the Hub
taxonomy `XSS` is **retired** (code reservation only). The catalogue numbering
and the taxonomy code are NOT the same thing and must not be conflated.

---

## 2. Two table formats — and the difference decides everything

**Rich, machine-specific.** e.g. the pocket-mouth curling machines (PDF p.90):
sewing process · max sewing speed · machine needle · standard stitch length ·
curling stitch length · sewing length · presser height · sewing centre · curling
stitch width · material receiving device · control system · machine size ·
weight. Thirteen columns, all specific to the operation.

**Generic six-column.** e.g. the round-neck / curtain / scarf / cloth-receiving
machines (PDF p.96): rated voltage · rated power · speed · weight · product size
· packing size. **Nothing category-specific at all.**

**A third form: a bulleted Specifications block** rather than a table — e.g.
`XA-81` (p.94): voltage · current · air pressure · **size range (diameter >40 cm)**
· head speed 3000–3500 rpm · net weight 198 kg · dimensions · **production
efficiency 150–180 pcs/h**. Fewer fields than a rich table but two of them are
genuinely operation-specific.

**Consequence:** a subcategory is templatable from this catalogue only where the
rich or bulleted form appears. Where only the generic six columns appear, a
template would contain nothing but the shared electrical/physical/packing groups
— padding, not a template.

---

## 3. Automatic Sewing Units (PDF 88–104) — machine by machine

This is the section that matters for the eight templates already built and the
three still empty.

| PDF p. | Models | Operation | Hub subcategory |
|---|---|---|---|
| 88–89 | XA-6889K · XSS-795 · XSS-796 · XSS-7952p | laser pocket opening; pocket welting | `XAPW` ✅ templated |
| 90 | XA-858K-DK · XA-3883PL-DK · XA-8750-DK | pocket-mouth curling (chain / lock stitch) | `XAPW` ✅ |
| 91 | XA-TD720MT-B · XA-DH2210 · XA-JD2303 · XA-JD8420 | pocket sewing, decorative, pocket hemming | `XAPW` / `XAHM` ✅ |
| 92 | XA-ZT202-H · XA-310 · XA-BT401-360 · XA-ZT202 | pillowcase / bottom hemming | `XAHM` ✅ |
| 93 | XA-FB402 · XA-KZ101 · XA-CL102 · XA-KS401 | four-side, single-side, fitted-sheet hemming | `XAHM` ✅ |
| **94** | **XA-726** · **XA-81** · XA-346 | **sleeve placket** · **collar trim/turn/block** · hemming | `XAPP` ✅ · **`XACL` ⬜** · `XAHM` ✅ |
| 95 | XA-1105 PTC · XA-254 | waistband; double-needle belt-loop attaching | **no code** (belt loop = gap G4) |
| 96 | XA-EXT5100-4UT/SYL · XA-CS232 · XA-TW111 · XA-PB101 | round-neck; curtain; scarf; cloth receiving | `XACL`-adjacent — **generic table only** |
| 97 | XA-TT111-X · XA-FG212 · XA-GL102 · **XA-XK101-SF** | hood elastic; reflective tape; glove; **cuff overlock** | **`XASL`-adjacent ⬜** |
| 98 | XA-FG204 · XA-CD202 | reflective-tape overlock; ribbon overedging | no code |
| 99 / 103 | 600L · 600E-U-DS · **XA-APY/1790** · **XA-APB/988-1903** | labelling; elastic joining; **buttonhole (auto feed)**; **button sewing (auto feed)** | `XABH` ✅ · `XABA` ✅ |
| 100 | XA-008-13032P-VPLSDK / -VPLSDC · XA-988A-4-FOUR | multi-needle tape attaching; four-sided edging | no code |
| 101 | **XA-2000-603** · XA-899-2SD | **T-shirt placket**; multi-needle 2-in-1 folding | `XAPP` ✅ |
| 102 | XA-4800-787-600UT · XA-3000-1400 | single-piece hemming; pintuck | `XAHM` ✅ |
| 103 | 289 · 989L · XA-K12/K24 | button neck wrapping; zipper pre-expansion; needle butler | no code (zipper = gap G6) |

**~40 machines in this section alone, and the eight templates already built
cover most of them.**

### The three still-empty subcategories, settled

- **`XACL` (collar) — a machine EXISTS: `XA-81`, automatic collar trimming,
  turning and blocking.** Its bulleted spec gives voltage, current, air pressure,
  **collar size range (diameter >40 cm)**, head speed, weight, dimensions and
  **output 150–180 pcs/h**. That is ONE machine. `XA-EXT5100-4UT/SYL` (round
  neck) is adjacent but carries only the generic six-column table.
  **Verdict: one machine with two operation-specific values. Buildable, but thin
  — the template would rest entirely on a single sheet.**
- **`XASL` (sleeve setting) — nothing.** `XA-XK101-SF` is a cuff OVERLOCK unit
  and `XA-726` is a sleeve PLACKET machine (already `XAPP`). Neither sets a
  sleeve. **Verdict: still no source.**
- **`XASS` (side seam) — nothing anywhere in the catalogue.**

---

## 4. What this catalogue is worth, given both constraints

**Its value is EVIDENCE OF FIELDS, not a list of products.** The model codes are
old and the range will be renumbered, but the *physics* does not renumber: a
collar-blocking machine will still publish a collar diameter range, a hemming
machine will still publish a hem width, whatever the new code says. That is the
part of this catalogue that survives the new edition, and it is the only part
this document is for.

**Where it adds evidence the supplier catalogues did not:**

| Machine class | What only this catalogue printed | Template use |
|---|---|---|
| Collar blocking | collar size range (diameter), output pcs/h | the ONLY collar evidence anywhere in the library — see §3 |
| Pocket-mouth curling | curling stitch length, curling stitch width, sewing centre, material receiving device | would deepen `XAPW`, which is currently built from welting machines only |
| Pillowcase / fitted-sheet hemming | four-side vs single-side vs bottom hemming as distinct machines | confirms `XAHM`'s tubular-vs-flat split is real beyond one supplier |

**Where it adds nothing:** every page carrying only the generic six-column table
(§2). Those machines cannot deepen any template, whatever their model code.

**What NOT to do with it** — restated because the first draft got this wrong:
do not build an entry queue from it, do not seed products, do not treat its
codes as identifiers. When the new catalogue exists, re-read it the same way and
for the same single purpose.

---

## Coverage of this reading, stated honestly

- **All 138 pages were rendered and read** as eight tiled contact sheets at
  `-r 22`, plus individual spreads at `-r 55`–`60` for pages 90, 94 and 96.
- **Section boundaries are the catalogue's own** (its printed contents page),
  not inferred.
- **Model codes and machine names were transcribed from the contact sheets.**
  At that resolution headings are legible and spec-table VALUES are not — so
  every count of machines here is sound, and no numeric spec is quoted in this
  document except from the three spreads read at full resolution.
- **Spec tables were not transcribed catalogue-wide.** Doing so needs a
  per-page read at `-r 55`+ — about 60 product spreads. That is the next pass,
  and it is what product ENTRY will need.
