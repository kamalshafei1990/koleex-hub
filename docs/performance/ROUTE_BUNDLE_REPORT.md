# Route Bundle Report — Phase 4 Wave 2

**Scope:** Static source analysis only (no build, no deploy, no network). Goal: find the next heaviest *eagerly-imported* client components after Wave 1 already lazy-loaded CRM, DiscussApp, ProductForm (and earlier Contacts, QuotationA4Preview, KoleexAiApp).

**Proxy method:** Next 16 no longer exposes the legacy build-manifest URL the old tooling read, so exact per-route gzipped KB is **not extractable from source**. This report ranks by **verified source bytes (`wc -c`) + presence of heavy transitive libs + route-traffic likelihood** as an explicitly-labelled *directional proxy*. No KB figures are invented; every byte count below was measured with `wc -c`.

---

## Heaviest eager components (ranked)

All are `"use client"` and **statically** imported into a route `page.tsx` (NOT behind `dynamic()`). Bytes are source `wc -c`.

| # | Component | Bytes | Eager route(s) importing it | Heavy transitive libs | Traffic | Notes |
|---|---|---|---|---|---|---|
| 1 | `src/components/admin/ProductList.tsx` | 89,657 | `src/app/products/page.tsx:3` (`return <ProductList/>`), `src/app/product-data/page.tsx:16` | none direct (data-heavy) | **High** (products is a core daily app, 2 routes) | Highest traffic × size. Best ROI wrap. |
| 2 | `src/components/quotations/Quotations.tsx` | 128,479 | `src/app/quotations/page.tsx:2` (default import, rendered) | — | **High** | Print routes also pull *named* exports (`numberToWords`, `PRINT_AND_DOC_STYLES`, `fromRow`) from this 128 KB module: `invoices/[id]/print/page.tsx:23`, `quotations/[id]/print/page.tsx:25` → whole module dragged into print routes too. Extract shared helpers into a tiny `quotations/shared.ts`. |
| 3 | `src/app/products/[id]/LegacyProductView.tsx` | 121,032 | `products/[id]/page.tsx:23` + `product-data/[id]/page.tsx:10` — **statically imported then conditionally rendered** (`page.tsx:54` falls back to it) | — | **High** | Ships on every product-detail view even when the *new* renderer wins. Prime `dynamic(ssr:false)` candidate — it is a fallback branch. |
| 4 | `src/components/suppliers/SupplierDetail.tsx` | 124,857 | `suppliers/[id]/page.tsx:5` | — | Med | Whole detail app eager on route entry. |
| 5 | `src/components/qa/QaReportsApp.tsx` | 109,700 | `database/issues/page.tsx:3` | — | Low-Med | Admin/QA surface. |
| 6 | `src/components/landed-cost/SimulationForm.tsx` | 101,648 | `landed-cost/new/page.tsx:3` + `landed-cost/[id]/page.tsx:4` | — | Low-Med | Form-heavy, two routes. |
| 7 | `src/components/admin/accounts/AccountForm.tsx` | 74,467 | `accounts/new/page.tsx:5` + `accounts/[id]/edit/page.tsx:6` | none direct | Low | SA-only, but two eager routes. |
| 8 | `src/components/inventory/InventoryItems.tsx` | 72,763 | `inventory/items/page.tsx:2` | — | Med | Core inventory route. |

