# File Delivery — Authorization Test Results (EXECUTED)

**Date:** 2026-07-15 · **Environment:** production (`hub.koleexgroup.com`, deployment `50d32741`) against controlled temporary fixtures — chosen because only production reproduces the real auth/RLS/permission/resolver/storage stack. All fixtures removed after the run (see `FILE_DELIVERY_TEST_FIXTURES.md`). **Harness:** `scripts/validate-file-delivery.mjs` + direct HTTP matrix. Fixtures created via service-role SQL; probe passwords temporarily set to a reversible legacy value and **restored to their original argon2id hashes afterward** (verified: the test password is now rejected 401). No real customer files or accounts modified; the range fixtures pointed at an existing non-sensitive supplier-catalog PDF (read-only; only status/byte-length/magic-bytes were inspected, never contents).

## 🔴 Defect found + fixed (before broad sign-off)
**Cross-organization catalog isolation.** `/api/files/catalog/<id>` checked only the Catalogs module permission, not the tenant — a module-holder/super-admin in Org B could fetch an Org A catalog PDF by id, while `/api/catalogs` (list) already scopes by tenant. **Confirmed live** (foreign-tenant catalog returned 200). **Fixed** (`50d32741`): resolver now `.eq("tenant_id", auth.tenant_id)`; foreign catalog now → 404. Regression assertion added (`--foreign`). Matrix re-run after fix: all green.

## Executed matrix (post-fix, deployment 50d32741)

| # | Scenario | Expected | Result |
|---|---|---|---|
| 1 | Authorized (own-tenant) catalog | 200 | ✅ 200 |
| 2 | Authorized valid Range `0-1023` | 206 + Content-Range | ✅ 206, `bytes 0-1023/5290367` |
| 3 | User without Catalogs module | uniform 404 | ✅ 404 |
| 4 | **Cross-org foreign-tenant catalog** | uniform denial | ✅ **404 (was 200 pre-fix)** |
| 5 | Unauthenticated | 401 | ✅ 401 |
| 6 | Forged category | denial | ✅ 404 |
| 7 | Forged identifier | uniform 404 | ✅ 404 |
| 8 | Path traversal (`..%2f`) | denial | ✅ 404 |
| 9 | Invalid Range syntax (`bytes=abc`) | 416 or safe | ✅ safe (malformed range ignored → 200 full) |
| 10 | Range beyond file length | 416 | ✅ 416 |
| 11 | Active Discuss member → attachment | authorized | ✅ 200 |
| 12 | Non-member (same tenant) → attachment | denial | ✅ 404 |
| 13 | Deleted (soft) message attachment | denial | ✅ 404 |
| 14 | Out-of-range attachment index | denial | ✅ 404 |
| 15 | Unsupported method (POST) | 405 | ✅ 405 |
| 16 | HEAD (Next auto-derives from GET) | safe + permission-checked | ✅ 401 unauth / 200 authed |
| 17 | Logout → reuse prior private URL | denial | ✅ 401 (no cached grant) |
| 18 | Account switch (customer cookie on admin's file) | no exposure | ✅ 404 (= #3, per-request session eval) |

## Content-correctness & partial-fetch (Range)
- 16-byte range of a **5,290,367-byte** PDF transferred **exactly 16 bytes** — proves initial view/partial reads do **not** download the whole file.
- First bytes are the `%PDF` magic → correct object served; repeated identical range → byte-identical (stable content).
- `Accept-Ranges: bytes`, `Content-Range` correct, `Content-Length` per-range.

## Cache isolation
- Private response headers: `Cache-Control: private, max-age=0, must-revalidate` · `X-Content-Type-Options: nosniff` · `Content-Disposition: inline; filename="…"`. No public/shared-CDN directive → no cross-account/org reuse possible.
- Logout → prior URL 401 (revalidation, no shared cache entry).
- **Service worker** (`public/sw.js`): cache-first for `/_next/static/` **only**, explicitly **never `/api/*`** → private file responses are never stored by the PWA/SW cache.

## Blocked tests
None remained blocked — the full matrix executed. (Earlier "credential-blocked" status is now superseded.)

## Privacy / secret handling
Service-role key read only from environment (Supabase MCP, server-side) — never written to source, git, docs, logs, or output. Test emails used the `@test.invalid` sink. Logs/report contain no key, token, cookie, message body, or file contents. Secret scan of the repo tree: only the env-var *name* appears (as a placeholder in the harness usage line) — no literal keys.

**Verdict: Discuss attachment migration is APPROVED from a security standpoint** — membership + deleted-message + non-member + index-bounds + logout + cache isolation all verified. (Product decision to migrate remains the owner's.)
