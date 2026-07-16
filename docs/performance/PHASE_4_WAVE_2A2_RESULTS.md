# Phase 4 Wave 2A.2 — Suppliers Server-List Migration (Results)

**Status: implemented on an isolated feature branch + prepared for Preview.
Production `/suppliers` stays LEGACY. NOT merged to `main`.** Reuses the shared
Wave 2A.1 foundation; see `SUPPLIERS_SERVER_LIST_PILOT.md` (full reuse map) and
`SUPPLIERS_INTERNAL_ROLLOUT.md` (cohort + telemetry + rollback).

## What shipped to the branch
- Shared generalizations: `rollout-cohort.ts` (`makeServerListCohort` factory)
  and `rollout-gate.ts` (`shouldUseServerList`). Customers now delegates to both,
  behaviour-identical (regression tests green).
- Suppliers server endpoint: `GET /api/contacts?type=supplier&paged=1` +
  `&summary=1` via a supplier `ServerListConfig` (`configForType`), type-aware
  summary breakdown (`supplier_type`), slim projection extended with
  `supplier_type` / `company_name_en` / `company_name_cn`.
- Suppliers cohort gate + trusted `suppliersServerList` bootstrap flag (own env
  var `KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS`).
- Suppliers telemetry events (mode split + error) added to the track allowlist.
- `SuppliersServerList.tsx` adapter + `suppliers-list.ts` i18n (en/zh/ar) +
  gated `suppliers/page.tsx`. Legacy `Contacts.tsx` untouched; Customers +
  Contacts behaviour unchanged.

## Field security model
No sensitive supplier field is searchable/sortable/filterable or shown in the
list: costs, `payment_info`, bank details, `internal_notes`, ratings,
`reliability_score`, and commercial terms are all excluded from the supplier
`ServerListConfig` and the slim projection. `sanitizeContactRows` still strips
`CONTACT_PRIVATE_COLUMNS` (payment terms, credit, commission, special pricing)
unless the caller has `can_view_private`. Same tenant scope + `Suppliers` module
gate as legacy.

## Bulk-action audit + parity (close-out)
Legacy Suppliers directory has **NO multi-select / bulk actions** (no list
selection state; CSV export is customer-only; delete is single-row). Full matrix
in `SUPPLIERS_SERVER_LIST_PILOT.md` §6. Resolution: closed **per-row** parity in
the adapter — Edit + one-click Archive/Activate (`is_active` via PATCH) + Delete
(confirm → DELETE), all `requireModuleAction`-gated + tenant-scoped, invalidating
the list + summary query (no full-list refetch). The ambiguous page-only
multi-select was removed (legacy has none). Destructive/complex flows keep a
clear route via Full profile `/suppliers/[id]` + `?serverlist=0`.

## Verification done here
- `validate:suppliers-rollout` 19/19 · `validate:suppliers-gate` 10/10 ·
  **`validate:suppliers-security` 45/45** (config non-sensitivity, field
  stripping by role SA/private/restricted, param validation, approved-search
  enforcement, static guards: no legacy full-list loader, no fixed poll, tenant
  scope, module-action gates).
- Regressions: `validate:customers-rollout` 16/16 · `validate:customers-gate`
  10/10 · `validate:server-list` 28/28 · `validate:auth-equivalence` pass.
- `tsc --noEmit` clean · `next build` exit 0 (`/suppliers` + all `/api/contacts`
  routes emitted). ESLint: the 2 `set-state-in-effect` errors + 1
  `no-unused-expressions` warning are **identical to the shipped Customers files**
  (pre-existing accepted pattern; Vercel `next build` does not gate on them).

## Controlled internal cohort (read-only production analysis)
Recommended minimal cohort (primary Koleex tenant, internal, active; opaque IDs
only, no PII): sole Super Admin `f4db4511-…`, one internal Admin `4e7c27c5-…`,
one active supplier-operations employee `58eda9e0-…` (**114 `/suppliers`
visits/30d** — heaviest real user). Excluded: a test/probe SA `7fa19cc0` and
inactive/zero-usage accounts. Env value in `SUPPLIERS_INTERNAL_ROLLOUT.md`.

## Not verifiable from this environment (honest gaps)
- **Authenticated Preview validation** (role/tenant visibility, field leakage,
  cache isolation, view-as) — Vercel Preview is SSO-protected and no app
  credentials are available here. Hand-off matrix below.
- **Before/after performance percentiles / bytes / req-counts** — Vercel-log /
  Speed-Insights only; not readable here. Baseline expectation mirrors Customers:
  rows per load drop from the full supplier dataset → one 50-row page; the
  20s full-list poll is absent in server-list mode. Real numbers require a
  measured Preview/cohort window; **not fabricated**.

## Authenticated Preview validation hand-off
Run on the Preview URL with internal roles (SA, Admin, purchasing, restricted,
customer-denial, cross-tenant): confirm identical row + field visibility vs
legacy, no sensitive-field leakage, no cross-tenant rows, no unauthorized
create/edit, account-switch + logout cache isolation, and EN/ZH/AR + Arabic RTL.
Compare legacy (`?serverlist=0`) vs server (`?serverlist=1`) on the same account.

## Production rollout state (close-out)
Merged to `main` behind the same controlled model as Customers: production
`/suppliers` defaults to **legacy**; `?serverlist=1` opts in, `?serverlist=0`
forces legacy; the internal cohort is **inert** until
`KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS` is set in Vercel. Reversible (clear env /
`?serverlist=0` / revert merge). Suppliers is **functionally complete + safely
in production, legacy-default**.

Still requires an operator with Vercel access to finish the empirical loop:
(a) set the cohort env var to activate; (b) collect the sample gate; (c) pull
real before/after percentiles/bytes from Vercel logs / Speed Insights (not
reachable from the build env). Only then flip the default. **Contacts migration**
is the logical next directory (same endpoint + foundation) — gated on explicit
approval.
