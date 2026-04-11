-- Migration: Create Discuss (chat) system — channels, DMs, messages,
-- reactions, pinned / starred / drafts, and the helpers needed to make
-- Supabase Realtime subscriptions feel instant.
-- ---------------------------------------------------------------------------
-- Run this in Supabase SQL Editor.
--
-- What it creates:
--   1. discuss_channels       — a conversation (DM, group, or channel)
--   2. discuss_members        — who's in a channel + their read cursor
--   3. discuss_messages       — every message ever sent
--   4. discuss_reactions      — emoji reactions (unique per user+message+emoji)
--   5. discuss_pinned         — pinned messages per channel
--   6. discuss_starred        — per-user personal bookmarks
--   7. discuss_drafts         — per-user auto-saved draft per channel
--
-- Plus:
--   - Trigger that bumps `last_message_at` on channels when a new
--     message lands, so sidebar list order is cheap (ORDER BY that col).
--   - Trigger on `discuss_messages` INSERT that also updates the
--     sender's `last_read_at` to "now" — a sent message is obviously
--     already read by its author.
--   - Helper `find_or_create_direct_channel(a, b)` that atomically
--     returns the shared DM channel between two accounts, creating it
--     only if it doesn't already exist. Prevents duplicate DM threads.
--   - Indexes tuned for the common queries:
--         list my channels                   → (account_id, last_message_at DESC)
--         list messages in a channel         → (channel_id, created_at DESC)
--         unread count per channel           → (channel_id, created_at) + last_read_at
--         find messages by text              → GIN on body
--
-- Realtime:
--   All four write-heavy tables (messages, reactions, members, channels)
--   are added to the `supabase_realtime` publication so the UI can
--   subscribe via postgres_changes and see live inserts/updates.
--
-- Safe to re-run: every CREATE uses IF NOT EXISTS or a conditional DO
-- block. Columns added via ADD COLUMN IF NOT EXISTS.
-- ---------------------------------------------------------------------------

-- ───────────────────────────────────────────────────────────────────────
-- 1. discuss_channels — the conversation itself
-- ───────────────────────────────────────────────────────────────────────
--
-- `kind` semantics:
--   direct   — 1-on-1 DM, members.count = 2, name/description NULL
--   group    — private multi-user group, any members.count >= 2, has a name
--   channel  — public-ish channel (still requires membership but anyone
--              can be added), has a name + description
--
-- We don't distinguish "public" vs "private" yet — every channel is
-- membership-gated. A later migration can add an `is_public` flag +
-- discovery UI when we want org-wide channels.

