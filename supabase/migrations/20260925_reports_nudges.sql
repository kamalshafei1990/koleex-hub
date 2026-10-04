-- ---------------------------------------------------------------------------
-- Reports app — Phase 3B: reminders and escalation (owner's pick and rule,
-- 25 Sep 2026). ADDITIVE ONLY.
--
-- The author is reminded an hour before a report's deadline; if it is still
-- missing, their manager is told — the daily 2 hours after the deadline, the
-- weekly and monthly at the end of the next working day.
--
-- work_report_nudges is the ledger that makes each of those happen ONCE:
-- the job (every 15 minutes) CLAIMS a nudge by inserting its row — the
-- unique key refuses a second claim — and only the run that inserted it
-- sends the notification. So overlapping runs, a retry, or a stranger
-- calling the job's URL can never send anything twice.
--
-- The two switches on work_report_settings let the owner or HR pause either
-- one; both start ON (the owner asked for them), and nothing is sent at all
-- until tracking has a start date.
--
-- Server-only like every work_report_* table: RLS on, no policies.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_report_nudges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,
  account_id    uuid NOT NULL,
  template_key  text NOT NULL CHECK (template_key IN ('daily', 'weekly', 'monthly')),
  period_key    text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('reminder', 'escalation')),
  -- who was told (the author for a reminder, the manager for an escalation)
  notified      uuid[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, template_key, period_key, kind)
);

CREATE INDEX IF NOT EXISTS work_report_nudges_tenant_idx ON work_report_nudges (tenant_id, created_at DESC);

ALTER TABLE work_report_nudges ENABLE ROW LEVEL SECURITY;

ALTER TABLE work_report_settings ADD COLUMN IF NOT EXISTS reminders boolean NOT NULL DEFAULT true;
ALTER TABLE work_report_settings ADD COLUMN IF NOT EXISTS escalations boolean NOT NULL DEFAULT true;
