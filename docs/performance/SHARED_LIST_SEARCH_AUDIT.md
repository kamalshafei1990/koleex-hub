# Shared List / Search / Table / Pagination Audit

Static source analysis of the cross-application directory/list workflows in the
Koleex Hub Next.js app. Goal: find what these lists **share** vs. what each app
**re-implements**, so a single fix can improve many apps at once.

Scope: Customers, Contacts, Suppliers, Products, Employees, Accounts, Finance,
Inventory, Quotations, Catalogs. No servers/network were touched — this is a
read of source only. Every claim below is cited to a verified `file:line`.

---

## 1. The shared infrastructure that EXISTS

| Building block | Location | State |
| --- | --- | --- |
| TanStack Query provider | `src/app/providers.tsx:16` | Mounted app-wide (one `QueryClient` per session). |
| Query client defaults (staleTime 60s, gcTime 10m, no refetch-on-focus) | `src/lib/query/client.ts:16-27` | Good defaults, but almost nothing consumes them. |
| `useApiQuery` / `fetchJson` cached GET wrapper | `src/lib/query/useApiQuery.ts:20,54` | **Effectively unused** — only importer is `src/lib/server/fx.ts` (server FX, not a list). |
| `cachedFetchJson` SWR-ish dedupe+TTL wrapper | `src/lib/fetch-cache.ts:39` | **Effectively unused** — only importer is `src/lib/docs-sync.ts`. |
| `me-bootstrap` shared per-user bootstrap (auth/header/modules) | `src/lib/me-bootstrap.ts:1-80` | Genuinely shared; 60s client cache; used by header/sidebar/PermissionGate. This is the ONE working shared-cache story. |
| `useDebouncedValue<T>` debounce helper | `src/components/inventory/InventoryUx.tsx:166` | Exists but **buried inside the Inventory module** — not a shared hook; other apps re-implement debounce inline. |
| `DataTable` component | `src/components/security/DataTable.tsx` | Used **only** by the Security module (`ThreatList.tsx`, `DeepDiveTabs.tsx`). Not used by any of the 10 audited apps. |

**Verified via grep:** the only files importing `@tanstack/react-query` are
`src/app/providers.tsx`, `src/app/catalogs/page.tsx`,
`src/components/admin/ProductList.tsx`, plus the two lib files above. So of the
10 apps, only **Catalogs** (and Products, for `invalidate`) touch the shared
query cache at all.

**No virtualization library is installed** (`package.json` has no
`react-window` / `@tanstack/react-virtual` / `react-virtualized`). Every list
renders its full filtered array into the DOM via an inline `.map`.

**No shared pagination component exists.** `pageSize`/pagination logic appears
only in the Database/Visual-Library components
(`src/components/database/*`) — never in the 10 core directory lists.

---

## 2. Capability matrix

Rows = apps. Cells = concrete answer + verified citation. "Client-filter of
full dataset" means the app downloads the entire list once and filters the
in-memory array on every keystroke.

