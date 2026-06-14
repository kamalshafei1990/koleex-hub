-- =============================================================================
-- KOLEEX HUB — PRODUCTION SCHEMA BASELINE  (Stage 1.5)
-- Generated: 2026-06-14  |  Source project: yxyizbnfjrwrnmwhkvme (Koleex Master Database)
-- Status: PARTIAL BASELINE + AUTHORITATIVE-COMPLETION INSTRUCTIONS. NOT YET APPLIED.
-- -----------------------------------------------------------------------------
-- WHY THIS FILE EXISTS
--   Production was bootstrapped out-of-band (supabase/bootstrap_production.sql)
--   and 186 *incremental* migrations were tracked on top of that un-tracked
--   foundation. A fresh Supabase branch replays ONLY the tracked history, so it
--   fails at the first migration (create_crm_pipeline) — the base tables it
--   assumes do not exist. Result: branches come up empty / MIGRATIONS_FAILED.
--   This baseline captures the current production schema so branches reproduce it.
--
-- WHAT THIS FILE CONTAINS (captured with full fidelity)
--   • Extensions   • Custom schemas   • Enum types (public)   • Sequences
--
-- WHAT THIS FILE DOES *NOT* YET CONTAIN  (see the fenced block at the bottom)
--   • 310 tables (public 274, core 21, content 10, system 5)
--   • 83 functions • 115 triggers • 250 RLS policies • all constraints/indexes/grants
--   These MUST be appended from an authoritative `pg_dump --schema-only` /
--   `supabase db dump` run — hand-reconstruction at this scale is unsafe.
--
-- SAFETY: every statement below is idempotent (IF NOT EXISTS / guarded DO blocks).
--         Applying this file alone is harmless; it does NOT drop or modify data.
-- =============================================================================

-- ---------- EXTENSIONS --------------------------------------------------------
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto"  with schema extensions;
-- pg_stat_statements and supabase_vault are Supabase-managed and present on every
-- branch by default; intentionally not (re)created here.

-- ---------- CUSTOM APPLICATION SCHEMAS ----------------------------------------
create schema if not exists core;
create schema if not exists business;
create schema if not exists operations;
create schema if not exists content;
create schema if not exists system;

-- ---------- ENUM TYPES (public) -----------------------------------------------
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='doc_status') then
  create type public.doc_status as enum ('draft','sent','accepted','rejected','expired','cancelled','final'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='invoice_status') then
  create type public.invoice_status as enum ('draft','issued','paid','cancelled','sent','overdue','partial','void'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='purchase_category_kind') then
  create type public.purchase_category_kind as enum ('direct','indirect','services','capex'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='purchase_order_status') then
  create type public.purchase_order_status as enum ('draft','confirmed','partial','received','closed','cancelled'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='purchase_receipt_status') then
  create type public.purchase_receipt_status as enum ('draft','partial','complete','cancelled','posted','voided'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='purchase_req_status') then
  create type public.purchase_req_status as enum ('draft','pending','approved','rejected','converted','cancelled'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='purchase_return_status') then
  create type public.purchase_return_status as enum ('draft','sent','refunded','closed','cancelled'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='purchase_rfq_status') then
  create type public.purchase_rfq_status as enum ('draft','sent','responded','closed','cancelled'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='so_status') then
  create type public.so_status as enum ('draft','confirmed','closed','cancelled','partial','shipped'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='supplier_contract_status') then
  create type public.supplier_contract_status as enum ('draft','active','expired','terminated'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='supplier_type') then
  create type public.supplier_type as enum ('manufacturer'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='user_role') then
  create type public.user_role as enum ('admin','sales','viewer','app_user'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='vendor_bill_status') then
  create type public.vendor_bill_status as enum ('draft','posted','partial','paid','overdue','cancelled'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='visibility_tier') then
  create type public.visibility_tier as enum ('public','internal','procurement','finance','management'); end if; end $$;

-- ---------- SEQUENCES (public) ------------------------------------------------
create sequence if not exists public.sku_seq as bigint;
-- NOTE: identity/owned sequences (e.g. product_assets.id, inventory_item_code_sequences)
-- are emitted automatically by pg_dump alongside their owning tables — see below.

-- =============================================================================
-- ⛔ AUTHORITATIVE SCHEMA BODY — MUST BE GENERATED WITH pg_dump (NOT BY HAND)
-- -----------------------------------------------------------------------------
-- The full body (310 tables across public/core/content/system, 83 functions,
-- 115 triggers, 250 RLS policies, all constraints, indexes, FKs, grants) is too
-- large and risk-sensitive to hand-reconstruct. Generate it authoritatively and
-- APPEND it below this line, then remove this fence.
--
-- Option A — Supabase CLI (preferred; run from the repo root, project linked):
--   supabase db dump --schema-only \
--     --schema public --schema core --schema business \
--     --schema operations --schema content --schema system \
--     -f supabase/migrations/_pd_v2_baseline_body.sql
--   (then paste the file contents below this fence)
--
-- Option B — pg_dump directly (needs the prod DB connection string / password):
--   pg_dump "$SUPABASE_DB_URL" --schema-only --no-owner --no-privileges \
--     --schema=public --schema=core --schema=business \
--     --schema=operations --schema=content --schema=system \
--     --exclude-schema='auth' --exclude-schema='storage' --exclude-schema='vault' \
--     -f body.sql
--
-- DO NOT include: data rows, auth/storage/vault/realtime internals, secrets,
--                 storage object contents. Schema-only, app schemas only.
-- =============================================================================
