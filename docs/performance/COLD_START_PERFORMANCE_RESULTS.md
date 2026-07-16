# Cold Start & First Application Launch — Results

**Phase 4 — corrective subphase.** Before/after per workflow. Matrices are kept
**separate** for Home, Customers, Suppliers, and CRM (never merged into one
number). Values not emitted by the toolchain are marked *"not emitted by build"*
— **not fabricated** (Step 15).

---

## A — Cold system startup (Home)

| Aspect | Before | After |
|---|---|---|
| "Visible but not interactive" gap | **unmeasured** — the owner felt it, no metric existed | measured via `home.visible_to_interactive_ms` (= `home.interactive_ms − home.html_visible_ms`) |
| Home interactive moment | not recorded | `home.interactive_ms` on mount effect (rAF-deferred) |
| First input delay | not recorded | `home.first_input_delay_ms` via `PerformanceObserver({type:"first-input"})` |
| Long tasks before interactive | not recorded | `home.long_tasks_before_interactive` |
| Bootstrap / permissions readiness | not correlated to interactive | `home.bootstrap_ready_ms`, `home.permissions_ready_ms` |
| Idle chunk warming | none — chunks stayed cold all session | top-2 ranked apps warmed on idle (gated), so their first launch is no longer cold |

> The instrumentation **proves or disproves** the "Home visible but not
> interactive" hypothesis with real field data instead of a subjective report —
> it does not itself remove features. Per Step 4, **no visual feature was
> removed**; the Home client boundary was left intact (an app-grid island split
> was assessed as high-risk for a 56 KB page and deferred, documented in
> HOME_PAGE_PERFORMANCE_AUDIT.md).

---

## B — First application launch

### Customers
| Aspect | Before | After |
|---|---|---|
| UI implementations bundled on cold entry | **both** legacy `Contacts` (~11.6k lines) **and** `CustomersServerList` statically imported | exactly **one** — both are `next/dynamic`; only the gate-selected impl loads |
| Mount before rollout gate resolves | risk of double render / double list request | neither impl mounts until `mode !== null`; `AppLoadingSkeleton` shown first |
| Real client chunk warm | never (cold until navigation) | warmed on hover/focus/touch intent + Home idle (top-2) via `preloadAppChunk("customers")` |
| Route First Load JS (bytes) | not emitted by build | not emitted by build (architectural delta verified by `validate:cold-start`) |
| Rollout precedence (`?serverlist=0/1`, cohort, Preview) | correct | **identical** — `decide()` unchanged |

### Suppliers
| Aspect | Before | After |
|---|---|---|
| UI implementations bundled | **both** `Contacts` + `SuppliersServerList` static | one `next/dynamic` impl, gate-selected |
| Gate-before-mount | double-render risk | skeleton until `mode !== null` |
| Client chunk warm | never | intent + idle warm via `preloadAppChunk("suppliers")` |
| Route First Load JS (bytes) | not emitted by build | not emitted by build |
| Rollout precedence | correct | identical — `decide()` unchanged |

### CRM
| Aspect | Before | After |
|---|---|---|
| Core board client chunk | `dynamic(CRM, {ssr:false})` — cold until navigation | warmed on intent + Home idle via `preloadAppChunk("crm")` |
| Contact-search data | on-demand | **still on-demand** — not preloaded (per Step 8) |
| Modal-only / alt-view code | inside the single 4095-line `CRM.tsx` chunk | not split internally (high-risk); the whole CRM chunk is warmed instead, so first board paint no longer waits on a cold download |
| Loading boundary | `AppLoadingSkeleton` via `dynamic` `loading:` + route `loading.tsx` | unchanged, verified compiled into route shell |

### Warm launch (C) — all apps
Unchanged and already instant: route + client chunk are served cache-first from
the service worker (`/_next/static/`). This subphase makes the **first** launch
behave more like the warm one by warming Layer 2 ahead of the press.

---

## Audits with no change (measured)

| Step | Area | Result |
|---|---|---|
| 12 | Browser vs server (Server-Timing) | chunk delay is browser-side, not DB; functions stay on `hnd1`. No VPS / provider change. |
| 13 | DNS / TLS (Wix→Vercel) | clean HTTP/2, no redirect chain on the app host, only apex→www. No misconfiguration → no DNS change. |
| 14 | Service worker / cache | caches only `/_next/static/`; never `/api`, never HTML; no tenant data survives logout. Correct → no change. |

---

## Verification

| Gate | Result |
|---|---|
| `validate:cold-start` (24 assertions) | ✅ 24/24 |
| `validate:app-launch` | ✅ |
| `validate:crm-perf` / `validate:finance-perf` / `validate:quotations-perf` / `validate:quotations-pricing` | ✅ |
| `validate:suppliers-security` / `validate:customers-gate` / `validate:server-list` | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| `next build` | ✅ exit 0 |

Deployment: **Preview branch first** (`wave-coldstart-preview`) for the Home
hydration instrumentation, dynamic-preload, Customers/Suppliers gate, and
loading-boundary changes, then promoted to `main` after Preview verified green.
