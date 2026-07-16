# Personalized Preload & Data Warm-up Strategy

**Phase 4 — Platform Speed Max-Out, Workstreams 4 + 5.** How the Hub warms the
next app and small high-value data after Home becomes interactive.

## Current architecture (already shipped; this phase reviewed it)

Three distinct warm layers, scheduled by priority (see also
`FIRST_APP_LAUNCH_ARCHITECTURE.md`):

| Priority | When | What |
|---|---|---|
| **P0** | first | Home interaction readiness (app grid interactive) |
| **P1** | after Home interactive, on idle | route prefetch + **real client chunk** (`preloadAppChunk`) for the top **1–2** most-launched *authorized* apps, capped at 2 chunks |
| **P2** | idle | route/data prefetch for a couple more frequent authorized apps |
| **P3** | intent only | hover/focus/touch → `AppLaunchLink` warms route + chunk |

Personalization uses **privacy-safe recent usage** (`idlePreloadApps(authorized)`
in `app-prefetch.ts`) intersected with the **authorized** module set from the
bootstrap — an unauthorized app is never in the candidate set, never prefetched,
never chunk-warmed.

### Data warm-up (WS4) — already bounded & permission-safe
On the same idle pass, Home warms only **small, cacheable list GETs** for the
top authorized apps via `APP_DATA_PREFETCH` (`/api/products`, `/api/contacts?...`,
`/api/projects`, `/api/todos`, `/api/accounts`, …). These are the app's own list
endpoints (default cache mode → populate the browser HTTP cache), so the app's
first fetch on navigation is served warm. It does **not** warm full private
datasets, finance details, documents, Discuss history, or broad CRM data.

## Guardrails (all enforced today)

- Gated by `isPreloadAllowed(readNetworkContext())` → skipped on **Save-Data,
  slow-2g/2g, offline, hidden tab**.
- Tier-C (heavy/rare) apps get **no** viewport auto-prefetch and no idle chunk
  warm — intent only.
- Chunk warming deduped per session; capped at top-2 on idle so it never becomes
  a big multi-chunk download.
- Recent-app data is stored only via existing local mechanisms; **no detailed
  personal behavior is logged externally**.

## This phase's change

Home's decorative on-mount work (quote strings, unread-badge fetches +
subscriptions) is now deferred behind `useAfterInteractive` (WS1), so the
personalized preload's idle window is **not** contended by decorative hydration —
data warm-up and chunk warm-up no longer compete with the app grid becoming
interactive.

## Not expanded (deliberate)

The existing top-2 schedule already satisfies "preload one most-likely next app
after Home interactive; one more on idle; intent-only for the rest." Widening it
would risk over-preloading — explicitly out of scope. No new personal-preference
storage was added.
