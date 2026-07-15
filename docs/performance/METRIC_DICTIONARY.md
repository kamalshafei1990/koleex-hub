# Koleex Hub — Metric Dictionary (Phase 2)

Every metric the system records. Units are **milliseconds** unless stated. All are shipped as raw samples (percentile-ready). Privacy class: **A** = numbers + code-authored labels only (nothing user-derived) · **B** = includes a normalized route name (ids stripped).

New metrics MUST be added to this dictionary in the same commit that introduces them, and must pass the ingest whitelist (`/^[a-z0-9._-]{1,48}$/`).

## Client — navigation & environment (`[kx-metric]` logs)

| Metric | Tags | Class | Meaning | Healthy (initial) |
|---|---|---|---|---|
| `nav.cold.ttfb_ms` | route | B | First byte of the cold page load (Navigation Timing) | < 800 @P75 |
| `nav.cold.dom_ms` | route | B | DOMContentLoaded on cold load | < 2500 @P75 |
| `nav.cold.load_ms` | route | B | Full load event on cold load | < 4000 @P75 |
| `nav.warm_ms` | from, to | B | Internal link click → route (pathname) committed | < 400 @P75 |
| `net.offline` | — | A | Browser went offline (event, v=1) | rare |
| `net.reconnect_ms` | — | A | Offline → online duration | informational |
| `longtask.count` / `longtask.ms` | — | A | Main-thread blocks > 50 ms (summed per ≤20 s window) | trend-watch |

## Client — Discuss message lifecycle

| Metric | Class | Stage measured | Healthy (initial) |
|---|---|---|---|
| `discuss.send.optimistic_ms` | A | Send press → optimistic bubble painted (next frame) | < 50 @P95 |
| `discuss.send.ack_ms` | A | HTTP request start → server `{ok}` received | < 1200 @P75 (geography-bound; Phase 3 P1-1 should cut it) |
| `discuss.send.total_ms` | A | Send press → acknowledged | ack + ~10 |
| `discuss.send.reconcile_ms` | A | Send press → optimistic row swapped to canonical id (painted) | ≈ total + 1 frame |
| `discuss.send.failed` | A | Send failed (event; body restored to composer) | ~0 |
| `discuss.recv.fetch_ms` | A | Broadcast ping → new rows fetched (incremental `after` query) | < 700 @P75 |
| `discuss.recv.visible_ms` | A | Broadcast ping → message painted on screen | < 900 @P75 |
| `discuss.poll.tick` | A | Fallback-poll executions (summed per window) — baseline ≈ 12/min while a channel is open; will DROP sharply after Phase 3 P1-2 | trend metric |

## Client — realtime connection health

| Metric | Tags | Class | Meaning |
|---|---|---|---|
| `rt.join_ms` | scope (`discuss:channel` / `discuss:account` / `inbox:account`) | A | `.subscribe()` → first SUBSCRIBED |
| `rt.reconnect` | scope | A | SUBSCRIBED again after a drop (auto-rejoin) |
| `rt.status` | s (CHANNEL_ERROR/TIMED_OUT/CLOSED), scope | A | Non-healthy status transitions |
| `rt.channels` | — | A | Gauge: live shared channels after each change (duplicates are impossible by construction — `subscribeBroadcast` ref-counts per topic; this gauge proves it stays small) |

## Server — `[kx-server-timing]` logs (+ `Server-Timing` headers)

| op | Stages | Extra tags | Meaning |
|---|---|---|---|
| `discuss.mutate` | auth, parse, membership, db_insert, member_lookup, rt_dispatch, push_dispatch, total_ms | action=sendMessage, region, env | Full send-path breakdown. `rt_dispatch` + `push_dispatch` are the Phase 3 P1-1 targets — expect them to move out of totals. |
| `discuss.read` | auth, db, total_ms | resource=myChannels (channels=N) / channelMessages (mode=incremental\|full, rows=N) | Sidebar + message-page read cost. |

Counts (`channels`, `rows`) are cardinalities, never content.

## Vercel Speed Insights (dashboard, not logs)

LCP, INP, CLS, FCP, TTFB — real users, P75, per normalized route. This is the canonical source for the Phase 11 targets (INP < 200 ms, LCP ≤ 2.5 s @P75). Requires one-time dashboard enable by the owner.

## Known limitations

- Sender→receiver cross-device latency is derived from single-clock segments, not measured end-to-end (Phase 12 two-client test will close this).
- `nav.warm_ms` starts at the link *click*; programmatic `router.push` navigations aren't captured yet (can be added at the few call sites if needed).
- Metrics from users with `sendBeacon`+`fetch` both blocked (rare) are lost — acceptable.
- Log-based percentiles require exporting/filtering Vercel logs; Speed Insights percentiles are automatic.
- View-as sessions still report metrics: the ingest route authenticates the session but deliberately skips the view-as read-only guard, because a metric batch is a log line, not a business-data write.
