# Product Knowledge Audit — Running Observations

> **Status:** collected DURING P0 #5 i18n (5a→5e). Not the audit itself — raw notes that feed the formal **Product Knowledge Audit** delivered AFTER 5e (per Kamal's directive: STOP CODING after 5e, then audit, before any P1/P2).
>
> **Lens for every note:** does this make the product feel like a **Knowledge Object / Visual Product** or a **DB row / table / CRUD form**? Tag each as `[DB-ish]` (feels like a database) or `[KO]` (feels like a Knowledge Object) + a P0/P1/P2 hunch.

## How to read the tags
- **[DB-ish]** — surfaces a "row in a table / CRUD field" feeling → candidate finding for the Visual Experience audit.
- **[KO]** — already reads as a Knowledge Object → strength to preserve.
- Severity hunch: **P0** must-fix before population · **P1** should · **P2** nice.

---

## 5a — ProductList (entry surface)

- **[DB-ish] P0** — The **List view** is a literal database grid: fixed columns `Product · Category · Brand · Models · Status` on a `md:grid grid-cols-[56px_1fr_140px_120px_100px_80px_80px]`. Reads as a spreadsheet of rows — the operator scans cells, not products.
- **[DB-ish] P0** — A product's whole identity in the list reduces to `model code → name → category → brand → N models → status`. There is **no completeness/health signal** (no "70% populated", no "missing specs/media"), even though PD V2 is fundamentally about how *complete* a knowledge object is. A fully-authored product is indistinguishable from a stub.
- **[KO] P2** — The grid (card) view already leans Knowledge-Object: 4:3 product image, code-as-title with descriptive name as subtitle, featured/level/visibility badges, category→subcategory chip line. The stronger surface; worth keeping as the default.
- **[DB-ish] P1** — `Status` is a raw enum pill (`draft/active/archived`) straight off the DB column. It's publishing lifecycle, not knowledge maturity — nothing says whether the product is *known/ready*, only whether the row is published.
- **[DB-ish] P1** — **No relationship hints anywhere.** A product shows only its own category/brand/model count — never siblings (same subcategory), variants, related models, or "part of family X". The taxonomy (division→category→subcategory) is used purely as *filters*, never as *connective tissue* between objects.
- **[KO] P2** — The **two-level catalog grouping** (Category banner → Subcategory sub-section → cards) is a genuine knowledge-structure cue — it frames products inside the taxonomy rather than as a flat result set. The list view discards this hierarchy entirely; extending it there would help.
- **[DB-ish] P2** — The amber `"Needs name"` pill (grid only, internal) is the *only* data-quality affordance on the whole surface, and it's ad-hoc/single-field — a sign the richer completeness model (P0 above) has no home yet.

## 5b — ProductForm wizard

### Knowledge-Object vs DB-editor reading (per-cluster)
- **[DB-ish] P0** — The wizard is a **7/8-step linear field-collection form** (Classify → Hero → Description → [Machine Specs] → Models → Technical → Media → Review). The mental model is "fill every step's fields," not "assemble a knowledge object." Completeness only surfaces meaningfully on the **last** step (Review), so the operator builds blind and discovers gaps at the end rather than seeing the object take shape as they go.
- **[DB-ish] P0** — **No live visual product preview while editing.** The customer-facing render (`ProductPreview` + the "Live preview" hero card) exists **only inside the Review step**. On Hero/Specs/Media the operator never sees the object they're authoring — they edit DB fields in the dark and must reach the final step to see the result. A persistent side-by-side preview would convert the form into a true "object editor."
- **[KO] P1** — The **Hero step is the strongest KO surface**: image + name + tagline + KOLEEX primary-model code (with live uniqueness + approve/lock workflow) + status/featured/visibility/level pills, all on one cinematic card. It reads as "the product's identity," not a row of inputs. Worth treating as the template for the other steps.
- **[KO] P1** — The **Primary-Model code editor** (prefix chip + editable code + auto-suggest + Reset + Approve/Lock + live "code in use by X" check) genuinely feels like minting a governed identity, not typing a string. This is the most Knowledge-Object-like control in the whole wizard.
- **[DB-ish] P1** — **Specs are still schema/key-value-ish.** The structured `SchemaSpecsSection` is better than the old freeform table, but a sewing product also carries a parallel **legacy `SewingMachineSection`** ("Additional / Legacy Specs") — two spec homes side by side is ambiguity, and neither is presented as "knowledge about how the machine performs," just fields to populate.
- **[DB-ish] P1** — **Models / Market Prices / Translations / Related** are flat collapsible `Section` stacks of editors. Relationships (Related Products, variants) are managed as **link lists**, never visualized as a graph or "this product sits in family X next to siblings Y/Z." The taxonomy + related links are data rows, not connective tissue.
- **[DB-ish] P2** — **Fulfillment / Purchase Options / Stock Profile** on the Technical step are pure operational DB fields (MOQ, lead time, head-only/complete-set toggles, inventory) interleaved with the product's technical identity — reinforces the "ERP record" feel over "product knowledge."
- **[KO] P2** — The **Review step's grouped cards** (Identity & classification · Commercial & primary model · Content & catalog) plus the Apple-style live preview and the Product Intelligence Readiness panel are the moment the wizard finally reads as a knowledge object. Pulling this richness **earlier/throughout** (not just at the end) is the single highest-leverage KO improvement.

