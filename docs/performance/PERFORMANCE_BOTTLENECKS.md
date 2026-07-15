# Koleex Hub — Performance Bottlenecks (Phase 1 Findings)

Severity scale — **P0** severe data/security/reliability or extreme latency · **P1** major user-visible performance issue · **P2** meaningful optimization · **P3** minor polish.

Every finding lists: location · current behavior · evidence · root cause · impact · fix · risk · security note · expected gain · validation · rollback.

---

## P0 — none open

The one P0-class item found this cycle (contacts `SELECT *` at 935 ms mean / 14.4 s max, 71% of all DB time) was **already fixed and verified** (commit `1a08edbc`, now ~79 ms). Recorded here so it is not re-diagnosed.

---

## P1-1 · Discuss send acknowledgement blocks on broadcast + push fan-out

- **Location:** `src/app/api/discuss/mutate/route.ts` — `case "sendMessage"` (~L236–277).
- **Current behavior:** after the INSERT, the handler `await`s `pingChannelActivity(...)` (an HTTP POST to the Supabase realtime edge, 2.5 s abort timeout) and then `await`s `sendPushToAccounts(...)` (one HTTP POST **per subscribed device** to Apple/Google push services) **before** returning `{ok:true}` to the sender.
- **Evidence:** code path (both awaits precede `NextResponse.json`); DB insert itself is sub-ms (pg_stat). Function floor is already 0.5–1.0 s from far geographies; push fan-out can add hundreds of ms to multi-second worst cases.
- **Root cause:** side-effect notifications placed on the critical ack path.
- **User impact:** the sender's optimistic bubble sits in "sending" far longer than necessary; `sending` state also gates the composer's send affordance, throttling rapid-fire messaging.
- **Fix:** return the response immediately after INSERT + membership check; run pings/push after the response (Vercel `waitUntil` or detached promise with error swallow — pings are already fire-and-forget by design elsewhere). Smallest change: reorder + `void` with `catch`.
- **Risk:** low — pings/push are already best-effort; the 5 s poll and focus refetch remain the reconciliation net.
- **Security:** none — no authorization change.
- **Expected gain:** sender ack time ≈ insert round-trip only (roughly halves it; removes multi-second worst cases).
- **Validation:** Phase 2 lifecycle timing (send→ack P50/P95) before/after; receiver still gets ping.
- **Rollback:** restore the awaits (one-commit revert).

## P1-2 · Discuss polls the full message page every 5 s per open channel

- **Location:** `src/components/discuss/DiscussApp.tsx:834` (`setInterval(refreshMessages, 5000)`); `loadMessages` fetches `limit: 120` with author/reaction/reply joins each tick.
- **Evidence:** 8,332 discuss_messages page queries in the stats window (vs 81 messages total); the comment above the code says "every 20s" — the code says 5000 ms (comment/code drift).
- **Root cause:** safety-net poll left at a tight cadence from before broadcast pings became the primary delivery path; poll refetches the *entire* page instead of using the incremental `after` cursor that already exists.
- **User impact:** steady background network + JSON parse + reconciliation churn on every open channel; on weak connections it competes with user actions; battery cost on phones.
- **Fix (smallest safe):** (a) widen to 20–30 s to match its documented intent, (b) make the tick use the incremental `after` cursor (same one the broadcast handler uses) with a periodic full sweep (e.g., every 5th tick) for edits/reactions/deletes, (c) skip ticks while the broadcast channel reports `SUBSCRIBED`.
- **Risk:** low-medium — edits/deletions arrive via full sweeps; keep focus-refetch full.
- **Security:** none.
- **Expected gain:** ~75–90% fewer Discuss background requests; smoother UI on open channels.
- **Validation:** request counts per minute per open channel before/after; two-client message delivery still <1 s via ping.
- **Rollback:** restore 5 s full-page tick.

## P1-3 · No older-message pagination in the Discuss UI (history capped at 120)

- **Location:** client `src/components/discuss/DiscussApp.tsx` `loadMessages` (single fetch, `limit: 120`, no `before` usage). Server already supports cursor pagination (`before` param, `read/route.ts` ~L300) — capability is built but unwired.
- **Evidence:** exactly one `fetchChannelMessages` call site; no scroll-up loader.
- **Impact:** in an active channel, messages older than the latest 120 are unreachable; also blocks any future virtualization strategy.
- **Fix:** scroll-top sentinel → fetch `before: oldestLoaded.created_at` page (50) → prepend with scroll-anchor preservation. Pure client change; server untouched.
- **Risk:** medium (scroll anchoring must be tested on iOS Safari); reversible.
- **Security:** none — same membership-gated endpoint.
- **Expected gain:** full history access; enables smaller initial page later (120→50) for faster channel-open.
- **Validation:** open a >120-message channel, scroll up repeatedly, verify order/no-jump/no-dupes.
- **Rollback:** remove the sentinel.

## P1-4 · Discuss message state machine incomplete (no failed/queued states, no idempotency key)

