-- =============================================================================
-- Notification snooze (2026-09-27) — "Later" on a bell row or a pop-up card.
--
-- Reason:  a reader can put a notification off: an hour, three hours, or
--          tomorrow 09:00. Until snoozed_until the row is hidden from the
--          bell, the notification center and every unread count (it stays
--          unread, so the lifecycle verbs still settle it if its cause is
--          finished meanwhile). The wake cron (/api/cron/inbox-wake, every
--          5 minutes) brings it back to the top as new and sends the push.
-- Schema:  additive; IF NOT EXISTS, so running it twice changes nothing.
-- RLS:     unchanged — the API layer is the boundary (service role only).
-- Rollback: DROP INDEX IF EXISTS idx_inbox_messages_snoozed_until;
--           ALTER TABLE inbox_messages DROP COLUMN IF EXISTS snoozed_until;
-- Load:    a nullable column without a default (metadata only) and a partial
--          index over the snoozed rows alone — empty at creation.
-- =============================================================================

ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_inbox_messages_snoozed_until
  ON inbox_messages (snoozed_until)
  WHERE snoozed_until IS NOT NULL;
