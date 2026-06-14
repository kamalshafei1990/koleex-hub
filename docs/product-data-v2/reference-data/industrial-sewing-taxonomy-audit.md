# Industrial Sewing Machine Taxonomy — Pre-Freeze Audit (Ruthless)

**Mission.** Challenge the current Industrial Sewing classification **before** we freeze Product Types, prefixes, dictionaries, codes, and product population. Not a coding/schema/migration/UI task — a **taxonomy + knowledge-architecture audit.** **Documentation only.** Governs the [Product Type registry](./product-types-master.md); informs the prefix-freeze decision (CL-0001). Change-log: **CL-0010**.

> **One-line verdict:** the current structure **classifies the same thing in three places** and mixes four different *kinds of facts* into one ladder. **Do NOT freeze as-is.** It is fixable with a clean principle and ~1 week of taxonomy work; freezing it now would bake permanent technical debt into non-recyclable codes.

---

## PART 0 — The principle the whole audit turns on

Every fact about a machine is one of three kinds. **Conflating them is the root defect.**

| Kind of fact | Question | Belongs to | Example |
|---|---|---|---|
| **Identity** — what it *IS* | "What stitch does its mechanism form?" (ISO stitch class) | **Product Type** (gets the prefix) | Lockstitch (301), Overlock (504), Coverstitch (602) |
| **Construction** — what it *HAS* | "How is it built / configured?" | **Attribute / Configuration Axis** (facet) | bed=cylinder, feed=walking-foot, needles=2, motor=servo, duty=heavy |
| **Purpose** — what it *DOES* | "What does it make / which job?" | **Application** + (optionally) an **Automation preset** | pocket-overlock, belt-loop maker, dart sewer |

**The litmus test for a Product Type:**
> *Does it form a fundamentally distinct stitch that you CANNOT reach by configuring another type?*
- **Yes** → Product Type (immutable identity).
- **No — it's the same stitch on a different frame/feed/duty/needle-count** → **Attribute**, never a type.

A "Cylinder-Bed Heavy-Duty Double-Needle Lockstitch" is **ONE lockstitch** carrying three attribute values (`bed=cylinder`, `duty=heavy`, `needles=2`). The current model would file it under **three** different subcategories (XSL, XSH, XSD) and as a **Machine Kind** — the same machine, four identities. That is the disease.

---

## OUTPUT 1 — Classification Audit Report (the diagnosis)
The system has **three layers describing the same machines**, and they overlap:
1. **Product Types / Subcategories** (9: XSL…XSS) — *should* be pure stitch-class identity, but 4 of 9 are not.
2. **Machine Kinds** (105) — *should* be a discovery/search overlay, but are built as a parallel structural taxonomy → combinatorial duplication (e.g. **"Cylinder-Bed" appears as a Kind under 6 different subcategories**, and also as a coding axis, and also implicitly as an attribute).
3. **Coding / Configuration Axes** — the *correct* home for bed/feed/duty/motor, but they **duplicate** values that also live as Kinds and Subcategories.

**Root finding:** bed type, feed type, needle count, duty class, motor, and automation are simultaneously modeled as (a) subcategories, (b) machine kinds, and (c) coding axes. **One concept, three homes.** This is unfreezable.

---

