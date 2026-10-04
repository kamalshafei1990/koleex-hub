-- =============================================================================
-- koleex_todos — RECONCILIATION of columns that exist in production without a
-- migration file (tasks phase 6, 2026-09-13; TASKS_BY_AI_PLAN §6).
--
-- Reason:  tenant_id, is_private, metadata, recurrence*, reminded_at and the
--          approval columns were applied out-of-band (2026-08/09) and the repo
--          had no record of them; a fresh database built from this folder
--          would not run the app. Verified against production's
--          information_schema on 2026-09-13; every type and default below is
--          what production has.
-- Schema:  additive only; every statement is IF NOT EXISTS, so on production
--          this file is a no-op.
-- Index:   tenant + completed for the scoped lists; remind_at partial index
--          already exists from todo_phase2_fields.sql.
-- RLS:     unchanged — koleex_todo* have no policies; the API layer is the
--          boundary (service role only), as for every other table here.
-- Rollback: on production nothing to roll back (no-op). On a fresh database,
--          DROP COLUMN each name below.
-- Load:    none at run time; the index is small and built once.
-- =============================================================================

ALTER TABLE koleex_todos
  ADD COLUMN IF NOT EXISTS is_private            boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tenant_id             uuid        NOT NULL DEFAULT '490fbd4d-f3e8-44fa-83e6-ee26f961d5ca'::uuid,
  ADD COLUMN IF NOT EXISTS metadata              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reminded_at           timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence            text,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id  uuid,
  ADD COLUMN IF NOT EXISTS recurrence_spawned_for date,
  ADD COLUMN IF NOT EXISTS recurrence_until      date,
  ADD COLUMN IF NOT EXISTS approval_state        text,
  ADD COLUMN IF NOT EXISTS approved_by_account_id uuid,
  ADD COLUMN IF NOT EXISTS approved_at           timestamptz;

CREATE INDEX IF NOT EXISTS idx_koleex_todos_tenant_open
  ON koleex_todos (tenant_id, completed);

COMMENT ON COLUMN koleex_todos.metadata IS
  'observers[], mentions[], attachments[], products[], checklist[], project, created_via — see src/types/supabase.ts TodoMetadata';
