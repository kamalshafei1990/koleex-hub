# KOLEEX Product Knowledge System — Executive Roadmap

**Target:** transform Product Data V2 from a technical architecture project into a **Product Knowledge System** ready for Master Specification Dictionary construction and, ultimately, AI + Website + ERP + Quotations + Brochures from one source.

**Date:** 2026-06-14 · documentation only. Effort is **relative** (S ≈ hours, M ≈ days, L ≈ weeks) — directional, not a commitment. See [`critical-path-report.md`](./critical-path-report.md) for the blocker analysis behind the sequencing.

**Key sequencing principle:** Phases **B (dictionaries)** and the documentation half of **C (visual metadata)** are **not gated** by the technical phase **A** — they are governed documentation and start in parallel **now**. Phase A's technical steps only need to land before the *rendering* of that knowledge (late C onward).

---

## PHASE A — Technical blockers
*Clear the engineering + decision gates so authored knowledge can later be applied and branch-tested.*

| Deliverable | Detail |
|---|---|
| A1 · **Prefix Freeze approved** | One sign-off session using [`prefix-freeze-decision-package.md`](./prefix-freeze-decision-package.md); freezes all 87 type identities, resolves 8 true live-collision blockers, retires 4 codes. |
| A2 · **Production baseline completed** | Owner runs the free local `supabase db dump --schema-only` + `db reset` replay (report [`baseline/baseline-validation-report.md`](./baseline/baseline-validation-report.md) §8); branch must reach `FUNCTIONS_DEPLOYED`. |
| A3 · **Stage 2 taxonomy applied** (on branch) | Self-contained `pd_` taxonomy tables; depends only on A1. |
| A4 · **`pd_` schema + projections applied** | Core entities + `pd_search_doc` / `pd_ai_doc` projections, on a validated branch (needs A2). |

