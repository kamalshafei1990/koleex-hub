# Garment Machinery — Classification Decisions (Resolved)

**Status:** 🟢 DECISIONS RESOLVED · 🔒 NOT IMPLEMENTED (V2 frozen). Per `reference-data/coding-change-governance.md` §2.1, while V2 is blocked the **intended change is documented, not applied to prod**. This record resolves the §9 open questions in `garment-machinery-classification-audit.md` and is logged as **CL-0012**.

**Decided by:** Kamal ("do the right" — delegated the calls) · **Recorded:** 2026-06-17
**Authority:** these resolutions become binding inputs to the V2 implementation when the freeze lifts; full reference-dataset propagation (§3 matrix) happens then.

---

## Resolved decisions

| # | Open question (audit §9) | **Decision** | Rationale |
|---|---|---|---|
| D1 | Add **CAD / Marker-Making & Digitizing** as a new category? | ✅ **Yes — new category.** Proposed prefix **`XMK`** (NOT `XCAD` — `XC` is the Cutting head, so `XCAD` would be a prefix-of-Cutting collision, same class of bug as the logged XP↔XPC issue). | Proven, sourced (ATP plotter, Bangzheng CAD/digitizer/marker, iECHO/Sertol CAM). Prints paper markers, not fabric → must not live under Printing (XP). |
| D2 | **Workshop Infrastructure & Material-Handling** — new category or extend Spare Parts? | ✅ **New category**, prefix **`XWI`**. **Scope = sellable equipment only**: spreading/lay tables, fabric trolleys/carts, racks, power/lighting busway, compressed-air systems. Exclude pure building facility work. | KTEC-class items fit nothing in the 11; Spare Parts (`XSP`) is too narrow to absorb tables/trolleys/busway. |
| D3 | **Template / Pattern Sewing** — own category or subcategory? | ✅ **First-class automation Product Type "Programmable / CNC Sewing"** under Automatic Sewing (`XAPT`), per the existing **CL-0010** industrial-sewing audit. Not a buried subcategory; not duplicated under Industrial Sewing. | Aligns with the already-frozen recode (XSPA→XAPT) and the North Star (automation paradigm = type-defining). Evidence: Koleex XS-360/990, FDK, Jaki, Linjian, Goldsew, Sibyer. |
| D4 | **FIBC / container-bag sewing** — in scope? | ❌ **Out of Garment Machinery scope.** Park for a future **Technical / Industrial Textiles** division; do not create garment subcategories for it. | Woven-sack/technical-textile machinery (Dison, Yongxing), not apparel. |
| D5 | Priority / sequencing | **P1:** D-items C1 (CAD `XMK`), C2 (Fabric-Inspection de-dup), C3 (Heat-Press → attributes). **P2:** C5 (split Motors/Electronics `XMD` out of Spare Parts), C6 (Template/CNC = XAPT), C4 (Workshop `XWI`), C7 (Seam-Sealing/Bonding). **P3:** C8 naming clarity, C9 spreading/strip subcats, C10 fastener-attaching, C11 down-filling, C12 grammar. | Proven gaps + mis-coding risk first; polish last. |

## Proposed code prefixes (validated against current docs — 0 collisions)

| New / changed node | Proposed prefix | Conflict scan |
|---|---|---|
| CAD / Marker-Making & Digitizing (category) | `XMK` | 0 hits in V2 docs · avoids `XC` prefix-of trap |
| Workshop Infrastructure & Material-Handling (category) | `XWI` | 0 hits |
| Motors, Drives & Electronics (split from Spare Parts `XSP`) | `XMD` | 0 hits |
| Programmable / CNC ("Template") Sewing | `XAPT` | already assigned in CL-0010 (reuse, no new code) |
| Seam-Sealing / Bonding (subcategory under Finishing `XF`) | `XFSS` (tentative) | 0 hits · final scan at implementation |

> Final prefix freeze + full §3 dataset propagation (`product-types-master`, `product-type-approval-matrix`, dictionaries, `compatibility-rulebook`, facet additions for `heat_press_station_count` / `heat_press_actuation`) are **deferred to V2 implementation** per governance §2.1. This document + CL-0012 are the required "documented intended change" during the freeze.

## What is explicitly NOT done here
- ❌ No edit to the live `divisions` / `categories` / `subcategories` tables (prod-DB, gated).
- ❌ No prefix frozen (V2 still blocked on Stage 1.5 baseline).
- ❌ No dictionary/approval-matrix mass-propagation yet (happens at implementation).

## Trigger to implement
When V2 unfreezes (Stage 1.5 baseline validated), execute each P1→P3 item through governance §2 (update datasets → approval matrix → conflict scan → change-log status → then prod-DB sync with Kamal sign-off).
