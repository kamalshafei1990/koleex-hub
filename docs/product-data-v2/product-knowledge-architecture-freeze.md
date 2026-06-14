# KOLEEX Product Knowledge — Architecture Freeze
**Status:** 🟡 PROPOSED v2 — **Approved-with-3-modifications** (Kamal, 2026-06-15). Near-final; awaiting final freeze sign-off (Kamal + ChatGPT). **Nothing here is implemented.** No code, no schema, no migration — these are **contracts/decisions** only.
**Why this exists:** Both architects ruled the system is **B) Product Database with Knowledge Attached** (not yet a Knowledge Graph). Before loading thousands of real products, three foundations must be **frozen** — each, if changed after population, forces re-touching every product. Everything *after* the freeze is enhancement/expansion, not foundation reshaping.
**Principle:** lock **contracts**, do **not** build the future apps. We do not need an Applications app / Industries app / Spare-Parts app now — we only need the frozen shape of the Identity, the Nodes, the Edges, and the Completeness formula.
**Mental-model shift to encode everywhere:** stop thinking *Create → Edit → Save Product*; start thinking **Build → Enrich → Connect → Measure Product Knowledge.**

> Legend: **[DECIDE]** = open choice to ratify · **[REC]** = recommended default · **(v2)** = added/changed in the Approved-with-modifications pass.

---

## P0-A — Product Identity Contract  *(freeze FIRST — highest risk)*
**(v2) The name is not a set of fields — it is a Product Identity Object** (a Knowledge Object). Reason: a name field can't answer *"show me everything known as NEXO."* An identity object with aliases can. Today the schema has only `products.product_name` + a thin `product_translations(locale, product_name, description)` — far too flat.

### The contract — Product Identity Object
```
Product Identity
 ├─ Official Name        canonical descriptive name           (localizable)
 ├─ Short Name           abbreviation / compact label          (localizable)   e.g. "L9"
 ├─ Marketing Name       brand/commercial name                 (localizable)   e.g. "Koleex NEXO L9"
 ├─ Series Name          product family/line                   (localizable)   e.g. "NEXO"
 ├─ Model Name           model/variant label                   (localizable)
 ├─ SEO Name             SEO title + slug                      (per-locale; slug unique)
 ├─ Localized Names      EN / ZH / AR now, more later          (type × locale)
 ├─ Search Aliases  (v2) all known names/spellings/nicknames   → for AI + search resolution
 └─ Internal Code        KOLEEX governed code (exists today: product_models.primary_model, e.g. XSL-Q10-5-E) — never localizes
```
- **(v2) Search Aliases** is first-class: an identity can declare many aliases (e.g. `NEXO`, `NEXO Series`, `KOLEEX NEXO`, `NEXO Smart Series`) all resolving to the same product/series identity. This is what lets AI answer "all products known as NEXO" years from now.
- **Localization model:** name-TYPE × locale (every name type can have a value per locale), replacing the single-name-per-locale table. Fallback: requested locale → English → Internal code; never blank.
- **Internal Code stays separate** — identity/governance, not a "name"; never localizes.

### Open decisions to ratify [DECIDE]
1. Are Search Aliases owned at the **product** level, the **series** level, or both? [REC] both — series aliases inherited by member products.
2. Which name types are **publish-required** vs optional (ties to P0-C)? [REC] Official required; Marketing required to publish; SEO/aliases optional.
3. SEO slug uniqueness — per-locale [REC] or global.
4. Series + Model: are these identity fields here, or also nodes in the graph (Series as a light grouping node)? [DECIDE] — see P0-B.

---

## P0-B — Product Knowledge Graph Contract  *(lock the contract, NOT the apps)*
**(v2) The graph does NOT start at Application/Industry/Operation. It starts at PRODUCT TYPE.** Product Type is the first node *shared* across thousands of products, so the shared knowledge lives on the **type**, and each product **inherits** it via `belongs_to` — instead of re-authoring the same Applications/Industries/Operations on every Lockstitch machine.

```
Product Type (e.g. "Lockstitch Machine")
 ├─ used_for       → Application      (Garment Manufacturing…)
 ├─ used_in        → Industry
 ├─ performs       → Operation
 ├─ works_with     → Fabric / Material
 ├─ compatible_with→ Spare Part / Device
 └─ answered_by    → AI Knowledge

Product (e.g. "L9")
 └─ belongs_to     → Product Type      ← inherits the type's knowledge
       (+ product-level edges only where it DIFFERS from its type)
```
- **(v2) `belongs_to` (Product → Product Type) is the spine edge.** Type-level knowledge is inherited; products only carry **overrides/additions** specific to them. This is the single biggest anti-duplication decision.
- **Product Type aligns with the EXISTING taxonomy** — it is the division→category→subcategory→machine_kind layer (e.g. `XSL` = Lockstitch) **promoted into a first-class, knowledge-bearing graph node.** Not a new concept to invent — an existing one to elevate. [DECIDE] which taxonomy tier == "Product Type" (subcategory? machine_kind? a dedicated type node?).

