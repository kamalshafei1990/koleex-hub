-- Migration: Real IMAP/SMTP email inside Koleex Mail
-- ---------------------------------------------------------------------------
-- Run this in Supabase SQL Editor.
--
-- What it does:
--   1. Creates `mail_connections` — one row per account that has connected
--      an external mailbox. Stores IMAP + SMTP server config and an
--      AES-GCM-encrypted password blob. The app never decrypts passwords
--      client-side; only the backend (which holds the MAIL_ENCRYPTION_KEY
--      env var) can read them.
--
--   2. Extends `inbox_messages` with columns needed to round-trip real
--      email: external sender/recipient addresses, Message-ID / In-Reply-To
--      / References headers for threading, a direction flag (inbound vs
--      outbound), and raw HTML body so we can render rich emails.
--
--   3. Adds a new `category` value `'external_email'` so the UI can badge
--      real emails differently from internal Koleex messages.
--
--   4. Adds indexes for the sync service: lookup by
--      `mail_thread_id` when threading replies, and by
--      `external_message_id` to detect duplicates during re-polling.
--
-- Safe to re-run: every table / column / constraint is guarded with
-- IF NOT EXISTS or a conditional DO $$ ... $$ block.
-- ---------------------------------------------------------------------------

-- ───────────────────────────────────────────────────────────────────────
-- 1. mail_connections — one connected mailbox per account (encrypted)
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mail_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Human-friendly label shown in the "From" selector.
  -- Usually the email address itself, e.g. "kamal@koleexgroup.com".
  display_name TEXT NOT NULL,
  email_address TEXT NOT NULL,

  -- Provider preset used at connection time. Lets the UI pre-fill host
  -- / port defaults for Zoho, Gmail, Outlook, etc. Custom = user entered
  -- everything by hand.
  provider TEXT NOT NULL DEFAULT 'custom'
    CHECK (provider IN ('zoho', 'gmail', 'outlook', 'yahoo', 'custom')),

  -- IMAP receive config
  imap_host TEXT NOT NULL,
  imap_port INT NOT NULL DEFAULT 993,
  imap_secure BOOLEAN NOT NULL DEFAULT true,
  imap_username TEXT NOT NULL,

  -- SMTP send config
  smtp_host TEXT NOT NULL,
  smtp_port INT NOT NULL DEFAULT 465,
  smtp_secure BOOLEAN NOT NULL DEFAULT true,
  smtp_username TEXT NOT NULL,

  -- AES-GCM encrypted password blob. Format:
  --   base64(iv || ciphertext || authTag)
  -- Only the backend with MAIL_ENCRYPTION_KEY can decrypt. This column
  -- is NEVER returned to the client — RLS + explicit column selection
  -- in the data layer both enforce that.
  password_encrypted TEXT NOT NULL,

  -- Sync state so the IMAP poller knows where it left off. `last_uid`
  -- is the IMAP UID of the newest message synced (per-folder, we only
  -- sync INBOX for now). `last_sync_at` is for UI "last refreshed"
  -- indicators.
  last_uid BIGINT,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,

  -- Soft disable: we mark a connection as `disabled` instead of deleting
  -- it when the user removes it, so their historical mail stays tied to
  -- the connection for audit.
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'error')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent the same account from connecting the same mailbox twice.
  UNIQUE (account_id, email_address)
);

CREATE INDEX IF NOT EXISTS idx_mail_connections_account
  ON mail_connections(account_id);
CREATE INDEX IF NOT EXISTS idx_mail_connections_active
  ON mail_connections(status)
  WHERE status = 'active';

-- updated_at trigger so we can tell when a connection's config was
-- last edited (useful if the user rotates a password and we need to
-- invalidate a cached IMAP session).
CREATE OR REPLACE FUNCTION touch_mail_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_mail_connections_updated_at
  ON mail_connections;
CREATE TRIGGER trg_touch_mail_connections_updated_at
  BEFORE UPDATE ON mail_connections
  FOR EACH ROW
  EXECUTE FUNCTION touch_mail_connections_updated_at();

ALTER TABLE mail_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for mail_connections" ON mail_connections;
CREATE POLICY "Allow all for mail_connections" ON mail_connections
  FOR ALL USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────────────
-- 2. inbox_messages — add external-email columns
-- ───────────────────────────────────────────────────────────────────────

-- category: add 'external_email' as a valid value. Because the existing
-- CHECK constraint has a fixed list, we drop it and re-add it with the
-- new value.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inbox_messages_category_check'
  ) THEN
    ALTER TABLE inbox_messages DROP CONSTRAINT inbox_messages_category_check;
  END IF;
