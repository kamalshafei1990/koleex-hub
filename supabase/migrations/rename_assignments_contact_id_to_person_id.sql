-- ============================================================================
-- rename_assignments_contact_id_to_person_id
--
-- The application code (src/lib/employees-admin.ts, src/lib/management-admin.ts,
-- src/lib/permissions.ts, src/app/api/employees/full/route.ts) reads and writes
-- `person_id` on koleex_assignments and koleex_position_history. The production
-- schema was created with the legacy name `contact_id`, so every Add Employee
-- save was tripping:
--
--   "Could not find the 'person_id' column of 'koleex_assignments' in the
--    schema cache"
--
-- The columns already store person ids (FK to people(id)), so a straight
-- rename brings the schema in line with what everything else assumes.
--
-- Applied 2026-04-22 via MCP; this file is kept so fresh environments pick
-- up the same shape.
-- ============================================================================

ALTER TABLE public.koleex_assignments
  RENAME COLUMN contact_id TO person_id;

ALTER TABLE public.koleex_position_history
  RENAME COLUMN contact_id TO person_id;

-- Keep the index names self-documenting.
ALTER INDEX IF EXISTS public.idx_assignments_contact
  RENAME TO idx_assignments_person;
ALTER INDEX IF EXISTS public.idx_position_history_contact
  RENAME TO idx_position_history_person;

-- Nudge PostgREST so the new column names are visible immediately.
NOTIFY pgrst, 'reload schema';
