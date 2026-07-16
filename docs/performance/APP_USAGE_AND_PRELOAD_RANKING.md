# App Usage & Preload Ranking (Phase 4)

Source: `activity_events` (page_view), primary Koleex tenant, 60-day window,
aggregate only (no individual identities; ≤5 distinct internal users). Used to
choose the Tier-A idle-preload set — **from data, not assumptions**.

## Most-launched apps (60d)
| Rank | App | page_views | distinct users | active days |
|---|---|---|---|---|
| 1 | Home (launcher) | 522 | 5 | 23 |
| 2 | **Customers** | 130 | 2 | 13 |
| 3 | **Suppliers** | 128 | 2 | 6 |
| 4 | Database (Visual Library) | 48 | 1 | 5 |
| 5 | **Quotations** | 35 | 2 | 8 |
| 6 | Product Data | 32 | 1 | 7 |
| 7 | Software Center | 31 | 1 | 5 |
| 8 | AI | 24 | 1 | 6 |
| 9 | **Products** | 24 | 2 | 8 |
| 10 | Catalogs | 22 | 2 | 9 |
| 11 | HR | 22 | 2 | 4 |
| 12 | Accounts | 21 | 1 | 4 |
| … | Invoices / Discuss / Settings / Knowledge / Inventory / … | ≤17 | | |

## Preload selection
- **Tier A idle (max 4):** Customers, Suppliers, Products, Quotations — top
  launched business apps that are light-to-medium (Customers/Suppliers are now
  server-list; Products has a slim list; Quotations warms only route code +
  reference data). Database (#4) and AI (#8) are deliberately **Tier C** despite
  rank — heavy (5k-asset library / AI workspace) → click-only.
- **Tier B intent:** all other active apps (hover/focus warm).
- **Tier C no-preload:** database, ai, finance, activity-monitor, software-center,
  price-calculator.

## Slowest launch / largest chunks
Real per-app route-chunk bytes + launch percentiles require the Vercel-log /
Speed-Insights window (not readable from the build env). See
`ROUTE_BUNDLE_REPORT.md` for the static bundle proxy; the `app_launch.*` metrics
(now emitted) provide per-app launch timings once a traffic window accrues.

## Privacy
Aggregate counts only; no user identity, no record ids, no search text. Do not
expose per-user rankings.
