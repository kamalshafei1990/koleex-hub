/* ═══════════════════════════════════════════════════════════════════════
   HR System — Complete database schema for the HR application.
   18 tables covering: Leave, Attendance, Recruitment, Appraisals,
   Onboarding/Offboarding, Payroll, Training, and Documents.
   ═══════════════════════════════════════════════════════════════════════ */

-- ══════════════════════════════════
-- 1. LEAVE MANAGEMENT
-- ══════════════════════════════════

CREATE TABLE IF NOT EXISTS hr_leave_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  code            text NOT NULL UNIQUE,
  default_days    integer DEFAULT 0,
  carry_over      boolean DEFAULT false,
  requires_doc    boolean DEFAULT false,
  is_paid         boolean DEFAULT true,
  color           text DEFAULT '#3b82f6',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_leave_balances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES koleex_employees(id) ON DELETE CASCADE,
  leave_type_id   uuid NOT NULL REFERENCES hr_leave_types(id) ON DELETE CASCADE,
  year            integer NOT NULL,
  entitled        numeric(5,1) DEFAULT 0,
  used            numeric(5,1) DEFAULT 0,
  carried_over    numeric(5,1) DEFAULT 0,
  adjustment      numeric(5,1) DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES koleex_employees(id) ON DELETE CASCADE,
  leave_type_id   uuid NOT NULL REFERENCES hr_leave_types(id),
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  days            numeric(5,1) NOT NULL,
  half_day        boolean DEFAULT false,
  reason          text,
  status          text DEFAULT 'pending',
  reviewed_by     uuid REFERENCES koleex_employees(id),
  reviewed_at     timestamptz,
  review_notes    text,
  attachment_url  text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Seed default leave types
INSERT INTO hr_leave_types (name, code, default_days, carry_over, is_paid, color) VALUES
  ('Annual Leave',      'annual',      21, true,  true,  '#3b82f6'),
  ('Sick Leave',        'sick',        10, false, true,  '#ef4444'),
  ('Personal Leave',    'personal',     3, false, true,  '#f59e0b'),
  ('Maternity Leave',   'maternity',   90, false, true,  '#ec4899'),
  ('Paternity Leave',   'paternity',   10, false, true,  '#8b5cf6'),
  ('Unpaid Leave',      'unpaid',       0, false, false, '#6b7280'),
  ('Compassionate',     'compassionate', 5, false, true, '#14b8a6'),
  ('Study Leave',       'study',        5, false, true,  '#06b6d4')
ON CONFLICT (code) DO NOTHING;

-- ══════════════════════════════════
-- 2. ATTENDANCE
-- ══════════════════════════════════

CREATE TABLE IF NOT EXISTS hr_attendance_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  work_start      time DEFAULT '09:00',
  work_end        time DEFAULT '18:00',
  late_threshold_min integer DEFAULT 15,
  min_hours       numeric(4,2) DEFAULT 8,
  weekend_days    text[] DEFAULT '{saturday,sunday}',
  is_default      boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_attendance_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES koleex_employees(id) ON DELETE CASCADE,
  date            date NOT NULL,
  clock_in        timestamptz,
  clock_out       timestamptz,
  break_minutes   integer DEFAULT 0,
  total_hours     numeric(5,2),
  status          text DEFAULT 'present',
  source          text DEFAULT 'manual',
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Seed default attendance policy
INSERT INTO hr_attendance_policies (name, work_start, work_end, min_hours, is_default) VALUES
  ('Standard Office Hours', '09:00', '18:00', 8, true)
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════
-- 3. RECRUITMENT
-- ══════════════════════════════════

