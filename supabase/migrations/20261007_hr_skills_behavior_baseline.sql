-- hr_skills_behavior_baseline — recovered baseline migration (2026-10-07).
--
-- The HR skills/behavior/appraisal tables existed in production but had NO
-- migration files in the repo (governance gap found in the monthly-rating
-- plan's Phase 0). This file is the production schema, read back through
-- information_schema + pg_catalog and written down as code. Idempotent
-- (IF NOT EXISTS everywhere) — safe to run on any environment.

CREATE TABLE IF NOT EXISTS public.skill_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  name_zh text,
  name_ar text,
  CONSTRAINT skill_categories_pkey PRIMARY KEY (id),
  CONSTRAINT skill_categories_tenant_id_name_key UNIQUE (tenant_id, name)
);

ALTER TABLE public.skill_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.skills (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  category_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  name_zh text,
  name_ar text,
  CONSTRAINT skills_pkey PRIMARY KEY (id),
  CONSTRAINT skills_tenant_id_category_id_name_key UNIQUE (tenant_id, category_id, name),
  CONSTRAINT skills_category_id_fkey FOREIGN KEY (category_id) REFERENCES skill_categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON public.skills USING btree (category_id);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.employee_skill_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  employee_score integer,
  recorded_by uuid,
  recorded_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT employee_skill_history_pkey PRIMARY KEY (id),
  CONSTRAINT employee_skill_history_employee_score_check CHECK (((employee_score >= 0) AND (employee_score <= 100))),
  CONSTRAINT employee_skill_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES koleex_employees(id) ON DELETE CASCADE,
  CONSTRAINT employee_skill_history_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_esh_employee_time ON public.employee_skill_history USING btree (employee_id, recorded_at);

ALTER TABLE public.employee_skill_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.employee_skill_assessments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  source text DEFAULT 'position'::text NOT NULL,
  employee_score integer,
  years_of_experience numeric(4,1),
  notes text,
  is_verified boolean DEFAULT false NOT NULL,
  verified_by uuid,
  verified_at timestamptz,
  last_assessed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT employee_skill_assessments_pkey PRIMARY KEY (id),
  CONSTRAINT employee_skill_assessments_employee_id_skill_id_key UNIQUE (employee_id, skill_id),
  CONSTRAINT employee_skill_assessments_source_check CHECK ((source = ANY (ARRAY['position'::text, 'additional'::text]))),
  CONSTRAINT employee_skill_assessments_years_of_experience_check CHECK ((years_of_experience >= (0)::numeric)),
  CONSTRAINT employee_skill_assessments_employee_score_check CHECK (((employee_score >= 0) AND (employee_score <= 100))),
  CONSTRAINT employee_skill_assessments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES koleex_employees(id) ON DELETE CASCADE,
  CONSTRAINT employee_skill_assessments_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_esa_employee ON public.employee_skill_assessments USING btree (employee_id);

CREATE INDEX IF NOT EXISTS idx_esa_skill ON public.employee_skill_assessments USING btree (skill_id);

ALTER TABLE public.employee_skill_assessments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.position_skill_requirements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  position_id uuid NOT NULL,
  skill_id uuid NOT NULL,
  required_score integer DEFAULT 60 NOT NULL,
  weight numeric(6,2) DEFAULT 1 NOT NULL,
  is_mandatory boolean DEFAULT false NOT NULL,
  notes text,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT position_skill_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT position_skill_requirements_position_id_skill_id_key UNIQUE (position_id, skill_id),
  CONSTRAINT position_skill_requirements_required_score_check CHECK (((required_score >= 0) AND (required_score <= 100))),
  CONSTRAINT position_skill_requirements_weight_check CHECK ((weight >= (0)::numeric)),
  CONSTRAINT position_skill_requirements_position_id_fkey FOREIGN KEY (position_id) REFERENCES koleex_positions(id) ON DELETE CASCADE,
  CONSTRAINT position_skill_requirements_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_psr_position ON public.position_skill_requirements USING btree (position_id);

ALTER TABLE public.position_skill_requirements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.behavior_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  name_zh text,
  name_ar text,
  CONSTRAINT behavior_categories_pkey PRIMARY KEY (id),
  CONSTRAINT behavior_categories_tenant_id_name_key UNIQUE (tenant_id, name)
);

