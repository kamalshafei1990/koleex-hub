-- ---------------------------------------------------------------------------
-- Reports app — Phase 5D: the drafts the system prepares on schedule
-- (owner's pick, 26 Sep 2026): "the system prepares a DRAFT when it is due
-- and notifies its owner — nothing is ever sent by itself".
-- ADDITIVE ONLY: one new table. Nothing existing is changed or removed.
--
--   work_report_schedules   one row per person and report type: when a
--                           week or a month that type covers has just ended
--                           (07:00 in the writer's own time), the report
--                           cron prepares that period's draft — the same
--                           draft "Write it" would start — ONCE
--                           (last_period), and notifies the writer. Only a
--                           type with a cadence, and only for someone who
--                           may start it (checked every time; a right taken
--                           away prepares nothing).
--
-- Server-only like every work_report_* table: RLS on, no policies — every
-- read and write goes through /api/work-reports/* with the service role.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_report_schedules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid,
  -- who writes it
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- a built-in type's key, or a builder type's (c-xxxxxxxxxx)
  template_key   text NOT NULL CHECK (char_length(template_key) BETWEEN 1 AND 64),
  active         boolean NOT NULL DEFAULT true,
  -- the period key of the last draft prepared, and that draft
  last_period    text,
  last_report_id uuid REFERENCES work_reports(id) ON DELETE SET NULL,
  created_by     uuid REFERENCES accounts(id) ON DELETE SET NULL,
  updated_by     uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, template_key)
);

CREATE INDEX IF NOT EXISTS work_report_schedules_tenant_idx ON work_report_schedules (tenant_id) WHERE active;

ALTER TABLE work_report_schedules ENABLE ROW LEVEL SECURITY;

-- Verification: the table as it now reads, and that it starts empty.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'work_report_schedules'
ORDER BY ordinal_position;
SELECT count(*) AS rows FROM work_report_schedules;
