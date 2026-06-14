# KOLEEX — Population Planning Phase 1: Knowledge Population Framework
**Mode:** Population **Planning** only. **No code · no schema · no migration · no product population · no implementation.**
**Date:** 2026-06-15. **Frozen inputs:** P0-A Naming · P0-B Graph Contract · P0-C Completeness · **P0-D Product Type Library (10 Core)** — all FROZEN.
**Builds on:** [population-architecture-plan.md](population-architecture-plan.md) (the intermediate strategy) + [product-type-freeze-recommendation.md](product-type-freeze-recommendation.md) (the frozen 10).

**The 10 frozen Product Types:** Lockstitch · Chainstitch · Overlock · Coverstitch · Zigzag · Buttonhole · Button Attaching · Bartack · Blindstitch · Pattern Sewing.

> Governing principle (P0-B): **knowledge attaches at the Product Type; products inherit and add only deltas.** This framework exists so the knowledge is authored **once per type**, not re-authored on thousands of products.

---

## 1. Product Type Knowledge Template
**The template structure is uniform across all 10 types** (that uniformity is what makes inheritance work). Below: the block schema (structure only — *no values*), then a per-type **emphasis profile** so each type's shape is explicit without populating data.

### 1.1 Block schema (applies to every Product Type)
| # | Block | Structure (fields per entry) | Graph edge (P0-B) | Cardinality | Inheritable? |
|---|---|---|---|:--:|:--:|
| 0 | **Type Identity** *(P0-A)* | canonical name · aliases[] · localized{en/zh/ar} · code segment · one-line definition · distinguishing mechanism · parent subcategory | *(node identity)* | 1 | n/a (type-level) |
| 1 | **Applications** | `{ application_ref → Application node, primacy: primary\|secondary, note? }` | `used_for` | 1..N | ✅ |
| 2 | **Industries** | `{ industry_ref → Industry node, note? }` | `used_in` | 1..N | ✅ |
| 3 | **Operations** | `{ operation_ref → Operation node, primacy?, note? }` | `performs` | 1..N | ✅ |
| 4 | **Fabrics** | `{ fabric_ref → Fabric node, suitability: ideal\|capable\|limited }` | `works_with` | 0..N | ✅ |
| 5 | **Materials** | `{ material_ref → Material node, suitability }` *(leather/vinyl/foam/webbing — distinct from woven/knit fabrics)* | `works_with` | 0..N | ✅ |
| 6 | **Compatibility Classes** | `{ class_ref → Part/Attachment/Device CLASS node, role: presser\|feed\|needle\|hook\|guide\|binder\|… }` *(class-level, never specific SKUs)* | `compatible_with` (class) | 0..N | ✅ (product may **narrow**) |
| 7 | **Spare-Part Classes** | `{ part_class_ref → SparePartClass node, criticality: wear\|consumable\|structural }` | *(ownership edge)* | 0..N | ✅ |
| 8 | **Documents** | `{ doc_type: manual\|threading\|maintenance\|parts-catalog\|safety, scope: type-generic\|product-specific, required: bool }` | `documented_by` | 0..N | ✅ *(type-generic only; product-specific authored on product)* |
| 9 | **Media Requirements** *(spec, not the media itself)* | `{ role: silhouette\|hero\|gallery\|diagram\|video\|manual-cover, min_count, required_at: type\|product, format/aspect constraint? }` + the type's **visual identity** asset (silhouette) | `shown_by` *(type visual)* | per role | ✅ *(spec inherited; product supplies its own hero/gallery)* |

- **Refs are controlled-vocabulary node references, never free text** (see Risk R1). The Application/Industry/Operation/Fabric/Material/Compatibility-Class/Spare-Part-Class node sets are the concept libraries from the [Rationalization Audit §3–5](product-type-rationalization-audit.md).
- **Media Requirements ≠ media.** At the type level this block defines *what media a product of this type must have* + holds the type's representative silhouette; actual hero/gallery images live on the product.

### 1.2 Per-type emphasis profile (structure only — which blocks dominate)
Legend: ◆ Type-defining · ● Primary (rich) · ○ Standard · · Light/mostly-inherited. *(No values — emphasis only.)*