- **Dependencies:** A1 → A3. A2 → A4 → Stage 5. A1 is independent of A2 (prefix freeze doesn't need the baseline).
- **Effort:** A1 **S** (decision); A2 **S** (owner, ~10 min local); A3 **M**; A4 **M–L**.
- **Risk:** A1 **Low** (reversible decision). A2 **Low** (read-only dump; validate on branch, never prod). A3 **Low** (additive, zero legacy coupling). A4 **Medium** (projection/trigger correctness; branch-test first). Paid cloud branch = **approval-gated**.

## PHASE B — Master Specification Dictionaries
*The highest-value business work. Pure documentation — START NOW, parallel to Phase A.*

| Deliverable | Detail |
|---|---|
| B1 · **Top-10 dictionaries** | Build in the order from [`master-spec-gap-analysis.md`](./master-spec-gap-analysis.md): Lockstitch → Overlock → Interlock → Multi-Head Embroidery → Heat Press (Flat) → Straight-Knife Cutter → Needle Detector → Fabric Spreading → Fabric Inspection → Fusing. Seed from the Lockstitch PTE template + NEXD 9000 benchmark. |
| B2 · **Facet dictionary extensions** | Add missing specs surfaced by the gap analysis (e.g. `needle_system`, `presser_foot_lift_mm`, wired `power_consumption`) to `facet-dictionary-master.md` first (governance). |
| B3 · **"Knowledge-ready" definition per type** | Each dictionary = spec set + applications + compatibility + the visual/comparison/AI metadata (handoff to Phase C). |

- **Dependencies:** B needs **A1** for final type identity, but authoring can begin against the proposed prefixes immediately; B2 precedes the specs that use new facets.
- **Effort:** **L** overall, but **highly parallelizable** (1–3 share a sewing-head spec spine — finishing Lockstitch de-risks the rest).
- **Risk:** **Low** (documentation; governed by `coding-change-governance.md`). Main risk is *scope drift* — mitigate by shipping one complete dictionary (Lockstitch) as the template before fanning out.

## PHASE C — Visual Product Knowledge
*Make the authored knowledge visual. Documentation half starts now; rendering half needs Phase A4.*

| Deliverable | Detail |
|---|---|
| C1 · **Populate visual presentation metadata** (docs) | The biggest cross-cutting gap: give every facet/type/device its `presentation_group`, `spec_card_priority`, `comparison_display`, display style, `icon_key`, `ai_visual_hint`. Not technically gated. |
| C2 · **Icons + photos attached** | Wire Visual Library `icon_key`s + `product_media` `image_role`s per Type/Family/Model/SKU/Device/Spare-Part/Facet (resolution order per visual SoT §3). |
| C3 · **Rebind `ProductPreview` → `pd_facets`** | Reuse the existing schema-driven renderer (closest-to-READY surface) on V2 data. |
| C4 · **Comparison / Compatibility / Application card renderers** | The surfaces currently NOT READY (see [`visual-readiness-report.md`](./visual-readiness-report.md)). |

- **Dependencies:** C1/C2 (docs/content) parallel to A/B. C3/C4 need **A4** (schema + projections applied + data populated).
- **Effort:** C1 **M**; C2 **M** (asset production); C3 **S–M** (rebind, renderer exists); C4 **M–L** (new renderers).
- **Risk:** C1/C2 **Low**. C3 **Low** (renderer proven). C4 **Medium** (new UI; monochrome brand rule applies).

## PHASE D — AI Product Intelligence
*Turn the knowledge into answers.*

| Deliverable | Detail |
|---|---|
| D1 · **`pd_ai_doc` projection populated** | Identity + specs + compatibility + relationships, retrieval-ready. |
| D2 · **RAG + embeddings + knowledge graph** | Chunks/embeddings + entity/relationship graph + deterministic tools; confidence scoring; AI never invents specs or visuals. |
| D3 · **`ai_visual_hint` wiring** | AI answers return structured visual cards, not prose. |

- **Dependencies:** needs B (knowledge to reason over) + A4/C1 (populated data + hints). D is the **payoff** of B+C.
- **Effort:** **L**.
- **Risk:** **Medium–High** (retrieval quality, hallucination control) — mitigated by the "references existing metadata only" rule and confidence gating.

## PHASE E — Website + ERP + Quotations + Brochures
*One source → every output.*

| Deliverable | Detail |
|---|---|
| E1 · **Website product pages on V2** | `/products/preview/[slug]` + `ProductPreview` pattern, `website_display_hint`-driven module order. |
| E2 · **Quotation product cards** | Picker icon+thumb+facet chips; resolved SKU photo into the A4 picture column; `quotation_display_hint`. |
| E3 · **ERP product editor** | Metadata-set (not layout) editor with live card preview + completeness gates. |
| E4 · **Catalog / PDF / brochure generation** | Same metadata → print; no separately maintained brochure data. |

- **Dependencies:** E consumes C+D outputs; E1/E2 are closest (renderers/consumers partly exist today).
- **Effort:** E1 **M**, E2 **M**, E3 **M–L**, E4 **M**.
- **Risk:** **Low–Medium** (mostly assembly of prior phases; brand rule applies to all surfaces).

---

## Sequenced view

```
NOW ─┬─ PHASE A (technical):   A1 approve prefixes ─► A3 Stage 2 │   A2 baseline ─► A4 schema+projections
     │
     ├─ PHASE B (docs, parallel):   B2 facets ─► B1 Top-10 dictionaries (Lockstitch first)
     │
     └─ PHASE C (docs half, parallel):   C1 visual metadata · C2 icons/photos
                                              │
            (A4 + B + C-docs complete) ──────►  C3 rebind ProductPreview · C4 new renderers
                                              │
                                              ▼
                                     PHASE D (AI) ──► PHASE E (Website · ERP · Quotations · Brochures)
```

**Immediate next actions:** (1) Kamal approves the prefix freeze [A1]; (2) owner runs the free local baseline [A2]; (3) authoring begins on the Lockstitch Master Spec Dictionary + its visual metadata [B1+C1] — none of which wait on each other. That converts V2 from "architecture project" to "Product Knowledge System under construction."