## OUTPUT 2 — Product Type Report (audit of the 9 subcategories)
| Current | Verdict | Why |
|---|---|---|
| **XSL Lockstitch** | ✅ **TRUE Product Type** | ISO 301; rotary hook + bobbin. Cannot be configured from anything else. |
| **XSO Overlock** | ✅ **TRUE Product Type** | ISO 500-series; loopers + edge cutter, no bobbin. Distinct mechanism. |
| **XSI Interlock** | ✅ **TRUE Product Type — but RENAME** | The machine is **Coverstitch / Flatlock** (ISO 602/406/407). "Interlock" is a *knit fabric*, not a stitch — a naming landmine. Rename label to **Coverstitch (Flatlock family)**. |
| **XSC Chainstitch** | ✅ **TRUE Product Type** | ISO 101/401; single/double-locked chain. Distinct. |
| **XSD Double Needle** | ❌ **NOT a type — DOWNGRADE to attribute** | "Double needle" = `needle_count=2`. A double-needle machine is still a lockstitch/chainstitch. Pure needle-count attribute. |
| **XSM Multi Needle** | ❌ **NOT a type — DOWNGRADE to attribute** | `needle_count=multi`. Almost all are chainstitch. Needle-count again. |
| **XSPA Pattern Sewing** | ⚠️ **DEFENSIBLE type — but reframe + recode** | The *automation paradigm* (programmable XY frame / template) is genuinely type-defining (different spec sheet, ecosystem, buying logic) even though the head is usually 301. Keep as an **automation-class Product Type "Programmable / CNC Sewing"**. **Recode** — `XSPA` was already flagged as a prefix conflict, and it collides with the Lockstitch coding axis `XSPA` ("Attachments & Folders"). |
| **XSH Heavy Duty** | ❌❌ **WORST OFFENDER — DELETE as a type** | "Heavy duty" is a **duty/capability class** (`fabric_weight_class=heavy`), not a stitch. Every XSH machine already exists under its real stitch type. This guarantees duplication. Must become an attribute. |
| **XSS Special Machines** | ❌ **CATCH-ALL — EXPLODE, do not freeze** | "Special" is not a classification; it's an un-classified pile. Inside it are (a) **real distinct types** (Buttonhole, Bartack, Button-attach, Blindstitch, Zigzag), (b) **application presets** on lockstitch (felling, pleating, basting…), and (c) **non-sewing machines** (ultrasonic bonding, heat-seam sealing, snap/rivet setters, robotic cells) that **do not belong under "Sewing" at all**. |

**Corrected true Product Types (stitch-class identity):**
`Lockstitch · Overlock · Coverstitch(Flatlock) · Chainstitch · Buttonhole · Button-Attach · Bartack · Blindstitch · Zigzag* · Programmable/CNC-Sewing**`
*(\*Zigzag is borderline — ISO 304 lockstitch variant with a distinct needle-throw mechanism; lean "type" for search/spec clarity. \*\*CNC is an automation-class type, orthogonal to stitch.)* → **~10 clean types** replacing 9 mixed subcategories.

---

## OUTPUT 3 — Machine Kind Report (audit of all 105)
**Reframe first:** a Machine Kind is **not a taxonomy level** — it is a **named, curated PRESET = (Product Type × key attribute values)**, e.g. *Walking-Foot Lockstitch* = `type:lockstitch + feed:walking-foot + bed:flat`. Kinds are excellent for **navigation, SEO, sales, AI** but must be **derived from Type×Attributes, not hand-maintained as 105 structural nodes** — otherwise the combinatorial duplication is permanent.

Disposition of the 105, by pattern:

| Subcategory (count) | Disposition |
|---|---|
| **Lockstitch (11)** | `standard` = base type. `direct-drive`→motor attr · `needle-feed`/`walking-foot`/`top-bottom-feed`→feed attr · `long-arm`/`cylinder-bed`/`post-bed`/`feed-off-arm`→bed attr · `edge-trimmer`→bool attr · `zigzag`→**PROMOTE to type**. → 1 base + 9 attribute-presets + 1 promotion. |
| **Overlock (15)** | `2t/3t/4t/5t-safety`→`thread_count` attr · `rolled-hem`→stitch-finish attr · `variable-top-feed`→feed attr · `cylinder-bed`/`heavy-duty`→bed/duty attr · `back-latching`→automation attr · `pocket/elastic-tape/gathering/towel/glove/auto-collar`→**application presets**. → all stay Overlock; differentiators become attrs+application. |
| **Interlock/Coverstitch (8)** | `2n/3n`→`needle_count` attr · `top-bottom (flatlock)`→the real sub-stitch · `cylinder-bed`/`feed-off-arm`→bed attr · `rib-binding/elastic/tape-binding`→**application presets**. |
| **Chainstitch (8)** | `single/double/multi-needle`→`needle_count` attr · bed variants→bed attr · `heavy-duty`→duty attr. → collapse to Chainstitch + attrs. |
| **Double-Needle (10)** | **ENTIRE subcategory = `needle_count=2`** on lockstitch/chainstitch. → **MERGE away**; every kind becomes `type + needle_count=2 + (its bed/feed attr)`. |
| **Multi-Needle (8)** | **ENTIRE subcategory = `needle_count=multi`**, mostly chainstitch. → **MERGE away** into attribute. |
| **Pattern Sewing (14)** | `small/medium/large/xxl-area`→`sewing_field_xy` attr on the CNC type · `welt-pocket/dart/sleeve-setter/waistband/label/sleeve-placket/vision/template`→**automated application workstations** (CNC + application). → keep CNC type; rest are presets/attrs. |
| **Heavy-Duty (10)** | **ENTIRE subcategory = `duty=heavy`** on lockstitch/chainstitch/etc. → **DELETE**; every kind becomes `type + duty=heavy + (bed attr)`. |
| **Special (21)** | **PROMOTE to type:** buttonhole-shirt/eyelet, button-attach, bartack, blindstitch, zigzag (5 type families). **Application presets** on lockstitch/automatic: felling, picot, pleating, smocking, elastic-cording, belt-loop, sleeve-placket, collar-runstitcher, yoke, basting (~10). **MOVE OUT of Sewing entirely:** ultrasonic-bonding, heat-seam-seal (→ *Bonding & Seam-Sealing* category), snap/rivet/eyelet setter (→ *Fastening / Press*), robotic-cell (→ *Production Systems/Cells*). |

