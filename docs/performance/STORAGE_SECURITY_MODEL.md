# Storage Delivery Security Model (China R3)

Applies to `/api/files/[...ref]` (private/file streaming) and the `/_next/image` pipeline (public images). RLS, storage bucket policies, and application permissions are unchanged by R3 — this layer only adds a first-party delivery path on top of them.

## Invariants

1. **No client-supplied URLs or paths.** The route accepts `category/id[/index]` only; every object path is resolved server-side from the owning DB record. A forged path cannot be expressed in the API.
2. **Bucket allowlist.** Resolved paths must land in the expected bucket for the category (`catalog → media`, `discuss → media`); anything else is rejected before any storage call.
3. **Path hygiene.** Resolved paths are rejected if they contain `..`, `\\`, `//`, a leading `/`, URL-encoded traversal (`%2e`, `%2f`, `%5c`), or a zero length — defense-in-depth even though paths come from our own DB.
4. **AuthN before AuthZ before I/O.** Session cookie → `requireAuth` (401 on none); then per-category record-level authorization; only then a storage fetch.
5. **Record-level authorization, not module-only:** `discuss` verifies an active membership row (`channel_id + account_id, left_at IS NULL`) for the message's channel — a user removed from a channel loses attachment access immediately. `catalog` verifies the catalogs module permission (`requireModuleAccess`).
6. **No existence oracle.** Missing record, missing file, wrong bucket, and unauthorized all return the same **404** body.
7. **Service-role key never leaves the server.** The upstream fetch uses the server env key inside the Node route; no redirect to a Supabase URL is ever returned (the China-resilient purpose forbids it).
8. **Content safety.** `X-Content-Type-Options: nosniff` always; `Content-Disposition: inline` only for an image/PDF/audio/video allowlist — SVG, HTML, XML, and anything unknown is forced to `attachment` so stored content can never execute in the app origin.
9. **Resource limits.** 200 MB Content-Length cap (413), 50 s upstream abort (504), streaming pass-through (no full-file buffering in function memory), `Range` forwarded verbatim and 206/416 passed through.
10. **Private caching.** `Cache-Control: private, max-age=0, must-revalidate` — no shared/CDN cache entry exists for private responses, so cross-account/organization cache leakage is structurally impossible; a logged-out browser must revalidate (back-navigation after logout re-hits the route → 401/404).
11. **Privacy-safe logging.** One `[kx-file]` line per request: category, id, bucket, HTTP status, bytes, duration. Never file names, paths, or user identifiers.
12. **Image pipeline scope.** `remotePatterns` matches only the exact project hostname and `/storage/v1/object/public/**` (+ render) paths — the optimizer cannot be used as an open proxy, cannot reach private buckets, and rejects any other host with 400.

## Security test matrix (Step 4)

| Scenario | Expected | Status |
|---|---|---|
| Authenticated + authorized (member / module) | 200/206 stream | code path; needs authenticated harness (Phase 12) |
| Authenticated, NOT channel member | 404 (no oracle) | enforced by membership query — code-verified |
| Unauthenticated | 401 | **verified live** (route returns 401 without session) |
| Cross-organization access | 404 (record resolution is tenant/membership-scoped) | code-verified |
| Removed from Discuss channel | 404 (left_at check) | code-verified |
| Archived/deleted message or catalog | 404 (row filters) | code-verified |
| Forged file ID (random UUID) | 404 | code-verified + live (unauth layer) |
| Forged bucket path / traversal (`..`, `%2f` …) | impossible via API; hygiene layer rejects | code-verified |
| Unexpected MIME | forced `attachment` + nosniff | code-verified |
| Oversized file | 413 before body streaming | code-verified |
| Revoked access / expired session | next request 401/404 (no cached copy is shared) | code-verified |
| Multiple accounts same browser | per-request session evaluation; `private` cache + must-revalidate | code-verified |
| Logout → back navigation | revalidation → 401 | code-verified |
| Cached private-file isolation | no shared cache key exists | by construction |

"Code-verified" = enforced by the shipped implementation and reviewable in the route source; the authenticated end-to-end matrix requires the Phase 12 test harness (this environment cannot sign in — documented limitation since Phase 3).


> **Harness:** the matrix above is now executable via `npm run validate:file-delivery` (see FILE_DELIVERY_AUTH_TEST_RESULTS.md for executed vs credential-blocked rows).
