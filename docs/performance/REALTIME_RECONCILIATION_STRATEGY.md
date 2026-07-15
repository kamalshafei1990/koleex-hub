# Realtime Reconciliation Strategy (Phase 3C/3D)

**Shipped:** 2026-07-15 · commits `dfc0afe7` (Discuss) · `1f2f7d2b` (notification bell) · Rollback: revert the commit(s); no schema or API changes involved.

## Principles

1. **Realtime pings are the primary path.** A content-free broadcast ping triggers a small incremental fetch (`after` cursor) — that is how new messages arrive. Polling exists only to cover what pings cannot.
2. **Health decides everything.** The shared `subscribeBroadcast` registry now tracks each topic's supabase-js status; `isChannelStreamHealthy()` / `isAccountStreamHealthy()` expose it. Unknown topics report unhealthy → biases safely toward reconciliation.
3. **A tick is not a fetch.** Loops run cheap local decisions; the network is touched only when a rule fires.

## Discuss open-channel state machine (`DiscussApp`)

Decision tick every 5 s (no network by itself):

| State | Condition | Action |
|---|---|---|
| hidden | `document.hidden` | nothing (`discuss.poll.hidden_skip`) |
| healthy + dirty | pings arrived since last full pass AND ≥ ~30 s (jitter ±20%) since it | ONE full reconcile — catches edits/deletions/reactions the incremental cursor can't see (`discuss.reconcile{reason:dirty}`) |
| healthy + quiet | no pings since last full pass | nothing (`discuss.poll.skipped`); 5-min jittered safety pass as wedged-stream insurance (`reason:safety`) |
| unhealthy < 8 s | reconnect blip | nothing — no polling storm on brief drops |
| unhealthy ≥ 8 s | real drop (`discuss.rt.fallback` fired once) | full fallback poll with backoff 10 s → 20 s → 40 s cap, jittered |
| recovery | healthy again after a drop | immediate catch-up reconcile (`reason:recovered`) |

Lifecycle reconciliation (always full refresh): window focus · visibilitychange→visible · **browser `online` event (new)**. Laptop-wake and auth-refresh surface as one of these three plus stream re-subscription.

One loop per open channel; torn down on channel switch and unmount (same effect owns both listeners and interval).

**Why not a fixed 20–30 s full refetch:** the ping stream already tells us *whether* anything changed; refetching a quiet channel is pure waste. The dirty-flag model keeps the 30 s cadence ONLY while there is actual activity, and drops to ~1 request/5 min on quiet channels. Fully incremental edit/reaction sync (server-side `updated_at` cursor) would need API changes — deliberately deferred; the dirty-flag full pass is bounded (max 2/min) and correct.

## Notification bell (`NotificationBell`)

Already realtime-invalidated (`subscribeToMyChannels` ping → recount, inbox ping → bump). Change: the 10 s Discuss fallback poll against the heaviest endpoint (`myChannels`, measured 2.4–4.8 s server-side) became a 60 s tick that fetches **only** when the account stream is unhealthy or 5 minutes passed since the last forced pass. Unread correctness is preserved by: pings (primary), focus/visibility resync, and the safety pass. Inbox badge polling was already 60 s + visibility-gated + realtime-bumped — unchanged.

## Duplicate-safety

Unchanged mechanisms, now load-bearing and documented: receiver `seen`-set dedupe by message id; optimistic-row id swap before realtime insert can race; sidebar recounts are idempotent snapshots. No new subscriptions were created anywhere — health checks read the existing registry.

## Expected request-rate math (per active client)

| Loop | Before | After (healthy realtime) |
|---|---|---|
| Open Discuss channel | 12 full refetches/min (5 s × limit 120 + joins) | ≤ 2/min during active conversation (dirty), ~0.2/min quiet (safety) |
| Bell Discuss badge | 6 × myChannels/min | ~0.2/min (5-min safety) |
| Bell inbox badge | 1/min (already) | 1/min (unchanged) |

## Hidden-tab hygiene (Phase 3E, commit `9cf97ae3`)

Home clock (1 Hz setState) and quote rotator now skip ticks while hidden and snap forward on visibility. Audited and already compliant: home badge pollers (60 s + gated + realtime), ProjectsApp 20 s board refresh (gated), QA reports (gated), UpdateWatcher (5 min + visibility). **ActivityTracker's 30 s presence heartbeat is intentionally NOT paused** — pausing would falsely mark backgrounded users offline; this is the documented trade-off the mandate requires.
