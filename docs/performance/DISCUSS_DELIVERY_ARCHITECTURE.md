# Discuss — Delivery Architecture (Phase 3B)

**Shipped:** 2026-07-15 · commit `6c152b60` · Rollback: env `KX_DISCUSS_INLINE_NOTIFY=1` (no redeploy) or revert the commit.

## What the sender's acknowledgement means (contract)

The `{ok:true, data}` response to `sendMessage` now returns **immediately after the durable INSERT**. At that moment:
- the canonical server message row exists (id + server `created_at`);
- the sender's optimistic bubble can safely reconcile to it;
- authorization was fully enforced (auth + channel membership) *before* the insert.

The ack does **not** mean delivered or read — exactly as before. (A retried HTTP request still creates a second row; client idempotency keys are the gated Phase 5 migration and are unchanged by this work.)

## Stage classification (from the live handler)

| Stage | Class | Placement |
|---|---|---|
| auth + view-as guard | required for acceptance | inline, before insert |
| parse/validate | required for acceptance | inline |
| membership check | required for acceptance (security) | inline |
| `INSERT discuss_messages` | durable acceptance point | inline — ack fires here |
| member-id lookup | needed only for notifications | post-response |
| realtime broadcast ping | delivery signal; idempotent; safe to retry (content-free) | post-response |
| web-push fan-out | optional notification; best-effort; NOT idempotent per attempt but tagged (`tag: discuss:<channel>`) so clients coalesce | post-response |

## Chosen mechanism: Next.js `after()`

`after()` (stable since Next 15.1; this repo runs **16.2.2**) schedules work to run after the response is sent, and **on Vercel it is backed by `waitUntil`** — the function instance is kept alive until the promise settles. It is the platform-supported post-response primitive, not a detached promise racing a freezing lambda.

**Why receiver delivery does not get slower:** the broadcast ping now starts the instant the response is handed to the platform instead of ~one push-fan-out earlier relative to the ack — but the ack itself moved earlier by the same amount, so in wall-clock terms the ping fires within milliseconds of when it fired before. The receiver's path (ping → incremental fetch) is unchanged. The post-ack stages are independently logged (`[kx-server-timing] op=discuss.mutate.post_ack`, stages `member_lookup / rt_dispatch / push_dispatch`) so any regression is directly visible.

## Rejected alternatives

| Option | Why rejected |
|---|---|
| Naive fire-and-forget (`void promise` before return) | On serverless the instance can freeze immediately after the response; ping/push would be silently lost. Explicitly forbidden by the Phase 3 mandate. |
| Database outbox + worker | The right answer at much larger scale, but requires a new table (gated migration), a drain mechanism (cron/queue — none exists in the repo), and ordering/at-least-once machinery. Disproportionate for Phase 3; noted as a Phase 5+ option if push volume grows. |
| Existing queue/job system | Repository has none (checked; only a daily fx-refresh cron in vercel.json). |
| Keep ping inline, defer only push | Viable fallback per mandate, but measurements show every Supabase round trip from iad1 costs ~150–400 ms (Tokyo region), so member-lookup + ping inline would still cost ~2 hops ≈ 0.3–0.8 s. `after()` makes the distinction unnecessary — both run reliably post-response. |

## Failure behavior (unchanged semantics, better isolation)

- `notifyMembers` wraps everything in try/catch/finally: a ping or push failure can never fail (or delay) the send, and is logged with its timing line.
- Ping loss was always possible (fire-and-forget by design, 2.5 s abort); the client safety nets (focus refetch, connection-aware reconciliation from Phase 3C) remain the recovery path.
- Push remains best-effort to registered devices only; a lost push is recovered by the badge/reconcile path, and the `tag` prevents duplicate stacked notifications.
- If `after()` itself were unavailable (non-Vercel self-host without waitUntil support), Next runs the callback in-process after the response; behavior degrades gracefully to the same semantics.

## Verification hooks

- Sender ack: `discuss.send.ack_ms` (client) and `[kx-server-timing] op=discuss.mutate action=sendMessage` — `total_ms` should now ≈ auth+parse+membership+db_insert.
- Post-response work: `op=discuss.mutate.post_ack` lines — one per send; absence = a real reliability problem.
- Receiver: `discuss.recv.fetch_ms` / `discuss.recv.visible_ms` unchanged or better.
