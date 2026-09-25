-- ============================================================================
-- Calendar — partials (2026-09-27)
--
--   1. koleex_calendar_event_exceptions.meeting_url may be '' — "this
--      occurrence has NO link" (NULL keeps meaning "as the series"). The
--      2026-09-26 CHECK required https, so a per-occurrence clear could not
--      be stored. Only the exceptions table is relaxed; the events table keeps
--      its https-only rule.
--   2. koleex_calendar_event_exceptions.description — one occurrence's own
--      notes (NULL = as the series, '' = none), at most 4000 characters like
--      the series column's route limit.
--
-- The code degrades before this runs: a cleared link is saved as "unchanged"
-- (the editor says so) and a per-occurrence description is not stored.
-- Idempotent; safe to re-run.
-- ============================================================================

DO $$
DECLARE
  c record;
BEGIN
  -- The 2026-09-26 column CHECK was inline, so its name is Postgres's; drop
  -- whichever CHECK on the table mentions meeting_url, then add ours.
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
     WHERE con.conrelid = 'koleex_calendar_event_exceptions'::regclass
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%meeting_url%'
       AND con.conname <> 'koleex_calendar_event_exceptions_meeting_url_v2'
  LOOP
    EXECUTE format('ALTER TABLE koleex_calendar_event_exceptions DROP CONSTRAINT %I', c.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'koleex_calendar_event_exceptions_meeting_url_v2'
       AND conrelid = 'koleex_calendar_event_exceptions'::regclass
  ) THEN
    ALTER TABLE koleex_calendar_event_exceptions
      ADD CONSTRAINT koleex_calendar_event_exceptions_meeting_url_v2
      CHECK (
        meeting_url IS NULL
        OR meeting_url = ''
        OR (char_length(meeting_url) <= 500 AND meeting_url ~* '^https://')
      );
  END IF;
END $$;

ALTER TABLE koleex_calendar_event_exceptions
  ADD COLUMN IF NOT EXISTS description text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'koleex_calendar_event_exceptions_description_check'
       AND conrelid = 'koleex_calendar_event_exceptions'::regclass
  ) THEN
    ALTER TABLE koleex_calendar_event_exceptions
      ADD CONSTRAINT koleex_calendar_event_exceptions_description_check
      CHECK (description IS NULL OR char_length(description) <= 4000);
  END IF;
END $$;

COMMENT ON COLUMN koleex_calendar_event_exceptions.meeting_url IS
  'The occurrence''s own call link: NULL = as the series, '''' = no link for this occurrence, else https (<= 500 chars).';
COMMENT ON COLUMN koleex_calendar_event_exceptions.description IS
  'The occurrence''s own notes: NULL = as the series, '''' = none (<= 4000 chars).';
