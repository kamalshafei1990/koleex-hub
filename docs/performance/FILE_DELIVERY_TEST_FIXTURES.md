# File-Delivery Test Fixtures (created + removed 2026-07-15)

Controlled, temporary, `KX_FILE_TEST_*` / `kx_file_test_*` naming. All removed after the run; a clean-check confirmed **0** leftover catalogs / messages / channels / accounts.

| Fixture | Purpose | Cleanup |
|---|---|---|
| p0b_admin / p0b_customer password → reversible legacy value | sign in via the real endpoint | **restored to original argon2id hashes** (verified: test password now 401) |
| Catalog `KX_FILE_TEST_OWN_*` (probe tenant) | authorized 200 + Range 206 | deleted |
| Catalog `KX_FILE_TEST_FOREIGN_*` (other tenant) | cross-org 404 regression | deleted |
| Discuss channel `KX_FILE_TEST_*` + p0b_admin member | member-authorized 200 | deleted |
| Message `KX_FILE_TEST attachment` | active-member attachment | deleted |
| Message `KX_FILE_TEST deleted` (deleted_at set) | deleted-attachment 404 | deleted |

Notes: an Org-B *account* was intentionally NOT created (a foreign-tenant *catalog* fetched by the existing probe SA proves the same isolation without minting a privileged test account — the `accounts_identity_per_type` constraint would also require a linked person). Range fixtures reused an existing non-sensitive supplier-catalog PDF object read-only (no fresh binary could be uploaded from this environment) — documented limitation; only status codes + byte lengths + magic bytes were inspected. To reproduce: `node scripts/validate-file-delivery.mjs --catalog <own> --foreign <foreignTenant> --discuss <memberMsg>` with `SUPABASE_SERVICE_ROLE_KEY` in env.
