# Cross-App Knowledge Federation — The Product as the Central Node

**Rule.** The product is **not** an isolated object. KOLEEX Hub is a connected ecosystem of apps + future modules. **Product Knowledge references connected Knowledge Objects; it does not duplicate them as plain text.** Product Data V2 is the **orchestration hub and the graph centre** — it *owns* the intrinsic product knowledge and *the edges*, and *references* everything that another app is the system-of-record for.

**This document.** Classifies every Product Knowledge domain ([V2.0](./product-knowledge-architecture-v2.md), 69 domains + 3 layers) by **who owns the source**, what the **connected Knowledge Object** is, whether data is **copied or referenced**, and whether the owning app **exists today or must be built**. **Documentation only — no schema/migration/UI/code.** Governed by [coding-change-governance](../reference-data/coding-change-governance.md). Change-log: **CL-0008**.

> **Evidence base.** App existence below was verified against the live `src/app/` route tree + `src/app/api/` on 2026-06-15 (45 built apps/modules found; 14 confirmed absent). Routes are cited as evidence so the map is actionable. Where a data area exists but needs extension it is marked **➕ partial**.

---

## PART 1 — Owner classification (the 6 classes) + the KOLEEX app inventory

| Class | Meaning | KOLEEX apps in this class (verified routes) |
|---|---|---|
| **[EA] Existing App / Module** | A built Hub app is the system-of-record | Inventory (`/inventory`) · Finance + Accounting (`/finance`,`/api/accounting`) · Expenses · Sales (`/sales`) · Purchase (`/purchase`) · Invoices · **Quotations** (`/quotations`) · **Suppliers** (`/suppliers`) · CRM · Contacts · **Commercial Policy** (`/commercial-policy`,`/api/commercial-policy`,`…/partners`,`…/agents`) · **Visual / Media Library** (`/database/visual-library`,`/api/visual-library`,`/api/storage`,`/api/product-media`) · **Catalogs** (`/catalogs`) · **Classification/Taxonomy** (`/categories`,`/divisions`,`/api/taxonomy`) · **Brands + Components registry** (`/database/brands`,`/database/components`,`/api/brands`) · **Markets** (`/markets`) · **Landed Cost** (`/landed-cost`) · **Price Calculator** · AI (`/ai`,`/api/ai`) · Operations · Planning · Reports · Roles/Permissions (`/roles`,`/api/permissions`) · Website (`/website`) |
| **[ET] Existing Table / Data Area** | Data exists in a table/API, not a full app | `products` / `product_models` · `schema_specs` (PTE) · `/api/product-translations` · `/api/model-translations` · `/api/product-market-prices` · `/api/payment-terms` · `/api/traceability` · `/api/shipping-methods` · `/api/shipping-documents` · journals/ledger |
| **[PD] Product Data V2 Owned** | PD V2 is the intrinsic source-of-record | Identity codes · taxonomy mapping · specs/facets · config matrix · compatibility rulebook · device/operation/application dictionaries · naming · merchandising edges · visual-presentation metadata · visibility governance · provenance · the relationship graph · the AI knowledge doc |
| **[FA] Future App Candidate** | Needs an app that does **not** exist today | **Spare Parts · Service · Factory Builder · Reviews · QC (product inspection) · Training/LMS · Document Library · Compliance/Cert-tracking · Partner/Dealer Portal · Knowledge-Graph engine · Vector/RAG engine · content TMS · Catalog/Brochure Generator · Firmware/IoT/Telemetry · (BOM/PLM · Risk register)** |
| **[EX] External Source** | Outside KOLEEX | HS/customs codes · FX rates · certification-body registries (CE/UL/SASO) · competitor/market data · maps/postal · WeChat |
| **[MA] Manual Admin Input** | Human-curated, no system-of-record | Marketing copy · slogan/tagline · positioning · target-customer · risk register · curated merchandising picks |

**Hard division of labour:** **[PD] owns the *intrinsic* (what the product *is*) + the *edges* (what it *connects to*).** Everything *operational, transactional, or asset-based* is **referenced** from its owning app. PD V2 is **not** a second copy of Inventory, Finance, Suppliers, or the Media Library.

---

## PART 2 — Cross-App Ownership & Federation Matrix (all domains)
*Owner = primary system-of-record. Mode: **OWN** PD is source · **REF** live reference to owner · **PRJ** cached projection (invalidated on source change) · **SNAP** point-in-time copy (legal/audit freeze). Exists: ✅ now · ➕ partial (extend) · 🔮 future.*

