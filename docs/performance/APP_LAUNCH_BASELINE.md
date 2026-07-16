# App Launch Baseline (Phase 4)

Instrumentation of the launch lifecycle from activation to usable app.

## Metric names (privacy-safe, via `src/lib/perf/client.ts` → `/api/perf/ingest`)
| Metric | Meaning | Source |
|---|---|---|
| `app_launch.open` | a launch was initiated (count) | `markAppLaunch` from `AppLaunchLink` |
| `app_launch.press_feedback_ms` | pointer-down → activate delay (≈0; CSS `:active` is synchronous) | `markAppLaunch` |
| `app_launch.nav_ms` | launch → usable route commit (warm SPA nav), keyed per app | `completeNav` when a launch is pending |
| `nav.warm_ms` | route→route SPA navigation (from/to) | existing PerfVitals capture-click + pathname effect |
| `nav.cold.ttfb_ms` / `dom_ms` / `load_ms` | cold full-load timings | Navigation Timing API |
| `longtask.count` / `longtask.ms` | long tasks (aggregated) | PerformanceObserver |

Only a **normalized app id** (`/^[a-z0-9_-]{1,32}$/`, else `unknown`) + numeric
ms + normalized route (`/customers/:id`) ever leave the browser. **Never** logged:
account identity, customer/supplier data, record ids, search text, financial
values, message content, credentials, tokens, or raw URLs with params.

## Sample classification
Each `app_launch.*`/`nav.*` sample carries the perf session id (`kx_perf_sid`) and
route tags; cold vs warm is inferred from Navigation Timing (`nav.cold.*` fires
once per full load) vs `nav.warm_ms` (SPA). Prefetched vs not, China vs Japan/VPN,
Preview vs production, synthetic vs real are labeled at analysis time from the
Vercel-log request context — **not** fabricated here.

## Baseline table (per app)
| App | Launch type | Press feedback | Loading shell | First meaningful | Usable | Requests | Chunk bytes | Samples |
|---|---|---|---|---|---|---|---|---|
| Customers | warm | ~0 ms (CSS) | app-shaped `loading.tsx` (< ~200 ms, shell stays) | — | — | — | — | pending |
| Suppliers | warm | ~0 ms | app-shaped | — | — | — | — | pending |
| Products / Quotations / CRM / Finance / Discuss / AI / Settings / Accounts / Catalogs / Inbox / Invoices / Sales / Purchase / Inventory | — | ~0 ms | app-shaped | — | — | — | — | pending |

**Values marked "pending" are Vercel-log / Speed-Insights measurements that are
not reachable from the build environment and are NOT fabricated.** They populate
once the `app_launch.*` metrics accrue a production traffic window; an operator
with Vercel access pulls P50/P75/P95 (with sample sizes) per app. What is
verifiable now (code + build): press feedback is CSS-synchronous; every
representative app has an app-shaped loading boundary inside the persistent shell
(no blank flash); route code is prefetched (viewport + intent + Tier-A idle);
warm nav reuses the single TanStack cache and never remounts the shell.
