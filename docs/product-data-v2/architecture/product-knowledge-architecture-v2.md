# Product Knowledge Architecture **V2.0** — The Complete KOLEEX Product Knowledge Universe

**Mandate.** We are not building a catalog, a spec database, or a website page. We are building the **single source of truth** that simultaneously serves: Website · ERP · AI Assistants · Quotation · Catalog Generator · Brochure Generator · Service · Spare Parts · Factory Builder · Sales · Purchasing · Finance · Warehouse · **Suppliers · Dealers · Distributors · End Users**. A product must carry **every piece of knowledge any of these systems needs.**

**This document.** A full audit of V1.0 against the complete-universe requirement, plus **Product Knowledge Architecture V2.0**. Reference type: Lockstitch (**XSL**). **Documentation only — no schema/migration/UI/code.** Builds on [`product-knowledge-architecture.md`](./product-knowledge-architecture.md) (V1.0, 58 domains, CL-0006); that base is unchanged and carries forward. Governed by [coding-change-governance](../reference-data/coding-change-governance.md). Change-log: **CL-0007**.

> **Verdict of the audit:** the V1.0 *model* (3 planes · 1 inheritance spine · 5 linked entities) is sound and survives. But V1.0 was **device-mechanical and English-implicit**. V2.0 closes three structural gaps — the **connected/digital machine**, the **commercial channel & lifecycle depth**, and **multi-language + knowledge-graph + AI-retrieval as first-class layers** — adding **11 new domains** and **3 cross-cutting layers**: **58 → 69 domains (+3 layers = 72 knowledge elements).**

---

## PART 0 — What V2.0 changes (executive delta)

| Shift | V1.0 | V2.0 |
|---|---|---|
| **The machine is connected** | mechanical specs only; `controller_brand` a lone facet | first-class **Control System · Motor · Firmware/OS · Smart/IoT** domains (D59–D62) |
| **What the customer receives** | BOM (how it's built) | + **Box Contents / shipment manifest** (what's in the carton) (D63) |
| **Commercial depth** | list + level price | + **channel tiers (dealer/distributor)**, market/promo price, **price & margin history** (D64, D67, extends D10–D12) |
| **Relationships** | technical compatibility + supersession | + **merchandising graph**: upgrade/downgrade/successor/replacement/FBT/competitor (D64) |
| **Risk & targeting** | implicit | **Risk register** (D65) + **Customer Targeting** (D66) as domains |
| **Generation** | marketing copy | **Publishing/Generation** knowledge (SEO/meta/slogan/catalog-page/brochure templates) feeding catalog+brochure+SEO generators (D68) |
| **Service depth** | maintenance/repair | + **Calibration & service-interval schedules** (D69) |
| **Language** | English-implicit; "Localization" a domain | **Multi-Language Fabric** — a cross-cutting layer; 13 languages × every textual field (X1) |
| **Graph** | a relationship-graph domain | **Knowledge-Graph Substrate** — product as a typed node; the retrieval backbone (X2) |
| **AI** | a curated AI doc | + **AI Embedding & Retrieval layer** — every domain vector-indexed & RAG-served, multilingual (X3) |
| **Audiences** | Web/ERP/AI/Quote/Catalog/Internal | + **Partner (Dealer/Distributor)** surface (visibility matrix gains a column) |

---

## PART 1 — The V2.0 Model (recap + elevation)

**Three planes** (unchanged): *structured* (`pd_` entities) · *content* (media/documents) · *read-model* (projections). Authors write the first two; surfaces read only projections.

