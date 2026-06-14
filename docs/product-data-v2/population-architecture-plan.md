# KOLEEX — Population Architecture Plan
**Status:** 🟠 **DRAFT — Population Architecture Planning** (the intermediate phase). Awaiting owner-lock + ChatGPT ratification.
**Position in the sequence:**
```
Architecture Gate (3 contracts)  →  FROZEN ✅
        ↓
Population Architecture Planning  ←  WE ARE HERE   (this document — strategy, not products, not code)
        ↓
[ owner-lock + ratify this plan ]
        ↓
Green Light  →  Product Population
        ↓
[ separately gated: schema migration · PD-V2 cutover · prod DB ]
```

> ```
> READY FOR POPULATION  ≠  READY FOR IMPLEMENTATION
> ```
> The frozen contracts ([product-knowledge-architecture-freeze.md](product-knowledge-architecture-freeze.md)) make us ready to **plan** population. They do **not** authorize adding products, writing contract code, or touching schema/prod-DB. The next action is **Design Population Strategy** — this document — **not** `Start Adding Products`.

**The headline result of the whole journey** (Kamal): the real outcome is not the Graph, the Naming, or the Completeness engine — it is the shift from **`Product Database` → `Product Knowledge System`**. Every decision below is judged against that: does it make this a knowledge system, or just a tidier database?

---

## Why an intermediate phase at all?
P0-B froze **Product Type = Machine Kind** as a knowledge-bearing node that products `belong_to` and **inherit from**. That single decision changes the order of operations: in a Product *Database* you start by adding a product; in a Product *Knowledge System* you cannot meaningfully add the first Walking-Foot-Lockstitch machine until the **Walking Foot Lockstitch** *type* already knows what applications, industries, operations, fabrics, compatibility classes, and spare-part classes it carries. **The knowledge precedes the product.** Population Architecture Planning is where we author that precedence — once — instead of re-deriving it on every one of ~710 products.

This plan answers the three questions that must be settled before the first product, in order:

1. **Product Type Library** — what does a Machine-Kind node *contain*, and how is it authored/governed?
2. **Knowledge Inheritance Rules** — what flows Type → Product; what may a product override; what may it never override?
3. **Population Workflow** — the actual step sequence operators follow (Knowledge-System order, not Create/Fill/Save).

---

## 1. Product Type Library
> *Now that Machine Kind is a Node, the first question is: "Walking Foot Lockstitch — what does it contain?" — answered before the first machine is added.*

### 1.1 What a Product Type (Machine-Kind) node holds
Each Machine-Kind node is a **knowledge record**, authored once, that every product of that kind inherits. The node schema (the *template*, not yet built):

| Block | Holds | Frozen-contract source |
|---|---|---|
| **Type Identity** | Kind name (EN/ZH/AR) · short code segment · one-line definition · parent subcategory · the distinguishing mechanism ("what makes it *this* kind") | P0-A naming model (type-level) |
| **Applications** | what it's used to make/do (edge `used_for` → Application) | P0-B `used_for` |
| **Industries** | sectors it serves (edge `used_in` → Industry) | P0-B `used_in` |
| **Operations** | the sewing/production operations it performs (edge `performs` → Operation) | P0-B `performs` |
| **Fabrics / Materials** | what it works with (edge `works_with` → Fabric/Material) | P0-B `works_with` |
| **Compatibility Classes** | classes of attachments/parts/devices it accepts (edge `compatible_with`, at class level) | P0-B `compatible_with` |
| **Spare-Part Classes** | the part *families* this kind consumes (class-level, not specific SKUs) | P0-B ownership ("compatible spare-part classes" on the type) |
| **Type Visual Identity** | the kind's silhouette/representative imagery (ties to minor-note #1: a kind must have a visual identity) | freeze [minor] note #1 |
| **Knowledge Notes** | buyer-relevant "why this kind", typical trade-offs | advisory |

**Rule of thumb for the boundary:** if a fact is true of *every* Walking-Foot-Lockstitch machine regardless of brand/model, it lives on the **type**. If it varies per product/model (speed, price, specific bundled attachment), it lives on the **product** (see §2).

