# Sewing Machine — Attribute & Configuration-Axis Dictionary (Category XS)

**What this is.** The single, shared set of **configuration axes (attributes)** for every Industrial Sewing Machine — the *what-it-HAS* layer of the two-axis model ([taxonomy audit, CL-0010](./industrial-sewing-taxonomy-audit.md)). Product Type carries the **stitch-class identity**; this dictionary carries everything **configurable**, defined **once** and reused across all types. It ends the triplication (subcategory × machine-kind × coding-axis) by making the axis the *only* home for bed/feed/needles/duty/motor/automation.

**Status.** Source-of-truth reference dataset. **Documentation only — not applied.** Extends [`facet-dictionary-master.md`](./facet-dictionary-master.md) (universal facet home; §2 machine + §8 promoted) with the **category-resolved sewing view**: per-axis allowed values, **value-level icons (visual-first)**, applies-to-type, and the **Machine-Kind-as-preset** derivation rule. Visuals per [`../architecture/visual-product-experience.md`](../architecture/visual-product-experience.md). Owned by **Product Data V2** (intrinsic product knowledge; PD-owned per [federation](../architecture/cross-app-knowledge-federation.md)). Change-log: **CL-0011**.

---

## 0. The model (why axes, not types or kinds)
- **Product Type = stitch class** (Lockstitch, Overlock, Coverstitch, Chainstitch, …) — the immutable identity, gets the prefix.
- **Attribute / Configuration Axis = this document** — orthogonal, reusable, defined once; resolves a Variant.
- **Machine Kind = a derived PRESET** = `Product Type × {axis: value, …}`. **Never a structural level**; a saved query that powers nav / SEO / sales / AI. (E.g. *Walking-Foot Lockstitch* = `type:lockstitch + feed:compound-walking + bed:flat`.)

**Visual-first rule for axes:** every **axis value** carries an `icon_key` (a glyph) and renders as a **filter chip** + a **spec-card icon** — never a bare table cell. Axis values are also `comparison_display` candidates (highlight-diff) and `ai_synonyms` anchors. Multi-language: every value `display_name` is localizable across the 13 KOLEEX locales (en · zh-Hans · zh-Hant · ar · es · fr · ru · pt · tr · hi · ur · bn · vi · th).

**Columns:** Value (code) · Display · `icon_key` · Applies-to types · Filter/Compare/AI notes. **Applies-to legend:** LS Lockstitch · OL Overlock · CV Coverstitch · CH Chainstitch · BH Buttonhole · BT Bartack · BA Button-Attach · BL Blindstitch · ZZ Zigzag · CNC Programmable · ALL = every sewing type.

---

## A · STRUCTURE AXES (frame / mechanism — the type-masquerade killers)

### A1 · `bed_type` — Bed / body form  *(single_select · ALL)*
*Replaces the XSD-style "subcategory"; a bed is a frame, not a stitch.*
| Value | Display | icon_key | Applies | Notes |
|---|---|---|---|---|
| `flat` | Flat-bed | bed-flat | ALL | default; general garment |
| `cylinder` | Cylinder-bed | bed-cylinder | LS·OL·CV·CH·BA | tubular: cuffs, sleeves, gloves, socks |
| `post` | Post-bed | bed-post | LS·CH·BA | vertical post: shoes, caps, 3D goods |
| `long-arm` | Long-arm | bed-longarm | LS·CH | extended throat 600–900 mm |
| `feed-off-arm` | Feed-off-the-arm | bed-feedoffarm | LS·CV·CH | side-exit: jeans inseam, side seams |

### A2 · `feed_type` — Feed mechanism  *(single_select · LS·CH·OL·CV)*
| Value | Display | icon_key | Notes |
|---|---|---|---|
| `drop` | Drop feed | feed-drop | bottom feed-dog only (default) |
| `needle` | Needle feed | feed-needle | needle moves with dog — slippery fabric |
| `compound-walking` | Compound / walking foot | feed-walking | unison feed — multi-layer no-shift |
| `top-and-bottom` | Top-and-bottom feed | feed-topbottom | dual feed — dense seams |
| `differential` | Differential feed | feed-differential | OL/CV — knit gather/stretch control |
| `puller` | Puller feed | feed-puller | assists heavy/long seams |

