# Discuss — Realtime Architecture Audit (Phase 1)

Scope: `src/components/discuss/*` (DiscussApp.tsx 4,097 lines), `src/lib/discuss.ts`, `src/lib/server/realtime-broadcast.ts`, `src/app/api/discuss/{read,mutate,recipients,state}/route.ts`, `discuss_*` tables.

---

## 1. Current message lifecycle (documented from code)

### Send (sender's view)
1. User presses Send → `handleSend` builds metadata (attachments/products/mentions), creates an **optimistic bubble** with `temp_${Date.now()}` id and appends it in the same render pass (composer clears immediately). ✔ instant feedback.
2. `sendDiscussMessage` → `POST /api/discuss/mutate {action:"sendMessage"}`.
3. Server: `requireAuth` → membership check → `INSERT` (service-role) → **`await` broadcast pings** (channel topic + every member's account topic; 2.5 s timeout) → **`await` web-push fan-out** to other members' devices → respond `{ok, data}`.
4. Client swaps the temp id for the server id + server `created_at` (so realtime dedupe works), clears the draft, silently refreshes the sidebar.
5. On failure: optimistic bubble removed, text restored into the composer (content never silently lost), but **no failed-state bubble / retry / queue**.

### Receive (recipient's view)
1. Client holds one Broadcast subscription per **open channel** (`discuss:channel:{id}`) + one per-account topic for the sidebar (`discuss:account:{id}`).
2. On ping: incremental fetch of only messages newer than the last-seen cursor (`after=`, limit 60) through the membership-gated read endpoint; `seen` set dedupes; new rows appended. Pings carry **no message content** (safe-by-design even if a topic name leaks).
3. Safety nets: full refetch on window focus/visibility; **5 s interval full-page refetch** of the open channel (limit 120 + joins) — this is the main transport-cost problem (BOTTLENECKS P1-2).

### Ordering, unread, typing, presence
- Order: server `created_at` (client only sorts what the server returns; optimistic row adopts server timestamp on ack). No id tie-breaker yet — same-millisecond pairs could jitter (cosmetic at current volume).
- Unread: per-member `last_read_at` cursor + per-channel count query, short-circuited when `last_message_at <= cursor` (N+1 but bounded; P2-1).
- Typing: Realtime **presence** on the open channel with per-user timeout map; ephemeral, no DB writes. ✔ matches the target design.
- Delivered/read receipts per message: **do not exist** (only the channel-level read cursor).

## 2. Security posture (verified in code)
- All discuss tables are service-role-only; every read/mutate action re-checks membership server-side (`isMember`, admin checks for privileged ops).
- Broadcast topics are unauthenticated *by name* but content-free — worst case an outsider learns "something changed in channel X", never content. Read-back always passes the membership gate.
- Push previews truncate body to 140 chars and go only to channel members' registered devices.
- **Rule for all future work: never put message content on a broadcast payload** (established project constraint; the ping model exists precisely for the RLS lockdown).

## 3. What is already good (keep)
- Optimistic send with reconcile-by-id; drafts persisted per channel; empty-response guard so a transient error can't blank the thread.
- Incremental `after` cursor fetch on ping (one small query per event, not a re-pull).
- Correct channel cleanup on unmount/channel-switch; presence-based typing with expiry.
- DB: sub-ms queries; complete index set incl. `(channel_id, created_at DESC)` and FTS.
- Server already supports `before` cursor pagination — the client just doesn't use it yet.

## 4. Gaps vs the target state machine

| Target | Today | Gap |
|---|---|---|
| queued | — | no offline outbox |
| sending | ✔ (optimistic bubble + `sending` flag) | flag also blocks rapid consecutive sends until ack (worsened by P1-1) |
| sent | ✔ (id swap on ack) | ack is slow because pings+push are awaited (P1-1) |
| delivered | — | needs per-message or per-cursor receipt (Phase 5/6) |
| read | channel-level cursor only | per-message read = derive from members' cursors (no schema change needed for group-level "read up to here") |
| failed | composer-restore only | needs in-thread failed bubble + Retry + backoff (P1-4) |
| idempotency | none | `client_message_id` unique per (channel, author) (P1-4) |
| ordering tie-break | created_at only | add `id` as secondary sort key (one-line client+server change) |
| history pagination | server ready, client missing | wire `before` cursor + scroll anchoring (P1-3) |
| reconnect model | focus refetch + poll | formal connecting/offline/degraded states + missed-event cursor catch-up (Phase 8) |
| multi-tab | independent subscriptions per tab (works; N tabs = N subscriptions) | acceptable; consider BroadcastChannel dedupe later |

## 5. Latency budget (why receivers see what they see)

DB insert ≈ 0.5 ms. Everything else is HTTP:
```
sender ack   = auth + insert + [awaited ping POST] + [awaited push fan-out]   ← P1-1 removes the bracketed terms
receiver     = broadcast propagation (~100–300 ms) + incremental fetch round trip (one API call)
worst case   = next poll tick (≤5 s today; becomes ≤20–30 s tick + ping-primary after P1-2 — ping remains the fast path)
```
With P1-1+P1-2 applied, expected steady-state: sender-visible <50 ms (optimistic, already true), sender "sent" ≈ one API round trip, receiver-visible ≈ 0.3–1.0 s on reasonable networks — within the Phase 11 targets. Long-haul geography (e.g., China ↔ us-east) adds unavoidable RTT; report honestly, don't promise zero.

## 6. Recommended sequence (maps to roadmap phases 5–9)
1. **P1-1** move ping+push off the ack path (server-only, 1 commit).
2. **P1-2** poll → 20–30 s incremental tick, skip while broadcast healthy (client, 1 commit).
3. **P1-3** older-message pagination with scroll anchoring (client, 1 commit).
4. **P1-4** `client_message_id` idempotency (gated additive migration) + failed/retry bubbles + localStorage outbox.
5. Connection-state model + reconcile-after-reconnect (cursor catch-up instead of full refetch).
6. Delivered/read receipts from member cursors; ordering tie-breaker.
7. Attachments flow polish (progress, cancel, no thread blocking) — audit found uploads already don't block the composer, deep pass deferred to Phase 9.
8. Virtualization only after history depth grows (measure first).