### 1.2 Worked example — `Walking Foot Lockstitch` (illustrative shape, to be ratified — NOT final authored data)
```
Type Identity
  Name (EN): Walking Foot Lockstitch          Name (ZH): 综合送料平缝        Name (AR): ماكينة لوكستيتش بقدم ماشية
  Parent subcategory: Lockstitch              Code segment: (per governed coding)
  Definition: Lockstitch machine whose presser foot "walks" in sync with the feed dog,
              moving top + bottom layers together — for thick/multi-layer/slippery materials.
  Distinguishing mechanism: unison (top + bottom) feed.

Applications        : heavy bags & luggage · upholstery & furniture · tents/awnings · leather goods · footwear uppers · webbing/straps
Industries          : furniture · automotive interiors · leather goods · outdoor/technical textiles · marine
Operations          : seaming thick assemblies · topstitching multi-layer · attaching webbing/straps · binding heavy edges
Fabrics / Materials : leather · vinyl/PVC · canvas/duck · denim (heavy) · coated/laminated technical fabrics · foam-backed
Compatibility classes: walking-foot presser sets · heavy needle systems (e.g. 135x17 class) · edge guides · binders · large bobbin/hook class
Spare-part classes  : feed dog (walking class) · presser-foot (walking class) · hook/bobbin (large) · needle bar · tension assembly
Visual identity     : [walking-foot lockstitch silhouette asset]
```
Authoring this once means a future "Koleex NEXO L9 — Walking Foot Lockstitch" product inherits all of the above and authors **only** its own deltas.

### 1.3 Type Library scope & governance (build-time, per freeze minor-note #1)
- **Source of truth for the kind list:** the existing `src/lib/machine-kinds.ts` (105 kinds / 9 subcategories) is the candidate library; this phase decides **which kinds to author first** (recommend: only the kinds the initial ~710 products actually belong to — author on demand, not all 105 up front).
- **Machine Kind Approval Rule (from freeze):** a kind is admitted to the library only if it has (a) clear knowledge meaning, (b) a visual identity, (c) applications/operations/fabric logic, (d) is not merely a feature. This plan adopts that rule as the gate for adding any new kind to the library.
- **Concept nodes (Application/Industry/Operation/Fabric/Material):** per freeze minor-note #2, when these are built they start as **thin reference tables (controlled vocabulary)**, not shadow-IDs. For *planning*, we first compile the controlled vocabulary lists implied by the worked examples (a "Concept Vocabulary v0").

**Planning output of §1:** (a) the Product-Type node template above; (b) the prioritized list of kinds-to-author-first; (c) Concept Vocabulary v0 (the deduped Application/Industry/Operation/Fabric/Material terms).

---

## 2. Knowledge Inheritance Rules
> *Fix exactly what flows `Machine Kind ↓ Product`: what is inherited, what may be overridden, and what may never be overridden.*

### 2.1 The inheritance matrix (proposed — to be ratified)
| Knowledge | Default at product | Product may **add** | Product may **override/suppress** | Product may **never** change |
|---|:--:|:--:|:--:|:--:|
| Applications | inherited from type | ✅ add product-specific | ✅ suppress an inherited one (with reason) | — |
| Industries | inherited | ✅ | ✅ suppress | — |
| Operations | inherited | ✅ | ✅ suppress | — |
| Fabrics / Materials | inherited | ✅ | ✅ suppress | — |
| Compatibility classes | inherited | ✅ add specific compatible products/parts | ⚠️ narrow only (cannot claim broader than the kind allows) | the kind's mechanism-level class set |
| Spare-part classes | inherited | ✅ specific SKUs | ❌ | the part-family classes (defined by mechanism) |
| **Type membership** (`belongs_to`) | the kind itself | — | — | ❌ a product cannot re-define its kind's knowledge contract |
| **Specs** (speed, dimensions, power…) | product-owned | ✅ | ✅ | n/a (never inherited — always product) |
| **Identity / names** | product-owned | ✅ | ✅ | n/a |
| **Media** | product-owned (+ type visual as fallback) | ✅ | ✅ | n/a |

