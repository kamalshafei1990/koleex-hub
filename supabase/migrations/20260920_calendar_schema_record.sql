-- ============================================================================
-- Calendar — schema record (2026-09-20)
--
-- The CHECKs the code relies on but the database never had. Recurrence and
-- the attendee status were free text; a bad value from a client reached the
-- row and only the reader noticed. Idempotent; safe to re-run.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'koleex_calendar_events_recurrence_check') THEN
    ALTER TABLE koleex_calendar_events
      ADD CONSTRAINT koleex_calendar_events_recurrence_check
      CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly', 'monthly'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'koleex_calendar_events_reminder_minutes_check') THEN
    ALTER TABLE koleex_calendar_events
      ADD CONSTRAINT koleex_calendar_events_reminder_minutes_check
      CHECK (reminder_minutes IS NULL OR reminder_minutes >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'koleex_calendar_event_attendees_status_check') THEN
    ALTER TABLE koleex_calendar_event_attendees
      ADD CONSTRAINT koleex_calendar_event_attendees_status_check
      CHECK (status IN ('invited', 'accepted', 'declined'));
  END IF;
END $$;

COMMENT ON COLUMN koleex_calendar_events.recurrence IS
  'null = one-off; daily | weekly | monthly = a series expanded on read (lib/calendar-recurrence.ts).';
COMMENT ON COLUMN koleex_calendar_events.reminded_at IS
  'Server-managed: the occurrence start the reminder cron last alerted for. Reset to null when the event is rescheduled.';
COMMENT ON COLUMN koleex_calendar_event_attendees.status IS
  'invited | accepted | declined — the guest answers from the event (PATCH /api/calendar/events/[id]/attendees).';
