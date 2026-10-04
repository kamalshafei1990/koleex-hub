-- ---------------------------------------------------------------------------
-- Reports app — Phase 4B: a report can also be about a QUOTATION or an
-- INVOICE (owner's pick, 25 Sep 2026: a lost deal shows on its quotation, a
-- collection report on its invoice). ADDITIVE IN EFFECT.
--
-- The only change: the kinds a work_report_links row may name grow from
-- four to six. No row is touched, nothing is removed — the index, the
-- cascade and RLS (on, no policies) stay as they are.
--
-- Postgres cannot widen a CHECK in place, so the old one is dropped and the
-- wider one added in ONE transaction: there is never a moment without it.
-- db:apply flags any DROP CONSTRAINT as destructive, so this file runs with
-- --force, on the owner's OK.
-- ---------------------------------------------------------------------------

BEGIN;

ALTER TABLE work_report_links DROP CONSTRAINT IF EXISTS work_report_links_entity_type_check;
ALTER TABLE work_report_links ADD CONSTRAINT work_report_links_entity_type_check
  CHECK (entity_type IN ('customer', 'supplier', 'product', 'order', 'quotation', 'invoice'));

COMMIT;

-- Verification: the constraint as it now reads.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'work_report_links_entity_type_check';
