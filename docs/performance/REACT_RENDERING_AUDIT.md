# React Rendering Audit — Phase 4 Wave 2

**Scope:** Static source analysis (no servers, no profiler) of the highest-traffic client
components. Ranks hotspots by code inspection of state placement, memo boundaries, derived-work
sites, and list rendering. Every ref below was opened and verified at the cited line.

---

## ⚠️ Correcting the Wave 2 premise: React Compiler is NOT enabled

The task brief said "this project has the React Compiler enabled." **It is not.** Verified:

- `next.config.ts:35` has a `compiler: { removeConsole }` key — that is the **SWC** compiler
  option, *not* `experimental.reactCompiler`. There is no `experimental.reactCompiler: true`
  anywhere in `next.config.ts`.
- `babel-plugin-react-compiler` appears in `package-lock.json` only as an **optional peer
  dependency of Next.js** (`package-lock.json:9917`, under `peerDependenciesMeta … optional`).
  It is **not installed** (`node_modules/babel-plugin-react-compiler` does not exist) and not
  in `package.json` deps.

**Consequence for this audit:** manual memoization is **not** redundant here. Missing
`React.memo` / `useCallback` / `useMemo` are *real* problems — there is no compiler auto-memoizing
component bodies. Every "full component body re-runs on each keystroke" finding below is a genuine
cost, and every "0 `React.memo` in this file" note is a genuine gap. This reverses the brief's
guidance ("manual memoization may be redundant").

**Other environment facts (verified):**
- **No virtualization library anywhere** — `grep` for `react-window`, `@tanstack/react-virtual`,
  `virtuoso`, `FixedSizeList`, `useVirtualizer` across `src/` returns **zero** hits. Every large
  list renders all rows to the DOM.
- React 19.2.4 / Next 16.2.2, `reactStrictMode: true` (so mount effects double-fire in dev).
- Wave-1 `dynamic()` splits are in place and correct: CRM (`app/crm/page.tsx:19`), Discuss
  (`app/discuss/page.tsx:22`), ProductForm (`ProductFormLazy.tsx:16`), QuotationA4Preview
  (`Quotations.tsx:49`), KoleexAiApp (`app/ai/page.tsx:7`). **Contacts is NOT dynamic** — it is a
  static `import` in `app/{customers,suppliers,contacts}/page.tsx:2` (the prior audit's claim that
  Contacts uses `dynamic()` is now inaccurate).

---

## Contacts — `src/components/contacts/Contacts.tsx` (11,597 lines; powers Customers + Suppliers + Contacts)

Single default-export component starting at line 4828 holds **110 `useState`** and the entire
list + detail + edit-form tree. 72 memo-primitive uses exist but the **row list itself has no memo
boundary**.

| Hotspot | Location | Trigger | Blast radius | Fix class | Risk |
|---|---|---|---|---|---|
| `search` state at top of an 11.5k-line component | `Contacts.tsx:4858` | every keystroke in search | whole `Contacts` body re-runs; all currently-mapped rows reconcile (`filtered`/`grouped` are debounced so data is stable, but React still re-renders every inline row) | Split search input into its own child; keep `search` local to it | Med |
| List rows rendered as inline JSX, no `React.memo` row | `Contacts.tsx:6284` (`items.map`) → row `6297-6470` | any parent render; row-select | all rows re-render on selection or keystroke | Extract memoized `ContactRow` w/ primitive props | Med |
| Selection state at parent; `isSelected` computed per row | `Contacts.tsx:4855` (`selectedId`), read `6285` | clicking any row | every row re-evaluates `isSelected` | Move selection compare into memoized row | Med |
| No virtualization — all `filtered` rows mapped | `Contacts.tsx:6279` (`grouped.map`, no slice/paginate; `grouped` @5225) | large directory | thousands of DOM rows + reconciliation | Windowing (react-window) after row memo | High (scales with data) |
| Per-row inline closures + fresh `kxInspectAttrs` object | `Contacts.tsx:6300` (`onClick={() => …}`), `6304` (`kxInspectAttrs({…})` → `inspector.tsx:76`) | every render | per-row allocation ×N | Hoist/curry handlers once rows are memoized | Low |
| Per-row work in render body (`norm()` fn defined per row, multiple `contactDisplayName(c)` calls, IIFEs) | `Contacts.tsx:6290`, `6331`/`6291`, `6333`/`6369` | every list render | N× redundant string work | Precompute in the memoized row | Low-Med |

