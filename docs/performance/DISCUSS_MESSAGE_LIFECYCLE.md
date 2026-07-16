# Discuss — Message Lifecycle & Idempotency

**Discuss Stabilization, Unit 1 (Phase 3).** The canonical outgoing-message
contract. Unit 1 covers identity/idempotency only; failed/retry **UX** is Unit 3.

## Lifecycle

```
1 local draft            composer text (+ attachments/products/mentions/reply)
2 optimistic pending     bubble appended immediately, id = `temp_<clientMsgId>`
3 request submitted      POST /api/discuss/mutate {action:"sendMessage", clientMsgId, …}
4 durable ack            row committed in discuss_messages  ← THE acceptance point
5 canonical reconcile    optimistic bubble adopts the server id + created_at
6 delivery               content-free realtime ping → members re-fetch authoritatively
7 success state          bubble rendered as sent
8 failed state           (Unit 3)
9 safe retry             SAME clientMsgId → provably cannot duplicate
```

A message is reported sent **only** after step 4. Optimistic paint (step 2) is
never treated as success.

## Identity

| Field | Origin | Meaning |
|---|---|---|
| `id` | server `gen_random_uuid()` | canonical message identity |
| `client_msg_id` | **client** `crypto.randomUUID()` | one *logical send attempt* |
| `temp_<clientMsgId>` | client | optimistic bubble's local id before ack |

One `clientMsgId` per logical send. **Every retry of that same pending message
reuses it; a genuinely new message gets a fresh UUID.** It is an opaque UUID —
never derived from content, never logged with body text.

## Idempotency

**Schema (additive, deployed):**
```sql
ALTER TABLE public.discuss_messages ADD COLUMN client_msg_id uuid NULL;
CREATE UNIQUE INDEX CONCURRENTLY discuss_messages_channel_client_msg_id_key
  ON public.discuss_messages (channel_id, client_msg_id)
  WHERE client_msg_id IS NOT NULL;
```
Nullable + partial ⇒ legacy rows (all 86 at migration time) and any client that
omits the key are unaffected; zero backfill. Scope is **per channel**, so the
same key in a different channel is a different message.

**Server contract** (`src/app/api/discuss/mutate/route.ts`, `sendMessage`):
1. `isMember(channelId)` — **before** the insert *and* before any replay can
   return a row. A non-member / cross-tenant caller can never reach the
   conflict path.
2. Insert including `client_msg_id`.
3. On `23505` (unique_violation) **with** a `clientMsgId`: re-read the row by
   `(channel_id, client_msg_id)` and return it as
   `{ ok: true, data: existing, idempotent: true }`.
4. The replay path **returns before `notifyMembers()` is dispatched** — the
   winning insert already pinged realtime and sent push, so a replay must not
   chime, badge, or push again.

Any other error is still a real error.

## Ordering (unchanged in Unit 1)

Still `created_at` only, with no `id` tie-breaker — a known **P2** carried into
the ordering unit. Idempotency does not depend on ordering.

## Rollback

Code: revert the unit's commits — the column is nullable, so old code that
omits `clientMsgId` keeps working against the new schema.
Schema (only if the deployed code fails):
```sql
DROP INDEX CONCURRENTLY IF EXISTS discuss_messages_channel_client_msg_id_key;
ALTER TABLE public.discuss_messages DROP COLUMN IF EXISTS client_msg_id;
```

Guards: `npm run validate:discuss-idempotency` (19 assertions).
Evidence: `DISCUSS_RELIABILITY_TEST_RESULTS.md`.