| # Domain | Connected Knowledge Object → Owner | Class | Exists | Mode | Future owner (if any) |
|---|---|:--:|:--:|:--:|---|
| D01 Taxonomy | Category/Division node → **Classification/Taxonomy** | EA | ✅ | REF | — |
| D02 Identity & Codes | KOLEEX code → **PD V2** (`products`/`product_models`) | PD | ✅ | OWN | — |
| D03 Naming | base name → **PD V2**; translations → `product-translations` | PD/ET | ✅ | OWN+REF | content TMS (X1) |
| D04 Lifecycle | status → **PD V2** (`product_models`) | PD | ✅ | OWN | — |
| D05 Specs | facet values → **PD V2** (`schema_specs`) | PD | ✅ | OWN | — |
| D06 Config/Options | option matrix → **PD V2** | PD | ✅ | OWN | — |
| D07 Performance | derived from specs → **PD V2** | PD | ✅ | OWN | — |
| D08 BOM | assembly tree → **Future BOM/PLM** | FA | 🔮 | REF | BOM/PLM module |
| D09 Eng-Change | revisions → **Future PLM** | FA | 🔮 | REF | PLM module |
| D59 Control System | controller brand/model → **Brands/Components registry** | EA | ➕ | REF | Component Registry (extend) |
| D60 Motor | motor brand/model → **Brands/Components registry** | EA | ➕ | REF | Component Registry (extend) |
| D61 Firmware/OS | version/OTA → **Future Firmware/Device-Mgmt** | FA | 🔮 | REF | Firmware module |
| D62 Smart/IoT | connectivity spec → **PD V2**; telemetry → **Future IoT** | PD/FA | ➕ | OWN+REF | IoT/Telemetry module |
| D10 Cost | FOB/landed → **Finance/Purchase/Landed-Cost** | EA | ✅ | REF | — |
| D11 Pricing | price tiers → **Commercial Policy** (+ Price-Calc, market-prices) | EA | ✅ | REF | — |
| D12 Margin | margin → **Finance/Accounting** (computed) | EA | ✅ | REF | — |
| D13 Terms | MOQ/terms → **Commercial Policy** + `payment-terms` | EA | ✅ | REF | — |
| D14 Quotation-Knowledge | quote behavior → **PD V2**; issued quote → **Quotations** | PD/EA | ✅ | OWN + **SNAP** | — |
| D15 Market | demand/availability → **Markets** + External | EA/EX | ➕ | REF | — |
| D64 Merchandising Rel. | upgrade/FBT/competitor edges → **PD V2** | PD/MA | ✅ | OWN | Merchandising module (opt) |
| D67 Channel & Partner | dealer/distributor tiers → **Commercial Policy** (`/partners`,`/agents`) | EA | ➕ | REF | Partner/Dealer Portal |
| D16 Supplier Identity | supplier → **Suppliers** | EA | ✅ | REF | — |
| D17 Supplier↔Product Map | supply edge → **PD V2/Suppliers** (`coverage`,`sourcing`) | PD/EA | ✅ | OWN+REF | — |
| D18 Sourcing | source rank/capacity → **Suppliers/Purchase** | EA | ✅ | REF | — |
| D19 Supplier Quality | rating/blocked → **Suppliers** | EA | ✅ | REF | — |
| D20 Negotiation | tactics (internal) → **Suppliers** | EA | ✅ | REF | — |
| D21 Inventory | on-hand/reserved → **Inventory** (`/balances`) | EA | ✅ | REF (live) | — |
| D22 Warehouse | locations → **Inventory** (`/warehouses`) | EA | ✅ | REF | — |
| D23 Packaging | pack spec → **PD V2** (product attr) | PD | ✅ | OWN | — |
| D24 Logistics/Trade | HS/CBM → **PD V2** + External(customs) + `shipping-*` | PD/EX | ➕ | OWN+REF | — |
| D25 Traceability | batch/serial → **Inventory** + `traceability` | EA | ✅ | REF | — |
| D26 Compatibility | fitment rules+edges → **PD V2** (rulebook) | PD | ✅ | OWN | — |
| D27 Spare Parts | part records + fitment → **Future Spare-Parts** (edge=PD) | FA/PD | 🔮 | OWN(edge)+REF | Spare Parts module |
| D28 Consumables | attribute fitment → **PD V2** | PD | ✅ | OWN | — |
| D29 Devices | device dictionary → **PD V2** | PD | ✅ | OWN | — |
| D30 Accessories/Bundles | bundle edges → **PD V2** | PD/MA | ✅ | OWN | — |
| D31 Application | application dictionary → **PD V2** | PD | ✅ | OWN | (Factory Builder consumes) |
| D32 Operation | operation library → **PD V2** (+ Operations app exec) | PD/EA | ✅ | OWN | — |
| D33 Material Suitability | suitability → **PD V2** | PD | ✅ | OWN | — |
| D34 Factory-Line Role | line role → **PD V2 attr**; build engine → **Future Factory Builder** | PD/FA | 🔮 | OWN+REF | Factory Builder |
| D35 Installation | guide → **Future Service** | FA | 🔮 | REF | Service module |
| D36 Operation Guides | guide → **Future Service/Document** | FA | 🔮 | REF | Service / Doc Library |
| D37 Maintenance | schedule → **Future Service** | FA | 🔮 | REF | Service module |
| D38 Troubleshooting | symptom→fix → **Future Service** | FA | 🔮 | REF | Service module |
| D39 Service/Repair | procedure → **Future Service** | FA | 🔮 | REF | Service module |
| D40 Training | curriculum → **Future Training/LMS** | FA | 🔮 | REF | Training/LMS |
| D41 Warranty | terms → **PD V2**; claims → **Future Service** | PD/FA | ➕ | OWN+REF | Service (claims) |
| D42 Safety | hazards → **PD V2** + Document Library | PD/EA | ➕ | OWN+REF | Doc Library |
| D69 Calibration/Intervals | schedule → **Future Service** | FA | 🔮 | REF | Service module |
| D43 Certifications | cert metadata → **PD V2**; PDFs → **Storage/Catalogs**; validity → **Future Compliance**; bodies → External | PD/EA/FA/EX | ➕ | OWN+REF | Compliance module |
| D44 Regulatory/Regional | rules → **Markets** + **Future Compliance** + Manual | EA/FA | ➕ | REF | Compliance module |
| D45 Quality/Inspection | inspection → **Future QC** (≠ Hub QA bug-reporter) | FA | 🔮 | REF | QC module |
| D46 Environmental | energy/RoHS → **PD V2** + External | PD/EX | ✅ | OWN+REF | — |
| D47 Media/Visual | photos/video → **Visual/Media Library** (`/api/product-media`,`/storage`) | EA | ✅ | REF/PRJ | (360/AR/3D extend) |
| D48 Documents | manuals/datasheets → **Catalogs+Storage** + **Future Doc Library** | EA/FA | ➕ | REF | Document Library |
| D49 Marketing | value props/copy → **Manual Admin** | MA | ✅ | OWN | — |
| D50 Comparison | derived from specs → **PD V2** | PD | ✅ | OWN | — |
| D51 Localization | UI i18n + `model-translations`; content → **Future TMS** | ET/FA | ➕ | REF | content TMS (X1) |
| D52 Historical/Provenance | history → **PD V2** + Sales/Finance (`cost-history`) | PD/EA | ✅ | OWN+REF | — |
| D53 Reviews | reviews/ratings → **Future Reviews** (CRM adjacent) | FA | 🔮 | REF | Reviews module |
| D54 AI Knowledge Doc | read-model → **PD V2**; served by **AI app** | PD/EA | ✅ | OWN+REF | — |
| D68 Publishing/Generation | SEO/meta → **PD V2**; render → **Website**; auto-gen → **Future Catalog/Brochure Gen** | PD/EA/FA | ➕ | OWN+REF | Catalog/Brochure Generator |
| D55 Visual Presentation Meta | metadata → **PD V2** | PD | ✅ | OWN | — |
| D56 Visibility Governance | channel rules → **PD V2** (+ Roles/Permissions ACL) | PD/EA | ✅ | OWN+REF | — |
| D57 Data Provenance | source/confidence → **PD V2** | PD | ✅ | OWN | — |
| D58 Relationship Graph | edges → **PD V2** | PD | ✅ | OWN | (KG engine X2) |
| D65 Risk Register | risks → **Manual Admin** + Future Risk module | MA/FA | ➕ | OWN | Risk module (opt) |
| D66 Customer Targeting | segments → **CRM/Contacts** + Manual | EA/MA | ➕ | REF | — |
| **X1 Multi-Language** | translation store → `model-translations`/i18n; workflow → **Future TMS** | ET/FA | ➕ | REF | content TMS |
| **X2 Knowledge-Graph** | edges → **PD V2**; traversal engine → **Future KG engine** | PD/FA | ➕ | OWN | Knowledge-Graph engine |
| **X3 AI Embed/Retrieval** | vectors/RAG → **Future Vector engine** (AI app consumes) | FA | 🔮 | REF | Vector/RAG engine |