Positives: search is debounced 150ms (`Contacts.tsx:5159-5164`) so the O(n) `filtered` useMemo
(`5166`) doesn't run per keystroke; `grouped`/`suggestions`/`moduleKpis` are memoized; the edit
modal is conditionally mounted (`11490` `{formModalOpen && view === "form" && …}`).

---

## CRM — `src/components/crm/CRM.tsx` (4,095 lines; kanban pipeline)

**69 `useState`, 0 `React.memo`.** No component in the file is memoized, so any state change
re-renders the entire board.

| Hotspot | Location | Trigger | Blast radius | Fix class | Risk |
|---|---|---|---|---|---|
| Drag-hover state at top of unmemoized 4k-line board | `CRM.tsx:198-199` (`draggingId`,`hoverStageId`); handler `310-313` | every column crossed while dragging a card | all N stage columns + every card re-render per crossing | `React.memo` on `PipelineColumn`/`OpportunityCard` + `useCallback` handlers | High |
| Search keystrokes re-render whole pipeline | `CRM.tsx:186` (`search`), view `624-639` | every keystroke | new `oppsByStage` ref + unmemoized columns rebuild all cards | Memoize columns/cards | Med-High |
| No memoized Card/Column; inline JSX in `.map` | `CRM.tsx:1098-1108` (cards), `1370-1384` (list rows) | one card's data updates after `reload()` | full board/list re-diffs, not just that card | Extract `React.memo` row/card | Med |
| Unstable inline fn props per card + from parent | `CRM.tsx:1103`,`1105`,`1383`; parent `633`,`635` | every render | defeats any future memo (`!==` props) | `useCallback` / bind id in child | Med |
| Expensive `maxStageRevenue` reduce in `PipelineView` body, not memoized | `CRM.tsx:825-833` | every drag-hover crossing + every keystroke | O(stages×opps) reduce recomputed dozens of times per drag | `useMemo` or fold into `oppsByStage` memo (`290`) | Med |

Positives: `filteredOpps` (`261`), `oppsByStage` (`290`), and the analytics aggregations
(`2806/2985/3103/3258/3765/3982`) are correctly memoized; `handleDragOver` is guarded to fire only
on stage change (`312`); all three modals are conditionally rendered (`674/690/700`).

---

## Product Data form — `src/components/admin/ProductForm.tsx` (5,397 lines)

**63 `useState`, 0 `React.memo`.** Correctly lazy-loaded via `ProductFormLazy.tsx:16` (`dynamic`,
`ssr:false`). **Key nuance:** it's a wizard that only mounts the *active* step (`onePage=false`
@1681; steps gated at `2455/3647/…`), so per-keystroke blast radius is the active step's subtree
(largest = "identity", ~1,192 lines / 32 inputs), not the whole file.

