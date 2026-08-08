# App Revision — Customers, SYS-3 kill (route JS weight)

Session 5 · 2026-08-08

## Root cause
`Contacts.tsx` statically imported `{ Country, State, City } from
"country-state-city"` — a library whose city.json alone is **7.7 MB raw**
(2.26 MB gzipped in our chunk). Module-level `Country.getAllCountries()`
constants welded the whole dataset onto the /customers (and /contacts,
/suppliers) route graph; the launcher even idle-preloaded that chunk.

Two subtleties found on the way:
1. **Turbopack does not tree-shake the package index's re-exports** — even a
   Country-only import kept city.json in the graph (verified by grepping the
   built chunk for city names). Fix: deep import `country-state-city/lib/country`.
2. An ungated `useStateCity()` at the component top re-downloaded the chunk at
   screen open — the hook must be **gated on the form actually being on
   screen** (`view === "form" || formModalOpen`).

## Fix
- New `src/lib/geo/state-city-lazy.ts`: on-demand State/City loader
  (globalThis-anchored store per SYS-4, `useStateCity(active)` hook,
  `get*Sync` accessors that return [] until the dataset lands).
- Contacts.tsx: deep Country import; StateDropdown/CityDropdown use the lazy
  accessors; the form's `hasStates` gate uses the hook placed above the
  early returns (rules of hooks).

## Verified (local prod server + owner session)
- /customers open: **the 8.2 MB (2.26 MB gzip) city chunk is no longer
  requested at all** — cold first-visit JS drops from ~2.7 MB to ~0.45 MB
  (−83%).
- New Customer form: chunk loads on demand at form open; country/state/city
  pickers work (China path unaffected — it uses our curated list and never
  needed the library).

## Notes
- CreateSupplierModal still imports the package index statically, but it
  already lives in a lazy chunk behind ProductForm — acceptable; converting
  it to the shared lazy lib is a W3 (Suppliers) item.
- The launcher's contacts chunk-preloader now warms a light chunk instead of
  the elephant.