**One inheritance spine** (refined for the user's identity list):
```
Division → Category → Subcategory → Product Type → Family → MODEL(=marketed "Product") → SKU → VARIANT
   X         Sewing      Lockstitch        XSL        XSL-L9       XSL-L9-T            …220V-DD   (resolved config instance)
```
- **"Product" = Model** (the marketed, named, photographed thing).
- **SKU = a buildable configuration**; **Variant = a fully-resolved sellable instance** of a SKU's option axes (voltage · drive · gauge · bed). A Variant is the leaf the warehouse stocks and the quote sells. *(V1.0 ended at SKU; V2.0 names the Variant leaf explicitly per the identity requirement.)*

**Five linked cross-cutting entities** (unchanged): Supplier · Spare Part · Consumable/Device · Application · Operation — attached by typed edges, never copied.

**THREE NEW CROSS-CUTTING LAYERS (the V2.0 elevation — they wrap *all* domains):**

- **X1 · Multi-Language Fabric.** Localization is not one domain — it is a **modifier on every textual domain**. Each translatable field stores a per-locale value resolved by `requested-locale ► regional-base ► English-base`. RTL for Arabic; CJK width rules for zh/zh-Hant/Thai/Vietnamese. **Target locales (13):** `en · zh-Hans · zh-Hant · ar · es · fr · pt · ru · tr · hi · vi · id · th`. Applies to: all names (D03), descriptions/features/advantages (D49/D70-publishing), applications (D31), service text (D35–D40), SEO/meta/slogan (D68), AI answers (X3), document variants (D48), media captions (D47).

- **X2 · Knowledge-Graph Substrate.** The product is a **node** in a typed graph; every relationship in the system is an **edge**. This is the backbone that lets "show me everything related to XSL-L9-T" return parts, suppliers, applications, operations, documents, media, certifications, markets, customers, competitors, successors — in one traversal. Subsumes & formalizes V1.0 D58. Edge types are governed (see PART 4).

- **X3 · AI Embedding & Retrieval.** Beyond the curated `pd_ai_doc` (D54), V2.0 adds a **vector/RAG layer**: every domain is chunked, embedded, and retrievable, **grounded in the graph (X2)** and **answered in the user's locale (X1)**, **filtered by visibility (D56)** and **flagged by confidence (D57)**. This is what makes the assistants accurate instead of plausible.

---

## OUTPUT 1 — Product Knowledge Architecture V2.0 (the complete domain set)

V1.0's 58 domains (D01–D58) carry forward unchanged — full detail in [V1.0](./product-knowledge-architecture.md). V2.0 **adds D59–D69** and the **X1–X3 layers**. New domains in **bold**.

```
A Identity & Classification   D01 Taxonomy · D02 Identity&Codes(+Variant) · D03 Naming · D04 Lifecycle&Versioning
B Technical & Engineering     D05 Specs · D06 Config/Options · D07 Performance · D08 BOM · D09 Eng-Change
  └ B+ Connected machine      **D59 Control System · D60 Motor · D61 Firmware/OS · D62 Smart/IoT/Connectivity**
C Commercial                  D10 Cost · D11 Pricing · D12 Margin · D13 Terms · D14 Quotation-Knowledge · D15 Market
  └ C+ Channel & merchandising **D64 Merchandising-Relationships · D67 Channel&Partner(Dealer/Distributor)**
D Supplier & Sourcing         D16 Supplier-Identity · D17 Supplier↔Product Map · D18 Sourcing · D19 Supplier-Quality · D20 Negotiation
E Inventory & Logistics       D21 Inventory · D22 Warehouse · D23 Packaging · D24 Logistics/Trade · D25 Traceability
  └ E+ Fulfillment            **D63 Box-Contents / Shipment-Manifest**
F Compatibility & Ecosystem   D26 Compatibility · D27 Spare-Parts · D28 Consumables · D29 Devices · D30 Accessories/Bundles
G Application & Usage          D31 Application · D32 Operation · D33 Material-Suitability · D34 Factory-Line-Role
H Service & Lifecycle          D35 Install · D36 Operate · D37 Maintain · D38 Troubleshoot · D39 Repair · D40 Train · D41 Warranty · D42 Safety
  └ H+ Calibration            **D69 Calibration & Service-Interval Schedules**
I Trust & Compliance          D43 Certifications(+SASO/GCC/regional) · D44 Regulatory/Regional · D45 Quality/Inspection · D46 Environmental
J Content, Media & Knowledge  D47 Media/Visual(+360/AR/3D) · D48 Documents · D49 Marketing · D50 Comparison · D51 Localization · D52 Historical/Provenance · D53 Reviews · D54 AI-Knowledge-Doc
  └ J+ Generation             **D68 Publishing & Generation (SEO/meta/slogan/catalog-page/brochure)**
K Presentation & Governance   D55 Visual-Presentation-Meta · D56 Visibility-Governance · D57 Data-Provenance · D58 Relationship-Graph
M Risk & Targeting            **D65 Risk-Register · D66 Customer-Targeting**

CROSS-CUTTING LAYERS (modify all domains)   X1 Multi-Language Fabric · X2 Knowledge-Graph Substrate · X3 AI Embedding & Retrieval
```

### New-domain definitions (why · who · key objects)
| # | Domain | Why it exists | Primary consumers | Key knowledge objects |
|---|---|---|---|---|
| **D59** | **Control System** | The machine's brain is a product in itself — buyers, service & spares all need it | Service, Spare-Parts, Sales, AI, Factory-Builder | controller brand/model/version, panel type, feature set, supported-software, firmware link→D61 |
| **D60** | **Motor** | Motor brand/type drives price, energy, fit & spares | Sales, Service, Spare-Parts, Purchasing | motor brand/model/type (servo/clutch/direct), power, energy class, mount, OEM vs alt |
| **D61** | **Firmware / OS** | Connected machines have versions, updates, OTA — a lifecycle of their own | Service, AI, PM, End-User | OS/firmware name+version, update method, OTA capability, changelog, compatibility window |
| **D62** | **Smart / IoT / Connectivity** | The connected-factory differentiator (WiFi/BT/cloud/app/AI features) | Sales, Marketing, AI, End-User, Factory-Builder | connectivity (WiFi/BT/LAN), cloud functions, mobile-app functions, on-board AI features, telemetry |
| **D63** | **Box Contents / Shipment Manifest** | "What's in the carton" ≠ BOM; drives unboxing, claims, completeness, quoting | Warehouse, Sales, Service, End-User, AI | standard contents, optional contents, included accessories/spares, missing-component rules, packing-list doc |
| **D64** | **Merchandising Relationships** | The *commercial* graph: what to sell instead/next/with | Sales, Quotation, Website, AI | alternative · upgrade · downgrade · successor · replacement · recommended · bundled · frequently-bought-together · competitor |
| **D65** | **Risk Register** | Surfacing product/usage/maintenance/compliance/supply risk protects the customer & the deal | PM, Compliance, Purchasing, Service | risk type · severity · likelihood · mitigation · owner; usage/maintenance/compliance/supply risks |
| **D66** | **Customer Targeting** | "Who is this for" powers recommendation, marketing, sales sizing | Sales, Marketing, AI | target customer · customer type · segment · size · buyer persona · use-context |
| **D67** | **Channel & Partner (Dealer/Distributor)** | Dealers/distributors are first-class audiences with their own price tiers & data | Sales, Finance, Dealers, Distributors | dealer cost/price tier · distributor cost/price tier · partner-visible docs · MAP/MSRP · territory rules |
| **D68** | **Publishing & Generation** | Catalog/Brochure/SEO generators need *structured* publishable content, not ad-hoc copy | Catalog-Gen, Brochure-Gen, Website, Marketing | SEO title/description/keywords · meta · slogan · tagline · catalog-page template · brochure block set · canonical URL |
| **D69** | **Calibration & Service Intervals** | Schedules & calibration are recurring, plannable service knowledge | Service, End-User, AI, Spare-Parts | calibration procedures · service intervals (hrs/cycles) · maintenance schedule · wear-part replacement cadence |

---

## OUTPUT 2 — Complete Product Knowledge Universe (what attaches at each level)
*Δ = new/extended in V2.0. `↓` inherits down.*

```
DIVISION (X) ── brand voice, division taxonomy, division AI ontology  ·  X1 base-locale brand strings
CATEGORY (Sewing) ── shared facets, broad applications/operations, compatibility paradigms
SUBCATEGORY (Lockstitch) ── subcategory naming/synonyms (X1)
PRODUCT TYPE (XSL) ── Spec Dictionary v1.1 · application & operation libraries · compatibility classes ·
        Δ control-system/motor/firmware/IoT *class* defaults (D59–D62) · safety · type icon/diagram/symbol-legend ·
        Δ certification *typical set* incl SASO/GCC (D43) · Δ risk *class* patterns (D65) · Δ target-segment frame (D66) ↓
FAMILY (XSL-L9) ── series name/marketing (X1) · family spec & platform defaults · family hero · family comparison frame
MODEL = "PRODUCT" (XSL-L9-T) ── the rich node:
        identity+names(X1) · resolved specs · D59 control system · D60 motor · D61 firmware/OS · D62 smart/IoT ·
        D08 BOM · D09 revisions · D04 lifecycle+successor/replacement(→D64) · D11 price + Δ market/promo price ·
        D67 dealer/distributor tiers · D13 terms · D14 quote behavior · D64 merchandising edges ·
        D26/D29 compatibility & devices · D35–D40 service set · D69 calibration/intervals · D41 warranty ·
        D43 certifications(docs→D48) · D65 risk register · D66 customer targeting · D47 media(+360/AR/3D) ·
        D48 documents · D49 marketing · D50 comparison · D68 SEO/meta/slogan/catalog+brochure templates ·
        D53 reviews · D54 AI doc · D55 visual meta · D57 provenance/completeness
SKU (config) ── exact options · D63 box contents for *this* config · D10 cost · D12 margin · D11 effective price ·
        D17/D18 supplier(s)+code+sourcing · D23 packaging · D24 logistics · D52 sales history
VARIANT (resolved instance) ── D21 inventory (on-hand/reserved/safety/reorder) · D22 warehouse locations ·
        D25 batch/serial · barcode/GTIN

LINKED NODES (own records, joined by X2 edges):
  SUPPLIER (D16–D20: primary/secondary/backup ranked, rating, capacity, risk, certs+docs) ·
  SPARE PART (D27) · CONSUMABLE/DEVICE (D28/D29) · APPLICATION (D31) · OPERATION (D32) ·
  COMPETITOR PRODUCT (D64) · MARKET (D15) · CUSTOMER SEGMENT (D66) · CERTIFICATION BODY/REGION (D43/D44)
```

---

## OUTPUT 3 — Updated Ownership Matrix (new domains + layers)
*Marks: ● owned · ↓ inherits · ⊕ override · → linked · — n/a. Scope: U universal · Cs category · Ms model · Mk market · **Lc** locale.*
*(D01–D58 carry V1.0 ownership unchanged; revisions called out below the table.)*

| # New Domain | DIV | CAT | SUB | PT | FAM | MOD | SKU | VAR | Linked | Scope |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| D59 Control System | — | ↓ | — | ●(class)↓ | ⊕ | ●⊕ | ⊕ | — | →SP | Ms |
| D60 Motor | — | ↓ | — | ↓ | ⊕ | ●⊕ | ⊕(config) | — | →SP/SUP | Ms |
| D61 Firmware / OS | — | — | — | ↓ | ⊕ | ● | ⊕ | ⊕(unit) | — | Ms |
| D62 Smart / IoT | — | ↓ | — | ●(class)↓ | ●⊕ | ●⊕ | ⊕ | — | — | Ms |
| D63 Box Contents | — | — | — | ↓(template) | ⊕ | ●⊕ | ● | ⊕ | →SP/DEV | Ms |
| D64 Merchandising Rel. | — | — | — | ↓ | ●⊕ | ●⊕ | ⊕ | — | →MOD/competitor | Ms/Mk |
| D65 Risk Register | — | ↓(class) | — | ●↓ | ⊕ | ●⊕ | ⊕ | — | →SUP | Ms/Mk |
| D66 Customer Targeting | — | ↓ | — | ●↓ | ●⊕ | ●⊕ | — | — | →segment | Mk |
| D67 Channel & Partner | — | — | — | ↓(policy) | ⊕ | ●⊕ | ●⊕ | — | →dealer/distributor | Mk |
| D68 Publishing/Generation | ↓(brand) | — | — | ●↓ | ●⊕ | ●⊕ | ⊕ | — | — | Ms/Lc |
| D69 Calibration/Intervals | — | ↓ | — | ●↓ | ●⊕ | ●⊕ | — | — | →SP | Ms |
| **X1 Multi-Language Fabric** | ● | ↓ | ↓ | ↓ | ⊕ | ⊕ | ⊕ | — | →all text | U/Lc |
| **X2 Knowledge-Graph** | ● | ● | ↓ | ●↓ | ●⊕ | ●⊕ | ●⊕ | ●⊕ | ●all | U |
| **X3 AI Embed/Retrieval** | ●(gen) | ↓ | ↓ | ●↓ | ⊕ | ●⊕ | ⊕ | — | →all | U/Lc |

**Revisions to V1.0 ownership:** D02 gains the **Variant** leaf (barcode/GTIN owned at Variant). D10/D11/D12 gain **channel tiers** (dealer/distributor cost+price owned at Model/SKU, governed by Commercial Policy via D67) and **history time-series** (price/margin history owned at Model, append-only). D51 Localization is **superseded-in-role** by X1 (kept as the regional-content domain; X1 is the field-level mechanic). D58 is **elevated into X2** (kept as the edge catalog; X2 is the substrate).

---

## OUTPUT 4 — Updated Visibility Matrix (now incl. **Partner** = Dealer/Distributor)
*✓ visible · ○ conditional/role-gated · — hidden. Surfaces: **W**eb · **E**RP · **AI** · **Q**uote · **C**atalog · **P**artner(Dealer/Distributor) · **INT**ernal. Brochure & SEO generators read the same **publishing projection** as Catalog/Web.*

| # New Domain | W | E | AI | Q | C | P | INT |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| D59 Control System | ✓ | ✓ | ✓ | ○ | ✓ | ✓ | ✓ |
| D60 Motor | ✓ | ✓ | ✓ | ○ | ✓ | ✓ | ✓ |
| D61 Firmware / OS | ○ | ✓ | ✓ | — | ○ | ✓ | ✓ |
| D62 Smart / IoT | ✓ | ✓ | ✓ | ○ | ✓ | ✓ | ✓ |
| D63 Box Contents | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D64 Merchandising Rel. | ✓(safe edges) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| D65 Risk Register | ○(safety only) | ✓ | ○ | — | — | ○ | ✓ |
| D66 Customer Targeting | ○ | ✓ | ✓ | ○ | ○ | ✓ | ✓ |
| **D67 Channel & Partner** | — | ✓ | ○ | ○ | — | ✓(own tier) | ✓ |
| D68 Publishing/Generation | ✓ | ○ | ✓ | ○ | ✓ | ✓ | ✓ |
| D69 Calibration/Intervals | ✓ | ✓ | ✓ | — | ○ | ✓ | ✓ |
| X1 Multi-Language | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| X2 Knowledge-Graph | ✓(as cards) | ✓ | ✓ | ○ | ✓ | ✓ | ✓ |
| X3 AI Embed/Retrieval | ○(via answers) | ✓ | ✓ | ✓ | ○ | ✓ | ✓ |

**Hard boundaries:** **Competitor edges** (D64) and **internal risk** (D65 supply/compliance) and **dealer/distributor cost** (D67) are never Website/Catalog; partner tiers show a partner **only their own** tier (`P` = own-tier only). Cost/margin/negotiation (D10/D12/D20) remain INT-only. Enforced by D56 at the projection layer.

---

## OUTPUT 5 — Updated AI Matrix
**(a) New domains × assistant personas** (● primary · ○ supporting):

| Domain → / Assistant ↓ | Product | Sales | Quotation | Spare-Parts | Service | Factory-Builder | Website-Chat | Partner-Portal |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| D59 Control System | ● | ● | ○ | ● | ● | ● | ● | ● |
| D60 Motor | ● | ● | ○ | ● | ● | ○ | ● | ● |
| D61 Firmware/OS | ○ | ○ | — | ○ | ● | ○ | ○ | ● |
| D62 Smart/IoT | ● | ● | ○ | ○ | ○ | ● | ● | ● |
| D63 Box Contents | ○ | ● | ● | ● | ● | ○ | ● | ● |
| D64 Merchandising Rel. | ○ | ● | ● | ○ | — | ● | ● | ● |
| D65 Risk Register | ● | ○ | ○ | ○ | ● | ○ | ○ | ○ |
| D66 Customer Targeting | ● | ● | ○ | — | — | ● | ● | ○ |
| D67 Channel & Partner | — | ● | ● | — | — | — | — | ● |
| D68 Publishing/Generation | ● | ○ | — | — | — | — | ● | ○ |
| D69 Calibration/Intervals | — | ○ | — | ● | ● | ○ | ● | ● |

**(b) AI capability taxonomy (V2.0 — every domain answers to these intents via X3):**
| AI capability | Grounded in | Example |
|---|---|---|
| **AI Search** (semantic) | X3 embeddings over all domains, X1 multilingual | "оверлок для кожи" → leather-capable machines |
| **AI Recommendation** | D64 merchandising + D66 targeting + D33 suitability | "best for a denim startup, low budget" |
| **AI Product Matching** | D05 specs + D26 compatibility + D31 application | "I make backpacks" → machine set |
| **AI Factory Builder** | D32 operation + D34 line-role + D29 devices | build a 50-worker jeans line |
| **AI Spare-Parts** | D26/D27/D28 + D59/D60 + D08 BOM | "hook for XSL-L9-T" |
| **AI Quotation** | D11/D67 pricing + D13 terms + D63 box + D14 | build a quote with the right accessories |
| **AI Service** | D35–D40 + D69 + D38 troubleshooting + D61 firmware | "thread keeps breaking" |
**AI rules (reaffirmed):** answers are **graph-grounded (X2)**, **localized (X1)**, **visibility-filtered (D56 — never leak cost/margin/competitor/partner-tier to customer surfaces)**, and **confidence-flagged (D57)**.

---

## OUTPUT 6 — Updated Visual Matrix
**(a) New media roles (extend `image_role`, [visual SoT §17](./visual-product-experience.md)):**
| Role | Owns at | Why | W | C | AI | Partner |
|---|---|---|:--:|:--:|:--:|:--:|
| `360_view` | Model | spin-around product view | ✓ | ○ | ✓ | ✓ |
| `ar_model` | Model | place-in-factory AR (usdz/glb) | ✓ | — | ○ | ✓ |
| `3d_model` | Model | digital twin / configurator / Factory-Builder | ✓ | — | ✓ | ✓ |
| `box_content` | SKU/Model | unboxing / completeness check (D63) | ✓ | ✓ | ✓ | ✓ |
| `feature_image` | Model | one image per headline feature (D49/D62) | ✓ | ✓ | ✓ | ○ |
| `control_panel` | Model | the control system UI (D59) | ✓ | ○ | ✓ | ✓ |
| `connectivity_diagram` | Model | IoT/app/cloud topology (D62) | ✓ | ○ | ✓ | ○ |
| `calibration_diagram` | Model | service/calibration visual (D69) | ○ | — | ✓ | ✓ |

**(b) Visual-first reaffirmed for every new domain:** D59/D60 → component photo + brand badge; D63 → box-content photo grid; D64 → comparison/upgrade **cards**; D65 → risk **icons** (severity); D67 → partner-tier **badge**; D68 → catalog-page & brochure **layout templates**. Specs and relationships render as **visual cards**, never flat tables; AI returns visual responses (card/diagram/360). Every new entity defines its visual metadata before approval ([CL-0002 §7](../reference-data/product-coding-change-log.md)).

---

## OUTPUT 7 — Missing Domain Report (the audit, by the 8 required lenses)

**1. Missing Domains.** V1.0 lacked the **connected-machine** stack (control system, motor-as-object, firmware/OS, smart/IoT), **box-contents**, **merchandising relationships**, **risk register**, **customer targeting**, **channel/partner**, **publishing/generation**, and **calibration/intervals**. → D59–D69.

**2. Missing Knowledge Objects.** Box-contents manifest (standard/optional/included spares + missing-component rules); controller/motor/firmware as **branded, versioned sub-objects** (not lone facets); price-tier object per channel; **price & margin history** as append-only **time-series**; SEO/meta/slogan object; calibration-schedule object; risk-register entries; **Variant** as the stockable leaf.

**3. Missing Relationships.** Merchandising edges — **upgrade · downgrade · successor · replacement · recommended · bundled · frequently-bought-together · competitor**; product↔market, product↔customer-segment, product↔certification-region, **machine↔control-software**, **machine↔mobile-app**, machine↔firmware-version. → formalized as governed edge types in **X2**.

**4. Missing Visual Requirements.** **360 view, AR model, 3D/digital-twin**, box-content imagery, per-feature images, control-panel & connectivity diagrams, calibration visuals. → Output 6.

**5. Missing AI Requirements.** A **vector/embedding/RAG layer** (X3) over *every* domain; an explicit **AI-capability taxonomy** (search/recommend/match/factory-builder/spares/quotation/service); **multilingual** answers (X1); **graph-grounded** retrieval (X2); a **Partner-Portal** assistant persona. V1.0 had a curated AI doc but no retrieval substrate.

**6. Missing Commercial Requirements.** **Dealer cost/price + distributor cost/price tiers**, **market price**, **promotional price**, **margin history**, **price history**, MAP/MSRP, territory rules. → D67 + extensions to D10–D12.

**7. Missing Supplier Requirements.** Explicit **primary / secondary / backup** supplier **ranking**, **supplier risk**, **supplier capacity**, **supplier certifications + documents**, supplier-product-code per source. V1.0 had supplier-quality but not the multi-source rank + supplier doc vault. → extends D16–D19.

**8. Missing Product Lifecycle Requirements.** A formal stage machine **NPI → Active → Mature → EOL → Discontinued → Replaced**, with **per-stage data obligations**, **firmware/version lifecycle (D61)**, **price/margin history (time-series)**, **spare-parts-availability-after-EOL** commitment, and **end-of-service-life** notice. → extends D04 + ties D61/D69/D27.

---

## OUTPUT 8 — Recommended New Domains (summary)
**11 content domains:** D59 Control System · D60 Motor · D61 Firmware/OS · D62 Smart/IoT · D63 Box Contents · D64 Merchandising Relationships · D65 Risk Register · D66 Customer Targeting · D67 Channel & Partner · D68 Publishing & Generation · D69 Calibration & Service Intervals.
**3 cross-cutting layers:** X1 Multi-Language Fabric (13 locales) · X2 Knowledge-Graph Substrate · X3 AI Embedding & Retrieval.
**Extensions (no new domain):** D43 +SASO/GCC/regional · D47 +360/AR/3D/box/feature roles · D04 +formal lifecycle stage-machine + EOL/spares commitment · D10–D12 +channel tiers + history time-series · D16–D19 +multi-source ranking + supplier docs · D02 +Variant leaf.

---

## OUTPUT 9 — Final Domain Count
| | Domains | Cross-cutting layers | Total knowledge elements |
|---|:--:|:--:|:--:|
| **V1.0** | 58 | 0 (graph/AI/locale were ordinary domains) | 58 |
| **V2.0** | **69** (58 + 11) | **3** (X1·X2·X3) | **72** |
Linked entity classes: 5 (Supplier, Spare Part, Consumable/Device, Application, Operation) + competitor/market/segment/cert-body nodes. Spine levels: **8** (Division→…→SKU→**Variant**). Target locales: **13**.

---

## OUTPUT 10 — Final Recommendation

1. **Adopt V2.0 as the canonical scope.** A KOLEEX product is **69 domains + 3 layers**, served to **18 consumer systems** including dealers, distributors, and end users. The V1.0 model holds; V2.0 completes the **connected-machine, commercial-channel, and language/graph/AI** dimensions it lacked.

2. **Treat language, graph, and AI-retrieval as layers, not domains.** They modify *everything*. Building them once (X1/X2/X3) is cheaper and more correct than bolting localization/relationships/embeddings onto each domain.

3. **Model the machine as connected, not just mechanical.** Control system, motor, firmware/OS, and IoT are first-class — this is where industrial machinery is heading and where after-sales + differentiation live.

4. **Separate "how it's built" (BOM) from "what ships" (Box Contents) from "what's compatible" (Compatibility) from "what to sell next" (Merchandising).** Four different graphs for four different teams; conflating them is the classic failure.

5. **Make channel & lifecycle first-class time-aware data.** Dealer/distributor tiers, price/margin history, and a formal NPI→EOL stage-machine with a **spare-parts-after-EOL** commitment turn the catalog into an asset the whole org trusts over years.

6. **Visibility is enforced and now partner-aware.** Add the **Partner** surface; partners see only their own tier; competitor edges, internal risk, cost & margin never cross to customer/partner surfaces.

7. **Generation is structured, not copy-paste.** D68 lets the Catalog Generator and Brochure Generator assemble themselves from the same governed publishing projection, in 13 languages — no manual layout per product.

8. **Build sequence (V2.0 waves, once Stage 2 unblocks):**
   - **Wave 1** — spine+Variant, D05/D06, D11+D67 tiers, D21, D26–D28, D47(+core roles), D55, **X1 for names/descriptions**, **X2 core edges** → sellable, findable, multilingual.
   - **Wave 2** — D59–D63 (connected machine + box), D31–D34, D41, D43/D44, D35–D40+D69, D48–D50, D68, D54, **X3 retrieval** → advisable, serviceable, AI-ready, generated.
   - **Wave 3** — D64/D65/D66, D07–D09, D15, D19/D20 depth, D45/D46, D52/D53, full D61 firmware lifecycle → best-in-world.

9. **Governance unchanged.** Every domain added/changed = a CL entry + conflict scan + visibility + visual-metadata gates; dictionaries remain the single vocabulary source. This doc is the **map**; the dictionaries are the **legend**; V1.0 is the **base layer**.

10. **Type-agnostic, still.** Validate V2.0 once on XSL (frozen at spec v1.1), then **clone the 69-domain structure** (not the values) to Overlock (XSO) and every type. Only the *contents* of the technical, compatibility, application, and service domains differ.

> **Definition of a complete KOLEEX product (v2):** everything in v1 **plus** control-system + motor + firmware/IoT (if connected) + box contents + ≥1 merchandising relationship + risk register + target customer + channel tiers + SEO/slogan + calibration/intervals + 360/AR where applicable + **all customer-facing text in ≥3 launch locales (en/zh/ar), graph-linked, embedded for AI.** Anything less is a draft.

---

**Status:** Source-of-truth architecture (**V2.0**). **Documentation only** — no schema/migration/RLS/UI/code; no Stage 2 started; production untouched. V1.0 base unchanged. Per-domain field design lands in the gated `pd_` stages (waves in Output 10). Logged as **CL-0007**.
