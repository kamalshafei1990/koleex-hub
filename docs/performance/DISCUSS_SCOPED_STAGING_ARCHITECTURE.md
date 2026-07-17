# Discuss-scoped staging environment for Unit 2 Run B

Scope name (official): **Discuss-scoped staging environment for Unit 2 Run B**.

This is **not** a full Koleex Hub staging environment and must not be described
as one. It reproduces exactly the slice of the schema that the Discuss
attachment-authorization matrix needs, and nothing else. Any other module
pointed at this project will find its tables missing — that is by design, not a
gap to fill.

## Projects

| role | ref | note |
|---|---|---|
| Production | `yxyizbnfjrwrnmwhkvme` | never a target; hardcoded **denylist** value |
| Discuss staging | `gmtjbshjsuexqayqumix` | ap-northeast-1, PG 17.6, $10/mo |

## Why a separate project rather than a Supabase branch

The repo holds **83 migrations**; production has **211 applied**. The repo is not
the schema source of truth, so a branch created from migration history would
produce a schema that does not match production — a staging environment that
silently disagrees with prod is worse than none. Database branching also does
not cover Auth and Storage, and Run B needs Storage. See
[MIGRATION_HISTORY_DRIFT.md](./MIGRATION_HISTORY_DRIFT.md).

The schema here was therefore extracted from **live production introspection**
(`pg_get_constraintdef` / `pg_get_indexdef` / `pg_get_functiondef` / `pg_policies`),
not from the migration folder.

## Scoped table set — 13 tables

The set is the **FK closure** of `discuss_*`, computed with a recursive CTE over
`pg_constraint contype='f'`. It is not a hand-picked list:

- Discuss (7): `discuss_channels`, `discuss_members`, `discuss_messages`,
  `discuss_reactions`, `discuss_pinned`, `discuss_starred`, `discuss_drafts`
- Identity/authz reached by FK (6): `accounts`, `people`, `companies`,
  `contacts`, `roles`, `tenants`

`contacts` is recreated with its **full production shape (249 columns)**,
structure only. **Zero production rows were copied into this project.**

## Storage

| bucket | public | limit | MIME |
|---|---|---|---|
| `discuss-media` | **no** | 50 MB | 13 types (4 image + 9 document) |
| `discuss-voice` | **no** | 25 MB | 5 audio types |

Verified from outside: the public URL form returns **HTTP 400** for both buckets
and an anon-key download is refused. `storage.objects` carries **zero policies**.

The shared public `media` bucket is **not** reproduced here. Run B does not need
it, and creating a public bucket in a staging project used to prove that public
delivery is gone would be self-defeating.

## Deliberate exclusions

| excluded | why |
|---|---|
| `trg_sync_accounts_avatar`, `trg_sync_people_avatar` | avatar mirroring; irrelevant to Discuss authorization |
| `trg_sync_role_flags_to_koleex_roles` | depends on `koleex_roles`, which is outside the scoped set |
| `accounts.created_by` / `people.created_by` → `auth.users` FKs | residual Supabase-Auth links; the app uses custom auth (`accounts` + argon2 + `koleex_session`) |
| the public `media` bucket | see above |
| Software Center assets | **outside the Discuss-scoped staging data set.** `src/lib/software-center.ts` derives its base URL from `NEXT_PUBLIC_SUPABASE_URL` and renders a local placeholder (`/icon-512.png`) when assets are absent. It must never fall back to Production Storage. On staging its images are expected to be missing. |

## A deliberate divergence from production

`accounts.tenant_id` and `contacts.tenant_id` carry a **hardcoded production
tenant UUID as their DEFAULT** in production. That default is **not** reproduced
here: on staging both columns are `NOT NULL` with no default, so a fixture row
must name its synthetic tenant explicitly. Reproducing the default would let a
row silently inherit a production tenant id by omission — the one class of
value that must never appear in this project.

This is the only intentional column-level difference. It is listed in
[DISCUSS_SCOPED_SCHEMA_PARITY.md](./DISCUSS_SCOPED_SCHEMA_PARITY.md).

## Preview wiring

Preview for branch `discuss-attachments-run-a-preview` is pointed at staging via
**branch-scoped** Vercel variables, which override the general Preview rows
without editing them and without touching Production:

`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`KX_ENVIRONMENT=staging`, `SUPABASE_SERVICE_ROLE_KEY`.

`NEXT_PUBLIC_*` is inlined at build time, so any change requires a **new build** —
redeploying an existing build cannot pick it up.

## Isolation gate

Run against real downloaded bundles from the deployed Preview:

```
/discuss -> HTTP 200 ; 13 chunks (1,031,740 bytes)
supabase hosts served:  https://gmtjbshjsuexqayqumix.supabase.co   (staging only)
1. STAGING ref present : 2 chunks   (need >=1)  PASS
2. PROD ref anywhere   : 0 files    (need ==0)  PASS
3. Supabase client chunk: clean               PASS
```

The gate is not satisfied by the bundle alone: Preview must also hold **no
production Supabase credential**. See the service-role note in
[DISCUSS_RUN_B_STAGING_READINESS.md](./DISCUSS_RUN_B_STAGING_READINESS.md).
