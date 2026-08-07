# App Revision — Home (/home RoleHome + /api/workflows/status)

Session 1 · 2026-08-08 · Scope this pass: RoleHome dashboard + its status API.
The `/` launcher page (1,176 lines) gets its own follow-up pass.

## Found & fixed

| Lens | Finding | Fix |
|---|---|---|
| B1 | Warehouse dashboard "Locations" KPI displayed the STOCK-BALANCES count (copy-paste; API had no locations figure at all) | `/api/workflows/status` now counts `inventory_warehouses`; KPI relabeled "Warehouses" and reads the real number (verified: 4, was showing 3) |
| B2 | RoleHome fired 3 `no-store` fetches on every mount (preferences / workflows-status / finance-setup) | Coalesced via cachedGet (60s/30s/60s) + preferences invalidated after Personalize save |
| B3/SYS-4 | **Root cause of the systemic ×2 fetches:** Turbopack duplicates small modules across chunks (visual-bindings present in 3 chunk files) → each copy had its own module-level cache → parallel duplicate fetches (timestamps 15ms apart proved it) | Singletons anchored on `globalThis` in visual-bindings + client-cache. Verified: visual-bindings ×2 → ×1; /home now dup-free (only heartbeat/badge polling cadence remains) |
| F1 | Dark-hardcoded chrome (`border-white/*`, `text-gray-*`) across the header buttons + Personalize drawer — invisible borders / wrong contrast in light mode; amber banner dark-tuned | Full tokenization (`--border-subtle/strong`, `--bg-surface*`, `--text-secondary/tertiary`) + light/dark amber pair |
| F1 | Favorite-app cards leaked raw slugs ("product-data") and guessed routes | Names + routes resolved from APP_REGISTRY |
| F1 | Home page icon was "coins" | "home" |
| F2 | On 375px the header action row overflowed — "Personalize" clipped off-screen | `flex-wrap` on the action row; mobile verified clean (KPIs 2-col, action bar fine) |

## Verified
- Local production server + owner session: /home opens with **14 API calls, zero duplicates** (baseline 18 + dups).
- `inventory.warehouses` present in status payload; desktop + 375px screenshots reviewed.
- tsc + prod build green.

## Left open for the Home follow-up pass
- `/` launcher page (1,176 lines) full B1 review (hover/idle prefetch tiers, giant file split).
- B4 deep pass: operations snapshot + finance setup links E2E; RSC `_rsc` prefetch variant churn (Next TTL behavior — revisit only if bytes prove material).
- CeoDashboard/AccountantDashboard take an `exp` prop they don't use (cosmetic).
