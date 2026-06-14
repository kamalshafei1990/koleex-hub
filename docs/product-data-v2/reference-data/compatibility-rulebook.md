# Compatibility Rulebook

> **Visual requirement (SoT):** see [Visual Product Experience](../architecture/visual-product-experience.md). Compatibility results render **visually** — Fits / Requires / Pairs / Alternative / Supersedes as linked cards with the partner's icon + photo. Each rule must define the `presentation_group` (section) its result renders in before approval.

Reference dataset for Product Data V2. **Documentation only.** Formal rules for how parts / devices / consumables fit machines. Aligns with Architecture Freeze v1.0 + the resolver pseudo-code.

## 1. Compatibility types
| Type | Direction | Example |
|---|---|---|
| **Fits** | part/device → machine | Needle *fits* Lockstitch |
| **Requires** | machine → part/utility | DTF Printer *requires* Powder Shaker + Heat Press |
| **Pairs-With** | machine ↔ machine | Spreader *pairs-with* Cutter; Boiler *pairs-with* Iron |
| **Alternative / Equivalent** | part ↔ part | aftermarket looper *equivalent-to* OEM |
| **Supersedes / Replaced-By** | part → part | old PCB *replaced-by* new PCB |
| **Upgrades-To** | machine/device → machine/device | Clutch motor *upgrades-to* servo |

## 2. Two fitment paradigms (support BOTH)
- **Attribute fitment (default for standard parts):** the part fits *anything matching a spec* — e.g., a Needle fits any machine whose `needle_system = DBx1`; a Gauge Set fits any machine at `gauge = 3/16"`. Match spec = `{facet, op, value}` where `op ∈ {eq, in, range}`. Scales to thousands of machines with no enumerated list.
- **Explicit fitment (for proprietary parts):** the part fits an *enumerated set* of identities — e.g., a PCB fits `primary_model = XSL-L9-T`. Use when no attribute can express the fit.

> Rule: **use attribute fitment whenever a standard spec exists; fall back to explicit lists only for proprietary parts.**

## 3. Compatibility levels (broadest-true-level wins)
`Product Type` ⊃ `Product Family` ⊃ `Primary Model` ⊃ `SKU`. Declare at the **broadest level that is true** — never enumerate models when a family or attribute suffices.

| Part class | Typical fitment level |
|---|---|
| Needle | attribute (needle_system) ≈ type-broad |
| Looper / Feed Dog | Product Family (+ gauge attribute) |
| PCB / Control Panel | Primary Model (explicit) |
| Motor Kit | SKU (explicit; config/voltage-bound) |
| Folder / Gauge Set | attribute (operation + gauge) |

## 4. Inheritance rules
- Compatible with a **Family** ⇒ compatible with **all its Primary Models and their SKUs** (unless excluded).
- Compatible with a **Primary Model** ⇒ compatible with **all its SKUs**.
- **Never generalizes upward** — a model-specific PCB does not become family-wide.
- **Attribute fitment is orthogonal** — matches any machine carrying the attribute, across all families.

## 5. Exclusions (overrides)
Explicit exclusion rows remove matches: e.g., *"fits XSO-7800 family **except** XSO-7800-5."* An exclusion at ≥ the candidate's specificity removes the part.

## 6. Confidence levels
`oem_verified` > `declared` > `aftermarket_claimed`. Surfaced to buyers; AI must respect it and flag low-confidence fits as *"verify."*

## 7. Resolution order (priority — most wins)
1. **Exclusion** (an exclusion at ≥ specificity removes the part)
2. **Most-specific level** — `SKU > Primary Model > Family > Product Type`
3. **Confidence** — `oem_verified > declared > aftermarket_claimed`
4. **Mode** — `explicit > attribute` when both resolve and disagree

## 8. Conflict resolution
- Exclusion beats inclusion.
- Most-specific level beats broader.
- OEM-verified beats aftermarket.
- If still ambiguous → mark **"verify"**, never guess.

## 9. Caching / projection
A **resolved-compatibility projection** (machine→parts and part→machines) is precomputed and invalidated on change of: compatibility rows, parts, or machine identity attributes. Reads hit the projection; live resolve is the fallback.

## 10. Worked examples
- **`XSL-L9-T` → which parts fit?** Walk SKU→Model→Family→Type collecting explicit rows, **plus** attribute matches by its `needle_system`, `gauge`, `hook_size`. Group by part type; flag confidence.
- **Needle `P-NDL-000123` (system DBx1) → which machines?** Attribute match: all machines with `needle_system = DBx1` across every family. No enumeration needed.
- **PCB `P-PCB-004510` → fits `XSL-L9-T` only** (explicit, Primary-Model level). Does not inherit to other models.
- **Family rule with exclusion:** "Looper `P-LPR-000045` fits family `XSO-7800` **except** `XSO-7800-5`" → resolves to 7800-3 and 7800-4 SKUs only.

## 11. Sewing compatibility metadata (Lockstitch v1.1 · CL-0005)
Promoted from the [Lockstitch Master Spec Dictionary v1.1](./dictionaries/lockstitch-master-spec-dictionary.md). Attribute-fitment match keys for the sewing family (inherited by Overlock/Interlock).

| Linked class | Match / identity field(s) | Type | Values / notes |
|---|---|---|---|
| Needles | `needle_system` (expanded list — §3 facet dict), `needle_size`, `point_type` | attribute (requires) | DB×1·DP×5·DP×17·DC×27·DY×3·CP×5·TV×7/5/64·TQ×1·LW×6T·UY×128·DV×57·7×23/25/30 |
| Rotary hooks / bobbins | `hook_size`, `hook_type`, **`hook_model`**, **`hook_brand`** | attribute (requires) | e.g. KSP-204N · KRT132 · Hirose |
| Tables / stands | `table_size`, `bed_type`, **`table_mount_type`** | attribute (requires) | Ordinary · Ball-bearing(钢珠) · Air-float |
| Mountable head (CNC/template frames) | **`mountable_head_compat`** | explicit (fits) | JUKI · SIRUBA · PEGASUS · HIKARI · LIJIA · KANSAI |
| Controller / panel | **`controller_brand`** | explicit (requires) | DAHAO(大豪) · 誉财 · 星火 · SYSTEMTOP |
| Pattern files | **`pattern_file_format`** | attribute (fits) | DXF · PLT · DST · NTP · DHP · SLW |

> Needle↔fabric selection (AI): pair `needle_system` × `fabric_weight_class` (Light/Medium/Heavy/Extra-heavy) — heavy/leather ⇒ DP×17 / DY×3 / 7×30 + large hook + ≥10 mm foot lift. Surfaced to the Spare-Parts & Service Assistants per [visual-product-experience.md](../architecture/visual-product-experience.md) §9 (compatibility-as-cards).
