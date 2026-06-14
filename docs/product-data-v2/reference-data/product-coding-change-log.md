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

### CL-0003 · 2026-06-14 · Lockstitch Master Specification Dictionary (golden template)
- **Approved by:** — (authored; net-new facet promotion pending Kamal sign-off)
- **Change:** NEW reference dataset — `dictionaries/lockstitch-master-spec-dictionary.md` — the first complete Master Specification Dictionary (Product Type XSL · Lockstitch) and the **official copy-template** for all future types. Defines the 7 knowledge dimensions (Technical · Commercial · Visual · Comparison · Compatibility · Application · AI) with full visual presentation metadata per field.
- **Net-new facets proposed (⊕, ~30):** `needle_size_range`, `needle_gauge`, `thread_type_support`, `thread_size_range`, `threading_path`, `feed_dog_rows`, `stitch_length_max`, `feed_adjust_method`, `reverse_feed`, `hook_type`, `presser_foot_lift_manual`, `presser_foot_lift_knee`, `lubrication_type`, `arm_clearance`, `motor_type`, `motor_power`, `recommended_speed`, `noise_level`, `auto_thread_trim`, `auto_backtack`, `auto_foot_lift`, `needle_positioner`, `thread_wiper`, `programmable_panel`, `pattern_memory`, `ai_thread_break_detect`, `seam_type_support`, `certification`, `attachment_mount`, `mount_type`, `cutout_type`, `suitability`, and the `ai_*` set (`ai_synonyms`, `ai_summary`, `ai_use_when`, `ai_not_for`, `ai_faq`). Plus `image_role` extensions (detail/application/spare_part/packing/video).
- **Reason:** start Product Knowledge construction (roadmap Phase B) with a golden template; the XSL spine (A2–A6) is inherited by all sewing types.
- **Conflict scan:** CLEAN — `XSL = Lockstitch` matches `product-types-master.md`; all reused facet keys exist in `facet-dictionary-master.md`; no table-only/text-only language. **One naming reconciliation flagged:** the registry's informal option labels `auto_trimmer` / `auto_foot_lifter` map to this dictionary's formal keys `auto_thread_trim` / `auto_foot_lift` — to be unified when the ⊕ facets are promoted.
- **Required sync before Stage 2:** promote the ⊕ facets into `facet-dictionary-master.md` (governance §3) with their own CL entry; reconcile the auto-function names. Not done in this pass (kept the deliverable focused on the template).
- **Status:** **Applied-to-docs.** No schema/migration; no Stage 2 started; production untouched.

### CL-0004 · 2026-06-14 · Lockstitch real-catalog extraction & gap analysis
- **Approved by:** — (evidence report; facet additions pending Kamal sign-off — the dictionary was NOT modified)
- **Change:** NEW analysis doc — `dictionaries/lockstitch-catalog-extraction-report.md`. Validated the Lockstitch Golden Template against **real supplier catalogs** (`~/Documents/Supplier Catalogs/`). Wave 1 = 12 catalogs read; 7 lockstitch (MAQI, Bote, Goldsew, Jaki, Durkopp Adler, Yongxing, FDK).
- **Findings:** template covers ~95% of mainstream single-needle lockstitch; **22 recommended new facets** (top: `needle_bar_stroke` seen in 5/7), **6 improvements** (richer `lubrication_type` enum, `arm_clearance` W×H + `max_sewing_thickness`, inch `needle_gauge`, ISO 301 class, expanded `needle_system` list, ball-bearing table option), a **CNC/template lockstitch sub-profile** (sewing_field_xy, pattern count/storage/format/scaling, RFID, controller_brand), application **fabric_weight_class** + vocab expansion, and **5 new visual roles** (stitch_sample, process_diagram, symbol_legend, parts_chart, code_builder).
- **Conflict scan:** n/a (no codes/prefixes changed; dictionary unmodified). Recommended additions to be applied via a future governed CL entry (promote to `facet-dictionary-master.md` + Golden Template).
- **Coverage note (no silent truncation):** ~40 supplier PDFs unread (Wave 2 available); spec vocabulary saturated within Wave 1.
- **Status:** **Analysis complete; additions PENDING approval.** No schema/migration; no Stage 2; production untouched; dictionary unchanged.

