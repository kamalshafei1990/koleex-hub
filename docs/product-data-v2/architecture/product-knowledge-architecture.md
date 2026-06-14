# Product Knowledge Architecture — The Complete Product Object (Reference: Lockstitch XSL)

**Purpose.** Define **everything a single product knows** inside the Koleex Product Knowledge System — not just specifications. A product is treated as a **living knowledge object** that travels the full lifecycle: *supplier → sourcing → ERP → warehouse → quotation → website → catalog → customer → service → AI assistant*. The Industrial Lockstitch Machine (Product Type **XSL**) is the reference; the model is **type-agnostic** and becomes the template for Overlock (XSO), Interlock (XSI), Cutting, Printing, Finishing, etc.

**Status.** Source-of-truth **architecture** document. **Documentation only — not applied** (no schema/migration/code). Governs and is governed by: [`README.md`](./README.md) · [`product-data-v2-schema.md`](./product-data-v2-schema.md) · [`visual-product-experience.md`](./visual-product-experience.md) · [`architecture-freeze-v1.0.md`](./architecture-freeze-v1.0.md) · reference dictionaries in [`../reference-data/`](../reference-data/). Change-log: **CL-0006**.

**Relationship to the spec dictionary.** [`lockstitch-master-spec-dictionary.md`](../reference-data/dictionaries/lockstitch-master-spec-dictionary.md) (v1.1, frozen) defines **one** of the ~58 knowledge domains below — *Technical Specifications* (D05). This document is the **superset**: it places specs inside the full product object and defines the other 57 domains, their owners, consumers, scope, and visibility.

---

## PART 0 — The Architecture Model (read this first)

### 0.1 Three planes of knowledge
Every product object lives across three storage planes. Mixing them is the classic PIM failure; keeping them separate is what makes the system fast *and* normalized.

| Plane | What lives here | Form | Example |
|---|---|---|---|
| **Structured plane** (`pd_` entities) | Identity, facets, relationships, terms | Normalized rows, dictionary-governed | `needle_bar_stroke = 33.4 mm`; `SKU supplied-by Supplier#412` |
| **Content plane** (`product_media`, document store) | Photos, diagrams, manuals, datasheets, video | Files + metadata (`image_role`, `doc_type`) | hero.jpg (role=hero); service-manual.pdf (type=service) |
| **Read-model plane** (projections) | Resolved, denormalized, cached views | Generated from the two planes above | `pd_search_doc`, `pd_ai_doc`, resolved-compatibility, quotation/catalog/website projections |

**Rule:** authors write to the structured + content planes; **all surfaces read from the read-model plane.** No surface ever resolves inheritance at request time.

### 0.2 The inheritance spine (where knowledge lives)
```
Division → Category → Subcategory → Product Type → Family → Primary Model → SKU
   X         Sewing      Lockstitch        XSL        XSL-L9     XSL-L9-T    XSL-L9-T-220V-DD
```
A value **resolves at the most specific level present** and **inherits downward** as a default. Broad knowledge (taxonomy, brand voice, broad applications) is authored high (Type/Subcategory) and is true for thousands of SKUs without duplication. Operational knowledge (stock, cost, barcode) is authored low (SKU) because it is only ever true there.

> **Resolution order:** `SKU ► Primary Model ► Family ► Product Type ► Subcategory ► Category ► Division`. First non-null wins; a lower level may **override** an inherited default only where the domain permits it (marked ⊕).

### 0.3 Cross-cutting entities (NOT in the spine — attached by relationships)
Five entity classes are **not** levels of the product; they are independent objects **linked** to the spine via the typed compatibility/relationship graph ([`compatibility-rulebook.md`](../reference-data/compatibility-rulebook.md)). This is why a single needle can serve 4,000 machines without being copied into any of them.

| Entity | Linked how | Example edge |
|---|---|---|
| **Supplier** | `supplies` → SKU/Model | Supplier#412 *supplies* XSL-L9-T (their code "GC9000") |
| **Spare Part** | `fits` → Model/Family (attribute or explicit) | Rotary hook KSP-204N *fits* `needle_system∈{DB×1}` machines |
| **Consumable** | `fits` → attribute (needle_system, gauge) | Needle DP×17 *fits* any heavy-duty lockstitch |
| **Device / Add-on** | `upgrades`/`installs-on` → Model | Edge-cutter device *installs-on* XSL-L9 family |
| **Application / Operation** | `performed-by` → Type/Model | Operation "felled seam" *performed-by* XSL with folder |

### 0.4 The 58 knowledge domains, grouped into 11 clusters
Detailed why/who in **PART 1**; ownership in **PART 3**; visibility in **PART 4**.

```
A Identity & Classification   D01 Taxonomy · D02 Identity&Codes · D03 Naming · D04 Lifecycle&Versioning
B Technical & Engineering     D05 Specs · D06 Config/Options · D07 Performance/Duty · D08 BOM · D09 Eng-Change
C Commercial                  D10 Cost · D11 Pricing · D12 Margin · D13 Terms · D14 Quotation-Knowledge · D15 Market/Competitive
D Supplier & Sourcing         D16 Supplier-Identity · D17 Supplier↔Product Map · D18 Sourcing · D19 Supplier-Quality · D20 Negotiation
E Inventory & Logistics       D21 Inventory · D22 Warehouse/Handling · D23 Packaging · D24 Logistics/Trade · D25 Traceability
F Compatibility & Ecosystem   D26 Compatibility · D27 Spare-Parts · D28 Consumables · D29 Devices · D30 Accessories/Bundles
G Application & Usage          D31 Application · D32 Operation · D33 Material-Suitability · D34 Factory-Line-Role
H Service & Lifecycle          D35 Installation · D36 Operation-Guides · D37 Maintenance · D38 Troubleshooting · D39 Service/Repair · D40 Training · D41 Warranty · D42 Safety
I Trust & Compliance          D43 Certifications · D44 Regulatory/Regional · D45 Quality/Inspection · D46 Environmental
J Content, Media & Knowledge  D47 Media/Visual · D48 Documents · D49 Marketing · D50 Comparison · D51 Localization · D52 Historical/Provenance · D53 Reviews · D54 AI-Knowledge-Layer
K Presentation & Governance   D55 Visual-Presentation-Metadata · D56 Visibility-Governance · D57 Data-Provenance · D58 Relationship-Graph
```

