# Product Data V2 — Architecture Freeze v1.0

> **Visual requirement (SoT):** Product Data V2 is **visual-first** — see [Visual Product Experience](./visual-product-experience.md). The identity spine (Type → Family → Primary Model → SKU) also carries Visual Presentation Metadata (icons, photos, spec cards), resolved by the same inheritance order. Visuals are part of "done".

Status: **Approved in principle.** This is the canonical record of frozen decisions. Changes follow `../reference-data/coding-change-governance.md`.

## 1. Identity model (frozen)
A product has **three identities**, not one:
- **Product Type** — *what it is* (schema/behavior: spec template, AI structure, comparison, configurator, coding grammar).
- **Primary Model** — *what the customer buys* (the commercial KOLEEX code; specs, marketing, media). The bridge between catalog and operations.
- **SKU** — *what the warehouse moves* (cost, stock, weight, CBM, packing). The operational anchor for all ERP.

**Hierarchy:** `Division → Category → Subcategory → Product Type → Product Family (optional) → Primary Model → SKU`.

**Identity creation rules:**
- Commercial difference → **new Primary Model** (e.g., `-T` trimmer variant).
- Cost/stock/physical difference → **new SKU** (HO/CS).
- Anything else (voltage, plug) → **option/facet**, no new SKU by default.
- **Family only** when ≥2 sibling models share a market-recognized series; never a family of one.
- Every Primary Model has **≥1 SKU** so ERP always has an anchor.

## 2. Source-of-truth ownership
| Domain | Owner level | Notes |
|---|---|---|
| Technical specs | Primary Model (Family default → Model override) | resolved via inheritance |
| Marketing + media | Primary Model (series story on Family) | |
| Cost / stock / physical (weight/CBM/packing/HS) | **SKU only** | never inherited from above |
| Selling price | **Commercial Policy** (referenced, not in PIM) | |
| Templates / grammar / device options | Product Type | the contract |

**Spec resolution order:** `SKU > Primary Model > Family > Product Type default`.

## 3. The six refinements that closed Freeze v1.0
1. **Identity ambiguity resolved** — collapse legacy `products` into Primary Model; series → Family; standalone → Primary Model. `product_models` = Primary Model; `pd_skus` = SKU.
2. **Facets = Hybrid** — EAV source of truth + trigger-maintained projection (not full-refresh matview); hot numeric facets get typed/expression indexes. Scales to 100k+.
3. **Compatibility engine** — typed match-spec (`{facet, op, value}`) + resolved projection (both directions); deterministic resolver (exclusion > specific level > confidence > explicit).
4. **BOM engine** — kits (device/spare/consumable/maintenance/critical/service/warranty) with inheritance + versioning + override; resolved up the identity chain.
5. **Search = Postgres-native hybrid** — pg_trgm (codes/typo) + per-locale FTS (EN/AR/ZH; bigram for CJK) + pgvector (semantic) fused by RRF + synonym/alias layer.
6. **AI = RAG + knowledge graph + tools/MCP** — chunks/embeddings + entity/relationship graph + deterministic tools; confidence scoring; AI never invents specs.

## 4. KEEP / MODIFY / REMOVE (final decision report)
| Component | Decision | Note |
|---|---|---|
| `products` table | **REMOVE** (archive→retire) | collapse into Primary Model |
| `product_models` | **KEEP → MODIFY** | becomes Primary Model; sheds SKU/physical fields post-split |
| `pd_skus` | **KEEP** | operational anchor; unique config-hash |
| legacy `divisions/categories/subcategories` | **MODIFY** | dedupe codes; backfill into `pd_` taxonomy; then retire |
| empty `product_divisions/_categories/_subcategories/_lines` | **REMOVE** | abandoned scaffolding |
| PTE `templates/sections/fields` | **MODIFY** | re-cast as editing UI over `pd_facets`; retire `*_fields` as a store |
| `pd_` taxonomy · product_types · families | **KEEP** | frozen spine |
| Facets (EAV + projection) | **KEEP (Hybrid)** | trigger-maintained projection |
| Read models (search/AI) | **MODIFY** | projection tables, not matviews |
| Compatibility · BOM · Applications · Processes · Devices · Code Registry | **KEEP** | as designed |
| translations · market_prices · related_products | **KEEP** | adopt for i18n / market / relationships |
| `product_sewing_specs` · `products.specs/schema_specs` · cost snapshot | **REMOVE (post-migrate)** | migrate to facets; archive then drop |
| Search (trgm+FTS+pgvector+RRF) · AI (chunks/embeddings/graph/tools/MCP) | **KEEP** | frozen stacks |

## 5. Freeze readiness
All open questions from the prior review are closed: no identity ambiguity, no full-refresh-matview scale trap, deterministic compatibility/BOM resolvers, trilingual hybrid search, single typed spec store, and a governed canonical code.

**Remaining gates (not architecture — execution):** (a) production baseline validated on a clean branch (Stage 1.5), (b) prefix-freeze sign-off (13 decisions + XP↔XPC). Stage 2+ stays blocked until both clear.