**Big self-contained page files** (the `page.tsx` *is itself* the large `"use client"` component, so it can't be wrapped in `dynamic()` — instead extract heavy sub-trees / defer below-the-fold panels):
- `src/app/catalogs/page.tsx` — **214,127** bytes (largest single client route). Heavy PDF/OCR work is already correctly deferred via runtime `await import()` of `unpdf`/`tesseract.js` in `src/lib/catalog-client.ts`; the weight is the page's own JSX.
- `src/app/management/page.tsx` — **144,869** bytes. Charts are hand-rolled SVG (no chart lib), so weight is JSX, not deps.
- `src/app/knowledge/supplier-data-guide/page.tsx` — 97,958
- `src/app/inbox/page.tsx` — 95,586
- `src/app/employees/new/page.tsx` — 80,167
- `src/app/products/settings/page.tsx` — 74,931
- `src/app/commercial-policy/page.tsx` — 74,008
- `src/app/todo/page.tsx` — 58,789

---

## Heavy libs by route

**Good news — almost every heavy dependency is already server-only or behind a runtime `await import()` boundary.** Verified import sites:

| Lib | Where | Boundary | Verdict |
|---|---|---|---|
| `xlsx` | `src/lib/finance/bank-statement-parser.ts` (server); `quotations/preorder/page.tsx:206` via `await import("xlsx")` | server / runtime-lazy | ✅ |
| `exceljs` | `src/lib/excel-export.ts:187,532` via `await import("exceljs")` | runtime-lazy | ✅ |
| `unpdf` (PDF) | `src/lib/catalog-client.ts:102,141,173` via `await import("unpdf")` | runtime-lazy | ✅ |
| `tesseract.js` (OCR) | `src/lib/catalog-client.ts:196` via `await import` | runtime-lazy | ✅ |
| `html2canvas` / `html2canvas-pro` | `src/lib/excel-export.ts:514` + `qa/QaFocusHighlight.tsx:126`, `qa/ReportIssueButton.tsx:430,488` via `await import` | runtime-lazy | ✅ |
| `puppeteer-core` + `@sparticuz/chromium-min` | `api/quotations/[id]/pdf/route.ts:72,75`, `api/reports/export/pdf/route.ts:49,51` via `await import` | server route | ✅ |
| `pdf-cover` | `contacts/Contacts.tsx:10646` via `await import("@/lib/pdf-cover")` | runtime-lazy (Contacts already dynamic) | ✅ |
| `@tiptap/*` | `components/notes/NoteEditor.tsx` (CLIENT) | inside `NotesApp`, which is `dynamic(ssr:false)` at `app/notes/page.tsx:11`; also `optimizePackageImports` in next.config | ✅ |
| `jsbarcode` + `qrcode` | `admin/form-sections/BarcodeQRDisplay.tsx` (CLIENT) | rendered inside ProductForm (already lazy) | ✅ small/localized |
| `lottie-react` | `components/icons/AiFaceIcon.tsx` (CLIENT) | localized | ✅ |
| `country-state-city` | `contacts/Contacts.tsx` (already dynamic) + `admin/form-sections/CreateSupplierModal.tsx` | verify CreateSupplierModal is behind ProductForm/modal lazy path | ⚠️ minor — one client site outside a known lazy boundary |
| `papaparse` | `src/lib/finance/bank-statement-parser.ts` | server | ✅ |

**Charting libs: NONE.** `grep` of `package.json` for recharts / chart.js / victory / nivo / visx / d3 → no matches. `BarChart3Icon`/`PieChartIcon` in `management/page.tsx` and `SupplierDetail.tsx` are just SVG *icon* components, not chart engines. **No `framer-motion`, no `moment`/`dayjs`/`date-fns`/`luxon`, no `monaco`/`codemirror`, no `mapbox`/`leaflet`, no `@rive-app` static import** anywhere in `src`. These common bundle-bloat sources are simply absent — do not chase them.

---

## Existing `dynamic()` coverage

`dynamic(() => import(...))` sites found (all `ssr:false` unless noted):

| Site | Target | ssr |
|---|---|---|
| `app/crm/page.tsx:19` | `components/crm/CRM` | false (Wave 1) |
| `app/discuss/page.tsx:22` | `components/discuss/DiscussApp` | false (Wave 1) |
| `components/admin/ProductFormLazy.tsx:16` | `./ProductForm` | false (Wave 1) |
| `app/ai/page.tsx:7` | `components/ai/KoleexAiApp` | false |
| `app/invoices/page.tsx:11` | `components/invoices-doc/InvoicesDoc` | false |
| `app/projects/page.tsx:8` | `components/projects/ProjectsApp` | false |
| `app/planning/page.tsx:8` | `components/planning/PlanningApp` | false |
| `app/notes/page.tsx:11` | `components/notes/NotesApp` | false |
| `app/documents/page.tsx:13` | `components/documents/DocumentsApp` | false |
| `components/quotations/Quotations.tsx:49` | `./QuotationA4Preview` | false |
| `components/invoices-doc/InvoicesDoc.tsx:38` | `quotations/QuotationA4Preview` | false |
| `components/security/SecurityCenter.tsx:31` | `./DeepDiveTabs` | false |
| `components/security/SecurityCenter.tsx:32` | `./InvestigationDrawer` | false |
| `components/perf/PerfPanelGate.tsx:12` | `./PerfPanel` | false (dev-gated) |

**Coverage gaps** — the top-8 ranked components above have **no** `dynamic()` wrapper. Note the whole-app routes (`quotations`, `products`, `suppliers`, `landed-cost`, `inventory`, `accounts`, `database/issues`) still eager-import their main component. No existing `dynamic()` uses `ssr:true` for heavy content — no SSR-streamed heavy bundles to worry about.

---

## Barrel / broad-import risks

1. **`src/components/ui/RrIcon.tsx` — 75,538 bytes, monolithic icon path map.** `PATHS: Record<RrIconName, ReactNode>` (line 129) inlines *all* icon SVG path data in one `"use client"` module; render is `{PATHS[name]}` (line 545). Imported by **78 files**. Importing a single icon name pulls the entire 75 KB path table — it effectively lands in the shared client chunk. This is the classic "one giant module, no tree-shaking" pattern. *Recommendation:* the per-icon `components/icons/ui/*` files (used by direct-path imports elsewhere) are the tree-shakeable pattern; migrate RrIcon call sites to direct icon imports, or code-split PATHS.
2. **`src/components/icons/ui/index.ts` — 213 exports barrel.** Low risk in practice: only **1** file imports the whole barrel — `components/finance/VisualStatements.tsx:36` (`import { AngleLeftIcon, AngleRightIcon, CrossIcon } from "@/components/icons/ui"`). Every other icon consumer imports the direct path (`@/components/icons/ui/XIcon`), which tree-shakes. Fix the one VisualStatements line to direct imports and the barrel is fully neutralized.
3. **`src/lib/machine-specs/index.ts` (2 importers) and `src/lib/intelligence/index.ts` (4 importers)** re-export barrels — low blast radius, but confirm importers don't pull the whole index when they need one symbol.

`next.config` `experimental.optimizePackageImports` already covers `@tiptap/*`, `@supabase/supabase-js`, `react-markdown`, `remark-gfm` (next.config lines 49–62) — good. It does **not** cover the internal icon barrels (optimizePackageImports only helps named node_modules packages, not local barrels), so the RrIcon/VisualStatements fixes must be done in source.

---

## Measurement limitations (read honestly)

- **No precise per-route KB.** Next 16 dropped the legacy `_buildManifest` URL the old external tooling scraped; `next build --analyze` cannot run in this static-only environment. Every ranking here is a **directional proxy** = source bytes (`wc -c`, verified) + heavy-lib presence + traffic judgement. **No gzipped/parsed KB number in this report is real** — none are quoted, deliberately.
- **Source bytes ≠ shipped bytes.** Minification, shared-chunk dedup, and tree-shaking all move the real number. A 128 KB source file may ship far less; a small file importing RrIcon may ship far more. Treat bytes as *relative* ranking signal only.
- **Traffic likelihood is a judgement call** from app role (products/quotations/inventory = daily core; QA/landed-cost/accounts = occasional/admin), not measured analytics.
- To convert this into hard numbers, run `next build` locally with `@next/bundle-analyzer` and diff route chunk sizes before/after each `dynamic()` wrap.

---

*Phase 4 Wave 2 · static source audit · no code changed.*


---

**Phase 4 — Home & App Launch Performance (2026-07-16):** shared `AppLaunchLink` primitive (Link-based: modifier keys, viewport prefetch, CSS pressed feedback, keyboard, dup-guard, intent preload, unified privacy-safe launch telemetry) adopted on Home cards + sidebar + launcher; evidence-based prefetch tiers (`src/lib/app-prefetch.ts`, Save-Data/slow/hidden/authorization-gated); 15 new app-shaped `loading.tsx` boundaries (+5 shared skeletons) → blank-flash eliminated; bootstrap primed at shell top (shell confirmed already persistent, single TanStack cache, no remount). `app_launch.*` metrics via the perf client (percentiles pending a Vercel-log window). Tests: `validate:app-launch` 51/51; tsc + build green. Docs: HOME_APP_LAUNCH_RESULTS.md, APP_NAVIGATION_ARCHITECTURE.md, APP_PREFETCH_STRATEGY.md, APP_USAGE_AND_PRELOAD_RANKING.md, PERSISTENT_SHELL_AUDIT.md, APP_LOADING_BOUNDARIES.md, APP_LAUNCH_BASELINE.md, HOME_PAGE_PERFORMANCE_AUDIT.md.


---

## Phase 4 Wave 2B.2 — CRM Performance (shipped)

CRM board / deal modal / drag optimized. Confirmed volume: **2 deals**, **259
contacts / 6 tenants** — so pagination/virtualization were **not** introduced
(unjustified at this volume). Shipped: contact picker → bounded, debounced,
abortable, stale-guarded **server search** (`GET /api/crm/contacts/search`,
CRM-gated + tenant-scoped + slim fields) replacing the whole-directory
`fetchContacts()` download (payload + field-exposure win); `?view=board` slim
projection (no free-text `description`; modal hydrates via `GET
/api/crm/opportunities/[id]`); memoised `OpportunityCard`; drag **rollback** on
server failure; **soft** post-mutation reload (board no longer blanks);
privacy-safe `crm.*` metrics. No schema/permission/tenant change. Details:
CRM_PERFORMANCE_BASELINE.md + CRM_PERFORMANCE_RESULTS.md. Tests:
`validate:crm-perf` 51/51.


---

## Phase 4 Wave 2B.3 — Quotations Performance (shipped)

Quotations editor / pickers / pricing optimized. Confirmed volume: **12
quotations**, **706 products / 705 models**, 120 customers. So NO editor
bootstrap composition (localStorage-first, no startup fan-out), NO list
server-list migration (12 rows). Shipped: product picker → bounded, debounced,
abortable, stale-guarded **server search** (`catalog-search?q=&limit=60`,
CRM... Quotations-gated + SKU match; **no supplier/cost fields**) replacing the
whole-catalog download (705 models) on open; customer picker stale-guard +
tighter cap; privacy-safe `quotations.*` metrics; **pricing regression lock**
(43 assertions — RMB→USD FX, ladder, margins, landed cost, line/subtotal/grand
totals). A4 preview is WYSIWYG (editor==preview) so deferral is inapplicable;
deep row-memoization deferred (9,391 lines, 12 quotes). No calc/schema/permission
change. Docs: QUOTATIONS_PERFORMANCE_BASELINE.md + QUOTATIONS_PERFORMANCE_RESULTS.md.
Tests: validate:quotations-perf 21/21 + validate:quotations-pricing 43/43.

---

## Platform Speed Max-Out update (WS1)

Home route: `DAILY_QUOTES` (~120 localized strings) removed from the Home client bundle into a separately-chunked lazy module. Structural reduction of the Home critical bundle (Turbopack build here does not emit per-route First-Load-JS byte columns, so the delta is tracked by the dynamic-import boundary, not a fabricated byte count). Guarded by `validate:platform-speed`.
