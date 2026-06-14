# Product Data V2 — Visual Product Experience (Source of Truth)

**Status: ACTIVE source-of-truth requirement.** Design only — **not applied** (no schema/migrations). Aligns with `architecture-freeze-v1.0.md`, `product-data-v2-schema.md`, and the reference datasets. Changes follow `../reference-data/coding-change-governance.md`.

> **Why this document exists.** Kamal's product goal was never "structured data" alone. The final Product Data system must be **visual, icon-based, photo-based, card-based, and easy to use for both staff and customers**. This is a **core requirement of Product Data V2, not a UI detail.** A Product Type, Model, SKU, Device, Spare Part, or Facet is not "done" until it can be *presented* — not just stored.

---

## 1. Visual-first principle

Every entity in Product Data V2 is designed to be **rendered**, not just queried. Structured, normalized data is the foundation; **visual presentation is a first-class, metadata-driven layer on top of it.** Staff (ERP admin, quotation builder) and customers (website, catalog, AI answers) should always be able to *see* a product — icon, photo, spec card, diagram, comparison — without a developer hardcoding it.

Three rules that follow from this principle (expanded in §18):
1. **Data stays structured and normalized** — visuals never denormalize or duplicate the truth.
2. **Presentation is driven by metadata** (§17), resolved through the read-model projections (`pd_search_doc`, `pd_ai_doc`), never invented at the call site.
3. **The UI does not hardcode visuals per product** — no per-SKU `if` branches; the renderer reads metadata.

Brand: visuals follow the KOLEEX monochrome-first guideline — **line/outline icons, black/white/gray surfaces, real product photography**; functional status color only (success/warning/error). See the design-system source of truth; this document defines *what* visual data exists, not the palette.

---

## 2. Icon system

- Every **Product Type**, **Family**, **Device**, **Spare Part class**, and **Facet** carries an `icon_key` (a stable token resolving to a Visual Library asset) and an optional `icon_style` (`line` | `solid` | `duotone` — default `line`, per brand).
- Icons resolve through the existing **Visual Library / classification icon registry** (the `koleex_classification_types` icon system already in the app) — Product Data V2 references those assets by key; it does not embed SVG.
- Icons are the **fallback identity** when no photo exists, and the **inline marker** in dense lists (quotation rows, comparison headers, nav).
- One icon_key per entity; never hardcode an icon per product instance.

## 3. Product photo system

- Photos live in the reused **`product_media`** store (see schema doc), each row tagged with an **`image_role`** (§17): `hero`, `gallery`, `diagram`, `thumbnail`, `swatch`, `badge`, `dimension`, `in_use`.
- **Resolution order** mirrors spec inheritance: SKU photo ► Primary Model photo ► Family photo ► Product Type placeholder ► icon fallback. A SKU with no photo shows its Model's; a Model with none shows the Type's; nothing ever renders "blank."
- Photos attach at **SKU, Primary Model, Family, Product Type, Device, and Spare Part** levels (§18.4).
- Trilingual alt text via `*_translations`; CDN-served; lazy-loaded.

## 4. Product Type visual identity

