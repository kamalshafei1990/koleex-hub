# Product Data Model — Evolution Proposal (current → target)

**Status:** 🟡 PROPOSAL — agreed in principle (Kamal, 2026-06-17). **Nothing implemented.** The Products rebuild is FROZEN and all of this is schema/prod-DB territory, so it stays a design artifact until Stage 1.5 unfreezes (`stage-1-5-baseline-audit.md`) and each change clears `reference-data/coding-change-governance.md`.

**Author:** Claude (Opus 4.8) · **Date:** 2026-06-17
**Scope:** the per-product data model in the Product Data app (the ~80 user-fillable fields across 8 form tabs).

---

## 1. Where we are
Data lives in **3 layers**: ① fixed columns on `products`, ② per-variant rows in `product_models`, ③ a dynamic per-type **schema** (`schema_specs` / `schema_knowledge` JSON). ~80 user-fillable fields across 8 tabs (Classification · Identity · Description · Specs · Models & Variants · Logistics · Media · Knowledge + Publish).

**Strengths to keep:** B2B commercial depth (head-only vs complete-set pricing, cost vs global, CBM, container qty, MOQ, lead time); the dynamic per-type schema backbone; KOLEEX identity/coding (`primary_model`).

**Core problem:** the *fixed spec columns are shaped around an electric sewing machine* and misfit the other categories you actually sell (cutting tables, CAD plotters, heat presses, motors, trolleys). Plus product↔model field duplication and a few missing groups.

---

## 2. Reorganize (structural — do before adding fields)

| # | Change | Current | Target | Rationale |
|--:|--------|---------|--------|-----------|
| **R1** | **Migrate type-specific spec columns into the per-type schema** | voltage, frequency_hz, phase, plug_types, watt, motor_power_w, power_consumption_w, oil_mist_filter, pneumatic_supply (+ legacy `specs`) are fixed columns on every product | These become **attributes inside the type's schema** (`schema_specs`); each type shows only what's relevant | Aligns with the FROZEN North Star (Type + Attributes, no duplication). Fixes "empty sewing columns on a plotter/trolley" and unlocks per-type performance fields (R-A10) for free |
| **R2** | **Resolve product↔model field duplication** | MOQ, lead_time, weight, supports_head_only/complete_set exist on **both** `products` and `product_models` | **Product = default, Model = override**, shown explicitly in the form | Removes "which value wins?" ambiguity & data drift |
| **R3** | **One schema-driven Specs section** | Specs tab mixes fixed columns + dynamic schema (two editing paradigms) | Single schema-rendered Specs per type | Consistency; the FieldRenderer already exists (PTE) |
| **R4** | **Supplier as a relation, not text** | `product_models.supplier` is free text | `supplier_id` → Suppliers app record | You already have a Suppliers app; factory / reliability / lead-time should flow from the supplier record |
| **R5** | **Centralize commercial/pricing** | Pricing buried in model rows | A dedicated Commercial/Pricing view over the models | Manage pricing & policy centrally (ties to Commercial Policy) |

**R1 field disposition (concrete):**
- **Stay universal (fixed columns):** product_name, slug, division/category/subcategory, family, brand, level, tags, excerpt, highlights, description, country_of_origin, warranty, hs_code, machine_weight_kg, machine_dimensions, ce_certified, rohs_compliant, status, visible, featured.
- **Move to per-type schema (type attributes):** voltage, frequency_hz, phase, plug_types, watt, motor_power_w, power_consumption_w, ip_rating, operating_temp, oil_mist_filter, pneumatic_supply, colors, legacy `specs`, + all current `schema_specs` axes (bed/needle/thread/gauge/stitch/hook/feed/drive/speed/controller/motor…).
- **Stay at model level:** sku, barcode, prices, weights, cbm, packing, container qty, moq/lead-time (as overrides).

---

## 3. Add (missing field groups)

| # | Add | Notes |
|--:|-----|-------|
| **A1** | **Currency + price tiers** | No currency on prices today; no customer-level pricing — the Commercial Policy already defines levels/margins/discounts. Add `currency`, tiered/level prices, optional RRP/MAP, FX source/date |
| **A2** | **Applications / use-cases** | Garment / material / operation the machine is for — only generic `tags` today |
| **A3** | **Compatibility & consumables** | Needles, folders, parts, attachments that fit — designed in `compatibility-rulebook.md`, not yet in the form |
| **A4** | **Manufacturer vs Brand** | `brand` only — add manufacturer / OEM vs own-brand distinction |
| **A5** | **Lifecycle status** | Only draft/active/archived — add new / discontinued / **replaced-by** |
| **A6** | **Certification detail** | Only CE/RoHS booleans — add cert numbers + uploaded cert docs |
| **A7** | **Energy / efficiency** | Servo energy class etc. — a real selling point |
| **A8** | **SEO meta** | meta title/description for public product pages |
| **A9** | **Richer media roles** | Add line/dimension drawings, stitch sample, brochure (vs manual), cert images (KB work already designed these roles) |
| **A10** | **Performance / capacity** | Throughput, cutting height, working area, press force, etc. — **comes automatically once R1 is done** (per-type schema) |

---

## 4. Target tab structure (proposed)
1. **Classification** — division/category/subcategory/type/family *(unchanged)*
2. **Identity** — name, brand, manufacturer (A4), code, tagline, highlights, tags, SEO (A8)
3. **Description**
4. **Specifications** — 100% schema-driven per type (R1, R3) incl. performance (A10), energy (A7)
5. **Applications & Compatibility** *(new)* — A2 + A3
6. **Commercial** *(new split)* — currency + tiered pricing (A1), per-model prices (R5)
7. **Models & Variants** — variant rows, supplier *relation* (R4)
8. **Logistics** — product defaults + model overrides (R2)
9. **Media** — richer roles (A9)
10. **Knowledge** — blocks + FAQ *(unchanged)*
11. **Certifications** *(new)* — A6
12. **Publish** — lifecycle status (A5), visibility

---

## 5. Sequencing
1. **R1** (keystone — type-attribute migration) → unlocks A10, fixes multi-category fit.
2. **R2 + R4** (de-dup + supplier relation) — data integrity.
3. **A1 / R5** (currency + pricing tiers).
4. **A2 + A3** (applications + compatibility).
5. Remaining additive (A4–A9).

---

## 6. Governance / gating
- Everything here is **schema + prod-DB** → blocked behind Stage 1.5 + `coding-change-governance.md`.
- R1 interacts with the coding system (type attributes) — coordinate with the `sewing-attribute-dictionary` (CL-0011) and facet-dictionary.
- No migration, API, UI, or data change is made from this doc; it is the agreed target to implement when unfrozen.

## 7. Open decisions for Kamal
1. Confirm **R1 disposition** (which columns stay universal vs move to schema) — §2 list.
2. **A1 pricing**: how many tiers/levels, and does it mirror the Commercial Policy levels exactly?
3. **R2 rule**: product-default + model-override — agreed?
4. New tabs (Applications & Compatibility, Commercial, Certifications) — accept the 12-tab target, or keep 8 and nest?
