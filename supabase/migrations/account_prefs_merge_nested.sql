-- account_prefs_merge_nested — account_prefs_merge, one level deeper for the
-- slices a caller names.
--
-- Settings audit, 29/09/2026. account_prefs_merge REPLACES each top-level
-- slice, so a tab that owns only part of a slice has to send the whole slice
-- from its own copy — and a stale copy then puts back values another writer
-- just changed:
--   · Display and Language & region both write `display` (formats vs. text
--     size); switching tab before the refresh lands reverts the other's change.
--   · Settings → Notifications and the bell's pause both write
--     `notifications`; toggling a switch while a pause lands loses one.
--
-- For every key of p_patch listed in p_deep whose patch value AND stored value
-- are both JSON objects, the stored object is merged with the patch (`||`),
-- so a writer can send just the fields it changed. Every other key behaves
-- exactly as in account_prefs_merge: replaced, and a top-level null deletes
-- it. A nested null is kept (e.g. notifications.pause_until = null means "not
-- paused"). One UPDATE, so concurrent writers cannot lose each other's keys.

CREATE OR REPLACE FUNCTION public.account_prefs_merge_nested(
  p_account_id uuid,
  p_patch      jsonb,
  p_deep       text[]
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.accounts AS a
     SET preferences = COALESCE(
           (
             SELECT jsonb_object_agg(m.key, m.value)
               FROM jsonb_each(
                      COALESCE(a.preferences, '{}'::jsonb) || COALESCE(
                        (
                          SELECT jsonb_object_agg(
                                   p.key,
                                   CASE
                                     WHEN p.key = ANY (COALESCE(p_deep, ARRAY[]::text[]))
                                      AND jsonb_typeof(p.value) = 'object'
                                      AND jsonb_typeof(a.preferences -> p.key) = 'object'
                                     THEN (a.preferences -> p.key) || p.value
                                     ELSE p.value
                                   END
                                 )
                            FROM jsonb_each(COALESCE(p_patch, '{}'::jsonb)) AS p
                        ),
                        '{}'::jsonb
                      )
                    ) AS m
              WHERE m.value <> 'null'::jsonb
           ),
           '{}'::jsonb
         )
   WHERE a.id = p_account_id
  RETURNING COALESCE(a.preferences, '{}'::jsonb);
$$;

REVOKE ALL ON FUNCTION public.account_prefs_merge_nested(uuid, jsonb, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.account_prefs_merge_nested(uuid, jsonb, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.account_prefs_merge_nested(uuid, jsonb, text[]) FROM authenticated;

COMMENT ON FUNCTION public.account_prefs_merge_nested(uuid, jsonb, text[]) IS
  'account_prefs_merge, but the slices named in p_deep are merged one level '
  'deep (object || object) instead of replaced. Atomic. Service-role only.';
