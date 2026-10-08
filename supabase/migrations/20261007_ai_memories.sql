-- ai_memories — one row per remembered fact about a user (owner, 2026-10-07).
--
-- Why a table: the JSON store (accounts.preferences.ai_memory) capped at 25
-- facts by reading the whole object, editing it and writing it back — two
-- remember_about_user calls landing together could lose a fact (documented in
-- user-memory.ts as "the race that remains"). A row per fact makes every
-- write a single atomic UPSERT; nothing is read-modify-write anymore.
--
-- Access: every read and write goes through the server (the agent tools and
-- the personalization route use the service role). RLS is enabled with NO
-- policies, so anon/authenticated roles get nothing — same posture as the
-- preferences RPC.

CREATE TABLE IF NOT EXISTS public.ai_memories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  key        TEXT NOT NULL CHECK (char_length(key) BETWEEN 1 AND 40 AND key ~ '^[a-z0-9_]+$'),
  value      TEXT NOT NULL CHECK (char_length(value) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, key)
);

CREATE INDEX IF NOT EXISTS idx_ai_memories_account ON public.ai_memories (account_id, created_at);

ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ai_memories IS
  'One remembered fact per row about a user (Koleex AI memory). Written by '
  'remember_about_user, read into every prompt context, managed in Settings '
  '→ Koleex AI. Service-role only — RLS has no policies on purpose.';

-- The 25-fact cap as one statement: delete everything older than the newest
-- p_keep rows for the account. Called right after each upsert.
CREATE OR REPLACE FUNCTION public.ai_memories_cap(p_account_id uuid, p_keep integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.ai_memories
   WHERE account_id = p_account_id
     AND id NOT IN (
       SELECT id FROM public.ai_memories
        WHERE account_id = p_account_id
        ORDER BY created_at DESC
        LIMIT p_keep
     );
$$;

REVOKE ALL ON FUNCTION public.ai_memories_cap(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_memories_cap(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.ai_memories_cap(uuid, integer) FROM authenticated;

-- Carry the existing JSON facts over. Oldest-first ordering is preserved via
-- created_at from jsonb insertion order (ordinality), so the 25-cap keeps the
-- same newest facts it kept in JSON.
INSERT INTO public.ai_memories (account_id, key, value, created_at, updated_at)
SELECT a.id,
       e.key,
       e.value,
       now() + (e.ordinality || ' milliseconds')::interval,
       now() + (e.ordinality || ' milliseconds')::interval
FROM public.accounts a
CROSS JOIN LATERAL jsonb_each_text(COALESCE(a.preferences -> 'ai_memory', '{}'::jsonb))
  WITH ORDINALITY AS e(key, value, ordinality)
WHERE a.preferences ? 'ai_memory'
  AND char_length(e.key) BETWEEN 1 AND 40
  AND e.key ~ '^[a-z0-9_]+$'
  AND char_length(e.value) BETWEEN 1 AND 200
ON CONFLICT (account_id, key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
