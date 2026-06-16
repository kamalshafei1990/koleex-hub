# Add-Product — Field Coverage & Roadmap

> Reconciles the canonical **14-section product-data model** (~150 fields) against
> what the Add/Edit Product form (`ProductForm.tsx`) actually captures today, and
> sets the phased plan to close the gaps. Companion to the frozen
> `product-build-north-star.md` + `product-knowledge-architecture-freeze.md`.

Status legend: ✅ captured in the form · 🟡 in the DB / partial / not surfaced · ❌ missing.

---

## Coverage snapshot (~65–70% captured)

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 1 | Identity | 🟡 | ✅ name, slug, family(series), model, sku, product_code(primary_model), barcode, localized names (`product_translations`). ❌ official/short/marketing/seo name, search_aliases. QR derived in UI (not stored). |
| 2 | Classification | 🟡 | ✅ division/category/subcategory/machine-kind/family. 🟡 Product Line (`product_lines` exists, not in form), Industry Segment (schema_specs). |
| 3 | Basic Info | ✅ | description, excerpt(short), highlights, + knowledge blocks. (Warnings now a knowledge type.) |
| 4 | Technical Specs | ✅* | Schema-driven per subcategory. ❌ air pressure/consumption, working area. |
| 5 | Commercial | 🟡 | ✅ cost, market price (per-country), supplier, MOQ, lead time. ❌ FOB/distributor/dealer/retail, production time. Margin computed not stored. |
| 6 | Media | 🟡 | ✅ main/gallery/packing/label/manual/ar_3d/video. ❌ lifestyle, 360°, separate install/maintenance video, certificate, brochure — **blocked by `valid_media_type` CHECK constraint**. |
| 7 | Product Knowledge | ✅* | **Now authorable in-form (Knowledge step).** ❌ Operations (seaming/hemming/…) + Materials as structured dimensions. |
| 8 | Compatibility | ❌ | No tables for compatible needles/feet/folders/attachments/motors/controllers/tables/accessories. |
| 9 | Spare Parts | ❌ | No tables/UI. |
| 10 | Relationships | 🟡 | ✅ generic `related_products`. ❌ relation TYPE (alternative/upgrade/replacement/successor/previous/recommended/cross-sell). |
| 11 | AI Knowledge | ✅* | ✅ FAQ(buyer_questions), comparison, + new ai_summary/troubleshooting types; every block has aiReadable+aiWeight. ❌ generation pipeline. |
| 12 | Logistics | 🟡 | ✅ HS code, country, container qty, packing type. ❌ shipping method, dangerous-goods flag, customs notes. |
| 13 | Service & Support | 🟡 | ✅ warranty + warranty_notes + maintenance_notes. ❌ install guide, maintenance schedule (structured), spare-parts availability. |
| 14 | Completeness & Maturity | 🟡 | ✅ structural %/final %, L1–L3 (`product-knowledge-signal.ts`, `readiness.ts`). 🟡 L4/L5 defined in the frozen Knowledge Experience but not computed. |

\* schema-driven / knowledge depth depends on per-product authoring.

---

## DONE

- **In-form Product Knowledge editor** (`form-sections/KnowledgeSection.tsx` + Knowledge step). Authors all `schema_knowledge` block types — no migration (jsonb). _(PR #154)_
- **3 new knowledge types**: `warnings` (public Safety section on the product page), `troubleshooting`, `ai_summary` (AI-readable). _(Phase 0)_

---

## Roadmap (each DB phase = explicit sign-off; Phases 4–5 must go through the North Star freeze process)

| Phase | Scope | DB change | Closes |
|-------|-------|-----------|--------|
| 0 ✅ | New knowledge types (warnings/troubleshooting/ai_summary) | none (jsonb) | §3, §11 |
| MEDIA | Media categories: lifestyle/detail/360/install-video/maintenance-video/certificate/brochure | **alter `valid_media_type` CHECK** + widen `ProductMediaType` + MediaSection config | §6, §13 |
| 1 | Identity columns: official/marketing/seo/short name + search_aliases; product_line_id FK + classify picker | additive cols + FK | §1, §2 |
| 2 | Price tiers: FOB/distributor/dealer/retail + production_time | additive cols (product_models or product_market_prices) | §5 |
| 3 | Logistics + service: shipping_method, dangerous_goods, customs_notes, maintenance schedule, spare_parts_available | additive cols | §12, §13 |
| 4 | Operations + Materials as structured multi-select schema fields | code-only but **North Star territory** (subcategory = template owner) | §7 |
| 5 | relationship TYPE on `related_products`; new `product_compatibility`; new `product_spare_parts` | new cols + new tables | §8, §9, §10 |
| MATURITY | Wire L4 (connected) / L5 (complete) into detail-level readiness | code-only, **frozen Experience** — align first | §14 |

Genuinely-missing identity columns and the new relational tables are the largest lifts and intersect the frozen architecture; sequence them through that process rather than ad-hoc.
