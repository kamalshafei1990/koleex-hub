# Phase 4 · Wave 2 — Measured Baseline & Ranked Scorecard

**Purpose:** rank the platform's slowest / heaviest real workflows on measured
evidence, to select Wave 2 optimization targets. **This is the measurement
phase. No optimization has been implemented.** Ranking uses *measured
structural cost* (sequential server queries, client request fan-out, payload
shape, client-vs-server filtering) — never source-file size alone.

Companion audits (same commit): `API_WATERFALL_AUDIT.md`,
`SHARED_LIST_SEARCH_AUDIT.md`, `ROUTE_BUNDLE_REPORT.md`,
`REACT_RENDERING_AUDIT.md`.

---

## 0. Measurement honesty — what these numbers are, and are not

| Source | Available here | Used for |
|---|---|---|
| **Static source analysis** (sequential `await`s, fetch fan-out, payload projections, client vs server filtering) | ✅ full, file:line-cited | **Primary ranking basis** |
| **`auth.resolve` live server-timing** (Wave 1) | ✅ observed: session ~0.3–2.4 ms, viewas ~0 ms, **db 21–120 ms** | Auth-prefix cost is measured & flat |
| **New `*.list` server-timing** (Wave 2, this commit) | ✅ deployed, emitting | Enables real percentiles once logs accrue |
| **Synthetic route document TTFB** (anon, single origin) | ✅ N=18/route, below | Cold-route document signal only |
| **Real-user P50/P75/P95/P99 from Vercel logs / Speed Insights** | ❌ **not accessible from this environment** (no Vercel API token; SI needs dashboard) | *Marked "pending log window" — never estimated* |
| Mainland-China real samples | ❌ not collected this window | pending |

Per the mandate, unlike sample types are **not merged**, and unavailable
percentiles are **left blank, not guessed**.

### Synthetic cold/warm document TTFB (SYNTHETIC · N=18 · anon · single origin, hnd1)

| Route | P50 | P75 | P95 | P99 |
|---|--:|--:|--:|--:|
| `/crm` (lazy CRM) | 156 | 162 | 328 | 643 |
| `/discuss` (lazy) | 151 | 171 | 326 | 700 |
| `/products/new` (lazy ProductForm) | 148 | 158 | 408 | 732 |
| `/quotations` (eager) | 150 | 158 | 564 | 1455 |
| `/customers` (Contacts, internally lazy) | 148 | 152 | 197 | 364 |

*This measures the **server document TTFB** of the route shell (anon → client
auth-redirect), NOT lazy-chunk usable-time. It is directional only; see §3 for
why it does not cleanly validate lazy-vs-eager.*

---

## 1. Ten slowest / heaviest workflows — ranked by measured structural cost

Cost model = **requests-per-user-action × payload-shape × filter-locus ×
frequency**. P-columns are blank pending a real log window (instrument now
deployed for the top rows).

