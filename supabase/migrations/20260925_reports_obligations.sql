-- ---------------------------------------------------------------------------
-- Reports app — Phase 3A: who must write which report (owner's pick,
-- 25 Sep 2026). ADDITIVE ONLY: two small tables.
--
-- THE DEFAULT LIVES IN CODE (src/lib/reports/obligations.ts, owner's
-- decision): every employee writes the daily and the weekly report, anyone
-- with people under them also writes the monthly, super admins are exempt.
-- A row here is only a PER-PERSON EXCEPTION to that default (required true
-- or false for one report type); deleting the row returns that person to
-- the default.
--
-- work_report_settings.tracking_from: the first day anyone can be counted
-- late or missing. Until it is set, the compliance board shows who is
-- expected and what was sent, and marks nobody missing — the days before
-- the Reports app existed never count against anyone.
--
-- Server-only like every work_report_* table: RLS on, no policies; reads and
-- writes go through /api/work-reports/* (the setup route asks for super
-- admin or HR·edit).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_report_obligations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,
  account_id    uuid NOT NULL,
  template_key  text NOT NULL CHECK (template_key IN ('daily', 'weekly', 'monthly')),
  required      boolean NOT NULL,
  updated_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, template_key)
);

CREATE INDEX IF NOT EXISTS work_report_obligations_tenant_idx ON work_report_obligations (tenant_id);

CREATE TABLE IF NOT EXISTS work_report_settings (
  tenant_id     uuid PRIMARY KEY,
  tracking_from date,
  updated_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE work_report_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_report_settings ENABLE ROW LEVEL SECURITY;
