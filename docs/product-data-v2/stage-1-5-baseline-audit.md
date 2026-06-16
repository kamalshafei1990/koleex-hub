# Stage 1.5 — Production Baseline Audit

**Project:** KOLEEX HUB · Supabase `yxyizbnfjrwrnmwhkvme` (Koleex Master Database, Pro plan, PG 17.6)
**Date:** 2026-06-14
**Status:** Files created. **Nothing applied. Production untouched.**
**Baseline validation (2026-06-14, read-only):** live production object counts **match the documented target exactly — 310 tables / 83 functions / 115 triggers / 250 policies / 14 enums / 5 app schemas, zero drift** (verified via read-only Supabase MCP catalog query — no mutation, no branch). The authoritative `pg_dump` body and the `MIGRATIONS_FAILED → FUNCTIONS_DEPLOYED` branch-replay proof remain **owner actions** (no CLI/link/DB-password in the agent environment; branch creation is paid/approval-gated). **Stage 2 remains BLOCKED.** Full result: [`baseline/baseline-validation-report.md`](baseline/baseline-validation-report.md).

---

## 1. Root cause (why branches come up empty)

Production has a healthy **tracked migration history of 186 migrations** (`20260412013106_create_crm_pipeline` … `20260613183038_p0c_product_rls_lockdown`). But **all 186 are *incremental*** — the first one already assumes base tables (`accounts`, `people`, `koleex_*`, etc.) exist.

Those base tables were created **out-of-band** by `supabase/bootstrap_production.sql`, which was **never registered as a tracked migration**. Supabase branching replays *only the tracked history* onto a fresh database — so the replay fails at migration #1 (its prerequisites are missing) and the branch ends in **`MIGRATIONS_FAILED` with 0 tables** (confirmed on branch `pd-v2-stage1` / `jpbbibctheatdkpmtzqs`).

**Conclusion:** the migration history is missing its foundation. Until a baseline exists, **no branch (or CI clone) can reproduce production.**

---

## 2. Production schema inventory (what the baseline must represent)

| Object class | Count | Notes |
|---|---|---|
| Schemas (app) | 5 | `public`, `core` (21 tables), `content` (10), `system` (5), `business` (0 tables, schema only) |
| Tables | **310** | public **274** + core 21 + content 10 + system 5 |
| Views / Matviews | 0 / 0 | none |
| Functions | 83 | `public` |
| Triggers | 115 | non-internal, `public` |
| RLS policies | 250 | `public`; 271/274 public tables have RLS enabled |
| Enum types | 14 | `public` (doc_status, invoice_status, 6× purchase_*, so_status, supplier_contract_status, supplier_type, user_role, vendor_bill_status, visibility_tier) |
| Sequences | `sku_seq` (+ identity-owned) | plus identity sequences emitted with their tables by pg_dump |
| Extensions | 5 | pgcrypto, uuid-ossp, pg_stat_statements, supabase_vault, plpgsql |

---

## 3. What was captured (in `20260412…`→ the baseline file)

File: `docs/product-data-v2/baseline/baseline_existing_production_schema_SCAFFOLD_DO_NOT_EXECUTE.sql` (moved out of `supabase/migrations/` so it can never be auto-executed) — captured **with full fidelity** and idempotently:

- ✅ **Extensions** (`uuid-ossp`, `pgcrypto`; Supabase-managed ones noted, not recreated)
- ✅ **Custom schemas** (`core`, `business`, `operations`, `content`, `system`)
- ✅ **All 14 public enum types** (exact label order)
- ✅ **Sequence `sku_seq`**

These are safe to apply (guarded `IF NOT EXISTS` / `DO` blocks) and create no data.

---

## 4. What was **excluded** / deferred (must come from `pg_dump`)