| # | App | Workflow | Reqs/action | Payload / filter locus | Root cause (file:line) | P50/P75/P95/P99 |
|---|---|---|--:|---|---|---|
| 1 | Customers/Suppliers/Contacts | Directory list open | **4 HTTP + 1 direct-Supabase probe + ⌈N/30⌉ avatar batches**, then **silent re-poll every 20 s + on focus** | Full tenant dataset, **no `.limit`/`.range`**; search/filter/sort **100% client-side**; no virtualization | `contacts/route.ts:63-74` (no limit), `Contacts.tsx:5166-5219` (client filter), `:5088-5137` (20 s poll), `:4842`+`:4863` (accounts+me on mount) | pending |
| 2 | Finance | Intelligence dashboard load | **8 parallel fetches** on mount | 7 of 8 return full datasets, grouped/filtered client-side | `FinanceDashboard.tsx:161-219` | pending |
| 3 | Quotations | Editor bootstrap | **~6 fetches** (doc + saved-assets + 4 reference lists from ShipmentDetailsCard) | reference lists re-fetched again by on-demand modals (duplication) | `QuotationA4Preview.tsx:5767-5782`, `:6437-6439`; dup at `:6685-6687`,`:7054` | pending |
| 4 | CRM | Board load + card edit | board **2**; edit modal **+2** (full contact book + activities) | opps `limit=500` then **client filter**; modal loads entire contact book for autocomplete | `crm.ts:234-237`, `CRM.tsx:261-285` (client filter), `:1739` (full contacts) | pending |
| 5 | Catalogs | List open | **~6 loads** (catalogs + contacts + 2 taxonomy + 2 storage-list) | full array, **client-side** tokenized search + incremental reveal | `catalogs/page.tsx:2790-2817`, `:2824-2857` | pending |
| 6 | Products / Product Data | List open | 1 wide fetch | full dataset, **client filter**; ✅ has AbortController (only app that does) | `products/route.ts:46-52` (no limit), `ProductList.tsx:540` (filter), `:233` (abort) | pending |
| 7 | Employees / HR | List open | 1 fetch | full dataset, **client filter, no debounce** | `employees/page.tsx:106` | pending |
| 8 | Accounts | List open | 1 fetch | full dataset, **client filter, no debounce** | `AccountsList.tsx:201` | pending |
| 9 | Notifications | Steady-state + bell open | **~2 req / 60 s** per open tab; **3 fetches** per bell open | inbox unread + discuss insurance polls; bell open triple-loads | `NotificationBell.tsx:340-373`, `:300-337`, `:408-426`; full inbox pulls 200 rows `inbox/page.tsx:297` | pending |
| 10 | Quotations | List open | 1 fetch (items stripped ✅) | full array, **client-side** stats/filter | `Quotations.tsx:2265-2277`; picker modals pull 500/2000 rows client-filtered (`CustomerPickerModal.tsx:60`, `ProductPickerModal.tsx:114`) | pending |

**Auth prefix** (runs on every row above) is already measured & flat: 1 DB
round trip, 21–120 ms (Wave 1). It is **not** a bottleneck and is excluded.

---

## 2. The dominant cross-cutting finding (highest leverage)

From `SHARED_LIST_SEARCH_AUDIT.md` (capability matrix, 10 directory apps):

| Capability | Apps that have it |
|---|---|
| Server-side search (`q=` → API) | **1 / 10** (Inventory only) |
| Stale-request cancellation (AbortController) | **1 / 10** (Products only) |
| Pagination (`.range`/`.limit`) | **0 / 10** |
| List virtualization / windowing | **0 / 10** (no windowing lib installed) |
| Shared table/row component | **0 / 10** (each hand-rolls `.map`) |
| Shared debounced-search hook adopted | **0 / 10** (`useDebouncedValue` exists but trapped in Inventory) |
| localStorage warm-start | **1 / 10** (Contacts only) |
| TanStack cache-first paint | **1 / 10** (Catalogs only) |

**8 of 10 directory apps download the entire tenant dataset once and
filter/sort/paginate the whole array in the browser on every keystroke.** The
purpose-built cached-read wrappers (`useApiQuery`, `cachedFetchJson`) are
mounted but **effectively unused** (`useApiQuery.ts:20`, `fetch-cache.ts:39`).

This single pattern is the largest measured performance liability on the
platform and the highest-leverage Wave 2A target: one shared
server-paginated + cancellable + cached list/search hook (`useServerList`)
would improve ~8 apps at once and retire the two dead wrappers.

---

## 2b. Worst React render hotspots (from `REACT_RENDERING_AUDIT.md`)

> **Load-bearing correction:** the **React Compiler is NOT enabled**
> (`next.config.ts:35` `compiler` key is only SWC `removeConsole`;
> `babel-plugin-react-compiler` is an *uninstalled* optional peer at
> `package-lock.json:9917`). So auto-memoization is **not** happening — every
> missing `React.memo`/`useCallback`/virtualization is a real, measurable cost.
> This corrects an earlier assumption; treat the memory note about a
> "React-Compiler impure function" as stale on the memoization point.

