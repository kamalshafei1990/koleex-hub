# Product Data V2 — Technical Schema (design)

**Design only — not applied.** All new structural tables use a `pd_` namespace (zero collision with the 3 existing taxonomy families). Reuse: `product_models` (→ Primary Model), `product_media`, `product_translations`, `model_translations`, `product_market_prices`, `related_products`. Conventions: `uuid` PK, `tenant_id`, `created_at/updated_at`, RLS = **service-role-only** (mirrors the P0-C lockdown; anon denied; app reads via server APIs).

## Entity map
**Classification:** `pd_divisions → pd_categories → pd_subcategories → pd_product_types`
**Commercial:** `pd_families` (optional) → `product_models` (Primary Model) → `pd_skus`
**Facets:** `pd_facets` + `pd_facet_options` + `pd_facet_links` (type↔facet, role spec|facet|both) + `pd_facet_values` (scope family|model|sku)
**Compatibility:** `pd_compatibility` (source part/device → target level type|family|model|sku · type fits|requires|pairs|alt|supersedes|upgrades · mode attribute|explicit · exclusion · confidence)
**Parts/Devices:** `pd_spare_parts` · `pd_devices` + `pd_device_links`
**BOM:** `pd_bom_kits` + `pd_bom_items` + `pd_bom_assignments`
**Applications/Process:** `pd_application_groups → pd_applications` ⋈ `pd_operations` (`pd_application_operations`) · `pd_processes → pd_operations` ⋈ `pd_product_types` (`pd_operation_machine_map`)
**Coding:** `pd_code_registry` · `pd_code_segments` · `pd_reserved_tokens` *(Stage 1 — authored, not applied to prod)*
**Content:** reuse `product_media` · `pd_documents` · `*_translations`
**Read models (derived, trigger-maintained):** `pd_search_doc` · `pd_ai_doc`

## ERD (Mermaid)
```mermaid
erDiagram
  PD_DIVISIONS ||--o{ PD_CATEGORIES : contains
  PD_CATEGORIES ||--o{ PD_SUBCATEGORIES : contains
  PD_SUBCATEGORIES ||--o{ PD_PRODUCT_TYPES : defines
  PD_PRODUCT_TYPES ||--o{ PD_FAMILIES : groups
  PD_PRODUCT_TYPES ||--o{ PRODUCT_MODELS : types
  PD_FAMILIES ||--o{ PRODUCT_MODELS : series
  PRODUCT_MODELS ||--o{ PD_SKUS : variants
  PD_PRODUCT_TYPES ||--o{ PD_CODE_SEGMENTS : grammar
  PD_FACETS ||--o{ PD_FACET_OPTIONS : enumerates
  PD_PRODUCT_TYPES ||--o{ PD_FACET_LINKS : uses
  PD_FACETS ||--o{ PD_FACET_LINKS : bound_to
  PD_FACETS ||--o{ PD_FACET_VALUES : valued_by
  PRODUCT_MODELS ||--o{ PD_FACET_VALUES : scope_model
  PD_SKUS ||--o{ PD_FACET_VALUES : scope_sku
  PD_SPARE_PARTS ||--o{ PD_COMPATIBILITY : asserts
  PD_DEVICES ||--o{ PD_COMPATIBILITY : asserts
  PD_BOM_KITS ||--o{ PD_BOM_ITEMS : contains
  PD_BOM_KITS ||--o{ PD_BOM_ASSIGNMENTS : assigned
  PD_BOM_KITS ||--o| PD_BOM_KITS : inherits
  PD_APPLICATIONS ||--o{ PD_APPLICATION_OPERATIONS : bill
  PD_OPERATIONS ||--o{ PD_APPLICATION_OPERATIONS : used_in
  PD_PROCESSES ||--o{ PD_OPERATIONS : stages
  PD_OPERATIONS ||--o{ PD_OPERATION_MACHINE_MAP : needs
  PD_PRODUCT_TYPES ||--o{ PD_OPERATION_MACHINE_MAP : performs
  PRODUCT_MODELS ||--|| PD_SEARCH_DOC : projects
  PRODUCT_MODELS ||--|| PD_AI_DOC : projects
  PD_DIVISIONS { uuid id PK; uuid tenant_id; text code; text slug }
  PD_PRODUCT_TYPES { uuid id PK; uuid subcategory_id FK; text code_prefix; uuid template_id }
  PRODUCT_MODELS { uuid id PK; uuid product_type_id FK; uuid family_id FK; text primary_model }
  PD_SKUS { uuid id PK; uuid primary_model_id FK; text code; numeric cbm; text hs_code }
  PD_FACET_VALUES { uuid id PK; text scope; uuid entity_id; uuid facet_id FK; numeric value_num }
  PD_COMPATIBILITY { uuid id PK; text source_kind; uuid source_id; text target_level; text comp_type; text mode }
  PD_BOM_KITS { uuid id PK; text kit_type; int version; uuid parent_kit_id }
```

## Inheritance (resolution order)
`SKU value ► Primary Model value ► Product Family default ► Product Type default`. Logistics/cost/stock are **SKU-only** and never inherited downward from a model.

## Read models / projections
- `pd_search_doc` — one row per Primary Model: flattened facets (jsonb + GIN), `search_tsv` (per-locale), price band, primary media. Powers catalog filter/compare/search.
- `pd_ai_doc` — identity · technical (facets) · commercial · compatibility · relationships, retrieval-ready (feeds chunks/embeddings + graph).
- **Trigger-maintained projection tables** (not full-refresh matviews) for 100k+ scale; rebuilt incrementally on write of the owning entity.

## Migration mapping (additive, reversible)
`product_models → Primary Model` · spawn one default `pd_sku` per model (+ HO/CS where supported) · infer `product_type_id` from subcategory · create families only where ≥2 series models · backfill slug taxonomy → `pd_` FK taxonomy (dedupe XCL/XPRH/XSPA first) · migrate `specs`/`schema_specs`/PTE → `pd_facet_values`. Legacy retained read-only until projections + ERP read-paths verified.

> **Not applied.** Requires the validated production baseline + a Supabase branch (ask-first / paid) + prefix freeze before any DDL runs.
