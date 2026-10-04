-- ---------------------------------------------------------------------------
-- Reports app — Phase 3D: reports that events ask for (owner's picks,
-- 25 Sep 2026). ADDITIVE ONLY.
--
-- When something happens in another app, the person who must write about it
-- owes a report, exactly like a daily (in "Due from you", the Home greeting,
-- the calendar, a reminder before the deadline, the manager told if it is
-- missing):
--   leave_handover    approved leave of 3+ days → a handover before it starts
--   leave_return      the same leave, ended → a return plan on the first day back
--   crm_meeting       a CRM meeting marked done → a customer visit report
--   invitation_visit  an issued invitation's visitors have left → a visit report
--   attendance        a late or absent day (as HR's sheet reads it) → a note
--   probation         two weeks before a probation ends → the manager's
--                     confidential review, to HR
--
-- work_report_requests holds one row per event × person. The 15-minute job
-- CREATES it (the unique key refuses a second one, so overlapping runs or a
-- stranger calling the job's URL can never ask twice), notifies the person
-- once, and CANCELS it if the event stops being true (leave cancelled, a day
-- corrected). A report written for it carries period_key 'req:<id>' — the
-- same field a daily uses for its day — so every later version stays linked;
-- the first send stamps sent_at (on time or late), report_id is the newest.
--
-- Its reminder and its escalation are claimed ON THE ROW (reminded_at /
-- escalated_at set only where still null, and only the run whose update
-- landed sends) — the same once-only guarantee as work_report_nudges, which
-- stays as it is.
--
-- Server-only like every work_report_* table: RLS on, no policies.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_report_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid,
  -- who must write it
  account_id          uuid NOT NULL,
  template_key        text NOT NULL,
  rule_key            text NOT NULL CHECK (rule_key IN ('leave_handover', 'leave_return', 'crm_meeting', 'invitation_visit', 'attendance', 'probation')),
  -- what it is about: 'leave:<id>', 'crm:<id>', 'invitation:<id>',
  -- 'attendance:<employee>:<day>', 'probation:<employee>:<end day>'
  source_key          text NOT NULL,
  -- a short, language-free line for lists ("ACME Trading", "01/10–07/10")
  subject             text NOT NULL DEFAULT '',
  -- the person it is about, when it is about someone else (probation)
  subject_account_id  uuid,
  event_day           date NOT NULL,
  due_day             date NOT NULL,
  due_at              timestamptz NOT NULL,
  -- the facts a new report starts with (section id → text)
  prefill             jsonb NOT NULL DEFAULT '{}'::jsonb,
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled')),
  sent_at             timestamptz,
  report_id           uuid,
  -- once-only claims for the two nudges
  reminded_at         timestamptz,
  escalated_at        timestamptz,
  escalated_to        uuid[] NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_key, source_key, account_id)
);

CREATE INDEX IF NOT EXISTS work_report_requests_account_idx ON work_report_requests (account_id, due_at);
CREATE INDEX IF NOT EXISTS work_report_requests_tenant_idx ON work_report_requests (tenant_id, status, due_at);

ALTER TABLE work_report_requests ENABLE ROW LEVEL SECURITY;

