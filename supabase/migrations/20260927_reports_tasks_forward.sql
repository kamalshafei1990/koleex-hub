-- ---------------------------------------------------------------------------
-- Reports app — Phase 6A: a report becomes work (owner's picks, 27 Sep 2026).
-- ADDITIVE IN EFFECT: nothing is removed and no row is touched.
--
--   1. A task made from a line of a report goes to To-do (koleex_todos) with
--      source = 'report' and source_id = the report's id, so the task says
--      where it came from and the report shows its tasks. The kinds a task's
--      source may name grow from three to four. Postgres cannot widen a
--      CHECK in place, so the old one is dropped and the wider one added in
--      ONE transaction — there is never a moment without it. db:apply flags
--      any DROP CONSTRAINT as destructive, so this file runs with --force, on
--      the owner's OK ("طبّق"). The existing idx_todos_source (source,
--      source_id) already serves the report's lookup — no new index.
--
--   2. A report can be FORWARDED to someone who was not on it: they become a
--      copy reader (role 'cc' — they read, comment and acknowledge, never
--      approve or return), and the row says who forwarded it, when, and the
--      note they wrote. A recipient the author chose has all three NULL.
--
-- RLS stays as it is on both tables (server-only: every read and write goes
-- through the API with the service role).
-- ---------------------------------------------------------------------------

BEGIN;

ALTER TABLE koleex_todos DROP CONSTRAINT IF EXISTS koleex_todos_source_check;
ALTER TABLE koleex_todos ADD CONSTRAINT koleex_todos_source_check
  CHECK (source IN ('manual', 'crm', 'calendar', 'report'));

ALTER TABLE work_report_recipients
  ADD COLUMN IF NOT EXISTS forwarded_by uuid REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forwarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS forward_note text CHECK (forward_note IS NULL OR char_length(forward_note) <= 500);

COMMIT;

-- Verification: the constraint as it now reads, and the three new columns.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'koleex_todos_source_check';
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'work_report_recipients'
  AND column_name IN ('forwarded_by', 'forwarded_at', 'forward_note')
ORDER BY column_name;
