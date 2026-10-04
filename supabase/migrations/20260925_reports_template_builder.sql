-- ---------------------------------------------------------------------------
-- Reports app — Phase 4E: the template builder (owner's picks, 25 Sep 2026).
-- ADDITIVE ONLY: two new tables and one new nullable column. Nothing existing
-- is changed or removed.
--
-- The built-in report types stay in code (src/lib/reports/templates.ts).
-- Super admins, and anyone granted "Report Templates" in Roles, can now make
-- their own types — from nothing, or as a copy of a built-in one (the
-- original stays as it is) — and hide the built-in types nobody uses.
--
--   work_report_templates         one row per type made in the builder: its
--                                 settings and sections (def) and its words
--                                 in English, Chinese and Arabic (words).
--                                 Editing it raises `version`; archiving it
--                                 stops new reports, the old ones stay.
--   work_report_hidden_templates  the built-in types a tenant has hidden:
--                                 no longer offered, old reports untouched.
--   work_reports.template_snapshot
--                                 a report of a builder type keeps a copy of
--                                 the type AS IT WAS when the report was
--                                 started (owner's pick: "old reports stay,
--                                 new ones get the change"). NULL for the
--                                 built-in types, which live in code.
--
-- Server-only like every work_report_* table: RLS on, no policies — every
-- read and write goes through /api/work-reports/* with the service role.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_report_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid,
  -- what work_reports.template_key stores for a report of this type
  key         text NOT NULL UNIQUE CHECK (key ~ '^c-[a-z0-9]{10}$'),
  -- { family, icon, cadence, range, recipients, reviewRequired,
  --   confidential, urgent, customTitle, base?, sections: [...] }
  def         jsonb NOT NULL,
  -- { "name": { en, zh, ar }, "desc": {...}, "s.<section>": {...}, ... }
  words       jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version     integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by  uuid NOT NULL,
  updated_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_report_templates_tenant_idx ON work_report_templates (tenant_id, status);

CREATE TABLE IF NOT EXISTS work_report_hidden_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,
  template_key  text NOT NULL,
  hidden_by     uuid NOT NULL,
  hidden_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_key)
);

ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS template_snapshot jsonb;

ALTER TABLE work_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_report_hidden_templates ENABLE ROW LEVEL SECURITY;

-- Verification: the two tables and the new column, as they now read.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name IN ('work_report_templates', 'work_report_hidden_templates')
       OR (table_name = 'work_reports' AND column_name = 'template_snapshot'))
ORDER BY table_name, ordinal_position;