| Product Type | Applications | Industries | Operations | Fabrics | Materials | Compat. Classes | Spare-Part Classes | Documents | Media |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Lockstitch | ● | ● | ○ | ● | ● | ◆ | ● | ○ | ● |
| Chainstitch | ● | ● | ○ | ● | ○ | ● | ● | ○ | ○ |
| Overlock | ● | ● | ● | ● | ○ | ● | ● | ○ | ● |
| Coverstitch | ● | ● | ● | ● | · | ● | ● | ○ | ○ |
| Zigzag | ○ | ○ | ◆ | ● | ● | ● | ○ | ○ | ○ |
| Buttonhole | ○ | ● | ◆ | ○ | ○ | ◆ | ● | ● | ○ |
| Button Attaching | ○ | ● | ◆ | ○ | ○ | ◆ | ● | ● | ○ |
| Bartack | ○ | ● | ◆ | ○ | ○ | ● | ○ | ● | ○ |
| Blindstitch | ○ | ● | ◆ | ● | · | ● | ○ | ○ | ○ |
| Pattern Sewing | ● | ● | ● | ○ | ○ | ◆ *(templates/clamps)* | ○ | ◆ *(programming)* | ● |

→ Same 10 blocks for all; the profile shows where authoring effort concentrates per type. **Values are authored later, behind the gate (§Final).**

---

## 2. Inheritance Rules
Refines the [population-architecture-plan §2](population-architecture-plan.md) matrix into the freeze-grade contract.

### 2.1 What belongs to the Product Type (authored once, shared)
Blocks 1–9 above **+** Type Identity. I.e. Applications · Industries · Operations · Fabrics · Materials · Compatibility Classes · Spare-Part Classes · type-generic Documents · Media spec + type visual identity.

