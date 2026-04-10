-- ============================================================================
-- Koleex Calendar — self-contained calendar events table
--
-- Backs the Calendar app (Project B). Each event is owned by an account and
-- rendered on that account's timezone / working hours (from accounts.preferences).
--
-- Intentionally self-contained: no Google Calendar sync, no external IDs.
-- Recurrence is deferred to a later phase — this table only stores concrete
-- single events.
--
-- This migration is idempotent and safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS koleex_calendar_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Content
  title         TEXT NOT NULL,
  description   TEXT,
  location      TEXT,

  -- Time window. Stored in UTC; rendered in the account's preferred timezone.
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  all_day       BOOLEAN NOT NULL DEFAULT false,

  -- Classification + visual hint.
  event_type    TEXT NOT NULL DEFAULT 'meeting'
                 CHECK (event_type IN (
                   'meeting',
                   'task',
                   'reminder',
                   'event',
                   'holiday',
                   'out_of_office'
                 )),
  color         TEXT, -- optional override; null = use default for event_type

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT calendar_events_time_order_check
    CHECK (end_at >= start_at)
);

-- Common queries: "give me all events for account X between T1 and T2".
CREATE INDEX IF NOT EXISTS idx_calendar_events_account_start
  ON koleex_calendar_events (account_id, start_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start
  ON koleex_calendar_events (start_at);

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at
  ON koleex_calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON koleex_calendar_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE koleex_calendar_events IS
  'Self-contained calendar events for the Koleex Hub Calendar app. No external sync.';
COMMENT ON COLUMN koleex_calendar_events.account_id IS
  'Owning account. Events are scoped per account; each user sees their own.';
COMMENT ON COLUMN koleex_calendar_events.start_at IS
  'Start timestamp in UTC. Rendered in the account preferences timezone.';
COMMENT ON COLUMN koleex_calendar_events.event_type IS
  'meeting | task | reminder | event | holiday | out_of_office.';

-- ============================================================================
-- Done.
-- ============================================================================
