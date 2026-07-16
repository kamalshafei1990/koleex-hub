# Home Page Performance Audit (Phase 4)

Profile of the Home App Launcher (`src/app/page.tsx`, ~1160 lines) — a client
component that renders the greeting, clock, search, and the role-filtered app
grid.

## Interaction-readiness findings
| Area | Finding | Change | Visual impact |
|---|---|---|---|
| App-card launch | `router.push` → no pressed feedback, no modifier keys, Enter-only | adopt `AppLaunchLink` (Link + CSS pressed + keyboard + dup guard) | + press animation only |
| Tile activation delay | onClick only; no down-state | CSS `active:scale` (< 100 ms), reduced-motion-safe | subtle |
| Grid re-renders | `AppCard` already `memo`; grid derived via `useMemo` (filteredApps/groupedApps/visibleRegistry) | left as-is (already memoized) | none |
| Clock widget | `setInterval(1s)` in `ClockWidget` | left as-is (isolated component; low cost) | none |
| Intro animation | pure-CSS staggered tile entrance, `prefers-reduced-motion` disabled | kept (brand element; reduced-motion-safe) | none |
| AI orb greeter | `<KoleexOrb>` (Rive) in `AIGreeter` | kept; not on the launch-critical path | none |
| Idle work | manual hover prefetch existed | added evidence-based Tier-A idle preload (gated) | none |
| Permission gate | fail-closed until permitted set known; warm-start renders instantly from bootstrap cache | kept | none |
| Bootstrap | shared `useMeBootstrap` (deduped) | primed at shell top | none |

## Not changed (brand / IA preserved, per constraint)
Greeting, clock, search box, orb, tile entrance animation, grid layout, category
grouping — the Home **information architecture and visual identity are
unchanged**. The only user-visible delta is an immediate pressed state on app
tiles and native new-tab support.

## Per-optimization record
- **Immediate pressed feedback** — current cost: none (was missing) · impact:
  launches feel responsive · change: `AppLaunchLink` CSS `:active` · gain:
  < 100 ms feedback · visual: subtle scale · rollback: `pressFeedback={false}`.
- **Modifier-key / new-tab** — cost: broken on launcher · change: Link-based ·
  gain: OS-consistent · rollback: revert primitive adoption.
- **Tier-A idle preload** — cost: 0 when gated off (Save-Data/slow/hidden) ·
  change: idle `router.prefetch` of authorized top apps · gain: warmer common
  launches · rollback: empty `TIER_A_IDLE_PRELOAD` or delete the effect.

## Measured limits
JS-transferred / hydration duration / React commit counts / CLS for the Home
route require an authenticated production profiler + Vercel-log window (not
reachable here). Static route/bundle proxy: `ROUTE_BUNDLE_REPORT.md`.

---

## Cold Start subphase update (Phase 4 corrective)

`markHomeInteractive()` (fired from a rAF-deferred mount effect in `src/app/page.tsx`)
now records the "visible but not interactive" gap the owner reported:
`home.interactive_ms`, `home.visible_to_interactive_ms`, `home.first_input_delay_ms`
(via `PerformanceObserver({type:"first-input"})`), `home.long_tasks_before_interactive`,
plus bootstrap/permissions readiness correlation.

**Hydration-path decision (Step 4):** the Home client boundary was **left intact**.
An app-grid island split was assessed and **deferred** — Home is ~56 KB and the split
is high-risk for the reward; "do not remove visual features without measured evidence."
The idle preload now also warms the top-2 real app chunks so their first launch is not
cold. No feature removed.

---

## Platform Speed Max-Out update (WS1)

Two decorative loads moved off the Home hydration-critical path: (1) `DAILY_QUOTES` (~120 localized strings) extracted to `src/lib/home/daily-quotes.ts` and dynamic-imported by AIGreeter; (2) the discuss + todo unread-badge effects (each a fetch + realtime subscription) gated behind `useAfterInteractive()` (first requestIdleCallback). App grid interactivity now precedes decorative badge/quote init. Home client boundary still intact (island split remains deferred). Guarded by `validate:platform-speed`.