**Net:** of 105 kinds → **~6 promote to Product Type**, **~4 move out of "Sewing" entirely**, the rest **resolve to (Type × attribute) presets** — i.e. ~12–15 reusable attributes generate the lot. No concept defined twice.

---

## OUTPUT 4 — Attribute Report (the things that must become facets, not types)
These recur across many/all types and **must be shared facet axes**, never Product Types:
`bed_type` (flat · cylinder · post · long-arm · feed-off-arm) · `feed_type` (drop · needle · compound/walking · top-and-bottom · differential · puller) · `needle_count` (1 · 2 · multi) · `fabric_weight_class / duty` (light · medium · heavy · extra-heavy) · `motor_type` (clutch · servo · direct-drive) · `automation_level` (manual · semi-auto · automatic · programmable-CNC · robotic) · `arm_length` · `edge_trimmer` (bool) · `thread_count` (overlock 2–6) · `connectivity` (none · IoT · cloud) · `vision_guided` (bool) · `ai_features` (bool). Most already exist in `facet-dictionary-master.md`; this audit promotes the **type-masquerading** ones (`bed`, `duty`, `needle_count`) firmly into this list.

## OUTPUT 5 — Configuration Axis Report
The coding axes (data.ts: model-code · function · bed · motor · length · fabric · hook · special) are the **correct home** for construction facts — but today they **duplicate** Kinds and Subcategories. Fix: the axes ARE the attribute set (Output 4); Subcategory carries **only stitch class**; Machine Kind is a **read-only preset over the axes**. One value, one home: stitch→Type, construction→Axis, the named bundle→Kind(derived).

---

## OUTPUT 6 — Final Recommended Hierarchy
**I challenge the proposed `…→ Product Type → Machine Kind → Family → Model → SKU`.** Putting **Machine Kind in the structural spine is the mistake that caused the duplication** — because a Kind is `Type × attributes`, and attributes recur across types. Correct model:

