-- ============================================================================
-- sync_accounts_avatar_to_people
--
-- Reverse direction of the existing sync_people_avatar_to_accounts mirror.
-- When an admin uploads an avatar from the Accounts app it writes to
-- accounts.avatar_url; other surfaces (employee list, employee profile,
-- sidebar user menu, contacts picker, CRM avatars) read from
-- people.avatar_url via the account→person join. Without this reverse
-- mirror, the photo lands on the account row but every other page still
-- shows initials.
--
-- The `IS DISTINCT FROM` guard prevents an infinite loop between the two
-- triggers: once the values match on the other side, its trigger's UPDATE
-- becomes a no-op.
--
-- Applied 2026-04-23 via MCP; this file is kept so fresh environments pick
-- up the same behaviour.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_accounts_avatar_to_people()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
     AND NEW.person_id IS NOT NULL THEN
    UPDATE public.people
       SET avatar_url = NEW.avatar_url,
           updated_at = now()
     WHERE id = NEW.person_id
       AND avatar_url IS DISTINCT FROM NEW.avatar_url;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_accounts_avatar ON public.accounts;
CREATE TRIGGER trg_sync_accounts_avatar
AFTER UPDATE OF avatar_url ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_accounts_avatar_to_people();

-- Backfill existing drift.
UPDATE public.people p
   SET avatar_url = a.avatar_url,
       updated_at = now()
  FROM public.accounts a
 WHERE a.person_id = p.id
   AND p.avatar_url IS NULL
   AND a.avatar_url IS NOT NULL;
