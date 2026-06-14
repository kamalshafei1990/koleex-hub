# Product Family Naming Standard

Reference dataset for Product Data V2. **Documentation only.** Aligns with Architecture Freeze v1.0 (Identity = Type → **Family (optional)** → Primary Model → SKU).

## 1. What a Family is
A **Product Family** is an *optional* commercial series that groups ≥2 Primary Models sharing one engineering platform and a market-recognized series name (e.g., the "7800 series"). It is a grouping/listing entity — **never a buyable item** (only Primary Models are bought).

## 2. Family creation rules — create ONLY when ALL three pass
1. **Series test** — two or more Primary Models share one platform/series base.
2. **Market-recognition test** — customers refer to the series by name.
3. **Shared-data test** — real shared specs/marketing/media worth defining once and inheriting.

A family is **promoted into existence only when its 2nd sibling model is created** — never preemptively.

## 3. Forbidden patterns (do NOT create a family when…)
- ❌ It would contain exactly **one** Primary Model ("family of one").
- ❌ The grouping is just category convenience (that's Subcategory/Product Type).
- ❌ Models differ so much that nothing is genuinely shared.
- ❌ A commercial difference customers ask for is hidden as a family member instead of its own Primary Model (e.g., `-T` trimmer = separate Primary Model, not "a family member").

## 4. Series / code naming rules
- Family code = **Type prefix + series token** (uppercase ASCII, hyphen at the commercial boundary).
- Family code must be **globally unique** in the Code Registry; never recycled.
- Primary Models under a family = **Family code + model/feature tokens**.
- The series token is numeric or short alphanumeric and must be market-recognizable.

## 5. Code examples (allowed)
| Family code | Primary Models under it | Notes |
|---|---|---|
| `XSO-7800` | `XSO-7800-3`, `XSO-7800-4`, `XSO-7800-5` | overlock series by thread count |
| `XSL-Q10` | `XSL-Q10`, `XSL-Q10-T` | only if Q10 is a recognized series with ≥2 models; else each is a standalone Primary Model |
| `XEM-1500` | `XEM-1502`, `XEM-1506`, `XEM-1512` | multi-head embroidery series by head count |

## 6. Standalone (NO family) examples — the common case
| Primary Model | Why no family |
|---|---|
| `XSL-L9` | single standalone model |
| `XSL-L9-T` | trimmer variant = its own commercial model (a *commercial* difference), not a family member |
| `XFSB-…` (a boiler) | one model, one configuration |

## 7. Allowed vs forbidden patterns (summary)
| Pattern | Allowed? |
|---|---|
| Family with ≥2 Primary Models + market series name | ✅ |
| Family created when 2nd sibling appears | ✅ |
| Family with exactly 1 model | ❌ |
| Family = a Subcategory rename | ❌ |
| `-T`/feature variants as separate Primary Models | ✅ |
| Voltage/plug variants as family members | ❌ (those are SKU options / not commercial models — see `sku-strategy.md`) |
| Recycling a retired family code | ❌ |

## 8. Inheritance (resolution order)
Shared specs/marketing/media defined at **Family** are inherited by its Primary Models, overridable at the Model, then SKU: **SKU > Primary Model > Family > Product Type default.**
