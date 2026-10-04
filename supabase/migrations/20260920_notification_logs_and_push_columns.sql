-- Notification system hygiene — put two pieces of live schema on record.
--
-- notification_logs: written by lib/server/web-push.ts on every push
-- attempt (sent / failed / skipped) and read by /api/push/history and the
-- dashboard, yet no migration ever declared it — it was created by hand.
-- push_subscriptions: super_admin_activity_monitoring.sql declared the
-- table; the device columns the Settings page shows (device_name, browser,
-- os) and the is_active / updated_at pair web-push.ts prunes with were
-- added outside any migration.
--
-- Both statements are idempotent: production already has every column, so
-- this file changes nothing there. It exists so a fresh database built
-- from supabase/migrations matches the one the code runs against.
--
-- Same posture as the other notification tables: RLS on, no policies —
-- service role only, reached through the gated routes.
CREATE TABLE IF NOT EXISTS notification_logs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  actor_account_id     uuid REFERENCES accounts(id) ON DELETE SET NULL,
  kind                 text NOT NULL DEFAULT 'push',
  title                text,
  body                 text,
  channel              text NOT NULL DEFAULT 'push',
  status               text NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error                text,
  endpoint             text,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_logs_recipient_created_idx
  ON notification_logs (recipient_account_id, created_at DESC);
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS browser     text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS os          text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS is_active   boolean NOT NULL DEFAULT true;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();
