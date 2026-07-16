# Discuss-scoped schema parity — staging vs production

Both sides measured with the **same introspection query** run against each
project. Not asserted from the migration files, and not assumed.

Production `yxyizbnfjrwrnmwhkvme` · Staging `gmtjbshjsuexqayqumix`.

## Per-table comparison

`cols` / `constraints` / `indexes` / `policies` — **identical on all 13 tables**.

| table | cols | constraints | indexes | policies | triggers (prod → staging) |
|---|---:|---:|---:|---:|---|
| accounts | 26 | 11 | 12 | 1 | 2 → **1** ¹ |
| companies | 13 | 4 | 4 | 1 | 1 → 1 |
| contacts | 249 | 5 | 15 | 1 | 0 → 0 |
| discuss_channels | 13 | 5 | 4 | 0 | 1 → 1 |
| discuss_drafts | 6 | 4 | 3 | 0 | 1 → 1 |
| discuss_members | 9 | 6 | 5 | 0 | 0 → 0 |
| discuss_messages | 12 | 5 | 5 | 0 | 1 → 1 |
| discuss_pinned | 5 | 5 | 3 | 0 | 0 → 0 |
| discuss_reactions | 5 | 4 | 3 | 0 | 0 → 0 |
| discuss_starred | 4 | 4 | 3 | 0 | 0 → 0 |
| people | 26 | 3 | 4 | 1 | 2 → **1** ¹ |
| roles | 11 | 3 | 3 | 1 | 1 → **0** ¹ |
| tenants | 10 | 3 | 4 | 1 | 0 → 0 |

¹ The only deltas, all deliberate: the two avatar-sync triggers and
`trg_sync_role_flags_to_koleex_roles` (which depends on `koleex_roles`, outside
the scoped set). Documented in the architecture doc.

## RLS

RLS is **enabled on all 13 tables** on both sides. Production has exactly **6
policies** across the set (`service_role_full_access` on accounts, companies,
contacts, people, roles, tenants) — reproduced verbatim.

The seven `discuss_*` tables carry **RLS enabled and zero policies**. That is
not an omission: RLS-on + no-policy is **deny-all** for `anon` and
`authenticated`, while `service_role` bypasses RLS entirely. Discuss data is
therefore reachable only through the server. Verified on staging — `anon` reads
of `discuss_messages`, `discuss_channels` and `accounts` all return `[]`.

## Things that would have been missed by a table-only copy

- **`discuss_messages_channel_client_msg_id_key`** — `UNIQUE (channel_id, client_msg_id) WHERE client_msg_id IS NOT NULL`.
  This partial unique index *is* the Unit 1 idempotency contract (23505 = idempotent success).
  Without it, Run B would appear to pass while idempotency was silently absent.
- **`idx_discuss_members_account_active`** — partial on `WHERE left_at IS NULL`,
  the exact predicate the resolver's active-membership check relies on.
- **`idx_discuss_messages_body_fts`** — a GIN expression index.
- **Realtime publication** — production publishes exactly 4 Discuss tables to
  `supabase_realtime` (`channels`, `members`, `messages`, `reactions`).
  Reproduced. Realtime is not a table property and does not survive a naive copy.
- **4 trigger functions** copied with their `SET search_path` intact.

## Enums

**None.** The scoped set uses `text` + CHECK constraints throughout, so there is
no enum type to recreate.

## Intentional divergence

`accounts.tenant_id` / `contacts.tenant_id`: production DEFAULTs to a hardcoded
production tenant UUID. Staging has **no default** (still `NOT NULL`). Rationale
in the architecture doc — a staging row must never be able to inherit a
production tenant id by omitting the column.

## Row counts

Staging holds **only synthetic fixtures**. Zero production rows were copied.
