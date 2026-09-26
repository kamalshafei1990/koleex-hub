-- =============================================================================
-- To-do follow-ups (2026-09-27) — the index behind the lazy "Completed" list.
--
-- Reason:  GET /api/todos?status=completed pages a tenant's completed tasks
--          newest-completion-first (?before=<completed_at>), and
--          ?status=open reads "not completed OR completed in the last 24h".
--          Neither had an index on completed_at; the open half is served by
--          idx_koleex_todos_tenant_open (tenant_id, completed).
--          Attachment reference counting (metadata @> {"attachments":[…]})
--          is served by idx_koleex_todos_metadata_path from
--          20260926_todo_audit.sql — nothing new needed for it.
-- Schema:  additive; IF NOT EXISTS, so running it twice changes nothing.
-- RLS:     unchanged — the API layer is the boundary (service role only).
-- Rollback: DROP INDEX IF EXISTS idx_koleex_todos_tenant_completed_at;
-- Load:    plain CREATE INDEX (runs inside the migration transaction); a
--          partial index over completed rows of a small table — well under
--          a second.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_koleex_todos_tenant_completed_at
  ON koleex_todos (tenant_id, completed_at DESC, id DESC)
  WHERE completed;
