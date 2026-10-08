-- HR Phase D — "run payroll for month X".
--
-- hr_payroll_rules  : per-country statutory lines AS DATA, never code —
--                     employee deductions (social insurance %, capped),
--                     employer contributions (listed on the slip, not deducted),
--                     progressive tax brackets (monthly taxable amount).
-- hr_payroll_runs   : one row per (period, country) run; draft → approved → paid.
-- hr_payslips       : gain the run link, the currency and the full breakdown
--                     so a slip explains itself (and prints) years later.
--
-- Same posture as every hr_* table: RLS on, no policies — service role only,
-- reached through the HR gateway / routes.
--
-- Applied with: npm run db:apply supabase/migrations/20260920_payroll_runs.sql
CREATE TABLE IF NOT EXISTS hr_payroll_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country       text,                                   -- ISO alpha-2; NULL = applies to everyone unmatched
  name          text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('employee_deduction','employer_contribution','tax_bracket')),
  base          text NOT NULL DEFAULT 'gross' CHECK (base IN ('gross','basic','taxable')),
  rate          numeric(8,4) NOT NULL DEFAULT 0,        -- fraction: 0.08 = 8%
  cap           numeric(12,2),                          -- ceiling on the base the rate applies to
  bracket_from  numeric(12,2),                          -- tax brackets: [from, to) of monthly taxable
  bracket_to    numeric(12,2),
  sort_order    integer DEFAULT 0,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE hr_payroll_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS hr_payroll_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period         text NOT NULL,                          -- YYYY-MM
  country        text,                                   -- NULL = all countries
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  currency       text,
  employees      integer DEFAULT 0,
  total_gross    numeric(14,2) DEFAULT 0,
  total_net      numeric(14,2) DEFAULT 0,
  total_employer numeric(14,2) DEFAULT 0,
  created_by     uuid,
  approved_by    uuid,
  approved_at    timestamptz,
  paid_at        date,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_payroll_runs_period_country
  ON hr_payroll_runs (period, COALESCE(country, ''));
ALTER TABLE hr_payroll_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE hr_payslips
  ADD COLUMN IF NOT EXISTS payroll_run_id uuid REFERENCES hr_payroll_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS breakdown jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS employer_contributions jsonb DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_hr_payslips_run ON hr_payslips(payroll_run_id);
