# Cold Start & First Application Launch — Performance Baseline

**Phase 4 — corrective subphase.** Establishes the *measured* separation between
the three distinct workflows the owner experiences, and the architectural root
cause of the "first launch is slow, every launch after is instant" symptom.

> Scope guard: this subphase covers **cold system startup** and **first
> application launch** only. It does **not** touch Products, Product Data, Wave
> 2C, the Contacts migration, Discuss, Storage, or AI.

---

## 1. The three workflows (measured separately — never merged into one number)

| Workflow | What the owner does | What is paid |
|---|---|---|
| **A — Cold system startup** | Types the Hub URL / opens the PWA for the first time | DNS/TLS → HTML → JS shell → hydration → Home app grid becomes interactive |
| **B — First application launch** | Presses an app card for the **first time** in the session | press feedback → route RSC → **real dynamic client chunk download** → loading shell → first API → usable |
| **C — Warm launch** | Re-opens an app already opened once | route + chunk already cached → near-instant |

The owner's report — *"opening Hub the first time is slow; Home may be visible
but pressing an app initially appears unresponsive; the first launch of
Customers/Suppliers/CRM takes several seconds; after opening once, returning is
immediate"* — is a **workflow-A + workflow-B** problem. Workflow C already
works (it is the proof that the machinery is correct once warm).

---

## 2. Instrumentation added this subphase (privacy-safe: durations/counts only)

### Workflow A — Home cold startup (`markHomeInteractive`, `src/lib/perf/client.ts`)
| Metric | Meaning |
|---|---|
| `home.html_visible_ms` | navigation start → first contentful paint (existing web-vital path) |
| `home.hydration_start_ms` | React hydration begins |
| `home.interactive_ms` | Home mount effect fires (app grid is mounted + wired) — **the "can I press a card yet" moment** |
| `home.visible_to_interactive_ms` | the gap the owner feels as "visible but dead" |
| `home.app_grid_ready_ms` | app registry resolved + cards rendered |
| `home.first_app_handler_ready_ms` | first card's launch handler bound |
| `home.bootstrap_ready_ms` / `home.permissions_ready_ms` | `/api/me/bootstrap` resolved / permission gate resolved |
| `home.long_tasks_before_interactive` | count of >50 ms long tasks before interactive |
| `home.first_input_delay_ms` | measured FID via `PerformanceObserver({type:"first-input"})` |

### Workflow B — first app launch (`markAppLaunch(app, pressMs, cold)`, cold split)
| Metric | Meaning |
|---|---|
| `app_launch.cold.press_handler_delay_ms` | pointerdown → click handler runs |
| `app_launch.cold.press_feedback_ms` | pointerdown → visible pressed state (CSS `:active`, no JS) |
| `app_launch.cold.navigation_start_ms` | click → Next navigation begins |
| `app_launch.cold.route_chunk_ms` | route/RSC shell fetched |
| `app_launch.cold.dynamic_chunk_ms` | **real client app chunk fetched** (the multi-second gap) |
| `app_launch.cold.loading_shell_ms` | loading boundary painted |
| `app_launch.cold.first_data_ms` | first business API resolved |
| `app_launch.cold.usable_ms` | app interactive |

`cold` is derived from `wasChunkWarmed(appId)` — a launch is **cold** when its
`next/dynamic` client chunk has *not* yet been warmed this session, i.e. it will
pay the download. All app ids are normalized to `/^[a-z0-9_-]{1,32}$/` before
they enter any metric; **no account, permission, tenant, customer, route,
query-string, or app-content value is ever recorded.**

---

## 3. Root cause (measured, workflow B)

`<Link prefetch>` and `router.prefetch()` warm **only the route / RSC shell
code.** The heavy interactive app is loaded *inside* the route via
`next/dynamic(() => import("./App"))`, and **that client chunk stays cold until
the user actually navigates.** So:

```
first press → route shell (warm, cheap) → dynamic client chunk (COLD, MB-scale,
              downloads now) → loading shell → API → usable      ← several seconds
second press → route + chunk both cached                          ← instant
```

The service worker (`public/sw.js`) caches `/_next/static/` hashed chunks
cache-first, which is exactly why **every launch after the first is instant**
across visits — but it does nothing for the *first* session, because the chunk
was never fetched to be cached.

### Secondary cause — Customers / Suppliers double-bundling
Before this subphase, `src/app/customers/page.tsx` and `suppliers/page.tsx`
**statically imported both** the ~11.6k-line legacy `Contacts` implementation
**and** the server-list adapter. Every cold entry therefore downloaded *both*
UI implementations even though only one is ever rendered, and (before the gate
resolved) risked a double render / double list request.

---

## 4. Audit findings that require NO change (measured, not assumed)

| Area | Finding | Action |
|---|---|---|
| **Service worker** (Step 14) | Caches **only** `/_next/static/`. Never caches `/api/*`, never caches HTML navigations. No account/tenant data can survive logout through it. | ✅ Correct — no change. Explains warm=instant. |
| **DNS / TLS** (Step 13) | Hub host resolves clean, single HTTP/2 200, no redirect chain; only an apex→www redirect exists (not on the app host). Wix DNS delegates correctly to Vercel. | ✅ No misconfiguration found — no DNS change (per instruction, do not change DNS without a measured fault). |
| **Region** (Step 12) | Functions pinned to `hnd1` (Tokyo). Browser-side chunk delay is **not** a database/region issue — separated via Server-Timing. | ✅ Keep hnd1. Do not add a VPS / change providers. |

---

## 5. Baseline measurement note (honesty clause — Step 15)

Turbopack's `next build` output in this environment does **not** emit per-route
`Size` / `First Load JS` byte columns, so exact byte deltas for
`/customers`, `/suppliers`, `/crm` are **not available to quote** and are marked
*"not emitted by build"* in the results matrix rather than fabricated. The
**architectural** before/after (both impls statically bundled → one impl on a
separate dynamic chunk; cold client chunk never warmed → warmed on intent/idle)
is verified structurally by `scripts/validate-cold-start.mts` (24 assertions).

See **COLD_START_PERFORMANCE_RESULTS.md** for the before/after matrices and
**FIRST_APP_LAUNCH_ARCHITECTURE.md** for the three-layer warm model.
