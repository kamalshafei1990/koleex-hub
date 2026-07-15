# Storage Migration Matrix (China R3) — 2026-07-15

States: browser-direct · first-party image · first-party public file · first-party protected file · tested · China verified · pending

| Category | Bucket | State | Notes |
|---|---|---|---|
| Company/contact/supplier logos | media (public) | **first-party image** (fpAvatar, `66771b9e`) | kill-switch env; China: inherited from hub origin (labeled inference) |
| Employee/account/customer avatars | media (public) | **first-party image** (`66771b9e`) | 33 sites / 20 components; fallback initials preserved |
| Discuss participant avatars (ThreadPane/CustomerChatModal) | media (public) | **first-party image** (`66771b9e`) | |
| Product photos / VL thumbnails / catalog covers | media, product-* (public) | **first-party image** (stage 1 `760c7665` + covers `16e7308a`) | live-verified 200 first-party |
| Catalog PDFs (32–187MB) | media (public bucket, tenant+module-gated) | **first-party protected file · TESTED** (`16e7308a`, tenant-scope fix `50d32741`) | full authenticated authz matrix executed incl. cross-org, Range 206, partial-fetch, logout, cache isolation — see FILE_DELIVERY_AUTH_TEST_RESULTS |
| Product manuals / brochures / spec PDFs | — | **pending content** | No populated manual documents exist yet (PD population just started); category + route pattern defined; supplier catalogs (the existing brochure class) are covered above. NOT auto-classified public: each future doc type gets an access rule first (supplier/cost/QC/packing docs are NOT public regardless of bucket). |
| Taxonomy/brand SVG icons | media (public) | **browser-direct, retained** | SVG = optimizer-incompatible by security policy; local fallbacks make CN degradation cosmetic; candidate: public-icon route category |
| Software-center installers | media (public) | **browser-direct, retained** | large downloads; future `software` route category (module-gated) |
| Discuss image/file attachments | media (public) | route **TESTED** (member/non-member/deleted/index/logout all pass); UI wiring pending owner approval | security gate CLEARED — see FILE_DELIVERY_AUTH_TEST_RESULTS |
| Discuss voice messages | discuss-voice (private) | pending resolver | signed-URL flow today |
| Finance / project / QA files | private buckets | pending resolvers | signed-URL flows today |
| Generated exports (xlsx/pdf) | n/a (streamed by APIs) | already first-party | no storage involved |

**Repo guard:** `npm run validate:first-party` fails on any NEW browser-direct storage reference (allowlist = the retained rows above, with reasons in the script).
