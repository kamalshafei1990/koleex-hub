-- ---------------------------------------------------------------------------
-- Management — a position's history names PEOPLE (owner's OK, 26 Sep 2026).
--
-- koleex_position_history.person_id still pointed at contacts(id) — the
-- identity work moved people to `people` (koleex_assignments, employees and
-- accounts all use people ids now; 9 of 9 assignments), so every history row
-- for a real person was refused by this foreign key, and only one row from
-- April — the owner's first assignment, keyed on an old contact — exists.
--
-- The key now points at people(id), as koleex_employees' does. NOT VALID:
-- that one April row keeps its old contact id and is left as it is; every
-- new row is checked. Nothing is deleted.
--
-- Swapping a foreign key is a DROP + ADD, done in ONE transaction so there
-- is never a moment without it. db:apply flags any DROP CONSTRAINT, so this
-- file runs with --force, on the owner's OK.
-- ---------------------------------------------------------------------------

BEGIN;

ALTER TABLE public.koleex_position_history DROP CONSTRAINT IF EXISTS koleex_position_history_contact_id_fkey;
ALTER TABLE public.koleex_position_history
  ADD CONSTRAINT koleex_position_history_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE NOT VALID;

COMMIT;

-- Verification: the key as it now reads.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.koleex_position_history'::regclass AND contype = 'f' AND conname LIKE '%person%';