CREATE TABLE IF NOT EXISTS hr_job_postings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  department_id   uuid REFERENCES koleex_departments(id),
  position_id     uuid REFERENCES koleex_positions(id),
  description     text,
  requirements    text,
  location        text,
  employment_type text DEFAULT 'full_time',
  salary_min      numeric(12,2),
  salary_max      numeric(12,2),
  salary_currency text DEFAULT 'USD',
  status          text DEFAULT 'draft',
  published_at    timestamptz,
  closes_at       date,
  created_by      uuid REFERENCES koleex_employees(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_applicants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id  uuid NOT NULL REFERENCES hr_job_postings(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  email           text,
  phone           text,
  resume_url      text,
  cover_letter    text,
  source          text,
  stage           text DEFAULT 'new',
  rating          integer,
  notes           text,
  assigned_to     uuid REFERENCES koleex_employees(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_interview_rounds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id    uuid NOT NULL REFERENCES hr_applicants(id) ON DELETE CASCADE,
  round_number    integer DEFAULT 1,
  interviewer_id  uuid REFERENCES koleex_employees(id),
  scheduled_at    timestamptz,
  duration_min    integer DEFAULT 60,
  location        text,
  status          text DEFAULT 'scheduled',
  feedback        text,
  score           integer,
  created_at      timestamptz DEFAULT now()
);

-- ══════════════════════════════════
-- 4. APPRAISALS & GOALS
-- ══════════════════════════════════

CREATE TABLE IF NOT EXISTS hr_appraisal_cycles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  status          text DEFAULT 'draft',
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_appraisals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        uuid NOT NULL REFERENCES hr_appraisal_cycles(id) ON DELETE CASCADE,
  employee_id     uuid NOT NULL REFERENCES koleex_employees(id) ON DELETE CASCADE,
  reviewer_id     uuid REFERENCES koleex_employees(id),
  self_rating     integer,
  reviewer_rating integer,
  self_comments   text,
  reviewer_comments text,
  goals_met       text,
  strengths       text,
  improvements    text,
  overall_score   numeric(3,1),
  status          text DEFAULT 'pending',
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(cycle_id, employee_id)
);

CREATE TABLE IF NOT EXISTS hr_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES koleex_employees(id) ON DELETE CASCADE,
  appraisal_id    uuid REFERENCES hr_appraisals(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  target_value    text,
  actual_value    text,
  weight          integer DEFAULT 1,
  progress        integer DEFAULT 0,
  status          text DEFAULT 'active',
  due_date        date,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ══════════════════════════════════
-- 5. ONBOARDING / OFFBOARDING
-- ══════════════════════════════════

CREATE TABLE IF NOT EXISTS hr_checklists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  type            text NOT NULL,
  department_id   uuid REFERENCES koleex_departments(id),
  items           jsonb NOT NULL DEFAULT '[]',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_checklist_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    uuid NOT NULL REFERENCES hr_checklists(id) ON DELETE CASCADE,
  employee_id     uuid NOT NULL REFERENCES koleex_employees(id) ON DELETE CASCADE,
  start_date      date NOT NULL,
  status          text DEFAULT 'in_progress',
  items_status    jsonb NOT NULL DEFAULT '[]',
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Seed default checklists
INSERT INTO hr_checklists (name, type, items) VALUES
  ('New Hire Onboarding', 'onboarding', '[
    {"title": "Prepare workstation", "assignee_role": "IT", "due_days": -1},
    {"title": "Create email account", "assignee_role": "IT", "due_days": -1},
    {"title": "Issue access card", "assignee_role": "Security", "due_days": 0},
    {"title": "Assign equipment (laptop/phone)", "assignee_role": "IT", "due_days": 0},
    {"title": "Collect signed documents", "assignee_role": "HR", "due_days": 1},
    {"title": "Complete orientation session", "assignee_role": "HR", "due_days": 1},
    {"title": "Team introduction meeting", "assignee_role": "Manager", "due_days": 1},
    {"title": "Setup software accounts", "assignee_role": "IT", "due_days": 2},
    {"title": "First week check-in", "assignee_role": "HR", "due_days": 5},
    {"title": "30-day review", "assignee_role": "Manager", "due_days": 30}
  ]'),
  ('Employee Exit Checklist', 'offboarding', '[
    {"title": "Knowledge transfer meetings", "assignee_role": "Manager", "due_days": -14},
    {"title": "Return laptop & equipment", "assignee_role": "IT", "due_days": -1},
    {"title": "Return access card & keys", "assignee_role": "Security", "due_days": -1},
    {"title": "Revoke system access", "assignee_role": "IT", "due_days": 0},
    {"title": "Deactivate email account", "assignee_role": "IT", "due_days": 0},
    {"title": "Conduct exit interview", "assignee_role": "HR", "due_days": -3},
    {"title": "Process final payroll", "assignee_role": "Finance", "due_days": 0},
    {"title": "Update org chart", "assignee_role": "HR", "due_days": 1},
    {"title": "Archive employee records", "assignee_role": "HR", "due_days": 3}
  ]')
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════
-- 6. PAYROLL
-- ══════════════════════════════════

CREATE TABLE IF NOT EXISTS hr_salary_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES koleex_employees(id) ON DELETE CASCADE,
  base_salary     numeric(12,2) NOT NULL,
  currency        text DEFAULT 'USD',
  pay_frequency   text DEFAULT 'monthly',
  effective_from  date NOT NULL,
  effective_to    date,
  allowances      jsonb DEFAULT '{}',
  deductions      jsonb DEFAULT '{}',
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_payslips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES koleex_employees(id) ON DELETE CASCADE,
  salary_record_id uuid REFERENCES hr_salary_records(id),
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  gross_amount    numeric(12,2),
  deductions      jsonb DEFAULT '{}',
  net_amount      numeric(12,2),
  status          text DEFAULT 'draft',
  paid_at         date,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(employee_id, period_start)
);

-- ══════════════════════════════════
-- 7. TRAINING
-- ══════════════════════════════════

CREATE TABLE IF NOT EXISTS hr_courses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  provider        text,
  duration_hours  numeric(5,1),
  is_mandatory    boolean DEFAULT false,
  department_id   uuid REFERENCES koleex_departments(id),
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr_training_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES koleex_employees(id) ON DELETE CASCADE,
  course_id       uuid NOT NULL REFERENCES hr_courses(id) ON DELETE CASCADE,
  status          text DEFAULT 'enrolled',
  enrolled_at     timestamptz DEFAULT now(),
  completed_at    timestamptz,
  expiry_date     date,
  certificate_url text,
  score           numeric(5,2),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ══════════════════════════════════
-- 8. DOCUMENTS
-- ══════════════════════════════════

CREATE TABLE IF NOT EXISTS hr_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES koleex_employees(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text NOT NULL,
  file_url        text NOT NULL,
  file_type       text,
  file_size       integer,
  expiry_date     date,
  reminder_days   integer DEFAULT 30,
  notes           text,
  uploaded_by     uuid REFERENCES koleex_employees(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ══════════════════════════════════
-- INDEXES for performance
-- ══════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_employee ON hr_leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_status ON hr_leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee_date ON hr_attendance_records(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_hr_applicants_job ON hr_applicants(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_hr_applicants_stage ON hr_applicants(stage);
CREATE INDEX IF NOT EXISTS idx_hr_appraisals_cycle ON hr_appraisals(cycle_id);
CREATE INDEX IF NOT EXISTS idx_hr_goals_employee ON hr_goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_documents_employee ON hr_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_documents_expiry ON hr_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_hr_salary_employee ON hr_salary_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_training_employee ON hr_training_records(employee_id);
