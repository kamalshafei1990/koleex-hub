-- HR Phase B — the manager's step in the leave approval chain.
--
-- pending → (manager) manager_approved → (HR) approved | rejected | cancelled
--
-- The first approver is the employee's direct manager (koleex_employees.manager_id);
-- an employee with no manager goes straight to HR. HR may still decide a
-- `pending` request directly (override) — the manager step is a courtesy to the
-- line, not a lock on HR. `status` is plain text (no CHECK), so the new value
-- needs no constraint change; only the three columns recording the manager's
-- decision are new.
--
-- Applied with: npm run db:apply supabase/migrations/20260920_leave_manager_review.sql
ALTER TABLE hr_leave_requests
  ADD COLUMN IF NOT EXISTS manager_reviewed_by uuid REFERENCES koleex_employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_notes text;

COMMENT ON COLUMN hr_leave_requests.manager_reviewed_by IS 'Direct manager who took the first decision (Phase B). NULL when HR decided without a manager step.';
