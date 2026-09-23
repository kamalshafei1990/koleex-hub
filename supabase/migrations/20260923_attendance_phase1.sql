-- Attendance Phase 1 (owner-approved 23 Sep 2026).
--
-- 1. Corrections with an audit trail: HR (or the owner) can fix a day, an
--    employee can ask for a fix; every change keeps who / when / why and the
--    record before and after.
-- 2. Forgotten clock-outs: a reminder after the working day, then an
--    automatic close at the policy's end time, flagged for review.
-- 3. Overtime is the time worked AFTER the policy's end time and is paid only
--    once approved (the decision and the approved minutes live on the record).
-- 4. Tracking start: before it — and before an employee's hire date — a
--    workday with no punch is "not tracked", never "absent".
-- 5. How each employee punches: the My HR button ('app') or the office
--    fingerprint device only ('device'); works_remote marks the people who
--    work outside the office, whose app punches are flagged for HR.
--
-- Additive only — nothing is dropped or rewritten.
-- Applied with: npm run db:apply supabase/migrations/20260923_attendance_phase1.sql

ALTER TABLE hr_attendance_policies
  ADD COLUMN IF NOT EXISTS tracking_from date;

ALTER TABLE koleex_employees
  ADD COLUMN IF NOT EXISTS punch_method text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS works_remote boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'koleex_employees_punch_method_check') THEN
    ALTER TABLE koleex_employees
      ADD CONSTRAINT koleex_employees_punch_method_check CHECK (punch_method IN ('app', 'device'));
  END IF;
END $$;

ALTER TABLE hr_attendance_records
  ADD COLUMN IF NOT EXISTS remote boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS corrected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS overtime_status text,
  ADD COLUMN IF NOT EXISTS overtime_approved_minutes integer,
  ADD COLUMN IF NOT EXISTS overtime_decided_by uuid,
  ADD COLUMN IF NOT EXISTS overtime_decided_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_attendance_records_overtime_status_check') THEN
    ALTER TABLE hr_attendance_records
      ADD CONSTRAINT hr_attendance_records_overtime_status_check CHECK (overtime_status IS NULL OR overtime_status IN ('approved', 'rejected'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS hr_attendance_corrections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,
  employee_id   uuid NOT NULL REFERENCES koleex_employees(id) ON DELETE CASCADE,
  date          date NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('request', 'edit')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  clock_in      timestamptz,
  clock_out     timestamptz,
  break_minutes integer,
  reason        text NOT NULL,
  requested_by  uuid,
  decided_by    uuid,
  decided_at    timestamptz,
  decision_note text,
  before        jsonb,
  after         jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_corrections_employee_date
  ON hr_attendance_corrections (employee_id, date);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_corrections_pending
  ON hr_attendance_corrections (created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_hr_attendance_records_open
  ON hr_attendance_records (date) WHERE clock_out IS NULL;

-- Deny-all like every hr_* table: the API routes read and write it with the
-- service role; nothing reaches it from the browser.
ALTER TABLE hr_attendance_corrections ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN hr_attendance_policies.tracking_from IS 'First day attendance counts. Before it (and before an employee''s hire_date) a workday with no punch is "not tracked", never absent. NULL = not started.';
COMMENT ON COLUMN koleex_employees.punch_method IS '''app'' = the My HR button; ''device'' = the office fingerprint device only (the app refuses).';
COMMENT ON COLUMN koleex_employees.works_remote IS 'Works outside the office: app punches are accepted and flagged remote for HR.';
COMMENT ON COLUMN hr_attendance_records.auto_closed IS 'Closed by the nightly job at the policy end time because nobody clocked out — needs review.';
COMMENT ON COLUMN hr_attendance_records.overtime_status IS 'NULL = not decided (pending when the day has overtime after the policy end time); approved / rejected by HR or the owner.';
COMMENT ON TABLE hr_attendance_corrections IS 'Attendance corrections: employee requests (kind request) and HR edits (kind edit), with the record before and after.';
