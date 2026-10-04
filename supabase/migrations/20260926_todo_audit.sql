-- =============================================================================
-- To-do audit (2026-09-26) — indexes for the hot paths, two vocabulary CHECKs,
-- per-tenant label names, and (deferred) a private attachments bucket.
--
-- Reason:  every query the To-do server runs was read against the indexes on
--          record (create_todo_tables.sql, todo_phase2_fields.sql,
--          todo_columns_reconcile_2026_09.sql, 20260920_todo_schema_record.sql):
--            · GET /api/todos orders a tenant's tasks by created_at and ORs
--              creator / assigner / department / everyone / id-list — only
--              created_by had an index;
--            · sharedTodoIds() asks `metadata @> {observers:[{account_id}]}`
--              — a sequential scan of every task's jsonb on every list load;
--            · the recurrence engine scans `recurrence IS NOT NULL` every
--              5 minutes;
--            · the reminder cron now asks "never reminded, time reached" and
--              the escalation "overdue, delegated, not yet escalated";
--            · notes are read per task ordered by created_at.
-- Schema:  additive; every statement is IF NOT EXISTS / guarded, so running
--          it twice changes nothing.
-- RLS:     unchanged — koleex_todo* have no policies; the API layer is the
--          boundary (service role only).
-- Rollback: DROP INDEX IF EXISTS each index below; ALTER TABLE koleex_todos
--          DROP CONSTRAINT IF EXISTS koleex_todos_recurrence_check /
--          koleex_todos_approval_state_check; for labels, DROP INDEX
--          uq_koleex_todo_labels_tenant_name and re-add
--          UNIQUE (name) as koleex_todo_labels_name_key.
-- Load:    plain CREATE INDEX (not CONCURRENTLY, so the file can run inside
--          the migration transaction); the To-do tables are small (thousands
--          of rows), each build takes well under a second. The CHECKs are
--          NOT VALID: they bind new writes immediately and do not scan
--          existing rows.
-- =============================================================================

-- ── 1. The list: a tenant's tasks, newest first (GET /api/todos, paging) ──
CREATE INDEX IF NOT EXISTS idx_koleex_todos_tenant_created
  ON koleex_todos (tenant_id, created_at DESC, id DESC);

-- ── 2. The scope's OR branches (lib/server/todo-scope-rule.ts) ──
-- created_by_account_id already has idx_todos_created_by.
CREATE INDEX IF NOT EXISTS idx_koleex_todos_assigned_by
  ON koleex_todos (assigned_by_account_id)
  WHERE assigned_by_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_koleex_todos_department
  ON koleex_todos (tenant_id, assigned_department)
  WHERE assigned_department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_koleex_todos_assign_to_all
  ON koleex_todos (tenant_id)
  WHERE assign_to_all;

-- ── 3. Observers: `metadata @> '{"observers":[{"account_id":…}]}'` ──
CREATE INDEX IF NOT EXISTS idx_koleex_todos_metadata_path
  ON koleex_todos USING gin (metadata jsonb_path_ops);

-- ── 4. Recurring templates, scanned by the cron every 5 minutes ──
CREATE INDEX IF NOT EXISTS idx_koleex_todos_recurrence_templates
  ON koleex_todos (id)
  WHERE recurrence IS NOT NULL;

-- ── 5. Reminders never yet fired (the cron's first question) ──
-- The rescheduled-reminder question is served by idx_koleex_todos_remind_at.
CREATE INDEX IF NOT EXISTS idx_koleex_todos_remind_unsent
  ON koleex_todos (remind_at)
  WHERE remind_at IS NOT NULL AND completed = false AND reminded_at IS NULL;

-- ── 6. Overdue delegated tasks not yet escalated (todo-escalation.ts) ──
CREATE INDEX IF NOT EXISTS idx_koleex_todos_escalation_due
  ON koleex_todos (due_date)
  WHERE completed = false
    AND due_date IS NOT NULL
    AND assigned_by_account_id IS NOT NULL
    AND (metadata ->> '__overdue_escalated_on') IS NULL;

-- ── 7. Notes per task, oldest first ──
CREATE INDEX IF NOT EXISTS idx_koleex_todo_notes_todo_created
  ON koleex_todo_notes (todo_id, created_at);

-- ── 8. Vocabulary CHECKs for the two columns added out-of-band as plain
--       text (status and priority already have theirs). The routes and the
--       AI tools validate against lib/todo-enums.ts; this is the backstop. ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'koleex_todos_recurrence_check') THEN
    ALTER TABLE koleex_todos
      ADD CONSTRAINT koleex_todos_recurrence_check
      CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly', 'monthly')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'koleex_todos_approval_state_check') THEN
    ALTER TABLE koleex_todos
      ADD CONSTRAINT koleex_todos_approval_state_check
      CHECK (approval_state IS NULL OR approval_state IN ('pending', 'approved', 'rejected')) NOT VALID;
  END IF;
END $$;

-- ── 9. Label names are unique PER TENANT, not across the whole platform.
--       create_todo_tables.sql made `name` globally UNIQUE before
--       multi-tenancy, so a second tenant could not create "Sales".
--       POST /api/todo-labels answers 409 on a duplicate either way. ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_koleex_todo_labels_tenant_name') THEN
    CREATE UNIQUE INDEX uq_koleex_todo_labels_tenant_name
      ON koleex_todo_labels (tenant_id, name);
    ALTER TABLE koleex_todo_labels DROP CONSTRAINT IF EXISTS koleex_todo_labels_name_key;
  END IF;
END $$;

-- ── 10. DEFERRED — make the attachments bucket private. ──
-- New uploads already store the session-gated link /api/todos/attachment?path=…
-- (it signs a short-lived URL), which works whether the bucket is public or
-- private. Attachments saved BEFORE 2026-09-26 store the bucket's public URL
-- in koleex_todos.metadata.attachments[].url; flip the bucket only after the
-- client renders every attachment through /api/todos/attachment?path=<path>
-- (the `path` is stored on every attachment). Then run:
--
--   UPDATE storage.buckets SET public = false WHERE id = 'todo-attachments';