| App | Shared query hook? | Server-side search? | Request cancellation? | Pagination | Virtualization | Shared table cmp? | Client-filter of full dataset? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Customers** (`Contacts.tsx`, `filterType="customer"`) | No — bespoke `loadContacts` `src/components/contacts/Contacts.tsx:5006` | No — client filter `Contacts.tsx:5166-5219` | No abort (relies on scope-gate) `Contacts.tsx:5013` | None | None | No (inline map) | **Yes** `Contacts.tsx:5166` |
| **Contacts** (same component) | No `Contacts.tsx:5006` | No `Contacts.tsx:5180` | No | None | None | No | **Yes** `Contacts.tsx:5166` |
| **Suppliers** (`KoleexMainSuppliers.tsx`) | No — raw `fetch` `src/components/suppliers/KoleexMainSuppliers.tsx:119-120` | No — client filter `KoleexMainSuppliers.tsx:564-566` | No | None | None | No | **Yes** `KoleexMainSuppliers.tsx:564` |
| **Products** (`ProductList.tsx`) | Partial — `useQueryClient` for invalidate only `src/components/admin/ProductList.tsx:126`; data via raw `fetch` | No — client filter `ProductList.tsx:540-561` | **Yes — AbortController** `ProductList.tsx:233,247` | None (renders all filtered) | None | No | **Yes** `ProductList.tsx:540` (mitigated by `useDeferredValue` `:191` + prebuilt `searchHaystack` `:396`) |
| **Employees** (`app/employees/page.tsx`) | No — `fetchEmployeeList` raw fetch `src/lib/employees-admin.ts:342` | No — client filter `src/app/employees/page.tsx:106-125` | No | None | None | No | **Yes** `employees/page.tsx:106` |
| **Accounts** (`AccountsList.tsx`) | No — 4 parallel raw fetches `src/components/admin/accounts/AccountsList.tsx:140` | No — client filter `AccountsList.tsx:201-226` | No | None | None | No | **Yes** `AccountsList.tsx:201` |
| **Finance** (`FinancePayments.tsx` et al.) | No — raw `fetch` `src/components/finance/FinancePayments.tsx:43` | No — client reduce/filter `FinancePayments.tsx:53-55` | No | None | None | No | **Yes** `FinancePayments.tsx:53` |
| **Inventory — Items** (`InventoryItems.tsx`) | No — raw `fetch` `src/components/inventory/InventoryItems.tsx:155` | **Yes — `q=` server param** `InventoryItems.tsx:150-151`; debounce 250ms `:138-144` | No abort (dep-array refetch) `:171` | None (server returns full filtered set) | None | No | **No** (server filters) |
| **Inventory — Global Search** (`InventorySearch.tsx`) | No | **Yes — `/api/inventory/search?q=`** `src/components/inventory/InventorySearch.tsx:77`; `useDebouncedValue(q,300)` `:61` | No abort | None | None | No | **No** (server filters) |
| **Quotations** (`Quotations.tsx`) | No — raw fetch; full list in state `src/components/quotations/Quotations.tsx:1069` | n/a — **no search box**, status-filter only; sorts full array `Quotations.tsx:2213` | No | None | None | No | **Yes** (full array) `Quotations.tsx:2213` |
| **Catalogs** (`app/catalogs/page.tsx`) | **Yes — TanStack `fetchQuery` + `getQueryData` seed** `src/app/catalogs/page.tsx:2723,2796` | No — client filter `catalogs/page.tsx:2824-2840` | No (query dedupe only) | None | None | No | **Yes** `catalogs/page.tsx:2824` |

### Matrix summary
- **Client-filter of full dataset: 8 of 10 apps** (Customers, Contacts, Suppliers, Products, Employees, Accounts, Finance, Quotations, Catalogs — Quotations has no text search but still holds/sorts the whole list). Only **Inventory** (both lists) does server-side search.
- **Server-side search: 1 of 10 apps** (Inventory only).
- **Request cancellation: 1 of 10 apps** (Products, via `AbortController`).
- **Pagination: 0 of 10.** Every list renders the entire filtered set.
- **Virtualization: 0 of 10.** No windowing library installed.
- **Shared table component: 0 of 10.** Every app hand-rolls its rows with an inline `.map`.
- **Shared debounced-search hook: 0 of 10 use a shared one.** Each app re-implements debounce (Contacts inline `setTimeout` `Contacts.tsx:5159-5164`; ProductList `useDeferredValue` `:191`; InventoryItems `useRef`+`setTimeout` `:138-144`; InventorySearch uses the Inventory-local `useDebouncedValue`; Employees/Accounts/Suppliers/Catalogs have **no debounce at all** — they filter on every keystroke).

---

## 3. Warm-start / caching layer — who's wired, who isn't

The prior perf work produced three separate cache mechanisms; adoption is
uneven:

| Mechanism | Who uses it |
| --- | --- |
| **`me-bootstrap` (shared promise + 60s cache)** `src/lib/me-bootstrap.ts` | All pages indirectly (header/sidebar/PermissionGate). Working. |
| **localStorage warm-start (paint-last-known, then revalidate)** | **Only Contacts** — `src/components/contacts/Contacts.tsx:5017-5031` (key `kx_contacts_v1:<tenant>:<type>`) and the hub bootstrap. Suppliers, Accounts, Employees, Finance, Quotations, Inventory do **not** warm-start. |
| **TanStack Query cache (cross-nav instant paint)** | **Only Catalogs** truly cache-first via `getQueryData` seed `src/app/catalogs/page.tsx:2723` + `fetchQuery` `:2796`. Products uses the client only to `invalidateQueries`. The other 8 apps re-fetch cold on every mount. |
| **`useApiQuery`/`fetchJson`** `src/lib/query/useApiQuery.ts` | **Zero lists.** Built to be the standard cached read hook; never adopted. |
| **`cachedFetchJson`** `src/lib/fetch-cache.ts` | **Zero lists.** Only `docs-sync.ts`. |

Net: two purpose-built shared caching wrappers (`useApiQuery`, `cachedFetchJson`)
are essentially dead code, while each list re-invents its own fetch + cache
story (or has none).

