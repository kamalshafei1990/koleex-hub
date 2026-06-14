# Product Coding Change Log

Authoritative, append-only log of every Source-of-Truth coding change (see `coding-change-governance.md`). **No coding change is complete without an entry here.**

## Entry format
```
### CL-NNNN · YYYY-MM-DD · <Change type>
- Approved by: <name>
- Change: <OLD> → <NEW>   (or: NEW token added / token retired)
- Reason: <why>
- Affected artifacts updated: <list of files>
- Conflict scan: <clean / issues found + resolution>
- Status: <Open / Applied-to-docs / Frozen / Implemented>
```

---

### CL-0001 · 2026-06-14 · Baseline registry established (pre-freeze)
- **Approved by:** — (pending Kamal review)
- **Change:** Initial Product Type registry captured for Garment Machinery (Division X). No prefixes frozen yet.
- **Reason:** Establish the authoritative starting point before Stage 2; align reference datasets.
- **State captured:** 87 Product Types — **38 Confirmed** (live KOLEEX codes), **36 Proposed** (new prefixes), **13 Requiring Kamal decision**; **12 prefix conflicts** flagged (XCL, XPRH, XSPA, XP↔XPC + 8 discovered).
- **Affected artifacts:** `product-types-master.md`, `product-type-approval-matrix.md`, `family-naming-standard.md`, `facet-dictionary-master.md`, `application-dictionary-master.md`, `operation-library-master.md`, `device-dictionary-master.md`, `compatibility-rulebook.md`, `sku-strategy.md`.
- **Conflict scan:** 12 unresolved conflicts recorded in the approval matrix §4 (this is the to-do, not a clean state).
- **Status:** **OPEN** — prefixes NOT frozen. Blocked on (a) Kamal sign-off of the 13 decisions + XP/XPC category call, and (b) production baseline validation (Stage 1.5).

### CL-0002 · 2026-06-14 · Visual Product Experience added to Source of Truth
- **Approved by:** Kamal (product directive: the Product Data system must be visual, icon-based, photo-based, card-based, easy for staff + customers — a core requirement, not a UI detail).
- **Change:** NEW source-of-truth document added — `architecture/visual-product-experience.md` — defining the visual-first principle, icon/photo systems, per-entity visual cards (Type / Family / Primary Model / SKU / Device / Spare Part / Facet), spec cards, compatibility & BOM visuals, comparison, AI / website / ERP-editor / quotation / catalog visuals, and a **Visual Presentation Metadata** vocabulary (icon_key, icon_style, image_role, hero_image, gallery_images, diagram_image, spec_card_priority, presentation_group, badge_style, comparison_display, ai_visual_hint, quotation_display_hint, website_display_hint).
- **Reason:** Lock the visual requirement into the SoT set so data stays structured/normalized while presentation is metadata-driven (never hardcoded per product), and so visuals become part of "done" for every new entity.
- **Governance:** `coding-change-governance.md` §7 added — any new Product Type / Facet / Device / Compatibility rule must define its Visual Presentation Metadata before approval; approval matrix gains a "visual metadata defined?" gate.
- **Affected artifacts updated:** `architecture/visual-product-experience.md` (new) · `architecture/README.md` · `architecture/architecture-freeze-v1.0.md` · `architecture/product-data-v2-schema.md` · `reference-data/facet-dictionary-master.md` · `reference-data/product-types-master.md` · `reference-data/device-dictionary-master.md` · `reference-data/compatibility-rulebook.md` · `reference-data/sku-strategy.md` · `reference-data/coding-change-governance.md` · this log.
- **Conflict scan:** clean — no Product Data V2 document describes the system as table-only or text-only (scan covered `table-only` / `text-only` / "flat table" / "text only"; the only "flat table" mention is the new doc itself, stating specs must NOT be a flat table).
- **Status:** **Applied-to-docs.** No schema/migration; no Stage 2 started. Implementation lands with the relevant V2 UI/projection stages, gated as usual.

> **Next entries** will be created when Kamal approves the prefix decisions (each becomes a CL-#### entry that freezes the affected prefixes and propagates per the governance SOP).