### A3 · `needle_count` — Number of needles  *(single_select · ALL)*
*Replaces the XSD "Double Needle" + XSM "Multi Needle" subcategories — needle count is an attribute, never a type.*
| Value | Display | icon_key | Notes |
|---|---|---|---|
| `1` | Single needle | needle-1 | default |
| `2` | Double needle | needle-2 | conditional `needle_gauge` |
| `multi` | Multi-needle (3–12) | needle-multi | waistbands, smocking; conditional `needle_count_n` + `needle_gauge` |

`needle_gauge` *(measurement · mm/inch · cond: needle_count≥2)* — twin/multi spacing. `needle_count_n` *(number · cond: multi)* — exact count (3·4·6·8·12).

### A4 · `arm_length` — Working arm  *(single_select · LS·CH)*
`standard` (Standard throat) · `long-arm` (600–900 mm — duplicates the bed value when bed=long-arm; resolve to bed). *Kept as a measurement `arm_clearance` (W×H) on the spec dictionary; this axis is the discrete marketing flag.*

---

## B · STITCH-FORMATION AXES (sub-identity within a type)

### B1 · `thread_count` — Thread quantity  *(single_select · OL·CV·CH)*
| Value | Display | icon_key | Notes |
|---|---|---|---|
| `1` | 1-thread | thread-1 | chain/blind |
| `2` | 2-thread | thread-2 | OL lightweight overedge |
| `3` | 3-thread | thread-3 | OL standard |
| `4` | 4-thread | thread-4 | OL 2-needle workhorse |
| `5` | 5-thread | thread-5 | OL+chain safety-stitch |
| `6` | 6-thread | thread-6 | heavy safety / cover |

### B2 · `stitch_finish` — Edge/seam finish variant  *(multi_select · OL·CV)*
`overedge` · `safety-stitch` · `rolled-hem` · `flatlock` · `cover-seam` · `blind` · `picot`. *(These are stitch-formation sub-variants, not types — e.g. "Rolled-Hem Overlock" = `type:overlock + stitch_finish:rolled-hem`.)*

### B3 · `hook_type` — Rotary hook  *(single_select · LS)*
`standard` · `large` · `huge`. (Lockstitch-only; bobbin-hook machines.)

---

## C · DUTY & CAPABILITY AXES (the XSH killer)

### C1 · `fabric_weight_class` / duty — Duty class  *(single_select · ALL)*
*Replaces the XSH "Heavy Duty" subcategory — duty is a capability grade, not a stitch.*
| Value | Display | icon_key | Notes |
|---|---|---|---|
| `light` | Light | duty-light | chiffon, lingerie, knits |
| `medium` | Medium | duty-medium | shirting, general apparel (default) |
| `heavy` | Heavy | duty-heavy | denim, canvas, drill |
| `extra-heavy` | Extra-heavy | duty-xheavy | leather, webbing, sail, harness |

### C2 · `max_sewing_thickness` *(measurement · mm · cond: duty≥heavy)* — feeding/clamp space. (Lives in spec dict; surfaced as a duty proof-point.)

---

## D · DRIVE & ELECTRONICS AXES

### D1 · `automation_level` — Automation paradigm  *(single_select · ALL)*
| Value | Display | icon_key | Notes |
|---|---|---|---|
| `manual` | Manual | auto-manual | mechanical |
| `semi-auto` | Semi-automatic | auto-semi | some auto functions (trim/backtack) |
| `automatic` | Automatic | auto-full | full auto-function set |
| `programmable` | Programmable / CNC | auto-cnc | XY frame / template (→ the CNC **type** when frame-driven) |
| `robotic` | Robotic / cell | auto-robot | multi-station (→ Production-System concept, above the machine) |

### D2 · `motor_type` — Motor drive  *(single_select · ALL)*
`clutch` · `servo` · `direct-drive`. icon_keys: motor-clutch · motor-servo · motor-direct.

### D3 · `motor_brand` *(text · ALL)* — controlled list (motor maker): e.g. own-brand · OEM partners. (Net-new per approved domains.)