| Hotspot | Location | Trigger | Blast radius | Fix class | Risk |
|---|---|---|---|---|---|
| Single 81-field `product` object; full spread-copy per keystroke | `ProductForm.tsx:497` + updater `1088-1090` | any field edit | entire active step re-renders (up to 32 fields) | Split state into per-section slices / field-local state committing on blur | High |
| Section wrappers + extracted sections not memoized; get fresh `children`/whole object | `Section` `130-155`; `TechnicalSection` used `3859` w/ `data={product}` | keystroke in mounted step | full section subtree (~834 lines) incl. fields it doesn't own | `React.memo` + narrow props (`Pick<…>`) | High |
| Derived brand-option list computed inline in JSX | `ProductForm.tsx:3253-3256` (regex slug over `brands`) | keystroke in identity step | recomputes every render | `useMemo([brands, brandLogos])` | Med |
| Child `.filter()` per render inside TechnicalSection | `TechnicalSection.tsx:85,205,304` | keystroke while technical step mounted | unmemoized filters re-run | `useMemo` | Med |
| 4× `media.filter()` inline in review step IIFE | `ProductForm.tsx:4489-4492` | any render of review step | 4 full passes | `useMemo([media])` | Low |
| Effects keyed on whole `product` object | `ProductForm.tsx:585-592` (`setDirty`), `614-635` (autosave `JSON.stringify`) | every keystroke anywhere | effect pass + timer reschedule each key (autosave debounced 800ms) | Scope deps to slices after state split | Low-Med |
| Controlled inputs w/ inline `onChange` closures | e.g. `ProductForm.tsx:2477`; `SlugEditor` `5162` writes parent state per keystroke | typing | new closures per render | Local buffer + commit on blur | Low |

---

## Discuss — `src/components/discuss/DiscussApp.tsx` (4,170 lines)

**48 `useState`, 0 `React.memo`, 32 `.map`.** Correctly `dynamic()` (`app/discuss/page.tsx:22`).

| Hotspot | Location | Trigger | Blast radius | Fix class | Risk |
|---|---|---|---|---|---|
| Message list is plain `.map`, no windowing | `DiscussApp.tsx:2463` (`withSeparators.map`), list `2392` | any parent render | every `MessageBubble` reconciled | Virtualize (react-window) | High |
| `MessageList`/`MessageBubble` not `React.memo` | `2392`, `2641` | composer keystroke, realtime tick, unrelated toggle | full message subtree walks each time | `React.memo` both (cashes in the 31 existing `useCallback`s) | High |
| Composer text state colocated with the list in one ~1,940-line component | `344` (`composerBody`), list rendered `2038` | every keystroke in composer | whole `DiscussApp` body + unmemoized list | Own the composer state in a child component | High |
| Unbounded realtime append (initial fetch capped 120, append path uncapped) | `~662` (`setMessages(prev => [...prev, …])`); fetch limit `~518` | sustained traffic on a long-open tab | message array + unwindowed list grow without bound | Cap array length / pair with virtualization | Med |
| Inline handlers inside `MessageBubble` | `2812-2924` (`onClick={() => onDelete(msg.id)}` etc.) | every bubble render | blocks memo payoff until curried | `useCallback`/curry or delegated handler | Med (blocker) |

Positives (verified, not hotspots): realtime channel effect deps are deliberately narrowed via
refs (`633-799`) — no re-subscribe-per-render footgun; `withSeparators`/`filteredChannels` memoized;
all 9 modals conditionally mounted (`2140-2244`). Dead state `pinnedPanelOpen` (`424`) is unused.

---

## Quotations — `src/components/quotations/Quotations.tsx` (2,978) + `QuotationA4Preview.tsx` (9,390)

**0 `React.memo` in either file.** Preview is `dynamic()` (`Quotations.tsx:49`) — bundle split only,
**no runtime re-render protection** once loaded. Whole quotation lives in one `current` object
(`Quotations.tsx:1071`) prop-drilled into the 9.4k-line preview (`2710`).

