# Garment Machinery — Classification Audit (Catalog-Evidenced)

**Status:** 🟡 PROPOSAL — for Kamal review. **Nothing changed.** This is an audit + recommendation only; the Garment Machinery taxonomy is the governed Source-of-Truth and the Products rebuild is FROZEN. No rename/split/merge is applied until it clears the governance process in `reference-data/coding-change-governance.md` and is logged in `reference-data/product-coding-change-log.md`.

**Author:** Claude (Opus 4.8) · **Date:** 2026-06-17
**Division:** Garment Machinery (`garment-machinery`)
**Method:** Live taxonomy pulled from prod (`divisions`/`categories`/`subcategories`) + evidence read from the supplier catalog library at `~/Documents/Supplier Catalogs` (**50 of 52 PDFs read**; `Sewpower (欣普).pdf` and `Hanhai (瀚海).pdf` did not extract — re-pull recommended, non-blocking).

---

## 1. Current state (baseline)

**11 categories · 77 subcategories.** The structure follows the real factory production flow: Fabric Preparation → Cutting → Sewing (Industrial / Automatic / Domestic) → Embroidery / Printing → Finishing → Packing & Inspection, plus Leather & Footwear and Spare Parts. This is the correct mental model and is **fundamentally sound (~85%)**.

| # | Category | Subcats |
|---|----------|:---:|
| 1 | Fabric Preparation | 6 |
| 2 | Cutting Equipment | 9 |
| 3 | Industrial Sewing Machines | 9 |
| 4 | Automatic Sewing Systems | 10 |
| 5 | Domestic Sewing Machines | 4 |
| 6 | Embroidery Equipment | 5 |
| 7 | Finishing Equipment | 9 |
| 8 | Printing & Heat Press Equipment | 7 |
| 9 | Packing & Inspection | 7 |
| 10 | Leather & Footwear Machinery | 5 |
| 11 | Spare Parts & Accessories | 6 |

---

## 2. Verdict

The catalog evidence **confirmed the structure is correct**, **upgraded two earlier observations from "maybe" to "definite,"** surfaced **four genuinely missing classes**, and **disproved one suspected gap** (knitting). Net: the taxonomy needs **targeted additions + de-duplication**, not a rebuild.

---

## 3. Confirmed by catalogs

| Observation | Evidence |
|---|---|
| Cat 3 (Industrial) vs Cat 4 (Automatic) split is real and correct | **Durkopp Adler** separates "Standard machinery" / "Sewing automats" / "Eyelet buttonhole" as distinct programs. Pure-automat suppliers: **Doso** (pocket), **Zhongke Xinli** (pocket-opening), **Jiake** (button/eyelet), **PFT** (jeans automats). → Structurally right; remaining issue is naming clarity only. |
| Heat Press is over-split — should be **attributes, not subcategories** | **KILO** sells the full matrix: station (4/5/6 rotary) × actuation (manual/pneumatic/hydraulic/swing/roller-calender). One product, many variants. |
| "Spare Parts & Accessories" is overloaded | **Hongyu** = pure motors/drives supplier; **iYOU** = suction units / boilers / workshop utilities. Two unrelated worlds in one bucket. |
| Cat 1 (Fabric Prep) ↔ Cat 9 (Inspection) overlap | **Stao** and **YILI** bundle inspection + spreading + relaxing; "Fabric Inspection" genuinely straddles incoming-prep and final-QC. |

---

## 4. Proposed changes (current → proposed)

Priority: **P1** = do first (proven gap / mis-coding risk) · **P2** = high-value · **P3** = polish.

