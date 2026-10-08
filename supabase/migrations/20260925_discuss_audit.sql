-- ============================================================================
-- 20260925_discuss_audit — Discuss security + performance audit follow-ups.
--
-- Idempotent: safe to run more than once. NOT applied automatically; the app
-- works without it (see the notes per section for the fallback each piece
-- has in code).
-- ============================================================================

-- 1) Customer-channel RPC: SECURITY DEFINER, took the creator id from the
--    caller, and was EXECUTE-able by anon. The app now creates customer
--    chats through POST /api/discuss/mutate { action: "createCustomerChannel" }
--    (session identity + tenant), so nothing but the service role needs it.
--    Same for the DM helper, which the mutate route calls as service_role.
DO $$
BEGIN
  IF to_regprocedure('public.find_or_create_customer_channel(uuid, uuid, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.find_or_create_customer_channel(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.find_or_create_customer_channel(uuid, uuid, text) TO service_role;
  END IF;
  IF to_regprocedure('public.find_or_create_direct_channel(uuid, uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.find_or_create_direct_channel(uuid, uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.find_or_create_direct_channel(uuid, uuid) TO service_role;
  END IF;
END $$;

-- 2) Search: /api/discuss/read?resource=search runs body ILIKE '%q%', which
--    the existing to_tsvector GIN index cannot serve. A trigram index can.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_discuss_messages_body_trgm
  ON public.discuss_messages
  USING gin (body gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- 3) Every hot read (channel page, sidebar preview, unread count, stream
--    cursor) filters deleted_at IS NULL; a partial index keeps tombstones
--    out of those scans.
CREATE INDEX IF NOT EXISTS idx_discuss_messages_channel_created_live
  ON public.discuss_messages (channel_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- 4) Sidebar preview: the newest live message of EACH channel in one call.
--    Used by /api/discuss/read?resource=myChannels when present; without it
--    the route falls back to a batched window + per-channel `limit 1`.
CREATE OR REPLACE FUNCTION public.discuss_last_messages(p_channel_ids uuid[])
RETURNS TABLE (
  id uuid,
  channel_id uuid,
  body text,
  kind text,
  author_account_id uuid,
  author_username text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT m.id, m.channel_id, m.body, m.kind, m.author_account_id, a.username, m.created_at
  FROM unnest(p_channel_ids) AS c(cid)
  CROSS JOIN LATERAL (
    SELECT dm.id, dm.channel_id, dm.body, dm.kind, dm.author_account_id, dm.created_at
    FROM public.discuss_messages dm
    WHERE dm.channel_id = c.cid
      AND dm.deleted_at IS NULL
    ORDER BY dm.created_at DESC
    LIMIT 1
  ) m
  LEFT JOIN public.accounts a ON a.id = m.author_account_id;
$$;

REVOKE ALL ON FUNCTION public.discuss_last_messages(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discuss_last_messages(uuid[]) TO service_role;
