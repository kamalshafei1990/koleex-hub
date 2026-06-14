# KOLEEX — P0-UX Product Knowledge Experience Blueprint
**Mode:** read-only **experience architecture** audit. **NOT** UI design / frontend redesign / feature implementation / coding. **No code · no schema · no migration · no visual redesign.**
**Date:** 2026-06-15. **Frozen:** P0-A Naming · P0-B Graph · P0-C Completeness · P0-D Product Type Library · P0-E Controlled Vocabulary.
**Status:** 🟢 **RATIFIED — APPROVE WITH MINOR NOTES** (independent architecture review, 2026-06-15). One minor note folded in (§4 / §8: Maturity = Knowledge Signal, Publish Status = Operational Signal — keep both). **Verdict: freeze P0-UX as the experience contract before P0-F.** Confirmed gate order: `P0-UX → P0-F → Product Type Knowledge Authoring → Pilot → Population`. Full ratification in §Ratification. *(Awaiting owner go to actually open P0-F.)*
**Evidence base:** the live walkthroughs + code reads from the [Product Knowledge Audit](product-knowledge-audit.md) and [observations](product-knowledge-audit-observations.md). This audit reframes them as an **experience model**, not a feature list.

> **The one question:** *When a user opens KOLEEX Hub, does it feel like they are managing PRODUCTS, or managing PRODUCT KNOWLEDGE?*
> **Honest answer today:** they **read** product knowledge (the public Preview), but they **manage a database** (list + wizard). The Knowledge-Object feeling is bolted onto the read side and largely absent from the manage side.

---

## 1. Current Experience Audit
Each surface scored **Database Experience %** vs **Knowledge Experience %** (they sum to 100), with evidence.

| Surface | DB Exp. | Knowledge Exp. | Evidence (from the live system) |
|---|:--:|:--:|---|
| **Product List** | **80%** | 20% | Spreadsheet columns `Product · Category · Brand · Models · Status`. `Status` is a raw **publish enum**, not knowledge maturity. No completeness signal, no relationship hint, no inheritance state. *(Card view is milder, ~60/40 — image + code-as-title + taxonomy chips — but still no completeness ring or "part of family" cue.)* |
| **Product Workspace (editor/wizard)** | **75%** | 25% | Linear **7/8-step field-collection form** = Create → Fill → Save. No live knowledge object forming until the final Review step (author *blind*). No visible inheritance from the Type. Relationships collected as a flat list. **KO islands:** the Hero step + governed Primary-Model code editor (minting an identity *feels* like knowledge). |
| **Product Preview** | **15%** | **85%** | The one genuinely Knowledge-Object surface: cinematic hero, schema-driven emphasis, application cards, material filmstrip, automation workflow, performance meters, knowledge blocks. **Gaps:** relationships not rendered; completeness not shown. *Preserve as canonical.* |
| **Product Dashboard** | **90%** | 10% | There is no true *knowledge* dashboard. The list doubles as the dashboard. No aggregate structural/knowledge health, no maturity distribution, no missing-knowledge hotspots. |
| **Product Relationships** | **95%** | 5% | Single **untyped** `related_products` edge; no `relation_type`; rendered **nowhere**. Every product is an island; the catalog is not yet a graph. |
| **Product Completeness** | **60%** | 40% | Machinery exists (`computeReadiness`, 7 weighted dims) — but **two non-reconciled meters**, only on the wizard **Review** step, ignoring relationships/applications/inheritance, and **invisible** on list/cards/preview where humans actually browse. |
| **Product Search** | **85%** | 15% | Find-a-product by name/code. Cannot search by Application/Industry/Operation/Fabric/Relationship. You can't ask *"all walking-foot machines for denim that topstitch."* |

**Blended verdict:** **manage side ≈ 78% Database / 22% Knowledge**; **read side (Preview) ≈ 85% Knowledge.** The product is a Knowledge Object only *after* it's published and *only* on one surface.

---

## 2. Product Knowledge Experience Model (the layers)
Five experience layers — what the user *experiences/does*, not screens. Aligned 1:1 with the frozen [population workflow](population-planning-phase-1.md).

