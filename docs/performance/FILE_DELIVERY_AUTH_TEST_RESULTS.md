# File Delivery — Authorization Test Results (China R3)

**Harness:** `scripts/validate-file-delivery.mjs` (npm run validate:file-delivery) — probe-account based (p0b_admin/p0b_customer), no real customer data; pass `--catalog <testId> --discuss <testMsgId>`.

## Executed from this environment (no credentials required)
| Scenario | Expected | Result |
|---|---|---|
| Unauthenticated request | 401 | **PASS (live prod)** |
| Forged category | denial | **PASS (live prod 404)** |
| Forged identifier (unauth layer) | denial | **PASS (live prod)** |
| Optimizer arbitrary-host | 400 | **PASS (live prod)** |

## BLOCKED — requires service key + probe credentials (exact reason: this agent environment holds no SUPABASE_SERVICE_ROLE_KEY and, per credential policy, cannot sign in)
Authorized 200/206 · module-denied uniform 404 · cross-org denial · removed-member denial · active-member 200 · deleted-record denial · invalid range 416 · logout/back-nav recheck · account switching · cached private-file isolation.
**These are code-enforced (reviewable in `src/app/api/files/[...ref]/route.ts`) but NOT yet executed end-to-end. Run the harness locally/CI. Per the migration gate, Discuss attachment UI migration does NOT proceed until this matrix passes.**
