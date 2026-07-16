# Phase 4 · Wave 2A.1 — Results

Shared server-list foundation + secure endpoint + tests + measured baseline.
The reusable, verifiable pieces are **shipped and live**; the Customers **UI
activation** is prepared but intentionally not auto-deployed (see the pilot doc).

## Commits
| # | Commit | What |
|---|---|---|
| 1 | `247c03f9` | Fix + run the Wave-1 auth-equivalence test (`.mts` ESM) → **13/13 pass** |
| 2 | `9b0f6e2b` | `server-list/{types,apply}` + `useServerList` + `useDebouncedValue` |
| 3 | `8754937c` | `GET /api/contacts?paged=1` server-list mode (opt-in, backward-compatible) |
| 6 | `9c442139` | `validate:server-list` — 28 security/normalization assertions |
| 7 | *(this)* | Docs + baseline |

All code commits verified **green** on Vercel (build + deploy). Endpoint live-
smoked anon: `paged=1` → 401 (auth-gated, incl. hostile `pageSize`/`sort`/`dir`
params → no 500); legacy mode unchanged.

## Preliminary closure — auth-equivalence
- All **13** scenarios executed; **13 passed, 0 failed**.
- Test required correction: the committed `.ts` couldn't run (tsx compiles `.ts`
  → CJS, where its top-level `await` is unsupported). Converted to `.mts` (ESM)
  run via `node --experimental-test-module-mocks --import tsx`. `cache()` does
  **not** memoize outside a request scope in the runner, so `cached == uncached`
  is asserted **directly** for every non-null scenario (strongest form).

## Tests
- `validate:auth-equivalence` — 13/13 (executed this pass, deps installed).
- `validate:server-list` — **28/28**: page-size cap; page/dir defaults; sort-field
  allowlist (injection-shaped sort → default, never echoed); filter key+value
  allowlist; query normalization + length cap with **Chinese / Arabic / English +
  NFC** preserved; pagination metadata.
- `tsc --noEmit` — clean for all new files; full Vercel build green.

## Before/after — measured DATA (SQL, 120 Koleex customers)
| Metric | Legacy | Paged page 1 |
|---|--:|--:|
| Rows on first paint | 120 | **50** (−58%) |
| Slim-projection bytes | 88,765 (all 120) | **36,836** (page of 50) |
| `SELECT *` bytes (worst case) | 13,824,880 | — |
| Search | client-side, full array | **server-side, approved columns** |
| Stale-request cancellation | none | **AbortController (hook)** |
| Cache isolation | n/a | **per account+tenant query key** |

**Not yet measured (requires an authenticated browser + the UI activation):**
initial-paint time, keystroke→settled latency, React commit duration, DOM node
count, background req/min reduction. These are captured when the UI is wired.
No percentiles are estimated.

## Acceptance criteria status
| Criterion | Status |
|---|---|
| Server-driven search | ✅ endpoint (live) |
| Server-driven pagination | ✅ endpoint (live) |
| Stale requests cancelled/ignored | ✅ hook (AbortController + TanStack) |
| Tenant + role restrictions unchanged | ✅ reuses existing gate + `sanitizeContactRows` |
| No new sensitive columns exposed | ✅ slim non-sensitive projection + sanitize |
| Account/tenant cache isolated | ✅ query-key scoped |
| Materially fewer initial rows/bytes | ✅ measured (120→50 rows; 87KB→37KB slim) |
| Customers no longer downloads full dataset **by default** | ⏳ **pending UI activation** (endpoint ready) |
| Background full-list polling removed | ⏳ **pending UI activation** (design specified) |
| UI retains current functionality | ⏳ **pending UI activation + preview verification** |
| Before/after user-facing timings documented | ⏳ pending activation |

## Rollback
Delete the `paged=1` branch (legacy path untouched); the hook/types are
unreferenced until wired. No migration/RLS/auth change.

## Recommendation
Do **not** roll out to Contacts/Suppliers yet. Next step (Wave 2A.2, on
approval): activate the Customers UI wiring in a **preview deploy**, verify all
preserved behaviors + capture real user-facing timings, then extend the same
endpoint config + hook to Suppliers and Contacts.


---

## Preview activation (Wave 2A.1 UI) — 2026-07-16

**Branch:** `wave2a1-customers-preview` (commits `5fda4d91`, `f0ea64b7`). NOT merged to main; production unchanged.
**Vercel Preview:** https://koleex-hub-git-wave2a1-customers-preview-kamal-shafeis-projects.vercel.app — **built green.**
**Access note:** the Preview is protected by **Vercel Deployment Protection (SSO)** — opening it requires being logged into the Vercel account (Kamal). Open the URL while signed into Vercel, then navigate to `/customers`. Force modes: `/customers?serverlist=1` (server-list) · `/customers?serverlist=0` (legacy).

