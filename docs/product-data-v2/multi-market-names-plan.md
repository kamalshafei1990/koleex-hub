# Multi-market product names (zh / ar) — plan for sign-off

**Status:** PROPOSAL — awaiting Kamal's approval. No schema change or build performed yet.
**Trigger:** Identity-tab review — "single-language identity, but we sell to China + Arab + global markets."
**Author:** Claude · this session.

---

## TL;DR

Multi-market names are **not greenfield** — a `product_translations` layer already exists. The real work is **finishing and surfacing** it, not building from scratch. The single biggest finding: translations appear to be **authored but never rendered** on the public site. Fix that first; expand coverage second; relocate the editor third.

---

## What already exists today

| Piece | State |
|---|---|
| `product_translations` table | `{ id, product_id, locale, product_name, description }` |
| `model_translations` table | per-variant translations (variant name etc.) |
| API | `/api/product-translations` + `/api/model-translations` (GET/POST/DELETE) |
| Form state | `translations: TranslationFormState[]` (`locale, product_name, description`) |
| Editor UI | `TranslationsSection` — a locale repeater, rendered on the **Review** tab (line ~3948) |
| Locale list | `LOCALES` in `@/types/product-form` |
| Review summary | "Translations · {n} locales" count |

So: an operator **can** add a Chinese/Arabic **name + description** today — but only from the Review tab, and only those two fields.

## Gaps (why it doesn't deliver the value yet)

1. **🔴 Public render likely ignores translations.** A grep of `src/app/products/**` and `src/components/products/**` finds **no** reference to `product_translations` / `locale`. If confirmed, the localized names are written to the DB but the customer never sees them — the feature is effectively dead on the front-of-house. **This is the gap that matters most.**
2. **Coverage is too thin.** Only `product_name` + `description` are translatable. The **tagline** and **short description (excerpt)** — the highest-impact marketing copy, shown on cards, hero, and SEO meta — are **English-only**. Highlights too.
3. **Editor is in the wrong place.** Translations live on the *Review* tab, far from the English fields in *Identity*. Operators author EN in Identity, then must jump to Review to add ZH/AR — disjointed, easy to forget.
4. **No completeness signal.** Nothing tells the operator "this product has no Chinese name" — for an exporter to China that's a real go-to-market gap.

## Recommended approach — 3 phases, smallest-risk first

### Phase A — Wire translations into the public render (no schema change) 🔴 do first
Make `/products/[slug]` (and ProductPreview / TemplateView / card components) resolve the active locale and fall back to the English base when a translation is missing. **Verify first** whether any render path already does this; if not, this is the highest-value, lowest-risk step — it makes the *existing* authored data actually work. Pure read-side wiring.

### Phase B — Expand coverage (additive migration, needs sign-off)
Add `tagline` + `excerpt` (and optionally `highlights jsonb`) to `product_translations`, thread through the API + form state. Additive, nullable — safe for the 710 legacy rows. **This is the only step that touches the schema and therefore needs explicit approval.**

### Phase C — Relocate + signal the editor (no schema change)
Move/mirror the translation editor into the **Identity** tab, inline under each English field (or a compact "Languages" sub-panel in the hero), so EN/ZH/AR are authored together. Add a small "missing Chinese name" hint to the publish-readiness signal we just shipped.

## Open decisions for Kamal

1. **Which markets are first-class?** Confirm zh-CN + ar are the priority locales (others additive later).
2. **Coverage scope** — just name + tagline + excerpt, or also the full long description + highlights?
3. **Fallback policy** — when a locale is missing, fall back to English silently (recommended) vs. hide the product in that locale.
4. **Who authors translations** — manual entry, or eventually machine-assisted draft + human review? (out of scope for v1; flag only.)

## Risk / safety notes
- Phases A & C are UI/render-only — auto-executable once approved.
- Phase B is the **only** schema change (additive columns on `product_translations`) — gated on Kamal's sign-off per the autonomy policy.
- No change to `products.product_name` (English stays the canonical base); translations remain an overlay.

## Related
- [[project_product_data_tabs]] · [[project_product_knowledge_architecture_freeze]] — the "name = Product Identity Object (name-TYPE × locale + aliases)" north-star is a larger future model; this plan is the pragmatic, ship-now slice of it.
