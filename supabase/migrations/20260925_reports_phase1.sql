-- ---------------------------------------------------------------------------
-- Reports app — Phase 1 (owner-approved 25 Sep 2026). ADDITIVE ONLY.
--
-- One engine for every written report: a report is an instance of a
-- template that lives in code (src/lib/reports/templates.ts), so adding a
-- report TYPE never needs a migration. These three tables hold the reports
-- people write, who they were sent to, and the conversation on them.
--
-- Access is server-only, like hr_*: RLS on with no policies, every read and
-- write goes through /api/work-reports/* with the service role, and the
-- visibility rule lives in ONE place (src/lib/reports/access.ts).
--
-- Named work_reports (not "reports") so it cannot be confused with the
-- Finance number reports (finance_report_exports) or QA issue reports.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid,
  template_key      text NOT NULL,
  author_account_id uuid NOT NULL,
  title             text NOT NULL DEFAULT '',
  -- The period the report covers (a day, a week, a month, or a single date
  -- for a visit/memo). period_key makes "has Nancy sent today's daily?" one
  -- indexed lookup: '2026-09-25' · '2026-W39' · '2026-09'.
  period_start      date,
  period_end        date,
  period_key        text,
  -- [{ id, text?, items? }] — ids come from the template; unknown ids are
  -- dropped on write.
  sections          jsonb NOT NULL DEFAULT '[]'::jsonb,
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'submitted', 'approved', 'returned')),
  -- Copied from the template at creation; the author may raise it.
  confidential      boolean NOT NULL DEFAULT false,
  review_required   boolean NOT NULL DEFAULT false,
  -- Editing after sending = a NEW version (owner decision 4): the new row
  -- points at the one it replaces, and the old one is marked superseded
  -- when the new one is sent. Nothing sent is ever changed in place.
  version           integer NOT NULL DEFAULT 1,
  previous_id       uuid REFERENCES work_reports(id) ON DELETE SET NULL,
  superseded        boolean NOT NULL DEFAULT false,
  submitted_at      timestamptz,
  decided_at        timestamptz,
  decided_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- One searchable text per report (title + every section), kept by Postgres
-- itself so no write path can forget it; searched with a trigram index the
-- same way products are.
ALTER TABLE work_reports
  ADD COLUMN IF NOT EXISTS search_text text GENERATED ALWAYS AS (lower(title || ' ' || sections::text)) STORED;
CREATE INDEX IF NOT EXISTS work_reports_search_trgm ON work_reports USING gin (search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS work_reports_author_idx ON work_reports (author_account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS work_reports_tenant_idx ON work_reports (tenant_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS work_reports_period_idx ON work_reports (author_account_id, template_key, period_key);

CREATE TABLE IF NOT EXISTS work_report_recipients (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        uuid NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
  account_id       uuid NOT NULL,
  role             text NOT NULL DEFAULT 'to' CHECK (role IN ('to', 'cc')),
  read_at          timestamptz,
  acknowledged_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, account_id)
);

CREATE INDEX IF NOT EXISTS work_report_recipients_account_idx ON work_report_recipients (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS work_report_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL,
  body        text NOT NULL,
  -- A review decision is a comment too, so the thread reads as one story:
  -- "Returned: add the sample photos" sits between the messages around it.
  kind        text NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment', 'approved', 'returned')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_report_comments_report_idx ON work_report_comments (report_id, created_at);

ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_report_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_report_comments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE work_reports IS 'Reports app (Phase 1, 25 Sep 2026): written reports. Server-only (RLS on, no policies); visibility rule in src/lib/reports/access.ts.';
COMMENT ON TABLE work_report_recipients IS 'Who a report was sent to (to/cc), and when each one read and acknowledged it.';
COMMENT ON TABLE work_report_comments IS 'The thread on a report, including approve/return decisions.';