**Count:** of 69 domains + 3 layers → **PD-owned: ~22** · **Existing-app/table referenced: ~26** · **Future-app referenced: ~18** · **External/Manual: the remainder.** PD V2 is a **thin, high-value core** that federates a large existing estate.

---

## PART 3 — Connected Knowledge Objects & relationship (edge) types
The graph stores **typed edges**; PD V2 owns the edge, the target app owns the node.

| Edge type | From → To | Owner of node | Resolve at | Example |
|---|---|---|---|---|
| `classified_as` | Product → Taxonomy node | Classification | PRJ | XSL → Sewing/Lockstitch |
| `supplied_by` | SKU → Supplier (+supplier code) | Suppliers | REF | XSL-L9-T → Supplier#412 "GC9000" |
| `priced_by` | Model → Commercial Policy tier | Commercial Policy | REF | level/dealer/distributor price |
| `costed_at` | SKU → Finance/Landed-Cost | Finance | REF (INT) | landed cost |
| `stocked_as` | Variant → Inventory balance | Inventory | REF (live) | on-hand per warehouse |
| `depicted_by` | Model → Media asset | Visual Library | PRJ | hero/gallery/360 |
| `documented_by` | Model → Document/Catalog | Catalogs/Storage | REF | manual.pdf |
| `fits` / `requires` / `pairs` | Machine ↔ Part/Device/Consumable | PD V2 (rulebook) | OWN | needle fits machine |
| `upgrades_to` / `replaced_by` / `alternative_of` | Product ↔ Product | PD V2 | OWN | successor chain |
| `frequently_bought_with` | Product ↔ Product | PD V2 (merch) | OWN | machine + table |
| `competes_with` | Product → Competitor (INT) | Manual/External | REF (INT) | vs JUKI DDL |
| `performs` | Machine → Operation | PD V2 | OWN | felled seam |
| `made_for` | Product → Application/Customer-segment | PD V2 / CRM | OWN/REF | denim / footwear |
| `serviced_by` | Model → Service knowledge | Future Service | REF | maintenance plan |
| `controlled_by` / `driven_by` | Machine → Control/Motor brand | Brands/Components | REF | DAHAO panel · servo |
| `available_in` | Product → Market | Markets | REF | GCC / SASO |
| `localized_as` | any text → locale value | TMS/translations | REF | zh-Hans name |

