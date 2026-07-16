# Phase 4 — Home & App Launch Performance (Results)

Goal: make launching any app from the Hub feel immediate, fluid, and OS-like —
without redesigning Home or adding business features. Shared launch journey only.

## Shipped
1. **`AppLaunchLink`** — the one shared launch primitive (Link-based). Modifier
   keys / new-tab / middle-click, viewport auto-prefetch, immediate CSS pressed
   feedback (reduced-motion-safe), native keyboard, duplicate-activation guard,
   intent preload (network/authorization-gated), unified privacy-safe launch
   telemetry, non-interactive disabled/unauthorized state (no href, no prefetch).
2. **Home + Sidebar adoption** — `AppCard` and sidebar `AppLink` both render
   `AppLaunchLink` (launcher grid = Home cards). Home no longer uses `router.push`
   to launch.
3. **Prefetch strategy** (`src/lib/app-prefetch.ts`) — Tier A idle preload
   (Customers/Suppliers/Products/Quotations, from real usage), Tier B intent,
   Tier C no-preload; gated by Save-Data / slow-connection / hidden-tab / offline
   / low-memory; never preloads unauthorized apps.
4. **Loading boundaries** — 15 new app-shaped `loading.tsx` (+6 existing = 21)
   using 5 shared skeleton primitives → blank/white flash eliminated on launch.
5. **Launch telemetry** — `app_launch.open` / `press_feedback_ms` / `nav_ms`
   over the existing privacy-safe perf client (normalized app id + ms only).
6. **Shell prime** — bootstrap primed once at the top of the authenticated shell
   (removed a dead import); shell confirmed already persistent (no remount).

## Acceptance criteria status
| Criterion | Status |
|---|---|
| Immediate feedback on Home presses | ✅ CSS `:active`, < 100 ms |
| Consistent optimized primary navigation | ✅ shared `AppLaunchLink` (Home + sidebar + launcher) |
| Shell remains stable / no full-page reload | ✅ Link-based SPA nav; shell persistent (audit) |
| Evidence-based prefetch, unauthorized never prefetched | ✅ tiers from usage; authorization + network gates (tests) |
| Loading boundaries cover representative apps | ✅ 15 added; blank flash removed |
| Duplicate bootstrap reduced / proven absent | ✅ single shared promise; primed once |
| Warm launch measurably improves | ▶ single-cache reuse + no remount; percentiles pending Vercel window |
| No permission / tenant / auth regression | ✅ authorization unchanged (client never widened); tests green |
| China-critical launch paths functional | ▶ code-safe (first-party skeletons, no new 3rd-party dep); genuine-China run pending operator |
| All changes reversible | ✅ additive; per-item rollback documented |
| Before/after documented | ✅ code + build verified; percentiles pending (not fabricated) |

## Tests & build
`validate:app-launch` **51/51** (tiers, network/authorization gating, primitive
guards, Home/sidebar adoption, 19 loading boundaries). Regressions green
(customers-gate 10, suppliers-gate 10, suppliers-security 45, server-list 28).
`tsc` clean · `next build` exit 0 (727 routes, all `loading.tsx` emitted).

## Measurement gaps (honest)
Real press→usable percentiles, request/byte counts, React commit counts, CLS,
and genuine Mainland-China launch runs require Vercel-log / Speed-Insights /
authenticated-profiler / in-country access — not reachable from the build
environment. The `app_launch.*` metrics are now emitted; an operator pulls the
per-app percentiles (with sample sizes) once a traffic window accrues. No values
were invented (see `APP_LAUNCH_BASELINE.md`).

## Remaining app-specific bottlenecks (→ Wave 2B backlog, not this phase)
Heavy first-paint apps (Database Visual Library 5k assets, AI workspace, Finance
dashboard fan-out, Quotations editor) — deep business-data optimization is
explicitly out of scope for the shared launch phase.

## Recommendation
Promote (done — merged, additive, reversible). Next: collect the launch-metric
window, then consider Wave 2B application-specific optimization — **gated on
explicit approval**.

---

## Cold Start subphase update (Phase 4 corrective)

Follow-up to the owner's production report ("first launch slow, warm launch
instant"). Root cause: `<Link prefetch>` warms route code but **not** the
`next/dynamic` client chunk, so first launch pays a multi-second chunk download
while every launch after is served cache-first by the SW. Fixes shipped:
dynamic-chunk preload registry (intent + idle), Customers/Suppliers cold-entry
de-bundling (only the gate-selected impl loads), cold-vs-warm launch telemetry,
Home interactivity instrumentation. DNS/TLS + SW audited → correct, no change.
Docs: COLD_START_PERFORMANCE_BASELINE / _RESULTS / FIRST_APP_LAUNCH_ARCHITECTURE.
Tests: validate:cold-start 24/24.
