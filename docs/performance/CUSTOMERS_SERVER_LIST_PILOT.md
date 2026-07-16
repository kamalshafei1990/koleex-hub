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