### CL-0005 · 2026-06-14 · Lockstitch Golden Template promoted to v1.1 (FROZEN)
- **Approved by:** Kamal (directive: "convert the findings into the official Source of Truth … promote all approved additions … this is a promotion phase").
- **Change:** Promoted the CL-0004 extraction findings into the official Product Knowledge System. `dictionaries/lockstitch-master-spec-dictionary.md` advanced **v1.0 → v1.1 and FROZEN** as the official copy-template for Overlock (XSO) and all future sewing types.
- **+22 new facets** (purely additive, real-catalog validated; defined in `facet-dictionary-master.md` §8): needle_bar_stroke, presser_foot_stroke, thread_take_up_stroke, fabric_weight_class, cylinder_diameter, cylinder_circumference, post_height, arm_length, max_sewing_thickness, side_cutter_edge_width, cloth_cutting_thickness, electronic_thread_clamp, piece_counter, bobbin_thread_counter, bobbin_thread_monitor, needle_thread_monitor, stitch_condensing, acceleration_time, productivity, sewing_field_xy, max_stitches_per_pattern, pattern_storage_count, pattern_file_format, pattern_scaling_range, template_recognition, controller_brand, air_consumption, mountable_head_compat, hook_model, hook_brand, table_mount_type.
- **6 improvements:** richer `lubrication_type` 6-value enum · `arm_clearance` W×H + new `max_sewing_thickness` · `needle_gauge` mm OR inch · `stitch_type` + ISO `301` class · `needle_system` list expanded (DP×17/DY×3/CP×5/TV×5/64/TQ×1/LW×6T/DV×57/7×23·25·30) · `table_mount_type` ball-bearing.
- **Field-tier categorization (new):** every promoted + existing field tagged into the **7 lockstitch tiers** — Core · Advanced · Heavy-Duty · Cylinder-Bed · Post-Bed · Long-Arm · CNC/Pattern-Sewing (dictionary §1). New A9 CNC/Pattern-Sewing facet group added.
- **Compatibility:** `compatibility-rulebook.md` §11 added — needle-system expansion, hook_model/brand, table_mount_type, mountable_head_compat, controller_brand, pattern_file_format, needle↔fabric AI rule.
- **Visual:** `architecture/visual-product-experience.md` §17 `image_role` extended with 5 roles — stitch_sample, process_diagram, symbol_legend, parts_chart, code_builder.
- **AI:** needle↔fabric mapping, process_diagram (operation→model), symbol_legend, fabric_weight_class `ai_use_when`/`ai_not_for`, controller/pattern-format service knowledge (dictionary §10).
- **Affected artifacts updated:** `dictionaries/lockstitch-master-spec-dictionary.md` (→ v1.1 frozen) · `facet-dictionary-master.md` (§8 + needle_system row) · `compatibility-rulebook.md` (§11) · `architecture/visual-product-experience.md` (§17) · this log.
- **Conflict scan:** **CLEAN.** Additive only — no facet removed/renamed; `XSL = Lockstitch` unchanged; all new facet keys are net-new (no collision with §1–§7); `needle_system`/`gauge`/`stitch_type` edits are superset-compatible (old values still valid); the CL-0003 naming reconciliation (auto_trimmer→auto_thread_trim) carried forward — formal keys used throughout. No table-only/text-only language introduced.
- **Status:** **Applied-to-docs · Lockstitch dictionary FROZEN at v1.1.** Documentation only — no schema/migration/RLS/Stage-2; production untouched. Facets are *promoted to SoT* but **not implemented** until the gated `pd_` stages.

### CL-0006 · 2026-06-14 · Complete Product Knowledge Architecture (the product object beyond specs)
- **Approved by:** Kamal (directive: "stop focusing only on specifications … define the COMPLETE PRODUCT KNOWLEDGE OBJECT … think about the complete life cycle of a product from supplier to customer to AI assistant").
- **Change:** NEW source-of-truth architecture doc — `architecture/product-knowledge-architecture.md`. Defines a product as a **58-domain knowledge object** (11 clusters) spanning the full lifecycle (supplier→sourcing→ERP→warehouse→quotation→website→catalog→customer→service→AI). Specifications (D05) are framed as **1 of 58 domains**.
- **Model:** three storage planes (structured `pd_` / content media / read-model projections); one inheritance spine (Division→Category→Subcategory→Product Type→Family→Model→SKU) with five linked cross-cutting entities (Supplier, Spare Part, Consumable/Device, Application, Operation) attached by typed edges — never copied per product.
- **Deliverables (9):** Architecture Report (why/who per domain) · Complete Product Object Structure (what attaches at each level) · Ownership Matrix (owner level + scope, with inherit/override marks) · Visibility Matrix (Web/ERP/AI/Quote/Catalog/Internal) · Visual Asset Matrix (image_role × surface) · AI Knowledge Matrix (7 assistant personas × domains) · Commercial Matrix (cost/price/margin/terms + privacy boundary) · Supplier Matrix (supplier-owned vs product-owned + binding) · Final Recommendation (incl. 3-wave build sequence).
- **Principles locked:** knowledge-complete (not spec-complete) = "done"; author at broadest true level, override only where permitted; visibility is an enforced field (D56) so cost/margin/negotiation structurally cannot leak to customer surfaces; visual-first per CL-0002; the `pd_ai_doc` (D54) is a generated, confidence-aware read-model, not a data source; the model is type-agnostic — clone structure (not values) to XSO/XSI/etc.
- **Affected artifacts updated:** `architecture/product-knowledge-architecture.md` (new) · `architecture/README.md` (document map) · this log.
- **Conflict scan:** **CLEAN.** No codes/prefixes/facets changed — this is an organizing architecture layer over existing SoT (spec dictionary, facet dictionary, compatibility rulebook, visual SoT). Consistent with the README layered model + governing principles; `XSL = Lockstitch` unchanged; reinforces (does not contradict) the visual-first + dictionary-governed + compatibility-by-edge principles. No table-only/text-only language.
- **Status:** **Applied-to-docs.** Documentation only — no schema/migration/RLS/code; no Stage 2 started; production untouched. Per-domain field design lands in the gated `pd_` stages (build sequence in Output 9).

