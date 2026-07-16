# Server-List Architecture (Phase 4 Wave 2A.1)

The reusable, secure, server-driven list foundation that replaces the platform's
dominant "download the whole tenant dataset and filter it in the browser"
pattern. Built once here (Customers pilot), reusable by every directory app
after each is approved.

## Modules
| File | Role |
|---|---|
| `src/lib/server-list/types.ts` | Framework-agnostic contract: `ServerListRequest`/`Response`/`Config`, `parseListParams`, `normalizeQuery`, `buildListResponse`. |
| `src/lib/server-list/apply.ts` | Server helper: applies a validated request to a Supabase query builder. |
| `src/lib/hooks/useServerList.ts` | Client hook over TanStack Query. |
| `src/lib/hooks/useDebouncedValue.ts` | Canonical debounce used by the hook. |

## API contract
Request params (all optional, all validated against a per-resource `ServerListConfig`):
`page` (1-based) · `pageSize` (clamped to `maxPageSize`) · `q` (normalized) ·
`sort` (approved key only) · `dir` (`asc`/`desc`) · approved filter keys.
Response: `{ rows, page, pageSize, total, hasMore, q, sort, dir }`.

**The server accepts ONLY allowlisted values.** Unknown sort keys fall back to
the default; unknown filter keys and disallowed filter values are dropped;
`pageSize` is clamped; `q` is NFC-normalized, whitespace-collapsed and
length-capped. There is no path for a client to supply a raw column name, SQL
fragment, or arbitrary filter expression. (28 assertions in
`npm run validate:server-list`.)

## Query & permission model
`applyServerList` only adds **search + sort + pagination**. Every security
concern is enforced by the route BEFORE/around it, unchanged from the legacy
path:
- **Auth**: `requireAuth()` (401 if not signed in).
- **Module permission**: `requireModuleAccess(auth, moduleForType(type))`.
- **Tenant scope**: `.eq("tenant_id", auth.tenant_id)` — always, server-side;
  the browser never supplies tenant/org/branch/owner values.
- **Column visibility**: rows still pass through `sanitizeContactRows(auth, …)`,
  so credit / KYC / HR / cost fields are stripped for unauthorized callers.
- **View-as / RLS / ownership / customer-member separation**: inherited from the
  existing auth context + route policy; the server-list layer changes none of it.
- **Search columns are a non-sensitive allowlist** — you cannot search by, or
  match against, a hidden or sensitive column.

Search is built as an OR of `ilike` over the approved columns, with the user
value **double-quoted and escaped** for the PostgREST `.or` grammar (so `,` `(`
`)` `.` are literal and `"`/`\` are escaped) — no injection into the filter
expression.

## Caching model
- `useServerList` uses the app's existing **TanStack Query** client (not a
  second cache). Query key = `["server-list", resource, tenantId, accountId,
  {page, pageSize, q, sort, dir, filters}]`.
- **Cache isolation**: because `tenantId` + `accountId` are in the key, one
  account can never read another's cached list, even in the same browser. The
  app's logout/reload drops the in-memory cache; account-switch changes the key
  so the previous account's entries are never served.
- No sensitive list data is placed in any global unscoped store.

## Cancellation & ordering
- TanStack passes an `AbortSignal` to the query fn; `useServerList` forwards it
  to `fetch`, so a superseded request (new keystroke/page) is **cancelled**.
- TanStack ignores out-of-order resolutions (only the latest query for a key
  updates state), so a slow earlier response can't overwrite a newer one.
- `placeholderData: keepPreviousData` keeps the last usable page on screen while
  the next loads → no flash to empty. `isInitialLoading` vs `isRefreshing`
  distinguish first paint from background refresh.

## Pagination choice — OFFSET (documented tradeoff)
The Customers dataset is **120 rows, single-tenant, low browse-time churn**.
Offset pagination was chosen over cursor because:
- It preserves the exact, familiar ordering with trivial code.
- Cursor's advantages (large / high-write datasets, deep pages) do not apply at
  this size; cursor would add null-handling complexity on `first_name` for no
  measurable benefit here.
- Determinism is guaranteed by ordering on `(sort column NULLS LAST, id)` with a
  **unique `id` tie-breaker**, so pages never duplicate or skip rows under
  stable data. `pageSize` is server-capped (`maxPageSize`).

If a future resource adopting this contract is large or high-churn, switch that
resource's config to cursor pagination (the `ServerListRequest`/`Response`
shape already carries the metadata needed) — the client hook and security model
are unchanged.

## Counts
`total` uses an **exact** count (`count: "exact"`) for the contacts config
because the directory is small (hundreds of rows) and pagination UI benefits.
For a large resource, drop to no-count or an estimated count and rely on
`hasMore` — the response envelope already supports `total: null`.

## Reused by Suppliers (Wave 2A.2)
The Suppliers migration reuses this whole foundation unchanged: `types.ts`,
`apply.ts`, `useServerList`, `useDebouncedValue`, `sanitizeContactRows`, and the
`/api/contacts` `?paged=1` / `?summary=1` branches. Per-resource variation is
config-only: `configForType(type)` picks `SUPPLIERS_LIST_CONFIG` (company-first
sort, supplier-appropriate non-sensitive search/filter columns, `supplierType`
filter) vs the customer config, and the summary breakdown column is type-aware
(`supplier_type` vs `customer_type`). The rollout gate decision was extracted to
`rollout-gate.ts` (`shouldUseServerList`, re-exported by both `customers-gate`
and `suppliers-gate`), and the cohort resolver to `rollout-cohort.ts`
(`makeServerListCohort(envVar)`, used by both `customers-rollout` and
`suppliers-rollout` with independent env vars). Adding the next directory
(Contacts, Products, …) is now: a per-type `ServerListConfig`, a
`<Resource>ServerList` adapter, an env var, and a bootstrap flag. See
`SUPPLIERS_SERVER_LIST_PILOT.md`.