Each Product Type defines a reusable **visual identity** so every Model under it inherits a consistent look:
- `icon_key` + `icon_style` (the type's glyph — e.g. lockstitch, overlock).
- A **silhouette/diagram** placeholder (`diagram_image`) used when a Model lacks its own.
- `presentation_group` defaults (which spec groups show first), inherited by Models unless overridden.
- A type-level **badge vocabulary** (`badge_style`) — e.g. "Automation", "Heavy-duty" — drawn from facets.

## 5. Primary Model visual card

The **Primary Model** is the customer-facing unit, so it owns the richest card:
- `hero_image` (primary), `gallery_images` (ordered set), optional `diagram_image`.
- Identity strip: KOLEEX code + Type icon + Family badge.
- **Spec cards** (§8) ordered by `spec_card_priority`, grouped by `presentation_group`.
- Marketing story (Family-level), key facets surfaced as glyph stats, media filmstrip.
- Drives the website product page (§13) and the quotation selector preview (§15).

## 6. SKU visual configuration card

The **SKU** is the operational/configured variant, so its card is **configuration-oriented**:
- Inherits the Model's hero/gallery; may add SKU-specific `swatch`/`image_role` photos (voltage, plug, color).
- Shows the **resolved configuration** (facets that differ from the Model) as labeled chips.
- Logistics block (weight/CBM/packing/HS) — SKU-only, never inherited downward.
- `quotation_display_hint` (§17) controls how the SKU renders inside a quote line.

## 7. Facet presentation hints

Facets are not just spec rows — each facet defines **how it should be shown**:
- `presentation_group` (which spec card it belongs to: Performance / Power / Dimensions / Automation …).
- `spec_card_priority` (sort weight within its group).
- A display style hint: `chip` | `meter` | `boolean-icon` | `value-unit` | `swatch` | `hidden` (used by spec cards, comparison, and AI).
- `comparison_display` (§17) — whether/how the facet appears in compare tables (e.g. highlight-on-difference).
- Optional per-option `icon_key` for enumerated facets (e.g. needle-system glyphs).

## 8. Spec cards

Specs render as **grouped visual cards**, never one flat table:
- Facets cluster into cards by `presentation_group`; ordered by `spec_card_priority`.
- Each spec uses its facet's display style (meter, boolean-icon with check/cross, value+unit, swatch).
- Cards collapse/expand; the highest-priority group is open by default.
- This is the canonical "Product Intelligence" presentation already prototyped in the app's `ProductPreview`.

## 9. Compatibility visuals

The compatibility engine's output is **shown visually**, not as raw rows:
- A "Fits / Requires / Pairs / Alternative / Supersedes" relationship map rendered as **linked cards with the partner entity's icon + photo**.
- Confidence shown as a calm indicator (not loud color); exclusions clearly marked.
- Bidirectional: from a part, show machines it fits; from a machine, show compatible parts/devices.
- Each compatibility edge can carry a `presentation_group` so the resolver's output lands in the right section of the Model card.

## 10. BOM / spare-parts visuals

- BOM kits (device/spare/consumable/maintenance/critical/service/warranty) render as **visual kit cards**: kit icon, member thumbnails, quantities.
- Spare parts use their `icon_key` + photo; an **exploded-diagram** image (`diagram_image`) can map callout numbers to parts.
- "What's in the box" / "Recommended spares" / "Consumables" are visual lists, each row icon+photo+code.

## 11. Product comparison visuals

- Side-by-side **comparison cards** (not a wall of text): hero thumbnail + icon header per Model.
- Facets render per their `comparison_display` hint; **differences are highlighted** (diff-aware), matching specs aligned by `presentation_group`/`spec_card_priority`.
- Works for Models within a Type and across compatible alternatives surfaced by the compatibility engine.

## 12. AI answer visuals

- The AI layer (RAG + knowledge graph) returns **structured visual answers**, not just prose: product cards, spec snippets, compatibility chips, comparison mini-tables.
- `ai_visual_hint` (§17) tells the AI/answer renderer which visual to attach to a given entity (card | spec-card | compatibility-map | diagram | gallery).
- The `pd_ai_doc` projection carries the icon_key/hero_image/diagram references so answers are renderable without extra lookups. AI never invents specs **or** visuals — it references existing metadata only.

## 13. Website product page visuals

- Customer-facing page = hero gallery + identity strip + grouped spec cards + compatibility + recommended spares + downloads.
- `website_display_hint` (§17) controls module order/visibility per Type or Model (e.g. lead with automation workflow vs. with dimensions).
- Schema-driven (the existing `/products/preview/[slug]` + `ProductPreview` pattern), so a new Model is presentable the moment its metadata exists.

## 14. ERP admin product editor visuals

- Staff editor is **visual too**: image-role upload zones (hero/gallery/diagram), icon picker (Visual Library), live spec-card preview, presentation-group ordering.
- Editors **set metadata, not layout** — the same metadata drives website/quote/AI, so admins get WYSIWYG without bespoke code.
- Missing-visual indicators (e.g. "no hero image", "facet has no presentation_group") guide completeness before approval (§19).

## 15. Quotation product selector visuals

- Product/SKU picker shows **icon + thumbnail + code + key facet chips** per row (not code-only), so sales pick by sight.
- Selected line renders per `quotation_display_hint` (compact thumb vs. spec-rich vs. text-only-on-request).
- Feeds the existing quotation A4 preview's picture column; the SKU's resolved photo flows straight into the quote.

## 16. Catalog / PDF / brochure visuals

- Catalogs/brochures generate from the **same metadata**: hero per Model, spec cards flattened to print, diagrams, icon-led section dividers.
- `image_role=diagram` and print-priority specs ensure the PDF is visual and consistent with the website.
- One source → website, quote, catalog: no separately maintained brochure data.

---

## 17. Visual Presentation Metadata

Product Data V2 must support a **visual presentation metadata layer** alongside the structured data. These are **design-level field names** (not applied DDL); they attach to the relevant `pd_` entities and/or the read-model projections (`pd_search_doc`, `pd_ai_doc`) and `product_media`.

| Metadata | Attaches to | Purpose |
|---|---|---|
| `icon_key` | Product Type, Family, Model, SKU, Device, Spare Part, Facet (+ facet options) | Stable token → Visual Library icon asset. Identity + fallback. |
| `icon_style` | same as `icon_key` | `line` \| `solid` \| `duotone` (default `line`, per brand). |
| `image_role` | `product_media` rows | `hero` \| `gallery` \| `diagram` \| `thumbnail` \| `swatch` \| `badge` \| `dimension` \| `in_use`. |
| `hero_image` | Model / SKU / Type (resolved) | The primary image reference (a `product_media` hero row). |
| `gallery_images` | Model / SKU | Ordered set of gallery image references. |
| `diagram_image` | Type / Model / Spare Part / BOM kit | Exploded view / line diagram reference. |
| `spec_card_priority` | Facet (per Type) | Sort weight of a spec within its group. |
| `presentation_group` | Facet, compatibility edge, Type defaults | Which spec card / section the item belongs to. |
| `badge_style` | Type / Model / Facet-derived | Named badge vocabulary (e.g. "Automation", "Heavy-duty"). |
| `comparison_display` | Facet | If/how the facet shows in compare tables (e.g. `highlight-diff` \| `always` \| `hidden`). |
| `ai_visual_hint` | Type / Model / Facet | Which visual the AI answer attaches (card \| spec-card \| compatibility-map \| diagram \| gallery). |
| `quotation_display_hint` | Model / SKU | How the item renders in a quote line (compact \| spec-rich \| text-only). |
| `website_display_hint` | Type / Model | Module order/visibility on the public product page. |

**Resolution:** visual metadata follows the same inheritance spine as specs — `SKU ► Primary Model ► Family ► Product Type` — with `icon_key`/photos falling back upward and the projections caching the resolved result for fast, lookup-free rendering.

---

## 18. Clarifications (non-negotiable)

1. **Data remains structured and normalized.** Visual metadata is additive; it never denormalizes facts or becomes a second source of truth for specs/compatibility/BOM.
2. **Visual presentation is driven by metadata.** Renderers (website, ERP editor, quotation, AI, catalog) read the metadata + projections; they do not embed product-specific layout.
3. **The UI must not hardcode visuals per product manually.** No per-Model/per-SKU special-case rendering code. A new product becomes presentable purely by populating its metadata.
4. **Icons and photos attach where relevant** to: **Product Type, Family, Primary Model, SKU, Device, Spare Part, and Facet** (and facet options). Each level can supply its own; absent values resolve upward (§3, §17).

---

## 19. Governance — visuals are part of "done"

Per `../reference-data/coding-change-governance.md`, the Source-of-Truth set now includes visual presentation. Therefore:

- **Any new Product Type, Facet, Device, or Compatibility rule must define its visual presentation metadata before approval.** Minimum bar:
  - **Product Type:** `icon_key` (+ `icon_style`), a default `presentation_group` ordering, and a diagram/placeholder plan.
  - **Facet:** `presentation_group`, `spec_card_priority`, a display style, and `comparison_display`; `icon_key` for enumerated options where it aids recognition.
  - **Device / Spare Part:** `icon_key` and an `image_role` plan (photo and/or diagram callout).
  - **Compatibility rule:** the `presentation_group`/section its result should render in.
- The **approval matrix** (`product-type-approval-matrix.md`) gains a "visual metadata defined?" gate; an entry is not import-ready until it passes.
- Every such change still requires the full SoT loop (update affected docs → approval matrix → change-log entry → conflict scan), now including this document.

---

## 20. Relationship to the rest of the SoT set

- **Identity & ownership:** `architecture-freeze-v1.0.md` (visuals inherit along the same spine).
- **Where metadata lives:** `product-data-v2-schema.md` (`product_media`, `pd_facets`, projections `pd_search_doc`/`pd_ai_doc`).
- **What to present:** the reference datasets (`product-types-master`, `facet-dictionary-master`, `device-dictionary-master`, `compatibility-rulebook`, `sku-strategy`) — each now references this document.
- **How changes are governed:** `coding-change-governance.md` + `product-coding-change-log.md`.

> **Not applied.** This defines the visual requirement and its metadata vocabulary. Implementation lands with the relevant Product Data V2 stages (UI/projection stages), gated like everything else on the production baseline + stage approvals. **No Stage 2 work is started by this document.**