---

## OUTPUT 1 — Product Knowledge Architecture Report
*Per domain: why it exists · who uses it. (Ownership level = Q3, Scope = Q4 → Ownership Matrix; Visibility = Q5 → Visibility Matrix.)*

### Cluster A — Identity & Classification
| # | Domain | Why it exists | Primary consumers |
|---|---|---|---|
| D01 | **Taxonomy / Classification** | Places the product in the universe (Division→…→Type); drives navigation, filtering, AI category reasoning, reporting roll-ups | Website, ERP, AI, Catalog, PM |
| D02 | **Identity & Codes** | The canonical KOLEEX code (Type prefix · Family · Model · SKU) + barcodes/GTIN; the immutable join key for every other domain; never recycled | Everyone (the spine of joins) |
| D03 | **Naming & Nomenclature** | Human names, marketing names, supplier model names, legacy aliases, localized names; lets one object be found by many words | Sales, Website, AI, Search, Supplier |
| D04 | **Lifecycle & Versioning** | State (NPI · Active · Mature · EOL · Discontinued) + supersession chains ("replaced-by"); controls what can be quoted/sold and what AI recommends | PM, Sales, ERP, Quotation, AI |

### Cluster B — Technical & Engineering
| # | Domain | Why it exists | Primary consumers |
|---|---|---|---|
| D05 | **Technical Specifications** (facets) | The measurable truth of the machine — the v1.1 dictionary (~80 facets, 7 tiers); powers compare, filter, fitment, AI answers | All; authored by PM/Engineering |
| D06 | **Configuration & Options** | Which option choices *create a SKU* vs. are just facets (voltage, drive, gauge, bed); defines the buildable variant matrix | PM, ERP, Quotation, Website configurator |
| D07 | **Performance & Duty Capability** | Speed/throughput/duty-class as *capability claims* (not raw specs) — "what job can this do, how fast"; feeds Factory Builder + sales sizing | Sales, Factory Builder, AI, Customer |
| D08 | **Bill of Materials / Components** | The assembly tree (head, hook, motor, PCB, table); the backbone for spare-parts fitment + cost roll-up + service | Service, Spare-Parts, Purchasing, Finance |
| D09 | **Engineering Change / Revision** | Tracks design revisions of a Model (rev A→B), what changed, when, why; protects fitment + warranty truth over time | Engineering, Service, QA, Supplier |

### Cluster C — Commercial
| # | Domain | Why it exists | Primary consumers |
|---|---|---|---|
| D10 | **Cost Data** | Supplier/FOB/landed cost + cost components; the basis of margin; **internal** | Purchasing, Finance (internal only) |
| D11 | **Pricing Data** | Level-based list/price-band/regional pricing; governed by the **KOLEEX Commercial Policy** (the single pricing-truth source), surfaced selectively | Sales, Quotation, Website, ERP |
| D12 | **Margin & Profitability** | Computed margin, discount floors, commission basis; **internal**; protects the deal | Finance, Sales mgmt (internal only) |
| D13 | **Commercial Terms** | MOQ, payment terms, incoterms, lead time, validity; the "how we transact" layer | Sales, Purchasing, Quotation, Customer |
| D14 | **Quotation Knowledge** | How the product behaves *in a quote*: line rendering hint, bundle logic, recommended accessories, upsell/cross-sell, alternative-when-OOS | Quotation engine, Sales, AI |
| D15 | **Market & Competitive Data** | Target segments, positioning, competitor cross-reference, win/loss notes, demand signal; informs pricing + roadmap | PM, Sales, Marketing (mostly internal) |

### Cluster D — Supplier & Sourcing
| # | Domain | Why it exists | Primary consumers |
|---|---|---|---|
| D16 | **Supplier Identity & Relationship** | Who makes/supplies it; the supplier object (factory, contacts, reliability) — see [supplier app] | Purchasing, Supplier-Mgmt, Finance |
| D17 | **Supplier ↔ Product Mapping** | Their model code/name ↔ our Model/SKU; multi-supplier per product; the translation layer for POs + catalogs | Purchasing, ERP, PM |
| D18 | **Sourcing & Procurement** | Alternate suppliers, factory units, capacity/lead-time per source, MOQ per source; sourcing resilience | Purchasing, Planning, Finance |
| D19 | **Supplier Quality & Reliability** | Defect rate, on-time %, audit/visit history, blocked-factory flags; gates which source AI/quoting prefers | Purchasing, QA, Supplier-Mgmt |
| D20 | **Negotiation Knowledge** | Tactics, leverage, flex levels, price history with a supplier; **internal** | Purchasing (internal only) |

### Cluster E — Inventory & Logistics
| # | Domain | Why it exists | Primary consumers |
|---|---|---|---|
| D21 | **Inventory & Stock** | Real-time on-hand/available/reserved per SKU per warehouse; availability for quoting + website | Warehouse, Sales, ERP, Website, Quotation |
| D22 | **Warehouse & Handling** | Storage class, weight/footprint, fragility, stacking, hazmat handling; safe + efficient storage | Warehouse, Logistics |
| D23 | **Packaging** | Packing type/size, units/carton, master-carton, palletization; the physical wrap | Warehouse, Logistics, Purchasing |
| D24 | **Logistics & Trade** | HS code, CBM, gross/net weight, container fit (20'/40'), dangerous-goods, origin; cross-border movement + freight | Logistics, Finance, Purchasing, ERP |
| D25 | **Traceability** | Batch/lot + serial tracking; recalls, warranty validation, service history binding | Warehouse, Service, QA, Customer |

