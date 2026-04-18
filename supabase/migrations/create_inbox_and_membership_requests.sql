-- Migration: Create membership_requests + inbox_messages
-- Run this in the Supabase SQL Editor if not applied automatically.
--
-- What it does:
--   1. Creates `membership_requests` so the "Be a Koleex Member" form on
--      the login gate has somewhere to land.
--   2. Creates `inbox_messages` — a unified inbox used for both system
--      notifications (e.g. new membership request) and direct messages
--      between internal users (Super Admin, Admin, Sales, etc).
--   3. Adds a trigger that fans out a notification to every active Super
--      Admin whenever a new membership request is inserted.
--   4. Permissive RLS policies matching the rest of the project (dev-mode
--      ALLOW ALL, tightened when Supabase Auth is flipped on).

-- ───────────────────────────────────────────────────────────────────────
-- 1. membership_requests
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS membership_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  reviewed_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  source TEXT DEFAULT 'login_gate',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_membership_requests_status_created
  ON membership_requests(status, created_at DESC);

ALTER TABLE membership_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for membership_requests" ON membership_requests;
CREATE POLICY "Allow all for membership_requests" ON membership_requests
  FOR ALL USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────────────
-- 2. inbox_messages
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sender_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL, -- NULL = system
  category TEXT NOT NULL DEFAULT 'message'
    CHECK (category IN ('message', 'system', 'membership_request', 'alert')),
  subject TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_recipient_created
  ON inbox_messages(recipient_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_unread
  ON inbox_messages(recipient_account_id)
  WHERE read_at IS NULL AND archived_at IS NULL;

ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for inbox_messages" ON inbox_messages;
CREATE POLICY "Allow all for inbox_messages" ON inbox_messages
  FOR ALL USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────────────
-- 3. Fanout trigger: notify every active Super Admin of new requests
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_super_admins_of_membership_request()
RETURNS TRIGGER AS $$
DECLARE
  admin_id UUID;
BEGIN
  FOR admin_id IN
    SELECT a.id
    FROM accounts a
    JOIN roles r ON r.id = a.role_id
    WHERE r.name ILIKE '%super admin%'
      AND a.status = 'active'
  LOOP
    INSERT INTO inbox_messages (
      recipient_account_id,
      sender_account_id,
      category,
      subject,
      body,
      link,
      metadata
    ) VALUES (
      admin_id,
      NULL, -- system message
      'membership_request',
      'New membership request from ' || NEW.full_name,
      COALESCE(
        NULLIF(NEW.message, ''),
        'Wants to join Koleex.'
      ),
      '/admin/requests/' || NEW.id::text,
      jsonb_build_object(
        'request_id', NEW.id,
        'full_name', NEW.full_name,
        'email', NEW.email,
        'company', NEW.company
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_super_admins_of_membership_request
  ON membership_requests;
CREATE TRIGGER trg_notify_super_admins_of_membership_request
  AFTER INSERT ON membership_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_super_admins_of_membership_request();

-- ───────────────────────────────────────────────────────────────────────
-- 4. Verify
-- ───────────────────────────────────────────────────────────────────────
-- After running the migration you can verify with:
--
--   SELECT tablename FROM pg_tables
--   WHERE tablename IN ('membership_requests', 'inbox_messages');
--
--   SELECT trigger_name FROM information_schema.triggers
--   WHERE event_object_table = 'membership_requests';
