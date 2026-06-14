# Product Knowledge Architecture **V3.0** — Final Pre-Freeze Audit & The Complete Universe

**Purpose.** A ruthless final review before freezing the KOLEEX Product Knowledge Universe. Challenge every assumption; find what is still missing; then either fix it or declare the architecture freeze-ready. Reference type: Lockstitch (**XSL**). **Documentation only — no schema/migration/UI/code.** Builds on [V2.0](./product-knowledge-architecture-v2.md) (69 domains + 3 layers, CL-0007) and the [Cross-App Federation map](./cross-app-knowledge-federation.md) (CL-0008). Governed by [coding-change-governance](../reference-data/coding-change-governance.md). Change-log: **CL-0009**.

---

## THE VERDICT (read this first)

**The descriptive universe is complete and freeze-ready.** Identity, specs, compatibility, media, supplier, commercial, service, documents, certifications, components, smart features, relationships, risk, localization, the knowledge graph, the AI doc, and the cross-app federation are all defined. *What a product **is** and **connects to** is done.*

**One whole dimension was missing: the ANALYTICAL / INTELLIGENCE plane.** The architecture could describe a product perfectly but could not answer **"is this product succeeding, profitable, healthy, in demand, reliable — and what should management do about it?"** Of the 20 advanced audit areas requested, **18 are derived analytics**, not authored product data. The gap is not "more fields" — it is a **missing plane** and a **discipline**.

**The discipline (critical, reinforces CL-0008):** these metrics are **DERIVED and REFERENCED, never authored or duplicated** into the product master. They are computed from the transactional apps (Sales, Finance, Inventory, CRM, Service) and **attached read-only to the product node**. The product master must never become a competing copy of Sales or Finance.