### 2.2 What belongs to the Product (authored per product)
- **Identity** (P0-A: the 8 names) · **Specs** (speed/dimensions/power/needle-system values) · **product Media** (hero + gallery) · **Commercial** (price/MOQ/lead-time) · **product-specific Documents** (this model's manual) · **Relationships** (alternative/upgrade/replacement/cross-sell/specific compatible products) · **Attribute values** (Needle Configuration, feed, bed, throat, duty, drive, automation…) · **overrides/suppressions**.
- Plus the mandatory anchor: **`belongs_to` exactly one of the 10 types**.

### 2.3 Inherited (Type → Product, automatically)
The 7 knowledge groups (Applications…Spare-Part Classes) + type-generic Documents + Media spec + type visual identity. **Resolution = union(type, product) − product-level suppressions.** Inherited knowledge **counts toward P0-C completeness** (so a fresh product isn't falsely 0%).

### 2.4 Can be overridden / suppressed at the product
- **Add:** product may add product-specific Applications/Industries/Operations/Fabrics/Materials.
- **Suppress:** product may suppress an inherited entry **only with a recorded reason** (e.g. "this model does not handle leather"). No silent removal.
- **Narrow (compatibility only):** product may be *more* restrictive than its type, **never broader** than the mechanism allows.

### 2.5 Can NEVER be overridden
- **Type membership / the type's knowledge contract** — a product cannot redefine what its type *is*.
- **The mechanism-defined compatibility-class ceiling** — a product can't claim a compatibility the type's mechanism doesn't support.
- **The stitch-formation identity** of the type (its ISO stitch class).

---

## 3. Knowledge Population Workflow — Build → Enrich → Connect → Measure → Publish
Replaces *Create → Fill → Save*. Maps the earlier 6-step sequence onto five named stages.

| Stage | What happens | Frozen contract |
|---|---|---|
| **① Build** | Establish the knowledge skeleton: ensure the **Product Type Knowledge** exists (author it first if new); create the **Product Identity** (8 names) and set **`belongs_to`** the type. The product immediately **inherits** the type's knowledge. | P0-D type · P0-A identity · P0-B belongs_to |
| **② Enrich** | Add the product's own structural layer: **Specs · Attribute values · Media (hero/gallery) · Commercial · product-specific Documents.** | P0-C Structural groups |
| **③ Connect** | Wire **typed relationships** (P0-B edges): product↔product (alternative/upgrade/replacement/cross-sell), product↔specific compatible parts/devices, and confirm/override/suppress inherited knowledge edges. | P0-B edges |
| **④ Measure** | Run **P0-C completeness**: `Structural 50% + Knowledge 50%`, surfaced as one % + per-group gaps (inherited knowledge counts; product gaps flagged). | P0-C engine |
| **⑤ Publish** | State transition under the **publish-floor policy**: Draft = no floor · Active = Identity + Type + Model only · Knowledge completeness = advisory-first → raise after backfill. | freeze publish-floor |

**Type-level authoring uses the same verbs at the type tier:** Build the type node → Enrich its 9 blocks → Connect its concept edges → Measure type-knowledge coverage → Publish the type for products to inherit.

---

## 4. Population Order (recommended) + rationale
**Strict dependency order — each layer must exist before the next can reference it:**

```
1. Controlled Vocabularies (concept + attribute nodes)
       ↓  (Type edges point at these)
2. Product Type Knowledge (the 10 types' 9 blocks)
       ↓  (Products belong_to + inherit these)
3. Pilot Products (1 per type — validate inheritance + completeness)
       ↓
4. Mass Product Population (~710 products)
```

| Order | Layer | Rationale |
|:--:|---|---|
| **1st** | **Controlled Vocabularies** — Application · Industry · Operation · Fabric · Material · Compatibility-Class · Spare-Part-Class **+ the Attribute Library** (incl. Needle Configuration) | Edges can't point at nodes that don't exist. Seeding the vocab first prevents free-text drift (R1/R6) — the single biggest rework source. Can be seeded in parallel; ~31 applications / ~37 operations / etc. already drafted in the Rationalization Audit. |
| **2nd** | **Product Type Knowledge** (the 10 types) | This is the shared layer products inherit. Authoring it once (10 types × 9 blocks) is the leverage point: it removes that authoring from every one of the ~710 products. **Types before products — always.** |
| **3rd** | **Pilot Products** — exactly **one product per type** (10 total) | Validates inheritance, override/suppress, and completeness end-to-end **before** mass population — catches template defects when they cost 10 products to fix, not 710. |
| **4th** | **Mass Product Population** (~710) | Products inherit type knowledge and author only deltas (identity, specs, media, commercial, relationships, attribute values). |

**Explicit answers to the posed options:**
- Products first? **No** — products last.
- Product Types first? **No** — *vocabularies* first, *types* second (still before products).
- Applications / Industries / Fabrics / Compatibility first? **Yes — together, as part of the vocabulary layer (1st)**, because Type knowledge references them.
- Products last? **Yes.**

---

## 5. Risks (rework-causing only)
- **R1 — Free-text concept/attribute values instead of vocabulary-node refs.** If Applications/Operations/Fabrics/Attributes are typed as strings during type or product authoring → drift, duplicates, and a later dedupe-normalize-relink pass across everything. *Highest rework risk.*
- **R2 — Products re-author inheritable knowledge.** If products author their own applications/industries instead of inheriting from the type → thousands carry duplicate, divergent knowledge; reconciling means re-touching every product.
- **R3 — Populating products before Type Knowledge exists.** Products created against empty types inherit nothing; you backfill type knowledge + re-resolve inheritance for every product later.
- **R4 — Compatibility/Spare-parts authored at SKU level on the type.** If the type lists specific parts instead of *classes*, every new part forces edits to every type. (Must stay class-level per the template.)
- **R5 — Completeness computed without counting inherited knowledge.** Fresh products show artificially low % → operators over-author at product level to chase the number (re-introducing R2). The exact anti-pattern P0-C was designed to prevent.
- **R6 — Suppression-with-reason not honored.** If a product can't record "does NOT do X," it either wrongly inherits or silently drops knowledge; fixing post-hoc means re-touching products.
- **R7 — Media type-vs-product boundary unclear.** Ambiguity over what lives at the type (silhouette) vs the product (hero/gallery) → duplicated or missing imagery and a later media re-tag.
- **R8 — Attribute axes not finalized before authoring.** If Needle Configuration / feed / bed values aren't fixed first, products store attributes as free text → re-normalization (a specific case of R1, called out because it ties directly to the next gate).

*(All are rework risks; none are implementation/schema items.)*

---

## Final Question — What is the next gate before actual Product Population can begin?

### → **Concept Vocabulary & Attribute Library Freeze** (call it **P0-E**).

Freeze the controlled-vocabulary node sets — **Application · Industry · Operation · Fabric · Material · Compatibility-Class · Spare-Part-Class** — **plus the Attribute Library** (feed · bed · throat · needle configuration · thread count · duty · drive · automation · field size · integrated device · stitch-motion) **before** any Type Knowledge or product is authored.

**Why this one gate:** every Product Type edge (Blocks 1–7) and every product attribute points *at* these vocabularies. Freeze them first and R1/R6/R8 — the dominant rework risks — are eliminated at the source. Skip it and the entire catalog gets re-linked later.

**Full remaining gate sequence after it:**
`P0-E Vocabulary+Attribute Freeze → Product Type Knowledge authored & frozen → Pilot (1 product/type) validated → ✅ Green Light: Mass Product Population.`

*Population Planning only. No code, no schema, no migration, no population. Awaiting direction on opening the P0-E gate.*