---

## PART 4 — Copied vs Referenced policy
1. **OWN** — PD V2 is the source (intrinsic knowledge + edges). Authored here.
2. **REF (live)** — volatile/authoritative-elsewhere: inventory, cost, price, supplier, FX. Read live (or near-real-time projection). **Never copied** — a stale copy is worse than a join.
3. **PRJ (cached projection)** — high-read customer-surface data: resolved specs, media URLs, compatibility results. Cached in PD V2 projections, **invalidated on source change**. Fast, but the source still owns truth.
4. **SNAP (point-in-time copy)** — the **only** correct place to copy: a **quotation/order line freezes** the price + specs + terms **as of issue** (a quote must not mutate when the catalog changes). Owned by Quotations/Sales, not PD V2.

> Default: **reference, don't duplicate.** Copy only for legal/audit immutability (SNAP) or read-performance (PRJ, with invalidation). Plain-text duplication of another app's data is prohibited.

---

## PART 5 — Existing vs Future apps (the build-list this architecture implies)
**Reference today (✅ exists):** Classification · Suppliers · Inventory · Finance/Accounting · **Commercial Policy** · Quotations · Visual/Media Library · Catalogs · Brands/Components · Markets · Landed-Cost · Price-Calculator · CRM/Contacts · AI · Operations · Website · Roles/Permissions · translations & market-price & traceability & payment-terms & shipping data areas.