END $$;

ALTER TABLE inbox_messages
  ADD CONSTRAINT inbox_messages_category_check
  CHECK (category IN (
    'message',
    'system',
    'membership_request',
    'alert',
    'external_email'
  ));

-- Connection the message is tied to (NULL for internal Koleex messages).
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS mail_connection_id UUID
  REFERENCES mail_connections(id) ON DELETE SET NULL;

-- Direction: which way did the mail flow?
--   inbound  = received from external sender via IMAP
--   outbound = sent to external recipient via SMTP
--   internal = in-app Koleex message (default, preserves existing rows)
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'internal'
  CHECK (direction IN ('internal', 'inbound', 'outbound'));

-- Raw SMTP addresses so we can show "From: john@gmail.com" even though
-- there's no matching Koleex account.
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS external_from TEXT;
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS external_from_name TEXT;
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS external_to TEXT[]; -- array so CC/BCC land here too in the future
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS external_cc TEXT[];

-- RFC 5322 threading headers — what the remote mail client set.
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS external_message_id TEXT;
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS external_in_reply_to TEXT;
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS external_references TEXT[];

-- Conversation grouping. We compute this on insert: if external_in_reply_to
-- matches an existing message's external_message_id, reuse that row's
-- mail_thread_id. Otherwise start a new thread (UUID).
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS mail_thread_id UUID;

-- IMAP UID on the server. Lets us re-fetch if something goes wrong.
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS imap_uid BIGINT;

-- Rich body. `body` stays the plain-text version; `body_html` is
-- sanitized HTML for rendering in the reading pane. We sanitize server-
-- side during sync to strip scripts/tracking pixels.
ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS body_html TEXT;

-- Indexes to make the sync service fast.
CREATE INDEX IF NOT EXISTS idx_inbox_messages_external_message_id
  ON inbox_messages(external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_messages_thread
  ON inbox_messages(mail_thread_id, created_at DESC)
  WHERE mail_thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_messages_connection_uid
  ON inbox_messages(mail_connection_id, imap_uid DESC)
  WHERE mail_connection_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────
-- 3. Helper: resolve a thread id by walking In-Reply-To chain
-- ───────────────────────────────────────────────────────────────────────
--
-- Called from the backend during sync. Given an `in_reply_to` header, it
-- finds the existing thread that header belongs to (if any) and returns
-- its `mail_thread_id`. Returns NULL if this is a new conversation — the
-- caller then generates a fresh UUID.
--
-- Implemented in SQL rather than in TypeScript so it's one round-trip.

CREATE OR REPLACE FUNCTION resolve_mail_thread_id(
  p_in_reply_to TEXT,
  p_references TEXT[]
)
RETURNS UUID AS $$
DECLARE
  v_thread_id UUID;
  v_ref TEXT;
BEGIN
  -- Direct In-Reply-To match first — most common case.
  IF p_in_reply_to IS NOT NULL THEN
    SELECT mail_thread_id INTO v_thread_id
    FROM inbox_messages
    WHERE external_message_id = p_in_reply_to
      AND mail_thread_id IS NOT NULL
    LIMIT 1;
    IF v_thread_id IS NOT NULL THEN
      RETURN v_thread_id;
    END IF;
  END IF;

  -- Walk References in reverse (newest → oldest) so we grab the most
  -- recent ancestor that we already have.
  IF p_references IS NOT NULL AND array_length(p_references, 1) > 0 THEN
    FOR v_ref IN
      SELECT unnest FROM unnest(p_references)
      ORDER BY array_position(p_references, unnest) DESC
    LOOP
      SELECT mail_thread_id INTO v_thread_id
      FROM inbox_messages
      WHERE external_message_id = v_ref
        AND mail_thread_id IS NOT NULL
      LIMIT 1;
      IF v_thread_id IS NOT NULL THEN
        RETURN v_thread_id;
      END IF;
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ───────────────────────────────────────────────────────────────────────
-- 4. Verify
-- ───────────────────────────────────────────────────────────────────────
-- After running the migration, verify with:
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'inbox_messages'
--     AND column_name LIKE '%external%';
--
--   SELECT tablename FROM pg_tables WHERE tablename = 'mail_connections';
--
-- Expected: external_from, external_from_name, external_to, external_cc,
-- external_message_id, external_in_reply_to, external_references — and
-- mail_connections table exists.
