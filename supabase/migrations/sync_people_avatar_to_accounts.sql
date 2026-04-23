-- ============================================================================
-- sync_people_avatar_to_accounts
--
-- Keep accounts.avatar_url in sync with people.avatar_url. The Add Employee
-- flow writes the photo to both tables at creation, but later updates
-- (employee edits their own photo, admin updates from Contacts) only touch
-- people.avatar_url. The MainHeader reads accounts.avatar_url — so the user
-- sees a stale photo forever.
--
-- Simplest fix: a trigger that mirrors the column on every people row UPDATE
-- of avatar_url. The link is accounts.person_id -> people.id. Silent no-op
-- for people without a linked account row.
--
-- Applied 2026-04-23 via MCP; this file is kept so fresh environments pick
-- up the same behaviour.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_people_avatar_to_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
    UPDATE public.accounts
       SET avatar_url = NEW.avatar_url,
           updated_at = now()
     WHERE person_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_people_avatar ON public.people;
CREATE TRIGGER trg_sync_people_avatar
AFTER UPDATE OF avatar_url ON public.people
FOR EACH ROW
EXECUTE FUNCTION public.sync_people_avatar_to_accounts();

-- Backfill any existing drift so current rows match.
UPDATE public.accounts a
   SET avatar_url = p.avatar_url
  FROM public.people p
 WHERE a.person_id = p.id
   AND a.avatar_url IS DISTINCT FROM p.avatar_url;
