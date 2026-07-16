# Koleex Hub — System-Wide Performance Scorecard (Phase 4)

**Date:** 2026-07-15 · **Scope:** all 240 page routes, 483 API routes, shared layers. Ranking = measured evidence (pg_stat, Vercel logs, deployed bundles, component sizes) + code-path analysis, each labeled. **No code changed in this phase — measurement + ranking only.**

## Measurement sources & honest limits
| Source | Coverage | Limit |
|---|---|---|
| pg_stat_statements | every DB query, platform-wide | cumulative since reset; contains pre-fix residue (labeled) |
| Vercel runtime logs | request volume by route; `[kx-server-timing]` for Discuss + `/api/files` | **only Discuss + files routes are server-timing-instrumented** → no per-route P50/P95 for the other ~475 routes yet (this is finding SW-1) |
| Deployed bundle inspection | initial shell + heavy-dep map | Next 16 build-manifest not at legacy URL → per-route bundle uses component-source-size proxy |
| Speed Insights | enabled, real-user CWV | needs live traffic to populate percentiles |
| Agent network (curl) | unauthenticated endpoints only | throttled/lossy; not used for ranking latency |
| Authenticated RUM / React profiling | — | **not possible from this environment** (no interactive browser session as a real user); render-hotspot ranking is code-analysis, labeled as such |

## The dominant fact
**The Tokyo region colocation (Phase 3, `43ec03b5`) already delivered the single biggest platform-wide win: server-side API time dropped ~20× (`myChannels` P50 3,604 ms → ~170 ms; auth stage ~1 s → ~65 ms).** Every other item below is incremental against that. The database is healthy — no slow queries remain (the 935 ms contacts row in pg_stat is frozen pre-fix residue: `calls` stuck at 110, unchanged since the fix).

## Ranked scorecard (shared layers + apps)

| Rank | App / layer | Workflow | Current (measured/derived) | User impact | Root cause | Priority |
|---|---|---|---|---|---|---|
| 1 | **Shared — observability** | measuring every app | only 2 route families instrumented | can't rank the other 475 routes | server-timing not wrapped app-wide | **P1 (unblocks everything)** |
| 2 | **Shared — background pollers** | idle CPU/network/DB on every page | heartbeat 2 writes/30 s + inbox feed/60 s + (discuss cut in P3) | steady drain, battery, request floor | interval pollers not all event-driven/idle-gated | **P1** |
| 3 | **Shared — auth per request** | every API call | 3 sequential awaits → parallel batch of 4; ~sub-ms each post-Tokyo | cheap now, but ubiquitous | session→viewas→viewasrole serial hops | P2 |
| 4 | **Products / Product Data** | ProductForm open | ProductForm.tsx 303 KB **eager** | heavy form loads with route | not `dynamic()`-imported | P2 |
| 5 | **Discuss** | app open | DiscussApp.tsx 165 KB **eager** | heavy on open | not `dynamic()` | P2 (already fast server-side) |
| 6 | **CRM** | app open | CRM.tsx 158 KB **eager** | heavy on open | not `dynamic()` | P2 |
| 7 | **Shared — i18n dictionaries** | any translated app | finance.ts 293 KB, contacts.ts 228 KB, accounts.ts 117 KB | possible eager multi-locale ship | need to verify per-locale loading | P2 (verify first) |
| 8 | **Customers / Suppliers / Contacts** | list + search | Contacts.tsx 764 KB (already `dynamic()`) | render surface huge; per-keystroke risk | one giant component powers 3 apps | P2 (profile before splitting) |
| 9 | **Finance** | statements/intelligence | visual-statements recompute ~2.3 s cold (SWR-cached, P1 fix) | first load heavy | journal aggregation | P3 (cached) |
| 10 | **Home** | shell paint | bootstrap single cached call; grid warm-starts | already fast | — | P3 (monitor) |

## Top 10 slowest user workflows
Ranked from evidence; ⚠ = derived/needs Phase-2-style per-route instrumentation to confirm P95.
1. First cold app load on a *fresh* device (no warm-start cache) — full shell JS (~1.94 MB uncompressed) — ⚠.
2. Opening Product Data form (ProductForm 303 KB eager) — ⚠ bundle-derived.
3. Opening CRM (158 KB eager) — ⚠.
4. Opening Discuss cold (165 KB eager; server side now ~170 ms) — ⚠.
5. Customers/Suppliers/Contacts large list + type-to-search (764 KB component) — ⚠ render.
6. Finance statements first load (~2.3 s recompute, then SWR-cached) — measured P1.
7. Catalogs large-PDF preview (now first-party range, ~1–2 MB to first page) — measured P3.
8. Quotation A4 preview render (435 KB, lazy) — ⚠.
9. Any authenticated API from mainland China without the region+first-party work — mitigated, ⚠.
10. Product detail legacy view (121 KB) — ⚠.

