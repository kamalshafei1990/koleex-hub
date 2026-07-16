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

## Verification done here
- `validate:suppliers-rollout` 19/19 · `validate:suppliers-gate` 10/10.
- Regressions: `validate:customers-rollout` 16/16 · `validate:customers-gate`
  10/10 · `validate:server-list` 28/28.
- `tsc --noEmit` clean · `next build` exit 0 (`/suppliers` + all `/api/contacts`
  routes emitted). ESLint: the 2 `set-state-in-effect` errors + 1
  `no-unused-expressions` warning are **identical to the shipped Customers files**
  (pre-existing accepted pattern; Vercel `next build` does not gate on them).

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

## Recommendation
**Revise-then-promote:** the migration is functionally complete, secure by
construction, and regression-clean, but (a) authenticated Preview validation and
(b) a real before/after measurement must pass first, and (c) destructive bulk
actions are deferred to the legacy/full-profile path. Do NOT make server-list the
Suppliers default until the sample gate + Preview matrix pass. **Contacts
migration should be considered next** (same endpoint, same foundation) once
Suppliers is validated — but only with explicit approval.