- ⛔ **310 table definitions** (columns, defaults, identity, generated cols)
- ⛔ **All constraints** (PK/unique/check/**FK** across schemas)
- ⛔ **All indexes** (non-constraint)
- ⛔ **83 functions** (bodies, `security definer`, `search_path`)
- ⛔ **115 triggers** (order, conditions)
- ⛔ **250 RLS policies** + per-table RLS-enable + **GRANTs** to `anon`/`authenticated`/`service_role`
- ⛔ Comments, default privileges, ownerships

**Why excluded:** a faithful reconstruction of 310 tables / 250 policies / 83 functions / cross-schema FKs / grants requires `pg_dump --schema-only`. Hand-reconstruction via SQL introspection at this scale would be *subtly* wrong (grants, security-definer, ordering, identity/sequences, enum-before-use) — and a wrong baseline is more dangerous than an obviously-incomplete one. The baseline file therefore contains a **fenced, copy-paste authoritative-completion block** instead of fabricated DDL.

**Also intentionally excluded** (per the rules and good practice): data rows; secrets; `auth` / `storage` / `vault` / `realtime` internals (Supabase-managed, present on every branch); storage bucket/object contents.

---

## 5. Known risks & unsupported objects

| Risk | Detail | Mitigation |
|---|---|---|
| **Tooling gap** | No `pg_dump`/`supabase` CLI in the build environment; direct prod connection (DB password) is disallowed by the safety rules → the authoritative body could not be generated here. | Run the fenced command from a workstation that has the CLI + DB access (you do). |
| **Squash vs foundation** | A *full-current-state* baseline conflicts with replaying the 186 incrementals (CREATE TABLE would already exist). | Choose **one** adoption strategy (see §7). |
| **GRANTs** | PostgREST needs role grants; introspection often misses them. | `pg_dump` includes them — do not hand-roll. |
| **security-definer functions / search_path** | 83 functions include hardened search_paths (see `lock_function_search_paths`). | `pg_get_functiondef` / pg_dump preserve them. |
| **Identity/owned sequences** | e.g. `product_assets.id`, `inventory_item_code_sequences`. | Emitted by pg_dump with their tables. |
| **`business` schema empty** | Schema exists with 0 tables. | Baseline creates the empty schema (harmless). |
| **Two prior baselines on disk** | `supabase/bootstrap_production.sql` (foundation) + 67 repo migration files ≠ the 186 tracked remotely. | Reconcile during adoption (§7); do not assume the repo `migrations/` folder equals remote history. |

No unsupported object *types* were found (no views/matviews/foreign tables/publications beyond Supabase defaults).

---

## 6. How to validate the baseline on a fresh branch

1. Complete the baseline body via the fenced `supabase db dump` command (§ file).
2. Create a throwaway branch and let it replay.
3. On the branch DB, assert the inventory matches production:
   ```sql
   select
     (select count(*) from pg_tables where schemaname='public')                       as public_tables,   -- expect 274
     (select count(*) from pg_tables where schemaname in ('core','content','system'))  as custom_tables,   -- expect 36
     (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as functions, -- 83
     (select count(*) from pg_policies where schemaname='public')                       as policies,        -- 250
     (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e') as enums; -- 14
   ```
4. Run the app smoke suite against the branch (products/quotations/finance read paths) and confirm no missing-relation errors.
5. Branch `MIGRATIONS_FAILED` must become `FUNCTIONS_DEPLOYED`.

---

## 7. Adoption strategy (decide before applying — two safe options)

- **A · Squash baseline (recommended).** The completed baseline = the *single* foundation migration; archive the 186 incrementals out of the active replay path (`supabase migration repair` / reset remote history to the baseline). Future branches replay just the baseline. Cleanest long-term.
- **B · Foundation baseline.** Capture only the *pre-migration* bootstrap state, place it **before** `20260412013106`, and let the 186 incrementals replay on top. Lower conceptual change, but you maintain 187 files.

Either way: **apply on a branch first, validate (§6), then repair the remote history. Never run the baseline against production** (prod already has the schema).

---

## 8. Can Stage 2 safely proceed?

**Yes — Stage 2 (Taxonomy V2) can proceed now, with one caveat.**

- Stage 2 creates **new, self-contained `pd_` tables** (like Stage 1's Code Registry). They depend on **nothing** in the legacy schema, so they apply cleanly on an empty/parallel branch and carry **zero risk** to production. ✅
- **Caveat:** the baseline is **not yet a blocker for Stage 2, but it *is* a blocker for any later stage that must be branch-tested against real production tables** — specifically **Stage 5 (SKU layer, links to `product_models`)** and beyond. Those stages require a faithful branch, which requires the **completed authoritative baseline** first.

**Recommendation:** proceed to Stage 2 on a branch as before, and **complete the authoritative baseline (this Stage 1.5) before Stage 5.**

---

## Required Manual Baseline Completion Steps

> Run these from a workstation that has the Supabase CLI / `pg_dump` and DB access.
> The temporary branch `pd-v2-stage1` (`jpbbibctheatdkpmtzqs`) was **deleted on 2026-06-14** (charge stopped).
> **Never run the dump output against production** — prod already has the schema. Validate on a clean branch only.

### Step 1 — Prerequisites & environment variables
```bash
# Install CLI (macOS)
brew install supabase/tap/supabase

# Personal access token → https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN="sbp_xxxxxxxx"
# DB password → Dashboard ▸ Project Settings ▸ Database ▸ Database password
export SUPABASE_DB_PASSWORD="<prod-db-password>"

# From the repo root (~/Desktop/Koleex HUB), link the project ONCE:
supabase link --project-ref yxyizbnfjrwrnmwhkvme
```

### Step 2 — Generate the schema body (choose ONE)

**Option A — Supabase CLI (preferred).** `supabase db dump` is **schema-only by default** (no data unless you pass `--data-only`):
```bash
supabase db dump --linked \
  --schema public --schema core --schema business \
  --schema operations --schema content --schema system \
  -f supabase/migrations/_pd_v2_baseline_body.sql
```

**Option B — `pg_dump` directly:**
```bash
export SUPABASE_DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.yxyizbnfjrwrnmwhkvme.supabase.co:5432/postgres"

pg_dump "$SUPABASE_DB_URL" \
  --schema-only --no-owner \
  --schema=public --schema=core --schema=business \
  --schema=operations --schema=content --schema=system \
  -f supabase/migrations/_pd_v2_baseline_body.sql
```
- **Where to save:** dump the body to a temp path, then assemble the **completed, executable** baseline by combining the scaffold (`docs/product-data-v2/baseline/baseline_existing_production_schema_SCAFFOLD_DO_NOT_EXECUTE.sql`) with the dumped body, and place the result as a **NEW** migration in `supabase/migrations/` (e.g. `<ts>_baseline_existing_production_schema.sql`). **The SCAFFOLD itself must NEVER be placed in `supabase/migrations/`.** If the dump re-emits the enums/schemas already in the scaffold, drop the duplicates (the guarded `DO`/`IF NOT EXISTS` blocks are idempotent, so either is safe).
- **Avoid data rows:** `--schema-only` (pg_dump) / default (CLI) — never `--data-only`.
- **Avoid secrets:** scope strictly to the 6 app schemas (above) — this excludes `auth`, `storage`, `vault`, `realtime`. `--no-owner` avoids `supabase_admin` ownership noise. Keep privileges (do **not** add `--no-privileges`) so RLS GRANTs reproduce. The DB password lives only in the env var, never in the file.

### Step 3 — Verify the dump (before applying anywhere)
```bash
F=supabase/migrations/_pd_v2_baseline_body.sql
echo "data rows (must be 0): $(grep -cE '^(COPY|INSERT)' "$F")"
echo "tables:    $(grep -cE '^CREATE TABLE' "$F")"               # ~310
echo "functions: $(grep -ciE '^CREATE (OR REPLACE )?FUNCTION' "$F")"   # ~83
echo "triggers:  $(grep -ciE 'CREATE TRIGGER' "$F")"             # ~115
echo "policies:  $(grep -ciE 'CREATE POLICY' "$F")"              # ~250
echo "enums:     $(grep -ciE 'CREATE TYPE .* AS ENUM' "$F")"     # ~14
echo "schemas:   $(grep -ciE '^CREATE SCHEMA' "$F")"             # 5 custom
# secret scan — hits should be column/policy NAMES only, never literal key/secret values:
grep -niE 'vault|service_role_key|anon_key|secret|jwt|password' "$F" | head
```

### Step 4 — Create a clean validation branch & validate

**Local (fast, free — do this first):**
```bash
supabase start            # local Postgres + Studio
supabase db reset         # replays ALL migrations incl. the baseline onto a fresh local DB
# then run the count SQL below against the local DB (psql "$(supabase status -o env | grep DB_URL)")
```

**Cloud preview branch (after committing the baseline + squash-repairing remote history):**
```bash
supabase branches create pd-v2-validate --project-ref yxyizbnfjrwrnmwhkvme
supabase branches get    pd-v2-validate     # wait for status = FUNCTIONS_DEPLOYED
# run the count SQL against the branch DB, then:
supabase branches delete pd-v2-validate
```

**Validation SQL (run on the branch / local DB):**
```sql
select
  (select count(*) from pg_tables where schemaname='public')                                   as public_tables,
  (select count(*) from pg_tables where schemaname in ('core','business','operations','content','system')) as custom_tables,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')     as functions,
  (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and not t.tgisinternal)                                          as triggers,
  (select count(*) from pg_policies where schemaname='public')                                 as policies,
  (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e') as enums;
```

### Step 5 — Acceptance targets (must match production)
| Object | Expected |
|---|---|
| public tables | 274 |
| custom-schema tables | 36 (core 21 + content 10 + system 5) |
| **total tables** | **310** |
| functions (public) | **83** |
| triggers (public) | **115** |
| RLS policies (public) | **250** |
| enums (public) | **14** |
| app schemas | **5 custom** (core, business, operations, content, system) + `public` = 6 total |
| data rows in dump | **0** |
| secret values in dump | **0** |
| branch status | `FUNCTIONS_DEPLOYED` (not `MIGRATIONS_FAILED`) |

### Step 5b — Live data snapshot (2026-06-17, read-only — informational)
Captured via Supabase MCP (read-only) as a reference point for the **data-population** baseline (distinct from the schema-object counts above, which are structure-only). These are live row counts the V2 build will inherit:

| Table | Live rows | Note |
|---|---|---|
| `divisions` | 9 | real taxonomy |
| `categories` | 73 | real taxonomy |
| `subcategories` | 359 | real taxonomy (Garment Machinery = 77) |
| `products` | 716 | live catalogue |
| `classification_icons` | 429 | hub backfill (cat+sub icons; divisions on code) |
| `visual_icon_categories` | 0 | custom icon categories — none yet |
| `visual_assets` | 5,061 | Visual Library icon pool |

> These are **not** acceptance targets for the schema dump (which must contain 0 data rows). They document the production data reality so the CL-0012 classification/coding additions can be planned against the true taxonomy size when V2 unfreezes. **Blocker reminder:** completing the schema dump (Steps 1–4) requires the Supabase CLI link + DB password — an **owner-only manual step** (credentials must not be entered by the assistant). Until that runs and validates, Stage 2 / PD-V2 stays BLOCKED and the CL-0012 prefixes stay documented-but-unfrozen.

### Step 6 — Adopt (after validation passes)
Squash (recommended): make the completed baseline the single foundation migration and `supabase migration repair` the remote history so future branches replay only the baseline. Then Stage 5+ can be branch-tested faithfully.

---

## Files created / updated
- `docs/product-data-v2/baseline/baseline_existing_production_schema_SCAFFOLD_DO_NOT_EXECUTE.sql` (scaffold + fenced completion block — **moved out of `supabase/migrations/` so CI/CLI cannot execute it**)
- `docs/product-data-v2/baseline/baseline-validation-report.md` (**new, 2026-06-14** — read-only count validation: all 8 acceptance counts match, zero drift; dump + branch-replay remain owner actions; Stage 2 stays BLOCKED)
- `docs/product-data-v2/stage-1-5-baseline-audit.md` (this file; **updated** with "Required Manual Baseline Completion Steps" + the 2026-06-14 read-only validation result)
- Temporary branch `pd-v2-stage1` (`jpbbibctheatdkpmtzqs`) — **deleted 2026-06-14**.
