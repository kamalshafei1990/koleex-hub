# SKU Strategy

> **Visual requirement (SoT):** see [Visual Product Experience](../architecture/visual-product-experience.md). Each SKU has a visual configuration card (resolved hero/gallery + config chips + logistics) and a `quotation_display_hint`; photos/icons resolve `SKU ► Model ► Family ► Type`. Visuals are part of "done".

Reference dataset for Product Data V2. **Documentation only.** Defines when a variation becomes a SKU. Aligns with Architecture Freeze v1.0 (SKU = operational anchor; Primary Model = commercial).

## The one rule
> **A SKU exists ONLY when a variation changes cost, stock, weight, CBM, or packing.** Everything else is an *option/facet* on the Primary Model — not a new SKU.

SKU = **Primary Model × the set of SKU-defining option selections.** SKU code = Primary Model code + suffix tokens (e.g., `XSL-L9-T-HO`, `XSL-L9-T-CS`).

## What CREATES a SKU (✅ SKU-defining)
| Variation | Why it's a SKU | Example |
|---|---|---|
| **Configuration: Head Only (HO)** | Different stock, cost, weight, packing | `XSL-L9-T-HO` |
| **Configuration: Complete Set (CS)** | Includes table/stand/motor → different cost, CBM, packing | `XSL-L9-T-CS` |
| Voltage **when it changes cost/stock** | e.g., a 380V model needs a different motor SKU held in stock | promote per-model |
| Plug/region **when it changes cost/stock** | e.g., region-bundled kit with different packing/BOM | promote per-model |
| Embroidery head/needle config, integrated devices (sequin, vision, white-ink) | different machine build = different cost/stock | per `device-dictionary-master.md` flags |
| Gauge (multi-needle) when stocked as distinct builds | different stock | gauge-specific SKU |

## What does NOT create a SKU (❌ option/facet only)
| Variation | Why NOT a SKU | Where it lives |
|---|---|---|
| **Voltage** (220V/380V) by default | Informational; same stock pool | option/facet `voltage` on Primary Model |
| **Plug type** (EU/UK/US/AU/CN) by default | Same stock/cost | option/facet `plug_type` |
| **Color** (cosmetic) | Unless separately stocked/costed | option/facet |
| **Market/region label** (branding, manual language) | Same physical unit | option/facet `market` + `market_availability` |
| Documentation/manual language | Content only | translation layer |
| Software/firmware preset | Config | option |

## Head Only vs Complete Set
- **Head Only (HO):** the machine head alone. Distinct weight/CBM/packing/cost → **its own SKU**.
- **Complete Set (CS):** head + table + stand + motor (+ accessories). Distinct cost/CBM/packing → **its own SKU**.
- Both inherit specs/marketing from the Primary Model; only physical/cost/stock differ (live at SKU).

## Voltage & Plug — the decision rule
- **Default:** `voltage` and `plug_type` are **informational options** (one stock pool, one cost) → NOT SKUs.
- **Promote to SKU-defining per model ONLY IF** the variant is stocked separately or costs differently (e.g., a distinct motor for 380V held as inventory). Recording this is a **per-model business decision**, logged on the model.
- This rule is the #1 guard against SKU explosion (promoting voltage/plug casually multiplies SKUs 6–12×).

## Market variants
- A "market variant" (region branding, bundled docs, local plug) is an **option/facet**, not a SKU — **unless** it is a physically different, separately-stocked kit (then it's a SKU).
- Selling price by market lives in **Commercial Policy / market price**, never as a SKU multiplier.

## Quotation / ERP binding
- Customers shop/quote the **Primary Model** (+ selected options).
- At confirmation, the line **resolves to a SKU** (HO/CS + any SKU-defining options) so inventory, cost, landed cost, weight and CBM are correct.
- **Every Primary Model has ≥1 SKU** (even single-configuration models) so the ERP always has an anchor.

## SKU code grammar
- `<Primary Model code>-<config suffix>` from a controlled token set: `HO` (Head Only), `CS` (Complete Set), plus voltage/region tokens **only when SKU-defining**.
- Globally unique in the Code Registry; never recycled (see Coding Standard).
