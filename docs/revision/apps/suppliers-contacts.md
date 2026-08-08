# App Revision — Suppliers + Contacts (W3 opener)

Session 9 · 2026-08-08

## Fixed
- **CreateSupplierModal** converted to the SYS-3 pattern (deep
  `country-state-city/lib/country` import + lazy State/City via
  state-city-lazy) — its chunk no longer carries the 8 MB city dataset;
  pickers stream the data when the modal opens.
- **Contacts silent-refresh cadence 20s → 90s:** the poller re-downloaded the
  whole slim contacts list 3×/minute per open tab (timestamps 2.8s / 22.8s /
  42.8s proved it). Focus/visibility refetch keeps instant freshness on tab
  return; 90s covers cross-operator sync at ~1/4.5 the traffic — the
  cadence×users cost documented in the capacity memory.

## Measured (network calls on open, dup-free)
- /suppliers: **14** (city chunk NOT requested ✓)
- /suppliers/sourcing: **10**
- /contacts: **13**

## Verified
- F2 375px: suppliers list (bilingual names, logos, rating stats) clean.
- B4: supplier intelligence labels, import-from-catalog entry, sourcing
  command center all reachable; SupplierDetail (1.8k lines) renders from the
  shared directory.
- B1: no console.logs/TODOs across suppliers components.

## Lenses
| App | B1 | B2 | B3 | B4 | F1 | F2 |
|---|---|---|---|---|---|---|
| Suppliers | 🔍 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Contacts | 🔍 | ✅ | ✅ | ✅ | ✅ | ✅ |