### What's wired
- **Gate** (`customers-gate.ts`, 7/7 tests): production host → legacy ALWAYS; server-list only on preview hosts / `?serverlist=1`. `customers/page.tsx` defaults to legacy and flips only after mount on a non-prod host → production renders identically, no flash.
- **Global summary** (`/api/contacts?summary=1`): permission-safe tenant-wide total/active/inactive via head-only counts (NO full-dataset fetch). Tier/country deferred (labelled).
- **CustomersServerList**: server search (debounced + AbortController via `useServerList`), status filter, sortable Name/Company, offset pagination (prev/next + page count from `total`), **select-CURRENT-PAGE only** (explicitly labelled "page-only selection"), row → `/customers/[id]`, loading/empty/error/retry, summary cards sourced from the aggregate (NOT the page). **No 20 s poll** (TanStack cache-first + reconnect + manual refresh). Create/Edit-in-place **deferred to classic view** (documented limitation).

### CRITICAL correctness handling (page rows vs global stats)
Global summary cards use the server aggregate; the page's 50 rows never drive totals. Tier/country/branch/owner breakdowns are **omitted** from the preview summary (not computed from the page) until a grouped aggregate is added. Bulk-selection total is explicitly "N selected on this page (page-only)".

### Authenticated validation + before/after measurement — BLOCKED (handed off, NOT fabricated)
I could not execute the interactive behavior / permission / performance validation or the before/after browser measurements, because: (1) the Preview is behind **Vercel SSO** (I cannot reach the app), and (2) I have **no Koleex app credentials** and cannot safely mint login fixtures (bcrypt probes; the Preview shares the prod Supabase, so account creation is a gated prod-DB write). No browser measurements are estimated.

**Data facts I CAN measure (SQL, 120 Koleex customers):** first-paint rows 120→50; slim bytes 88,765(all)→36,836(page). Endpoint auth-gate verified anon on production (401, no 500 on hostile params). Local: `validate:auth-equivalence` 13/13, `validate:server-list` 28/28, `validate:customers-gate` 7/7, tsc clean, **Vercel production build of the branch green**.

### Behavior matrix — TO BE VERIFIED by an authenticated operator in the Preview
| Customers feature | Legacy | Preview server mode | Result |
|---|---|---|---|
| List renders | full 120 rows | 50/page server-paged | ⏳ verify |
| Search | client, full array | server `ilike` (EN/ZH/AR) | ⏳ verify |
| Status filter | client | server `is_active` | ⏳ verify |
| Sort Name/Company | client | server order + id tiebreak | ⏳ verify |
| Pagination | none (all rows) | offset prev/next | ⏳ verify |
| Global summary cards | from full array | server aggregate | ⏳ verify |
| Select-all | (n/a) | current-page only, labelled | ⏳ verify |
| Open customer detail | inline/route | route `/customers/[id]` | ⏳ verify |
| Create/Edit | inline modals | deferred → classic view | ⚠ deferred |
| 20 s background poll | present | removed | ⏳ verify |
| Role/tenant/view-as isolation | enforced | same server gate | ⏳ verify |
| Cache isolation on account switch | n/a | query-key scoped | ⏳ verify |

### Measured comparison — pending authenticated Preview session
| Metric | Production legacy | Preview server mode | Change | Samples |
|---|---|---|---|---|
| First-paint rows | 120 | 50 | −58% | SQL |
| Slim payload bytes | 88,765 | 36,836 | −58% | SQL |
| Initial load time | — | — | ⏳ | needs authed browser |
| Search latency (EN/ZH/AR) | — | — | ⏳ | needs authed browser |
| Background req/min | ~3 (20s poll) | ~0 | ⏳ confirm | needs authed browser |
| React commit / DOM nodes | — | — | ⏳ | needs authed browser |

---

## Preview revision after feedback — 2026-07-16 (commit `50a99eaa`)

Preview rebuilt green (same URL). Feedback → response:
| Feedback item | Response |
|---|---|
| Search / Pagination / Counts | ✅ passed — unchanged |
| Create/edit **missing** | ✅ added quick create/edit modal (reuses `createContact`/`updateContact`); full profile via `/customers/[id]` |
| Arabic translation **missing** | ✅ added (`customers-list.ts` en/zh/ar via `useTranslation`) |
| Chinese translation **missing** | ✅ added |
| Card view **missing** | ✅ added List/Card toggle (persisted) |
| Returning from detail loses page state | ✅ fixed — `useServerList` `persistKey` restores page/search/filter/sort from sessionStorage |
| Faster/slower than legacy | ⏳ still needs a real authenticated measurement (SQL shows 120→50 rows, 87→37 KB/page; browser timing pending) |
| Production promotion | ❌ NOT approved — stays on branch |

**Still deferred / limitations:** quick-create/edit covers core fields only (full field set = `/customers/[id]`); tier/country summary breakdowns omitted; RTL layout relies on the app's global dir handling (verify Arabic visually). Contacts + Suppliers remain on the legacy path.