### Completeness-Engine coverage (for post-5e audit)
Two **separate, non-reconciled** completeness meters live on the Review step:
1. **Legacy "Readiness" meter** (`essentialFilled / essentialTotal`, inline in this file): a hand-counted list — product name, division, category, subcategory, (machine kind if sewing), brand, excerpt, highlights, primary `global_price`, main image, and for sewing: max_sewing_speed + needle_system + motor_type. Total = 10 (non-sewing) / 13 (sewing). **Covers:** Hero Image (main only), Specifications (3 sewing fields only), basic commercial. **Misses entirely:** Gallery, Manual, Video, Applications, Compatibility, Related, Alternative.
2. **Schema-driven "Product Intelligence Readiness"** (`computeReadiness`, `src/lib/product-schema/readiness.ts`): 7 weighted dimensions — **data**(25, required schema fields) · **commercial**(20, 8 fixed fields) · **technical**(15, required fields in electrical/physical/compliance/customs/technical groups) · **media**(15) · **website**(10, publicVisible+websiteVisible fields) · **ai**(10, aiReadable fields + aiReadable knowledge blocks) · **brochure**(5, brochureVisible fields + image/gallery slots).
   - **Media dimension covers:** Hero Image (`main≥1`), Gallery (`≥3`), Packing (`≥1`), **Manual** (`≥1`), **Video** (`≥1`).
   - **vs target set (Hero Image · Gallery · Manual · Video · Applications · Compatibility · Related · Alternative · Specifications):** Hero/Gallery/Manual/Video/Specifications **covered**; **Applications · Compatibility · Related · Alternative are NOT first-class completeness inputs** — they only count indirectly *if* the resolved schema happens to model them as fields or as `aiReadable` knowledge blocks. There is no dimension that explicitly tracks relationship-completeness (related/alternative/compatibility) or applications coverage. The completeness engine is **field/media-centric, not relationship/knowledge-centric** — a gap for the Completeness-Engine redesign.
   - **Two meters disagree** (different inputs, weights, and even media thresholds — legacy ignores manual/video, schema requires gallery≥3 vs brochure gallery≥4). P1: collapse to one source of truth.

## 5c — MediaSection

### Knowledge-Object vs file-CRUD reading
- **[KO] P1** — The media step is genuinely **role-aware**, not a flat dropzone. It renders **7 first-class, typed slots** — each with its own icon, accent color, accept-mask, size limit, MIME guard, and `suggestedCount` — so the operator is prompted to assemble a *complete visual story* (main → gallery → packing → labels → manual → AR/3D → video), not just "attach files." Most KO-shaped of the file surfaces.
- **[KO] P1** — **Thumbnails, not filenames.** Images render as real cover-cropped previews, videos get a client-captured first-frame JPEG thumbnail (canvas seek), and a click opens a full-bleed preview modal. The operator sees the actual asset — reinforces "this is the product's visual identity" over "this is a row with a file path."
- **[KO] P2** — **Ordering is a first-class authoring act**: per-slot move-earlier/move-later with a live `#1/#2…` order chip, kept in sync with the persisted `order` field so the public page mirrors the operator's arrangement. Gallery/packing read as a *curated sequence*, not an unordered bag of files.
- **[DB-ish] P1** — But slots are still **siloed per media-type CRUD widgets** with no cross-slot sense of "is this product's visual story complete?" The only completeness cue is the per-slot amber `suggestedCount` nudge ("still need X"); there is **no aggregate media-readiness signal** in this component (it lives only on the Review step's separate meters — see 5b). On the Media step the operator can't see how the whole visual narrative scores.
- **[DB-ish] P2** — **Alt text is the only knowledge metadata** captured per asset (good for SEO/a11y), but there's no caption, no "what this shows" semantic role, no link to a spec/variant/model — each tile is an isolated file + alt string, not a knowledge node connected to the rest of the product.
- **[DB-ish] P2** — `suggestedCount` nudges (main=1, gallery=4, packing=2, manual=1, video=1; labels/AR optional) are **hard-coded in `MEDIA_TYPES`** and *disagree with the Review meters' thresholds* (schema media wants gallery≥3, brochure≥4) — a third, non-reconciled set of media-completeness numbers. Feeds the "collapse to one completeness source of truth" finding.

### First-class media ROLE slots (for the Completeness-Engine section)
Typed, role-aware slots, each with its own size/MIME/suggested-count policy:
1. **main_image** (Main Image · single · suggested 1) — hero/list primary photo.
2. **gallery** (Gallery · multi · suggested 4) — angles/details.
3. **packing_photo** (Packing Photos · multi · suggested 2) — crate/box/packaging dims.
4. **label** (Labels & Logos · multi · suggested 0/optional) — brand/origin/cert stickers.
5. **manual** (Manual / Datasheet · multi · suggested 1) — PDF/DOC datasheets.
6. **ar_3d** (AR / 3D View · multi · suggested 0/optional) — GLB/GLTF/USDZ.
7. **video** (Videos · multi · suggested 1) — demo/operation videos.

Note: the `ProductMediaType` union also includes **`logo_detail`**, which has **no `MEDIA_TYPES` slot** here — a declared role with no authoring surface (silent gap; the i18n type→key map falls back to English if it's ever rendered).

## 5d — TemplateView + ProductPreview
_pending_

## 5e — RTL pass
_pending_

---

## Cross-cutting candidates (Completeness · Relationships · Naming · Visual)
_pending — populated as evidence appears across surfaces_