```
STRUCTURAL SPINE (identity):
  Division → Category → Product Type(stitch class) → Family → Model → SKU → Variant
                                   │
        attributes (bed/feed/needles/duty/automation/motor…) resolve the variant — they are NOT levels

DISCOVERY OVERLAY (not structural):
  Machine Kind = a named, governed PRESET = filter over (Product Type × attribute values)
                 → powers nav / SEO / sales / AI / comparison — generated, deduplicated, never hand-forked
```
- **Product Type** owns the prefix, the spec template, the icon, the identity. (~10 types.)
- **Attributes** are one shared, orthogonal facet set (resolve every variant, reused across all types).
- **Machine Kind** is a *view* — "Walking-Foot Lockstitch" is a saved query `type=lockstitch & feed=walking-foot`, with its own hero image + SEO page, but **no separate spec template and no structural node.**
- **Above the machine**, add a sibling concept **Production System / Cell** for robotic/multi-station units (they *compose* machines; they aren't a stitch type).
- **Beside Sewing**, add sibling categories **Bonding & Seam-Sealing** and **Fastening / Press** for the non-stitch machines mis-filed in "Special."

---

## OUTPUT — Part 4: Eight-Perspective Cross-Check
| Perspective | Does the corrected model serve it? |
|---|---|
| **Customer** | ✅ Buyers think "I need an overlock" (type) "that's cylinder-bed for gloves" (attribute) — exactly type+attribute. |
| **Sales** | ✅ Kinds-as-presets give sales the familiar names ("walking-foot machine") without fragmenting the catalog. |
| **Product Knowledge** | ✅ One spec template per *type*; attributes describe; no contradictory duplicate records to reconcile. |
| **AI** | ✅ AI reasons over `type × attributes` cleanly ("heavy cylinder-bed lockstitch") — impossible if "heavy/cylinder" are scattered as types+kinds+axes. |
| **Website** | ✅ Type = top nav; attributes = **filters**; Kinds = **SEO landing pages**. Three roles, three structures. |
| **Search** | ✅ "cylinder bed" matches an attribute that exists **once**, returning all matching machines across every type — not 6 duplicate kind-nodes. |
| **Filtering** | ✅ Faceted filtering only works if bed/feed/duty are attributes. As types/kinds, you cannot filter "all cylinder-bed machines." **This alone proves the current model is wrong.** |
| **Dictionary** | ✅ Each attribute defined once; the [Lockstitch v1.1 dictionary](./dictionaries/lockstitch-master-spec-dictionary.md) already treats bed/feed/duty as facets — the audit aligns the taxonomy to the dictionary that's already correct. |

## OUTPUT — Part 5: Visual-First Verdict
| Element | Own icon? | Own visual card? | Own comparison profile? | Own AI visual? |
|---|:--:|:--:|:--:|:--:|
| **Product Type** (~10) | ✅ yes | ✅ yes | ✅ yes (per-type spec template) | ✅ yes |
| **Attribute value** (cylinder-bed, walking-foot, heavy…) | ✅ **option glyph** | ❌ (renders as a **chip/badge** on any machine that has it) | ➖ (a compare *row*, not a profile) | ➖ (explained inline) |
| **Machine Kind** (preset) | ↪ inherits type icon + an attribute badge | ✅ **SEO/landing card + hero image** | ➖ inherits the type's profile | ✅ short "what is a walking-foot machine" explainer |
**Rule:** icons attach to **types AND attribute-values**; the **spec template + structural identity** attach to **types only**; kinds get **search/marketing visuals**, not a unique data shape. (Visual-first preserved; cards not flat tables.)

---

## OUTPUT 7 — Prefix Freeze Impact Report
| Prefix | Status | Action |
|---|---|---|
| `XSL`, `XSO`, `XSC` | ✅ **correct** | freeze |
| `XSI` | ⚠️ **correct concept, wrong name** | keep code, **rename label → Coverstitch/Flatlock** before freeze |
| `XSH` (Heavy Duty) | ❌ **dangerous** | **do not freeze as type** → attribute `duty` |
| `XSD` (Double Needle) | ❌ **dangerous** | → attribute `needle_count=2` |
| `XSM` (Multi Needle) | ❌ **dangerous** | → attribute `needle_count=multi` |
| `XSS` (Special) | ❌ **dangerous (catch-all)** | **explode**; promote real types, move non-sewing out |
| `XSPA` (Pattern Sewing) | ❌ **dangerous (conflict)** | **recode** (collides w/ lockstitch axis `XSPA`); reframe as Programmable/CNC type |
| New: `XSBH/XSBT/XSBA/XSBL/XSZ` | ➕ **add** | promote from "Special" as real types |

**Split:** `XSS` → real types + sibling categories (Bonding, Fastening, Production-Systems).
**Merge:** `XSD`+`XSM` → into stitch types as `needle_count`.
**Downgrade to attribute:** `XSH`, `XSD`, `XSM` (+ all bed/feed/arm "kinds").

**Would freezing the current structure create technical debt? — YES, severe and permanent.** KOLEEX codes are **never recycled**, so a wrong prefix is forever. Freezing XSH/XSD/XSM/XSS as typed prefixes guarantees: dual identities for one machine, un-filterable attributes, reconciliation logic forever, and non-sewing machines mis-filed under sewing. **This is the textbook case for "fix before freeze."**

---

## OUTPUT 8 — Future Growth Report
Test against the future products named:
| Future product | In the corrected model | In the current model |
|---|---|---|
| **Sewing Robots** | Production System/Cell (composes machines) + `automation=robotic` | would spawn "Robot-X" kinds under every type → explosion |
| **AI Sewing Systems** | `ai_features=true` attribute on any type | "AI-Lockstitch", "AI-Overlock"… ×N types ❌ |
| **Smart / IoT Machines** | `connectivity=IoT`, `smart_features` attributes | "Smart-X" / "IoT-X" ×N ❌ |
| **CNC Pattern Sewing** | the Programmable/CNC **type** + `sewing_field_xy` | ok-ish but tangled with XSPA conflict |
| **Vision-Guided** | `vision_guided=true` attribute | "Vision-X" ×N ❌ |
| **Fully-Automatic Production Units** | **Production System** (a level above the machine) | no home → forced into "Special" ❌ |
**Conclusion:** the **attribute-axis model survives every future trend** (each is a new *attribute value*, defined once). The current **bundled-kind model fails** — every automation/connectivity trend would multiply across all stitch types. "Heavy Duty" already proved the failure mode; "Smart/AI/IoT" would repeat it 9×. **Freeze the two-axis model and the taxonomy never needs redesign.**

---

## OUTPUT 9 — Final Taxonomy Recommendation
1. **Two-axis identity:** Product Type = **stitch class only** (~10, prefixed). Everything configurable = **shared attribute facets**. 
2. **Machine Kind = derived preset/overlay** (search/SEO/sales/AI), generated from Type×Attributes — never a structural level, never hand-forked.
3. **Delete type-masquerading subcategories:** XSH→duty, XSD/XSM→needle_count.
4. **Explode "Special":** promote Buttonhole/Bartack/Button-Attach/Blindstitch/Zigzag to types; reclassify application machines as `lockstitch + application`; **move ultrasonic/heat-seal → Bonding category, snap/rivet → Fastening, robotic cell → Production Systems.**
5. **Rename** Interlock→Coverstitch; **recode** XSPA→a clean Programmable/CNC prefix.
6. **Add the sibling categories** (Bonding & Seam-Sealing, Fastening/Press, Production Systems) so non-stitch machines have a true home.
7. **Align to the dictionary that's already right** — the Lockstitch v1.1 dictionary already models bed/feed/duty as facets; the taxonomy must match it.

---

## OUTPUT 10 — Freeze / Do-Not-Freeze Verdict

### 🔴 DO **NOT** FREEZE THE CURRENT STRUCTURE.
Freezing now would permanently encode: one machine with up-to-four identities · attributes that cannot be filtered · a non-classification catch-all ("Special") · non-sewing machines under sewing · a known prefix conflict (XSPA) · and a kind-layer that explodes on every future automation trend. With non-recyclable codes, that debt is forever.

### 🟢 FREEZE THIS INSTEAD (the corrected two-axis model):
- **~10 stitch-class Product Types** (prefixed): Lockstitch · Overlock · Coverstitch · Chainstitch · Buttonhole · Button-Attach · Bartack · Blindstitch · Zigzag · Programmable-CNC.
- **One shared attribute set** (bed · feed · needle_count · duty · motor · automation · arm · edge_trimmer · thread_count · connectivity · vision · ai).
- **Machine Kinds as a generated discovery overlay** (the existing 105 become curated presets + SEO pages, deduplicated).
- **Three sibling categories** for the non-stitch machines.

**Effort to correct:** taxonomy-only, ~1 week of dictionary work — **before** any code generation or product population, all of which is still blocked on the prefix sign-off anyway. **Fixing now costs days; freezing wrong costs a permanent rebuild.**

> **Recommendation:** approve the corrected two-axis taxonomy, update the registry + facet dictionary accordingly (a new CL freezing the ~10 types), then freeze. The goal — *freeze once, never redesign* — is achievable **only** with the corrected model.

---

**Status:** Taxonomy audit (pre-freeze). **Documentation only** — no schema/migration/RLS/UI/code; no Stage 2; production untouched; the registry is **not** modified by this doc (it recommends; sign-off + a future CL would apply). Logged as **CL-0010**.
