# Customers Server-List Pilot (Phase 4 Wave 2A.1)

## Previous flow (still live for Contacts/Suppliers, and Customers until UI wiring is approved)
`/customers` renders `Contacts.tsx` (`filterType="customer"`), which:
1. `GET /api/contacts?type=customer` → **all 120 tenant customer rows** with the
   ~200-column `LIST_COLUMNS` projection (no `.limit`).
2. Fires `GET /api/accounts`, `GET /api/me`, a direct-Supabase setup probe, and
   `GET /api/contacts/avatars` in batches of 30.
3. **Re-polls the full list every 20 s + on focus** (`Contacts.tsx:5088-5137`).
4. Search / status / tier / entity filtering + sort + grouping run **100%
   client-side** over the in-memory array (`Contacts.tsx:5166-5219`).

## New flow (server endpoint — SHIPPED and live; UI not yet wired)
`GET /api/contacts?type=customer&paged=1&page=&pageSize=&q=&sort=&dir=&status=&tier=&entity=`
→ server-side search + sort + **offset pagination** over a **slim 30-column
projection**, exact count, `sanitizeContactRows`, returning a
`ServerListResponse`. Same tenant scope + module gate as the legacy path.
Consumed on the client by `useServerList` (TanStack Query: cancellation,
keep-previous, per-account/tenant cache isolation).

## Measured data baseline (SQL, Koleex tenant, 120 customers)
| Metric | Legacy | Paged (page 1) | Note |
|---|--:|--:|---|
| Rows on first paint | **120** | **50** | −58% |
| `SELECT *` bytes (pre-projection worst case) | **13,824,880** | — | the base64-blob problem |
| Slim-projection bytes | 88,765 (×120) | **36,836 (×50)** | paged page = **2.4× smaller** than the full slim list; far smaller than the legacy `LIST_COLUMNS` payload |
| Search | client-side over full array | **server `ilike` on approved columns** | no full download to search |
| Background full re-download | **every 20 s** (3/min) | on-demand (cache-first) | *pending the UI polling change* |

All measurements are **server-side data facts** (SQL `octet_length`). Real
end-user timings (initial paint, keystroke→settled, React commit) require an
authenticated browser session and are captured when the UI is activated.

## Why the UI is NOT auto-activated in this pass (honest constraint)
`Contacts.tsx` is one 11,597-line component shared by Customers/Suppliers/
Contacts whose entire architecture assumes `contacts` state = the **complete**
dataset (alphabetical grouping, tier stats `:5239-5266`, supplier stats
`:5270-5305`, counts). Making Customers server-paged requires reworking those
assumptions. Two hard constraints in this environment:
1. **No UI verification** — this build path deploys via the GitHub API; there is
   no dev server to render/interact with the Customers page.
2. **`main` auto-deploys to the live ERP** — an unverified UI rewrite of the
   Customers page would ship broken to real users.

Per the mandate ("extract the minimum shared presentation layer and document
the risk … do not clone the 11,000-line component"), the secure server
foundation + endpoint are shipped and verified, and the UI wiring is specified
below for activation behind a preview-deploy verification.

## Ready-to-apply UI wiring (for the approved activation step)
1. **Extract a `CustomersList` presentation slice** (or add a `filterType ===
   "customer"` data branch) that sources rows from
   `useServerList<ContactRow>({ resource: "contacts:customer", endpoint:
   "/api/contacts", scope: { tenantId, accountId }, fixedParams: { type:
   "customer", paged: "1" }, pageSize: 50, initialSort: { field: "name", dir:
   "asc" } })` instead of `fetchContactsByType` + the client `filtered` memo.
2. Bind the existing search box → `setQuery`; status/tier/entity chips →
   `setFilter`; column header → `setSort`; add prev/next → `setPage`.
3. Render `rows` directly (already server-filtered/sorted); keep the existing
   card, row actions, status badges, selection, detail-open, and create/edit
   flows unchanged (they operate on a `ContactRow`).
4. **Fallback**: if the paged fetch errors, fall back to the legacy
   `fetchContactsByType` path so the page degrades gracefully.
5. **Polling (Step 7)**: for `filterType === "customer"` only, drop the 20 s
   silent full-list re-poll; rely on TanStack's mutation-invalidation +
   `refetchOnReconnect` + explicit refresh. Leave Suppliers/Contacts polling
   untouched (they keep the legacy path).

## Rollback
- Endpoint: delete the `paged=1` branch in `src/app/api/contacts/route.ts` — the
  legacy path is unchanged, so nothing regresses.
- Hook/types: unreferenced until the UI is wired; deleting the files is a clean
  revert.
- No DB migration, RLS, or auth change was made.

## Conditions before rolling to Contacts & Suppliers
- Customers UI activated + verified in a preview deploy (all preserved behaviors
  in the acceptance list green).
- Real before/after user-facing timings captured (initial paint, search latency,
  background req/min) and documented in `PHASE_4_WAVE_2A1_RESULTS.md`.
- Explicit approval (Wave 2A.2). Suppliers/Contacts then reuse the same endpoint
  config + hook.


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
