# Product Data V2 — Baseline Validation Report

**Project:** KOLEEX HUB · Supabase `yxyizbnfjrwrnmwhkvme` (Koleex Master Database, Pro plan, PG 17)
**Date:** 2026-06-14
**Scope:** Baseline validation only. **No production mutations. No migrations applied. No branch created. No application code changed. Stage 2 NOT started.**
**Verdict:** Live-schema object-count validation **PASSED (zero drift)**. End-to-end baseline (schema dump → branch replay) **NOT COMPLETED** — blocked on environment tooling + an approval/cost-gated branch. **Product Data V2 Stage 2 remains BLOCKED.**

---

## 1. Baseline generation method

The authoritative baseline body (`pg_dump --schema-only`) **could not be generated in this environment** — see §6 blockers. Instead, baseline validation was performed by a **read-only catalog inspection of live production via the Supabase MCP** (`execute_sql`, `list_migrations`, `list_branches`). This is non-mutating and returns metadata only (no data rows, no secrets). It confirms the live schema still matches the documented baseline target exactly, but it does **not** substitute for the dump-and-replay gate (that proves a fresh branch reproduces production without `MIGRATIONS_FAILED`).

What this report establishes:
- ✅ The live production schema shape **exactly matches** the documented baseline expectation (§4) — so the eventual dump has a verified target and there is **no drift** since the 2026-06-14 audit.
- ✅ The root cause is **still current**: 186 tracked migrations, all incremental, **no tracked foundation migration** (§3).
- ⛔ The dump body, the validation branch, and the `MIGRATIONS_FAILED → FUNCTIONS_DEPLOYED` proof are **still pending** an environment-owner action (§6–§7).

## 2. Commands used (all read-only)

```text
# local environment probe (read-only)
command -v supabase            # → NOT INSTALLED
ls supabase/config.toml        # → absent (project not linked)
env: SUPABASE_ACCESS_TOKEN / SUPABASE_DB_PASSWORD / DATABASE_URL … → all unset
npx --no-install supabase      # → unavailable (not a project dependency)

# live read-only validation (Supabase MCP, project yxyizbnfjrwrnmwhkvme)
execute_sql:   <object-count query, see §4>      # read-only SELECT over pg_catalog / information_schema
list_migrations                                   # 186 tracked migrations
list_branches                                     # only "main" (no preview branch; no cost incurred)
```

No `pg_dump`, no `supabase db dump`, no `supabase branches create`, no `apply_migration`, no writes were run.

## 3. Root cause (confirmed still current)

Production has **186 tracked, fully-incremental migrations** — first `20260412013106_create_crm_pipeline`, last `20260613183038_p0c_product_rls_lockdown` (unchanged since the 2026-06-14 audit). The first migration already assumes base tables (`accounts`, `people`, `koleex_*`, …) exist; those were created out-of-band by `supabase/bootstrap_production.sql`, which was **never registered as a tracked migration**. Branch/CI replay runs only the tracked history, so it fails at migration #1 → `MIGRATIONS_FAILED` with 0 tables (previously confirmed on the now-deleted branch `pd-v2-stage1`/`jpbbibctheatdkpmtzqs`). **A schema baseline is still required before any branch can reproduce production.**

## 4. Object-count comparison (live production, read-only)

| Object | Expected (task + audit) | Actual (live) | Match |
|---|---|---|---|
| public tables | 274 | **274** | ✅ |
| custom-schema tables | 36 | **36** | ✅ |
| &nbsp;&nbsp;· core | 21 | 21 | ✅ |
| &nbsp;&nbsp;· content | 10 | 10 | ✅ |
| &nbsp;&nbsp;· system | 5 | 5 | ✅ |
| &nbsp;&nbsp;· business | 0 (schema only) | 0 | ✅ |
| &nbsp;&nbsp;· operations | 0 (schema only) | 0 | ✅ |
| **total tables** | **310** | **310** | ✅ |
| functions (public) | 83 | **83** | ✅ |
| triggers (public, non-internal) | 115 | **115** | ✅ |
| RLS policies (public) | 250 | **250** | ✅ |
| enum types (public) | 14 | **14** | ✅ |
| app schemas (core, business, operations, content, system) | 5 | **5** | ✅ |

**All 8 acceptance counts match exactly. Zero drift.** (`business` and `operations` exist as schemas with 0 tables, exactly as documented.)

## 5. Missing objects / warnings

- **No missing objects** at the count level — every expected object class matches.
- **Warning (expected):** counts validate the *live schema shape*, not that a *dumped baseline replays cleanly*. The real gate (a fresh branch reaching `FUNCTIONS_DEPLOYED`) is unproven until the dump + branch steps run (§6–§7).
- **Note:** `business` (0 tables) and `operations` (0 tables) are schema-only; the baseline must still `CREATE SCHEMA` them (the scaffold already does).

## 6. Why baseline validation could not be completed here (blockers)

