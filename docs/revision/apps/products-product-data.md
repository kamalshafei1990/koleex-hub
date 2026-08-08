# App Revision — Products + Product Data (batch)

Session 7 · 2026-08-08

## Fixed
- **B2:** `fetchClassificationIcons()` coalesced via cachedGet(60s) — was raw
  jget, measured ×2 on /product-data. Post-fix: **/product-data 15 network
  API calls, zero real duplicates** (taxonomy/all + classification-icons dups
  both gone); **/products 15 calls, zero dups**.

## Verified (the owner's photo lens — SYS-5 for this pair)
- /product-data DOM audit: **244 images — 242 lazy, 242 CDN-transformed**
  (Supabase render endpoint, width=160 q75 — 5-10× smaller than originals).
  The "oversized" flags are retina headroom (160px file in ~40-64px slots),
  not waste; an optional width≈96 micro tier for h-9 row thumbs is noted as
  future polish, deliberately skipped now (photo quality first).
- Photos render instantly from CDN cache — the "no loading even in photos"
  goal holds on this surface.

## Observations (report-only, data not code)
- **/products (public catalog) shows 0 products** — correct behavior: the
  owner's ACTIVE-only rule + the fresh August catalog still being all DRAFT.
  The screen renders an honest empty state, division chips, fx badge
  ($1=¥6.75 live). When products get activated they'll appear.
- PD list: 121 products / division+subcategory grouping / DRAFT badges +
  model chips all correct on desktop and 375px.

## Lenses
| App | B1 | B2 | B3 | B4 | F1 | F2 |
|---|---|---|---|---|---|---|
| Products | 🔍 | ✅ | ✅ | ✅ (fx badge, division chips) | ✅ | ✅ |
| Product Data | 🔍 | ✅ | ✅ | ✅ (icon hub, taxonomy, fx) | ✅ | ✅ |