**Future App Candidates (🔮 — PD V2 stores the edge now; the app fills the node later):**
| Priority | Future module | Unlocks domains |
|---|---|---|
| 1 | **Spare Parts module** | D27 (+ strengthens D26) |
| 1 | **Service module** | D35–D39, D69, D41-claims |
| 2 | **Document Library** | D48 (manuals/datasheets vault), D36, D42 |
| 2 | **Knowledge-Graph + Vector/RAG engine** | X2, X3, D54 retrieval |
| 2 | **Content TMS** | X1, D03/D51 at scale (13 locales) |
| 3 | **Factory Builder** | D34 (consumes D31/D32/D29) |
| 3 | **Catalog/Brochure Generator** | D68 (consumes D47/D48/D49/D05) |
| 3 | **Reviews module** | D53 |
| 4 | **QC module** (product inspection) | D45 |
| 4 | **Compliance/Cert-tracking** | D43-validity, D44 |
| 4 | **Partner/Dealer Portal** | D67 partner surface |
| 4 | **Training/LMS** | D40 |
| 5 | **Firmware/IoT/Telemetry** | D61, D62-telemetry |
| 5 | **BOM/PLM** | D08, D09 |

---

## PART 6 — Cross-App Dependency Map
```
                 ┌─────────────────────── PRODUCT DATA V2 (hub + graph centre) ───────────────────────┐
   REFERENCES →  │ owns: identity·specs·config·compatibility·dictionaries·naming·merch edges·visual   │
                 │ meta·visibility·provenance·graph·AI doc        (PART 2: PD-owned ~22)               │
                 └───────────────────────────────────────────────────────────────────────────────────┘
 depends on (read):  Classification · Suppliers · Inventory · Finance/Accounting · Commercial Policy ·
                     Quotations · Visual/Media Library · Catalogs · Brands/Components · Markets ·
                     Landed-Cost · CRM · Website · Roles/Permissions · [🔮 Spare-Parts · Service ·
                     Doc-Library · KG/Vector · TMS · Factory-Builder · Catalog-Gen · Reviews · QC · Compliance]
 depended on by:     Quotations (identity+specs+price+compat) · Website (everything visible) ·
                     Catalog/Brochure-Gen · AI assistants (the graph + AI doc) · Inventory (product identity) ·
                     Sales/Purchase (identity) · Factory-Builder (operations/line-role)
```
**Cycle-safety:** PD V2 ↔ Inventory and PD V2 ↔ Quotations are **two-way but role-split** — Inventory references product *identity* (PD-owned), PD references *stock* (Inventory-owned); no domain is owned by both. The same split governs every pairing (PART 2 assigns exactly one owner per domain).

---