| Layer | The user's experience | Purpose |
|---|---|---|
| **L1 · Build Knowledge** | Establish identity (P0-A) and **`belongs_to` a Product Type** — the object is **born already knowing** (inherits the type's applications/industries/operations/fabrics). | Knowledge starts non-empty. No blank form. |
| **L2 · Enrich Knowledge** | Add product-specific depth: specs, attribute values, media, commercial, product docs. | Deepen the object beyond what the type gives it. |
| **L3 · Connect Knowledge** | Wire **typed relationships** (alternative/upgrade/replacement/cross-sell/compatible) + confirm/override/suppress inherited edges. | Turn islands into a graph. |
| **L4 · Measure Knowledge** | Completeness (structural 50 + knowledge 50) + gaps + health are **always visible**, live — not a final gate. | Knowledge quality is felt continuously, not discovered at the end. |
| **L5 · Publish Knowledge** | Promote to a state under the publish-floor; publishing is a **knowledge-maturity decision**, not a Save. | "Done" means *a maturity threshold*, not *a write succeeded*. |

**The defining shift:** measurement (L4) is **ambient**, not terminal; inheritance (L1) makes the object *start* knowledgeable.

---

## 3. Product Workspace Transformation (the mental model)
**Current:** `Create Product → Edit Product → Save Product` (a form you fill and save).

**Future mental model:**
> **Open a Knowledge Object → Inherit → Enrich → Connect → Measure → Promote.**
> You are not filling a form; you are **raising a living knowledge object from `Record` to `Complete Product Knowledge`** — an object that already exists, already inherits from its Type, and is always being measured.

Consequences (experience-level, not UI):
- **"Save" conceptually disappears** (autosave is assumed). The meaningful action is **advancing maturity**, not persisting a row.
- **The object is always visible forming** — authoring = watching the Knowledge Object take shape (no blind-until-Review).
- **Inheritance is explicit** — the operator sees what came from the Type vs what they added; suppression carries a reason.
- **Relationships are part of building**, not an afterthought (L3 is a first-class step).
- The verb changes from **"edit a record"** to **"cultivate knowledge."**

---

## 4. Product List Transformation (information architecture)
**Today communicates:** record attributes — Product · Category · Brand · Models · Status (publish enum).

**A Product Knowledge System's list must fundamentally communicate *knowledge state*, per product:**
| Signal | What it tells the user |
|---|---|
| **Maturity Level** (L1–L5) | Where this object is on the knowledge journey *(primary signal)*. |
| **Knowledge Completeness %** | The single authoritative number (P0-C). |
| **Knowledge Health** | Structural vs Knowledge split — is it media-rich but knowledge-empty? |
| **Product Type** (`belongs_to`) | Its place in the graph spine. |
| **Relationship presence/density** | Connected vs island. |
| **Missing Knowledge** | The top gaps (the next best action). |
| **Inheritance Status** | How much is inherited from the Type vs product-specific. |

→ The list becomes a **knowledge-health roster**, not a record table. **`Status` becomes knowledge maturity** as the primary signal.
> **[Ratification minor note]** Maturity does **not** delete the publish state — keep **two distinct signals**: **Maturity = Knowledge Signal** (L1–L5) and **Publish Status = Operational Signal** (Draft/Active/…). They coexist; maturity leads, publish remains. *(Implementation-time, non-blocking.)* *(IA only — no layout prescribed.)*

---

## 5. Product Knowledge Dashboard (what it should measure)
**Belongs (knowledge metrics):**
- **Structural Score** (catalog aggregate) · **Knowledge Score** (catalog aggregate)
- **Maturity distribution** — how many products at L1…L5
- **Inherited vs Custom Knowledge ratio** — is the catalog leaning on type inheritance or authoring custom?
- **Relationship Density** — connected vs island products
- **Documentation Coverage** · **Media Coverage**
- **Missing-Knowledge Hotspots** — which knowledge groups are most empty across the catalog
- **Type Knowledge Coverage** — which of the 10 Types have rich vs thin knowledge (the inheritance source)
- **Vocabulary Usage** — which Applications/Operations/Fabrics are actually referenced (orphan vocab detection)

**Does NOT belong (these are operational/commerce, not knowledge — keep them out of the *knowledge* dashboard):**
- Raw record counts as a vanity metric · publish-status counts alone · **price / stock / sales / margin** (commerce) · edit-recency as a primary KPI · per-user activity logs.

→ Rule: the Knowledge Dashboard measures **knowledge quality & coverage**, never commerce or raw volume.

---

## 6. Product Search Philosophy (conceptual architecture)
**Current:** *find a product* (by name/code) — a table lookup.

**Future:** **search the knowledge graph, not the product table.** Every node type is an entry point.
**Should users search Products · Applications · Industries · Operations · Fabrics · Relationships?** → **Yes — all of them.** Search is multi-entry into the graph.

Three conceptual modes:
1. **Lookup** — find one known product (name/code). *(keep)*
2. **Faceted Discovery** — filter by the P0-E controlled vocabularies + P0-D Type + attributes ("Overlock machines, used_in Footwear, works_with Leather").
3. **Graph Traversal** — start at a *concept* and walk to products ("start at Application=Jeans → machines used_for it → their alternatives/upgrades"). Search **becomes traversal**.

→ Search architecture = entity-typed, vocabulary-faceted, relationship-traversable. The search box is a **door into the graph**, not a filter on a table.

---

## 7. Product Knowledge Maturity Model (final)
Five levels, tied to the frozen contracts (indicative bands; exact thresholds are P0-C build-time):

| Level | Name | Definition |
|:--:|---|---|
| **L1** | **Record** | Identity only (a name, maybe a code). No `belongs_to`, no specs. A row. |
| **L2** | **Structured Product** | `belongs_to` a Product Type + the Active floor (Identity + Type + Model). **Inherits** type knowledge. Structural completeness still low. |
| **L3** | **Knowledge Object** | Structural completeness substantially present (media + docs + commercial) **and** product-specific knowledge added beyond inheritance. |
| **L4** | **Connected Knowledge Object** | L3 **+ typed relationships wired** (alternative/upgrade/replacement/cross-sell/compatible) — no longer an island. |
| **L5** | **Complete Product Knowledge** | Both Structural & Knowledge completeness high · relationships dense · documentation/media full · no critical gaps flagged. P0-C "complete." |

→ Maturity = `f(belongs_to, structural%, knowledge%, relationship density)`. **The list, workspace, and dashboard all speak in these 5 levels** — one shared maturity language.

---

## 8. Blocking Experience Gaps (P0 / P1 / P2)
**P0 — prevents the Hub from *feeling* like a Product Knowledge System:**
- **P0-1** Completeness is **invisible** where users browse (list/cards/preview). Knowledge quality isn't felt.
- **P0-2** Relationships **untyped + unrendered** → no graph feeling; products are islands.
- **P0-3** Workspace is **Create/Fill/Save linear form** — no inheritance shown, no live object forming, no measure-as-you-go.
- **P0-4** **No maturity language** — `Status` = publish enum, not L1–L5. Users can't see where an object is on the journey. *(Ratification note: introduce Maturity as a Knowledge Signal **alongside** Publish Status as an Operational Signal — don't replace one with the other.)*

