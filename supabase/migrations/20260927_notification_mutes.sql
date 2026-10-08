-- =============================================================================
-- Muted notification topics (2026-09-27) — "Stop notifications about this".
--
-- Reason:  a reader can mute ONE topic — this task, this issue, this
--          quotation — from a notification's ⋯ (lib/notification-mute says
--          which topics can be muted: never a request that waits on them,
--          never a security alert). A mute names the metadata key and value
--          the topic is known by (todo_id = …) and the types it silences.
--
--          The trigger applies every mute to EVERY writer at once — there
--          are twenty-odd of them, and a writer added tomorrow is covered
--          without knowing mutes exist: a new row for a muted topic lands
--          already read and archived, marked metadata.muted. It stays in
--          the reader's Archive; the bell, the counts and the pop-up cards
--          never see it. The push is held back by the sender
--          (lib/server/web-push, the same mutes).
-- Schema:  additive; IF NOT EXISTS / OR REPLACE, so running it twice
--          changes nothing.
-- RLS:     enabled with no policies — the service role (the API layer) is
--          the only reader and writer, as for inbox_messages.
-- Rollback: DROP TRIGGER inbox_apply_mutes ON inbox_messages;
--           DROP FUNCTION inbox_apply_mutes();
--           DROP TABLE notification_mutes;
-- Load:    an empty table; the trigger costs one indexed lookup per
--          notification written.
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_mutes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tenant_id   uuid,
  field       text NOT NULL,
  value       text NOT NULL,
  types       text[] NOT NULL,
  app         text,
  label       text,
  tpl         jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, field, value)
);

ALTER TABLE notification_mutes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION inbox_apply_mutes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.metadata IS NULL OR NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM notification_mutes m
    WHERE m.account_id = NEW.recipient_account_id
      AND (NEW.metadata ->> m.field) = m.value
      AND (NEW.metadata ->> 'type') = ANY (m.types)
  ) THEN
    NEW.read_at := COALESCE(NEW.read_at, now());
    NEW.archived_at := now();
    NEW.metadata := NEW.metadata || jsonb_build_object('muted', true);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER inbox_apply_mutes
  BEFORE INSERT ON inbox_messages
  FOR EACH ROW EXECUTE FUNCTION inbox_apply_mutes();