## PART 7 — Federated Inheritance Rules
1. **Spine inheritance (intrinsic/PD domains)** unchanged: `SKU ► Model ► Family ► Type ► Subcategory ► Category ► Division`, most-specific wins, override only where ⊕ (see V2.0 Ownership Matrix).
2. **Reference inheritance:** an edge declared at a broad level **inherits down** — a supplier mapped to a Family applies to all its Models/SKUs unless a more-specific edge overrides (mirrors the compatibility rulebook's broadest-true-level rule).
3. **Cross-app fallback:** if the owning app has no value at the requested level, resolve **upward in the spine**, then fall to the PD-owned default, then to "—/unknown" (never fabricate). E.g. no SKU-level price → Model price (Commercial Policy) → "POA".
4. **Snapshot freezes inheritance:** once a quote/order is issued (SNAP), its values stop inheriting — they are frozen for that document.
5. **Projection caches the resolved result:** PRJ stores the post-inheritance value for fast reads; source change invalidates the cache, never the truth.

---

## PART 8 — Federated Visibility Rules
1. **Two gates, stricter wins.** A field is shown only if **both** PD V2 channel governance (D56) **and** the owning app's ACL (Roles/Permissions) permit it. Either gate can hide; neither alone can reveal.
2. **The owning app's privacy wins on its own data.** PD references cost/price/supplier — but Finance/Commercial-Policy/Suppliers decide who may see cost/margin/supplier-internal. PD cannot widen another app's visibility by referencing it.
3. **Partner surface (dealer/distributor)** sees **only its own tier** (D67); competitor edges, internal risk, cost & margin never reach Website/Catalog/Partner.
4. **AI may reason over hidden data but never emit it.** X3 retrieval is visibility-filtered at answer time (an assistant can use cost to recommend, but a customer-surface answer omits it). Confidence (D57) is always surfaced.
5. **References inherit the source's freshness + access**, not a cached guess — a partner who loses access at the source loses it in the product view on next resolve.

---

## PART 9 — The Product Knowledge Graph (the central node)
```
                         ┌── classified_as ──▶ Taxonomy
                         ├── supplied_by ─────▶ Supplier  ──costed_at──▶ Finance
                         ├── priced_by ───────▶ Commercial Policy ──(tier)──▶ Dealer/Distributor
                         ├── stocked_as ──────▶ Inventory/Warehouse
   ┌───────────────┐     ├── depicted_by ─────▶ Visual/Media Library
   │   PRODUCT     │─────┼── documented_by ───▶ Catalogs / 🔮 Doc Library
   │  (Model/SKU)  │     ├── fits/requires ───▶ Spare Parts(🔮)/Consumables/Devices
   │  PD V2 node   │     ├── controlled_by ───▶ Brands/Components (controller/motor)
   └───────────────┘     ├── performs ────────▶ Operation ──used_in──▶ 🔮 Factory Builder line
                         ├── made_for ────────▶ Application / Customer segment (CRM)
                         ├── available_in ────▶ Markets ──restricted_by──▶ 🔮 Compliance
                         ├── serviced_by ─────▶ 🔮 Service (install/maintain/troubleshoot)
                         ├── upgrades_to / replaced_by / frequently_bought_with ─▶ other Products
                         ├── competes_with ───▶ Competitor (INT)
                         └── localized_as ────▶ translations / 🔮 TMS  (13 locales)
        ▲ embedded for retrieval by 🔮 Vector/RAG (X3) · traversed by 🔮 KG engine (X2) · answered by AI app
```
Every assistant answer, comparison, quote line, catalog page, and factory plan is a **traversal of this graph from the product node**, resolved through PART 4 modes, filtered by PART 8 visibility, localized by X1.

---

## PART 10 — Final Recommendation
1. **Adopt "reference, don't duplicate" as a hard architecture rule.** PD V2 owns ~22 intrinsic domains + all edges; it **references** ~26 existing-app domains and ~18 future-app domains. Plain-text copies of another app's data are prohibited; the only sanctioned copy is the quote/order **SNAP**.
2. **Build the edge before the app.** For every Future App Candidate, PD V2 should define the **edge + the connected-object contract now** (what identity it points to, what it expects back). When the app ships, it fills the node — no product re-modelling. This lets the universe be designed complete today and built incrementally.
3. **Treat existing data areas as owners, not gaps.** Translations, market-prices, payment-terms, traceability, brands/components, landed-cost, markets, commercial-policy already exist — **reference them**, don't rebuild. (Several were nearly mis-scoped as "future"; verification corrected this.)
4. **One owner per domain; role-split every two-way pairing.** PD↔Inventory and PD↔Quotations are bidirectional but never co-own a domain — identity is PD's, stock is Inventory's, the issued quote is Quotations'. PART 2 assigns exactly one owner each.
5. **Visibility is federated and stricter-wins.** The owning app's ACL + PD's channel governance both gate; partners see only their tier; AI reasons-over but never emits hidden data.
6. **The product is the graph centre.** Identity (PD-owned, never recycled) is the join key the whole ecosystem hangs off. Everything else is a typed, resolvable, visibility-aware edge.
7. **Sequence future modules by edge value:** Spare-Parts + Service first (after-sales revenue + uptime), then Document-Library + KG/Vector + TMS (knowledge depth + AI + scale), then Factory-Builder + Catalog/Brochure-Gen + Reviews, then QC + Compliance + Partner-Portal + Training, then Firmware/IoT + BOM/PLM.
8. **Governance unchanged.** Every domain/edge added = a CL entry + conflict scan + visibility + visual-metadata gates. This doc is the **federation map**; V2.0 is the **domain catalogue**; the dictionaries are the **vocabulary**.

> **Net effect:** Product Data V2 stays a **thin, governed, high-value core** — the identity spine + the knowledge graph — while the rest of the KOLEEX ecosystem (today's 45 apps and tomorrow's ~14 modules) supplies the data it points to. The product becomes the one node from which the entire universe is reachable.

---

**Status:** Source-of-truth architecture (cross-app federation). **Documentation only** — no schema/migration/RLS/UI/code; no Stage 2 started; production untouched. App-existence verified against the live route tree (2026-06-15). Logged as **CL-0008**.
