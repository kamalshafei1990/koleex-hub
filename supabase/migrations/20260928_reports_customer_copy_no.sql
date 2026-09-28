-- Reports: the number a customer copy carries (owner, 28/09/2026).
--
-- The technician's service report and the installation report leave the
-- company as a customer copy — a PDF on the house sheet — so they need a
-- number the customer can quote back: SR-2026-0001, IR-2026-0001.
-- It is minted when the report is first SENT and kept by every later
-- version of the same report (a revised report is the same visit).
--
-- Additive only: one nullable column and one index. No existing row changes.

ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS doc_no text;

-- One number per report per version: a revision (version 2) carries its
-- first version's number; two different reports can never share one.
CREATE UNIQUE INDEX IF NOT EXISTS work_reports_tenant_doc_no_version_key
  ON work_reports (tenant_id, doc_no, version)
  WHERE doc_no IS NOT NULL;
