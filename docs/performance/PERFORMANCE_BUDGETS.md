# Performance Budgets & Regression Guards

**Phase 4 — Platform Speed Max-Out, Workstream 9.** Measurable budgets and the
automated guards that keep the platform's speed + cache-safety invariants from
regressing.

## Route categories

| Category | Routes | Notes |
|---|---|---|
| shell / Home | `/` | persistent shell; app grid must be interactive before decorative work |
| directory | `/customers`, `/suppliers`, `/crm`, contacts lists | server-list or gated legacy; no full-dataset client download on cold entry |
| board | `/crm` board | dynamic client chunk warmed on intent/idle |
| editor | `/quotations/[id]`, `/products/[id]` | localStorage-first where applicable |
| dashboard | `/finance`, `/finance/intelligence` | skeleton before aggregate (Wave 2B.1) |
| document/PDF | `/quotations/[id]/print`, reports | server-side PDF, chrome-less |
| messaging | `/discuss` | realtime-first, 5s health-gated reconcile |

## Budgets (grounded in current measurements; refine as Speed-Insights data accrues)

These are directional guardrails, not arbitrary numbers — anchored to the
instrumentation shipped in the Cold-Start subphase. Fill the authoritative P75s
from Vercel Speed Insights (owner dashboard) into `PLATFORM_SPEED_MAXOUT_RESULTS.md`.

| Budget | Target | Source of truth |
|---|---|---|
| Home visible→interactive | keep at/under current field P75 | `home.visible_to_interactive_ms` |
| Home first input delay | < 100 ms (Good INP band) | `home.first_input_delay_ms` / Speed Insights INP |
| Cold app launch (Customers/Suppliers/CRM) | dynamic-chunk warmed → near-warm | `app_launch.cold.*` |
| Warm app launch | instant (SW cache-first) | `app_launch` warm |
| Background requests/min (idle Home) | no unguarded hidden-tab poll | `BACKGROUND_ACTIVITY_AUDIT.md` |
| Route initial JS | no unreviewed growth | build output / `ROUTE_BUNDLE_REPORT.md` |

> Turbopack's `next build` in this environment does not emit per-route First-Load
> JS byte columns, so byte budgets are tracked structurally (dynamic-import
> boundaries) rather than by a fabricated byte number.

## Automated guards — `validate:platform-speed` (16 assertions)

Static, deterministic, no DB/browser. Fails CI if any invariant is dropped:

- **WS1** — `DAILY_QUOTES` stays in its own lazy module + dynamic-imported; both
  unread-badge effects stay gated behind `useAfterInteractive`.
- **WS2** — `web-push` is never a static import + is dynamic-imported in the send
  path; `isPushConfigured` stays a pure env check; `/api/accounts` never
  statically imports the password helper.
- **WS3** — the session-cache helper clears bootstrap + scope + `kx_`/`kx:`/`koleex.sa.`
  storage; sign-out clears the QueryClient **and** calls `clearSessionScopedCaches`.
- **WS7** — the super-admin/activity pollers keep their hidden-tab guards +
  `visibilitychange` resync.
- **privacy** — the cache helper sends data nowhere (no fetch/track).

## Companion guards (existing, still enforced)

`validate:cold-start` (24), `validate:app-launch`, `validate:crm-perf`,
`validate:finance-perf`, `validate:quotations-perf`, `validate:quotations-pricing`,
`validate:suppliers-security`, `validate:customers-gate`, `validate:server-list`.

## Guard ideas for future phases (not yet automated)

- No new full-dataset list fetch on a directory route (grep `.select("*")` +
  unbounded `fetchContacts`-style calls).
- No new unscoped TanStack query key (key must include tenant/account for private
  data).
- No new global `setInterval` without a `visibilityState` guard.
- No major app route without a route-level `loading.tsx` boundary.