| Hotspot | Location | Trigger | Blast radius | Fix class | Risk |
|---|---|---|---|---|---|
| `current` → non-memoized `QuotationA4Preview` + ~15 inline-arrow props | `Quotations.tsx:2710-2746`; preview `QuotationA4Preview.tsx:319` | any field edit anywhere | full 9.4k-line preview, all pages/rows | `React.memo` preview + functional-`setState` callbacks | High |
| Per-row notes `<textarea onChange>` commits per keystroke (siblings commit on blur) | `QuotationA4Preview.tsx:1574-1576` | typing a row note | full preview per keystroke | Local uncontrolled + commit on blur | High |
| customerName/companyName + standTablePrice/fxRate inputs commit per keystroke | `Quotations.tsx:2670-2702`; `QuotationA4Preview.tsx:8590-8615` | typing these fields | entire preview re-renders though fields don't touch items | Debounce / memoize preview | High |
| Item rows inline JSX in `.map`, **index-based keys**, no stable `id` | rows `QuotationA4Preview.tsx:1134-1610`; keys `1158`,`1281`; type `Quotations.tsx:58-70` (no id) | edit/insert/remove/reorder | all rows re-render; insert/remove **remounts** every row after the mutation point | Extract memoized `LineItemRow` + add stable `id` | High |
| 9 item-handler `useCallback`s all depend on `[current]` | `Quotations.tsx:1825-2065` | every keystroke | recreated each edit → no stabilization, blocks row memo | Functional `setCurrent(prev => …)` (pattern already at `QuotationA4Preview.tsx:483`) | Med |
| `subTotal` useMemo depends on `[current]` not `[current.items]` | `Quotations.tsx:2088-2097` | any field edit (name/terms/…) | O(n) reduce recomputes on unrelated edits | Narrow dep to `[current.items]` | Low-Med |
| `ScreenshotCaptureModal` + `ImageLightbox` rendered unconditionally per row | `QuotationA4Preview.tsx:7320-7336`, mounts `7555-7564` | every row render | N× hook instances (each early-returns null DOM) | Conditional-mount like the QuickFill modal (`2079`) | Low |

Positives: most row cells (desc/model/price/qty) commit on **blur** not per keystroke
(`1186/1351/1377/1395`); `rowNumbers`/`pages`/`totalQty` correctly memoized on `[current.items]`.

---

## Finance — Dashboard + Statements

`FinanceDashboard.tsx` (1,242) · `VisualStatements.tsx` (957) · `FinanceStatements.tsx` (501) ·
`FinanceDashboardUi.tsx` (378). **0 `React.memo` in all four** (only `FinanceDashboard.cards.tsx`
memoizes 3 cards). Good news: the heavy aggregations ARE memoized — the gap is unmemoized charts +
unbounded statement tables.

| Hotspot | Location | Trigger | Blast radius | Fix class | Risk |
|---|---|---|---|---|---|
| Statement tables via `.map`, no virtualization, no row memo, unbounded rows | `FinanceStatements.tsx:353-362` (aging), `417-426` (inventory), `474-484` (gross profit) | date-range/tab refetch | all rows (hundreds+) re-render; no windowing | Virtualize + memoized `Row` | High |
| Chart primitives not memoized + inline `series` literal | `charts.tsx` `AreaChart` `175` (+ `94/352/448`); data `FinanceDashboard.tsx:706-711`,`960-964` | any dashboard render (period, fetch, memory/copilot effects) | full SVG rebuild (Catmull-Rom smoothing, tick math) ×2 views | `React.memo` charts + `useMemo` series array | High |
| `OperationalView`/`ExecutiveView` not memoized | `FinanceDashboard.tsx:465`,`754`; driven by `period`/`mode` `123-124` + loading flips `210-221` | period toggle, every fetch cycle | entire visible dashboard subtree re-executes | `React.memo` both views | Med |
| `VisualStatements` sub-views/`TrendChart` not memoized | `VisualStatements.tsx:499`,`810`,`858`,`897`; loading toggle `367` | any granularity/period/compare nav | full statement table + chart rebuild | `React.memo` sub-components | Med |
| Unmemoized literal props to unmemoized children | `FinanceDashboard.tsx:118-122` (`PERIOD_OPTIONS`), `407-445` (`pills`/`modules`) | every render | fresh arrays each render | `useMemo` / hoist statics | Low |

Positives: all `FinanceDashboard` aggregations memoized (`238-280`, confirmed independently); no
unnecessary Effects; no modals in these files.

