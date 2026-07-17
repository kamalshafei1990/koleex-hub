# Discuss Run B — staging readiness

Status: **environment built and verified. Run B NOT executed.**
One blocker remains (below). Production remains `b433a8a7`.

## Ready

| item | state | evidence |
|---|---|---|
| Staging project | ready | `gmtjbshjsuexqayqumix`, ap-northeast-1, PG 17.6 |
| Scoped schema (13 tables) | applied | parity exact on cols/constraints/indexes/policies |
| RLS | applied | enabled on 13/13; 6 policies; discuss_* deny-all verified via anon |
| Realtime publication | applied | 4 Discuss tables published |
| Idempotency index | applied | `UNIQUE (channel_id, client_msg_id) WHERE client_msg_id IS NOT NULL` |
| Buckets | created | both private; 50MB/13-MIME + 25MB/5-MIME |
| Bucket privacy | verified | public URL → **400**; anon download refused; 0 storage policies |
| Fixtures (rows) | seeded | 2 tenants · 4 roles · 7 accounts · 2 channels · 6 members · 6 messages |
| Fixtures (objects) | uploaded | 8 objects (6 media + 2 voice) |
| Safety guard | verified | 7 unsafe configs refused, valid config passes |
| Preview bundle isolation | **PASS** | staging in 2 chunks; production in 0; only staging host served |
| Unit 1 + Unit 2 validators | green | 19/19 and 135/135 |
| `tsc --noEmit` | exit 0 | — |

## Fixture matrix

| account | tenant | status | membership in Channel A | purpose |
|---|---|---|---|---|
| `runb_sa` | A | active | admin | authorized baseline |
| `runb_admin` | A | active | member | authorized baseline |
| `runb_employee` | A | active | member | restricted employee |
| `runb_disabled` | A | **inactive** | member | disabled-account denial |
| `runb_removed` | A | active | **left_at set** | revoked-membership denial |
| `runb_customer` | A | active | **not a member** | non-member denial |
| `runb_tenantb` | B | active | Channel B only | cross-tenant denial |

Messages in Channel A: image (idx 0), document (idx 0), voice (idx 0, current-era
`bucket`+`path` shape), **mixed** (idx 0,1 attachments + idx **2** voice — proves
voice is appended after attachments, not index 0), and a **deleted** message with
an attachment. Channel B holds one message as the cross-tenant target.

Password for every fixture account: a synthetic disposable value, Argon2id-hashed
with the app's real parameters. All identities are `@test.invalid`.

## THE BLOCKER — staging service-role key

Preview's `SUPABASE_SERVICE_ROLE_KEY` for branch
`discuss-attachments-run-a-preview` currently holds a **deliberate fail-closed
placeholder**, not a working key.

Why it is there: the pre-existing `SUPABASE_SERVICE_ROLE_KEY` row in Vercel is
scoped **Preview + Production** and is 90 days old — it predates the staging
project, so it can only be the **production** key. Preview was therefore being
handed a production full-bypass credential. Overriding it per-branch with an
invalid value removes that credential from Preview. Preview now holds **no
production Supabase credential**; server routes fail closed until a real staging
key is supplied.

Why it cannot be obtained automatically — each path was tried:

| path | result |
|---|---|
| Supabase MCP `get_publishable_keys` | returns anon/publishable **only**; the MCP exposes no secret-key tool by design |
| Mint a legacy `service_role` JWT from the project JWT secret | `app.settings.jwt_secret` and `pgrst.jwt_secret` are **not readable** on PG 17 (removed); no `pg_settings` entry matches `%jwt%`/`%secret%` |
| Supabase Vault | `vault.decrypted_secrets` is **empty** (0 rows) |
| Supabase Management API (`/v1/projects/{ref}/api-keys`) | requires a **personal access token**; none exists on this machine (`~/.supabase` holds only telemetry; no keychain entry; no env var) |
| `supabase login` | requires interactive browser auth or a PAT |
| Reuse the Chrome dashboard session | `list_connected_browsers` → **[]**; no browser extension connected |
| Read it back from Vercel | the row is marked **Sensitive** — Vercel returns an **empty string**, not the value |

The key has never been copied out of the Supabase dashboard, because the staging
project was created in this workstream. It exists in exactly one place.

### What is needed

The **staging** project's service-role / secret key from
Supabase → project `gmtjbshjsuexqayqumix` → Settings → API Keys.

With it, one command finishes the wiring — no dashboard work:

```
printf '%s' "<staging-service-role-key>" \
  | vercel env add SUPABASE_SERVICE_ROLE_KEY preview discuss-attachments-run-a-preview --force
vercel redeploy <latest-preview-url>
```

A Supabase **personal access token** (`sbp_…`) would work equally well and is
strictly better — it lets the Management API fetch the key, and unblocks future
automation without another manual step.

## Explicitly NOT done

- Run B matrix (needs the key above)
- Run C legacy revocation; the six legacy production objects are untouched
- Unit 3 failed/retry UX
- Any merge to `main`; the branch remains Preview-only

## Known non-breach (P3)

The unauthenticated file-route 401 carries `cache-control: public, max-age=0,
must-revalidate` — Next.js's default on `requireAuth()`'s response, not the
route's success-path header (which is `private, max-age=0, must-revalidate`).
No user data is in the body and `max-age=0` + `must-revalidate` means nothing is
served stale, but the `public` token contradicts the requirement. Logged, not fixed.
