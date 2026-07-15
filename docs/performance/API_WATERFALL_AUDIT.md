# API Waterfall Audit (Phase 4)

Per-request dependency shapes for the highest-traffic + highest-cost paths. Post-Tokyo each DB hop ≈ 1–5 ms, so waterfalls hurt via *count* and *volume*, not per-hop latency.

## Every authenticated request (universal prefix)
```
getSessionAccountId (1 hop)  →  getViewAsAccountId (1 hop)  →  getViewAsRoleId (1 hop)
     → Promise.all[ accounts, koleex_employees, realAccount, targetRole ]  (parallel, 1 hop)
```
- **3 serial hops** before the parallel batch. Fix: compose session+view-as into one query (SW-3). Saves ~2 hops on *every* API call platform-wide.

## `/api/discuss/read myChannels` (top request path)
- membership → channels → per-channel unread `count(*)` (**N+1**, short-circuited when `last_message_at ≤ cursor`) → last-message previews → linked contacts. Bounded at ~4 channels today; grows with channel count. Already the Phase-1 P2-1 item.

## `/api/me/bootstrap` (shell)
- `Promise.all[ accounts+person, koleex_permissions, overrides, targetRole ]` — already one parallel batch. ✅ Nothing to flatten.

## `/api/inbox/feed` (badge, 60 s)
- count query, SWR-cached 15 s. Could become event-driven off the existing `inbox:account` broadcast topic (same pattern as the bell in P3) — removes the poll.

## `/api/activity/heartbeat` (30 s)
- **2 UPDATEs** (user_devices + app_sessions) per tick per session — 9,405 + 9,410 calls in the window. Fix: single RPC updating both, or widen to 60 s. Deliberately NOT paused when hidden (would false-mark offline).

## Cross-cutting waterfall opportunities (improve many apps)
1. **Auth prefix flattening** — every route benefits.
2. **List endpoints**: confirm each does its filter/sort/paginate in the DB, not the browser (Contacts already slim-projected; audit the rest once server-timing lands).
3. **Server composition**: any UI page firing 2–3 sequential `/api/*` calls on mount should get one composed endpoint — identify these once app-wide timing exists (can't enumerate reliably without it).

**Blocker to full enumeration:** without app-wide server-timing (SW-1), the exact multi-call mount waterfalls per app can't be measured — only inferred. SW-1 is therefore the prerequisite for a complete waterfall map.