### Cluster F — Compatibility & Ecosystem
| # | Domain | Why it exists | Primary consumers |
|---|---|---|---|
| D26 | **Compatibility / Fitment** | The graph: fits/requires/pairs/alt/supersedes/upgrades; the single most valuable B2B data — "what works with what" | Spare-Parts, Service, Sales, AI, Website |
| D27 | **Spare Parts** | The parts that fit (hooks, feed dogs, PCBs, loopers); after-sales revenue + uptime | Spare-Parts, Service, Customer, AI |
| D28 | **Consumables** | Needles, thread, oil, bobbins matched by attribute (needle_system, gauge); recurring revenue | Spare-Parts, Sales, Customer, AI |
| D29 | **Devices / Add-ons** | Factory-fit attachments (edge-cutter, puller, auto-folder) that may change the SKU; capability extension | PM, Sales, Quotation, Factory Builder |
| D30 | **Accessories & Bundles** | Curated kits, starter packs, "frequently bought with"; basket-building | Sales, Website, Quotation, AI |

### Cluster G — Application & Usage
| # | Domain | Why it exists | Primary consumers |
|---|---|---|---|
| D31 | **Application** | What the machine *makes* (garment types, products); the buyer's language ("I make jeans") → machine | Sales, Website, AI, Customer, Catalog |
| D32 | **Operation** | The sewing operation it performs (felled seam, hemming, attach); links machine↔process↔line | Factory Builder, Sales, AI, Service |
| D33 | **Material / Fabric Suitability** | Fabric/weight class it handles (light→extra-heavy, leather); the needle↔fabric↔machine triangle | Sales, Spare-Parts, AI, Customer |
| D34 | **Factory-Line / Production Role** | Its role in a production line + what it pairs with upstream/downstream; powers Factory Builder | Factory Builder, Sales, PM, Customer |

### Cluster H — Service & Lifecycle Support
| # | Domain | Why it exists | Primary consumers |
|---|---|---|---|
| D35 | **Installation Knowledge** | Unboxing, mounting, leveling, threading, first-run, electrical/air hookup; reduces DOA + support load | Service, Customer, AI |
| D36 | **Operation & Usage Guides** | How to run it, settings, adjustments, best practices; productivity + correct use | Customer, Service, Training, AI |
| D37 | **Maintenance Knowledge** | PM schedules, lubrication points/intervals, wear parts; uptime + warranty compliance | Service, Customer, Spare-Parts, AI |
| D38 | **Troubleshooting Knowledge** | Symptom → probable cause → fix → part needed; the most-used AI service surface | Service, Customer, AI, Spare-Parts |
| D39 | **Service & Repair Knowledge** | Repair procedures, torque/timing specs, exploded views, part-replacement steps | Service, Spare-Parts (mostly internal/partner) |
| D40 | **Training Knowledge** | Operator + technician curricula, certification, videos; onboarding + capability building | Training, Customer, Service, AI |
| D41 | **Warranty** | Coverage, duration, terms, exclusions, claim process; the trust contract | Sales, Service, Finance, Customer |
| D42 | **Safety Knowledge** | Hazards, guards, PPE, lockout, compliance warnings; legal + duty-of-care | Service, Customer, Compliance |

### Cluster I — Trust & Compliance
| # | Domain | Why it exists | Primary consumers |
|---|---|---|---|
| D43 | **Certifications & Standards** | CE/CCC/UL/RoHS/ISO + which standard the stitch/machine meets; market access + trust | Sales, Compliance, Website, Customer |
| D44 | **Regulatory & Regional Compliance** | Where it can be sold, voltage/plug/market rules, restricted markets, import constraints | Compliance, Sales, Logistics, ERP |
| D45 | **Quality & Inspection** | Inspection criteria, QC checkpoints, acceptance specs, defect taxonomy | QA, Warehouse, Supplier-Mgmt |
| D46 | **Environmental & Sustainability** | Energy class, oil/oil-free, noise, recyclability, RoHS detail; ESG + buyer requirement | Compliance, Marketing, Customer |

### Cluster J — Content, Media & Knowledge
| # | Domain | Why it exists | Primary consumers |
|---|---|---|---|
| D47 | **Media & Visual Assets** | Hero/gallery/diagram/stitch-sample/process-diagram/video; the system is **visual-first** (see [visual SoT](./visual-product-experience.md)) | Website, Catalog, Quotation, AI, Sales |
| D48 | **Documents & Files** | Datasheet, brochure, manual, parts catalog, certificate PDFs; the downloadable truth | Website, Sales, Service, Customer |
| D49 | **Marketing Knowledge** | Value props, USPs, headline copy, badges, "why buy"; the persuasion layer | Marketing, Website, Sales, Catalog, AI |
| D50 | **Comparison Knowledge** | Vs siblings + vs competitors, highlight-diff facets, "better for X"; closes deals | Sales, Website, AI, Comparison engine, Customer |
| D51 | **Localization Knowledge** | Per-language names/copy, units, currency, regional media; global reach (en/zh/ar + more) | Website, Catalog, AI, Sales |
| D52 | **Historical / Provenance** | Sales history, version history, where data came from, when verified; trend + trust | PM, Finance, Data-Gov, AI |
| D53 | **Reviews / Reputation** | Customer reviews, ratings, field feedback, NPS; social proof + product improvement | Website, PM, Sales, Customer |
| D54 | **AI Knowledge Layer** (read-model) | The denormalized `pd_ai_doc`: summary, synonyms, use-when/not-for, FAQ, embeddings, per-field `ai_priority`; the brain every assistant reads | All AI assistants |

### Cluster K — Presentation & Governance (meta-knowledge)
| # | Domain | Why it exists | Primary consumers |
|---|---|---|---|
| D55 | **Visual Presentation Metadata** | `icon_key`, `image_role`, display/priority/visibility hints; makes presentation data-driven, never hardcoded ([CL-0002](../reference-data/product-coding-change-log.md)) | Website, Catalog, Quotation, AI, Compare |
| D56 | **Visibility & Channel Governance** | Per-field channel flags (Website/ERP/AI/Quote/Catalog/Internal); enforces what each audience may see | Platform (enforced everywhere) |
| D57 | **Data Provenance & Confidence** | Source, confidence (oem_verified/declared/claimed), owner, last-verified, completeness %; data quality + AI honesty | Data-Gov, AI, PM, all editors |
| D58 | **Relationship Graph** | The edges themselves (the connective tissue of D26–D34, D16–D17); enables "show me everything related" | All engines (search/compare/compat/recommend) |