---

## Products list — `src/components/admin/ProductList.tsx` (1,612 lines; via `app/products/page.tsx`)

**23 `useState`, 17 `useMemo`, 0 `React.memo`.** Best-optimized list of the set — it's the only one
using a concurrent-React technique.

| Hotspot | Location | Trigger | Blast radius | Fix class | Risk |
|---|---|---|---|---|---|
| 600+ cards/rows inline JSX, no memoized row, no virtualization | `ProductList.tsx:1236` (grid), `1434` (list); fetch no limit `247` | any filter change / `deleteTarget` | full re-diff of every visible card | Extract `React.memo` `ProductCard`/`ListRow` | Med-High |
| Row-scoped delete state held at parent | `ProductList.tsx:641` (`deleteTarget`) | opening delete on one card | whole list re-diffs | Move into memoized row | Med |
| Typeahead `suggestions` scans full `products` on raw (non-deferred) `search` | `ProductList.tsx:433-497` | every keystroke | 2× full scans per key | Defer/debounce | Med |

Positives (verified): **`useDeferredValue(search)`** at `191` shields `filtered` (`540`) from
per-keystroke work — the one place doing this right; `searchHaystack`/`categoryTree`/`filtered`
memoized; `content-visibility:auto` on card sections (`1195`) mitigates paint; delete dialog
unmounts when closed.

---

## Accounts — `src/components/admin/accounts/AccountsList.tsx` (912 lines)

**19 `useState`, 0 `React.memo`.**

| Hotspot | Location | Trigger | Blast radius | Fix class | Risk |
|---|---|---|---|---|---|
| `search` state not deferred/debounced | `AccountsList.tsx:81` + `filtered` `201-226` | every keystroke | full re-filter + re-render of both `filtered.map` blocks (`592`,`706`) | `useDeferredValue` (as ProductList) | Med-High |
| Row-menu open state at parent | `AccountsList.tsx:90` (`openMenu`),`95` | opening any row's action menu | whole component re-renders, all rows re-diff | Move into memoized row | Med |
| Full table + mobile cards, no virtualization/pagination | `592`, `706`; fetch no limit `139` | any state change | full `.map` re-diff | Paginate/virtualize | Med |

Positives: `enriched`/`filtered`/lookup maps memoized; `RowMenu` conditionally mounted (`797`).

---

## Employees — `src/app/employees/page.tsx` (the list component itself)

**9 `useState`, 1 `useMemo`, 0 `React.memo`.** Least-optimized list — no deferral, no
`content-visibility`, no row memo.

| Hotspot | Location | Trigger | Blast radius | Fix class | Risk |
|---|---|---|---|---|---|
| `search` (+4 filter dropdowns) drive full list, no deferral | `page.tsx:89` (`search`, filters `90-93`) + `filtered` `106-125` | every keystroke / filter change | full unbounded `filtered.map` (`304`), no windowing or CV mitigation | `useDeferredValue` + memoized `EmployeeRow` | Med-High |
| Stat computations inline in render, NOT memoized | `page.tsx:133-135` (`totalActive`/`totalDepts`/`totalOnLeave`) | every render (any state change) | 3 extra full-array passes even when `employees` unchanged | `useMemo([employees])` | Low-Med |
| Rows inline `<Link>` JSX, no memo | `page.tsx:304-349` | any parent state change | all rows re-diff | Extract `React.memo` row | Med |

---

## Notifications

### `src/components/layout/NotificationBell.tsx` (808 lines) — 4 `useState`, 0 `React.memo`, 11 `useEffect`

