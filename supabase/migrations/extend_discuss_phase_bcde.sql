-- ---------------------------------------------------------------------------
-- extend_discuss_phase_bcde — Phase B/C/D/E schema additions for Discuss.
--
-- What this migration does:
--   1. Adds `customer` to the `discuss_channels.kind` CHECK constraint so
--      external customer chats can live in the same table.
--   2. Adds `linked_contact_id` column on `discuss_channels`, nullable,
--      FK to the `contacts` table so a customer-chat channel knows which
--      CRM record it's bound to.
--   3. Partial index on `linked_contact_id` to make "find the customer
--      chat for contact X" O(log n).
--   4. No-op upsert of the Realtime publication to make sure new columns
--      propagate to WebSocket subscribers.
--
-- Idempotent: every statement is wrapped in `IF NOT EXISTS` or
-- drop-then-recreate so re-running this migration is always safe.
-- ---------------------------------------------------------------------------

-- 1) Extend the channel-kind CHECK constraint to allow 'customer'.
--    We drop-then-add because Postgres CHECK constraints are immutable
--    once created. If a previous run used the old name, we remove
--    both variants to be safe.
ALTER TABLE IF EXISTS discuss_channels
  DROP CONSTRAINT IF EXISTS discuss_channels_kind_check;

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Some Supabase-generated constraints pick up a shorter auto-name.
  -- Best-effort cleanup: scan for any constraint starting with the
  -- "kind" column and drop it.
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'discuss_channels'::regclass
      AND contype = 'c'
      AND conname LIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE discuss_channels DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE discuss_channels
  ADD CONSTRAINT discuss_channels_kind_check
  CHECK (kind IN ('direct', 'group', 'channel', 'customer'));

-- 2) Link a channel to a CRM contact (customer-chat support).
--    NULL for every existing team channel; populated only when the
--    channel was created via the "Start customer chat" flow.
ALTER TABLE discuss_channels
  ADD COLUMN IF NOT EXISTS linked_contact_id UUID
    REFERENCES contacts(id) ON DELETE SET NULL;

-- 3) Lookup index: "given a contact, do we already have a customer
--    channel for them?". Partial so we only pay for customer rows.
CREATE INDEX IF NOT EXISTS discuss_channels_linked_contact_idx
  ON discuss_channels(linked_contact_id)
  WHERE linked_contact_id IS NOT NULL;

-- 4) Helper RPC to atomically find-or-create the customer channel
--    for a given contact. Mirrors `find_or_create_direct_channel` —
--    avoids the race where two team members click "Start customer
--    chat" simultaneously and create duplicate rows. Team members are
--    added separately by the client via addMembers().
CREATE OR REPLACE FUNCTION find_or_create_customer_channel(
  p_contact_id UUID,
  p_created_by UUID,
  p_display_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_channel_id UUID;
BEGIN
  SELECT id INTO v_channel_id
  FROM discuss_channels
  WHERE kind = 'customer'
    AND linked_contact_id = p_contact_id
    AND archived_at IS NULL
  LIMIT 1;

  IF v_channel_id IS NOT NULL THEN
    RETURN v_channel_id;
  END IF;

  INSERT INTO discuss_channels (kind, name, linked_contact_id, created_by)
  VALUES ('customer', p_display_name, p_contact_id, p_created_by)
  RETURNING id INTO v_channel_id;

  -- Auto-add the creator as admin so the channel is immediately visible
  -- in their sidebar. Other team members join via the UI.
  INSERT INTO discuss_members (channel_id, account_id, role)
  VALUES (v_channel_id, p_created_by, 'admin')
  ON CONFLICT DO NOTHING;

  RETURN v_channel_id;
END;
$$;

-- Grant execute so both anon and authenticated roles can call it from
-- the client. (In dev we use anon; switch to `authenticated` only when
-- you flip RLS on later.)
GRANT EXECUTE ON FUNCTION find_or_create_customer_channel(UUID, UUID, TEXT)
  TO anon, authenticated, service_role;

-- 5) (Re)ensure the Realtime publication covers discuss_messages so
--    new columns added in future migrations get streamed to clients.
--    No-op if discuss_messages is already in the publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'discuss_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE discuss_messages;
  END IF;
END $$;
