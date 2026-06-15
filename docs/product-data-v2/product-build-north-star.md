# KOLEEX — Product Apps Build North Star (FROZEN v1.0)

_Date frozen: 2026-06-15 · Owner: Kamal Shafei · Status: agreed in discovery, pending build kickoff_

This is the single source of direction for rebuilding the **Products** (customer) and
**Product Data** (internal) apps. If we ever feel lost, we return here. Decisions below
were agreed one by one during discovery and are confirmed against the live DB, the MAQI
supplier catalog, and the **Koleex Catalog 2025** (which is the design + structure blueprint).

---

## 0. Purpose (one sentence)
One product knowledge source → **internal control** + **customer catalog** + **website** + **brochure PDF** + **printed catalog**, all from the same data.

## 1. Two front-ends, one data source
- **Product Data** (internal): full control, sees everything.
- **Products** (customer): visual catalog, browse/search/compare.
- **ONE dataset.** Each field carries a `visibility` flag: `public | internal`.
- Internal-only fields: cost, supplier, supplier codes/refs, margins/pricing, QA/factory notes, internal stock data, + anything we tag internal.

## 2. Classification (confirmed)
`Division → Category → Subcategory → Product(Model)`
- Garment Machinery today: **11 categories, 77 subcategories** (live DB).
- The **Subcategory IS the machine/stitch class** (Lockstitch, Overlock, Straight-Knife-Cutter, Heat-Press…) and is the **spec-template owner**.
- Product code prefix encodes the class: **XSL** = Lockstitch, **XSO** = Overlock, **XSI** = Interlock, etc.
- The old code-only list of 105 "machine kinds" is **retired as rigid types** → collapsed into attributes (below).

## 3. The Product Knowledge Model (3 layers + attributes)
Each product = one model (e.g. `XSL-A104E`):
1. **Identity** (shared by all): code · name · subcategory(=template) · brand · status · images · description · applications · origin.
2. **Common specs** (nearly all machines): bed type · drive · sewing speed · material capability · motor · net/gross weight · carton size · voltage.
3. **Template specs** (per subcategory): the fields specific to that class (lockstitch ≠ overlock ≠ cutter ≠ heat-press).

**Attributes = the market filters** (how customers actually shop): Heavy-Duty · Double/Multi-Needle · Automatic · Direct-drive · for-Leather, etc. These are **fields/tags, NOT separate types** — so a customer clicks "Heavy Duty" and sees every heavy-duty machine across stitch classes, with zero data duplication.

Every field AND value carries: `value + unit + icon + photo(optional) + visibility`.

## 4. Models & comparison
- Each **model = its own product page**.
- Models of the same family/series are **linked** → customer can **compare side-by-side** (important feature).

## 5. Visual system
- **Visual Library** (5,061 icons, in Database app) = the pool. Kamal uploads visuals; **AI never auto-generates them**.
- **Standalone Visual Mapping screen**: assign an icon (+ optional photo) to each **field** and each **value** (both levels). Pick from library or upload new.
- Product page renders visuals **automatically** from the mapping.

## 6. Authoring
- **One smart add/edit page** (not a multi-step wizard).
- **Single author** for now (Kamal).
- Existing data: **clean & trust it**, enrich from supplier catalogs.

## 7. Languages
- **EN · AR · ZH** minimum, **viewer-selectable**, extensible.

## 8. Design
- **Koleex Catalog 2025 aesthetic** = the north star: monochrome (black/white/gray + single accent), premium, generous whitespace, **icon spec bar**, product photo + numbered feature bullets + detail thumbnails + stitch/fabric samples + application icons.
- **One product-page render → many outputs**: Hub now; website / brochure PDF / printed catalog later (equal priority, later phase).

## 9. Frozen rules (do not drift)
1. One data source; hide via `visibility` flag, never a second table.
2. Subcategory = spec-template owner.
3. Attributes are fields/tags, NOT separate types (kills duplication; market labels become filters).
4. Every field/value can have an icon; Kamal provides the visuals.
5. One product page → many outputs.
6. Internal fields hidden from the customer app automatically.
7. Freeze the model first, then clean data, then build UI.

---

## First template draft — LOCKSTITCH (`subcategory: lockstitch-machines`)
_Derived from Koleex Catalog 2025 + MAQI catalog. `[i]` = internal-only._

### Identity
| field | type | visual |
|---|---|---|
| Primary model code (XSL-…) | text | — |
| Product name | text | — |
| Subcategory (template) | = Lockstitch | — |
| Brand | text | logo |
| Description | rich text | — |
| Main image + gallery | images | — |
| Applications | multi-select | garment icons (shirt, trousers, jeans, knit…) |
| Country of origin | text | flag |
| Cost · Supplier · Supplier code · Margin · QA notes · Stock | various | — `[i]` |

### Common specs
| field | type | visual |
|---|---|---|
| Bed type | enum [Flat · Cylinder · Post · Long-arm] | icon per value |
| Drive | enum [Mechanical · Direct-drive · Servo · Stepper] | icon per value |
| Max sewing speed | number (spm) | icon |
| Material capability | multi [Light · Medium · Heavy · Extra-heavy] | icon per value |
| Motor | text/enum | icon |
| Net / Gross weight | number (kg) | icon |
| Carton size | dimensions (mm) | icon |
| Voltage / Power | text | icon |

### Lockstitch-specific specs
| field | type | visual |
|---|---|---|
| Stitch length (max) | number (mm) | icon |
| Needle (system/size) | text (e.g. DBx1 #11–18) | icon |
| Presser-foot lift (hand / knee) | number (mm) | icon |
| Needle-bar stroke | number (mm) | icon |
| Hook | enum [Horizontal standard · Horizontal large] | icon per value |
| Feed | enum [Drop · Needle · Walking-foot · Top-and-bottom] | icon per value |
| Thread trimmer | boolean | icon |
| Auto presser-foot lift | boolean | icon |
| Auto back-tack / reverse | boolean | icon |
| Thread wiper | boolean | icon |
| Short remaining thread | number (mm) | icon |
| Bartacking | boolean | icon |
| Oil system | enum [Sealed · Auto-lubricated · Manual] | icon |
| Control panel | enum [None · LED · Touch] | icon |
| Side cutter | boolean | icon |
| Pattern sewing | number (# patterns) | icon |

### Attributes (market filters / badges)
`Heavy-Duty` · `Needles: Single/Double/Multi` · `With trimmer` · `With side cutter` · `Touch panel` · `Pattern` → power the customer-facing filters and the product-card badges.

---

## Build order (after freeze approval)
1. **Data model**: one product source + `visibility` flags + subcategory-template link + attributes. Clean existing data into it.
2. **Visual Mapping screen** (standalone) wired to Visual Library.
3. **Smart add/edit page** (single page) for Lockstitch.
4. **Visual product page** (Koleex-catalog aesthetic) — internal + customer renders from the same object.
5. Clean separation of the two apps + apply identity.
6. Later: website · brochure PDF · printed catalog from the same render.

_Stop and review live after each step._