---

## OUTPUT 2 — Complete Product Object Structure
*What is attached at each level of the spine, plus the linked cross-cutting objects. `↓` = inherits to all levels below.*

```
DIVISION  (X — Garment Machinery)
  ├─ D01 Division taxonomy node ↓
  ├─ D49/D51 Brand voice, brand-level marketing & localization defaults ↓
  └─ D54 Division-level AI ontology (what "garment machinery" means) ↓

CATEGORY  (Sewing)
  ├─ D01 Category node ↓
  ├─ D05 Category-shared facet defaults (stitch family vocabulary) ↓
  ├─ D31/D32 Broad applications & operations common to sewing ↓
  └─ D26 Compatibility paradigms (needle/thread fit by attribute) ↓

SUBCATEGORY  (Lockstitch class)
  ├─ D01 Subcategory node ↓
  └─ D03 Subcategory naming/synonyms ("single-needle", "301") ↓

PRODUCT TYPE  (XSL — Lockstitch Machine)   ← the richest knowledge level
  ├─ D02 Type prefix (XSL, frozen) ↓
  ├─ D05 Master Spec Dictionary v1.1 (facet set + 7 tiers + required/optional) ↓
  ├─ D06 Which facets are SKU-creating for this type ↓
  ├─ D31 Application library (what lockstitch makes) ↓
  ├─ D32 Operation library (lockstitch operations) ↓
  ├─ D33 Material/fabric suitability frame (light→extra-heavy) ↓
  ├─ D26 Compatibility classes (needle systems, hook classes, tables) ↓
  ├─ D27/D28 Spare-part & consumable *classes* that fit the type ↓
  ├─ D34 Default production-line role ↓
  ├─ D43/D44 Typical certifications & regional rules for the type ↓
  ├─ D42 Type-level safety knowledge ↓
  ├─ D47 Type icon + diagram/symbol-legend + line-drawing ↓
  ├─ D49/D50 Type positioning, "how to choose a lockstitch" comparison frame ↓
  └─ D54/D55 Type-level AI ontology + visual metadata defaults ↓

FAMILY / SERIES  (e.g. XSL-L9)
  ├─ D02 Family code ↓
  ├─ D03 Series name + marketing line ↓
  ├─ D05 Family-common spec defaults (shared platform) ↓
  ├─ D49 Family value proposition + family hero media (D47) ↓
  ├─ D50 Family-vs-family comparison frame ↓
  └─ D04 Family lifecycle (whole series EOL) ↓

PRIMARY MODEL  (XSL-L9-T)   ← the engineering + commercial anchor
  ├─ D02 KOLEEX Primary Model code (canonical, never recycled)
  ├─ D03 Model display name + aliases + localized names
  ├─ D05 Resolved technical specs (overrides family defaults where ⊕)
  ├─ D07 Performance/duty claims
  ├─ D08 Bill of Materials (assembly tree)
  ├─ D09 Engineering revisions
  ├─ D04 Model lifecycle state + supersession ("replaced-by XSL-L9-T2")
  ├─ D11 List price / price-band (level-based; policy-linked)
  ├─ D13 Commercial terms (MOQ, lead time, warranty link)
  ├─ D14 Quotation behavior (line hint, recommended bundle)
  ├─ D26 Explicit compatibility (proprietary PCB/part fits *this* model)
  ├─ D29 Device/add-on compatibility
  ├─ D35–D40 Service knowledge set (install, maintain, troubleshoot, train)
  ├─ D41 Warranty terms
  ├─ D43 Model certifications (the actual certificate docs, D48)
  ├─ D47 Model hero + gallery + diagrams + video
  ├─ D49/D50 Model USPs + comparison rows
  ├─ D53 Model reviews/reputation
  └─ D54/D55/D57 Model AI doc + visual metadata + provenance/completeness

SKU  (XSL-L9-T-220V-DD-3/16)   ← the operational anchor (what is actually sold/stocked)
  ├─ D02 SKU code + barcode/GTIN
  ├─ D06 The exact option selections (220V · direct-drive · 3/16" gauge)
  ├─ D10 Cost (FOB/landed, by supplier)            [INTERNAL]
  ├─ D11 Effective price for this configuration
  ├─ D12 Margin                                     [INTERNAL]
  ├─ D21 Inventory (on-hand/available/reserved per warehouse)
  ├─ D22 Warehouse/handling profile
  ├─ D23 Packaging (this config's pack/weight/size)
  ├─ D24 Logistics (HS, CBM, container qty, gross/net)
  ├─ D25 Traceability (batch/serial as units move)
  ├─ D16/D17/D18 Supplier(s) for this SKU + their code + sourcing
  └─ D52 Historical sales for this SKU

LINKED CROSS-CUTTING OBJECTS  (their own records, attached by edges — not copied in)
  • SUPPLIER  → supplies SKU/Model           (D16–D20)
  • SPARE PART → fits Model/Family/attribute  (D27, via D26/D58)
  • CONSUMABLE → fits attribute (needle/gauge) (D28)
  • DEVICE    → installs-on / upgrades Model   (D29)
  • APPLICATION → performed-by Type/Model      (D31)
  • OPERATION → performed-by Type + Device     (D32)
```

---

## OUTPUT 3 — Ownership Matrix
*Q3 (which level owns it) + Q4 (scope). Marks: **●** owned/authored here · **↓** inherits down as default · **⊕** lower level may override · **→** lives on the linked entity, joined in · **—** n/a.
Scope: **U** Universal · **Cs** Category-specific · **Ms** Model-specific · **Mk** Market-specific.*