**P1 — should fix:**
- **P1-1** No **Knowledge Dashboard** (catalog-level knowledge health absent).
- **P1-2** Search is **product-lookup only** — no concept/relationship traversal.
- **P1-3** **Inheritance status invisible** (inherited vs custom not shown anywhere).
- **P1-4** Legacy flat **TemplateView** still serves real routes (a Database experience on a real path).

**P2 — nice to have:**
- **P2-1** Two non-reconciled completeness meters (cosmetic until the P0-C engine is the single source).
- **P2-2** List ergonomics polish · **P2-3** "next best knowledge action" nudges.

---

## Final Question — Before opening P0-F, should KOLEEX first freeze the Product Knowledge Experience Blueprint?

# **YES.**

**Why:** P0-A→E froze *what knowledge is* (substance). They did **not** freeze *how knowledge is built, measured, and felt* (experience). That experience model is a **contract**, exactly like the others — and it dictates what the remaining data work must expose:
- P0-F vocabularies (Materials/Compatibility/Spare-Parts) and Product Type Knowledge authoring must support **visible inheritance, suppression-with-reason, and maturity** — which only exist if the experience model is fixed first.
- The list/search/dashboard must speak the **L1–L5 maturity language** and the **Build→Enrich→Connect→Measure→Publish** layers; if the data layer is populated against an *unstated* experience model, you rebuild the experience on top of thousands of products later.

Freezing P0-UX now is the same logic that made Naming/Graph/Completeness freeze before population: **cheaper to fix the contract before the data and screens exist than after.** This is the missing contract in the set — and it is the literal goal of the whole journey (**Product Database → Product Knowledge System**). So: **freeze the Product Knowledge Experience Blueprint as P0-UX, then open P0-F.**

---

## Ratification — APPROVE WITH MINOR NOTES ✅ (independent review, 2026-06-15)
The independent architecture review **approved** the blueprint and answered the Final Question **YES**.