| # | Pri | Type | Change | Evidence (supplier) |
|---|:--:|------|--------|---------------------|
| C1 | P1 | **ADD category** | **CAD / Marker-Making & Digitizing** — marker plotters, digitizers, nesting/CAM software. Do NOT file under Printing (cat 8): these print *paper markers*, not fabric. | ATP (inkjet marker plotter), Bangzheng (CAD nesting + digitizer + marker), iECHO/Sertol (cut-file CAM) |
| C2 | P1 | **DE-DUP / rename** | Disambiguate the two "Fabric Inspection Machines": **Incoming Fabric Inspection** (cat 1) vs **Final Garment/Fabric Inspection** (cat 9) | Stao, YILI (both sell inspection bundled with prep) |
| C3 | P1 | **Collapse → attributes** | Merge Heat Press, Double-Station, Pneumatic, Rotary into **one "Heat Press Machines"** subcategory; model *station count* + *actuation* as attributes (per North Star: Type + Attributes, no duplication) | KILO (full station×actuation matrix) |
| C4 | P2 | **ADD category** | **Workshop Infrastructure & Material-Handling** — power/lighting busway, spreading tables, fabric trolleys/carts, racks, air-line systems | KTEC (busway, tables, trolleys, racks, air) — fits *nothing* in the 11 today |
| C5 | P2 | **SPLIT category** | Split **Motors, Drives & Electronics** out of "Spare Parts & Accessories" (servo/direct-drive motors, control panels, touch screens); leave true spares/attachments behind | Hongyu (pure motors/drives), iYOU (utilities) |
| C6 | P2 | **ELEVATE / clarify** | Promote **Template / Pattern Sewing** to a clearly-defined class (programmable + laser-template machines). Today it's only "Pattern Sewing Machines" buried in cat 3; it's a major modern family | Koleex XS-360/990/5300, Jaki, FDK, Linjian, Goldsew, Sibyer |
| C7 | P2 | **ADD subcategories** | **Seam-Sealing / Bonding** family (hot-air seam-sealing tape, hot-cold bonding press, ultrasonic/seamless) — currently forced into Finishing | Hank/中性款 (seam-seal, bonding), Dison (ultrasonic/seamless), KILO (fusing) |
| C8 | P3 | **Rename for clarity** | Make the Cat 3↔4 boundary obvious in the names, e.g. **"Sewing Machines (General)"** vs **"Automatic Units / Workstations"**; tighten where "Special Machines" ends and automats begin | Durkopp Adler program structure |
| C9 | P3 | **ADD subcategories** | Pin **Spreading Machines** and **Bias/Strip Cutting** + **Batching/Rolling** explicitly (cutting-room prep) | Stao, Bangzheng, 中性款, YILI |
| C10 | P3 | **ADD subcategory** | **Fastener Attaching** (snap / eyelet / rivet / button) as an explicit type (cross-applies to Leather & Footwear) | Jiake |
| C11 | P3 | **ADD subcategory** | **Down / Feather Filling** machine | Dison |
| C12 | P3 | **Standardize grammar** | Consistent category suffixing (…Equipment / …Machines / …Systems) for clean codes | — |

---

## 5. Retracted (earlier suspected gaps — disproved)

| Earlier "gap" | Catalog reality |
|---|---|
| Knitting machines missing | **False gap.** Zero knitting machines across all catalogs. "针织特种机" = sewing machines *for knit fabric* (Lingrai, Sewpower), not knitting machines — a translation trap. **Do not add a knitting category.** |
| Industrial laundry / dyeing | Weak — only YILI fabric washing/shrinking on the *finishing* side. Not a standalone category. |
| Overhead-hanger / UPS automation | Not evidenced as a product line — only robotic-arm feeding *inside* automats (FDK, Lingrai). |

---

## 6. Out-of-scope flag

| Item | Note |
|---|---|
| **FIBC / container-bag sewing** (Dison, Yongxing) | Industrial/technical-textile (woven sacks), not apparel. Recommend flagging **out of Garment Machinery scope** or a separate division — do not create garment subcategories for it. |

---

## 7. Coverage signal (sourcing intelligence, not taxonomy)

- **Well-sourced:** Cutting (Sertol, iECHO, Bangzheng), Industrial Sewing (many), Automatic Systems (FDK, PFT, Linjian, Doso, Zhongke), Finishing (YILI), Printing/Heat-Press (KILO), Embroidery (FNZ pure-play), Leather & Footwear (Goldsew, Sibyer, Yongxing).
- **Thin / single-supplier:** Domestic (ACME, Feiyue), multi-head Embroidery, CAD/marker tooling. Worth targeted supplier acquisition.

---

## 8. Governance — what must happen before any of this is "done"

Per `reference-data/coding-change-governance.md`, **each approved change** above must, before implementation:

1. Update the reference datasets it touches (`product-types-master.md`, `product-type-approval-matrix.md`, `family-naming-standard.md`, facet/application/operation/device dictionaries, `compatibility-rulebook.md` as applicable).
2. Run a **prefix/name/token conflict scan** (new categories C1/C4/C5 need code prefixes — check against the 12 existing flagged conflicts in approval-matrix §4).
3. Add an append-only entry to `reference-data/product-coding-change-log.md` (one `CL-NNNN` per change).
4. Sync the in-app taxonomy (`divisions`/`categories`/`subcategories`) **only after** docs are frozen — gated, requires Kamal sign-off (prod DB).

## 9. Open decisions for Kamal

1. **Approve C1 (CAD/Marker-Making)** as a new category? (Strongest, proven gap.)
2. **C4 (Workshop Infrastructure & Material-Handling)** — new category, or extend Spare Parts? KTEC-type fit-out is real but is it in scope for *Product Data*?
3. **C6** — is "Template/Pattern Sewing" its own category, or a clearly-scoped subcategory under Industrial Sewing?
4. **FIBC** — out of scope, or a separate technical-textile division?
5. Priority order / which of P1 to schedule first.
