# Background Activity Audit

**Phase 4 — Platform Speed Max-Out, Workstream 7.** Inventory of every client
timer / poll / heartbeat, whether it runs while the tab is hidden, and what was
fixed.

## Pattern the platform already follows

Almost every poller is **realtime-first + visible-guarded reconciliation +
focus/visibilitychange resync**: a realtime subscription is the primary channel,
a slow (≥20–60s) poll only fires when `document.visibilityState === "visible"`
and covers realtime gaps, and a `visibilitychange`/focus listener snaps fresh on
return. This is the correct model — keep it.

## Fixes shipped (WS7)

The only pollers that ignored the hidden-tab guard — all in
`src/app/super-admin/activity/page.tsx`:

| Timer | Interval | Work | Fix |
|---|---|---|---|
| monitor | 8s | `GET` super-admin monitor (DB read) | now skips hidden ticks + `visibilitychange` resync |
| feed | 15s | `GET` super-admin feed (DB read) | same |
| graph sampler | 1s | state sample + SVG re-render (no network) | now skips hidden ticks + resync |

A backgrounded monitor tab previously hit the DB every 8s/15s indefinitely and
re-rendered an SVG every second; it now goes quiet when hidden and refreshes the
instant the operator returns. Guarded by `validate:platform-speed` (WS7).

## Confirmed correct — no change

| Timer | Interval | Notes |
|---|---|---|
| `ActivityTracker` heartbeat | 30s active / 120s idle-or-hidden | Presence + session-revocation writer. Hidden writes are **intentional and bounded** (revocation must work in a background tab). Keep. |
| `NotificationBell` inbox/discuss | 60s | Visible-guarded, realtime primary, 5s grace. Single authoritative poller (UserMenu consumes its store). |
| Home discuss/todo badges | 60s | Visible-guarded, realtime primary. Now additionally deferred behind first idle (WS1). |
| `DiscussApp` | 5s | No network unless the realtime stream is unhealthy (backoff `fullReconcile`). Model example. |
| `ProjectsApp`, `QaReportsApp` | 20s | `!document.hidden`/visible-guard + focus + realtime primary. |
| `UpdateWatcher` | 5min + on-visible | `GET /api/version` no-store, no DB. Trivial. |
| Clock (1s), quote (45s) | — | No network, already visible-guarded. |

## Not changed (documented)

- **Contacts 20s silent full-directory refetch** (`Contacts.tsx`): re-downloads
  the whole directory per tick per open tab. No realtime possible (table is
  service-role-only). A `changed-since` delta endpoint or a longer interval
  would cut bandwidth — proposed as a follow-up (needs a new endpoint; out of
  scope for this shared-platform pass).
- **Duplicate discuss recount** (home + NotificationBell both 60s on the home
  route): minor; the Bell version is already realtime-health-gated. Low yield.

Preserved throughout: session revocation, account-disablement checks, presence,
notification correctness, reconnect reconciliation.