- **Headline:** *"This is the first contract that links everything previously frozen (P0-A Identity · P0-B Graph · P0-C Completeness · P0-D Product Types · P0-E Vocabulary). Without it, Population would begin with no clear definition of what the system is trying to become from the user's perspective."*
- **Section verdicts:** §1 Current-State **APPROVED** (numbers consistent with all prior audits; *"users consume knowledge but manage records"*) · §2 Experience Model **APPROVED** (Build←P0-B · Enrich←P0-E · Connect←Graph · Measure←P0-C · Publish←Publish-Rules — *"fully consistent"*) · §3 Workspace **APPROVED** · §5 Dashboard **APPROVED** (*"one of the strongest parts"*; commerce-exclusion confirmed) · §6 Search **APPROVED** (*"natural result of P0-B"*) · §7 Maturity **APPROVED** (*"logical, progressive"*) · §8 Gaps **APPROVED** (P0-2 relationships untyped+unrendered = the biggest gap between *Knowledge Record* and *Knowledge Graph*).
- **The single minor note (§4 Product List):** *Publish Status must not disappear entirely.* → **Maturity = Knowledge Signal · Publish Status = Operational Signal** (keep both). Explicitly **"not an architectural problem — a later implementation note."** Folded into §4 and §8.
- **Final Question — YES.** Rationale: **P0-F defines the data** (Materials · Compatibility Classes · Spare-Part Classes); **P0-UX defines** *why these things exist · how users see them · how completeness measures them · how maturity depends on them.* Therefore the correct order is:
```
P0-UX → P0-F → Product Type Knowledge Authoring → Pilot → Population
```
**Both architects ratified.** P0-UX is adopted as the experience contract; opening P0-F awaits owner go.

---

## ChatGPT Ratification Summary (sent for independent review — APPROVED)
```
KOLEEX — P0-UX Product Knowledge Experience Blueprint — Ratification Review

Review this EXPERIENCE-ARCHITECTURE audit for contradictions and gaps. This is
NOT UI design. Do NOT redesign. Either APPROVE / approve-with-minor-notes, or
list blocking issues.

THE QUESTION: opening KOLEEX Hub — does it feel like managing PRODUCTS or PRODUCT
KNOWLEDGE? Finding: users READ knowledge (public Preview ~85% knowledge) but
MANAGE a database (list + wizard ~78% database).

CURRENT EXPERIENCE AUDIT (DB% / Knowledge%)
List 80/20 · Workspace 75/25 · Preview 15/85 · Dashboard 90/10 ·
Relationships 95/5 · Completeness 60/40 · Search 85/15.

EXPERIENCE MODEL (5 layers) = Build → Enrich → Connect → Measure → Publish.
Key shift: Measure is AMBIENT (always visible), not terminal; Build starts
non-empty via Type inheritance.

WORKSPACE MENTAL MODEL
Create/Edit/Save  →  Open a Knowledge Object → Inherit → Enrich → Connect →
Measure → Promote. "Save" disappears; the action is RAISING MATURITY.

LIST IA must communicate: Maturity (L1-L5) · Completeness% · Knowledge Health
(structural vs knowledge) · Type · Relationship density · Missing knowledge ·
Inheritance status. (Status = maturity, not publish enum.)

DASHBOARD measures: Structural/Knowledge scores · maturity distribution ·
inherited-vs-custom · relationship density · doc/media coverage · missing-
knowledge hotspots · type-knowledge coverage · vocab usage. EXCLUDES commerce
(price/stock/sales) and raw counts.

SEARCH: from "find a product" → search the GRAPH. Entry via Products /
Applications / Industries / Operations / Fabrics / Relationships. 3 modes:
Lookup · Faceted Discovery · Graph Traversal.

MATURITY MODEL (final): L1 Record · L2 Structured Product · L3 Knowledge Object ·
L4 Connected Knowledge Object · L5 Complete Product Knowledge.

BLOCKING GAPS
P0: (1) completeness invisible where users browse (2) relationships untyped+
unrendered (3) workspace = Create/Fill/Save not a living object (4) no maturity
language (Status=publish enum).
P1: no knowledge dashboard · search lookup-only · inheritance invisible · legacy
flat TemplateView on real routes.

FINAL QUESTION: Freeze the Product Knowledge Experience Blueprint as P0-UX BEFORE
opening P0-F? Recommendation: YES — it's the missing contract; populating data
against an unstated experience model forces rework later.

ASK: APPROVE this experience model + maturity levels + the YES recommendation,
or list blocking issues.
```

*Read-only experience architecture. No code, no schema, no migration, no redesign. To be sent to ChatGPT for independent ratification before any further gate.*