| Hotspot | Location | Trigger | Blast radius | Fix class | Risk |
|---|---|---|---|---|---|
| Two concurrent 60s `setInterval` pollers (Discuss + Inbox) | `NotificationBell.tsx:335`, `362` | every 60s while tab visible | badge-level re-render of whole bell each tick (even closed) | Consolidate into one poll/shared hook | Low-Med |
| Redundant fetch triggers across 11 effects (`recountDiscuss`/`recountInbox` from mount, realtime, resume, open) | `199-201`,`228/234`,`260-264`,`421-426`,`240-245` | account load / focus / poll coincidence | same endpoint hit from multiple paths, can double-fire | Coalesce/de-dupe | Low |
| Inline unmemoized `discussUnread` reduce / `discussRows` filter-sort-slice | `170-173`, `498-509` | every render | cheap (bounded ≤14 rows) | `useMemo` (low value) | Low |

Positives: dropdown body conditionally mounted (`540`); rows bounded (`slice(0,6)` `509`,
inbox `limit:8` `414`); polling visibility-gated and realtime-first (well-documented).

### `src/components/operations/NotificationBell.tsx` (simpler) — 3 `useState`, 0 memo

| Hotspot | Location | Trigger | Blast radius | Fix class | Risk |
|---|---|---|---|---|---|
| Fetch-once on mount, **no re-poll** → badge goes stale | `NotificationBell.tsx:40-47` | never refreshes after load | stale badge for page lifetime (opposite of the layout bell) | Add visibility-gated poll | Low |
| Inline `riskCount` filter / `badgeTone` ternary | `58-61` | every render | trivial (small `alerts`) | `useMemo` (low value) | Low |

Positives: dropdown conditionally mounted (`75`); click-outside effect scoped to `[open]`.

---

## Contexts

| Context | Location | Issue | Blast radius | Fix class | Risk |
|---|---|---|---|---|---|
| `SidebarProvider` value object recreated each render | `SidebarContext.tsx:55` (`value={{ expanded, setExpanded, mobileOpen, setMobileOpen, toggle }}`) | toggling `mobileOpen` re-renders all `useSidebar()` consumers even if they only read `expanded`/`toggle` | Sidebar + MainHeader consumers | `useMemo` value; split read/write contexts | Low-Med |
| `LangContext` value recreated each render | `product-coding/i18n.tsx:1249` (`value={{ lang, setLang, dir }}`) | scoped to product-coding subtree only | product-coding consumers | `useMemo` value | Low |

Positives: root `Providers` (`app/providers.tsx`) is just QueryClient (created once via
`useState`) — no re-render storm. The QA Inspector context uses a **ref** as its value
(`inspector.tsx:130`) and keeps hover state in an overlay mounted only while active — correctly
isolated, not a hotspot.

---

## Top 12 render hotspots — ranked by (blast radius × trigger frequency)

