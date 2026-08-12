# W3 · Landed Cost + Catalogs — six-lens pass

**Measured** 2026-08-13 on `next start -p 3001` (prod bundles) + owner session + prod DB,
`performance.getEntriesByType('resource')`, counting only `deliveryType !== "cache"`
and excluding the localhost-only `/api/dev/build-stamp` poller.

## Baselines

| screen | real API calls | distinct endpoints | duplicates |
|---|---|---|---|
| `/catalogs` | **10** | 8 | **none** |
| `/landed-cost` | **4** | 4 | **none** |

### The two "duplicates" on /catalogs are not duplicates

`/api/contacts ×2` and `/api/storage/list ×2` look like double-fires in a bare path
count. They are not — the query strings differ:

```
/api/contacts?type=supplier                              1134ms
/api/contacts?type=company                                474ms
/api/storage/list?bucket=media&folder=divisions&limit=500  307ms
/api/storage/list?bucket=media&folder=categories&limit=500 556ms
```

Four distinct reads, all issued in the same tick (startTime 496–497ms), all parallel.
**Count paths WITH their query strings, or a correct screen reads as broken.**

Standing opportunity, not taken: those four could be two (`type=supplier,company`,
one storage listing over both folders). Since they run in parallel the wall-clock
saving is bounded by the slowest (`?type=supplier`, 1134ms), so this is a Vercel
dynamic-response cost item, not a latency one — filed, not fixed.

## B4 — the real defect, measured and fixed

`GET /api/landed-cost` answers with `private, max-age=10, stale-while-revalidate=60`.
That is deliberate and good: the list paints instantly on ordinary navigation.

It also means **a read issued seconds after a write is served by the browser cache**.
Measured, three back-to-back reads on a prod build:

| call | result |
|---|---|
| 1st | 280ms · network |
| 2nd (immediate) | **3ms · `deliveryType: "cache"`** |
| 3rd, `cache: "no-store"` | 196ms · network |

The live path this breaks: `handleDuplicate` calls `duplicateSimulation(id)` and then
`fetchSimulations()` **immediately** — inside the 10s window, so the refreshed list is
the *pre-duplicate* list and the new copy does not appear until the user reloads.

**Fixed centrally in `landed-cost-admin.ts`**, not at the call sites: every mutation
(`create` / `update` / `delete`; `duplicate` inherits it through `createSimulation`)
raises a module-level `listDirty` flag, and the next list read spends one `no-store`
request to clear it. Ordinary navigation keeps the cache. Nothing at the call sites
changed, so a future caller gets the fix for free.

`handleDelete` was already safe — it filters the row out locally and never re-reads.
`GET /api/landed-cost/[id]` sets no `Cache-Control` at all, so returning to an edited
simulation was never affected. **Both checked before changing anything.**

## B2 / B3 — Catalogs taxonomy

`loadAll` fetched `fetchDivisions()` + `fetchCategories()` as two of five parallel
ancillary calls. Both are thin wrappers over `memoFetch` → `/api/taxonomy/<kind>`.

`fetchTaxonomyAll()` already existed for exactly this, against the same cache keys,
and does two things the per-list fetchers cannot:

1. **one request instead of two** — the comment on it puts the reason plainly: a
   request costs ~1–2s of latency on the operators' connection regardless of size;
2. **an aged-mirror path** — it returns the last-known lists synchronously and
   refreshes behind, where `fetchDivisions`/`fetchCategories` are fresh-or-wait.

Point 2 is the one that shows. Switched; ancillary calls 5 → 4.

**Catalogs' own warm-start was already correct and was left alone** — `catalogs` and
`catalogsLoading` both read `queryClient.getQueryData(CATALOGS_QK)` in the `useState`
*initialiser* (not an effect), and `CATALOGS_QK` carries `currentScopeKey()` so a
cached list cannot bleed across tenants. There is no `persistQueryClient` in the repo,
so this is a soft-nav warm start only; a reload still pays for the list. Filed.

`catalogs-admin.ts` holds **zero** `.from(` calls — every read and write already goes
through `/api/catalogs*`. No browser DB access to remove.

## B1 — Catalogs code health: 8 eslint errors → 3

All eight **pre-dated this pass** (verified by linting `git show HEAD:<file>` and the
working copy side by side — 8 before, 8 after my i18n edits, so none were mine).

Fixed:
- **3 × `no-explicit-any`** — `(window as any).pdfjsLib`, five sites. The self-hosted
  pdf.js UMD build ships no types, so a structural surface was written for the parts
  actually used (`PdfJsLib` / `PdfDocLike` / `PdfPageLike` / `PdfRangeTransport`),
  plus `requirePdfjs()` for the post-`ensurePdfJs()` call sites. `openPdfDocument`
  now returns `PdfDocLike` instead of `any`. Four `eslint-disable` directives went
  stale as a result and were removed.
