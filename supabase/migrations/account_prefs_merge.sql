-- ============================================================================
-- account_prefs_merge — fix finding N12, the write race on accounts.preferences
--
-- THE DEFECT. Three paths write that JSONB column and all three read-modify-
-- write the whole document:
--
--   · ai-agent/tools/user-memory.ts   remember_about_user / forget_about_user
--   · ai/reply-language.ts             setReplyLanguage
--   · api/accounts/[id]/preferences    the user changing their own settings
--
-- Any write landing between another's read and its write is silently lost.
-- It is reachable in ONE message, because the language write is fire-and-
-- forget (`void setReplyLanguage(...)`) and therefore runs concurrently with
-- the whole turn:
--
--   "reply to me in Arabic, and remember my birthday is 3 May"
--     → both read the same prefs; whichever writes second erases the other.
--
-- The user asked for two things and one vanishes with no error.
--
-- THE FIX. One statement. `||` is applied inside the UPDATE, so there is no
-- gap between reading and writing for a concurrent write to fall into.
--
-- SHALLOW MERGE, DELIBERATELY. `||` replaces top-level keys rather than deep-
-- merging them. That is required, not incidental: forget_about_user works by
-- writing a SMALLER ai_memory object, and a deep merge would make key removal
-- impossible — the deleted key would survive every attempt to remove it.
--
-- A NULL VALUE DELETES. Passing {"ai_reply_language": null} would otherwise
-- store a JSON null rather than removing the key, and `setReplyLanguage(null)`
-- means "clear it". Nulls are stripped after the merge so the two agree.
--
-- SECURITY. SECURITY DEFINER with a pinned empty search_path — the same shape
-- as ai_rate_limit_hit(). EXECUTE is revoked from PUBLIC, anon and
-- authenticated: only the service role calls this, and the service role is
-- the only thing that reaches it. It cannot be used to read another account's
-- preferences: it returns only the row it just wrote, for the id it was given,
-- and the caller has already established that id from the session.
--
-- ROLLBACK.  DROP FUNCTION public.account_prefs_merge(uuid, jsonb);
-- The callers revert to read-modify-write with one commit; the function
-- existing but unused is harmless, so the order of the two does not matter.
--
-- LOAD. Strictly less than today: one round-trip instead of two, at the same
-- write volume.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.account_prefs_merge(
  p_account_id uuid,
  p_patch      jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.accounts
     SET preferences = COALESCE(
           (
             SELECT jsonb_object_agg(key, value)
               FROM jsonb_each(
                      COALESCE(public.accounts.preferences, '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb)
                    )
              WHERE value <> 'null'::jsonb
           ),
           -- jsonb_object_agg over an EMPTY set returns NULL, not '{}'. Without
           -- this COALESCE, merging a patch that leaves no non-null keys would
           -- set the column to NULL and wipe the row's preferences entirely.
           -- The failure needs both an empty starting document and an all-null
           -- patch, which is exactly the kind of case that reaches production
           -- rather than a test.
           '{}'::jsonb
         )
   WHERE id = p_account_id
  RETURNING COALESCE(preferences, '{}'::jsonb);
$$;

-- Service-role only, matching ai_pending_actions / ai_rate_limits.
REVOKE ALL ON FUNCTION public.account_prefs_merge(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.account_prefs_merge(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.account_prefs_merge(uuid, jsonb) FROM authenticated;

COMMENT ON FUNCTION public.account_prefs_merge(uuid, jsonb) IS
  'Atomic shallow merge into accounts.preferences. Fixes finding N12 (lost '
  'writes from concurrent read-modify-write). Top-level keys are REPLACED, not '
  'deep-merged, so a smaller nested object removes keys. A null value deletes '
  'its key. Service-role only.';
