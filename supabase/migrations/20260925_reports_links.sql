-- ---------------------------------------------------------------------------
-- Reports app — Phase 4A: a report linked to the records it is about (owner's
-- pick, 25 Sep 2026: "the report shows on that record's page"). ADDITIVE ONLY.
--
-- A report's "links" section names customers, suppliers, products and
-- orders. This table is that section, kept as rows so a customer's (or a
-- supplier's, product's, order's) page can ask "which reports are about
-- me?" in one indexed read. It is rewritten from the report's own sections
-- on every save — the sections stay the record, this is their index — and
-- goes with the report when a draft is deleted.
--
-- Who may see a linked report on a record's page is the report's own read
-- rule (author, recipients, the manager chain and a super admin for a
-- non-confidential one), applied by the server — the link grants nothing.
--
-- Server-only like every work_report_* table: RLS on, no policies.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_report_links (
  report_id    uuid NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
  tenant_id    uuid,
  entity_type  text NOT NULL CHECK (entity_type IN ('customer', 'supplier', 'product', 'order')),
  entity_id    text NOT NULL,
  -- the record's name as the author picked it (for lists; the record's page
  -- shows its own name)
  label        text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS work_report_links_entity_idx ON work_report_links (entity_type, entity_id);

ALTER TABLE work_report_links ENABLE ROW LEVEL SECURITY;
