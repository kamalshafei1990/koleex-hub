# Quotations Performance — Baseline (Phase 4 Wave 2B.3)

**Confirmed the actual implementation before changing anything.** Every claim is
code-derived or measured against production data (labelled inline).

## Architecture map (code-derived)

| Concern | Location |
|---|---|
| List route | `src/app/quotations/page.tsx` → `Quotations.tsx` |
| Detail (read-only status page) | `src/app/quotations/[id]/page.tsx` (loads one quote via `GET /api/quotations/[id]`; NOT the editor) |
| **Editor + preview (WYSIWYG)** | `Quotations.tsx` (2,979 lines) + **`QuotationA4Preview.tsx` (9,391 lines)** — the A4 paper IS the editing surface |
| Product picker | `ProductPickerModal.tsx` |
| Customer picker | `CustomerPickerModal.tsx` |
| Pricing engine (pure) | `src/lib/commercial-policy/pricing-engine.ts`, `src/lib/pricing-config.ts`, `src/lib/server/pricing-engine.ts` |
| Catalog search API | `GET /api/quotations/catalog-search` (Quotations-gated) |
| Customer search API | `GET /api/contacts/search-customers` (Quotations-gated) |
| Save API | `POST /api/quotations` (+ `[id]` GET/DELETE) |
| PDF | **`window.print()`** (browser print + print CSS) — no heavy client PDF lib; a server `[id]/pdf` route also exists |
| Draft persistence | **localStorage** (`koleex.quotations.v1`) + server sync |
| Polling / realtime | none for data; a lightweight save-notify presence channel (`quotation-collab`) exists |

## Request dependency graphs (code-derived)

1. **Open list** — `Quotations.tsx` renders from localStorage warm-start + `loadQuotationsRemote()` (one `GET /api/quotations`). 12 rows in prod.
2. **New quotation** — created in-memory/localStorage; no reference-data fan-out on mount. A couple of small fetches: `me/bootstrap` (SA flag), `saved-assets` (stamp/signature/branding).
3. **Open existing** — `GET /api/quotations/:id` hydrates the full doc; the editor paints from the in-memory row.
4. **Add product** — opens `ProductPickerModal`; **previously fetched the WHOLE catalog** (`catalog-search?q=&limit=2000` → 705 models + names + image URLs) then filtered client-side.
5. **Edit line item** — mutates `current` (localStorage-backed); `subTotal`/`grandTotal` are `useMemo`'d; the WYSIWYG A4 re-renders (it is the input surface).
6. **Change global pricing settings** — in-editor state; no network.
7. **Change document settings** — in-editor state; no network.
8. **Save** — `POST /api/quotations` → reconcile canonical row + refresh list.
9. **PDF/preview** — `window.print()` (print CSS); no JS PDF pipeline on the primary path.

## Baseline measurements

| Metric | Value | Source |
|---|---|---|
| Products / models / media | **706 / 705 / 658** | real production (SQL) |
| Quotations | **12** (1 tenant) | real production |
| Customers | **120** | real production |
| Editor startup fan-out | **none material** — localStorage-first + `me/bootstrap` + `saved-assets` | code-derived |
| Product picker payload (before) | **entire catalog** (705 models + image URLs) on every open | code-derived |
| Customer picker | already debounced + abortable server search (`search-customers?q=`) | code-derived |
| A4 preview | **9,391 lines**, `dynamic(ssr:false)` code-split, **no `memo`/`useDeferredValue`**; WYSIWYG (editor==preview) | code-derived |
| Totals | `subTotal`/`grandTotal` already `useMemo`'d | code-derived |
| PDF | `window.print()` — no heavy client lib | code-derived |
| React commit ms / DOM nodes / P50–P99 | — | **unavailable** (authenticated-profiler / Vercel-SI only) — **not fabricated** |

## Root causes (evidence-ranked)

1. **Product picker downloads the whole catalog** (705 models + image URLs) on open, filters client-side. The largest current-weight liability. *(Step 5)* The `catalog-search` route already supports a `q` filter — the client just never used it.
2. **A4 preview has no `memo`** — re-renders on every unrelated parent state change (opening a picker, toggling a panel). Per-keystroke re-render is *inherent* to the WYSIWYG design (the A4 paper is the input). *(Step 7)*
3. **Customer picker `limit=500`** is higher than a picker needs (120 customers). *(Step 5)*
4. **No Quotations instrumentation** — no editor / picker / save timings existed. *(Step 13)*

## Scope decisions driven by the measurements

- **No composed editor bootstrap** — the editor is localStorage-first with no startup fan-out (Step 4's "IF many independent startup requests" does not apply). Documented, not built.
- **No list server-list migration** — 12 quotations; Step 12 forbids migrating without a measured bottleneck.
- **No WYSIWYG preview deferral** — the A4 paper is the input surface, so `useDeferredValue` on the doc would lag the field being typed into. Deep row-memoization *inside* the 9,391-line file is high-risk/low-benefit at 12 quotes → **documented as deferred**, not attempted.
- **Product picker → bounded server search** — the real current win.
- **Pricing untouched** — regression tests LOCK the calc so it is provably identical.

## Security & business posture (unchanged, verified)

`catalog-search` + `search-customers` are both `requireAuth` + `requireModuleAccess("Quotations")`. `catalog-search` returns only a single display `price` — never supplier cost, margin, head-only/complete-set internals. All quotation calculations, cost-head vs complete-set logic, Stand & Table, RMB→USD FX, margin methods, overrides, numbering, and PDF appearance are unchanged (locked by `validate:quotations-pricing`).

## Measurement note

Real P50/P75/P95/P99, bytes on the wire, DOM node counts, and React commit
durations are Vercel-log / Speed-Insights / authenticated-profiler only. The new
`quotations.*` metrics are emitted so an operator can pull them from a traffic
window. **No percentiles fabricated.**
