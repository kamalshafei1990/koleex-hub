# KOLEEX Product Knowledge — Architecture Freeze
**Status:** 🟡 PROPOSED — pre-population gate. Awaiting ratification (Kamal + ChatGPT). **Nothing here is implemented.** No code, no schema, no migration — these are **contracts/decisions** only.
**Why this exists:** Both architects ruled the system is **B) Product Database with Knowledge Attached** (not yet a Knowledge Graph). Before loading thousands of real products, three foundations must be **frozen** — because each, if changed after population, forces re-touching every product. Everything *after* the freeze is enhancement/expansion, not foundation reshaping.
**Principle:** lock **contracts**, do **not** build the future apps. We do not need an Applications app / Industries app / Spare-Parts app now — we only need to know, today, the shape of the Names, the Nodes, the Edges, and the Completeness formula.
**Mental-model shift to encode everywhere:** the app must stop thinking *Create → Edit → Save Product* and start thinking **Build → Enrich → Connect → Measure Product Knowledge.**

> Legend: **[DECIDE]** = open choice to ratify · **[REC]** = my recommended default · current-state facts are from the live schema (`products`, `product_models`, `product_translations`, `related_products`, `schema_specs/schema_knowledge`).

---

## P0-A — Naming Architecture Contract  *(highest risk — freeze FIRST)*
**Why first:** a wrong naming foundation = re-naming thousands of products later, the most expensive rework of all. Today the schema has only `products.product_name` (single) + a thin `product_translations(locale, product_name, description)`. That cannot hold name-TYPE × locale (e.g. an Arabic *marketing* name vs a Chinese *SEO* title).

### The contract — a product's identity is layered, not a single string
```
Product Identity
├── Internal        → KOLEEX code (exists today: product_models.primary_model, e.g. XSL-Q10-5-E)  [governed, immutable-ish]
├── Official Name    → the canonical descriptive name      (localizable)
├── Short Name       → abbreviation / compact label         (localizable)        e.g. "L9"
├── Marketing Name   → brand/commercial name                (localizable)        e.g. "Koleex NEXO L9"
│     └── Series      → product family/line                  (localizable)        e.g. "NEXO"
├── SEO Title        → search title                          (localizable)
└── SEO Slug         → url slug                              (per-locale, unique)
```
- **Localization model — the key decision.** Replace the single-name-per-locale table with a **name-TYPE × locale** model: every name TYPE above can have a value per locale (EN/ZH/AR now; more later). [REC] a `product_names(product_id, name_type, locale, value)` shape supersedes `product_translations`.
- **Fallback chain** [REC]: requested locale → English → Internal code. Never blank.
- **Internal code stays separate** — it is identity/governance (already built), not a "name"; it never localizes.

### Open decisions to ratify [DECIDE]
1. Exact `name_type` set — confirm: `official · short · marketing · series · seo_title · seo_slug`. Add "Commercial Name" as distinct from "Marketing Name", or treat as one?
2. Which types are **required** vs optional at publish (ties into P0-C)? [REC] Official required; Marketing required to publish; SEO optional.
3. SEO slug uniqueness scope — global, or per-locale? [REC] unique per-locale.
4. Do **models/variants** get their own name layers, or inherit product names + a variant suffix? (today `product_models.model_name`/`tagline` exist.)

---

## P0-B — Product Knowledge Graph Contract  *(lock the contract, NOT the apps)*
**Why:** today applications/industries/operations/fabrics/compatibility live as JSON **inside** the product row, and the only product↔product link is one **untyped** `related_products`. We are NOT building entity apps now — we are freezing the **edge vocabulary + ownership** so products are authored with typed connections from day one, even while target entities are still "shadow" references.

### Node types (the things a product connects to)
`Product · Application · Industry · Operation · Fabric · Material · Spare Part · Device · Supplier · Document(Manual) · Media · Review · AI Knowledge`
*(Suppliers + Media + Documents already exist as real rows; the rest may start as lightweight reference nodes or shadow IDs — see decision 2.)*

