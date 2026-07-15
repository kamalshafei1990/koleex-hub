# Phase 4 Roadmap — System-Wide Performance

Derived from the scorecard + 4 audits. **Wave 1 is the only thing proposed for implementation now; it needs approval before starting.** Waves 2–5 are sequenced but not yet scoped in detail (they depend on Wave-1 measurement).

## Guiding conclusion
The platform's biggest win (Tokyo colocation, ~20× API) is already shipped and the DB is healthy. What remains is: (a) **make every app measurable** so ranking stops being partly inferred, (b) **cut the background-poller floor** that affects every page, (c) **flatten the universal auth prefix**, and (d) **code-split the few eager heavy components**. These four improve *most or all* apps — exactly the "shared high-impact" definition.

## Wave 1 — Shared high-impact (proposed; needs approval)
| # | Change | Improves | Risk | Rollback |
|---|---|---|---|---|
| SW-1 | App-wide `[kx-server-timing]` wrapper on API routes (thin helper; opt-in per route or a shared `withTiming`) | measurement for ALL apps → completes the scorecard | none (log only) | remove wrapper |
| SW-2 | Poller reduction: heartbeat → single RPC or 60 s; inbox feed → event-driven off `inbox:account` broadcast (reuse P3 pattern) | every page (idle drain, request floor) | low (keep focus/visibility resync) | revert commit |
| SW-3 | Flatten auth prefix: resolve session + view-as in one round trip | every authenticated request | medium (auth path — needs the harness) | revert commit |
| SW-4 | `dynamic()`-wrap ProductForm, DiscussApp, CRM (+ skeletons) | Products/Discuss/CRM initial load | low | revert per component |
| SW-5 | Verify i18n dictionaries load per-locale; split if eager | any translated app | low (verify-first) | revert |

Expected measurable impact: SW-1 makes P50/P95 visible per app; SW-2 cuts the top-3 request routes toward near-zero while idle; SW-3 removes ~2 DB hops from every API call; SW-4 trims 3 route bundles by 150–300 KB each. All provable via the new timing + Speed Insights + bundle re-measure.

## Wave 2 — Highest-impact apps (after Wave-1 data)
Do NOT predetermine. Once SW-1 gives real per-app P95, optimize the worst-measured workflows (likely candidates from bundle/render proxies: Products form, CRM board, Contacts search) — but confirm with data first.

## Wave 3 — Remaining app hotspots
Medium-priority app-specific fixes surfaced by Wave-1 telemetry + React Profiler sessions.

## Wave 4 — Perceived-performance polish
Skeletons matched to final layout on the top-5 routes; targeted prefetch of likely destinations; retain-content-on-refresh; optimistic UI for safe mutations; scroll/selection preservation on lists.

## Wave 5 — Regression protection
Route/bundle/request budgets in CI (numbers in ROUTE_BUNDLE_REPORT); a `validate:perf` guard (extends `validate:first-party`); Speed Insights + `[kx-metric]`/`[kx-server-timing]` dashboards; PERFORMANCE_STANDARDS doc + CLAUDE.md rules.

## Explicitly out of scope for Phase 4 (per instruction)
Discuss attachment migration, Discuss retry UX, further Storage-category migration, and the Supabase custom-domain experiment — **unless Wave-1 measurements rank them above other bottlenecks** (current evidence does not).

## Measurement limitations to close in Wave 1
- Per-route P50/P95 for ~475 routes (SW-1 fixes this).
- Authenticated React Profiler sessions (owner/CI, not this environment).
- Speed Insights percentiles (accumulate with real traffic).

---

## Wave 2 — measured application-specific optimization (2026-07-16)

**Status: measurement + scorecard COMPLETE; implementation NOT started (awaiting approval).**
Baseline + ranked scorecard: `PHASE_4_WAVE_2_BASELINE.md`. Audits:
`API_WATERFALL_AUDIT.md`, `SHARED_LIST_SEARCH_AUDIT.md`, `ROUTE_BUNDLE_REPORT.md`,
`REACT_RENDERING_AUDIT.md`.

**Headline finding:** 8/10 directory apps download the full tenant dataset and
filter/paginate client-side (0/10 paginate, 0/10 virtualize). React Compiler is
**off**, so missing memoization is a real cost.

**Proposed sequence (each independently reversible; security-preserving; separate commits):**
- **Wave 2A (cross-app):** `useServerList` hook (server pagination + `q=` search +
  cancellation + cache-first + warm-start) → Customers/Suppliers/Contacts first,
  then Products/Employees/Accounts/Catalogs/Quotations-list; promote
  `useDebouncedValue`; kill Contacts 20 s silent poll.
- **Wave 2B (top workflows):** FinanceDashboard 8-way fan-out → composed snapshot;
  Quotations editor reference-list dedupe; CRM edit-modal server-search picker.
- **Wave 2C (measured React hotspots):** shared virtualized list primitive;
  `useDeferredValue` in Accounts/Employees; QuotationA4Preview memoization.
- **Deferred pilots:** Finance i18n active-locale (SW-5); lazy-loading preload
  correction — only after the authenticated lazy-loading measurement.

**Still deferred (evidence does not rank them above the above):** Discuss
attachment migration, Discuss retry UX, further Storage-category migration,
Supabase custom-domain experiment.

**Measurement gaps to close during Wave 2:** real-user P50–P99 from a Vercel-log
window (instrument now deployed); authenticated lazy-loading + React Profiler
sessions; Mainland-China samples.