---

## 4. Top shared fixes, ranked by leverage (#apps × severity)

**#1 — Adopt one cached data hook (`useApiQuery`) across all 10 lists.**
The hook already exists (`src/lib/query/useApiQuery.ts:54`) and the provider is
already mounted (`src/app/providers.tsx:16`), but 8–9 apps still cold-fetch via
raw `fetch` on every mount (`AccountsList.tsx:140`, `FinancePayments.tsx:43`,
`employees-admin.ts:342`, `KoleexMainSuppliers.tsx:119`, `Quotations.tsx:1069`,
`Contacts.tsx:5006`). Routing these through `useApiQuery` gives instant
cache-first revisits (Catalogs already proves the pattern) for near-zero new
code. **Leverage: ~9 apps × high (perceived-speed on every nav).**

**#2 — A shared server-side, paginated, cancellable list/search hook.**
8 of 10 apps download the entire dataset and filter it in-memory
(`Contacts.tsx:5166`, `AccountsList.tsx:201`, `ProductList.tsx:540`,
`employees/page.tsx:106`, `KoleexMainSuppliers.tsx:564`, `catalogs/page.tsx:2824`,
`FinancePayments.tsx:53`). Inventory already demonstrates the right shape
(`InventoryItems.tsx:150` `q=` param + debounce). Generalizing Inventory's
approach into a shared `useServerList({ url, q, page })` hook — with
`AbortController` (only Products has it today, `ProductList.tsx:233`) and
`page/limit` — fixes payload bloat, keystroke lag, and stale-response races at
once. **Leverage: ~8 apps × high (scales as row counts grow; Contacts/Products
already the heaviest downloads).**

**#3 — Extract one shared `useDebouncedSearch` hook.**
`useDebouncedValue` already exists but is trapped in the Inventory module
(`InventoryUx.tsx:166`). Four apps re-implement debounce by hand and four
(Employees `page.tsx:173`, Accounts `AccountsList.tsx:393`, Suppliers
`KoleexMainSuppliers.tsx:643`, Catalogs) filter on **every** keystroke with no
debounce. Promote it to `src/lib/hooks/` and adopt everywhere. **Leverage:
~8 apps × medium (input jank on large lists, trivial to build).**

**#4 — A shared virtualized list/table primitive.**
Zero apps virtualize and no windowing lib is installed; every app renders its
whole filtered array (`Contacts.tsx` renders hundreds of contact cards,
`ProductList.tsx:540` 700+ products). One shared virtualized `<VirtualList>` /
table primitive (or adopting `DataTable` `src/components/security/DataTable.tsx`
platform-wide) caps DOM node count regardless of dataset size. **Leverage:
~6 apps × medium-high (biggest lists: Contacts, Products, Accounts, Catalogs).**

**#5 — Standardize localStorage warm-start via the shared hook.**
Only Contacts paints last-known rows instantly (`Contacts.tsx:5017`). If fix #1
(`useApiQuery`) is combined with a small `persister`/localStorage seed, every
list gets Contacts-grade "instant on revisit" for free, and the bespoke
warm-start code in Contacts collapses into the shared path. **Leverage:
~9 apps × medium (perceived-speed, removes bespoke cache code).**

> Fixes #1, #2, #3 and #5 are mutually reinforcing: a single
> `useServerList`/`useApiQuery`-based hook with debounce + abort + optional
> localStorage seed would deliver #1, #2, #3, #5 in one component and retire the
> two dead wrappers (`fetch-cache.ts`, the unused half of `useApiQuery.ts`).

---

## 5. Notable per-app observations
- **Products** is the best-engineered single list: `AbortController` with 12s
  timeout (`ProductList.tsx:233`), `useDeferredValue` (`:191`), and a prebuilt
  `searchHaystack` index (`:396`) so keystrokes are O(1) — but it still holds
  the full dataset and has no pagination.
- **Contacts** is the only app with true localStorage warm-start
  (`Contacts.tsx:5017`) and lazy avatar hydration (`:5066`), but no abort, so a
  rapid `filterType` switch can race two in-flight loads.
- **Inventory** is the only app that pushes search to the server
  (`InventoryItems.tsx:150`, `InventorySearch.tsx:77`) — the reference pattern
  the others should follow.
- **Catalogs** is the only app that is genuinely cache-first through TanStack
  Query (`catalogs/page.tsx:2723,2796`) — the reference pattern for fix #1.
- **Accounts** does 4 parallel full-table fetches then client-joins them
  (`AccountsList.tsx:140`) — the heaviest cold-load with zero caching.