| # | Blocker | Detail | Owner action |
|---|---|---|---|
| 1 | **No Supabase CLI** | not installed, not a project dependency, `npx --no-install supabase` fails | install CLI |
| 2 | **No project link** | `supabase/config.toml` absent | `supabase link --project-ref yxyizbnfjrwrnmwhkvme` |
| 3 | **No credentials** | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `DATABASE_URL` all unset; entering a prod DB password is disallowed by the safety rules | provide token + DB password in the owner's shell |
| 4 | **Branch creation is paid / approval-gated** | per the KOLEEX autonomy policy, creating a Supabase preview branch incurs cost → **STOP-and-report** boundary. No branch was created; `list_branches` shows only `main`. | explicit approval to create `pd-v2-validate` |

Because of #1–#3 the **schema dump cannot be produced in this environment**, and because of #4 the **branch replay cannot be validated automatically**.

## 7. Branch status

- **No validation branch created** (paid/approval-gated — hard boundary, stopped as required).
- Current branches: **`main` only** (`FUNCTIONS_DEPLOYED`, healthy). No orphaned preview branch; **no cost incurred** by this task.
- The `MIGRATIONS_FAILED → FUNCTIONS_DEPLOYED` proof is therefore **still outstanding**.

## 8. Exact manual completion commands (environment owner)

> Run from a workstation with the Supabase CLI + prod DB access. Full detail is in
> `../stage-1-5-baseline-audit.md` (§ "Required Manual Baseline Completion Steps"). Summary:

```bash
# 1. Tooling + auth
brew install supabase/tap/supabase
export SUPABASE_ACCESS_TOKEN="sbp_…"
export SUPABASE_DB_PASSWORD="<prod-db-password>"
supabase link --project-ref yxyizbnfjrwrnmwhkvme

# 2. Schema-only dump of the 6 app schemas (NO data; keep privileges for RLS grants)
supabase db dump --linked \
  --schema public --schema core --schema business \
  --schema operations --schema content --schema system \
  -f /tmp/_pd_v2_baseline_body.sql

# 3. Verify the dump before applying anywhere
F=/tmp/_pd_v2_baseline_body.sql
grep -cE '^(COPY|INSERT)' "$F"     # MUST be 0 (no data rows)
grep -cE '^CREATE TABLE' "$F"      # ~310
grep -ciE '^CREATE (OR REPLACE )?FUNCTION' "$F"   # ~83
grep -ciE 'CREATE TRIGGER' "$F"    # ~115
grep -ciE 'CREATE POLICY' "$F"     # ~250
grep -ciE 'CREATE TYPE .* AS ENUM' "$F"           # ~14
grep -niE 'service_role_key|anon_key|secret|jwt|password' "$F" | head   # names only, no literal secrets

# 4. Validate on a FREE local replay first (preferred — no cost)
supabase start && supabase db reset   # replays migrations incl. the assembled baseline
#    run the §4 count SQL against the local DB and confirm 310 / 83 / 115 / 250 / 14 / 5

# 5. (Optional, PAID — requires Kamal's approval) cloud preview branch
supabase branches create pd-v2-validate --project-ref yxyizbnfjrwrnmwhkvme
supabase branches get    pd-v2-validate    # status must reach FUNCTIONS_DEPLOYED (not MIGRATIONS_FAILED)
supabase branches delete pd-v2-validate    # stop the charge
```

Assemble the executable baseline by combining the scaffold (`baseline_existing_production_schema_SCAFFOLD_DO_NOT_EXECUTE.sql`) with the dumped body and placing the result as a **new** migration in `supabase/migrations/` (never the scaffold itself). Then adopt via the squash strategy (audit §7).

## 9. Stage 2 status

**BLOCKED — not started.** Per the task rules and the KOLEEX autonomy policy (stage execution beyond the approved Stage 1 requires approval), no Stage 2 design, migration, or code was created or run. Baseline validation is **not fully PASSED** (the dump + branch-replay proof is outstanding), so Stage 2 is **not yet eligible for auto-progression**. The live-schema count validation passing is a prerequisite milestone met, not the full gate.

## 10. Recommended next action

1. **Owner runs §8 steps 1–4 (free local replay)** — generate the dump, verify 0 data rows / 0 secrets + the §4 counts, and confirm `supabase db reset` replays cleanly with the assembled baseline. This clears blockers #1–#3 at zero cost.
2. If local replay is green, **decide whether to spend on a cloud preview branch** (§8 step 5) for a production-fidelity `FUNCTIONS_DEPLOYED` confirmation, or accept the local replay as sufficient.
3. On a green replay, mark **Baseline Validation = PASSED** and report **Stage 2 eligible for approval** — but **do not auto-start Stage 2** (still an explicit approval boundary).

---

### Validation (this task)
- ✅ No production mutations (read-only catalog queries only).
- ✅ No migrations applied to production.
- ✅ No application/runtime code changed.
- ✅ No Product Data V2 implementation/stage changes; Stage 2 not started.
- ✅ No branch created (paid/gated boundary respected); no cost incurred.