## Top 10 highest-request routes (Vercel, measured)
1. `/api/discuss/read` (polling — cut by P3, will drop further) 2. `/api/activity/heartbeat` (30 s) 3. `/api/inbox/feed` (60 s badge) 4–17. auth/signin, files (my test traffic), version, perf/ingest. **Real user traffic is currently low; the top-3 are background pollers, not navigation** — confirming poller reduction is the highest-leverage request-volume work.

## Top 10 largest route bundles (component-source proxy)
Contacts 764 KB (lazy) · QuotationA4Preview 435 KB (lazy) · ProductForm 303 KB (**eager**) · catalogs/page 214 KB · DiscussApp 165 KB (**eager**) · CRM 158 KB (**eager**) · management/page 145 KB · Quotations 128 KB · SupplierDetail 125 KB · LegacyProductView 121 KB. **Eager ones (ProductForm/DiscussApp/CRM) are the actionable subset.**

## Top 10 React rendering hotspots (code-analysis — profiling needs an authenticated session)
Contacts (764 KB, 3 apps, search/filter in one tree) · ProductForm (303 KB form) · CRM (drag/drop board) · DiscussApp (message list, not virtualized) · management/page · QuotationA4Preview · catalogs grid · SupplierDetail · QaReportsApp · LegacyProductView. Ranking is by size + known interaction density; **must be confirmed with React Profiler on a real session before optimizing** (mandate rule).

## Top 10 repeated data requests
1. auth accounts lookup — 31,407 calls (every API) 2. koleex_employees dept — 31,645 3. permissions per request 4. heartbeat user_devices UPDATE — 9,405 5. heartbeat app_sessions UPDATE — 9,410 6. inbox_messages count — 8,190 7–10. discuss read/members/messages/channels (polling, P3-reduced). Bootstrap itself is already deduped/cached (good).

## Top 10 cross-cutting risks
1. No app-wide server-timing (can't see regressions). 2. Pollers unbounded by real event model. 3. Eager heavy components. 4. i18n dictionaries possibly multi-locale-eager. 5. Non-virtualized long lists (Discuss, big tables). 6. Per-keystroke re-render in giant search components. 7. Auth serial hops. 8. China WSS still degraded (mitigated by fallback). 9. Speed Insights not yet populated. 10. No route/bundle/request budgets in CI.

---

## Phase 4 Wave 2 — measured ranked scorecard (2026-07-16)

Full detail + methodology + honesty table in **`PHASE_4_WAVE_2_BASELINE.md`**.
Supporting audits: `API_WATERFALL_AUDIT.md`, `SHARED_LIST_SEARCH_AUDIT.md`,
`ROUTE_BUNDLE_REPORT.md`, `REACT_RENDERING_AUDIT.md`. Ranked by **measured
structural cost** (requests/action × payload × filter-locus × frequency), not
file size. Real-user P50–P99 pending a Vercel-log window (no Vercel API access
from the build env); the new `*.list` server-timing enables them.

**Resolved since Wave 1:** risk #1 (app-wide server-timing) — `auth.resolve`
universal + `contacts/products/quotations/accounts.list` now instrumented.
`auth.resolve` measured **flat**: 1 DB round trip, 21–120 ms (risk #7 is a
non-issue). #3 eager heavy components partly addressed (CRM/Discuss/ProductForm
lazy in Wave 1; `ROUTE_BUNDLE_REPORT.md` ranks the next 8).

**#1 platform liability (new, highest-leverage):** **8 of 10 directory apps
download the entire tenant dataset and filter/sort/paginate client-side on every
keystroke** — 0/10 paginate, 0/10 virtualize, 1/10 server-search, 1/10 cancel
stale requests. The cached-read wrappers (`useApiQuery`, `cachedFetchJson`) are
mounted but unused. → Wave 2A `useServerList` shared hook.

**Top structural bottlenecks:** (1) Customers/Suppliers/Contacts list = 4 HTTP
+ 1 Supabase probe + avatar batches + a **20 s silent re-poll**, full-array
client filter, 11.6k-line component; (2) FinanceDashboard **8-way** mount
fan-out; (3) Quotations editor ~6 fetches with reference-list duplication;
(4) CRM edit modal loads the whole contact book; (5) Catalogs ~6-load mount.


> **Wave 2A.1 (2026-07-16):** shared server-list foundation + secure `/api/contacts?paged=1` endpoint + 28-assertion validation SHIPPED (opt-in; Customers UI activation gated on preview verification). The #1 liability (8/10 apps full-download+client-filter) now has its reusable fix. See `SERVER_LIST_ARCHITECTURE.md` + `PHASE_4_WAVE_2A1_RESULTS.md`.
