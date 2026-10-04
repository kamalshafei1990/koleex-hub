-- ============================================================================
-- Calendar — additions (2026-09-26)
--
--   1. koleex_calendar_events.meeting_url — the call link of an event
--      (https only, at most 500 characters). The routes validate it too.
--   2. koleex_calendar_event_exceptions — "this occurrence only" edits of a
--      recurring event: a SKIP (the occurrence is deleted) or an OVERRIDE
--      (its title / time / place / link differ). Keyed by the occurrence's
--      ORIGINAL start, as lib/calendar-recurrence.ts computes it. Expanded
--      on read by lib/server/calendar-feed.ts and honoured by the reminder
--      cron. Rows go with their series (ON DELETE CASCADE).
--
-- The code degrades before this runs: no meeting link is saved and the
-- "This event" choice answers that it is not available yet.
-- Idempotent; safe to re-run.
-- ============================================================================

ALTER TABLE koleex_calendar_events ADD COLUMN IF NOT EXISTS meeting_url text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'koleex_calendar_events_meeting_url_check') THEN
    ALTER TABLE koleex_calendar_events
      ADD CONSTRAINT koleex_calendar_events_meeting_url_check
      CHECK (meeting_url IS NULL OR (char_length(meeting_url) <= 500 AND meeting_url ~* '^https://'));
  END IF;
END $$;

COMMENT ON COLUMN koleex_calendar_events.meeting_url IS
  'Call link (https, <= 500 chars). Guests are told when it changes; the Calendar shows a Join button on the day.';

CREATE TABLE IF NOT EXISTS koleex_calendar_event_exceptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES koleex_calendar_events(id) ON DELETE CASCADE,
  tenant_id        uuid NULL,
  occurrence_start timestamptz NOT NULL,
  kind             text NOT NULL CHECK (kind IN ('skip', 'override')),
  title            text NULL CHECK (title IS NULL OR char_length(title) <= 200),
  start_at         timestamptz NULL,
  end_at           timestamptz NULL,
  location         text NULL CHECK (location IS NULL OR char_length(location) <= 300),
  meeting_url      text NULL CHECK (meeting_url IS NULL OR (char_length(meeting_url) <= 500 AND meeting_url ~* '^https://')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT koleex_calendar_event_exceptions_span_check CHECK (start_at IS NULL OR end_at IS NULL OR end_at >= start_at),
  CONSTRAINT koleex_calendar_event_exceptions_unique UNIQUE (event_id, occurrence_start)
);

CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_event
  ON koleex_calendar_event_exceptions (event_id);

-- Server-only table (the routes use the service role); no client policies.
ALTER TABLE koleex_calendar_event_exceptions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE koleex_calendar_event_exceptions IS
  'One occurrence of a recurring koleex_calendar_events row changed on its own: kind=skip deletes it, kind=override replaces its title/start/end/location/meeting_url (NULL = unchanged). occurrence_start is the ORIGINAL start of the occurrence.';

-- The search box: own events by text (title/location/description ILIKE).
CREATE INDEX IF NOT EXISTS idx_calendar_events_account_start
  ON koleex_calendar_events (account_id, start_at);
