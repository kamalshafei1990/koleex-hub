# Finance Dashboard Performance — Baseline (Phase 4 Wave 2B.1)

**Confirmed the actual implementation before changing anything** (the scorecard's
"~8-request fan-out" needed verification).

## Two distinct Finance dashboards
| Route | Component | Mount requests | Verdict |
|---|---|---|---|
| **`/finance`** (primary landing) | `FinanceHome` → `StatementsDashboard` (`VisualStatements.tsx`) | **2 finance requests**: `visual-statements` (one composed aggregate) + `setup/status` (non-critical banner) | **Already single-aggregate** — no fan-out to compose |
| **`/finance/intelligence`** | `FinanceDashboard.tsx` | **8 requests**: `dashboard?period=` + `Promise.all`(orders, payments, expenses, treasury, reconciliation/candidates, bank-imports, treasury-plans) | The real fan-out — but already **concurrent** |

The "~8" from the scorecard is the **`/finance/intelligence`** dashboard, NOT
`/finance`. The primary `/finance` fires only 2 finance requests + 4 global-shell
requests (`me/bootstrap`, `activity/heartbeat`, `version`, `qa/assignees`) that
fire on every route.

## Request dependency graph
- **`/finance`:** `visual-statements` and `setup/status` are two independent
  `useEffect`s → parallel, **no client waterfall**. The only cost is *server-side*
  inside `visual-statements` (a synchronous ledger aggregate, self-documented
  ~2 s; cached `private, max-age=60, SWR=300`). Chart = hand-rolled inline SVG
  (`TrendChart`), zero chart-library JS. No polling.
- **`/finance/intelligence`:** `dashboard?period=` (period-scoped KPIs) +
  `loadStatic()`'s 7 feeds are **all invoked in the same `Promise.all` tasks
  array on first mount → all 8 fire concurrently** (not a waterfall). Period
  switches refetch ONLY the KPI endpoint (already optimized). Cards receive a
  `loading` prop (per-card loading, not a full blank).

## Root causes (evidence-ranked)
1. **`/finance` blanks below the control bar until the ~2 s aggregate lands** —
   `loading.tsx` covers only the route transition; the in-component first fetch
   had **no section skeleton** (`{snap && …}` gates hero + body). *Biggest
   perceived-latency lever.* (agent finding #1)
2. **`/finance/intelligence` is all-or-nothing** — `setLoading(false)` fires only
   after **all 8** settle, so the KPI cards stay in loading state until the
   slowest secondary feed lands; and each of the 8 pays its own auth round-trip.
3. **No stale-response guard** on the period-scoped KPI fetch — a slow older-period
   response could overwrite a newer one.
4. **No Finance dashboard instrumentation** — no per-dashboard timing existed.
5. Minor: dead `AppHomeMenu` import in `FinanceHome`.

## Security & accounting posture (unchanged, verified)
Every endpoint (`visual-statements` + the 8 intelligence feeds) enforces
`requireAuth()` + `requireModuleAccess(auth, "Finance")` + `.eq("tenant_id",
auth.tenant_id)` (server-derived tenant, never client-supplied). No branch-level
scoping (tenant-only) — pre-existing, unchanged. No service-role bypass. No
sensitive-field broadening.

## Why a composed mega-endpoint was NOT built (evidence-based)
The task's headline option (one composed snapshot) was **evaluated and rejected**
for this wave because: (a) `/finance` is already single-aggregate; (b) the
`/finance/intelligence` 7 feeds are already **concurrent** (composition's latency
win is marginal — the wall-clock is already ~max, not sum); (c) the 7 are largely
**unrelated workflows** (orders / payments / treasury / reconciliation / imports /
plans) — the task explicitly cautions "do not combine unrelated Finance workflows
simply to reduce the request count" and warns against an unbounded mega-response;
(d) `/finance/intelligence` is very low traffic (~3 views/60 d); (e) composing
would require refactoring 7 accounting endpoints (each does its own inline query
+ currency/profit math) → disproportionate totals/statement-regression risk for
the gain. **Smallest safe architecture = progressive/section-level loading +
stale-response cancellation + instrumentation** (see RESULTS).

## Measurement note
Real P50/P75/P95 total-ms, bytes, DB round trips, and React commit counts are
Vercel-log / Speed-Insights / authenticated-profiler only (not reachable from the
build env). The `finance.dashboard.*` metrics are now emitted so an operator can
pull them from a traffic window. **No percentiles fabricated.**
