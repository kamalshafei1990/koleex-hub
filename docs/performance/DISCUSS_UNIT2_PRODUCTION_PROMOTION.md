# Discuss Unit 2 — production promotion result

Status: **PROMOTED AND VERIFIED IN PRODUCTION.**
Run C NOT started. The six legacy objects are untouched.

- PR [#289](https://github.com/kamalshafei1990/koleex-hub/pull/289) — 14 commits, 30 files, +2890/−180, merge commit `cbd9ebde11da`
- Production deployment `dpl_EAfQAApkwM` (`cbd9ebde1`) — **READY**
- Previous production was `b433a8a72` (Unit 1 idempotency)

## Cache-header fix (shipped in this promotion)

Run B found the unauthenticated 401 carried Next.js's default
`public, max-age=0, must-revalidate`: the success path set `private`, the failure
paths set nothing at all. Nothing was ever served stale and no user data sits in
a denial body — but `public` on an authorization decision tells every shared
cache the response is not user-specific, which is exactly what it is.

Now one `CACHE_PRIVATE` constant is stamped by `withPrivateCache()` at **every**
construction site: 404, 401 (re-stamped — `requireAuth()` builds it elsewhere, so
it is not trusted to know this route's policy), 413, 416, 503, 504, and the
200/206 success path. Explicit 405 handlers were added for POST/PUT/PATCH/DELETE/
OPTIONS with an `Allow` header, because Next's synthesised 405 for a missing
export is outside our control and would carry the framework default.

Body and status behaviour are unchanged.

### Verified live in production

| case | status | Cache-Control |
|---|---|---|
| unauthenticated file route | **401** | `private, max-age=0, must-revalidate` |
| POST (405) | **405** | `private, …` + `allow: GET, HEAD` |
| DELETE (405) | **405** | `private, …` + `allow: GET, HEAD` |

Preview (same commit) additionally confirmed **404**, **200** and **206** all
`private`, and **0** responses carrying `public`.

### Regression coverage

14 new assertions in `validate:discuss-attachments`, written against the
mechanism (one constant, one stamping helper) rather than response text, so a new
early-return that skips the helper fails. **Mutation-tested**: reverting the 401
fix fails 2 assertions; deleting the 405 handlers fails 1; restoring passes.
150/150 + 19/19 green, `tsc` 0, build green.

## Production verification

| check | result |
|---|---|
| `/discuss` serves normally | **200** (25,597 bytes); `/` 200 |
| unauthenticated file route | **401** + private cache headers |
| Discuss delivery chunk | `api/files/discuss` present; **0** `supabase.co`, **0** `storage/v1/object/public`, **0** `api/storage/signed-url` |
| new Discuss uploads target private buckets | `discuss-media` (private, 50MB, 13 MIME) and `discuss-voice` (private, 25MB, 5 audio) both exist in production; the client uploader targets `discuss-media`; private buckets return `publicUrl: null` |
| production DB | untouched — 86 messages, 7 channels, 10 accounts, 0 drafts |
| six legacy objects | **untouched**, still in the public `media` bucket |

### A measurement trap worth recording

A first pass appeared to show leaks in production. It was the **test**, not the
code:

1. `DiscussApp` is lazy-loaded via `next/dynamic`, so its chunk is **not**
   referenced by the `/discuss` HTML. Scanning only the 13 HTML-referenced chunks
   scans the shell, not Discuss — which is why `api/files/discuss` looked absent.
2. `discuss-media` / `discuss-voice` in a chunk is **expected**: Run A repoints the
   uploader at the private buckets. Flagging them as leaks was wrong.
3. `supabase.co/storage` reported "absent" only because minification split the
   string across a newline — a **false OK**, not a real pass.

Classifying the actual matches settled it: `/storage/v1/object/public/` belongs to
the `cdnImage` helper (China R3, `NEXT_PUBLIC_KX_FP_IMAGES`) and to the shared
`uploadToStorage` helper used by **non-Discuss** modules against the public `media`
bucket. The one `file_path` in Discuss code is the **write** path
(`uploadDiscussAttachment` builds it from the upload result and posts it to the
server) — Run B proved the server never echoes it back to a client.

Substring counts over minified bundles are not evidence. Locate the symbol and
read the match.

## Still open (deliberate)

- **Run C** — legacy revocation. `media` remains public; **7** Discuss-referenced
  objects still resolve there (the six known legacy objects plus one; exact
  inventory is Run C's job). Until Run C, `media` stays in the Discuss resolver
  allowlist and those objects remain publicly reachable by URL.
- **Unit 3** failed/retry UX.
- No production DB, schema, RLS or data change was made in this promotion.