### CL-0007 · 2026-06-15 · Product Knowledge Architecture V2.0 (the complete Knowledge Universe)
- **Approved by:** Kamal (directive: "We are building the complete KOLEEX Product Knowledge Universe … audit everything and produce Product Knowledge Architecture V2.0 … focus on EVERYTHING ELSE that a product should know").
- **Change:** NEW source-of-truth doc — `architecture/product-knowledge-architecture-v2.md`. Audits V1.0 (CL-0006, 58 domains) against the complete-universe requirement (18 consumer systems incl. dealers/distributors/end-users) and produces **V2.0**.
- **Result:** **58 → 69 domains (+3 cross-cutting layers = 72 knowledge elements).** Spine extended to **8 levels** (…→SKU→**Variant**). Target **13 locales**.
- **11 new domains:** D59 Control System · D60 Motor · D61 Firmware/OS · D62 Smart/IoT/Connectivity · D63 Box-Contents/Shipment-Manifest · D64 Merchandising-Relationships (alternative/upgrade/downgrade/successor/replacement/recommended/bundled/FBT/competitor) · D65 Risk-Register · D66 Customer-Targeting · D67 Channel & Partner (dealer/distributor tiers) · D68 Publishing & Generation (SEO/meta/slogan/catalog+brochure templates) · D69 Calibration & Service-Intervals.
- **3 cross-cutting layers (modify all domains):** X1 Multi-Language Fabric (en·zh-Hans·zh-Hant·ar·es·fr·pt·ru·tr·hi·vi·id·th) · X2 Knowledge-Graph Substrate (product-as-node, governed edge types; elevates V1.0 D58) · X3 AI Embedding & Retrieval (vector/RAG over every domain, graph-grounded, localized, visibility-filtered, confidence-flagged; complements V1.0 D54).
- **Extensions (no new domain):** D43 +SASO/GCC/regional · D47 +360/AR/3D/box/feature/control-panel/connectivity/calibration roles · D04 +formal NPI→EOL stage-machine + spare-parts-after-EOL commitment · D10–D12 +channel tiers + price/margin **history time-series** · D16–D19 +primary/secondary/backup supplier ranking + supplier docs/risk/capacity · D02 +Variant leaf · D56 visibility gains a **Partner (Dealer/Distributor)** surface.
- **Deliverables (10):** V2.0 architecture · complete universe (per-level attachment map) · updated Ownership/Visibility/AI/Visual matrices · Missing-Domain Report (by 8 audit lenses) · Recommended New Domains · Final Domain Count (58→69+3) · Final Recommendation (3-wave build).
- **Affected artifacts updated:** `architecture/product-knowledge-architecture-v2.md` (new) · `architecture/README.md` (document map) · this log.
- **Conflict scan:** **CLEAN.** Purely additive organizing layer over existing SoT — no codes/prefixes/facets changed; V1.0 (D01–D58) carries forward unchanged; `XSL = Lockstitch` intact; consistent with the README layered model + governing principles + visual-first (CL-0002); no table-only/text-only language (reaffirms visual-first + cards). D51 kept (regional content) with X1 as the field-level mechanic; D58 kept (edge catalog) with X2 as the substrate — no duplication, explicit role split.
- **Status:** **Applied-to-docs.** Documentation only — no schema/migration/RLS/UI/code; no Stage 2 started; production untouched. Per-domain field design lands in the gated `pd_` stages (build waves in Output 10).

> **Next entries** will be created when Kamal approves the prefix decisions (each becomes a CL-#### entry that freezes the affected prefixes and propagates per the governance SOP).
