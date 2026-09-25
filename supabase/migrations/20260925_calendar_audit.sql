-- ============================================================================
-- Calendar — audit follow-up (2026-09-25)
--
-- Indexes for the reads the Calendar makes on every screen, the reminder
-- cron and the project-task mirror, plus the column comments that no longer
-- described the table. Idempotent; safe to re-run. NOT applied by the code —
-- run it through the normal migration path.
-- ============================================================================

-- One account's one-off events in a window (lib/server/calendar-feed.ts
-- ownEvents: account_id + tenant_id, start_at < to, end_at >= from).
CREATE INDEX IF NOT EXISTS idx_calendar_events_oneoff_window
  ON koleex_calendar_events (account_id, tenant_id, start_at)
  WHERE recurrence IS NULL;

-- One account's recurring series (expanded on read).
CREATE INDEX IF NOT EXISTS idx_calendar_events_series_account
  ON koleex_calendar_events (account_id)
  WHERE recurrence IS NOT NULL;

-- The reminder cron: only rows with a reminder, earliest first.
CREATE INDEX IF NOT EXISTS idx_calendar_events_reminder
  ON koleex_calendar_events (start_at, id)
  WHERE reminder_minutes IS NOT NULL;

-- "Events I am invited to" (the attendee side of the invited-events join).
CREATE INDEX IF NOT EXISTS idx_calendar_attendees_account_event
  ON koleex_calendar_event_attendees (account_id, event_id);

-- The Calendar's project-task mirror: an assignee's tasks by due date.
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee_due
  ON project_tasks (assignee_account_id, due_date);

-- Comments that had gone stale (create_calendar_events.sql said recurrence
-- was deferred and that times were rendered in the account's zone while the
-- grid used the browser's).
COMMENT ON TABLE koleex_calendar_events IS
  'Calendar events for the Koleex Hub Calendar app, one owning account each. A recurring event is ONE row (recurrence + recurrence_until) expanded on read by lib/calendar-recurrence.ts on the organizer''s timezone. No external sync.';
COMMENT ON COLUMN koleex_calendar_events.start_at IS
  'Start instant (timestamptz). The Calendar shows it on the calendar owner''s timezone (accounts.preferences.calendar.timezone). For an all_day event this is the organizer''s local midnight of the first day.';
COMMENT ON COLUMN koleex_calendar_events.all_day IS
  'All-day events are dates: the views read start_at/end_at as dates in the organizer''s timezone (first day, last day inclusive; end_at is 23:59:59.999 of the last day, or an exclusive next midnight from older writers).';