ALTER TABLE public.behavior_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.behavior_indicators (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  category_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  assessor_guidance text,
  is_critical_default boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  name_zh text,
  name_ar text,
  CONSTRAINT behavior_indicators_pkey PRIMARY KEY (id),
  CONSTRAINT behavior_indicators_tenant_id_category_id_name_key UNIQUE (tenant_id, category_id, name),
  CONSTRAINT behavior_indicators_category_id_fkey FOREIGN KEY (category_id) REFERENCES behavior_categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bind_category ON public.behavior_indicators USING btree (category_id);

ALTER TABLE public.behavior_indicators ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.employee_behavior_assessments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  position_id_at_assessment uuid,
  assessment_type text DEFAULT 'manager'::text NOT NULL,
  assessment_period_start date,
  assessment_period_end date,
  status text DEFAULT 'draft'::text NOT NULL,
  assessed_by uuid,
  reviewed_by uuid,
  review_date date,
  finalized_at timestamptz,
  summary text,
  overall_behavior_score numeric(5,2),
  position_behavior_match numeric(5,2),
  critical_gap_count integer,
  recommendation text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT employee_behavior_assessments_pkey PRIMARY KEY (id),
  CONSTRAINT employee_behavior_assessments_assessment_type_check CHECK ((assessment_type = ANY (ARRAY['baseline'::text, 'manager'::text, 'hr_review'::text, 'probation'::text, 'periodic'::text, 'annual'::text, 'quarterly'::text, 'incident'::text, 'self'::text, 'peer'::text]))),
  CONSTRAINT employee_behavior_assessments_recommendation_check CHECK ((recommendation = ANY (ARRAY['confirm'::text, 'extend'::text, 'develop'::text, 'escalate'::text]))),
  CONSTRAINT employee_behavior_assessments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'reviewed'::text, 'finalized'::text]))),
  CONSTRAINT employee_behavior_assessments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES koleex_employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_eba_employee ON public.employee_behavior_assessments USING btree (employee_id, created_at);

ALTER TABLE public.employee_behavior_assessments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.employee_behavior_assessment_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  behavior_indicator_id uuid NOT NULL,
  source text DEFAULT 'position'::text NOT NULL,
  employee_score integer,
  required_score_snapshot integer,
  weight_snapshot numeric(6,2),
  mandatory_snapshot boolean DEFAULT false NOT NULL,
  critical_snapshot boolean DEFAULT false NOT NULL,
  comment text,
  evidence text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT employee_behavior_assessment_items_pkey PRIMARY KEY (id),
  CONSTRAINT employee_behavior_assessment__assessment_id_behavior_indica_key UNIQUE (assessment_id, behavior_indicator_id),
  CONSTRAINT employee_behavior_assessment_items_source_check CHECK ((source = ANY (ARRAY['position'::text, 'additional'::text]))),
  CONSTRAINT employee_behavior_assessment_items_employee_score_check CHECK (((employee_score >= 0) AND (employee_score <= 100))),
  CONSTRAINT employee_behavior_assessment_item_required_score_snapshot_check CHECK (((required_score_snapshot >= 0) AND (required_score_snapshot <= 100))),
  CONSTRAINT employee_behavior_assessment_items_behavior_indicator_id_fkey FOREIGN KEY (behavior_indicator_id) REFERENCES behavior_indicators(id) ON DELETE CASCADE,
  CONSTRAINT employee_behavior_assessment_items_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES employee_behavior_assessments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ebai_assessment ON public.employee_behavior_assessment_items USING btree (assessment_id);

