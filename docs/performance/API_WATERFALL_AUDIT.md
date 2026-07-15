# API Waterfall & Payload Audit — Phase 4 Wave 2

Per-workflow request shapes (server sequential queries + client fetch fan-out),
verified from source (file:line). Post-Tokyo each DB hop ≈ 1–5 ms, so waterfalls
hurt via **request count** and **payload volume**, not per-hop latency.
Ranking basis for the whole scorecard: `PHASE_4_WAVE_2_BASELINE.md`.

---

## Per-workflow fan-out

### Customers / Suppliers / Contacts directory (`Contacts.tsx`, one component, 3 routes)
`customers/page.tsx:7` + `suppliers/page.tsx:7` render the same 11,597-line component via `filterType`.
- **List mount:** `GET /api/accounts` (`Contacts.tsx:4842`) + `GET /api/me` (`:4863`) + `GET /api/contacts?type=…` (`:5044`→`contacts-admin.ts:345`) + a **direct browser-Supabase** setup probe `contacts.select("contact_type").limit(1)` (`contacts-admin.ts:259`, kicked `:5037`) + `GET /api/contacts/avatars` in **batches of 30** (`:5067`,`contacts-admin.ts:322-326`).
- **Silent re-poll:** the list fetch repeats **every 20 s + on focus/visibility** (`:5088-5137`, fetch `:5092`).
- **No pagination:** `contacts/route.ts:63-74` selects all tenant+type rows, **no `.limit()`/`.range()`**; base64 blobs stripped (`:88-110`) then re-fetched via avatars.
- **Search/filter/sort 100% client-side** over the in-memory array (`:5166-5219`); server route has **no search param** (`route.ts:53-72`).
- **Detail:** inline = 1 (`/api/contacts/{id}` `:5313`); edit form fans to ~8 (contacts/{id} + storage/list ×2 `:4958-4959` + team-members + bands + section-audit + Activity's quotations+invoices `:3279-3280` + Account's accounts+roles `:3044-3045`); dedicated `/customers/[id]` = 1 HTTP + **up to 8 direct-Supabase** (`customers-admin.ts:279/301/321/342/369` + 3 sequential linked-customer lookups `:141-169`).

### Finance
- **FinanceDashboard** — **8 parallel** `/api/finance/*` on mount (`FinanceDashboard.tsx:161-219`: dashboard, orders, payments, expenses, treasury, reconciliation/candidates?limit=200, bank-imports, treasury-plans). 7 return full datasets, grouped client-side. Period switch = 1 (guard `:209-218`).
- **FinanceStatements** — ✅ tab-gated, **1 `/api/accounting/*` per active tab** (`:132-152`).
- **ExecutiveDashboard** — ✅ 1 consolidated `/api/executive/snapshot`, no poll (`:209`).

### Quotations
- **List mount:** 1 (`GET /api/quotations`, items stripped ✅ `docs-sync.ts:78-99`); stats/filter client-side over full array (`Quotations.tsx:2265-2277`).
- **Editor bootstrap ≈ 6:** doc (`:1199`) + saved-assets (`:1979`) + payment-terms + incoterms + shipping-methods (`QuotationA4Preview.tsx:5770-5772`) + shipping-documents (`:6439`). **Duplicated** by on-demand modals (`:6685-6687`,`:7054`). Pickers pull **500 / 2000 rows** then client-filter (`CustomerPickerModal.tsx:60`, `ProductPickerModal.tsx:114`).
- **Calc** = pure client (no fetch ✅). **Save** = 1 POST.

### CRM
- **Board mount:** 2 (`/api/crm/stages` `crm.ts:70` + `/api/crm/opportunities` **limit=500** `:234-237`); filter/paginate client-side (`CRM.tsx:261-285`).
- **Deal move:** 1 optimistic POST, no reload ✅ (`:337-342`).
- **Edit modal open:** loads the **entire contact book** (`GET /api/contacts` `:1739`) + direct-Supabase activities (`:1777`); save = 1 write + 2 reload = 3.

