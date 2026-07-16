# Discuss Stabilization — Unit 2 / Run A Results

**Status: Run A complete and deployed to PREVIEW ONLY. Unit 2 is NOT closed.**

| | |
|---|---|
| Production (`main`) | `b433a8a7` — **Unit 1 idempotency only** |
| Preview branch | `discuss-attachments-run-a-preview` @ `875c590c` |
| Preview deployment | READY, region `hnd1`, `target: null` (preview) |
| Ahead / behind main | 7 commits ahead, 0 behind, 19 files |

## No production claim is made

Run A changes **no production behaviour**. Discuss attachments in production are
still delivered exactly as before: six objects remain world-readable in the
public `media` bucket. **Do not describe Discuss attachments as secured.**

## Commits

| SHA | Title | Files |
|---|---|---|
| `f1a39df5171d` | discuss media model and resolver hardening | 2 |
| `806a8ffde5d8` | private Discuss upload policy | 4 |
| `8680ea74b181` | safe Discuss message and draft serialization | 5 |
| `7e0d5992bdf1` | first-party Discuss media client | 2 |
| `04673fbd2501` | optimistic media preview lifecycle | 2 |
| `0706c715f7c5` | Discuss attachment guards and tests | 3 |
| `875c590c2be1` | Run-A documentation | 1 |

Ordering note: `DiscussApp.tsx` carries both the client-safe media contract and
the object-URL lifecycle, so it lands with the manager (commit 5) rather than
being split — dependencies precede dependents and every commit builds.

## Verification actually performed

| Check | Result |
|---|---|
| `validate:discuss-attachments` | **135 / 135** |
| `validate:discuss-idempotency` | **19 / 19** (Unit 1 intact) |
| `tsc --noEmit` | exit 0 |
| `next build` (clean `.next`) | **exit 0**, 491 pages |
| Local built Discuss chunk | `/api/files/discuss` present; **0** each of `storage/v1/object/public`, `api/storage/signed-url`, `supabase.co/storage`, `file_path` |
| Secret scan (Discuss surface) | clean (only comments naming `service_role`) |
| `package.json` diff vs main | exactly 1 line (the validator script) |
| Unrelated modules touched | none — tree built from main + 19 blobs |
| Vercel Preview build | **success / READY** (`4JTa9gYZQ7pS2pgvpoado7iB4Xo5`) |

## Verification NOT performed — and why

**Preview endpoint checks are blocked by Vercel Deployment Protection.** Every
request to the Preview alias returns `302 → vercel.com/sso-api`. That is the
platform's SSO gate, not the application. Therefore:

- `/discuss` returning 200 — **NOT verified** (SSO intercepts).
- unauthenticated `/api/files/discuss/<id>/<index>` returning 401 — **NOT
  verified**. It is denied at the edge, but that proves nothing about the
  resolver's own authorization.
- deployed client chunk scan — **NOT performed**; the chunks are behind SSO.
  The clean local build of the identical tree was scanned and is clean, which is
  strong but is not the deployed artifact.

Clearing these needs either a Vercel protection-bypass token or an authenticated
session — which is Run B's job.

## Production data state (verified post-push)

| Invariant | Value |
|---|---|
| `discuss-media` objects | **0** (bucket still inert) |
| `discuss-voice` objects | 0 |
| `media` bucket public | true (unchanged — shared with 4 other apps) |
| `media` objects | 6,694 (unchanged) |
| Legacy voice messages w/ public URL | **5** (untouched) |
| Legacy attachment messages w/ public URL | **1** (untouched) |
| Draft rows | 0 |

The six legacy objects are untouched, as required.

## Rollback

- **Preview**: delete branch `discuss-attachments-run-a-preview`. Production is
  unaffected — it was never merged.
- **Bucket**: `DELETE FROM storage.buckets WHERE id='discuss-media';` (safe
  while empty).
- **Never** roll back to public delivery. If an emergency arises after a future
  promotion, disable attachment opening rather than re-exposing public URLs.

## Run B prerequisites

1. A way to reach the Preview past Deployment Protection (bypass token or
   authenticated session).
2. Controlled fixture accounts across two tenants, plus a removed-member and a
   non-member in the same channel.
3. The matrix: image 200 · document 200/206 · audio Range 206 + seek · non-member
   404 · removed member 404 · cross-tenant 404 · unauthenticated 401 · deleted
   message 404 · invalid/negative/out-of-range index 404 · both-shapes canonical
   index · logout/account-switch old URL · HEAD authz · POST 405 · repeated-Range
   byte identity · SVG/HTML forced download · private cache headers · service
   worker excludes `/api/files/*`.
4. Fixtures must be cleaned; `discuss-media` returns to 0 objects afterwards.

## Run C (separate, gated)

Migrate the six legacy objects (copy → byte/checksum verify → metadata update →
revoke), then remove `media` from the Discuss resolver allowlist and assert it
cannot return. Not started.
