# Suppliers Server-List Migration (Wave 2A.2)

Migrates the Suppliers directory onto the **shared** server-list architecture
built for Customers in Wave 2A.1 — server-side search / filter / sort /
pagination, stale-request cancellation, tenant+account-scoped caching, correct
global summaries — reusing the foundation rather than building a
Suppliers-specific framework. **Ships behind a controlled internal cohort +
Preview gate; production `/suppliers` stays LEGACY until explicitly promoted.**

## 1. Reuse map (critical prerequisite)

| Customers implementation | Reuse directly | Generalize | Suppliers-specific |
|---|---|---|---|
| `src/lib/server-list/types.ts` (`parseListParams`, `buildListResponse`, `normalizeQuery`) | ✅ unchanged | | |
| `src/lib/server-list/apply.ts` (`applyServerList` — ilike-OR, eq filters, deterministic order + id tie-breaker, bounded offset) | ✅ unchanged | | |
| `src/lib/hooks/useServerList.ts` (TanStack: pagination/search/sort, AbortController, keepPreviousData, cache key = resource+tenant+account, `persistKey`) | ✅ unchanged (pass `resource:"contacts:supplier"`) | | |
| `src/lib/hooks/useDebouncedValue.ts` | ✅ unchanged | | |
| `sanitizeContactRows` + `CONTACT_PRIVATE_COLUMNS` | ✅ unchanged — already strips supplier commercial/credit columns | | |
| `GET /api/contacts?paged=1` / `?summary=1` | ✅ endpoint reused (already type-generic; `moduleForType("supplier")→Suppliers`) | breakdown column made type-aware; per-type list config selector; `supplier_type`/`company_name_en/cn` added to slim projection | |
| Rollout gate decision (`shouldUseServerList`) | ✅ extracted to shared `rollout-gate.ts` | `customers-gate.ts` now re-exports it | `suppliers-gate.ts` re-exports it |
| Cohort resolver (`customers-rollout.ts`) | | ✅ extracted to `makeServerListCohort(envVar)` factory in `rollout-cohort.ts`; Customers now delegates to it (behaviour-identical, proven by `validate:customers-rollout` 16/16) | `suppliers-rollout.ts` binds the factory to `KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS` |
| `customersServerList` bootstrap flag | | pattern reused | `suppliersServerList` flag added to `/api/me/bootstrap` + `MeBootstrapPayload` |
| Telemetry allowlist (`activity/track`) | | pattern reused | `suppliers_server_list_open` / `suppliers_legacy_list_open` / `suppliers_server_list_error` |
| `CustomersServerList.tsx` + `customers-list.ts` i18n + `customers/page.tsx` gate | ❌ NOT cloned — the legacy 11k-line `Contacts.tsx` is left untouched | | `SuppliersServerList.tsx` adapter + `suppliers-list.ts` i18n + `suppliers/page.tsx` gate (supplier-flavoured: company-first name, `supplier_type` column/filter/summary) |

**Net:** the framework (types/apply/hook/debounce/sanitize/endpoint) and the
gate/cohort/bootstrap/telemetry mechanisms are shared; only the thin Suppliers
UI adapter + its translations + the supplier list-config + the supplier env var
are new. Future directory migrations (Contacts, Products, …) are now largely
configuration-driven: add a per-type `ServerListConfig`, a `<Resource>ServerList`
adapter, an env var, and a bootstrap flag.

## 2. What was generalized (and why it's safe)

- **`makeServerListCohort(envVar)`** (`src/lib/server/rollout-cohort.ts`) — one
  factory now backs both cohorts; each rollout keeps its **own** env var, so the
  cohorts are independent. Customers delegates to it with **no behaviour change**
  (its exported function names/signatures are unchanged and
  `validate:customers-rollout` still passes 16/16).
- **`shouldUseServerList`** moved to `src/lib/server-list/rollout-gate.ts`; it was
  already resource-agnostic (hostname / search / inCohort). `customers-gate.ts`
  and `suppliers-gate.ts` both re-export it — the test asserts they are the
  **same function**.
- No abstraction was added speculatively — both generalizations have two real
  consumers today.

## 3. Endpoint contract (opt-in, additive)

`GET /api/contacts?type=supplier&paged=1` — server-list mode:
- Params (allowlist-only): `page`, `pageSize` (≤100), `q`, `sort` ∈
  {name, company, country, created, updated}, `dir`, filters `status`
  (true/false), `supplierType`, `entity`.