---

## Monitored rollout — observation window #1 (2026-07-16)

**Scope:** Customers server-list production rollout only (`?serverlist=1`); default `/customers` stays legacy.

### Honest telemetry-access limits (read first)
- **Performance metrics (P50/P75/P95/P99 for `contacts.list`, response bytes, rows, search/pagination/summary latency, 4xx/5xx, aborted, duplicate, background req/min, fallback rate) live in Vercel runtime logs (`[kx-server-timing]`, `[kx-metric]`) and Speed Insights.** This environment has **no Vercel API access** (only GitHub + Supabase), so those cannot be pulled here. **None are estimated or fabricated.**
- **The rollout is minutes old and opt-in** — so there is **no accrued real-usage window** for server-list yet.

### Real production signal available in-DB (activity_events)
| Metric | Value | Source |
|---|---|---|
| `/customers` route events, last 7 days (all tenants) | **35** (~5/day) | `activity_events` (real users) |
| `?serverlist=1` real sessions | **~0** | rollout minutes old; `activity_events` records pathname, not the query flag |
- **Implication:** `/customers` is a **low-traffic route** (~5 visits/day). Meaningful server-list P95/P99 will need **weeks** of opt-in traffic (or a deliberate internal-usage push) — a few days will not produce a statistically sound tail.

### Performance metrics — NOT collectable here (require Vercel logs, real window)
Request volume · P50/P75/P95/P99 `contacts.list` · bytes · rows · search/pagination/summary latency · create/edit error rate · 4xx/5xx · aborted · duplicate · background req/min · fallback rate → **all pending a Vercel-log window.** The instrument is deployed (`op=contacts.list` + summary/paged variants, with `Server-Timing` headers) so they are computable once traffic accrues.

### Security & correctness invariants — VERIFIED (code/DB/tests, no Vercel logs needed)
| Invariant | Result | Evidence |
|---|---|---|
| Tenant isolation intact | ✅ | paged + summary both `.eq("tenant_id", auth.tenant_id)` (`route.ts`) + `validate:auth-equivalence` cross-tenant 13/13 |
| Role visibility unchanged | ✅ | same `requireModuleAccess` gate + `sanitizeContactRows` as legacy |
| No sensitive fields exposed | ✅ | slim projection (no credit/kyc/hr/ssn) + sanitize; summary = counts + `customer_type`/`country` only |
| Global summary NOT from page rows | ✅ | separate `?summary=1` aggregate endpoint |
| No legacy full-list request alongside paged | ✅ | `CustomersServerList` calls only `useServerList` + summary; **no `fetchContactsByType`** |
| No 20s full-list poll in server-list mode | ✅ | no `setInterval`/silent-refresh in `CustomersServerList`; the legacy `Contacts.tsx` poll isn't rendered in server-list mode |
| Account switch / logout no cached rows | ✅ | query key scoped by `(resource, tenantId, accountId, params)`; logout reload drops cache |

### Data facts (SQL, unchanged from pilot)
First-paint rows 120→50; slim bytes 88,765(all)→36,836(page); summary via permission-safe 2-col aggregate.

### What an operator with Vercel access should collect (real window)
Filter Vercel function logs for `[kx-server-timing]` `op` in {`contacts.list` (tag `paged:1` vs legacy), summary} and `[kx-metric]` from `?serverlist=1` sessions; compute per-op P50/P75/P95/P99 (report sample size), bytes, rows, 4xx/5xx, aborted/duplicate, and background req/min; watch for any `fetchContactsByType` calls co-occurring with paged (should be zero). Separate real-user vs synthetic, cold vs warm, Mainland-China vs other.


---

## Controlled internal cohort rollout (2026-07-16)
Replaced the passive `?serverlist=1`-only rollout with a trusted server-side
cohort. Mechanism + precedence + telemetry + sample gate + rollback + default-
promotion criteria: **`CUSTOMERS_INTERNAL_ROLLOUT.md`**.
- Cohort = env allowlist `KX_CUSTOMERS_SERVER_LIST_ACCOUNT_IDS` (opaque ids,
  server-only, exact match, customer accounts excluded), surfaced as the trusted
  `customersServerList` flag in bootstrap. Precedence: `?serverlist=0` legacy ·
  `=1` server · cohort → server · Preview → server · production → legacy.
- Ships **inert** — nobody in cohort until the env var is set → zero production
  change; `?serverlist=1` still works.
- In-DB telemetry: `customers_{server_list,legacy}_list_open` +
  `customers_server_list_error` in `activity_events` (mode split, no PII).
- Tests: `validate:customers-rollout` (16), `validate:customers-gate` (10).
- Rollback: clear the env var (config) → whole cohort to legacy; `?serverlist=0`
  per-user. Build + deploy green.
