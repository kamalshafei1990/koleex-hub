# App Navigation Architecture (Phase 4)

Map of every primary app-entry surface, how it navigated **before** this phase,
and the shared primitive that now unifies them.

## Before → After
| Surface | Before | After |
|---|---|---|
| Home app cards (`AppCard`, `app/page.tsx`) | bespoke `role="button"` div → `router.push` (no modifier keys, no pressed feedback, Enter-only, no dup guard); manual hover prefetch | **`AppLaunchLink`** (Next `<Link>`): modifier/middle-click/new-tab, viewport auto-prefetch, CSS pressed feedback, keyboard native, dup guard, intent preload, unified telemetry |
| Sidebar app links (`AppLink`, `Sidebar.tsx`) | bare `<Link>`, no telemetry, no pressed feedback | **`AppLaunchLink`** (same behavior + records recent-app + launch metric) |
| App launcher / all-apps grid | = Home `AppCard` | = Home (via `AppLaunchLink`) |
| Command palette | none (⌘K only focuses the on-page search) | unchanged (out of scope — noted as a future add) |
| Recent / favorites | DB-backed API exists (`app-launcher.ts`), no UI | unchanged (out of scope) |
| MainHeader breadcrumb | static text, not a switcher | unchanged (out of scope) |

## The shared primitive — `src/components/layout/AppLaunchLink.tsx`
Renders a Next `<Link>` for active/authorized apps; a non-interactive `<div>`
(no href, no prefetch) for inactive/disabled. Provides:
- **Navigation:** `<Link>` → native modifier keys / middle-click / open-in-new-tab
  and keyboard (Enter + Space); automatic viewport route-code prefetch.
- **Pressed feedback:** `active:scale-[0.97]` (< 100 ms, no JS),
  `motion-reduce:active:scale-100`.
- **Intent preload:** hover/focus/touch → `onPreload` (route + data warm), gated
  by `isPreloadAllowed` and skipped for Tier-C apps.
- **Telemetry:** `trackAppOpen` (recent-app, now fired from ALL surfaces, not
  just Home) + `markAppLaunch` (privacy-safe `app_launch.*` metric), once per
  activation, and **not** started for modifier/new-tab clicks (no in-tab nav).
- **Duplicate guard:** ignores a second plain launch within 400 ms.
- **Security:** never widens access — the caller still decides which apps to
  render (role-filtered), and an inactive/unauthorized tile emits no link + no
  prefetch. Authorization is not moved to the client.

## Telemetry reconciliation
Two systems remain by design: `trackAppOpen` (recent-apps, DB) + the global
`ActivityTracker` `page_view`. The launch **timing** now flows through the
privacy-safe perf client (`app_launch.*` → `/api/perf/ingest`), keyed only by a
normalized app id. No surface double-fires the launch metric.