| # | Hotspot | Location | Trigger freq | Blast radius | Fix class |
|---|---|---|---|---|---|
| 1 | Quotation `current` → non-memoized 9.4k-line preview + inline-arrow props | `Quotations.tsx:2710` / `QuotationA4Preview.tsx:319` | per keystroke (name/notes/price fields) | full preview, all pages/rows | `React.memo` + functional-setState callbacks |
| 2 | Discuss message list not virtualized + `MessageBubble`/`MessageList` unmemoized | `DiscussApp.tsx:2463`,`2392`,`2641` | per composer keystroke + per realtime tick | every message bubble | Virtualize + `React.memo` |
| 3 | CRM drag-hover state re-renders entire unmemoized board | `CRM.tsx:198-199`,`310-313` | per column crossing during drag | all columns + all cards | `React.memo` column/card + `useCallback` |
| 4 | Contacts list: no row memo + no virtualization, all `filtered` mapped | `Contacts.tsx:6279`,`6284`,`6297` | per keystroke + per selection | whole directory of rows | Memoized `ContactRow` + windowing |
| 5 | ProductForm single 81-field `product` object, spread-copy per keystroke | `ProductForm.tsx:497`,`1088` | per keystroke | active wizard step (~32 fields) | Per-section state slices / blur-commit |
| 6 | Finance statement tables unbounded, no virtualization/row memo | `FinanceStatements.tsx:353`,`417`,`474` | per date-range/tab change | hundreds+ of `<tr>` | Virtualize + memoized Row |
| 7 | Quotation item rows: index keys + no stable id + no row memo | `QuotationA4Preview.tsx:1134`,`1158`,`1281` | per item edit/insert/remove/reorder | all rows; insert/remove remounts everything after | `LineItemRow` memo + stable `id` |
| 8 | Finance charts unmemoized + inline `series` literal | `charts.tsx:175` + `FinanceDashboard.tsx:706` | per dashboard render | full SVG smoothing rebuild ×2 views | `React.memo` charts + `useMemo` series |
| 9 | Employees list: no deferral + inline stat passes + no row memo | `employees/page.tsx:89`,`133-135`,`304` | per keystroke / filter change | full unbounded list | `useDeferredValue` + memoized row + `useMemo` stats |
| 10 | ProductList 600+ cards, no memoized row (delete state at parent) | `ProductList.tsx:1236`,`1434`,`641` | per filter change / row delete | all visible cards | `React.memo` card |
| 11 | Accounts: search not deferred + row-menu state at parent | `AccountsList.tsx:81`,`90` | per keystroke / row-menu open | full table + mobile cards | `useDeferredValue` + memoized row |
| 12 | CRM `maxStageRevenue` O(stages×opps) reduce in render body | `CRM.tsx:825-833` | per drag-hover + per keystroke | recomputed dozens of times/drag | `useMemo` / fold into `oppsByStage` |

---

## Shared / cross-app render patterns

1. **`React.memo` is essentially absent from list/row rendering.** Contacts, CRM, ProductForm,
   Discuss, both Quotation files, all Finance files, ProductList, AccountsList, Employees page,
   both NotificationBells — **all render `0` `React.memo`** on their row/card/section components.
   With no React Compiler, a single parent state change re-renders and reconciles every child. This
   is the dominant, repeated cost. The one exception is `FinanceDashboard.cards.tsx` (3 memoized
   cards) and a handful of memoized *leaf inputs* inside Contacts (`Input`/`ComboInput` @2168/2211).

2. **Search/filter state sits high, and only one place mitigates it.** `ProductList.tsx:191` uses
   `useDeferredValue(search)` — the correct, low-risk pattern. Contacts uses a 150ms debounce.
   **AccountsList (`:81`) and Employees (`:89`) do neither** — every keystroke does the full filter
   + full list re-render at blocking priority. Rolling out `useDeferredValue` to those two is the
   cheapest high-value fix in the audit.

3. **Zero virtualization anywhere.** Every large list mounts all rows: Contacts directory, CRM
   columns, Discuss messages, Finance statement tables, ProductList (mitigated by
   `content-visibility` only), Accounts, Employees. `content-visibility:auto` (used only in
   ProductList) reduces paint/layout but **not** React reconciliation. Virtualization should follow
   row-memoization (memo first, then window) and only where row counts are genuinely large.