- Search (ilike-OR) over **non-sensitive** columns only: `company_name`,
  `company_name_en/cn`, `display_name`, `full_name`, `first/last_name`,
  `company`, `email`, `phone`, `mobile`, `city`, `country`, `wechat_id`,
  `supplier_type`. **No** costs / payment / bank / internal-notes / ratings /
  commercial-terms are searchable, sortable, or filterable.
- Slim projection (`SLIM_LIST_COLUMNS`) + `sanitizeContactRows` (strips
  `CONTACT_PRIVATE_COLUMNS` unless `can_view_private`). Deterministic order
  `(sortCol NULLS LAST, id)`; exact count.
- Tenant scope: `.eq("tenant_id", auth.tenant_id)`. Module gate:
  `requireModuleAccess(auth, "Suppliers")`.

`GET /api/contacts?type=supplier&summary=1` — global aggregate: head-only
total/active counts + a 2-column (`supplier_type`, `country`) scan →
`byTier` (supplier type) + top-8 `byCountry`. Never derived from the current page.

Legacy `GET /api/contacts?type=supplier` (no `paged`) is unchanged.

## 4. Pagination choice

**Offset pagination** — the same conditions that justified it for Customers hold
for Suppliers: a modest tenant dataset (hundreds of rows), low churn, a
deterministic order with a unique `id` tie-breaker, and simple prev/next
navigation. Documented; revisit to cursor pagination only if a tenant's supplier
count or churn grows materially.

## 5. UI adapter

`SuppliersServerList.tsx` reuses `useServerList` + the shared summary aggregate.
Columns: Name (company-first) · Type (`supplier_type`) · Location · Status ·
row edit. List/card toggle (localStorage), quick create/edit modal
(`createContact`/`updateContact`, `contact_type:"supplier"`), full profile →
`/suppliers/[id]` (the legacy detail with factory/negotiation/risk/catalog/bank).
Global summary cards + By-type / By-country breakdown chips. EN/ZH/AR + Arabic
RTL (`dir="rtl"`). Selection is **page-only** and labelled as such. List state
persists (`persistKey`) so returning from a supplier detail restores
page/search/filter/sort.

## 6. Legacy bulk-action audit + parity (Wave 2A.2 close-out)

**Finding: the legacy Suppliers directory (`Contacts.tsx`, `filterType="supplier"`)
has NO multi-select and NO bulk actions.** There is no list-level selection state
(`grep` for `selectedIds` / `Set<string>` / `toggleSelect` → none), the CSV export
button is gated `filterType === "customer"` (not shown for suppliers), and delete
is a **single-row** confirm action. Archive/activate is done per-record via the
edit form's `is_active` field. So "bulk parity" requires porting nothing.

| Bulk action | Exists in legacy | Permission required | Destructive | Needed for parity |
|---|---|---|---|---|
| activate / deactivate (archive) | No (per-record via edit form) | Suppliers edit | No (reversible) | No — covered per-row |
| archive / restore | No (same is_active toggle) | Suppliers edit | No | No |
| delete | No (single-row confirm only) | Suppliers delete | Yes | No — covered per-row |
| export CSV | No (customer-only button) | — | No | No |
| assign owner | No | — | — | No |
| change supplier type | No | Suppliers edit | No | No |
| add/remove tags | No | Suppliers edit | No | No |
| approval status | No | — | — | No |
| any purchasing bulk action | No | — | — | No |

**Per-row parity closed in the server-list adapter** (not bulk — matching legacy):
`Edit` (quick modal), `Archive`/`Activate` (one-click `is_active` toggle via
PATCH `/api/contacts/[id]`), and `Delete` (confirm → DELETE `/api/contacts/[id]`).
Both endpoints revalidate module permission (`requireModuleAction` edit/delete)
+ tenant scope (`fetchExisting(id, auth.tenant_id)`) server-side; on success the
adapter invalidates the current server-list query + summary aggregate — never a
full-list refetch. No multi-select is shown (legacy has none → no ambiguity).

**Deferred by design** (documented, reachable): the complex supplier sub-forms
(factory, negotiation, risk, catalogs, banking) live on the legacy **Full
profile** route `/suppliers/[id]`; the whole legacy directory is one
`?serverlist=0` away. `supplier_type` filter options come from the global
summary, so suppliers with a null `supplier_type` are simply not offered as a
filter value.

## 7. Rollout + rollback

Precedence: `?serverlist=0` legacy · `=1` server · cohort → server · Preview host
→ server · production → legacy. Cohort env var
`KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS` (see `SUPPLIERS_INTERNAL_ROLLOUT.md`).
Ships inert. Rollback = clear the env var (config) or `?serverlist=0` per-user.
