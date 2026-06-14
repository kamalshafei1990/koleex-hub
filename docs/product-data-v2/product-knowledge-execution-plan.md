# Product Knowledge Execution Plan

**Role model:** this agent = **executor** (analyze→decide→implement→document→commit→push→PR→merge autonomously when safe); ChatGPT = architect reviewer; Kamal = sign-off only on hard gates. **Target:** a complete **Product Knowledge Platform** (not an ERP) powering Website · Products · Product Data · AI · Quotation · Catalog/Brochure generators · future Spare-Parts/Service/Factory-Builder/Partner apps. **Visual-first** is a first-class constraint. **Documentation only** this phase — no product population, no codes, no SKUs, no schema (blocked by prefix freeze, CL-0001).

**Living roadmap.** Updated as work lands. Change-log: **CL-0011** (this plan + the keystone attribute dictionary).

---

## 1. Current Status
| Layer | State | Evidence |
|---|---|---|
| **Knowledge Architecture** | ✅ **FROZEN V3.0** — 4 planes · 86 domains · 3 cross-cutting layers · graph · federation · AI · visual · intelligence | CL-0006/07/08/09 |
| **Lockstitch spec dictionary** | ✅ **FROZEN v1.1** (~80 facets, 7 tiers) — the golden template | CL-0005 |
| **Facet dictionary** | ✅ universal + machine + part + §8 promoted facets | facet-dictionary-master.md |
| **Compatibility rulebook** | ✅ rules + §11 sewing metadata (hook/controller/mountable-head) | compatibility-rulebook.md |
| **Visual Product Experience** | ✅ SoT + 13 `image_role`s + visual-metadata vocabulary | CL-0002/05 |
| **Cross-app federation** | ✅ owner of every domain (reference-don't-duplicate; OWN/REF/PRJ/SNAP) | CL-0008 |
| **Taxonomy (types/kinds/attributes)** | ⚠️ **CORRECTION PENDING SIGN-OFF** — two-axis model recommended; do-not-freeze-as-is | CL-0010 |
| **Identity / codes / prefixes** | 🔴 **BLOCKED** — 13 decisions + 12 conflicts + baseline open | CL-0001 |
| **Product population** | ⛔ **NOT STARTED (by directive)** — waits on prefix freeze | — |

**Distinction that resolves the apparent conflict:** the **architecture** (domains/planes) is frozen and untouched. The **taxonomy** (how sewing machines map to types vs attributes vs kinds) is a separate layer still being corrected. This plan works inside the frozen architecture and builds toward the corrected taxonomy.

## 2. Remaining Gaps
1. **No shared Attribute/Config-Axis Dictionary** → bed/feed/needle/duty/motor/automation are triplicated (subcategory × kind × axis). *(Closed this turn — see §10.)*
2. **Only 1 of ~10 type dictionaries exists** (Lockstitch). Overlock/Coverstitch/Chainstitch (audit-confirmed types) not yet built.
3. **Machine Kinds are 105 hand-maintained nodes**, not derived presets → duplication.
4. **No per-type compatibility maps** (rulebook exists; needle/part/device maps per type don't).
5. **Application & Operation libraries** referenced but not built out per type.
6. **Multi-language naming model** (official/marketing/short/SEO × 13 langs) defined in architecture, no concrete standard doc.
7. **Visual value-icon registry** (icons for attribute *values*, not just types) not enumerated.
8. **Newly approved domains** (box-contents, alt-products, reviews, control-system, motor, firmware/OS) defined in V2.0/V3.0 but no field-level standard doc.

## 3. Dictionary Build Order
1. ✅ **Shared Sewing Attribute & Configuration-Axis Dictionary** — *DONE THIS TURN* (keystone; unblocks 2–6).
2. **Overlock (XSO) Master Spec Dictionary** — clone Lockstitch v1.1 (audit-confirmed type; unblocked).
3. **Coverstitch (XSI→rename) + Chainstitch (XSC) dictionaries** — clone pattern (confirmed types).
4. **Application Library** (what each type makes) + **Operation Library** (sewing operations) — attribute-based, unblocked.
5. **Visual value-icon registry** + per-domain visual-metadata standard.
6. **Newly-approved-domain field standards** (box-contents, control-system, motor, firmware/OS, alt-products, reviews) — design only.
7. ⏸ **Promoted-type dictionaries** (Buttonhole/Bartack/Button-Attach/Blindstitch/Zigzag/CNC) — draft content now, but soft-gated on taxonomy sign-off.

## 4. Machine Kind Build Order
1. ✅ **Kind-as-preset model** (Kind = Type × attribute-values) — established in the attribute dictionary this turn.
2. **Re-express the 11 Lockstitch kinds as presets** (proof-of-model).
3. **Re-express Overlock / Coverstitch / Chainstitch kinds** as presets.
4. **Collapse** Double-Needle (10) + Multi-Needle (8) + Heavy-Duty (10) kinds → into `needle_count` / `duty` attributes (per CL-0010).
5. **Reclassify** Special (21): promote real types; move non-stitch (ultrasonic/heat-seal/rivet/robotic) to sibling categories.
6. **Generate** the deduplicated preset catalog (the 105 → ~12 attributes + N presets).

## 5. Visual Metadata Roadmap
1. Lock the `image_role` set (13 done) + the 6 V3.0 additions (chart/gauge/heatmap/bcg/scorecard/battlecard).
2. **Attribute value-icon registry** — a glyph per axis value (cylinder-bed, walking-foot, servo…); these render as filter chips + spec-card icons.
3. Per-domain visual-metadata defaults (which domains → card vs chip vs diagram vs gallery).
4. Resolution-order spec (SKU►Model►Family►Type►icon) confirmed (already in visual SoT §3).
5. Map Visual-Library assets → product nodes (the Visual Library app exists; define the edge contract).

## 6. Compatibility Roadmap
1. ✅ Rulebook + §11 sewing metadata (done).
2. **Needle↔fabric↔machine matrix** (needle_system × fabric_weight_class) — attribute-based, unblocked.
3. **Per-type fitment maps**: which spare-part / consumable / device classes fit each type (attribute fitment, no codes needed).
4. **Controller/motor compatibility** (controller_brand × machine; motor_type × machine).
5. Wire to the future Spare-Parts app via the federation edge (design now, populate later).

## 7. Application Roadmap
1. **Application dictionary** (garment/product the machine makes) — controlled vocabulary.
2. **Operation library** (felled seam, hemming, bartack…) + operation→type mapping.
3. **Material/fabric suitability** matrix (light→extra-heavy × type).
4. **Industry tags** (apparel/footwear/leather/automotive/technical/military…).
5. **Factory-line role** (per type) → feeds the future Factory Builder edge.

## 8. Product Population Readiness Score
| Dimension | Score | Note |
|---|:--:|---|
| Architecture | **100%** | V3.0 frozen |
| Identity / coding | **0% (blocked)** | prefix freeze open (CL-0001) |
| Taxonomy | **60%** | corrected model designed, pending sign-off |
| Dictionaries | **30%** | Lockstitch v1.1 + facet + **attribute dict (this turn)**; 3–9 type dicts pending |
| Visual metadata | **45%** | vocabulary + roles done; value-icon registry + asset edges pending |
| Compatibility | **40%** | rulebook + §11; per-type maps pending |
| Application/Operation | **20%** | referenced, not built |
| Multi-language | **15%** | infra (translations API) exists; content standard pending |
| **OVERALL POPULATION READINESS** | **≈ 38%** | **gated**: cannot start population until prefix freeze + taxonomy sign-off; dictionary scaffolding ~⅓ built |

## 9. Estimated Workload (documentation phase, unblocked portion)
| Work package | Effort |
|---|---|
| Attribute & Config-Axis dictionary | ✅ done this turn |
| Overlock + Coverstitch + Chainstitch dictionaries | ~2–3 days |
| Application + Operation + Material libraries | ~2 days |
| Visual value-icon registry + per-domain visual standard | ~2 days |
| Machine-Kind preset re-expression (all 9 subcats) | ~2 days |
| Per-type compatibility maps | ~2 days |
| Newly-approved-domain field standards | ~1–2 days |
| **Total unblocked documentation** | **≈ 2 weeks** |
| Blocked (needs sign-off): prefix freeze, code gen, population, Stage-2 schema | — |

## 10. Recommended Next Task
**Done this turn (highest-value, fully unblocked):** authored the **[Sewing Attribute & Configuration-Axis Dictionary](./reference-data/sewing-attribute-dictionary.md)** — the keystone that operationalizes the two-axis model, kills the triplication, and unblocks every per-type dictionary + filter + Machine-Kind-preset.
**Next (recommended):** build the **Overlock (XSO) Master Spec Dictionary** by cloning the Lockstitch v1.1 template (Overlock is an audit-confirmed true type, so it is safe and high-value), referencing the new attribute dictionary for all shared axes.

---

**Status:** living plan. Documentation only — no schema/migration/RLS/UI/code; no product population; no codes; production untouched. Logged as **CL-0011**.