- **2 × setState-in-effect** that were plain derived-state resets — `setZoom(1)` on
  catalog change, `setVisibleCount(24)` on filter change. Both moved to render-phase
  adjustment (compare-and-set against a key held in state), which is the documented
  React pattern and drops a second render pass on every preview open and every
  filter keystroke.

**Left, with the reason:** three `setState`-in-effect sites that are *not* derived
state — the QuickAddContact form reset on `open`, the CatalogModal populate on
`open`, and `loadAll()` on mount. Fixing these properly means `key`-based remount
(and moving ~30 field values into `useState` initialisers) or moving the list onto
React Query's own lifecycle. That is a real refactor of a working upload modal, not
a lint fix, and it is not worth doing blind. Filed as debt, not silently skipped.

## F1 — the print report was the whole finding

`SimulationForm` has **307** `t()` calls. `catalogs/page` has 214. `landed-cost/page`
has 26. And `landed-cost/[id]/print/page.tsx` had **zero** — the simulation form is
translated exhaustively and the report it prints was entirely English.

Wiring it took three passes, because each scan pattern is blind to the next:

1. `>text<` → 22 labels. **16 of the 22 already had zh/ar keys that nothing used.**
2. `label="…"` props passed to the local `Row` component → **63 more**, structurally
   invisible to any `>text<` scan. 36 of 64 already had keys.
3. `>text{` and `}text<` — text sitting *next to* a JSX expression → 3 more
   (`Local currency:`, the header line, the footer line), plus the same trap on
   `landed-cost/page`: `{draftCount} drafts` and `{completedCount} completed`.

**68 labels + 5 strings wired · 40 new keys · dictionary 327 → 369, all en/zh/ar.**

The report's date was also hardcoded to `toLocaleDateString("en-US")`; it now takes
the locale from `useTranslation`'s `lang` (`en-US` / `zh-CN` / `ar-EG`).

Catalogs: 6 real placeholders wired (`e.g. China`, `e.g. Sales Manager`, …). The
other 13 quoted attributes are **deliberately left** — sample phone numbers, `@handle`,
`wxid_…`, `https://…`, sample emails, and `达美工程有限公司` (the Chinese-name field's
placeholder *is* Chinese by design). Translating those would be noise.

## F2 — mobile, measured at 360×780

Both screens: `scrollWidth === clientWidth`, no horizontal bleed. The elements that
report as "overflowing" on `/catalogs` are the off-canvas drawer sitting at
`right: -13` — that is the design, not a leak.

**One real defect, on `/landed-cost`: the h1 rendered as "Land…" at 360px.** The
header row has `flex-wrap`, but wrap can never fire while the title block is
`flex-1 min-w-0` — it absorbs all the pressure by truncating, so the "New Simulation"
button keeps its place on the line and the title collapses to four characters. Fixed
with `max-sm:basis-full` on the button so it takes its own row below `sm`, which is
what `/catalogs` already does. (`max-sm:`, not `sm:`, per the density-layer rule.)

## RTL — open, and stated at its real size

| file | physical (`pl-`/`left-`/`mr-`…) | logical (`ps-`/`start-`/`me-`…) |
|---|---|---|
| `catalogs/page` | 50 | 1 |
| `landed-cost/page` | 19 | 0 |
| `print/page` | 8 | 0 |
| `SimulationForm` | 24 | 1 |

The dangerous case is *mixing* both on one element — checked, and it does not happen
here (the single logical class in `catalogs` is `end-0.5` on an element whose other
axis class is `bottom-0.5`). So nothing is *mixed*. But these screens are not
RTL-aware at all, and switching the Hub to Arabic shows it immediately:

> `1 محاكاة· 1 مسودّة`  ← the separator collides with the word before it

That is `ml-2` on the drafts/completed spans: a LEFT margin, which in Arabic lands
on the wrong side of the text and closes the gap. Fixed to logical `ms-2` (safe —
neither span carries any other inline-axis class). **This is what the other ~100
physical classes will each do in Arabic; this one was only caught because it landed
in the first screenshot.** The table above is the size of the remaining work, not a
hypothetical. Converting
~100 classes across four files without a per-direction visual check would be worse
than leaving it. **Filed as its own item, not claimed as done.**

## Gates

`npm run build` exit 0 · `tsc --noEmit` **0 errors project-wide** · `validate:budgets`
**56 passed, 0 failed`.

### Measurement note worth keeping

Twice in this pass `tsc` and `eslint` **exited 0 while never running** —
`EPERM: uv_cwd` from the sandboxed shell, which a `| grep -c` turns into a clean
"0 errors". Both times the real answer was non-zero. **Check the exit code and the
output line count, not just the grep.** `mcp__MacOS-MCP__Shell` runs them correctly.
