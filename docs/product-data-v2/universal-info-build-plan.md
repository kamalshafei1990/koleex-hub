# Product Data — Universal Info Build Plan

**Date:** 2026-06-17 · **Status:** APPROVED DIRECTION, phased execution gated.
**Decided with Kamal:** 9-tab universal-info layout; supplier = link to Suppliers
app (no duplicate tab); add Compliance & Warranty; deepen Logistics & Media.

This plan covers **universal** (type-agnostic) product info. Type-specific specs
stay in the schema/Specifications engine and are out of scope here.

## Storage reality (grounded in prod schema, 2026-06-17)
- `products` — product-level universal columns (name, brand, classification,
  descriptions, highlights, tags, level, status/visible/featured, warranty(text),
  country_of_origin, hs_code, moq, lead_time, ce_certified, rohs_compliant,
  machine_weight_kg, machine_dimensions, video_url, main_image, …).
- `product_models` — **already** holds most logistics/packaging at model level:
  `net_weight, weight, cbm, packing_type, carton_dimensions, container_20ft_qty,
  container_40ft_qty, box_include, extra_accessories, barcode, sku, moq,
  lead_time, stock_status, tagline`.
- `product_media` — `type` is free text; already used for main_image / gallery /
  video / ar_3d / manual / packing_photo. **Documents need no schema change —
  just new type values + UI.**
- `product_suppliers` — clean LINK table (FK supplier_id + supplier_product_code,
  moq, lead_time_days, unit_cost_cny, currency, payment_terms, is_primary,
  show_in_catalog, notes). Supplier master stays in the Suppliers app.
- `product_translations` (0 rows), `related_products` (basic), `product_sewing_specs`.

**Key consequence:** the IA reorg + Media/Documents + Supplier-link + Logistics
surfacing are all **UI-only (no migration)**. Only Compliance/Warranty depth,
Identity identifiers, and Relationship typing need new columns (sign-off gated).

---

## Target: 9 tabs
1. Classify · 2. Identity · 3. Description · 4. Specifications (type-specific) ·
5. Models & Pricing (+ supplier link) · 6. Logistics & Packaging ·
7. Compliance & Warranty (NEW) · 8. Media & Documents · 9. Knowledge & Relationships.
SEO = section on Identity/Review. Governance/data-quality = meta side-panel.

---

## PHASE 1 — IA reorg (UI-ONLY · no migration · ship now)
Restructure the 8 wizard steps into the 9-tab layout. Move existing fields into
the right tab; **surface the model-level logistics fields that already exist** but
aren't shown well today. No DB change, no governance gate.
- New tab shells: split current "Logistics" → "Logistics & Packaging"; rename
  "Media" → "Media & Documents"; add empty "Compliance & Warranty" shell.
- Move: warranty/ce/rohs (currently scattered) → Compliance & Warranty.
- Surface model packaging fields (net_weight, cbm, carton_dimensions, container
  qty, packing_type, box_include) in Logistics & Packaging (read/write to
  product_models, per-model).

## PHASE 2 — Media & Documents (UI-ONLY · no migration · ship now)
Extend `MediaSection` to manage document rows in `product_media` via new `type`
values: `datasheet`, `manual`, `brochure`, `certificate`, `parts_list`,
`wiring_diagram`, `firmware`. Grouped uploader (Images · Video/3D · Documents).
No schema change (type is free text).

## PHASE 3 — Supplier link control (UI-ONLY · no migration · ship now)
On Models & Pricing: a "Supplier" control that lets the operator pick an existing
supplier (from the Suppliers app), shows name/logo/country read-only, and edits
only the per-product link fields already in `product_suppliers`. No duplication of
supplier master, no schema change.

---
*Phases 1–3 are within the auto-execute lane (UI-only). Phases 4–7 add columns/
tables → each needs explicit sign-off per coding-change-governance.md before any
prod migration.*
---

## PHASE 4 — Compliance & Warranty depth (MIGRATION · sign-off)
- New table `product_certifications` (product_id, cert_type, number, issuer,
  issued_date, expiry_date, file_url, status). Replaces the two booleans with real,
  multi-cert data (keep ce_certified/rohs_compliant as derived/back-compat).
- New `products` columns: `warranty_months int`, `warranty_type text`,
  `warranty_coverage text`, `spare_parts_availability text`,
  `service_life text`, `maintenance_interval text`, `returns_policy text`.

## PHASE 5 — Identity identifiers + lifecycle (MIGRATION · sign-off)
- `products` columns: `mpn text` (manufacturer part no.), `gtin text` (EAN/UPC),
  `launch_date date`, `eol_date date`. (KOLEEX primary_model already exists on
  product_models; barcode/sku already on product_models.)
- Supersession handled in Phase 6 via relationship typing (replaces / replaced-by).

## PHASE 6 — Relationships depth (MIGRATION · sign-off)
- Add `relation_type text` to `related_products`
  (accessory | spare_part | compatible_with | replaces | replaced_by | bundle).
- UI on Knowledge & Relationships to add/group by type. Powers cross-sell + supersession.

## PHASE 7 — SEO + Logistics finishers + Governance (MIGRATION · sign-off, smallest)
- SEO: `products` columns `meta_title text`, `meta_description text`,
  `og_image text` → small collapsible section on Identity. (slug already exists.)
- Logistics finishers (only if confirmed needed): `incoterm text`,
  `sample_available bool`, `sample_price numeric`, `gross_weight` /
  `units_per_carton` at the level decided (model vs product).
- Governance: prefer **derived** (completeness % computed from filled fields,
  audit from existing created/updated cols) over new columns — likely 0 migration.

---

## Sequencing summary
| Phase | Scope | Migration? | Gate |
|---|---|---|---|
| 1 | Tab IA reorg + surface model logistics | No | auto |
| 2 | Media & Documents | No | auto |
| 3 | Supplier link control | No | auto |
| 4 | Compliance & Warranty | **Yes** | sign-off |
| 5 | Identity identifiers + lifecycle | **Yes** | sign-off |
| 6 | Relationships typing | **Yes** | sign-off |
| 7 | SEO + logistics finishers + governance | **Yes (small)** | sign-off |

Each migration phase ships its own: migration + types + API + UI + validators +
build, with the change documented in product-coding-change-log.md first.
