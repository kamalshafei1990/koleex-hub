# React Rendering Audit (Phase 4)

**Method note (honest):** true render-count / commit-duration profiling requires the React Profiler on an authenticated real-user session, which this environment cannot run. This audit ranks hotspots by **component size + known interaction density + code inspection**, and every item is flagged **"profile before optimizing"** per the mandate ("do not add memoization everywhere without measurements").

## Ranked candidates
| # | Component | Size | Why it's a candidate | Confirm with |
|---|---|---|---|---|
| 1 | `Contacts.tsx` | 764 KB | one component powers Customers + Suppliers + Contacts; holds list + search + filter + row rendering in one tree → a keystroke in search may re-render the whole list | Profiler: type in search, watch commit count/duration |
| 2 | `ProductForm.tsx` | 303 KB | large form; controlled inputs can re-render siblings on each keystroke | Profiler on field edit |
| 3 | `CRM.tsx` | 158 KB | drag-and-drop board; DnD often re-renders columns on every pointer move | Profiler during drag |
| 4 | `DiscussApp.tsx` | 165 KB | message list **not virtualized**; grows with history (P1-3 raises depth) | Profiler on a 500+ msg channel |
| 5 | `management/page.tsx` | 145 KB | org chart / large tree | Profiler on expand |
| 6 | `QuotationA4Preview.tsx` | 435 KB | already `dynamic()` (good); heavy render when open | Profiler on open |
| 7 | `catalogs/page.tsx` | 214 KB | grid + PDF viewer; MergedSupplierCard span logic | Profiler on grid resize |
| 8 | `SupplierDetail.tsx` | 125 KB | many tabs/fields | Profiler on tab switch |
| 9 | `QaReportsApp.tsx` | 110 KB | 20 s refresh + list | Profiler on refresh tick |
| 10 | `LegacyProductView.tsx` | 121 KB | legacy detail | Profiler on load |

## Structural observations (no profiling needed)
- **No global-provider re-render storm**: root providers are just QueryClient + Sidebar + QAInspector; risk is inside leaf giants, not the tree. ✅
- **Non-virtualized lists**: Discuss thread + several large tables render all rows. Virtualize only after measuring (a11y/scroll risk) — matches Phase-1 guidance.
- **Already-lazy heavy components**: Contacts, QuotationA4Preview, KoleexAiApp use `dynamic()` — their weight is off the initial bundle.
- **Eager heavy components**: ProductForm, DiscussApp, CRM (0 dynamic sites) — code-split candidates (bundle *and* render entry).

## Recommended approach
1. Ship the app-wide timing + a dev React-render counter first (measurement).
2. Profile the top-5 on real sessions.
3. Fix only what the Profiler flags: stable selectors, split search-input state from list state, row memoization *where measured*, virtualize *only* the lists that measure slow.
