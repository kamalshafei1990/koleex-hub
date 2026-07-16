# Customers Server-List — Controlled Internal Cohort Rollout (Wave 2A.1)

Replaces the passive `?serverlist=1`-only rollout with a trusted, server-resolved
internal cohort so real production usage can accrue without enabling the new UI
for everyone. Ships to production **inert** — no behaviour changes until the
cohort env var is configured.

## Cohort mechanism
- **Env allowlist** `KX_CUSTOMERS_SERVER_LIST_ACCOUNT_IDS` — opaque account UUIDs,
  comma / whitespace / newline separated. Chosen because it matches the repo's
  existing `KX_*` env-flag pattern, is server-only (no browser trust), holds no
  personal data in source, and needs no schema change. (No existing feature-flag
  platform exists in the repo; account preferences are user-writable and thus
  unsafe for a rollout flag.)
- Resolved server-side in `src/lib/server/customers-rollout.ts`
  (`isInCustomersServerListCohort`) and surfaced as the trusted boolean
  `customersServerList` in `/api/me/bootstrap`, keyed on the **real logged-in
  account** (not a view-as target). Empty/malformed env → nobody in cohort;
  **customer/member accounts are excluded even if listed**; IDs are never logged.

## Precedence (highest first) — `src/lib/server-list/customers-gate.ts`
1. `?serverlist=0` → **legacy** (explicit opt-out / escape hatch).
2. `?serverlist=1` → **server-list** (explicit opt-in).
3. **cohort flag** (trusted, from bootstrap) → **server-list** (default for internal cohort).
4. Non-production host (Vercel Preview) → server-list (testing).
5. Everyone else (production) → **legacy** (default).

The `?serverlist` params only choose which UI renders; the API always enforces
auth / module permission / tenant scope / RLS / column policy regardless.
`inCohort` comes **only** from the server-resolved bootstrap flag — never from
client-supplied identity.

## Accounts included (no personal data here)
The cohort is defined entirely by the env var, which the operator (Kamal) sets in
the Vercel Production environment. **Recommended initial cohort:** a small set of
internal Super-Admin / Admin / employee account IDs. **Excluded by default:**
customer/member, unknown types, disabled, external, other tenants. No names,
emails, or IDs are stored in source or docs.

**To activate:** set `KX_CUSTOMERS_SERVER_LIST_ACCOUNT_IDS` in Vercel (Production)
to the chosen internal account UUIDs (comma-separated) and redeploy. Until then
the cohort is empty and everyone stays on legacy (`?serverlist=1` still works for
ad-hoc testing).

## Telemetry (in-DB, privacy-safe)
Because Vercel logs are not reachable from the build environment, mode usage is
recorded via the existing `activity_events` system (added to the track
allowlist): `customers_server_list_open` / `customers_legacy_list_open` (one per
`/customers` route session) and `customers_server_list_error` (one per session on
a list-load failure). **Only** the event name (which encodes the mode) + route
are stored — no customer data, search text, email, name, IDs, or values, and no
per-keystroke/per-row events. Query `activity_events` grouped by `event_type` to
get the mode split + error count. Full performance percentiles/bytes/latency
remain the authoritative Vercel-log/Speed-Insights source.

## Sample-size gate (decision threshold)
Report sample counts beside every percentile; treat P95/P99 as unreliable with
small n. Minimum suggested decision sample from the cohort:
≥ **30** server-list route sessions · ≥ **50** paged-list responses · ≥ **20**
searches · ≥ **10** create/edit ops. At ~5 `/customers` visits/day overall, this
needs weeks unless internal cohort usage is deliberately driven.

## Rollback (no code change)
- **Immediate:** remove account IDs from `KX_CUSTOMERS_SERVER_LIST_ACCOUNT_IDS`
  (or clear it) in Vercel + redeploy config → entire cohort returns to legacy.
- Per-user escape hatch: `?serverlist=0`.
- Full revert: the gate + endpoint are additive; revert the merge if needed.
Trigger a rollback on: tenant-isolation/security issue, repeated create/edit
failure, significant 5xx increase, stale/missing rows, incorrect summaries,
cache leakage, or severe search regression.

## Criteria to make server-list the global Customers default
All true: sample gate met; P50/P75/P95 not worse than legacy (with n); 4xx/5xx
and create/edit error rates at/below legacy; no cache/tenant/permission issue;
no duplicate or legacy-alongside-paged requests; background req/min ≤ legacy;
Arabic RTL + i18n confirmed; and explicit approval. Then flip gate rule 5 (or
widen the cohort) — a one-line change.

## Security invariants (unchanged by the rollout)
Rollout mode changes only which UI renders — never rows accessible, columns,
actions, tenant/branch/owner scope, field-level restrictions, RLS, module
permissions, account type, or Super-Admin/Admin/employee/customer separation.
Verified: paged + summary `.eq("tenant_id", auth.tenant_id)`; `sanitizeContactRows`;
slim non-sensitive projection; separate summary aggregate; no `fetchContactsByType`
alongside paged; no 20s poll in server-list mode; cache key scoped by
tenant+account.

## Tests
`validate:customers-rollout` (16) — env parse, exact-match, empty/malformed,
customer exclusion, null account. `validate:customers-gate` (10) — full
precedence. Both assert decisions use trusted server context, not client
identity. Plus `validate:auth-equivalence` (13) for per-role auth-context.
