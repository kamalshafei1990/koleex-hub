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
