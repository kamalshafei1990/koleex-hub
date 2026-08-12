# Source Catalogues — authoritative product-data sources

Registered sources that spec/logistics templates and product records are built from.
A field may only enter a schema if a source below carries it on a printed page.
**Never invent a field.** If the source has no page for a subcategory, the subcategory gets no template until one arrives.

---

## S-001 — Koleex Catalog 2025

| | |
|---|---|
| **Location** | Google Drive folder `1TLnXwm31zx6RYJ6JCPXsJQfeQUimQsTq` (owner: kamal.koleex@gmail.com) |
| **Registered** | 2026-08-12 |
| **Scope** | The full Koleex own-brand line — 11 sections, 138 PDF pages |
| **Status** | Authoritative for Koleex-branded models (`X*` codes) |

### Contents of the folder

| Item | Type | Notes |
|---|---|---|
| `Koleex Catalog 2025.pdf` | PDF, 80 MB, **138 pages** | **Image-only** — no text layer. `pdftotext` returns nothing; every read is a render + look. Pages are double spreads (6617 × 2480 pt), so one PDF page = two printed pages. |
| `Koleex_Catalog_Products_Models_Names_Taglines.xlsx` | Sheet, 29 KB | **544 models** OCR-extracted from the PDF. Columns: Products No. · Model · Name · Tagline · Catalog Page · Review Status · OCR Confidence. Rows marked `Review` are **not** verified against the page. |
| `catalog Photos/` | Folder, 11 subfolders | One PNG per model, **file name = model code** (`XI-BA.png`, `XSU-100M.png`). Subfolders mirror the catalogue sections. This is a direct join key to `products.model` / `product_models.model`. |

### Page mapping (needed for every lookup)

The xlsx `Catalog Page` column holds the **printed** page number. The PDF is spreads:

```
printed_right = 2 × pdf_page − 5
printed_left  = 2 × pdf_page − 6
pdf_page      = round((printed + 6) / 2)
```

Verified against PDF page 125 → printed 244/245, and PDF page 123 → printed 240/241.

### Section index (from the catalogue's own contents page, PDF p026)

| Section | Printed pages | PDF pages |
|---|---|---|
| Pre-Sewing Equipment | 49–66 | 28–36 |
| Cutting Machines | 67–88 | 37–47 |
| Industrial Sewing Machines | 89–170 | 48–88 |
| Automatic Sewing Units | 171–204 | 89–105 |
| Shoes & Bags Machinery | 205–219 | 106–113 |
| Embroidery Machines | 220–225 | 113–116 |
| Printing & Heat Pressing Machines | 226–233 | 116–120 |
| **Ironing & Finishing Equipment** | **234–245** | **120–125** |
| Packing Equipment | 246–251 | 126–129 |
| Household Sewing Machines | 252–257 | 130–131 |
| Accessories & Spare Parts | 258–271 | 133–138 |

PDF pages 1–26 are corporate (CEO message, structure, segments, locations). PDF pages 88, 105, 113, 116, 120, 126, 129, 132 are black section dividers.

### Ironing & Finishing detail (PDF 121–125) — the pages that unblock XFSI / XFCP

| PDF page | Carries |
|---|---|
| 121 | `XI-825`, `XI-5` small electric heated steam-boiler irons · **"Iron — all series of iron"** → **XFSI** |
| 122 | `2007M` vacuum + heated folding iron table · `XI-460` spotting cleaning machine · Ironing Table Series |
| 123 | `138` reversing trousers machine · Steam Boiler series (**XFSB**) |
| 124 | `XI-QTK-3`, `XI-QTK-1` trouser pressing · `XI-9000QSY` tunnel ironing · `XI-QRY-1` mannequin steam-blowing |
| 125 | Suit Ironing Series · Trouser Leg Ironing Series · **Shirt Heat Ironing Series** → **XFCP** |

**PDF 125 right half — the collar/cuff page.** Models `XI-BA` (computer collar and sleeve press), `XI-BB` (side press), `XI-BC` (collar ironing), `XI-BD` (back seam press), `XI-BE` (shirt arm press). Its spec table carries exactly five measured columns:
steam wastage (kg/h) · air pressure (MPa) · electric heating power (kW/V) · packing size (cm) · weight (kg).

---

## S-003 — Supplier catalogue library

| | |
|---|---|
| **Location** | Google Drive → `Supplier Catalogs/` inside the S-001 folder |
| **Registered** | 2026-08-12 |
| **Scope** | **75 catalogues · 1,843 pages**, 2018–2026, plus `Suppliers data/` (50 supplier folders) and `Stand and tables/` |
| **Status** | Authoritative per supplier for the machines that supplier makes |
| **Inventory** | **[`source-catalog-inventory.md`](./source-catalog-inventory.md)** — which catalogue covers which subcategory, and whether it is machine-readable |

**24 of the 75 carry a real text layer**, so their spec tables extract directly —
S-001 has none at all. The other 50 were OCR'd (`chi_sim+eng`).

Two things this library gives that S-001 cannot:
1. **Model matrices** — five models × seven fields in one table, which is what
   tells you whether a field belongs on the family or on the model override.
2. **Family-specific measured fields** S-001 omits (steam pressure, boiler
   capacity, heating-plate size, temperature/time range, air consumption,
   throughput per hour).

Neither source replaces the other — on `XFSI` the two overlap on 5 fields and each
adds its own; the union is 8. **Read both before writing a template.**

`Suppliers data/<supplier>/Company Info.txt` is a structured record (company EN/CN,
brand, address EN/CN, tel, email, website) that maps 1:1 onto the Suppliers app.

## S-002 — YILI catalogue

| | |
|---|---|
| **Registered** | 2026-08-12 (in use since the spreading-machine template) |
| **Scope** | The YILI-sourced subcategories already in the catalogue |
| **Status** | Authoritative for the subcategories it has pages for |
| **Templates built from it** | Spreading Machines · Fabric Inspection · **XFSP** Spotting Machines · **XFTS** Thread Sucking |

Supplier identity stays internal — never surface the source name outside the Hub.

---

## Rules

1. **A template needs a page.** No page → no template. Say so and stop.
2. **The xlsx is OCR, not truth.** Anything marked `Review` must be checked against the rendered page before it reaches the DB.
3. **Photos join on model code.** `catalog Photos/<section>/<MODEL>.png` — do not rename.
4. **Reading the PDF costs a render.** There is no text layer. Use `pdftoppm` at 24 dpi for a title sweep, 100 dpi to read a page.