- **Location:** `DiscussApp.tsx` `handleSend` (~L1100–1195); `discuss_messages` schema (no client_message_id column).
- **Current behavior:** optimistic bubble ✓, reconcile-by-id ✓; on failure the bubble is *removed* and text restored to the composer (content is not lost ✓) — but there is no in-thread `failed` bubble with Retry, no offline queue, no `client_message_id`, so a timeout-then-retry can double-send, and states delivered/read don't exist per message.
- **Impact:** on flaky networks messaging feels lossy ("my message vanished"), and duplicates are possible on manual resend after an ambiguous timeout.
- **Fix (Phase 5):** add nullable `client_message_id uuid` + `UNIQUE (channel_id, author_account_id, client_message_id)` (additive, reversible migration); client generates it per send and upserts on retry; keep failed bubbles in-thread with Retry; persist an outbox in localStorage scoped to account+channel.
- **Risk:** low (additive schema; unique index scoped so cross-account abuse is impossible).
- **Security:** identifier is scoped per author — cannot collide across accounts.
- **Expected gain:** zero silent duplicates, WhatsApp-style failed/retry UX, offline-safe sends.
- **Validation:** Phase 12 tests — duplicate send request, disconnect-before-ack, disconnect-after-persist.
- **Rollback:** drop index/column; client falls back to current behavior.

---

## P2-1 · Sidebar unread counts are N+1 count queries

- **Location:** `src/app/api/discuss/read/route.ts` `myChannels` (~L196–211): one `count:'exact'` query per channel with activity newer than the member's cursor.
- **Mitigation already present:** short-circuits to 0 via `last_message_at <= last_read_at` — only *active* channels pay.
- **Impact:** trivial at 7 channels; linear growth with channel count.
- **Fix (when channel count grows):** single grouped query (`select channel_id, count(*) ... where created_at > cursor group by channel_id` via RPC), or a maintained per-member unread counter. Not urgent now.
- **Validation:** myChannels wall time and query count before/after.

## P2-2 · 470 `select('*')` sites in API/lib

- **Evidence:** grep count (excludes the fixed contacts LIST_COLUMNS path).
- **Assessment:** most touch small tables — *not* an emergency; the class of bug is proven dangerous only when a table carries blobs (contacts, 22 MB) or grows. Two tables deserve early projection work: `quotations` (4.2 MB, A4 snapshots) and `visual_assets` (5.8 MB, 5k rows — list already slimmed via `?view=list`).
- **Fix:** Phase 13 rule (no new `select('*')` on list endpoints without justification) + opportunistic slimming of the top-N by table size. No mass rewrite.

## P2-3 · Oversized client components (bundle + render cost)

- **Evidence:** `Contacts.tsx` **748 KB**, `QuotationA4Preview.tsx` 428 KB, `ProductForm.tsx` 300 KB, `catalogs/page.tsx` 212 KB, `DiscussApp.tsx` 160 KB (4,097 lines), `CRM.tsx` 156 KB.
- **Impact:** each is one client chunk parsed on that app's first open; also broad re-render surfaces (one state change re-evaluates a giant tree).
- **Fix:** split along already-obvious seams (modals, drawers, panes) with `dynamic()` imports; measured, one component per commit. Contacts/Discuss first (hottest apps).
- **Risk:** medium (mechanical splits, but regressions possible) → one-commit-per-split with visual verification.

## P2-4 · Gated DB hygiene batch (advisors)

- 11 duplicate index pairs (inventory_*, purchase_receipt*) → drop one of each (write-amp saving, zero read risk).
- 20 `auth_rls_initplan` warnings (8 tables) → wrap `auth.*()` in `(select …)` — same semantics, per-statement evaluation.
- 4 tables with multiple permissive policies → consolidate.
- **All three are reviewed, reversible migrations — GATED on owner approval per project policy (no destructive/prod DB changes without sign-off).** No urgency at current volumes.

## P2-5 · Activity heartbeat = 2 UPDATE statements per 30 s per session

- **Location:** `ActivityTracker.tsx` (HEARTBEAT_MS 30_000) → updates `user_devices` + `app_sessions` (~12k statements in window, 0.3–0.4 ms each).
- **Fix (later):** single RPC updating both, or widen to 60 s. P2 only for tidiness — cost is real but small.

---

## P3 (polish)

1. **Comment/code drift** — DiscussApp poll comment says 20 s, code says 5 s. Fix alongside P1-2.
2. **Home page ticks** — two 1 s `setInterval`s (clock/rotation) + badge pollers; cheap, but pause when `document.hidden`.
3. **No virtualization in Discuss thread** — acceptable at ≤120 rendered messages; revisit after P1-3 raises history depth. Do not add blindly (a11y/scroll risk).
4. **Initial JS 1.94 MB uncompressed / 19 files** — within reason for an ERP; add bundle budget + CI tracking (Phase 13) so it cannot creep.
5. **NotificationBell 10 s cadence** — server responses now SWR-cached; consider piggybacking on the existing `inbox:account:{id}` broadcast topic instead of polling (event-driven, Phase 6 pattern reuse).
