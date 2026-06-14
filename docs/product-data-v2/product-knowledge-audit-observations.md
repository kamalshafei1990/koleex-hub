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
_pending_

## 5c — MediaSection
_pending_

## 5d — TemplateView + ProductPreview
_pending_

## 5e — RTL pass
_pending_

---

## Cross-cutting candidates (Completeness · Relationships · Naming · Visual)
_pending — populated as evidence appears across surfaces_
