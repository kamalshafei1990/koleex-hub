# KOLEEX Product Knowledge — Architecture Freeze
**Status:** 🟢 **FROZEN v1.0** (2026-06-15) — ratified by both architects. **Architecture Gate = CLOSED · Architecture Status = READY FOR POPULATION *PLANNING*.**

> ### ⚠️ Critical distinction (owner-locked, Kamal 2026-06-15)
> ```
> READY FOR POPULATION  ≠  READY FOR IMPLEMENTATION
> ```
> What is frozen here is only the **3 contracts** (Identity · Graph · Completeness). That makes the system **READY FOR POPULATION *PLANNING*** — **not** ready to start adding products, and **not** ready to implement.
> **The next step is NOT `Start Adding Products`. The next step is `Design Population Strategy`** — an intermediate phase called **Population Architecture Planning**. Only after that plan is itself locked + ratified does a separate **Green Light → Product Population** apply.
> → Deliverable: [population-architecture-plan.md](population-architecture-plan.md).

**Ratification:** owner-locked by Kamal → **ChatGPT Ratification Review returned APPROVE with minor notes** (verbatim verdict + the 3 minor notes in §Ratification below). Both architects ruled **B) Product Database with Knowledge Attached**; these 3 contracts are now frozen as the foundation.
**Constraints that remain regardless (still gated, each separately):** no **Schema Migration**, no **PD-V2 cutover**, no **Production DB changes** until their proper time. **Nothing here is implemented** — contracts only, no code/schema/migration. Freezing the gate does NOT authorize building the contracts, nor starting population.
**The headline result of this whole journey** (Kamal): not the Graph, not the Naming, not the Completeness — but the shift from **`Product Database` → `Product Knowledge System`**. That is the real outcome being locked.
**Mental-model shift to encode everywhere:** *Create → Edit → Save Product* ⟶ **Build → Enrich → Connect → Measure Product Knowledge.**

> Legend: **[LOCKED]** = closed by owner · **[minor]** = non-blocking detail to settle during build · facts are from the live schema.

---

## P0-A — Product Identity Contract  **[LOCKED]**
The name is a **Product Identity Object** (a Knowledge Object with aliases), not flat fields. Today the schema only has `products.product_name` + a thin `product_translations` — too flat to hold name-TYPE × locale or aliases.

### Frozen identity object — exactly these 8 (no other name types now)
```
Product Identity
 ├─ Official Name      canonical descriptive name        (localizable)
 ├─ Short Name         abbreviation / compact label       (localizable)   e.g. "L9"
 ├─ Marketing Name     brand/commercial name              (localizable)   e.g. "Koleex NEXO L9"
 ├─ SEO Name           SEO title + slug                   (per-locale; slug unique)
 ├─ Series Name        family/line                        (localizable)   e.g. "NEXO"
 ├─ Model Name         model/variant label                (localizable)
 ├─ Search Aliases     all known names/spellings/nicknames → AI + search resolution
 └─ Localized Names    EN / ZH / AR now, more later        (every type × locale)
```
- **Search Aliases** is first-class so AI can answer *"all products known as NEXO"* (NEXO · NEXO Series · KOLEEX NEXO · NEXO Smart Series → one identity).
- **Localization:** name-TYPE × locale; fallback requested-locale → English → Internal code; never blank.
- **Internal Code** (existing governed `product_models.primary_model`, e.g. `XSL-Q10-5-E`) remains the identity anchor — never localizes, not part of the 8 "names".

### Remaining [minor] (non-blocking, settle during build)
- Search Aliases owned at product vs series level (rec: both, series inherited). · SEO slug uniqueness per-locale (rec) vs global. · Which names are publish-required (ties to P0-C).

---

## P0-B — Product Knowledge Graph Contract  **[LOCKED on Product Type = Machine Kind]**
The graph's primary shared node is **Product Type**, and the knowledge attaches there; products inherit via `belongs_to`.

### [LOCKED] Product Type == **Machine Kind** (NOT Subcategory)
```
✗ too coarse:        Lockstitch                         (subcategory — node would be enormous)
✓ knowledge-bearing: Walking Foot Lockstitch
                     Needle Feed Lockstitch
                     Cylinder Bed Lockstitch
                     Post Bed Lockstitch                (machine kind — the real knowledge unit)
```
- **Product Type = the existing taxonomy's most-specific type tier**: `machine_kind` for sewing (already modelled — `src/lib/machine-kinds.ts`, 105 kinds across 9 subcategories); for non-sewing divisions, the equivalent leaf "type" tier. Not a new entity — the existing one **promoted** into a knowledge-bearing node.
- **Spine edge `belongs_to` (Product → Product Type)** with **knowledge inheritance**: Applications/Industries/Operations/Fabrics/Spare-Parts attach at the Machine-Kind node; products inherit, carrying only overrides. A Walking-Foot-Lockstitch product doesn't re-author Walking-Foot knowledge.

### Node types
`Product · Product Type (= Machine Kind, primary shared node) · Application · Industry · Operation · Fabric · Material · Spare Part · Device · Supplier · Document · Media · Review`
*(AI Knowledge exists as an enrichment layer — see P0-C — not a core graph node for now.)*

### Edge types (directed) + reverse
| Edge | From → To | Reverse |
|---|---|---|
| **`belongs_to`** | **Product → Product Type (Machine Kind)** | **`has_member`** |
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

