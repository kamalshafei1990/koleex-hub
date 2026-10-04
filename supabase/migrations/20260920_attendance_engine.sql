-- HR Phase C — the attendance engine's data.
--
-- 1. Where does the employee WORK (country)? Needed to pick the working
--    calendar (weekend + public holidays, from koleex_holidays) and the
--    attendance policy. Backfilled from the home address country, then the
--    nationality; HR corrects it in the Employees form.
-- 2. Attendance policy PER COUNTRY, with the zone its wall-clock hours live in.
--    country NULL = the default policy (is_default) for everyone unmatched.
--
-- Applied with: npm run db:apply supabase/migrations/20260920_attendance_engine.sql
ALTER TABLE koleex_employees
  ADD COLUMN IF NOT EXISTS work_country text;

UPDATE koleex_employees e
   SET work_country = COALESCE(NULLIF(p.country, ''), NULLIF(e.nationality, ''))
  FROM people p
 WHERE p.id = e.person_id
   AND e.work_country IS NULL;

ALTER TABLE hr_attendance_policies
  ADD COLUMN IF NOT EXISTS country  text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Shanghai';

COMMENT ON COLUMN koleex_employees.work_country IS 'ISO 3166-1 alpha-2 of the country the employee works in — picks the working calendar and attendance policy (Phase C).';
COMMENT ON COLUMN hr_attendance_policies.country IS 'ISO alpha-2 this policy applies to; NULL = default policy.';
COMMENT ON COLUMN hr_attendance_policies.timezone IS 'IANA zone in which work_start / work_end are read.';
