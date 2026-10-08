-- ---------------------------------------------------------------------------
-- Social Marketing weekly plan. Owner-approved 29/09/2026 ("موافق، ابدأ").
-- ADDITIVE.
--
--   marketing_week_plans  one plan per space per week (the week starts on
--       Monday, Shanghai time). Koleex AI drafts it from the account
--       numbers; an approver approves it (draft → active); at the week's
--       end it is closed with its tally (result). tasks holds the Hub's
--       structured tasks (publish N posts on a platform, answer the
--       comments, a task done by hand) — their titles are drawn by the
--       screen in the reader's language; only Koleex AI's reasons are text
--       (en / zh / ar). version guards two people editing at once.
--
-- Server-only like the other marketing_* tables: RLS on, no policies.
-- Rollback: DROP TABLE marketing_week_plans;
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketing_week_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  space       text NOT NULL DEFAULT 'company' CHECK (space IN ('company', 'ceo')),
  week_start  date NOT NULL,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  tasks       jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary     jsonb,
  version     integer NOT NULL DEFAULT 1,
  approved_by uuid,
  approved_at timestamptz,
  closed_at   timestamptz,
  result      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, space, week_start)
);
CREATE INDEX IF NOT EXISTS marketing_week_plans_tenant_idx ON marketing_week_plans (tenant_id, space, week_start DESC);

ALTER TABLE marketing_week_plans ENABLE ROW LEVEL SECURITY;