Platform-wide facts (grep-verified): **0 virtualization anywhere in `src/`**;
`React.memo` **essentially absent** from every list/row component.

| # | App | Hotspot | Trigger → blast radius | Location |
|---|---|---|---|---|
| 1 | Quotations | whole `current` prop-drilled into un-memoized 9,390-line `QuotationA4Preview` w/ ~15 inline-arrow props | any keystroke (name/notes/price) → **entire preview re-renders** | `Quotations.tsx:2710` |
| 2 | Discuss | message list plain `.map`, un-memoized `MessageBubble`, no windowing | composer keystroke + each realtime tick → **full list reconcile** | `DiscussApp.tsx:2463/2641` |
| 3 | CRM | 0 `React.memo` in 4,095 lines; drag-hover state at top | each column crossing → **all columns+cards re-render** | `CRM.tsx:198/310` |
| 4 | Contacts | 11.6k lines, search+selection state at top, inline rows, no windowing | keystroke → **all `filtered` rows re-render** | `Contacts.tsx:6279/6284` |
| 5 | ProductForm | single 81-field `product` object spread-copied per keystroke | keystroke → object churn (mitigated: only active wizard step mounts) | `ProductForm.tsx:497/1088` |
| — | Accounts / Employees | missing `useDeferredValue(search)` (Products has it, `ProductList.tsx:191`) | keystroke → full re-filter at **blocking** priority | `AccountsList.tsx:81`, `employees/page.tsx:89` |

Recurring anti-pattern: **whole-object `useState`** (ProductForm, Quotations,
Contacts) makes dependent `useCallback`s inert (recreated each edit). Healthy /
do-not-touch: root Providers, realtime effects (ref-guarded), QA Inspector
context, conditionally-mounted modals. Minor: `SidebarContext.tsx:55`,
`i18n.tsx:1249` recreate value objects each render (low blast radius).

*Note: virtualization + `React.memo` fixes must be applied with measured
evidence per the mandate — not blanket-memoized.*

## 3. Wave 1 lazy-loading validation — honest result

- **Static:** confirmed CRM (158 KB), Discuss (165 KB), ProductForm (303 KB×4
  routes) are now in separately-loaded chunks (`ROUTE_BUNDLE_REPORT.md`). ✅
- **Synthetic TTFB (§0):** the lazy routes show a slightly *heavier* cold P95/P99
  tail than `/customers`, but this measures **anon document TTFB (server render
  + cold-start), not the lazy chunk's fetch/parse/usable-time**, and all shells
  return a similar auth-redirect document. **It neither confirms nor refutes a
  user-facing lazy-vs-eager delta.**
- **What's still needed (documented, not executed):** an **authenticated browser
  session** capturing, per route, {shell-visible, chunk req start/end, component
  usable, skeleton duration, cold vs warm nav, JS transferred, duplicate
  post-mount fetches, error/timeout rate} vs a controlled eager baseline. This
  needs a logged-in client the deploy sandbox can't cheaply provide.