### Catalogs
- **List mount ≈ 6:** catalogs + contacts + 2 taxonomy + 2 storage-list (`catalogs/page.tsx:2790-2817`); filter/sort/paginate client-side, infinite-scroll (`:2824-2857`).
- **Viewer open:** 1 track POST + pdf.js **byte-range** GETs to `/api/files/catalog/{id}` (probe `:377` + N chunk GETs `:385`) — ✅ efficient range delivery.

### Notifications
- Shell bell: realtime-first + **two 60 s insurance polls** (discuss myChannels `:335`, inbox unread `:362`, hidden-skip `:366`); bell open = 3 fetches (`:408-426`). Full inbox page pulls **200 rows** (`inbox/page.tsx:297`). Ops bell = 1 `/api/operations/snapshot`, no poll ✅.

### Products / Employees / Accounts lists
- Products list: **6 fetches on mount** (`ProductList.tsx:238-247`), full-array client filter (`:540-543`), ✅ **AbortController** (`:233`) + `useDeferredValue` (`:191`). Employees/Accounts: 1 fetch, full-array client filter, **no debounce, no deferred value** (`employees/page.tsx:89`, `AccountsList.tsx:81`).

---

## Top waterfalls — ranked by (requests/action OR sequential-queries) × frequency

| Rank | Workflow | Cost | Cite |
|---|---|---|---|
| 1 | Customers/Suppliers/Contacts list | 4 HTTP + 1 Supabase probe + N/30 avatars + **20 s re-poll**; no pagination; client filter | `Contacts.tsx:5044/5067/5088`, `route.ts:63-74` |
| 2 | Finance dashboard | **8-way** parallel mount fan-out | `FinanceDashboard.tsx:161-219` |
| 3 | `/customers/[id]` profile | 1 HTTP + **up to 8 direct-Supabase** (incl. 3 sequential) | `customers-admin.ts:141-169/279-369` |
| 4 | Quotations editor bootstrap | ~6 fetches + reference-list **duplication** | `QuotationA4Preview.tsx:5770-5772`, dup `:6685` |
| 5 | Catalogs list | ~6-load mount | `catalogs/page.tsx:2790-2817` |
| 6 | Products list | 6-fetch mount | `ProductList.tsx:238-247` |
| 7 | CRM edit modal | loads entire contact book on open | `CRM.tsx:1739` |
| 8 | CRM board / quote pickers | 500 / 2000-row fetch then client filter | `crm.ts:234-237`, `ProductPickerModal.tsx:114` |
| 9 | Notifications steady-state | 2 req/60 s per open tab + 3 per bell open | `NotificationBell.tsx:335/362/408` |
| 10 | Employees / Accounts list | full dataset, client filter, no debounce | `AccountsList.tsx:81` |

---

## Cross-cutting patterns (highest-leverage shared fixes)

1. **Wide-fetch-then-filter-in-browser** — CRM (500), Quotations list, Catalogs, Contacts, Products, Employees, Accounts: one wide server fetch of the full tenant set, then search/filter/sort/paginate in memory. **8/10 directory apps**; 0 paginate, 0 virtualize, 1 server-search, 1 cancels stale requests (`SHARED_LIST_SEARCH_AUDIT.md`). → shared `useServerList`.
2. **Fixed multi-way mount fan-out** — FinanceDashboard's 8 parallel calls. → composed snapshot.
3. **Reference-list duplication** — Quotations refetches payment-terms/incoterms/shipping ×2-3 across modals. → load once, share.
4. **Full-book loads for a picker** — CRM edit modal + quotation pickers pull entire directories. → server-search pickers.
5. **Silent background re-polls** — Contacts 20 s list re-poll; notifications 60 s insurance polls. → visibility/realtime-aware (Wave-1 heartbeat pattern).
6. **Avatar/blob split** — Contacts strips base64 then re-fetches in N/30 batches (already a mitigation; the real fix is server pagination so fewer rows need avatars at once).

Good patterns to preserve: FinanceStatements tab-gating, Executive/Operations single-snapshot, Quotations items-stripping, Catalogs pdf.js byte-range, Products AbortController + `useDeferredValue`.