**V3.0 therefore adds:** a **4th plane** (Intelligence/Analytics) + **Cluster N: Performance & Intelligence** (17 new domains, D70–D86) + the management/decision layer. After this, **the Product Knowledge Universe is ready to freeze.** → see [PART 11 — Freeze Decision](#part-11--freeze-decision).

---

## PART 0 — The 4th plane (the architectural fix)

V1.0 defined three planes (structured / content / read-model). V3.0 adds the fourth:

| Plane | Holds | Direction | Source-of-record |
|---|---|---|---|
| 1 Structured (`pd_`) | identity, facets, edges | authored | PD V2 |
| 2 Content | media, documents | authored/uploaded | Media Library / Storage |
| 3 Read-model | resolved descriptive projections | generated (resolve) | derived from 1+2 |
| **4 Intelligence / Analytics** ⊕ | **performance · profitability · health · forecast · decision metrics** | **computed, read-only** | **derived from transactional apps; never authored in PD** |

**Rule of Plane 4:** time-series + KPI data, computed by a (future) Product-Intelligence/BI engine from Sales/Finance/Inventory/CRM/Service, **attached to the product node by reference**. PD owns the **metric definition** ("what health score means"), never the **values**. Mode marker: **DRV** (derived projection) — a computed, refreshable, read-only view; stricter than PRJ because it is *recomputed*, not just cached.

---

## OUTPUT 1 — Final Missing Domain Report
The single missing family is **Performance & Intelligence (Cluster N)**. Within it, 17 domains were absent:

| # | Missing domain | The question it answers | Was it in V2.0? |
|---|---|---|---|
| D70 | **Product Performance** | units sold, revenue trend, rank within family/type, sales velocity | ✗ |
| D71 | **Product Profitability** | gross/contribution-margin trend, price realization vs list, discount leakage | ✗ |
| D72 | **ROI / Investment** | dev-cost recovery, capital tied up, carrying cost, payback | ✗ |
| D73 | **Inventory Performance** | turnover, days-of-inventory, dead-stock/aging, ABC/XYZ, fill rate, stockout freq | ✗ |
| D74 | **Sales Performance** | win/loss, quote→order conversion, pipeline, sales-cycle length | ✗ |
| D75 | **Customer Behavior** | repeat-purchase, CLV-by-product, segment affinity, churn signal, satisfaction | ✗ (D66 was *targeting*, not behavior) |
| D76 | **Channel Performance** | dealer/distributor sell-through, territory penetration, partner-tier perf | ✗ (D67 was *tiers*, not perf) |
| D77 | **Regional Performance** | sales/margin/demand by market, regional preference | ✗ (D15 was *market intel*, not perf) |
| D78 | **Engagement / Marketing Performance** | page views, catalog/brochure downloads, inquiry rate, conversion, SEO rank | ✗ |
| D79 | **Reliability / Service Performance** | failure rate, MTBF, warranty-claim rate, repair freq, common-failure, parts-consumption | ✗ |
| D80 | **Demand Forecast & Planning** | forecast, seasonality, lead-time demand, safety-stock + reorder recommendation | ✗ |
| D81 | **Product Health Index** | composite rollup (completeness + commercial + reliability + lifecycle + demand + risk) | ✗ |
| D82 | **Decision-Support / Portfolio** | keep/grow/harvest/divest · BCG role · make-vs-buy · price/restock/discontinue action | ✗ |
| D83 | **Executive / Management Dashboard** | portfolio rollups + "what needs attention" alerts (product lens) | ✗ (Executive app exists; product lens absent) |
| D84 | **Sustainability / ESG** | carbon/LCA, energy rating, recyclability, end-of-life/trade-in, supplier social-compliance | ➕ (D46 was thin: energy/RoHS only) |
| D85 | **Compliance Intelligence** | reg-change monitoring, restricted-substance tracking, cert expiry/renewal, market-entry checklist | ➕ (D43/D44 were *static* certs) |
| D86 | **Sales Enablement** | battlecards, objection-handling, win-plays, customer ROI calculators, talk-tracks | ✗ (distinct from D49 marketing / D50 comparison) |

**Adoption / Success / Failure metrics** (audit #17–19) are **facets of D70/D79/D81** (adoption = D70 velocity + D75 repeat; success = D81 health; failure = D79 reliability) — not separate domains. Calling them out: covered, not orphaned.

---

## OUTPUT 2 — Final Missing Object Report
New knowledge **objects** (all DERIVED unless noted):
- **Metric / KPI object** — `{metric, value, period, trend, percentile-rank, source-app}`; the atom of Plane 4.
- **Time-series object** — a metric across periods (revenue-by-month, turns-by-quarter) for sparklines/trends.
- **Health-Index object** — composite score + sub-scores + RAG status + "what's dragging it down."
- **Forecast object** — predicted demand + confidence band + horizon + drivers.
- **Portfolio-Position object** — BCG quadrant (star/cash-cow/question-mark/dog) + strategic recommendation.
- **Decision / Recommendation object** — action (keep/grow/harvest/divest/reprice/restock/discontinue) + evidence + confidence + owner.
- **ESG Scorecard object** — energy/carbon/recyclability/social-compliance ratings + certificates (links to D48).
- **Compliance-Watch object** — a monitored rule/substance/cert with status (valid/expiring/affected-by-change) + alert.
- **Battlecard object** (authored, not derived) — competitor, our-edge, their-edge, objection→answer, win-play.

---

## OUTPUT 3 — Final Missing Relationship Report
New **derived edges** on the product node (computed, read-only):
`performs_at` → Product Performance · `profits_by` → Profitability (INT) · `forecasted_by` → Demand Forecast · `stocked_efficiency` → Inventory Performance · `sells_through` → Channel Performance · `behaves_as` → Customer Behavior · `fails_at_rate` → Reliability · `ranked_within` → Family/Type peer-rank · `scored_by` → Health Index · `recommends` → Decision-Support · `rated_esg` → ESG Scorecard · `watched_by` → Compliance-Watch.
**Feedback-loop edges (the most valuable, often missed):** `field_reliability_informs` Reliability(D79) → **back into** Eng-Change(D09)/Spec(D05)/Risk(D65); `sales_signal_informs` Performance(D70) → **back into** Forecast(D80)/Pricing(D11)/Lifecycle(D04). *Knowledge must flow back from the field into the product definition — not just outward.*

---

## OUTPUT 4 — Final Missing Visual Report (visual-first, brand-compliant)
Plane-4 domains are **chart-and-gauge-first**, not table-first. Per the KOLEEX brand rule: **monochrome + blue accent + functional status colors only** (RAG status is functional → allowed; no rainbow charts).

| Domain | Required visual | Required icon | Visual metadata |
|---|---|---|---|
| D70/D74/D77 Performance | trend line + sparkline + rank bar | `trend`/`chart` | `chart_type`, `period`, `compare_to` |
| D71/D72 Profitability/ROI | margin waterfall + payback gauge (INT) | `margin`/`coin` | INT-only badge |
| D73 Inventory Perf | turnover gauge + aging heatmap | `turnover` | RAG thresholds |
| D78 Engagement | funnel + views sparkline | `eye`/`funnel` | conversion bands |
| D79 Reliability | failure-rate trend + MTBF gauge + Pareto of failures | `wrench`/`alert` | RAG (functional red/amber/green) |
| D80 Forecast | trend + **confidence band** + seasonality strip | `forecast` | horizon, confidence |
| D81 Health Index | **single health gauge / traffic-light** + sub-score bars | `pulse` | RAG, drag-down list |
| D82 Decision / Portfolio | **BCG bubble matrix** + recommendation cards | `compass`/`flag` | quadrant, action chip |
| D83 Exec Dashboard | portfolio scorecard grid + alert cards | `dashboard` | "needs-attention" priority |
| D84 ESG | scorecard + eco badges | `leaf` | rating tiers |
| D85 Compliance Intel | status timeline + expiry alerts | `shield`/`clock` | valid/expiring/affected |
| D86 Sales Enablement | **battlecard** (us-vs-them) + customer-ROI calculator | `sword`/`calculator` | win/lose chips |

**Visual AI responses:** AI returns these as **cards/charts** (health gauge, BCG bubble, forecast band), not paragraphs. New `image_role`s implied: `chart`, `gauge`, `heatmap`, `bcg_matrix`, `scorecard`, `battlecard` (extend [visual SoT §17](./visual-product-experience.md)).

---

## OUTPUT 5 — Final Missing AI Report
V2.0's AI was **descriptive/retrieval** (X3 RAG over facts). V3.0 needs **analytical + prescriptive AI**:
- **Predictive** — "will demand for XSL-L9-T rise next quarter?" (reads D80).
- **Prescriptive / Decision-support** — "which 5 products should we discontinue?" "reprice this?" (reads D81/D82 with evidence + confidence).
- **Anomaly / alerting** — "margin on XSL-L9 dropped 8% — discount leakage" (reads D71); "stockout risk in 2 weeks" (D73/D80).
- **Explainability** — every recommendation cites the metrics behind it (D57 confidence + the source edges). Management must see *why*.
- **Portfolio Q&A for management** — "top 10 by profitability in GCC?" "which products are dogs?" (D77/D82).
- **Rule (unchanged):** visibility-filtered (cost/margin/INT never leak), localized (X1), graph-grounded (X2). Plane-4 metrics are **mostly internal** — the AI may surface them to management/sales but not to customers.

---

## OUTPUT 6 — Final Missing Business-Intelligence Report (the 20 audit areas mapped)
| # Audit area | Verdict | Domain |
|---|---|---|
| 1 Business Intelligence | **missing → added** | Plane 4 + D70–D83 |
| 2 Product Performance | missing → added | D70 |
| 3 Sales Performance | missing → added | D74 |
| 4 Customer Behavior | missing → added | D75 |
| 5 Dealer Performance | missing → added | D76 |
| 6 Distributor Performance | missing → added | D76 |
| 7 Regional Performance | missing → added | D77 |
| 8 Product Profitability | missing → added | D71 |
| 9 ROI | missing → added | D72 |
| 10 Decision-Making | missing → added | D82 |
| 11 Executive Dashboard | partial → added (product lens) | D83 |
| 12 Regulatory | partial (D44) → strengthened | D85 |
| 13 Compliance Intelligence | missing → added | D85 |
| 14 Forecasting | missing → added | D80 |
| 15 Demand Planning | missing → added | D80 |
| 16 Product Health | missing → added | D81 |
| 17 Success Metrics | covered (facet of D81) | D81 |
| 18 Failure Metrics | covered (facet of D79) | D79 |
| 19 Adoption Metrics | covered (facet of D70/D75) | D70/D75 |
| 20 Sustainability | partial (D46) → expanded | D84 |
**Score: 20/20 now addressed** (13 new domains, 4 enrichments, 3 as facets).

---

## OUTPUT 7 — Final Missing Management Report (per department: "what did this dept lack?")
| Department | Was missing | Now (domain) |
|---|---|---|
| **CEO / Management** | portfolio health, keep/kill decisions, "what needs attention" | D81 Health · D82 Decision/Portfolio · D83 Exec Dashboard |
| **Sales** | win/loss, conversion, battlecards | D74 Sales Perf · D86 Sales Enablement · D75 Customer Behavior |
| **Finance** | per-product profitability, ROI, discount leakage | D71 Profitability · D72 ROI |
| **Purchasing** | cost-trend / should-cost / supplier ESG | extends D10/D18 · D84 (supplier ESG) |
| **Inventory** | turnover, dead-stock, ABC/XYZ | D73 Inventory Perf |
| **Warehouse** | aging, fill rate, safety-stock recommendation | D73 · D80 |
| **Marketing** | engagement, downloads, SEO rank, conversion | D78 Engagement |
| **Service** | failure rate, MTBF, warranty-claim, parts-consumption + **feedback loop to product** | D79 Reliability (+ OUTPUT 3 feedback edges) |
| **CRM** | customer behavior, CLV-by-product, satisfaction | D75 |
| **Factory Builder** | which products drive line success | D70/D34 (perf × line-role) |
| **AI Assistants** | predictive/prescriptive + explainability | OUTPUT 5 |
**Finding:** every department had an unmet *analytical* need; none had an unmet *descriptive* need. Confirms the gap was the intelligence plane, nothing else.

---

## OUTPUT 8 — Final Missing Cross-App Dependency Report (Plane 4 sources)
Plane-4 domains are **DRV** — read-only derivations. Owner classification ([per CL-0008](./cross-app-knowledge-federation.md)): **EM** Existing Module · **ED** Existing Data area · **FM** Future Module · **EX** External.

| Domain | Computed from → | Class | Exists | Future owner |
|---|---|:--:|:--:|---|
| D70 Product Performance | **Sales** (orders/shipments) | EM | ✅ | Product-Intelligence/BI engine |
| D71 Profitability | **Finance/Accounting** + Sales (INT) | EM | ✅ | BI engine |
| D72 ROI | **Finance** + Landed-Cost (INT) | EM | ✅ | BI engine |
| D73 Inventory Performance | **Inventory** (balances/movements/valuation) | EM | ✅ | BI engine |
| D74 Sales Performance | **Sales + Quotations + CRM** | EM | ✅ | BI engine |
| D75 Customer Behavior | **CRM + Sales** | EM | ✅ | BI engine |
| D76 Channel Performance | **Commercial-Policy + Sales** | EM | ➕ | Partner Portal + BI |
| D77 Regional Performance | **Sales + Markets** | EM | ✅ | BI engine |
| D78 Engagement | **Website** + web analytics | EM/EX | ➕ | Analytics (GA-type) + BI |
| D79 Reliability | warranty + **Future Service** | FM | 🔮 | Service module |
| D80 Forecast/Demand | Sales history + **Future Forecast engine** | FM | 🔮 | Forecast engine |
| D81 Health Index | **Future BI** (composite of above) | FM | 🔮 | Product-Intelligence engine |
| D82 Decision/Portfolio | **Future BI** + Management input | FM/MA | 🔮 | BI/Decision engine |
| D83 Exec Dashboard | **Executive app** (`/executive`) + Reports (product lens) | EM | ➕ | (extend Executive) |
| D84 ESG/Sustainability | PD attrs + **Suppliers** (social) + External standards | EM/EX | ➕ | Compliance module |
| D85 Compliance Intelligence | **Future Compliance** + External reg-bodies | FM/EX | 🔮 | Compliance module |
| D86 Sales Enablement | Manual + AI-assisted | MA | ➕ | (authored) |

**New future modules implied:** **Product-Intelligence / BI engine** (computes D70–D82) · **Forecast engine** (D80). Existing transactional apps already hold the raw data — the engine that *derives* product-level KPIs from them is the missing build. **No raw data is duplicated; the engine reads and projects.**

---

## OUTPUT 9 — Recommended Additional Domains
**Add 17 (D70–D86)** in new **Cluster N — Performance & Intelligence** (Plane 4), DERIVED/referenced:
D70 Product Performance · D71 Profitability · D72 ROI · D73 Inventory Performance · D74 Sales Performance · D75 Customer Behavior · D76 Channel Performance · D77 Regional Performance · D78 Engagement/Marketing Performance · D79 Reliability/Service Performance · D80 Demand Forecast & Planning · D81 Product Health Index · D82 Decision-Support/Portfolio · D83 Executive/Management Dashboard · D84 Sustainability/ESG · D85 Compliance Intelligence · D86 Sales Enablement.
**Implied future modules:** Product-Intelligence/BI engine · Forecast engine (added to the CL-0008 build-list).
**Implied visual roles:** `chart` · `gauge` · `heatmap` · `bcg_matrix` · `scorecard` · `battlecard`.

---

## OUTPUT 10 — Final Product Knowledge Architecture V3.0
```
PLANES (4):  1 Structured (pd_)  ·  2 Content (media/docs)  ·  3 Read-model (resolved descriptive)  ·  ⊕4 Intelligence/Analytics (derived KPIs)
SPINE (8):   Division → Category → Subcategory → Product Type → Family → Model → SKU → Variant
LINKED:      Supplier · Spare Part · Consumable/Device · Application · Operation · Competitor · Market · Customer-segment · Cert-body  + (Plane-4) Sales/Finance/Inventory/CRM/Service analytics
LAYERS (3):  X1 Multi-Language (13 locales) · X2 Knowledge-Graph · X3 AI Embedding/Retrieval
DOMAINS (86):
  A Identity (D01–D04) · B Technical (D05–D09) · B+ Connected machine (D59–D62)
  C Commercial (D10–D15) · C+ Channel/Merch (D64,D67) · D Supplier (D16–D20)
  E Inventory/Logistics (D21–D25) · E+ Fulfilment (D63) · F Compatibility/Ecosystem (D26–D30)
  G Application/Usage (D31–D34) · H Service/Lifecycle (D35–D42) · H+ Calibration (D69)
  I Trust/Compliance (D43–D46) · J Content/Media/Knowledge (D47–D54) · J+ Generation (D68)
  K Presentation/Governance (D55–D58) · M Risk/Targeting (D65,D66)
  ⊕N Performance & Intelligence (D70–D86)   ← V3.0, DERIVED/referenced, Plane 4
GOVERNANCE:  knowledge-complete = done · reference-don't-duplicate · author-at-broadest-true-level ·
             Plane-4 = derived-read-only-never-authored · visibility stricter-wins (Plane-4 mostly INT) ·
             visual-first incl. charts/gauges (brand: mono+blue+functional-status only) · type-agnostic (clone to XSO/XSI)
```
**Final count:** **86 domains + 3 cross-cutting layers + 4 planes = 89 knowledge elements.** (V1.0 58 → V2.0 69 → **V3.0 86**.)

---

## PART 11 — Freeze Decision

**The architecture is READY TO FREEZE at V3.0.** Justification, ruthlessly:
- **Descriptive completeness** — what a product *is* (identity → specs → connected machine → service → compliance → media) and *connects to* (federation, CL-0008): **complete**. No department reported an unmet *descriptive* need.
- **Analytical completeness** — what a product *does in the market* (performance → profitability → health → forecast → decision): **now added** (Plane 4 / Cluster N). All 20 advanced audit areas addressed (20/20).
- **Structural completeness** — 4 planes, 8 spine levels, 9 linked entity classes, 3 cross-cutting layers, federated ownership + visibility, the knowledge graph with the product as centre and the **field→product feedback loop** closed.
- **Nothing material remains undefined at the architecture level.** What remains is **implementation, not architecture**: the gated `pd_` build stages, and the future modules (Spare-Parts, Service, BI/Forecast engine, Doc-Library, TMS, KG/Vector, Factory-Builder, etc.) — each of which has its **edge + contract already defined** so it can be built without re-modelling the product.

**Recommendation:** **Freeze the Product Knowledge Universe at V3.0** (descriptive V2.0 + federation CL-0008 + intelligence V3.0). Open a new CL only for genuine additions; treat the 86-domain set as the canonical scope. Begin implementation by wave (V2.0 Output 10): spine + the deal first, then trust/after-sales, then the intelligence plane as the transactional apps accumulate the data to derive it.

> **The one caveat, stated honestly:** Plane 4 (D70–D86) is **architecturally defined but data-dependent** — it produces value only once the transactional apps have history and the BI/Forecast/Service engines exist. Freeze the *definition* now; the *values* arrive with the data. This is correct: we are freezing the universe's **shape**, not pretending the metrics already have numbers.

---

**Status:** Source-of-truth architecture (**V3.0 — pre-freeze final**). **Documentation only** — no schema/migration/RLS/UI/code; no Stage 2 started; production untouched. V1.0/V2.0/federation carry forward unchanged. Logged as **CL-0009**.