| # Domain | DIV | CAT | SUB | PT | FAM | MOD | SKU | Linked | Scope |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| D01 Taxonomy | ● | ●↓ | ●↓ | ●↓ | ↓ | ↓ | ↓ | — | U |
| D02 Identity & Codes | ● | ↓ | ↓ | ●↓ | ●↓ | ● | ● | — | U |
| D03 Naming | ↓ | ↓ | ●↓ | ●↓ | ●⊕ | ●⊕ | ⊕ | — | U |
| D04 Lifecycle & Versioning | — | — | — | ↓ | ●↓ | ●⊕ | ⊕ | — | Ms |
| D05 Technical Specs | — | ●↓ | ↓ | ●↓ | ●⊕ | ●⊕ | ⊕(config) | — | Cs/Ms |
| D06 Config & Options | — | ↓ | — | ●↓ | ⊕ | ●⊕ | ● | — | Cs/Ms |
| D07 Performance/Duty | — | ↓ | — | ↓ | ●⊕ | ●⊕ | ⊕ | — | Ms |
| D08 BOM / Components | — | — | — | ↓ | ●↓ | ●⊕ | ⊕ | →SP | Ms |
| D09 Eng-Change/Revision | — | — | — | — | — | ● | ⊕ | — | Ms |
| D10 Cost **[INT]** | — | — | — | — | — | ⊕ | ● | →SUP | Ms/Mk |
| D11 Pricing | — | — | — | ↓ | ⊕ | ●⊕ | ●⊕ | — | Mk |
| D12 Margin **[INT]** | — | — | — | — | — | ⊕ | ● | — | Mk |
| D13 Commercial Terms | — | ↓ | — | ●↓ | ⊕ | ●⊕ | ⊕ | →SUP | Mk |
| D14 Quotation Knowledge | — | — | — | ●↓ | ⊕ | ●⊕ | ⊕ | — | Ms |
| D15 Market/Competitive | — | ↓ | — | ●↓ | ●⊕ | ●⊕ | — | — | Mk |
| D16 Supplier Identity | — | — | — | — | — | — | — | ●SUP | U |
| D17 Supplier↔Product Map | — | — | — | — | — | ⊕ | ● | →SUP | Ms |
| D18 Sourcing | — | — | — | — | — | ⊕ | ● | →SUP | Mk |
| D19 Supplier Quality | — | — | — | — | — | — | — | ●SUP | U |
| D20 Negotiation **[INT]** | — | — | — | — | — | — | — | ●SUP | Mk |
| D21 Inventory | — | — | — | — | — | — | ● | — | Ms |
| D22 Warehouse/Handling | — | — | — | ↓ | ⊕ | ⊕ | ● | — | Ms |
| D23 Packaging | — | — | — | ↓ | ⊕ | ●⊕ | ● | — | Ms |
| D24 Logistics/Trade | — | — | — | ↓ | ⊕ | ●⊕ | ● | — | Ms/Mk |
| D25 Traceability | — | — | — | — | — | ⊕(policy) | ● | — | Ms |
| D26 Compatibility | — | ●↓ | ↓ | ●↓ | ●⊕ | ●⊕ | ⊕ | →SP/DEV | Cs/Ms |
| D27 Spare Parts | — | — | — | ●(class)↓ | ⊕ | ●⊕ | — | ●SP | Ms |
| D28 Consumables | — | ●↓ | ↓ | ●↓ | ⊕ | ⊕ | — | ●(attr) | Cs |
| D29 Devices/Add-ons | — | — | — | ↓ | ●⊕ | ●⊕ | ⊕ | ●DEV | Ms |
| D30 Accessories/Bundles | — | — | — | ↓ | ⊕ | ●⊕ | ⊕ | →SP/DEV | Ms |
| D31 Application | — | ●↓ | ↓ | ●↓ | ●⊕ | ●⊕ | — | ●APP | Cs/Ms |
| D32 Operation | — | ●↓ | ↓ | ●↓ | ⊕ | ⊕ | — | ●OP | Cs |
| D33 Material Suitability | — | ↓ | ↓ | ●↓ | ●⊕ | ●⊕ | — | — | Cs/Ms |
| D34 Factory-Line Role | — | ↓ | — | ●↓ | ⊕ | ●⊕ | — | →OP | Ms |
| D35 Installation | — | — | — | ↓ | ⊕ | ●⊕ | ⊕(config) | — | Ms |
| D36 Operation Guides | — | — | — | ↓ | ●⊕ | ●⊕ | — | — | Ms |
| D37 Maintenance | — | — | — | ↓ | ●⊕ | ●⊕ | — | →SP | Ms |
| D38 Troubleshooting | — | — | — | ●↓ | ●⊕ | ●⊕ | — | →SP | Ms |
| D39 Service/Repair | — | — | — | ↓ | ●⊕ | ●⊕ | — | →SP | Ms |
| D40 Training | — | ↓ | — | ●↓ | ⊕ | ●⊕ | — | — | Cs/Ms |
| D41 Warranty | — | — | — | ↓ | ●⊕ | ●⊕ | ⊕ | — | Mk |
| D42 Safety | — | ●↓ | ↓ | ●↓ | ⊕ | ●⊕ | — | — | Cs/Ms |
| D43 Certifications | — | — | — | ↓(typical) | ⊕ | ● | ⊕(market) | — | Mk |
| D44 Regulatory/Regional | — | ↓ | — | ●↓ | ⊕ | ●⊕ | ●⊕ | — | Mk |
| D45 Quality/Inspection | — | ↓ | — | ●↓ | ⊕ | ●⊕ | ⊕ | →SUP | Ms |
| D46 Environmental | — | ↓ | — | ↓ | ⊕ | ●⊕ | ⊕ | — | Ms/Mk |
| D47 Media/Visual | — | ↓ | — | ●↓ | ●⊕ | ●⊕ | ●⊕ | →SP/DEV | Ms |
| D48 Documents | — | — | — | ●↓ | ●⊕ | ●⊕ | ⊕ | — | Ms/Mk |
| D49 Marketing | ●↓ | ↓ | — | ●↓ | ●⊕ | ●⊕ | — | — | Ms/Mk |
| D50 Comparison | — | ↓ | — | ●↓ | ●⊕ | ●⊕ | — | — | Ms |
| D51 Localization | ●↓ | ↓ | — | ↓ | ⊕ | ●⊕ | ⊕ | — | Mk |
| D52 Historical/Provenance | — | — | — | — | ⊕ | ●⊕ | ● | →SUP | Ms |
| D53 Reviews/Reputation | — | — | — | ↓ | ⊕ | ● | ⊕ | — | Ms |
| D54 AI Knowledge Layer | ●↓ | ●↓ | ↓ | ●↓ | ●⊕ | ●⊕ | ⊕ | →all | U→Ms |
| D55 Visual Presentation Meta | ↓ | ↓ | — | ●↓ | ⊕ | ●⊕ | ⊕ | →all | U/Ms |
| D56 Visibility Governance | ●↓ | ↓ | — | ●↓ | ⊕ | ⊕ | ⊕ | →all | U |
| D57 Data Provenance | — | — | — | ↓ | ⊕ | ●⊕ | ●⊕ | →all | Ms |
| D58 Relationship Graph | — | ● | ↓ | ●↓ | ●⊕ | ●⊕ | ●⊕ | ●all | U |