- **Risk flagged by the CRM/Discuss fan-out audit:** these components fetch on
  mount; if a lazy boundary makes a *frequent* user wait on chunk+data serially,
  intent-based preload (sidebar/launcher hover, idle-after-shell) is the
  mitigation — **to be decided by the authenticated measurement, not assumed.**
  No preload has been added (mandate: don't globally preload heavy apps).

**Verdict:** lazy split is structurally in place and reduces initial route JS;
its net user-facing benefit is **not yet measured** and is the first task of any
Wave 2 lazy-loading follow-up.

---

## 4. Authenticated auth-equivalence closure (Wave 1 gap)

- **Deterministic test** `validate:auth-equivalence` (committed): 13 scenarios
  (SA / admin / restricted / customer / disabled / expired / revoked /
  cross-tenant / view-as account / view-as role / account-switch / concurrent /
  db-error) assert uncached `resolveServerAuth` ≡ cached `getServerAuth` and the
  correct per-role safe shape. Runs in CI (needs `node_modules`); **not executed
  in the deploy sandbox** (no deps installed there).
- **Live (no credentials):** anon → 401 on all authed endpoints; forged/garbage
  session cookie → 401 (not 500, HMAC rejects); tenant-scoped file route → 401.
  ✅ post-deploy.
- **Residual gap (stated):** a fully-authenticated multi-role live diff was not
  run — probe fixtures are bcrypt (no recoverable plaintext) and creating new
  prod `accounts` fixtures collides with `accounts_identity_per_type` and is a
  gated prod-data write. Per-role correctness rests on the deterministic test +
  the by-construction proof (`AUTH_DEPENDENCY_GRAPH.md`).

---

## 5. Proposed Wave 2 targets (for approval — NOT started)

### Wave 2A — cross-application (build once, fix many)
1. **`useServerList` hook** — server-side pagination + `q=` search + AbortController
   cancellation + TanStack cache-first + localStorage warm-start. Adopt in
   Customers/Suppliers/Contacts first (one component, 3 routes → biggest single
   win), then Products, Employees, Accounts, Catalogs, Quotations-list.
   *Impact:* removes full-dataset downloads + per-keystroke full-array filtering
   for ~8 apps. *Risk:* medium (must preserve tenant scoping + column policy +
   every filter's semantics server-side); each app migrated + verified separately.
2. **Promote `useDebouncedValue`** to `src/lib/hooks/` and adopt in the 8 apps
   that debounce inline or not at all. *Risk:* low.
3. **Kill the Contacts 20 s silent re-poll** / make it visibility+realtime-aware
   (mirrors the Wave 1 heartbeat pattern). *Risk:* low.

### Wave 2B — highest-ranked business workflows
4. **FinanceDashboard 8-way fan-out** → one composed `/api/finance/dashboard`
   snapshot (or parallel-but-batched) with per-widget lazy hydration. *Risk:* medium.
5. **Quotations editor reference-list duplication** → load payment-terms /
   incoterms / shipping-methods / shipping-documents once, share to the on-demand
   modals (dedupe the 2nd + 3rd fetch bundles). *Risk:* low-medium.
6. **CRM edit modal** → don't load the entire contact book on open; use the
   server-search picker. *Risk:* low.

### Wave 2C — measured React render hotspots (app-specific)
7. **List virtualization** — introduce one shared windowed-list primitive
   (nothing virtualizes today) for the big lists (Contacts, Discuss messages,
   Products, statement tables). Pairs naturally with `useServerList`. *Risk:* medium.
8. **`useDeferredValue(search)`** in Accounts + Employees (cheapest win; Products
   already has it). *Risk:* low.
9. **Quotations `QuotationA4Preview` memoization** — memoize the preview + split
   whole-object edit state so typing doesn't re-render the whole doc. *Risk:*
   medium (large component; measured before/after with React Profiler).
   *(Because the React Compiler is off, these manual fixes are real wins, not
   redundant.)*

### Deferred pilots (only if measurement ranks them)
- **Finance i18n active-locale pilot** (from Wave 1 SW-5) — Finance only, behind
  a synchronous-`t()`-preserving provider; migrate Contacts/Accounts only after
  proven. Not started.
- **Lazy-loading preload correction** — only after the authenticated
  measurement (§3) shows a real regression for frequent users.

**Security invariant for every target:** all filtering/scoping that currently
happens after a full fetch must move to the **server query** (tenant_id, column
policy, view-as, RLS) — never "fetch broader, filter in browser". No cache may
be shared across users or tenants.

---

## 6. Status

Measurement + instrumentation + scorecard: **COMPLETE.** Optimization
(Wave 2A/2B): **NOT STARTED — awaiting explicit approval.**