### Node types
`Product · Product Type (v2, primary shared node) · Application · Industry · Operation · Fabric · Material · Spare Part · Device · Supplier · Document(Manual) · Media · Review · AI Knowledge`

### Edge types (directed) + reverse
| Edge | From → To | Reverse |
|---|---|---|
| **`belongs_to` (v2)** | **Product → Product Type** | **`has_member`** |
| `used_for` | Product Type / Product → Application | `applied_by` |
| `used_in` | Product Type / Product → Industry | `serves` |
| `performs` | Product Type / Product → Operation | `performed_by` |
| `works_with` | Product Type / Product → Fabric/Material | `worked_by` |
| `compatible_with` | Product → Product/Part | symmetric |
| `alternative_to` | Product → Product | symmetric |
| `upgrade_to` / `replacement_for` | Product → Product | `downgrade_from` / `replaced_by` |
| `successor_of` / `predecessor_of` | Product → Product | each other |
| `cross_sell` / `recommended_with` | Product → Product | symmetric |
| `supplied_by` | Product → Supplier | `supplies` |
| `documented_by` | Product → Document | `documents` |
| `shown_by` | Product → Media | `shows` |
| `answered_by` | Product Type / Product → AI Knowledge | — |

### Ownership
- **Stays IN the product:** description · specs · product/model-specific values · product-specific overrides.
- **Lives on the PRODUCT TYPE (inherited):** applications · industries · operations · fabrics/materials · compatible spare-parts classes · type-level AI knowledge.
- **External NODES referenced by edge:** Product Type · Application · Industry · Operation · Fabric · Spare Part · alternatives/relationships · manuals.
- Edges are first-class (typed + directed + reverse), never JSON arrays in `schema_knowledge`.

### Open decisions to ratify [DECIDE]
1. Inheritance resolution: when a product has its own `used_for` AND its type has `used_for`, is it **union** or **override**? [REC] union, with product-level "suppress" capability.
2. Do concept nodes (Application/Industry/Operation/Fabric) get **thin controlled-vocabulary reference tables now**, or stay shadow-IDs until their apps exist? [REC] thin reference tables now — makes authoring + completeness real without building full apps.
3. Single canonical edge model (type+from+to+direction) vs bespoke tables. [REC] one canonical edge contract.
4. Confirm the frozen edge vocabulary above (add/remove).

---

## P0-C — Completeness Engine Contract  *(v2 — two layers, not flat weights)*
**(v2)** Completeness is **two independent layers**, then combined — so a product rich in media but empty of knowledge cannot score high.

### Layer 1 — Structural Completeness (is the data present?)
`Name(identity) · Specs · Media · Manual · Relationships`

### Layer 2 — Knowledge Completeness (is the knowledge good?)
`Applications · Industries · Operations · Advantages · Compatibility · AI Knowledge`
*(largely satisfied via the Product Type the product `belongs_to` — inherited knowledge counts; product-level gaps still flagged.)*

### Final score
```
Final Completeness = (Structural × 50%) + (Knowledge × 50%)
```
- Rationale: 50 images + 10 videos but no "where is it used" must NOT yield 90%. Structural and Knowledge are weighted equally.
- One authoritative engine, one number, surfaced on **list cards · the wizard (persistently) · the public preview**. Retire the legacy hand-counted meter.
- Output contract: `{ final:%, structural:%, knowledge:%, perGroup:[{layer, group, score, missing[]}] }`.

### Open decisions to ratify [DECIDE]
1. Per-group "done" thresholds inside each layer (e.g. Media: hero=required, gallery=N images for 100%).
2. Intra-layer weights (are the groups within Structural / within Knowledge equal, or weighted?).
3. Hard publish floor? (e.g. block publish < 60% final — ties to the P0 #3 publish gate, currently advisory).
4. How much inherited (type-level) knowledge counts toward a product's Knowledge score vs requiring product-specific enrichment.

---

## Freeze process
1. Ratify the [DECIDE] items in P0-A / P0-B / P0-C (Kamal + ChatGPT).
2. On sign-off → flip this doc to **🟢 FROZEN vX.0** + log in the product-coding change-log.
3. **Only then** green-light Product Population. After the freeze, all further work is enhancement/expansion — never foundation reshaping.

**v2 modifications applied (Kamal-approved):** (1) Naming → Product Identity Object with Search Aliases; (2) Product Type promoted to the primary first-class graph node with `belongs_to` inheritance; (3) Completeness split into Structural × 50% + Knowledge × 50%.

*No implementation begins until the freeze is signed. This document defines contracts, not code.*
