# Suppliers Server-List — Controlled Internal Cohort Rollout (Wave 2A.2)

Same trusted, server-resolved cohort model as Customers, with its **own**
env var so the two rollouts are fully independent. Ships to production **inert** —
no behaviour changes until the cohort env var is configured.

## Cohort mechanism
- **Env allowlist** `KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS` — opaque account
  UUIDs, comma / whitespace / newline separated. **Never** reuses the Customers
  variable. Resolved server-side by `makeServerListCohort(...)`
  (`src/lib/server/rollout-cohort.ts`) via
  `isInSuppliersServerListCohort` (`src/lib/server/suppliers-rollout.ts`), and
  surfaced as the trusted boolean `suppliersServerList` in `/api/me/bootstrap`,
  keyed on the **real logged-in account** (not a view-as target).
- Safety (shared factory): empty/malformed env → nobody in cohort;
  **customer/member accounts excluded even if listed**; exact match only (no
  prefix/substring); IDs never logged.

## Precedence (highest first) — `src/lib/server-list/rollout-gate.ts`
1. `?serverlist=0` → **legacy** (escape hatch).
2. `?serverlist=1` → **server-list** (explicit opt-in).
3. **cohort flag** (trusted, from bootstrap) → **server-list**.
4. Non-production host (Vercel Preview) → server-list (testing).
5. Everyone else (production) → **legacy** (default).

`inCohort` comes **only** from the server-resolved bootstrap flag. The
`?serverlist` params choose which UI renders; the API always enforces auth /
module permission / tenant scope / RLS / column policy regardless.

## Recommended initial cohort (read-only production analysis, opaque IDs only)
Primary Koleex tenant, internal + active accounts, ranked by real `/suppliers`
usage (no names/emails/PII):

| Opaque account ID | Role label | Active | Internal | `/suppliers` visits 30d | Recommend | Reason |
|---|---|---|---|---|---|---|
| `f4db4511-35c0-4bcb-84de-94699e2781a9` | Super Admin | yes | yes | 47 | **YES** | sole real SA |
| `4e7c27c5-fdf6-48e3-aa2a-38a542d13237` | Admin | yes | yes | 0 | **YES** | internal Admin slot |
| `58eda9e0-4039-4790-bb9a-2486c8e0197c` | Data Entry | yes | yes | **114** | **YES** | active supplier-ops employee (heaviest user) |
| `7fa19cc0-9dbb-4e91-8344-8216e78645d1` | (SA flag, no role) | yes | yes | 0 | NO | test/probe, no real usage |
| others (`f0d7f0cc`, `ff7e4d48`, `1dde803c`) | — | mixed | yes | 0 | NO | inactive / zero usage |

**Exact env value:**
```
KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS=f4db4511-35c0-4bcb-84de-94699e2781a9,4e7c27c5-fdf6-48e3-aa2a-38a542d13237,58eda9e0-4039-4790-bb9a-2486c8e0197c
```

## To activate
Set `KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS` in Vercel (Production) to the value
above and redeploy. Until then the cohort is empty and everyone stays on legacy
(`?serverlist=1` still works for ad-hoc internal testing). **Excluded by
default:** customer/member, unknown types, disabled, external, other tenants,
test/probe accounts. No names/emails/IDs are stored in source.

## Telemetry (in-DB, privacy-safe)
Recorded via the existing `activity_events` system (added to the track
allowlist): `suppliers_server_list_open` / `suppliers_legacy_list_open` (one per
`/suppliers` route session) and `suppliers_server_list_error` (one per session on
a list-load failure). **Only** the event name (which encodes the mode) + route
are stored — no supplier data, search text, costs, bank info, contact details,
commercial terms, names, or raw IDs, and no per-keystroke/per-row events. Query
`activity_events` grouped by `event_type` for the mode split + error count. Full
performance percentiles/bytes/latency remain the Vercel-log / Speed-Insights
source.

## Sample-size gate (decision threshold)
Report sample counts beside every percentile; treat P95/P99 as unreliable with
small n. Minimum suggested decision sample from the cohort:
≥ **30** server-list route sessions · ≥ **50** paged-list responses · ≥ **20**
searches · ≥ **10** create/edit ops.

## Rollback (no code change)
- **Immediate:** clear/trim `KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS` in Vercel +
  redeploy → entire cohort returns to legacy.
- Per-user escape hatch: `?serverlist=0`.
- Full revert: the gate + endpoint changes are additive; revert the merge.
Trigger on: tenant-isolation/security issue, repeated create/edit failure,
significant 5xx increase, stale/missing rows, incorrect summaries, cache
leakage, or severe search regression.

## Criteria to make server-list the Suppliers default
All true: sample gate met; P50/P75/P95 not worse than legacy (with n);
4xx/5xx and create/edit error rates at/below legacy; no cache/tenant/permission
issue; no duplicate or legacy-alongside-paged requests; background req/min ≤
legacy; Arabic RTL + i18n confirmed; bulk-action parity resolved; and explicit
approval. Then flip gate rule 5 (or widen the cohort) — a one-line change.

## Security invariants (unchanged by the rollout)
Rollout mode changes only which UI renders — never rows accessible, columns,
actions, tenant/branch/owner scope, field-level restrictions, RLS, module
permissions, account type, or role separation. Verified: paged + summary
`.eq("tenant_id", auth.tenant_id)`; `requireModuleAccess(auth,"Suppliers")`;
`sanitizeContactRows`; slim non-sensitive projection; separate summary aggregate;
no legacy `fetchContactsByType` alongside paged; no 20s poll in server-list mode;
cache key scoped by tenant+account.

## Telemetry status
In `activity_events` (via `/api/activity/track` allowlist):
`suppliers_server_list_open` / `suppliers_legacy_list_open` (one per `/suppliers`
route session) + `suppliers_server_list_error` (per session on list failure).
Only the event name (encodes the mode) + route stored — no supplier data, search
terms, costs, bank info, contact details, commercial terms, or IDs. Query grouped
by `event_type` for the mode split + error count. Server timing: the read path
(`contacts.list` `[kx-server-timing]`) covers paged-list / summary / search /
pagination (same route, staged marks). Create/update/delete run through
POST/PATCH/DELETE `/api/contacts[/id]` — captured by Vercel's function-duration
logs (not a named `[kx-server-timing]` span). Full percentiles/bytes remain the
Vercel-log / Speed-Insights source (not reachable from the build env).

## Monitoring gate (minimum production cohort sample)
≥ **30** server-list route sessions · ≥ **50** paged responses · ≥ **20**
searches · ≥ **10** create/edit ops · bulk-action samples N/A (no bulk actions
exist). Report n beside every percentile; P95/P99 unreliable at very low n. If
Vercel logs are unavailable, use `activity_events` for session/error counts and
flag the latency/bytes metrics as pending an operator with Vercel access.

## Tests
`validate:suppliers-rollout` (19 — env parse, exact-match, empty/malformed,
customer exclusion, null account, **independence from the Customers cohort**).
`validate:suppliers-gate` (10 — full precedence + shared-decision parity).
`validate:suppliers-security` (45 — config non-sensitivity, per-role field
stripping, param validation, approved-search enforcement, static guards for
no-legacy-loader / no-poll / tenant scope / module-action gates).
Customers regressions unchanged: `validate:customers-rollout` 16,
`validate:customers-gate` 10, `validate:server-list` 28.