ALTER TABLE public.employee_behavior_assessment_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.position_behavior_requirements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  position_id uuid NOT NULL,
  behavior_indicator_id uuid NOT NULL,
  required_score integer DEFAULT 70 NOT NULL,
  weight numeric(6,2) DEFAULT 1 NOT NULL,
  is_mandatory boolean DEFAULT false NOT NULL,
  is_critical boolean DEFAULT false NOT NULL,
  notes text,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT position_behavior_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT position_behavior_requirement_position_id_behavior_indicato_key UNIQUE (position_id, behavior_indicator_id),
  CONSTRAINT position_behavior_requirements_required_score_check CHECK (((required_score >= 0) AND (required_score <= 100))),
  CONSTRAINT position_behavior_requirements_weight_check CHECK ((weight >= (0)::numeric)),
  CONSTRAINT position_behavior_requirements_behavior_indicator_id_fkey FOREIGN KEY (behavior_indicator_id) REFERENCES behavior_indicators(id) ON DELETE CASCADE,
  CONSTRAINT position_behavior_requirements_position_id_fkey FOREIGN KEY (position_id) REFERENCES koleex_positions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pbr_position ON public.position_behavior_requirements USING btree (position_id);

ALTER TABLE public.position_behavior_requirements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.behavior_followup_actions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  assessment_id uuid,
  action_type text DEFAULT 'coaching'::text NOT NULL,
  owner uuid,
  due_date date,
  status text DEFAULT 'open'::text NOT NULL,
  notes text,
  linked_record_type text,
  linked_record_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT behavior_followup_actions_pkey PRIMARY KEY (id),
  CONSTRAINT behavior_followup_actions_action_type_check CHECK ((action_type = ANY (ARRAY['coaching'::text, 'communication_training'::text, 'leadership_training'::text, 'safety_retraining'::text, 'policy_refresher'::text, 'pip'::text, 'hr_review'::text, 'other'::text]))),
  CONSTRAINT behavior_followup_actions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text]))),
  CONSTRAINT behavior_followup_actions_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES employee_behavior_assessments(id) ON DELETE SET NULL,
  CONSTRAINT behavior_followup_actions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES koleex_employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bfa_employee ON public.behavior_followup_actions USING btree (employee_id);

ALTER TABLE public.behavior_followup_actions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hr_appraisal_cycles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'draft'::text,
  created_at timestamptz DEFAULT now(),
  description text,
  notes text,
  CONSTRAINT hr_appraisal_cycles_pkey PRIMARY KEY (id)
);

ALTER TABLE public.hr_appraisal_cycles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hr_appraisals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  cycle_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  reviewer_id uuid,
  self_rating integer,
  reviewer_rating integer,
  self_comments text,
  reviewer_comments text,
  goals_met text,
  strengths text,
  improvements text,
  overall_score numeric(3,1),
  status text DEFAULT 'pending'::text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT hr_appraisals_pkey PRIMARY KEY (id),
  CONSTRAINT hr_appraisals_cycle_id_employee_id_key UNIQUE (cycle_id, employee_id),
  CONSTRAINT hr_appraisals_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES hr_appraisal_cycles(id) ON DELETE CASCADE,
  CONSTRAINT hr_appraisals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES koleex_employees(id) ON DELETE CASCADE,
  CONSTRAINT hr_appraisals_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES koleex_employees(id)
);

CREATE INDEX IF NOT EXISTS idx_hr_appraisals_cycle ON public.hr_appraisals USING btree (cycle_id);

ALTER TABLE public.hr_appraisals ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hr_goals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  employee_id uuid NOT NULL,
  appraisal_id uuid,
  title text NOT NULL,
  description text,
  target_value text,
  actual_value text,
  weight integer DEFAULT 1,
  progress integer DEFAULT 0,
  status text DEFAULT 'active'::text,
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT hr_goals_pkey PRIMARY KEY (id),
  CONSTRAINT hr_goals_appraisal_id_fkey FOREIGN KEY (appraisal_id) REFERENCES hr_appraisals(id) ON DELETE SET NULL,
  CONSTRAINT hr_goals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES koleex_employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hr_goals_employee ON public.hr_goals USING btree (employee_id);

ALTER TABLE public.hr_goals ENABLE ROW LEVEL SECURITY;
