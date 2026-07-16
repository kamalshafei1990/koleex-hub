# Quotations Performance — Results (Phase 4 Wave 2B.3)

Evidence-based, smallest-safe optimization. No calculation change, no schema
change, no service-role bypass, no permission change, no PDF-design change. All
changes additive + reversible. Pricing math LOCKED by regression tests.

## Shipped

1. **Product picker → bounded server search** (`ProductPickerModal.tsx` +
   `catalog-search` route). The picker previously fetched the **whole catalog**
   (`q=&limit=2000` → 705 models + names + image URLs) on open and filtered
   client-side. It now issues a **debounced (220 ms), abortable, stale-guarded**
   server query (`catalog-search?q=<text>&limit=60`, or a 40-row browse set on
   open). The route now also matches **SKU** server-side so a bounded search
   never loses a SKU hit. The rich client ranking (`scoreRow`) still applies —
   now over the bounded server page instead of the full catalog. Biggest
   current-weight win; also caps the picker payload as the catalog grows.
2. **Customer picker hardening** (`CustomerPickerModal.tsx`) — added a monotonic
   `seqRef` stale-response guard (on top of the existing debounce + abort) and
   lowered `limit` 500 → 40. Records `quotations.picker.customer_ms`.
3. **Privacy-safe instrumentation** (via the existing perf client):
   `quotations.editor.first_usable_ms`, `quotations.save.ack_ms`,
   `quotations.save.error`, `quotations.picker.product_ms`,
   `quotations.picker.customer_ms`. Only durations leave the browser — **never**
   quotation numbers, customers, products, SKUs, prices, costs, margins,
   discounts, quantities, totals, or search text (asserted by
   `validate:quotations-perf`).
4. **Pricing regression lock** (`validate:quotations-pricing`, 43 assertions) —
   deterministic tests over the pricing math (product-level detection, the CNY
   ladder multiplier chain + rounding, **RMB→USD FX** conversion, margin %,
   landed cost, currency formatting, and the quotation line-total / subtotal /
   grand-total formulas). No calc code changed, so output is provably identical.

## Before / after

| Metric | Before | After | Change | Samples |
|---|---|---|---|---|
| Editor initial requests | localStorage-first + `me/bootstrap` + `saved-assets` | same | 0 (no startup fan-out) | code-derived |
| Bootstrap bytes | small | small | unchanged | code-derived |
| First usable editor | fast (localStorage) | same + `first_usable_ms` emitted | instrumented | code-derived |
| Customer picker payload | debounced server search, ≤500 | debounced server search, ≤40 | tighter cap | code-derived |
| Product picker payload | **entire catalog (705 models + image urls) every open** | **≤60 rows per query, only while typing** | large reduction (scales with catalog) | code-derived |
| Product search settled | client filter over full download | `quotations.picker.product_ms` emitted | new | code-derived |
| Row renders per edit | totals already memoized | unchanged | 0 | code-derived |
| Preview renders per keystroke | 1 (inherent WYSIWYG) | 1 (inherent) | unchanged | code-derived |
| Keystroke blocking time / preview commit ms | — | — | **unavailable** (profiler only) — **not fabricated** | — |
| Save acknowledgement | untimed | `quotations.save.ack_ms` emitted | instrumented | code-derived |
| PDF generation | `window.print()` (no JS lib) | unchanged | 0 | code-derived |
| Long tasks / error rate | — | — | **unavailable** (Vercel-SI only) | — |

Real percentiles / bytes / commit counts are Vercel-log / Speed-Insights /
authenticated-profiler only (not reachable from the build env). The
`quotations.*` metrics now feed them. **No values invented.**

## What was deliberately NOT done (evidence-based)

- **No composed editor bootstrap** — the editor is localStorage-first with no
  startup fan-out to compose (Step 4 is conditional on "many independent startup
  requests"; there aren't).
- **No list server-list migration** — 12 quotations (Step 12 forbids migrating
  without a measured bottleneck).
- **No WYSIWYG-preview deferral / deep A4 row-memoization** — the 9,391-line A4
  component IS the input surface, so `useDeferredValue` on the doc would lag the
  field being typed into; internal row-memoization is high-risk/low-benefit at 12
  quotes. Documented as a measured, deferred future item.
- **No pricing change** — locked, not touched.

## Calculation validation

`validate:quotations-pricing` **43/43** — product-level detection stable; CNY
ladder chain (`base·0.97·1.08·1.08·1.20·(1+adj)`) + `round2` exact; RMB→USD FX
(`/rate`, default 7.25) exact; margin % exact; landed cost fully-hardcoded
scenario exact; currency formatting exact; line-total (`unit·qty·(1−disc/100)`),
subtotal (`Σ unit·qty`), and grand-total (`sub + tax% + shipping + others`)
exact. Output identical before/after (calc code unchanged).

## Save flow

`POST /api/quotations` → reconcile canonical row → refresh list (already
duplicate-safe via `saveState`). Now emits `quotations.save.ack_ms` on success
and `quotations.save.error` on failure. No change to append-only history, doc
settings, or numbering.

## PDF

`window.print()` + print CSS — no heavy client JS library to lazy-load; no hidden
duplicate render pipeline. Unchanged (Step 11 "do not change PDF design").

## Permission & field-security validation

No change to any permission or tenant scope. `catalog-search` +
`search-customers` stay `requireAuth` + `requireModuleAccess("Quotations")`;
`catalog-search` exposes only a single display `price` — never supplier cost /
margin / head-only / complete-set internals (asserted by
`validate:quotations-perf`). The customer picker already returns only
QUOTATION-TO display fields.

## Tests & build

`validate:quotations-perf` **21/21** + `validate:quotations-pricing` **43/43**.
Regressions green: `crm-perf` 51, `finance-perf` 42, `app-launch` 51,
`suppliers-security` 45, `customers-gate` 10, `server-list` 28. `tsc` clean;
`next build` green.

## Rollback

Additive + reversible: revert the merge, or per-file (restore the picker's
fetch-all, drop the SKU match, remove the metrics/tests). No schema / RLS / auth
/ permission / calc change to undo.

## Remaining Quotations bottlenecks (→ future, out of scope)

- **A4 preview internal row-memoization** — the biggest structural lever if quote
  line-item counts grow; deferred (9,391 lines, WYSIWYG coupling, 12 quotes).
- **`catalog-search` 3 full-table scans per query** — fine at 705 models; add a
  DB text index + server `limit` on the models query if the catalog grows large.
- **List server-list** — only if quotation volume grows materially.