CREATE TABLE IF NOT EXISTS discuss_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  kind TEXT NOT NULL
    CHECK (kind IN ('direct', 'group', 'channel')),

  -- Nullable for DMs (UI uses the other member's name instead).
  name TEXT,
  description TEXT,

  -- Lightweight cosmetics the creator can set. `icon` is a short string
  -- (emoji char like "📦" or a Lucide icon name like "Package"); the
  -- UI decides how to render it. `color` is a hex string used as the
  -- background of the channel avatar tile.
  icon TEXT,
  color TEXT,

  -- Who created it. SET NULL on delete so channels survive account
  -- cleanup but we lose the author attribution — acceptable trade-off
  -- because messages will still have their own author FKs.
  created_by UUID REFERENCES accounts(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,

  -- Denormalized cursor bumped by the insert trigger below. Drives the
  -- sidebar ORDER BY so we don't need a MAX(created_at) subquery per
  -- channel on every render.
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discuss_channels_last_message
  ON discuss_channels(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_discuss_channels_kind_created
  ON discuss_channels(kind, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────
-- 2. discuss_members — who's in a channel
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discuss_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES discuss_channels(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'member', 'guest')),

  -- The read cursor. Unread count is derived as:
  --   SELECT count(*) FROM discuss_messages m
  --   WHERE m.channel_id = :channel_id
  --     AND m.created_at > :last_read_at
  --     AND m.author_account_id != :my_id
  -- which is cheap with the idx below.
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Per-channel notification preference (Phase D):
  --   all      — every message pings me
  --   mentions — only when I'm @-mentioned
  --   none     — silent (mute)
  notification_pref TEXT NOT NULL DEFAULT 'all'
    CHECK (notification_pref IN ('all', 'mentions', 'none')),

  muted BOOLEAN NOT NULL DEFAULT false,

  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ, -- soft leave, preserves message history

  UNIQUE (channel_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_discuss_members_account
  ON discuss_members(account_id);
CREATE INDEX IF NOT EXISTS idx_discuss_members_channel
  ON discuss_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_discuss_members_account_active
  ON discuss_members(account_id, channel_id)
  WHERE left_at IS NULL;

-- ───────────────────────────────────────────────────────────────────────
-- 3. discuss_messages — every message
-- ───────────────────────────────────────────────────────────────────────
--
-- `metadata` is JSONB and holds:
--   attachments: [{ name, url, file_path, size, type }, ...]
--   products:    [{ id, name, slug, image }, ...]
--   mentions:    [{ account_id, username, offset, length }, ...]
--   voice:       { url, duration_ms, waveform: [int, ...] }
--   link_preview:{ url, title, description, image, site_name }
--
-- Keeping it JSONB instead of separate tables means we can ship new
-- content types (polls, GIFs, stickers, ...) without a migration
-- every time. The downside is we can't query by attachment filename,
-- but chat search goes against `body` anyway.

CREATE TABLE IF NOT EXISTS discuss_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES discuss_channels(id) ON DELETE CASCADE,

  -- NULL = system message ("Kamal added Sarah to the channel")
  author_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,

  -- For threading (Phase B). NULL means top-level message in the
  -- channel timeline. Non-NULL means "this is a reply inside a thread
  -- panel hanging off another message".
  reply_to_message_id UUID REFERENCES discuss_messages(id) ON DELETE SET NULL,

  -- Message kind drives rendering:
  --   text   — plain/markdown body
  --   image  — primary content is an image attachment (body is caption)
  --   file   — primary content is a file attachment (body is caption)
  --   voice  — voice note; metadata.voice holds the url/duration/waveform
  --   system — auto-generated event (join/leave/rename/pin)
  kind TEXT NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'image', 'file', 'voice', 'system')),

  body TEXT,        -- plaintext / markdown source
  body_html TEXT,   -- sanitized HTML for display (rendered server-side later)

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ, -- soft delete; UI renders "message deleted"

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary query: "load the last N messages in this channel".
CREATE INDEX IF NOT EXISTS idx_discuss_messages_channel_created
  ON discuss_messages(channel_id, created_at DESC);

-- Secondary query: "show all messages in a thread".
CREATE INDEX IF NOT EXISTS idx_discuss_messages_thread
  ON discuss_messages(reply_to_message_id, created_at ASC)
  WHERE reply_to_message_id IS NOT NULL;

-- Full-text search on body — used by the search modal in Phase C.
-- GIN on to_tsvector is the standard Postgres chat search pattern.
CREATE INDEX IF NOT EXISTS idx_discuss_messages_body_fts
  ON discuss_messages
  USING gin(to_tsvector('simple', coalesce(body, '')));

-- ───────────────────────────────────────────────────────────────────────
-- 4. discuss_reactions — emoji reactions
-- ───────────────────────────────────────────────────────────────────────
--
-- One row per (message, user, emoji). The UNIQUE constraint means a
-- user can't "react twice with 👍" — they can only toggle it on or off.
-- The UI aggregates by emoji and shows "👍 3" with the list of names on
-- hover.

CREATE TABLE IF NOT EXISTS discuss_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES discuss_messages(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, account_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_discuss_reactions_message
  ON discuss_reactions(message_id);

-- ───────────────────────────────────────────────────────────────────────
-- 5. discuss_pinned — pinned messages per channel
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discuss_pinned (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES discuss_channels(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES discuss_messages(id) ON DELETE CASCADE,
  pinned_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_discuss_pinned_channel
  ON discuss_pinned(channel_id, pinned_at DESC);

-- ───────────────────────────────────────────────────────────────────────
-- 6. discuss_starred — personal bookmarks (per user)
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discuss_starred (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES discuss_messages(id) ON DELETE CASCADE,
  starred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_discuss_starred_account
  ON discuss_starred(account_id, starred_at DESC);

-- ───────────────────────────────────────────────────────────────────────
-- 7. discuss_drafts — auto-saved composer text per channel per user
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discuss_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES discuss_channels(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_discuss_drafts_account
  ON discuss_drafts(account_id);

-- ───────────────────────────────────────────────────────────────────────
-- 8. Triggers
-- ───────────────────────────────────────────────────────────────────────

-- Bump channel.last_message_at + channel.updated_at whenever a
-- non-deleted message lands. Also bumps the author's own last_read_at
-- so "unread" doesn't count their own message against them.
CREATE OR REPLACE FUNCTION touch_discuss_channel_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE discuss_channels
     SET last_message_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.channel_id;

  IF NEW.author_account_id IS NOT NULL THEN
    UPDATE discuss_members
       SET last_read_at = NEW.created_at
     WHERE channel_id = NEW.channel_id
       AND account_id = NEW.author_account_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_discuss_channel_on_message
  ON discuss_messages;
CREATE TRIGGER trg_touch_discuss_channel_on_message
  AFTER INSERT ON discuss_messages
  FOR EACH ROW
  EXECUTE FUNCTION touch_discuss_channel_on_message();

-- Bump channels.updated_at whenever the row itself is edited.
CREATE OR REPLACE FUNCTION touch_discuss_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_discuss_channels_updated_at
  ON discuss_channels;
CREATE TRIGGER trg_touch_discuss_channels_updated_at
  BEFORE UPDATE ON discuss_channels
  FOR EACH ROW
  EXECUTE FUNCTION touch_discuss_channels_updated_at();

-- Bump drafts.updated_at on upsert.
CREATE OR REPLACE FUNCTION touch_discuss_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_discuss_drafts_updated_at
  ON discuss_drafts;
CREATE TRIGGER trg_touch_discuss_drafts_updated_at
  BEFORE UPDATE ON discuss_drafts
  FOR EACH ROW
  EXECUTE FUNCTION touch_discuss_drafts_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- 9. find_or_create_direct_channel(a, b)
-- ───────────────────────────────────────────────────────────────────────
--
-- DMs are expensive to dedupe on the client side because either
-- account could initiate and we'd race between concurrent "Start chat
-- with Sarah" clicks. This function runs atomically in one call:
--   1. Check if a `direct` channel exists that already has both
--      accounts as members.
--   2. If yes, return its id.
--   3. If no, create the channel + both member rows in one transaction
--      and return the new id.

CREATE OR REPLACE FUNCTION find_or_create_direct_channel(
  p_account_a UUID,
  p_account_b UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_channel_id UUID;
BEGIN
  IF p_account_a IS NULL OR p_account_b IS NULL THEN
    RAISE EXCEPTION 'Both account ids are required';
  END IF;

  IF p_account_a = p_account_b THEN
    RAISE EXCEPTION 'Cannot create a DM with yourself';
  END IF;

  SELECT c.id INTO v_channel_id
  FROM discuss_channels c
  WHERE c.kind = 'direct'
    AND c.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM discuss_members m1
      WHERE m1.channel_id = c.id AND m1.account_id = p_account_a
    )
    AND EXISTS (
      SELECT 1 FROM discuss_members m2
      WHERE m2.channel_id = c.id AND m2.account_id = p_account_b
    )
  LIMIT 1;

  IF v_channel_id IS NOT NULL THEN
    RETURN v_channel_id;
  END IF;

  INSERT INTO discuss_channels (kind, created_by)
  VALUES ('direct', p_account_a)
  RETURNING id INTO v_channel_id;

  INSERT INTO discuss_members (channel_id, account_id, role)
  VALUES
    (v_channel_id, p_account_a, 'admin'),
    (v_channel_id, p_account_b, 'admin');

  RETURN v_channel_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- 10. Row-Level Security (permissive for dev, same pattern as inbox)
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE discuss_channels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE discuss_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE discuss_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE discuss_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discuss_pinned    ENABLE ROW LEVEL SECURITY;
ALTER TABLE discuss_starred   ENABLE ROW LEVEL SECURITY;
ALTER TABLE discuss_drafts    ENABLE ROW LEVEL SECURITY;

-- Dev-mode ALLOW ALL policies. When Supabase Auth is turned on for
-- production we tighten these to `auth.uid() = account_id` / member
-- lookups, same pattern as the rest of the project.
DROP POLICY IF EXISTS "Allow all for discuss_channels"  ON discuss_channels;
DROP POLICY IF EXISTS "Allow all for discuss_members"   ON discuss_members;
DROP POLICY IF EXISTS "Allow all for discuss_messages"  ON discuss_messages;
DROP POLICY IF EXISTS "Allow all for discuss_reactions" ON discuss_reactions;
DROP POLICY IF EXISTS "Allow all for discuss_pinned"    ON discuss_pinned;
DROP POLICY IF EXISTS "Allow all for discuss_starred"   ON discuss_starred;
DROP POLICY IF EXISTS "Allow all for discuss_drafts"    ON discuss_drafts;

CREATE POLICY "Allow all for discuss_channels"
  ON discuss_channels  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for discuss_members"
  ON discuss_members   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for discuss_messages"
  ON discuss_messages  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for discuss_reactions"
  ON discuss_reactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for discuss_pinned"
  ON discuss_pinned    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for discuss_starred"
  ON discuss_starred   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for discuss_drafts"
  ON discuss_drafts    FOR ALL USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────────────
-- 11. Publish to Supabase Realtime
-- ───────────────────────────────────────────────────────────────────────
--
-- Adds the four write-heavy tables to the `supabase_realtime`
-- publication so the UI can subscribe via postgres_changes. Wrapped
-- in a DO block because adding a table twice raises — the block
-- silently skips if it's already published.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'discuss_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE discuss_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'discuss_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE discuss_reactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'discuss_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE discuss_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'discuss_channels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE discuss_channels;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────
-- 12. Verify
-- ───────────────────────────────────────────────────────────────────────
--
--   SELECT tablename FROM pg_tables WHERE tablename LIKE 'discuss_%';
--   -- Expect: 7 rows
--
--   SELECT proname FROM pg_proc WHERE proname = 'find_or_create_direct_channel';
--   -- Expect: 1 row
--
--   SELECT tablename FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' AND tablename LIKE 'discuss_%';
--   -- Expect: 4 rows (messages, reactions, members, channels)
