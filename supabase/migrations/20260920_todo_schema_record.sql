-- To-do hygiene — two pieces of live schema put on record.
--
-- uq_koleex_todos_recurrence_instance: the recurrence engine
-- (lib/server/todo-recurrence.ts) relies on this partial unique index for
-- idempotent spawning — a second cron tick for the same period must fail
-- with 23505 rather than insert a duplicate. The index exists on production
-- and no migration ever declared it; a database built from this folder
-- would double-spawn under concurrent ticks.
--
-- koleex_todo_labels.tenant_id: /api/todo-labels filters and inserts by
-- tenant, and production has the column and its index; create_todo_tables.sql
-- predates multi-tenancy and does not.
--
-- Idempotent: on production this file changes nothing.
CREATE UNIQUE INDEX IF NOT EXISTS uq_koleex_todos_recurrence_instance
  ON koleex_todos (recurrence_parent_id, recurrence_spawned_for)
  WHERE recurrence_parent_id IS NOT NULL AND recurrence_spawned_for IS NOT NULL;

ALTER TABLE koleex_todo_labels ADD COLUMN IF NOT EXISTS tenant_id uuid;
CREATE INDEX IF NOT EXISTS idx_todo_labels_tenant ON koleex_todo_labels (tenant_id);
