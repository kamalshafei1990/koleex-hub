# Discuss Unit 2 — Run B results

Status: **EXECUTED AND PASSED.** Fixtures removed; zero residue verified.
Run C not started. Production remains `b433a8a7`.

Executed against Preview deployment `4V2dMye8raGSbvA6gXEWZbK9cZ5Z`
(`koleex-m94r44058`), branch `discuss-attachments-run-a-preview`, pointed at the
Discuss-scoped staging project `gmtjbshjsuexqayqumix`.

## Environment isolation (pre-conditions)

| check | result |
|---|---|
| Bundle: staging ref present | 2 chunks |
| Bundle: production ref anywhere | **0** |
| Supabase hosts served to browser | staging only |
| Production-scoped credentials reachable by Preview | **0** (raw + JWT-decoded scan of every resolved var) |
| Server actually reaches staging | **proved by login** — `sa@test.invalid` resolved to account `66666666-…-000000000001`, a row that exists only in staging |

The service-role key was verified as genuine before use: it returned **all 6**
`discuss_messages` rows, i.e. it bypasses RLS. An anon-class key returns `[]`
against the same table (RLS deny-all), which is how a publishable key that had
been configured by mistake was caught before it could produce a false green.

## A — Login gate

| account | expected | actual |
|---|---|---|
| `sa` / `admin` / `employee` / `removed` / `customer` / `tenantb` | login OK | **OK** |
| `disabled` (status=inactive) | rejected | **403** |

## B — Authorized members (tenant A, active membership) → 200

| account | M1/0 image | M2/0 doc | M3/0 voice | M4/0 | M4/1 | M4/2 voice |
|---|---|---|---|---|---|---|
| sa | 200 | 200 | 200 | 200 | 200 | **200** |
| admin | 200 | 200 | 200 | 200 | 200 | **200** |
| employee | 200 | 200 | 200 | 200 | 200 | **200** |

`M4/2` is the load-bearing case: voice at index **2**, behind two attachments.
It proves the canonical index model (voice appended after attachments) resolves
correctly on a mixed message — the exact case that a "voice is index 0"
assumption gets wrong.

## C — Denials → 404 (uniform; no existence oracle)

| case | actual |
|---|---|
| deleted message (`deleted_at` set) | **404** |
| cross-tenant (tenant-A user → tenant-B message) | **404** |
| out-of-range index (`M1/5`) | **404** |
| negative index (`M1/-1`) | **404** |
| removed member (`left_at` set) | **404** |
| non-member (customer, tenant A) | **404** |
| tenant-B user → tenant-A message | **404** |
| tenant-B user → **own** tenant message | **200** |

That last row matters: it shows the 404s are real authorization decisions, not a
blanket denial that would pass this matrix for the wrong reason.

## D — Unauthenticated → 401

| case | actual |
|---|---|
| no session | **401** |
| malformed message id | **401** (no 400/404 distinction — no oracle before auth) |
| path traversal | **403** (rejected at the edge before reaching the app) |

## E — Response headers (authorized, image)

```
HTTP/2 200
accept-ranges: bytes
cache-control: private, max-age=0, must-revalidate
content-disposition: inline; filename="runb-image.png"
content-type: image/png
x-content-type-options: nosniff
content-length: 67
```

Success path is `private` — correct. Bytes verified: PNG magic `89504e47`.

## F/G — Range

```
Range: bytes=0-9  ->  HTTP 206
content-range: bytes 0-9/36
cache-control: private, max-age=0, must-revalidate
```

**Range re-authorizes.** A removed member sending a `Range` header gets **404**,
not 206 — authorization is re-checked per request, including partial requests, so
a previously-granted stream cannot be resumed after access is revoked.

## I — Client-safe media contract (live payload)

`GET /api/discuss/read?resource=channelMessages` as an authorized member,
verified **structurally** (not by substring — an early substring check produced a
false "voice" hit by matching `"kind":"voice"` and the filename `voice-note`):

| assertion | result |
|---|---|
| messages returned | 5 |
| `metadata.attachments` key present | **0** |
| `metadata.voice` key present | **0** |
| media items total | 7 |
| media keys outside the allowlist (`index,name,type,size,kind,duration_ms,waveform`) | **0** |
| `url` / `bucket` / `path` / `file_path` / signed URLs anywhere in payload | **0** |

No storage locator of any kind reaches the browser. The client receives only
(message id, canonical index) and display metadata.

## Cleanup — zero residue

Cleanup ran through the staging guard (`staging:cleanup-discuss-run-b`), scoped
by deterministic id. Verified **independently against the database**, not only by
the script's own reporting:

| table | rows |
|---|---:|
| tenants, roles, people, companies, contacts, accounts | **0** each |
| discuss_channels / members / messages / reactions / pinned / starred / drafts | **0** each |
| `storage.objects` (all buckets) | **0** |
| `storage.buckets` | 2 (kept — infrastructure, not fixtures) |

Schema, RLS, indexes, triggers and the realtime publication remain in place, so
Run B is repeatable via `staging:seed-*` without re-running any migration.

## Verdict

Every claim Unit 2 Run A made about attachment authorization is now demonstrated
against a live deployment with real HTTP:

- authorization is re-checked **on every request**, including Range;
- revoked membership, disabled accounts, deleted messages, cross-tenant access
  and non-members are all denied uniformly with 404;
- the canonical index resolves voice correctly behind attachments;
- no storage locator reaches the client.

## Not done (deliberate)

- **Run C** — legacy revocation. The six legacy production objects are untouched.
- **Production promotion** — branch remains Preview-only; `main` is `b433a8a7`.
- **Unit 3** failed/retry UX.

## Known non-breach carried forward (P3)

The unauthenticated 401 carries `cache-control: public, max-age=0,
must-revalidate` — Next.js's default on `requireAuth()`'s response, not this
route's success path (which is `private`, confirmed above). No user data in the
body and nothing is served stale, but the `public` token contradicts the
requirement. Still logged, still not fixed.
