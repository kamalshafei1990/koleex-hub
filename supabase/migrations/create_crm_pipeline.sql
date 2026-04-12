-- ---------------------------------------------------------------------------
-- create_crm_pipeline — schema for the CRM app (pipeline + activities).
--
-- Mirrors Odoo CRM's data model adapted to Koleex Hub conventions:
--
--   crm_stages
--     Pipeline columns. Ordered by `sequence`. `is_won` flags the
--     terminal won column. `fold` collapses the column in the kanban.
--     Default seed: New / Qualified / Proposition / Negotiation / Won.
--
--   crm_opportunities
--     One row per deal. Links to an existing `contacts` row when the
--     prospect is in the CRM book; `company_name` is denormalized so
--     brand-new prospects can be created without a contact first.
--     `expected_revenue` + `probability` give the weighted forecast.
--     `priority` is 0–3 stars (Odoo convention). `lost_reason` is the
--     free-text rationale captured when a deal is moved to a lost stage.
--
--   crm_activities
--     Lightweight to-dos attached to an opportunity. Type is one of
--     call/meeting/task/email so the UI can render an icon. `done_at`
--     null = pending; non-null = completed. The salesperson sees a
--     red dot on the opportunity card when an activity is overdue.
--
-- All FKs use ON DELETE so dropping a parent doesn't leave orphans:
--   * Stage delete    → opportunities are reassigned to NULL stage
--                       (the UI re-buckets them under "Unassigned").
--   * Contact delete  → opportunity.contact_id set NULL, name preserved.
--   * Account delete  → opportunity.owner_account_id set NULL.
--   * Opportunity del → activities are cascaded.
--
-- Idempotent — every CREATE is `IF NOT EXISTS`. Re-running this file is
-- always safe.
-- ---------------------------------------------------------------------------

-- 1) Stages ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  sequence    int  NOT NULL DEFAULT 0,
  is_won      boolean NOT NULL DEFAULT false,
  fold        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_stages_sequence_idx
  ON crm_stages (sequence);

-- Seed the default Odoo-style pipeline if the table is empty.
INSERT INTO crm_stages (name, sequence, is_won, fold)
SELECT * FROM (VALUES
  ('New',         10, false, false),
  ('Qualified',   20, false, false),
  ('Proposition', 30, false, false),
  ('Negotiation', 40, false, false),
  ('Won',         50, true,  false)
) AS v(name, sequence, is_won, fold)
WHERE NOT EXISTS (SELECT 1 FROM crm_stages);


-- 2) Opportunities ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_opportunities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identification
  name                text NOT NULL,
  description         text,

  -- Pipeline state
  stage_id            uuid REFERENCES crm_stages (id) ON DELETE SET NULL,

  -- Customer / contact
  contact_id          uuid REFERENCES contacts (id) ON DELETE SET NULL,
  company_name        text,
  contact_name        text,
  email               text,
  phone               text,

  -- Forecasting
  expected_revenue    numeric(14, 2) NOT NULL DEFAULT 0,
  probability         int NOT NULL DEFAULT 10,
  expected_close_date date,

  -- Triage
  priority            int NOT NULL DEFAULT 0, -- 0..3
  source              text,                   -- "Website", "Referral", ...
  tags                text[] NOT NULL DEFAULT '{}',
  color               int NOT NULL DEFAULT 0, -- Odoo-style 0..11 swatch

  -- Ownership
  owner_account_id    uuid REFERENCES accounts (id) ON DELETE SET NULL,

  -- Lost / won bookkeeping
  lost_reason         text,
  won_at              timestamptz,
  lost_at             timestamptz,
  archived_at         timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_opportunities_priority_check
    CHECK (priority BETWEEN 0 AND 3),
  CONSTRAINT crm_opportunities_probability_check
    CHECK (probability BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS crm_opportunities_stage_idx
  ON crm_opportunities (stage_id);
CREATE INDEX IF NOT EXISTS crm_opportunities_owner_idx
  ON crm_opportunities (owner_account_id);
CREATE INDEX IF NOT EXISTS crm_opportunities_contact_idx
  ON crm_opportunities (contact_id);
CREATE INDEX IF NOT EXISTS crm_opportunities_active_idx
  ON crm_opportunities (archived_at) WHERE archived_at IS NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION crm_opportunities_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS crm_opportunities_set_updated_at ON crm_opportunities;
CREATE TRIGGER crm_opportunities_set_updated_at
  BEFORE UPDATE ON crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION crm_opportunities_set_updated_at();


-- 3) Activities ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_activities (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id        uuid NOT NULL REFERENCES crm_opportunities (id) ON DELETE CASCADE,
  type                  text NOT NULL DEFAULT 'task', -- call|meeting|task|email|note
  title                 text NOT NULL,
  notes                 text,
  due_at                timestamptz,
  done_at               timestamptz,
  assignee_account_id   uuid REFERENCES accounts (id) ON DELETE SET NULL,
  created_by_account_id uuid REFERENCES accounts (id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_activities_type_check
    CHECK (type IN ('call', 'meeting', 'task', 'email', 'note'))
);

CREATE INDEX IF NOT EXISTS crm_activities_opportunity_idx
  ON crm_activities (opportunity_id);
CREATE INDEX IF NOT EXISTS crm_activities_due_idx
  ON crm_activities (due_at) WHERE done_at IS NULL;


-- 4) RLS — keep parity with the rest of the app: open within Koleex,
--    locked from anonymous access. The legacy admin gate handles the
--    actual UI authorization until Supabase Auth is flipped on.
ALTER TABLE crm_stages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities     ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'crm_stages' AND policyname = 'crm_stages_all'
  ) THEN
    CREATE POLICY crm_stages_all ON crm_stages FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'crm_opportunities' AND policyname = 'crm_opportunities_all'
  ) THEN
    CREATE POLICY crm_opportunities_all ON crm_opportunities FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'crm_activities' AND policyname = 'crm_activities_all'
  ) THEN
    CREATE POLICY crm_activities_all ON crm_activities FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
