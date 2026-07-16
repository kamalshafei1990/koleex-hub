# Discuss — Reliability Test Results

**Unit 1 — message identity & idempotency.** Evidence for every scenario
required before promotion. Two layers: live-database proofs (real constraint,
real Postgres semantics) and static guards (locks the code contract).

## Layer 1 — live database (project `yxyizbnfjrwrnmwhkvme`)

Executed against production **inside transactions that self-roll-back via a
terminal `RAISE`**, so no real conversation was modified. Residue verified 0
after each run.

| # | Scenario | Method | Result |
|---|---|---|---|
| 1 | Pre-flight: no duplicate non-null keys before indexing | aggregate over `discuss_messages` | ✅ 86 rows / 0 non-null / 0 conflicting pairs |
| 2 | Index is real and enforcing | `pg_index` | ✅ unique=t, valid=t, ready=t |
| 3 | **Same request submitted twice** | duplicate insert, same `(channel, key)` | ✅ **rejected** (`23505`) |
| 4 | **Timeout after commit → retry** | commit, then retry with same key | ✅ `BLOCKED (23505)`; replay returns **same id**; **1** row for the key |
| 5 | **Same key in another channel** | insert same key, different `channel_id` | ✅ allowed (scope is per-channel) |
| 6 | **Legacy NULL rows** | 2× insert with `client_msg_id = NULL` | ✅ both allowed (partial index ignores NULLs) |
| 7 | Existing rows untouched | count NULL legacy rows | ✅ **86**, zero backfill |
| 8 | No fixture residue | count `__kx_*` rows | ✅ **0** |

**Concurrent duplicate submissions:** guaranteed by the same unique index —
Postgres serializes concurrent inserts on the index, so exactly one wins and the
loser raises `23505`, which is precisely the path proven in #3/#4. The server
handles both identically (no `ON CONFLICT DO NOTHING`, so no silent null row).

## Layer 2 — static guards (`npm run validate:discuss-idempotency`, 19/19)

| Group | Asserts |
|---|---|
| Client key lifecycle | UUID per send (not a collidable timestamp); temp id derives from it; key sent every send; lib forwards it |
| Server persistence | reads `clientMsgId`; persists `client_msg_id`; `23505` handled; replay re-reads by `(channel_id, client_msg_id)`; responds `ok:true, idempotent:true` |
| **Authz on the replay path** | membership checked **before** insert; membership checked **before** replay can return; replay returns **before** `notifyMembers` is dispatched |
| Double-send / IME | synchronous `sendingRef` guard; released after settle; Enter suppressed while IME composing |
| Typing / privacy | `client_msg_id` typed nullable; no body logged beside the key |

## Conflict-path contract — verified

| Requirement | Evidence |
|---|---|
| Returns the existing canonical message | DB #4 (`same_id = true`) + guard "replay returns the EXISTING canonical row" |
| Same canonical message id | DB #4 — `first == replay == d4881e22…` |
| Preserves membership + tenant checks | guards: `isMember` precedes both insert and replay |
| Does **not** re-run realtime notification | guard: replay returns before `notifyMembers` is defined/dispatched |
| Does **not** re-run push notification | same — push lives inside `notifyMembers` |
| Reported as successful idempotent reconciliation | `{ ok: true, data, idempotent: true }` |

## Authorization scenarios

Unauthorized / removed member / cross-tenant retry are denied by the **same**
`isMember(channelId)` gate that precedes the insert — a replay cannot bypass it
(statically asserted). Identity is session-derived server-side and never taken
from the request body, so a forged `clientMsgId` can at most collide with the
attacker's *own* message in a channel they are already a member of.

## Not covered by this unit

IME/rapid-Enter/double-click are asserted **statically** (guards above), not via
a browser harness — no e2e runner exists in this repo yet. Failed/retry **UX**
is Unit 3. Ordering tie-breaker remains an open **P2**.