### Edge types (directed) + reverse
| Edge | From → To | Reverse |
|---|---|---|
| `used_for` | Product → Application | `applied_by` |
| `used_in` | Product → Industry | `serves` |
| `performs` | Product → Operation | `performed_by` |
| `works_with` | Product → Fabric/Material | `worked_by` |
| `compatible_with` | Product → Product/Part | `compatible_with` (symmetric) |
| `alternative_to` | Product → Product | `alternative_to` (symmetric) |
| `upgrade_to` | Product → Product | `downgrade_from` |
| `replacement_for` | Product → Product | `replaced_by` |
| `successor_of` / `predecessor_of` | Product → Product | each other |
| `cross_sell` / `recommended_with` | Product → Product | symmetric |
| `supplied_by` | Product → Supplier | `supplies` |
| `documented_by` | Product → Document | `documents` |
| `shown_by` | Product → Media | `shows` |
| `answered_by` | Product → AI Knowledge | — |

### Ownership — what stays in the product vs becomes a node
- **Stays IN the product:** description · specs · product/model-specific values · product-specific notes.
- **Becomes an external NODE (referenced by edge):** applications · industries · operations · fabrics/materials · spare parts · alternatives/relationships · manuals.
- **Edges are first-class** (typed + directed + reverse), not JSON arrays buried in `schema_knowledge`.

### Open decisions to ratify [DECIDE]
1. Edge storage model — one typed product-relationship contract (type + from + to + direction) for product↔product, plus product↔concept edges. Confirm the single canonical edge concept (vs many bespoke tables).
2. Do concept nodes (Application/Industry/Operation/Fabric) get thin **reference tables now** (so edges point to real IDs and authoring uses a controlled vocabulary), or are they **shadow string-IDs** until their apps exist? [REC] thin controlled-vocabulary reference tables now — cheap, and it makes authoring + completeness real without building full apps.
3. Cardinality/limits per edge (e.g. one `upgrade_to`, many `alternative_to`).
4. Confirm the edge vocabulary above is the frozen set (add/remove any).

---

## P0-C — Completeness Engine Contract
**Why:** you want **"Product Completeness = 83%"** from day one, visible everywhere. Today two non-reconciled meters exist and relationships/applications/compatibility aren't first-class inputs.

### The contract — ONE authoritative formula over weighted groups
[REC] starting weights (must sum 100; ratify):
| Group | Weight | Counts |
|---|:--:|---|
| Identity & Naming | 10 | official + marketing + required localized names (P0-A) |
| Specifications | 20 | required schema spec fields filled |
| Media | 20 | hero(req) · gallery · manual · video · AR |
| Knowledge | 20 | applications · industries · operations · fabrics present (P0-B nodes) |
| Relationships | 15 | ≥1 alternative · compatibility · related/cross-sell (P0-B edges) |
| Commercial | 10 | cost · price · MOQ · warranty · lead time |
| AI-readiness | 5 | AI knowledge blocks present |

- **One engine, one number**, surfaced on: product **list cards** · the **wizard (persistently, not just Review)** · the **public preview**. Retire the legacy hand-counted meter.
- Output contract: `{ overall:%, perGroup:[{group, score, weight, missing[]}] }`.

### Open decisions to ratify [DECIDE]
1. Final weights (above are a starting proposal).
2. Per-group "done" thresholds (e.g. gallery = how many images = 100%?).
3. Hard floor for publish? (e.g. cannot publish < 60% — ties to P0 #3 publish gate, currently advisory).

---

## Freeze process
1. Ratify P0-A / P0-B / P0-C (Kamal + ChatGPT) — adjust the [DECIDE] items.
2. On sign-off, flip this doc to **🟢 FROZEN vX.0** + log in the product-coding change-log.
3. **Only then** green-light Product Population. After the freeze, all further work is enhancement/expansion — never foundation reshaping.

*No implementation begins until the freeze is signed. This document defines contracts, not code.*