**Reading the matrix:** specs (D05) are *owned at Product Type* (the dictionary), *defaulted at Family*, *finalized at Model*, and *config-tuned at SKU*. Cost/inventory (D10/D21) are *SKU-only* (never inherited). Supplier/spare-part/device/application/operation knowledge lives on its **own object** and is **joined in** — never copied per product.

---

## OUTPUT 4 — Visibility Matrix
*Q5 — where each domain may surface. **✓** visible · **○** conditional/partial (role- or config-gated) · **—** hidden. Channels: **Web** · **ERP** · **AI** · **Quote** · **Cat**(alog) · **Int**(ernal-only).*

| # Domain | Web | ERP | AI | Quote | Cat | Int |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| D01 Taxonomy | ✓ | ✓ | ✓ | ○ | ✓ | ✓ |
| D02 Identity & Codes | ○ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D03 Naming | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D04 Lifecycle | ○ | ✓ | ✓ | ○ | ○ | ✓ |
| D05 Technical Specs | ✓ | ✓ | ✓ | ○ | ✓ | ✓ |
| D06 Config & Options | ✓ | ✓ | ✓ | ✓ | ○ | ✓ |
| D07 Performance/Duty | ✓ | ✓ | ✓ | ○ | ✓ | ✓ |
| D08 BOM | — | ✓ | ○ | — | — | ✓ |
| D09 Eng-Change | — | ✓ | — | — | — | ✓ |
| **D10 Cost** | — | ○ | — | — | — | ✓ |
| D11 Pricing | ○ | ✓ | ○ | ✓ | ○ | ✓ |
| **D12 Margin** | — | ○ | — | — | — | ✓ |
| D13 Commercial Terms | ○ | ✓ | ✓ | ✓ | ○ | ✓ |
| D14 Quotation Knowledge | — | ✓ | ✓ | ✓ | — | ✓ |
| D15 Market/Competitive | — | ○ | ○ | — | — | ✓ |
| D16 Supplier Identity | — | ✓ | ○ | — | — | ✓ |
| D17 Supplier↔Product Map | — | ✓ | ○ | — | — | ✓ |
| D18 Sourcing | — | ✓ | — | — | — | ✓ |
| D19 Supplier Quality | — | ✓ | ○ | — | — | ✓ |
| **D20 Negotiation** | — | ○ | — | — | — | ✓ |
| D21 Inventory | ○ | ✓ | ○ | ○ | — | ✓ |
| D22 Warehouse/Handling | — | ✓ | — | — | — | ✓ |
| D23 Packaging | ○ | ✓ | ✓ | ○ | ✓ | ✓ |
| D24 Logistics/Trade | ○ | ✓ | ○ | ○ | ✓ | ✓ |
| D25 Traceability | ○(own unit) | ✓ | ○ | — | — | ✓ |
| D26 Compatibility | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D27 Spare Parts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D28 Consumables | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D29 Devices/Add-ons | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D30 Accessories/Bundles | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D31 Application | ✓ | ✓ | ✓ | ○ | ✓ | ✓ |
| D32 Operation | ✓ | ✓ | ✓ | ○ | ✓ | ✓ |
| D33 Material Suitability | ✓ | ✓ | ✓ | ○ | ✓ | ✓ |
| D34 Factory-Line Role | ✓ | ✓ | ✓ | ○ | ✓ | ✓ |
| D35 Installation | ✓ | ○ | ✓ | — | ○ | ✓ |
| D36 Operation Guides | ✓ | ○ | ✓ | — | ○ | ✓ |
| D37 Maintenance | ✓ | ✓ | ✓ | — | ○ | ✓ |
| D38 Troubleshooting | ✓ | ✓ | ✓ | — | ○ | ✓ |
| D39 Service/Repair | ○(partner) | ✓ | ○ | — | — | ✓ |
| D40 Training | ✓ | ○ | ✓ | — | ✓ | ✓ |
| D41 Warranty | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D42 Safety | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| D43 Certifications | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D44 Regulatory/Regional | ○ | ✓ | ✓ | ○ | ○ | ✓ |
| D45 Quality/Inspection | — | ✓ | ○ | — | — | ✓ |
| D46 Environmental | ✓ | ✓ | ✓ | ○ | ✓ | ✓ |
| D47 Media/Visual | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D48 Documents | ✓ | ✓ | ✓ | ○ | ✓ | ✓ |
| D49 Marketing | ✓ | ○ | ✓ | ○ | ✓ | ✓ |
| D50 Comparison | ✓ | ○ | ✓ | ○ | ✓ | ✓ |
| D51 Localization | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D52 Historical/Provenance | — | ✓ | ○ | — | — | ✓ |
| D53 Reviews/Reputation | ✓ | ○ | ✓ | — | ○ | ✓ |
| D54 AI Knowledge Layer | ○(via answers) | ✓ | ✓ | ✓ | ○ | ✓ |
| D55 Visual Presentation Meta | drives Web | ✓ | drives AI | drives Quote | drives Cat | ✓ |
| D56 Visibility Governance | (the rules) | ✓ | ✓ | ✓ | ✓ | ✓ |
| D57 Data Provenance | — | ✓ | ○(confidence) | — | — | ✓ |
| D58 Relationship Graph | ✓(as cards) | ✓ | ✓ | ○ | ✓ | ✓ |

