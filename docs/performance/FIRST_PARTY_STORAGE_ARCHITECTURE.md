# First-Party Storage Delivery Architecture (China R3)

**Goal:** browser-facing file/image traffic rides `hub.koleexgroup.com` (proven ~99% reachable from mainland China) instead of `…supabase.co` (~19% mainland failure), without weakening any permission model and without a generic URL proxy.

## Step 1 — Storage usage inventory (measured 2026-07-15)

**Buckets (from `storage.buckets`):**

| Bucket | Public? | Size limit | Contents / modules | Classification |
|---|---|---|---|---|
| `media` | ✅ public | 500 MB | the workhorse (55 code refs): company/contact logos, avatars, product photos (folder prefixes incl. `documents/`, `catalogs/`, `attachments/`), catalog PDFs (32–187 MB), Discuss image/file attachments, software-center installers | public mutable images + public documents + large media |
| `product-assets`, `product-images` | ✅ public | ∞ | product/visual-library imagery | public mutable image |
| `todo-attachments` | ✅ public | ∞ | task attachments | public attachment |
| `discuss-voice` | 🔒 private | 25 MB | voice messages | private attachment |
| `finance-documents` | 🔒 private | 20 MB | finance docs | private document |
| `project-attachments` | 🔒 private | ∞ | project files | private attachment |
| `qa-screenshots` | 🔒 private | 5 MB | QA reports | private image |

**URL generation & authorization today:** all uploads already go through first-party `/api/storage/*` routes (service-role server-side; anon writes closed). Public reads use stored full public URLs; images are centrally transformed by `cdnImage()` / `IMG.*` presets in `src/lib/cdn.ts` (Supabase render endpoint). Private buckets are served via server-created signed URLs. Discuss attachments store `{name,url,file_path,size,type}` in message metadata; catalogs store `file_url`/`file_path`/`cover_url` columns.

## Step 2 — Two delivery strategies

### A. Images → Next.js image pipeline (shipped, kill-switch)
`cdnImage()` now emits **`/_next/image?url=<supabase-object-url>&w=…&q=…`** — the browser talks only to the hub origin; Vercel's optimizer fetches the original from Supabase **server-side (hnd1 ↔ Tokyo, ~ms)**, resizes, and caches at the edge.

- `next.config.ts` `images.remotePatterns` is **narrowly scoped**: exact project hostname, only `/storage/v1/object/public/**` and `/storage/v1/render/image/public/**` paths. Arbitrary hosts are rejected by the framework (400).
- Allowed widths/qualities are an explicit allowlist (`deviceSizes`/`imageSizes`/`qualities`); requested preset sizes snap to the nearest allowed value; aspect ratio preserved (optimizer never crops → matches the previous `resize:"contain"` presets).
- Caching: `minimumCacheTTL` 4 h. Most uploads use unique timestamped paths (effectively immutable → repeated hits are edge-cached); a replaced-in-place image converges within ≤4 h. Public-classified content only — the optimizer route never serves private buckets (remotePatterns only match `public/` paths).
- **Rollback / kill-switch:** env `NEXT_PUBLIC_KX_FP_IMAGES=0` (+ redeploy) reverts `cdnImage()` to the previous direct Supabase render URLs. Non-Supabase URLs always pass through untouched.
- **Coverage (stage 1 as shipped):** every surface that routes through the central `cdnImage`/`IMG` helper — company/brand logos, product imagery, catalog covers, visual-library thumbnails. *Deliberate deviation from the "avatars first" ordering:* the central helper is the single reversible control point and covers logos/product images at once; raw `<img src={avatar_url}>` sites are enumerated for the next stage rather than swept blindly.

### B. Private files & documents → `/api/files/<category>/<id>[/<n>]` (foundation shipped, UI wiring staged)
Identifier-based only — the client can never pass a URL or bucket path. Categories map to DB records with real authorization:

| category | id | Authorization (server-side) | Object resolution |
|---|---|---|---|
| `catalog` | catalogs.id | session + `requireModuleAccess(auth,"catalogs")` | row's `file_path` in `media` |
| `discuss` | messageId + attachment index | session + active `discuss_members` row for the message's channel | `metadata.attachments[n].file_path` in `media` |

The route: Node runtime (streaming; documented choice — Edge lacks the needed body-stream + header control combination and service-key isolation is server-only anyway), fetches the object with the service key from Supabase in-region, **streams** the body (no full-file buffering), forwards `Range` (the Catalogs 32–187 MB PDFs depend on range loading — first-party delivery actually *improves* it because `Accept-Ranges` becomes same-origin visible), sets `X-Content-Type-Options: nosniff`, MIME allowlist with `Content-Disposition: inline` only for safe types (images/PDF/audio/video) and `attachment` otherwise (SVG/HTML can never render inline), `Cache-Control: private, max-age=0, must-revalidate`, 200 MB size cap, 50 s upstream abort. Unauthorized and nonexistent are both **404** (no existence oracle). Full threat model: `STORAGE_SECURITY_MODEL.md`.

## Step 3 — Caching policy matrix

| Class | Delivery | Cache |
|---|---|---|
| Public immutable/versioned image | `/_next/image` | edge + browser, up to 4 h+ (optimizer-managed) |
| Public mutable image | `/_next/image` | same; ≤4 h staleness accepted, or bump the path version |
| Public large docs (catalog PDFs) | `/api/files/catalog/…` | `private` (browser only) — no shared cache keyed on fileId because module access can differ per user |
| Private files/attachments | `/api/files/…` | `private, max-age=0, must-revalidate`; never CDN-cached; no cross-account leakage possible (no shared cache entry exists) |

## Step 5 — Performance & cost (honest)
Proxying doubles transfer for proxied bytes (Supabase→Vercel + Vercel→user) and adds function time for `/api/files` streams; the image optimizer adds Vercel image-transform usage but *reduces* egress vs full-size originals. Supabase→Vercel is now intra-region (fast, and cheap on Supabase egress pricing to same-region proxies is still billed — measure). **No monthly cost estimate is given without usage data** — the `[kx-file]` log line (category, bucket, bytes, ms — no filenames) exists precisely to measure real volume before wider rollout.

## Step 6 — Staged rollout state

| Stage | Category | Status |
|---|---|---|
| 1 | Central-helper images (logos, product, catalog covers) | **SHIPPED** (kill-switch env) |
| 2 | Avatars + remaining raw `<img>` sites | pending (enumerate + swap to helper) |
| 3 | Catalog PDFs → `/api/files/catalog/...` in the viewer (keeps range loading) | route ready; UI wiring pending |
| 4 | Discuss images/attachments → `/api/files/discuss/...` | route ready; UI wiring pending |
| 5–7 | voice messages, finance/project/QA private files, generated exports | resolver-per-category additions pending |

Each later stage: wire one surface, keep the old URL as fallback, verify from mainland probes, watch `[kx-file]` + error rates, then proceed.
