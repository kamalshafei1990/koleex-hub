-- ============================================================================
-- 20260926_discuss_additions — Discuss feature additions (failed-send retry,
-- channel admin tools, mark-all-read).
--
-- Idempotent: safe to run more than once. NOT applied automatically. The app
-- degrades gracefully without it (notes per section).
-- ============================================================================

-- 1) Idempotent sends. POST /api/discuss/mutate { action: "sendMessage" }
--    inserts client_msg_id and treats a 23505 on (channel_id, client_msg_id)
--    as "this exact send already committed" — which is what makes the new
--    "Not sent — Retry" action safe to press after a timed-out send. The
--    column + index were documented in docs/performance/DISCUSS_MESSAGE_
--    LIFECYCLE.md and are expected to exist already; these statements are
--    no-ops then, and create them on any database that missed that step.
ALTER TABLE public.discuss_messages
  ADD COLUMN IF NOT EXISTS client_msg_id uuid NULL;

CREATE UNIQUE INDEX IF NOT EXISTS discuss_messages_channel_client_msg_id_key
  ON public.discuss_messages (channel_id, client_msg_id)
  WHERE client_msg_id IS NOT NULL;

-- 2) "Mark all as read" (action markAllRead) updates every ACTIVE membership
--    of one account in a single statement; the sidebar read (myChannels) and
--    the SSE stream's membership refresh filter the same way. Without this
--    index both still work (sequential scan of the caller's rows).
CREATE INDEX IF NOT EXISTS idx_discuss_members_account_active
  ON public.discuss_members (account_id)
  WHERE left_at IS NULL;

-- 3) Channel admin tools (removeMember / setMemberRole / last-admin handover
--    on leaveChannel) read the active members of ONE channel by role.
CREATE INDEX IF NOT EXISTS idx_discuss_members_channel_active
  ON public.discuss_members (channel_id, role)
  WHERE left_at IS NULL;