**Bold-cost rows** (D10/D12/D20) are the hard privacy boundary: **never** Website/AI/Quote/Catalog; ERP only to authorized finance/purchasing roles. Visibility is enforced by **D56** at the projection layer — a field absent from a projection cannot leak to that channel.

---

## OUTPUT 5 — Visual Asset Matrix
*Which visual assets attach where, their `image_role` ([visual SoT §17](./visual-product-experience.md)), and surfaces. Resolution: `SKU ► Model ► Family ► Type ► icon` (a missing photo falls back upward).*

| Asset / role | Owns at | image_role | Web | Cat | Quote | AI | Compare |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| Type icon (line) | Product Type | `icon_key` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Type line-drawing / silhouette | Product Type | `diagram` | ✓ | ✓ | — | ✓ | ○ |
| Symbol legend (spec pictograms) | Product Type | `symbol_legend` | ○ | ✓ | — | ✓ | — |
| Family hero | Family | `hero` | ✓ | ✓ | ○ | ✓ | ○ |
| Model hero photo | Model | `hero` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Model gallery (≥2 views) | Model | `gallery` | ✓ | ✓ | ○ | ✓ | — |
| Detail close-ups (hook/feed/panel) | Model | `detail` | ✓ | ○ | — | ✓ | — |
| Technical / dimension diagram | Model/Type | `diagram` | ✓ | ✓ | — | ✓ | ○ |
| Stitch sample swatch | Type/Model | `stitch_sample` | ✓ | ✓ | — | ✓ | ✓ |
| Application / in-use photo | Type/Model | `application` | ✓ | ✓ | — | ✓ | — |
| Process diagram (operation→model) | Type | `process_diagram` | ✓ | ○ | — | ✓ | — |
| Parts chart (spare-parts photo map) | Model/Family | `parts_chart` | ○ | ○ | — | ✓ | — |
| Spare-part / exploded view | Spare Part (linked) | `spare_part` | ✓ | ○ | ✓ | ✓ | — |
| Packing / crate photo | SKU/Model | `packing` | ○ | ✓ | ✓ | ○ | — |
| Demo / operation video | Model/Type | `video` | ✓ | — | — | ✓ | — |
| Badge artwork (Heavy-duty, Auto, CE) | Model/Facet-derived | `badge` | ✓ | ✓ | ○ | ✓ | ✓ |
| Code-builder diagram | Product Type | `code_builder` | ○ | ✓ | — | ○ | — |
| Certificate scan (CE/CCC) | Model | `document` | ✓ | ○ | ○ | ✓ | — |

**Governance:** every new entity must define its visual metadata before approval ([CL-0002](../reference-data/product-coding-change-log.md) §7). Specs render as **grouped visual cards with per-spec `icon_key`**, never a flat table.

---

## OUTPUT 6 — AI Knowledge Matrix
*Which domains feed each AI assistant persona. The assistants read the **`pd_ai_doc` read-model** (D54), not raw tables. **●** primary feed · **○** supporting.*

| Domain → / Assistant ↓ | Product | Sales | Quotation | Spare-Parts | Service | Factory-Builder | Website-Chat |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| D05 Specs | ● | ● | ○ | ○ | ○ | ● | ● |
| D07 Performance/Duty | ● | ● | ○ | — | ○ | ● | ● |
| D11/D13 Pricing/Terms | — | ● | ● | ○ | — | ○ | ○ |
| D14 Quotation Knowledge | — | ● | ● | ○ | — | ○ | — |
| D21 Inventory | — | ● | ● | ○ | — | ○ | ○ |
| D26 Compatibility | ● | ● | ● | ● | ● | ● | ● |
| D27/D28 Spare/Consumables | ○ | ○ | ○ | ● | ● | ○ | ● |
| D29/D30 Devices/Bundles | ○ | ● | ● | ○ | ○ | ● | ● |
| D31/D32 Application/Operation | ● | ● | ○ | — | ○ | ● | ● |
| D33 Material Suitability | ● | ● | ○ | ● | ○ | ● | ● |
| D34 Factory-Line Role | ○ | ● | ○ | — | — | ● | ● |
| D35–D40 Service knowledge | — | ○ | — | ● | ● | ○ | ● |
| D41 Warranty | — | ● | ● | ○ | ● | — | ● |
| D43/D44 Cert/Regulatory | ○ | ● | ● | — | ○ | ○ | ● |
| D49/D50 Marketing/Comparison | ● | ● | ○ | — | — | ○ | ● |
| D51 Localization | ● | ● | ● | ● | ● | ● | ● |
| D53 Reviews | ○ | ● | — | — | ○ | — | ● |
| D57 Provenance/Confidence | ● | ○ | ○ | ● | ● | ○ | ● |

**AI rules baked in:** (1) the AI must respect **D57 confidence** and flag low-confidence fitments as "verify"; (2) the AI must respect **D56 visibility** — it may *reason over* internal data (cost) to make a recommendation but must **never reveal** internal-only fields to a customer surface; (3) needle↔fabric↔machine selection uses D05 `needle_system` × D33 `fabric_weight_class` (see [compatibility-rulebook §11](../reference-data/compatibility-rulebook.md)).

---

## OUTPUT 7 — Commercial Matrix
*The money layer across levels and channels. **INTERNAL** = finance/purchasing roles only.*