### Ownership
- **In the product:** description · specs · product/model-specific values · overrides.
- **On the Machine-Kind type (inherited):** applications · industries · operations · fabrics/materials · compatible spare-part classes.
- **External nodes by edge:** Product Type · Application · Industry · Operation · Fabric · Spare Part · alternatives/relationships · manuals.
- Edges are first-class (typed/directed/reverse), never JSON arrays.

### Remaining [minor]
- Inheritance resolution union vs override when product + its kind both declare an edge (rec: union + product-level suppress). · Concept nodes (Application/Industry/…) as thin controlled-vocabulary reference tables now (rec) vs shadow-IDs. · One canonical edge model vs bespoke tables (rec: one).
- **[ChatGPT ratification note #1 — Machine-Kind Governance]** Because Product Type = Machine Kind, an ungoverned Machine-Kind list will sprawl. A **Machine Kind Approval Rule** is required at build time: a new Machine Kind is admitted only if it (a) carries a clear knowledge meaning, (b) has a visual identity, (c) has applications/operations/fabric logic, and (d) is not merely an ordinary feature. *Non-blocking to the freeze; build-time governance.*
- **[ChatGPT ratification note #2 — Concept nodes start thin]** When the Application/Industry/Operation/Fabric/Material apps are eventually built, start them as **thin reference tables (reference nodes), not shadow-IDs** — this reduces rework and makes Completeness + AI easier. *Non-blocking to the freeze.*

---

## P0-C — Completeness Engine Contract  **[LOCKED]**
Two layers, each weighted 50%; **AI Knowledge is excluded from core scoring** (it is a later enrichment layer).

```
Final Completeness = (Structural × 50%) + (Knowledge × 50%)
```

### [LOCKED] Structural Completeness (data present?) — sums to 100
| Group | Weight |
|---|:--:|
| Identity | 20 |
| Specs | 20 |
| Media | 20 |
| Commercial | 15 |
| Documentation | 15 |
| Compliance | 10 |

### [LOCKED] Knowledge Completeness (knowledge good?) — sums to 100
| Group | Weight |
|---|:--:|
| Applications | 20 |
| Industries | 15 |
| Operations | 15 |
| Fabrics | 15 |
| Compatibility | 20 |
| Relationships | 15 |

- A media-rich but knowledge-empty product cannot fake a high score (50% cap from Structural alone).
- Knowledge groups are largely satisfiable via the Machine-Kind the product `belongs_to` (inherited knowledge counts; product-level gaps still flagged).
- One authoritative engine, one number, surfaced on **list cards · wizard (persistently) · public preview**. Retire the legacy hand-counted meter.
- Output: `{ final:%, structural:%, knowledge:%, perGroup:[{layer, group, score, missing[]}] }`.

### Remaining [minor]
- Per-group "done" thresholds (e.g. Media: hero required + gallery N images = 100%). · Hard publish floor (e.g. block < 60% final). · How much inherited type-knowledge counts vs product-specific enrichment.
- **[ChatGPT ratification note #3 — Publish floor starts low]** With ~**710 legacy products** to backfill, do **not** set a high hard publish floor initially. Recommended phasing: **Draft = no floor · Active = minimum (Identity + Type + Model) only · Knowledge completeness = advisory first** → raise the floor after backfill. *Build-time decision, non-blocking to the freeze.*

---

## Ratification & Freeze — CLOSED ✅
**Owner-locked (Kamal, 2026-06-15):** P0-A name set (8) · P0-B Product Type = Machine Kind · P0-C two-layer weights with AI excluded from core.
**ChatGPT Ratification Review (2026-06-15): APPROVE with minor notes.** Verbatim:

> **APPROVE with minor notes.**
> لا أرى أي Blocking issue يمنع Freeze أو Population بعد هذه العقود الثلاثة.
>
> **الحكم** — `Architecture Gate = APPROVED · Status = FROZEN for population planning`
>
> **القرار النهائي — APPROVED.** لا توجد تناقضات كبيرة · لا أرى scalability risk يمنع · لا أرى population risk إذا تم الالتزام بالعقود الثلاثة.
> الـ Architecture Gate يمكن إغلاقه الآن كـ:
> `P0-A Naming = FROZEN · P0-B Graph Contract = FROZEN · P0-C Completeness Contract = FROZEN`
> وبعدها يمكن الانتقال إلى: **Population Planning** — مع بقاء (gated بشكل منفصل): **Schema migration · PD-V2 cutover · Production DB changes.**

**ChatGPT's 3 minor notes (all explicitly NOT blockers — folded into the [minor] sections above):**
1. **Machine-Kind Governance** — needs a Machine Kind Approval Rule (clear knowledge meaning + visual identity + applications/operations/fabric logic + not merely a feature). → P0-B [minor].
2. **Concept nodes start thin** — Application/Industry/Operation/Fabric/Material as thin reference tables, not shadow-IDs, when eventually built. → P0-B [minor].
3. **Publish floor starts low** — ~710 legacy products; Draft=no floor / Active=Identity+Type+Model only / Knowledge=advisory first → raise after backfill. → P0-C [minor].

**Freeze outcome:** the 3 contracts are **FROZEN v1.0**. Architecture Gate is **CLOSED**; Architecture Status = **READY FOR POPULATION**.
**Still gated regardless (each separately, require explicit sign-off):** Schema Migration · PD-V2 cutover · Production DB changes. **Freezing the gate ≠ authorization to build the contracts** — building is a separate, future step.

*The freeze is signed by both architects. No implementation begins on the strength of this freeze alone. Contracts, not code.*
