# KOLEEX Product Knowledge Audit
**Scope:** Products App + Product Data App, from the Product-Knowledge-System lens.
**Mode:** read-only audit + recommendations. **Nothing implemented.** Produced after P0 #5 (i18n), before any P1/P2.
**Date:** 2026-06-15. **Evidence:** live walkthrough of all 5 surfaces during P0 #5a–5e + schema/code reads (see `product-knowledge-audit-observations.md`).

---

## 0. Readiness Scorecard

| Item | Score | One-line basis |
|---|:--:|---|
| **Architecture** | **78%** | Strong core (schema engine · governed coding · typed columns · translations · media roles · RLS). Thin on the *knowledge-graph* layer (relationships, completeness-as-first-class, naming types). |
| **Product Data App** | **72%** | Robust authoring (P0 #1–5 hardened it). But linear CRUD wizard, no live preview while editing, two spec homes, relationships = flat untyped list. |
| **Products App** | **68%** | `ProductPreview` is a credible visual product; but relationships unrendered, completeness invisible, and a legacy flat `TemplateView` data-dump still serves real routes. |
| **Visual Experience** | **65%** | Read side (preview) feels like a product; **manage side (wizard) + list still feel like a database**. No completeness/relationship visualization. |
| **Knowledge Structure** | **70%** | Taxonomy + coding + schema-engine + knowledge blocks are well-designed; but the **doc architecture (PD-V2 V3.0) is well ahead of the live schema** — relationships/naming-types/completeness not yet implemented. |
| **Product Population Readiness** | **58%** | Core identity/specs/media/coding **is** ready. But 3 additive-yet-foundational decisions (typed relationships · naming model · one completeness engine) should land **before** loading thousands, or you backfill twice. |

**Headline:** the foundation is genuinely solid and the public *preview* already reads as a Knowledge Object — but the **knowledge-graph connective tissue (relationships), the naming model, and an authoritative completeness engine are not yet real in the live app.** These are **additive, not a rebuild** — but 3 of them are gates that are far cheaper to set *before* population than after.

---

## 1. Completeness Engine — *can we output "Product Completeness = 72%"?*

**Today: partially.** `computeReadiness` (`src/lib/product-schema/readiness.ts`) already produces a weighted 7-dimension score (data·commercial·technical·media·website·ai·brochure) — so the *machinery* to render a single visual % exists. **Three problems:**

1. **Two non-reconciled meters.** The Review step also runs a *legacy hand-counted* meter (10/13 fields) that disagrees with `computeReadiness` on inputs, weights, and even media thresholds (legacy ignores manual/video; schema wants gallery≥3; MediaSection nudges want gallery≥4). Three different "complete" definitions.
2. **Wrong input set vs. your target.** Target groups = Hero · Gallery · Manual · Video · Applications · Compatibility · Related · Alternative · Specifications.
   - ✅ First-class: **Hero, Gallery, Manual, Video, Specifications**.
   - ❌ **NOT first-class: Applications, Compatibility, Related, Alternative** — they only count *if* the resolved schema happens to model them as fields/`aiReadable` blocks. No dimension tracks relationship- or application-completeness.
3. **Invisible where it matters.** The score lives **only on the wizard's Review step** — never on the product list, the cards, or the public preview. A 30%-stub and a fully-authored product look identical everywhere a human actually browses.

**Recommendation (P0):** one authoritative `productCompleteness(product)` engine over the full target group-set (media roles + spec coverage + **relationships** + **applications** + **compatibility**), returning `{ overall%, perGroup, missing[] }`. Surface the % as a ring on **list cards, the wizard (persistent, not just Review), and the preview**. Retire the legacy meter.

---

## 2. Relationship Engine — *is the system ready for Related / Alternative / Upgrade / Replacement / Cross-Sell?*

**No — only 1 of 5, and it isn't rendered.**

- **Storage:** a single `related_products` table = `{ product_id, related_id, order }`. **No `relation_type`.** So only a generic "related" edge can be stored; Alternative / Upgrade / Replacement / Cross-Sell **have no home**.
- **Authoring:** the wizard collects only "Related" links, as a flat list.
- **Rendering:** `ProductPreview` + `TemplateView` render **zero** relationship sections; `ProductPreviewProps` carries **no** relationship inputs — even the "related" links the operator sets **die before the product view** (5d finding). Every product is an island; the catalog is not a graph.
- **Good news:** the **Visual Library already ships a typed relationship model** (`similar_to / alternative_of / parent_of / child_of / used_with / opposite_of …` with reverse-mapping) — a proven in-repo pattern to clone for products.

**Recommendation (P0 — gate before population):** (a) add `relation_type` to the product relationship table (enum: related/alternative/upgrade/replacement/cross_sell) + reverse-edge handling; (b) wizard UI to pick type per link; (c) render typed relationship sections in `ProductPreview`. Additive schema, no rebuild — but doing it *after* loading thousands of products means re-touching every product's links.

---

## 3. Future Naming System — *will the current app need a full rebuild to support EN / ZH / AR / Short / Marketing / SEO names?*

**No full rebuild — but the current per-locale table is too thin and should be redesigned before population.**

What exists today:
- `products.product_name` (single primary) + `slug`.
- `product_translations` = `{ product_id, locale, product_name, description }` → **localized base-name works** (EN base; ZH/AR rows; any locale — additive, no rebuild).
- `model_translations` = `{ model_id, locale, model_name, tagline }`.

What's missing:
- **No Short Name, Marketing Name, SEO Name / SEO Title fields** anywhere (the model `tagline` and product `excerpt` are the nearest, but they're single-purpose, not a naming system).
- The translations table models **one name per locale** — it cannot hold *name-TYPE × locale* (e.g. an Arabic Marketing Name, a Chinese SEO title).

**Verdict:** supportable **without an app rebuild**, but **not** by extending the current translations table ad-hoc. The clean target is a `product_names(product_id, locale, name_type, value)` model (type ∈ official/short/marketing/seo × locale) that supersedes the thin translations table.
**Recommendation (P0 — decision gate, not necessarily build): lock the naming model now.** If products are populated against the current single-`product_name`+translations shape and the type×locale model lands later, every product needs a second naming backfill. Decide the shape before population; the migration itself can be additive.

---

## 4. Visual Product Experience — *"do I feel I'm managing a product, or a row in a database?"*

**Honest answer: you VIEW a product, but you MANAGE a database row.** The Knowledge-Object feeling is bolted onto the read side and largely absent from the manage side.

- **Product List** — card/grid view is KO-ish (4:3 image, code-as-title, badges, taxonomy chips). But the **list view is a literal spreadsheet** (`Product · Category · Brand · Models · Status` columns); **no completeness signal**; **no relationship hints**; `Status` is a raw publish enum, not knowledge maturity. *DB-ish.*
- **Product Cards** — the strongest list surface; closest to "a product." Missing: a completeness ring and any "part of family / N related" cue. *Mostly KO.*
- **Product Preview** (`ProductPreview`) — **the one genuinely Knowledge-Object surface**: cinematic hero, schema-driven importance/emphasis, material filmstrip, application cards, automation workflow, performance meters, knowledge blocks. *KO — preserve and make canonical.*
- **Product Details / public route** — undermined by a **second, legacy `TemplateView`** still wired on real template routes that renders a **flat label→value + table data dump**. Same catalog reads as a knowledge object on one path and a spreadsheet on another. *DB-ish — P1 to converge.*
- **Product Editor** (wizard) — a **linear 7/8-step field-collection form**; **no live visual preview until the final Review step** → the operator authors blind and only sees the object at the end. The Hero step + primary-model code editor are the exceptions that *do* feel like minting an identity. *DB-ish overall, with KO islands.*

**Recommendation:** (P1) persistent live `ProductPreview` beside the wizard so authoring = watching the object form; (P1) converge all product routes on `ProductPreview`, retire the flat `TemplateView`; (P1) completeness ring + relationship cue on cards; (P2) make the list view product-centric, not column-centric.

---

## 5. Findings classified

### P0 — must fix before product population
- **P0-1 Relationship Engine** — add typed relationships (`relation_type`: related/alternative/upgrade/replacement/cross_sell) in storage + authoring + render. *(Cheaper now than re-linking thousands later.)*
- **P0-2 Naming model decision** — lock a `name_type × locale` naming model before population (avoids a second full-catalog naming backfill). Decision now; additive migration later.
- **P0-3 Completeness Engine** — one authoritative engine over the full group set (incl. relationships/applications/compatibility), surfaced as a visible %. Reconcile/retire the two existing meters. *(Needed to trust catalog health while loading thousands.)*

### P1 — should fix
- **P1-1** Converge product routes on `ProductPreview`; retire the legacy flat `TemplateView`.
- **P1-2** Live product preview *inside* the wizard (author = watch the object form).
- **P1-3** Completeness ring + "part of family / N related" cue on list cards.
- **P1-4** Make the list view product-centric (kill the spreadsheet feel); add completeness/relationship/visual signal.
- **P1-5** `Status` shown as knowledge maturity, not just publish lifecycle.

### P2 — nice to have
- **P2-1** i18n the Classify division/category picker chrome ("Select Division" / "New Division") — the "5f" remaining-English area.
- **P2-2** Consolidate the two spec homes (schema `SchemaSpecsSection` + legacy `SewingMachineSection`).
- **P2-3** `logo_detail` media role has no authoring slot (declared role, no surface).
- **P2-4** RTL logical-property hygiene (`ml-/mr-` → `ms-/me-`) polish pass.

---

## 6. Bottom line for population
The **core is ready** — classification, identity, governed coding, specs, media, robustness (P0 #1–5), and a strong public preview. **Do not start mass population until P0-1/P0-2/P0-3 are decided**, because all three get dramatically more expensive once thousands of products exist (typed-relationship backfill, second naming backfill, untrustworthy completeness). They are **additive, not a rebuild** — the architecture can carry them. Recommend: take P0-1/2/3 to ChatGPT as the pre-population gate, decide the schema shapes, then green-light population.