| Element | Owner level | Source | Web | Quote | ERP | AI | Customer |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| Supplier cost (FOB) **[INT]** | SKU × Supplier | Purchasing/PO | — | — | ○ | — | — |
| Landed cost **[INT]** | SKU | computed (cost+freight+duty) | — | — | ○ | — | — |
| Cost components **[INT]** | SKU/BOM | BOM roll-up | — | — | ○ | — | — |
| List price | Model | Commercial Policy | ○ | ✓ | ✓ | ○ | ✓ |
| Level/tier price | Model | Commercial Policy (levels) | ○ | ✓ | ✓ | ○ | ✓(their level) |
| Regional price | Model × Market | Policy + Mk rules | ○ | ✓ | ✓ | ○ | ✓ |
| Margin / margin floor **[INT]** | Model/SKU | computed | — | — | ○ | reason-only | — |
| Discount rules / approval | Model + Policy | Commercial Policy | — | ✓ | ✓ | ○ | — |
| Commission basis **[INT]** | Model | Policy | — | — | ○ | — | — |
| MOQ | Model/SKU/Supplier | PM + Supplier | ○ | ✓ | ✓ | ✓ | ✓ |
| Payment terms / incoterms | Model + Customer | Policy + deal | — | ✓ | ✓ | ○ | ✓ |
| Lead time | SKU × Supplier | Sourcing | ○ | ✓ | ✓ | ✓ | ✓ |
| Price validity / currency | Quote-time | Policy + FX | — | ✓ | ✓ | ○ | ✓ |

**Single source of pricing truth = the KOLEEX Commercial Policy** (levels, margins, discounts, commissions, credit, approvals — its own governed system). The product object **links** to it; it does not re-author pricing logic. Cost/margin/commission never cross the customer boundary.

---

## OUTPUT 8 — Supplier Matrix
*What lives on the **Supplier** object vs the **Product** object, and how they bind. A product can have many suppliers; a supplier makes many products.*

| Data | Lives on | Binds to product via | Visible |
|---|---|---|---|
| Supplier identity (name, factory, country, contacts) | **Supplier** | — | ERP, Int |
| Supplier model code / name ("GC9000") | **Supplier↔Product map** | `supplies` edge → Model/SKU | ERP, Int (translation) |
| Supplier cost / price history **[INT]** | **Supplier↔Product map** | edge | Int (Finance/Purchasing) |
| MOQ per supplier | **Supplier↔Product map** | edge | ERP, Quote(derived) |
| Lead time / capacity per supplier | **Supplier↔Product map** | edge | ERP, Sourcing |
| Factory units / production capacity per product | **Supplier↔Product map** (L+N) | edge | ERP, Int |
| Supported materials / specialties | **Supplier** | inferred match | ERP, Int |
| Quality / reliability / on-time / defect | **Supplier** | influences sourcing pref | ERP, Int |
| Audit / factory-visit history | **Supplier** | — | Int |
| Blocked-factory flag | **Supplier** | blocks sourcing + AI pref | ERP, Int |
| Negotiation knowledge (tactics/leverage/flex) **[INT]** | **Supplier** | — | Int (Purchasing) |
| Payment terms with supplier | **Supplier** | applies to PO | ERP, Int |
| Primary vs alternate source | **Supplier↔Product map** | ranked edges | ERP, Sourcing |

**Key principle:** the product's **identity is KOLEEX's**, not the supplier's. The supplier's model code is *mapping metadata*, never the product's identity. Switching or adding a supplier must **not** change the KOLEEX Model/SKU code (decouples sourcing from catalog).

---

## OUTPUT 9 — Final Recommendation

1. **Adopt the 58-domain object as the canonical scope of "a product."** Specifications are 1 of 58 domains. "Knowledge-complete" replaces "spec-complete" as the definition of *done* for a product. This document is the master checklist.

2. **Keep the three planes separate** (structured / content / read-model). Authors write structured + content; **every surface reads only projections**. This is what lets the system be both fully normalized *and* fast enough for website/AI.

3. **One spine, five linked entities.** Never duplicate supplier/spare-part/device/application/operation knowledge into products — attach by typed edges (D58). This is the difference between a catalog that scales to 10,000 SKUs and one that collapses under copy-paste.

4. **Author knowledge at the broadest true level; override only where marked ⊕.** Taxonomy/brand/applications at Type; specs at Type→Model; cost/inventory at SKU-only. The Ownership Matrix (Output 3) is the authoring map.

5. **Make visibility a first-class, enforced field (D56), not a convention.** Cost/margin/negotiation are structurally excluded from non-internal projections. The AI may *reason over* them but a customer-facing projection that lacks the field cannot leak it.

6. **Visual-first is non-negotiable (D47/D55).** Every level resolves an icon + photo; specs are visual cards with per-spec icons; compatibility renders as linked cards. No entity is "done" without its visual metadata ([CL-0002 §7](../reference-data/product-coding-change-log.md)).

7. **The AI doc (D54) is a generated read-model, not a data source.** It is rebuilt from the 57 other domains + confidence (D57). Assistants never query raw tables; they query the doc — keeping answers fast, governed, and confidence-aware.

8. **Sequence the build by value, not by cluster.** Recommended order once Stage 2 is unblocked:
   - **Wave 1 (spine + the deal):** D01–D06, D11/D13, D21, D26–D28, D47/D55 → makes a product sellable, findable, quotable, visual.
   - **Wave 2 (trust + after-sales):** D31–D34, D41, D43/D44, D35–D38, D48–D50, D54 → makes it advisable + serviceable + AI-ready.
   - **Wave 3 (depth):** D07–D09, D15, D19/D20, D39/D40, D45/D46, D52/D53, D57 → makes it best-in-world.

9. **Governance:** every domain added/changed follows [coding-change-governance](../reference-data/coding-change-governance.md) (a CL entry, conflict scan, visibility + visual-metadata gates). The reference-data dictionaries remain the single vocabulary source; this document is the **map**, the dictionaries are the **legend**.

10. **Type-agnostic by design.** Validate the model once on Lockstitch (XSL — already at spec v1.1), then **clone the structure** (not the values) to Overlock (XSO) and every other type. The 58 domains are universal; only the *contents* of D05/D26/D31/D32 differ per type.

> **Definition of a complete KOLEEX product (v1):** identity + classification + resolved specs + ≥1 application + compatibility classes + at least one supplier mapping + cost & price + inventory + hero & gallery + icon + warranty + ≥1 certification + AI summary/use-when + provenance/confidence + visibility flags set. Anything less is a draft.

---

**Status:** Source-of-truth architecture. **Documentation only** — no schema/migration/RLS/code; no Stage 2 started; production untouched. Frozen scope of the product knowledge object; per-domain field design lands in the gated `pd_` stages. Logged as **CL-0006**.