### 2.2 Resolution semantics (settles freeze P0-B [minor])
- **Effective knowledge = union(type, product) − product-level suppressions.** (Adopt the freeze's recommended *union + product-level suppress*.)
- **A suppression must carry a reason** (so "why doesn't this Walking-Foot machine do leather?" is answerable, not silently missing).
- **Narrowing-only on compatibility:** a product can be *more* restrictive than its kind, never *more* permissive — a product can't claim a compatibility the mechanism doesn't support.
- **Completeness counts inherited knowledge** (per P0-C): an inherited application satisfies the Applications group; product-level gaps are still *flagged* but don't zero the score. This is what lets a freshly-created product start at a sensible completeness instead of 0%.

**Planning output of §2:** the ratified inheritance matrix + resolution semantics (union/suppress/narrow-only/reasoned-suppression), ready to become the engine spec at implementation time.

---

## 3. Population Workflow
> *The operator builds knowledge in this order — not `Create Product / Fill Fields / Save`.*

### 3.1 The sequence
```
Step 0  Ensure Product Type Knowledge exists
        └─ if the kind isn't authored in the Type Library yet → author it first (§1, Approval Rule)

Step 1  Create Product Type Knowledge        (only when introducing a brand-new kind)
Step 2  Create Product Identity               (P0-A: Official/Short/Marketing/SEO/Series/Model/Aliases/Localized + internal code)
Step 3  Add Product Specs                     (product-owned technical values)
Step 4  Add Product Media                     (hero + gallery + manual + video; type visual as fallback)
Step 5  Add Product Relationships             (P0-B typed edges: related/alternative/upgrade/replacement/cross_sell + compatibility)
Step 6  Publish                               (subject to the publish-floor policy below)
```
This is the concrete form of the frozen mental-model shift: **Build (Type) → Enrich (Identity/Specs/Media) → Connect (Relationships) → Measure (Completeness) → Publish.**

### 3.2 Publish-floor policy (adopts freeze minor-note #3 — ~710 legacy products)
| State | Floor |
|---|---|
| **Draft** | no floor — anything can be saved as draft |
| **Active** | minimum **Identity + Type (`belongs_to`) + Model** only |
| **Knowledge completeness** | **advisory first** (shown, not blocking) → raise the floor *after* the legacy backfill |

This lets the existing ~710 products migrate without being blocked, while completeness is visible from day one.

### 3.3 What this workflow deliberately rejects
- ❌ Starting from a blank product form and "filling fields" — that's the database mental model.
- ❌ A product authoring its own applications/industries from scratch when its kind already knows them.
- ❌ Treating relationships as an optional afterthought — Step 5 is part of the build, not post-hoc.

**Planning output of §3:** the ratified step sequence + publish-floor policy + the legacy-backfill order (which kinds → which products first).

---

## 4. What Population Architecture Planning must produce before Green Light
A checklist — each item is **planning/spec**, no code, no products, no schema:

- [ ] **§1** Product-Type node template ratified
- [ ] **§1** Prioritized kinds-to-author-first list (driven by the actual ~710 products)
- [ ] **§1** Concept Vocabulary v0 (Applications/Industries/Operations/Fabrics/Materials controlled lists)
- [ ] **§2** Inheritance matrix + resolution semantics ratified
- [ ] **§3** Population workflow steps ratified
- [ ] **§3** Publish-floor policy + legacy-backfill order ratified
- [ ] A worked end-to-end example: one Machine Kind fully authored + one product built on it through all 6 steps (on paper)

When all are ratified (owner + ChatGPT), **then** the separate **Green Light → Product Population** applies — and only at that point do schema migration / PD-V2 cutover / prod-DB changes come up for their own, separate sign-off.

---

## 5. Explicitly out of scope for this phase
- Writing any contract/engine code.
- Schema migration, PD-V2 cutover, production-DB changes (each separately gated).
- Adding, editing, or deleting any real product.
- Building the Application/Industry/Operation/Fabric/Material apps.

*This is strategy. The goal of finishing it is the first time KOLEEX has a real **Product Knowledge System**, not a more advanced Product Database.*