### D4 · `controller_brand` — Control-system brand  *(single_select · automatic/programmable types)*
*Approved value list (extensible):* `DAHAO` (大豪) · `QIXING` (琴星) · `YICHAO` (誉超) · `SYSTEMTOP` · `XINGHUO` (星火). icon_key: per-brand logo glyph. *Cross-app: references the **Components/Brands registry** (existing) — PD stores the edge, not a copy.*
Companion fields: `controller_model` *(text)* · `controller_version` *(text)*.

### D5 · `firmware_os` — Smart-machine software  *(group · smart types)*
`firmware_version` *(text)* · `firmware_family` *(text)* · `os_name` *(text)* · `os_version` *(text)*. For connected/smart machines only; references future **Firmware/Device-Management** module.

---

## E · SMART / CONNECTIVITY AXES (future-growth-proof)

| Axis | Type | Values | Applies | Note |
|---|---|---|---|---|
| `connectivity` | multi_select | none · USB · LAN · WiFi · Bluetooth · cloud | ALL | IoT readiness |
| `vision_guided` | boolean | true/false | CNC·automatic | camera-aligned sewing |
| `ai_features` | boolean | true/false | CNC·automatic | on-board AI (skip-detect, auto-tension) |
| `app_control` | boolean | true/false | smart | mobile-app pairing |

*These are why the two-axis model survives the future: "Smart / AI / IoT / Vision" machines are **attribute values**, defined once, applied to any type — never a combinatorial explosion of "Smart-X" types.*

---

## F · UTILITY AXES (carried from the spec dictionary, shared)
`lubrication_type` (dry-head · semi-dry · micro-oil · sealed-oil-pan · auto-lube · manual) · `edge_trimmer` (none · side-cutter · under-trimmer) · `voltage` (110·220·380) · `phase` (single·three) · `air_required` (bool). All have value-icons + filter chips.

---

## G · The Machine-Kind derivation rule (replaces the 105 hand-maintained nodes)
A **Machine Kind** is generated, not authored:
```
Kind = Product Type  ×  { defining axis values }
     + name (curated)  + hero image + SEO copy   ← the only hand-authored parts
```
Examples (proving the model against the live 105):
| Live "Machine Kind" | = Type × axes |
|---|---|
| Walking-Foot Lockstitch | LS × `feed:compound-walking` |
| Cylinder-Bed Lockstitch | LS × `bed:cylinder` |
| Long-Arm Lockstitch | LS × `bed:long-arm` |
| Heavy-Duty Single Needle Lockstitch | LS × `duty:heavy` (NOT a separate XSH type) |
| Double Needle Walking-Foot | LS × `needle_count:2 + feed:compound-walking` (NOT a separate XSD type) |
| 2-Needle 4-Thread Overlock | OL × `needle_count:2 + thread_count:4` |
| 5-Thread Safety-Stitch Overlock | OL × `thread_count:5 + stitch_finish:safety-stitch` |
| Rolled-Hem Overlock | OL × `stitch_finish:rolled-hem` |
| Cylinder-Bed Coverstitch | CV × `bed:cylinder` |
| Small-Area Pattern Sewer | CNC × `sewing_field_xy:~200×100` |
**Outcome:** the **105 kinds collapse to ~12 reusable axes + N generated presets** — no value defined twice; "cylinder-bed" exists **once** and returns every matching machine across every type (the filtering that is impossible today).

---

## H · Governance & cross-app
- **Owned by Product Data V2** (intrinsic). `controller_brand`/`motor_brand` **reference** the Components/Brands registry (existing); `firmware_os` references the future Firmware module — PD stores the **edge**, never a copy.
- Net-new axes promoted here also land in [`facet-dictionary-master.md`](./facet-dictionary-master.md) governance (single vocabulary source): `motor_brand`, `controller_model`, `controller_version`, `firmware_version`, `firmware_family`, `os_name`, `os_version`, `connectivity`, `vision_guided`, `ai_features`, `app_control`, `needle_count_n`, `stitch_finish`.
- Every axis value must define its `icon_key` before approval (visual-first gate, CL-0002 §7).
- **Not blocked by prefix freeze** — attributes are prefix-independent and survive the taxonomy correction (they ARE the correction).

---

**Status:** Source-of-truth reference dataset. **Documentation only** — no schema/migration/RLS/UI/code; no product population; no codes; production untouched. Operationalizes the CL-0010 two-axis model; keystone for all per-type dictionaries, filters, and Machine-Kind presets. Logged as **CL-0011**.
