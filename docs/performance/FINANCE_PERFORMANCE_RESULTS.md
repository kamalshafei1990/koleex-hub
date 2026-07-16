# Finance Dashboard Performance — Results (Phase 4 Wave 2B.1)

Evidence-based, smallest-safe optimization. No schema change, no accounting-route
refactor, no service-role bypass, no sensitive-field broadening. Fully additive
+ reversible.

## Shipped
1. **`/finance` first-load section skeleton** (`VisualStatements.tsx`) — the
   primary dashboard previously blanked below the control bar until the ~2 s
   aggregate landed. It now renders a `HeroSkeleton` (2 KPI blocks + trend) and a
   `BodySkeleton` (statement rows) when `snapshot === null`, matching the final
   layout. On refetch the previous snapshot stays visible (faded) — the skeleton
   NEVER replaces real data. Biggest perceived-latency win.
2. **`/finance/intelligence` stale-response guard** (`FinanceDashboard.tsx`) — a
   monotonic `kpiSeq` token ensures a slow older-period KPI response can never
   overwrite a newer one after a rapid Week/Quarter/Year switch. (Per-card
   loading already existed; the 7 feeds already run concurrently.)
3. **Privacy-safe instrumentation** (both dashboards, via the existing perf
   client): `finance.dashboard.first_card_ms`, `full_ready_ms`, `total_ms`,
   `request_count`, `finance.dashboard.error`, `finance.filter.settled_ms`. Only
   durations (ms) + metric names leave the browser — **never** balances, revenue,
   costs, payments, customer/supplier amounts, account numbers, record ids, or
   raw filters (asserted by `validate:finance-perf`).
4. **Dead-import cleanup** — removed the never-rendered `AppHomeMenu` from
   `FinanceHome`.

## Before / after
| Metric | Before | After | Change | Samples |
|---|---|---|---|---|
| `/finance` initial finance HTTP requests | 2 | 2 | 0 (already single-aggregate) | code-derived |
| `/finance` first-useful paint | blank below controls until ~2 s aggregate | app-shaped skeleton **immediately**, real data on aggregate resolve | eliminates blank window | code-derived |
| `/finance/intelligence` initial requests | 8 (concurrent) | 8 (concurrent) | 0 (already parallel; composition rejected — see baseline) | code-derived |
| `/finance/intelligence` stale-overwrite risk | present (unguarded setKpi) | eliminated (`kpiSeq`) | fixed | code-derived |
| Dashboard timing visibility | none | `finance.dashboard.*` emitted | new | code-derived |
| P50 / P75 / P95 total | — | — | pending Vercel window | not fabricated |
| React commits / long tasks | — | — | pending profiler | not fabricated |
| Error rate | — | — | pending Vercel window | not fabricated |

Real percentiles / bytes / DB round trips / commit counts are Vercel-log /
Speed-Insights / authenticated-profiler only (unreachable from the build env).
The `finance.dashboard.*` metrics now feed them; an operator pulls per-dashboard
P50/P75/P95 (with sample sizes) from a traffic window. **No values invented.**

## Filters & refresh
- `/finance`: granularity/period/compare changes refetch the aggregate; the prior
  snapshot stays visible (faded) during refresh (no blank); `finance.filter.settled_ms`
  recorded.
- `/finance/intelligence`: period switch refetches **only** the KPI endpoint
  (pre-existing); `kpiSeq` prevents out-of-order overwrite; no background polling.

## Permission & accounting validation
No change to any query, calculation, total, statement, or permission. Every
endpoint remains `requireAuth` + `requireModuleAccess("Finance")` + tenant-scoped
(asserted for all 9 endpoints in `validate:finance-perf`). Purely presentational +
instrumentation client changes + one dead-import removal.

## Tests & build
`validate:finance-perf` **42/42** (first-load skeleton, privacy-safe metrics,
stale-guard, all 9 endpoints auth+Finance+tenant-gated, dead-import removed).
Regressions green: `validate:app-launch` 51, `suppliers-security` 45,
`customers-gate` 10, `server-list` 28. `tsc` clean; `next build` green.

## Rollback
Additive + reversible: revert the merge, or per-file (remove the two skeleton
blocks, the `kpiSeq` guard, the `record/event` calls). No schema/RLS/auth/route
change.

## Remaining Finance bottlenecks (→ future, out of scope)
- `visual-statements` server aggregate (~2 s) is the dominant `/finance`
  time-to-content lever — a server-side query/index optimization (or a smaller
  first-paint projection) is the next Finance win, but needs a measured
  DB-profiling pass (not this wave).
- `/finance/intelligence` could split its single `loading` flag into
  priority(KPI) + secondary(7 feeds) so KPI cards un-skeleton at the first
  response — deferred (low traffic ~3 views/60 d; ~20 card call sites → risk).
- A composed `/finance/intelligence` snapshot endpoint remains an option if that
  route's traffic grows (would need the 7 accounting queries extracted into
  shared builders + partial-failure isolation).
