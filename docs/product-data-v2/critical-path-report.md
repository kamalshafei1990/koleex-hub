# Product Data V2 — Critical-Path Report

**North Star:** the **KOLEEX Product Knowledge System** (Product Types → Master Spec Dictionaries → Visual Metadata → Icons → Photos → Product Knowledge → AI → Website → ERP → Quotations → Brochures). The ERP is an *output*, not the goal. Every blocker below is judged against that target.

**Date:** 2026-06-14 · **Status:** decision-ready · documentation only (no prod / schema / migrations / Stage 2 started).
**Companion docs:** [`prefix-freeze-decision-package.md`](./prefix-freeze-decision-package.md) · [`master-spec-gap-analysis.md`](./master-spec-gap-analysis.md) · [`visual-readiness-report.md`](./visual-readiness-report.md) · [`executive-roadmap.md`](./executive-roadmap.md) · [`stage-1-5-baseline-audit.md`](./stage-1-5-baseline-audit.md) · [`baseline/baseline-validation-report.md`](./baseline/baseline-validation-report.md).

---

## Headline finding

**The highest-value work — authoring Master Specification Dictionaries — is NOT technically blocked.** It is governed-documentation work that can start **today**. The real technical blockers (production baseline, schema application) gate the *implementation/rendering* stages (Stage 5+, projections, UI), **not** the knowledge authoring. The only thing standing between us and Stage 2 is a **one-session prefix-freeze approval** — which is now packaged for sign-off.

So the reframe the program needs: stop treating "everything is blocked on the baseline." It isn't. **Approve the prefixes + start writing dictionaries now**, and complete the baseline in parallel before the implementation stages need it.

---

## The 10 questions

**1. What technical blockers still exist?**
- **B1 — Production baseline not completed.** 186 incremental migrations have no tracked foundation → a fresh branch replays to `MIGRATIONS_FAILED`. Needs a `pg_dump --schema-only` + clean replay (owner action; free local path exists). *Real, technical.*
- **B2 — V2 `pd_` schema is design-only (not applied).** Data is populated nowhere; projections (`pd_search_doc`, `pd_ai_doc`) don't exist yet. *Real, technical — but downstream of B1 and the stage approvals.*
- **B3 — Visual presentation metadata not populated.** Design (`visual-product-experience.md` §17) is complete; **no facet carries `presentation_group` / `spec_card_priority` / `comparison_display` / `icon_key` / `ai_visual_hint`.** *Real, but it's content/documentation — not gated by B1/B2.*
- **B4 — Renderers don't exist** for Comparison, Compatibility, Application, and AI-visual surfaces (Spec Cards + Website have a working schema-driven renderer in `ProductPreview`). *Real, technical — Phase C/D.*

**2. Which blockers prevent Stage 2?**
Only **the prefix-freeze sign-off (procedural)**. Stage 2 creates self-contained `pd_` taxonomy tables that depend on nothing in the legacy schema, so it carries zero production risk and does **not** require the baseline. The 8 *true* prefix blockers (live-code collisions / no-recycling violations — see the decision package) must be resolved **before import**, but they are decisions, not engineering.

**3. Which blockers prevent Stage 5?**
**B1 (production baseline)** — real. Stage 5 (SKU layer linking to `product_models`) must be branch-tested against faithful production tables; that requires the validated baseline. Also depends on Stage 2 being applied.

**4. Which blockers prevent Product Knowledge extraction?**
**None technical.** Product Knowledge = the authored Master Spec Dictionaries + applications + compatibility content. This is governed documentation; it needs the type identities (prefix freeze) and any new facets added to `facet-dictionary-master.md` first — both documentation actions. It can start now.

**5. Which blockers prevent Master Specification Dictionaries?**
**None technical.** Same layer as the existing reference datasets. Caveats only: (a) new facets (e.g. `needle_system`, `presser_foot_lift_mm`, wired `power_consumption`) must be added to the facet dictionary first; (b) ▲-proposed types should be frozen (prefix package) before they're "import-ready." Authoring is unblocked today.

**6. Which blockers prevent Visual Product Experience?**
Layered: (a) **B3** populate facet/type/device presentation metadata (documentation — not blocked); then (b) **B2** apply the `pd_` schema + projections (gated on B1 + stage approval); then (c) **B4** build the missing renderers. Per the visual-readiness report, design exists everywhere, **data is populated nowhere**, and renderers exist only for Spec/Website.