4. **"Whole object" as one state atom + spread-copy updater.** Recurs in ProductForm (`product`,
   81 fields), Quotations (`current`), Contacts (`sIntel` etc.). Every keystroke allocates a new
   top-level object → new prop identity → cascades through unmemoized children. `useCallback`s that
   depend on that object (e.g. Quotations' 9 item handlers, `Quotations.tsx:1825-2065`) are
   recreated anyway, so the memoization is inert. Fix pattern: functional `setState(prev => …)` to
   drop the object dependency, plus narrower state slices.

5. **Derived work mostly memoized in the analytics-heavy files, mostly not in the simple lists.**
   Finance dashboard and CRM correctly `useMemo` their aggregations; the misses are inline chart
   `series` literals, Employees' `total*` stats (`page.tsx:133-135`), CRM's `maxStageRevenue`
   (`825`), and ProductForm's inline `brands.map` slug derivation (`3253`).

6. **Effects are generally healthy.** No systemic fetch-on-mount double-fire beyond StrictMode dev
   behavior; realtime subscription effects (Discuss `633-799`, NotificationBell `213`) are
   ref-guarded against re-subscribe storms. The one over-triggering surface is the layout
   NotificationBell's 11 effects funneling into duplicate recount fetches.

7. **Modals/drawers are correctly conditionally mounted almost everywhere** (Contacts, CRM,
   Discuss, ProductList, both bells). The exceptions are minor: Quotation `PictureCell` mounts
   `ScreenshotCaptureModal` + `ImageLightbox` per row unconditionally (`QuotationA4Preview.tsx:7320`)
   — they early-return null DOM but still run hooks per row.

8. **Context values recreated each render** in `SidebarContext.tsx:55` and product-coding
   `i18n.tsx:1249` — low blast radius today (few consumers), but a `useMemo` on the value (or
   read/write split) is the standard cheap fix.


---

## Wave 2A.1 note (2026-07-16)
No React-hotspot fixes yet (that is Wave 2C). Wave 2A.1 shipped the server-list data foundation; once the Customers UI is server-paged it will render a bounded 50-row page instead of all 120, which is the prerequisite measurement before deciding on virtualization/memoization for this list (per the mandate: measure the bounded page's React cost first).


---

**Wave 2A.2 update (2026-07-16):** Suppliers directory migrated onto the shared server-list architecture (server search/filter/sort/pagination + permission-safe global summary, replacing the full-supplier-dataset client fetch + 20s poll) on branch `wave2a2-suppliers-preview` — Preview-gated, NOT in production. Real before/after percentiles/bytes/req-counts require a measured Preview/cohort window (Vercel-log/Speed-Insights). See `PHASE_4_WAVE_2A2_RESULTS.md` + `SUPPLIERS_SERVER_LIST_PILOT.md`.


---

**Phase 4 — Home & App Launch Performance (2026-07-16):** shared `AppLaunchLink` primitive (Link-based: modifier keys, viewport prefetch, CSS pressed feedback, keyboard, dup-guard, intent preload, unified privacy-safe launch telemetry) adopted on Home cards + sidebar + launcher; evidence-based prefetch tiers (`src/lib/app-prefetch.ts`, Save-Data/slow/hidden/authorization-gated); 15 new app-shaped `loading.tsx` boundaries (+5 shared skeletons) → blank-flash eliminated; bootstrap primed at shell top (shell confirmed already persistent, single TanStack cache, no remount). `app_launch.*` metrics via the perf client (percentiles pending a Vercel-log window). Tests: `validate:app-launch` 51/51; tsc + build green. Docs: HOME_APP_LAUNCH_RESULTS.md, APP_NAVIGATION_ARCHITECTURE.md, APP_PREFETCH_STRATEGY.md, APP_USAGE_AND_PRELOAD_RANKING.md, PERSISTENT_SHELL_AUDIT.md, APP_LOADING_BOUNDARIES.md, APP_LAUNCH_BASELINE.md, HOME_PAGE_PERFORMANCE_AUDIT.md.


---

**Phase 4 Wave 2B.1 — Finance Dashboard Performance (2026-07-16):** CONFIRMED the "~8 fan-out" is `/finance/intelligence` (FinanceDashboard.tsx, 1 KPI + 7 already-concurrent feeds), NOT `/finance` (which is already a single `visual-statements` aggregate). Shipped smallest-safe wins: `/finance` first-load section skeleton (was blank below controls until ~2s aggregate), `/finance/intelligence` stale-response guard (kpiSeq), privacy-safe `finance.dashboard.*` metrics, dead-import cleanup. NO accounting-route refactor / mega-endpoint (rejected on evidence: already parallel, unrelated workflows, low traffic). Tests: `validate:finance-perf` 42/42; tsc+build green. Docs: FINANCE_PERFORMANCE_BASELINE.md, FINANCE_PERFORMANCE_RESULTS.md.
