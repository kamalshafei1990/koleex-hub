# App Prefetch Strategy (Phase 4 — Home & App Launch)

Evidence-based route preloading. Source: `src/lib/app-prefetch.ts` (pure,
unit-tested via `validate:app-launch`), consumed by `AppLaunchLink` (intent) and
the Home idle-preload effect.

## Baseline: what Next.js already does
Next `<Link>` prefetches route **code** for links in the viewport (production).
Since `AppLaunchLink` renders a `<Link>`, every visible Home card + sidebar row
already gets route-code prefetch for free — we do **not** re-implement that. We
only add (a) a small idle warm-set and (b) intent (hover/focus) warm, both gated.

## Tiers
| Tier | Behaviour | Apps |
|---|---|---|
| **A — idle preload** | route code + cacheable list GET warmed on `requestIdleCallback` (Home), max 4 | `customers`, `suppliers`, `products`, `quotations` |
| **B — intent only** | route prefetch + data warm on hover/focus/touch (via `AppLaunchLink` + `APP_DATA_PREFETCH`) | every other active app |
| **C — no auto preload** | `<Link prefetch={false}>` (no viewport auto-prefetch), loads on explicit click | `database` (5k-asset Visual Library), `ai`, `finance`, `activity-monitor`, `software-center`, `price-calculator` |

Tier A is chosen from the **60-day launch ranking** (see
`APP_USAGE_AND_PRELOAD_RANKING.md`) — the most-launched business apps that are
light-to-medium to load. Deliberately short; we never idle-preload the catalogue.

## Prefetch classes (documented per task)
- **Route-code prefetch:** Tier A (idle) + Tier B (intent) + Next viewport
  default for A/B Links. Tier C opts out (`prefetch={false}`).
- **Data prefetch (warm list GET):** ONLY the small `APP_DATA_PREFETCH` map
  (products / product-data / projects / todo / accounts / customers / suppliers /
  contacts) — cacheable `max-age`/SWR endpoints — on idle (Tier A) or intent
  (Tier B). We do **not** preload business data merely because route code is
  prefetched.
- **No prefetch:** Tier C; and everything when the gate below denies.

## Safety gate — `isPreloadAllowed(NetworkContext)`
Preload (idle OR intent) is refused when any of: `navigator.connection.saveData`;
`effectiveType` ∈ {`2g`,`slow-2g`}; hidden tab; offline; `deviceMemory < 1 GB`.
Read live via `readNetworkContext()`.

## Authorization
`idlePreloadApps(authorizedAppIds)` returns Tier-A ∩ the caller's permitted set
only — an **unauthorized route is never prefetched**. The Home effect passes the
role-filtered `visibleRegistry` ids; Tier C is also excluded from intent preload.

## Rollback
Delete the Home idle-preload `useEffect`, or empty `TIER_A_IDLE_PRELOAD`. Intent
preload lives in `AppLaunchLink.onPreload`; remove the `onPreload` wiring to
disable. Fully additive.