**7. Which blockers are real?**
B1 (baseline), B2 (schema not applied), B4 (missing renderers). And the *content* gap B3 (real work, just not technically gated).

**8. Which blockers are only procedural?**
The **prefix-freeze sign-off** and the **"Stage 2+ requires approval" gate**. No engineering is needed to clear them — only Kamal's decisions (now packaged) and a go-ahead. The earlier "Stage 2 blocked on baseline" framing was **over-cautious** — the baseline does not block Stage 2 or dictionary authoring.

**9. What can be removed?**
- The mental model that **all V2 work is blocked on the baseline** — remove it. Dictionary authoring + prefix approval + visual-metadata authoring proceed independently.
- Nothing in the SoT document set should be removed (it's the foundation of the knowledge system).

**10. What can be postponed?**
- **Production baseline (B1)** → to **just before Stage 5 / first prod-faithful branch test** (P1, not P0). It does not block the North-Star authoring work.
- **Brand monochrome migration** → separate program (P2).
- **Comparison/Compatibility/Application/AI renderers (B4)** → Phase C/D, after dictionaries + metadata exist (P2).

---

## Priority matrix

| Pri | Item | Type | Why | Owner | Cost | Unblocks |
|---|---|---|---|---|---|---|
| **P0** | **Approve the Prefix Freeze** (one session) | Procedural decision | Frees all 87 type identities; clears the 8 true live-collision blockers | **Kamal** | ~20–30 min | Stage 2 import; dictionary type-identity |
| **P0** | **Author Master Spec Dictionaries — Top 10 types** | Documentation (North-Star value) | NOT blocked; this *is* the product-knowledge work | Agent/Kamal | days, parallelizable | Product Knowledge, AI, comparison, website |
| **P0** | **Populate visual presentation metadata on facets/types** (B3) | Documentation | Biggest cross-cutting gap; governance now requires it before approval | Agent/Kamal | days | Visual surfaces (Spec/Comparison/Website) |
| **P1** | **Complete production baseline** (B1) | Technical (owner) | Gates Stage 5+ and any prod-faithful branch test | **Owner (CLI+pwd)** | ~10 min local, free | Stage 5+, schema application |
| **P1** | **Apply `pd_` schema + projections on a branch** (B2) | Technical | Turns design into populated data (`pd_search_doc`/`pd_ai_doc`) | Agent (post-approval) | medium | Visual data, AI, all renderers |
| **P2** | Build Comparison/Compatibility/Application/AI renderers (B4) | Technical | After data exists | Agent | medium–large | Remaining visual + AI surfaces |
| **P2** | Rebind `ProductPreview` from legacy `schema_specs` → `pd_facets` | Technical | After B2 | Agent | small | Spec Cards + Website on V2 |
| **P2** | Brand monochrome migration | Program | Separate brand decision; gated | Kamal | large | (brand, not knowledge) |

---

## Critical path (shortest route to a working Product Knowledge System)

```
Prefix Freeze approval (P0, Kamal)               Master Spec Dictionaries — Top 10 (P0, docs)
        │                                                   │  (run in parallel — neither blocks the other)
        ▼                                                   ▼
Stage 2 taxonomy import  ◄───────────────  Visual presentation metadata on facets (P0, docs)
        │                                                   │
        ▼                                                   │
Production baseline (P1, owner) ──► Apply pd_ schema + projections (P1) ──► Populate data
                                                            │
                                                            ▼
                                    Rebind ProductPreview + build Comparison/Compat/App/AI renderers (P2)
                                                            │
                                                            ▼
                                       Website · ERP · Quotations · Brochures (one source → all outputs)
```

**The two P0 documentation tracks (dictionaries + visual metadata) need nothing technical and should start immediately.** The technical track (baseline → schema → data) runs in parallel and only converges when it's time to *render* the authored knowledge.

---

## Bottom line

Product Data V2 is **not** stuck on engineering. It is one approval session (prefix freeze) away from Stage 2, and **zero blockers away** from the highest-value work: authoring the Top-10 Master Specification Dictionaries and their visual metadata. Do those now; complete the baseline before the rendering stages need it. See [`executive-roadmap.md`](./executive-roadmap.md) for the phased plan.
