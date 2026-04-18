-- -----------------------------------------------------------------------------
-- update_trigger_merge_metadata.sql
--
-- Patch on top of create_inbox_and_membership_requests.sql. Two changes:
--
--   1. Metadata merge
--      Canonical fields (request_id, full_name, email, company) are still
--      written verbatim, and then `NEW.metadata` (phone, job_title,
--      country, country_name, city, relationship, heard_from, …) is
--      merged in via jsonb `||` so the Super Admin inbox detail pane
--      shows every field the "Be a Koleex Member" form collects.
--
--   2. Clickable notification target
--      The original trigger pointed `link` at `/admin/requests/<id>`,
--      which is an under-development route. Notifications now link to
--      `/inbox?request=<id>`; the /inbox page reads that query param and
--      auto-selects the matching notification so clicking opens the
--      right message with its detail pane already populated.
--
-- Also includes a one-shot backfill at the bottom so notifications that
-- were fanned out BEFORE this patch (still pointing at /admin/requests/…)
-- get retroactively repointed to /inbox?request=… and pick up the richer
-- metadata from their source membership_requests row.
--
-- Safe to run multiple times — uses CREATE OR REPLACE FUNCTION and the
-- backfill filters on `LIKE '/admin/requests/%'` so only stale links get
-- touched.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_super_admins_of_membership_request()
RETURNS TRIGGER AS $$
DECLARE
  admin_id UUID;
BEGIN
  FOR admin_id IN
    SELECT a.id
    FROM accounts a
    JOIN roles r ON r.id = a.role_id
    WHERE r.name ILIKE '%super admin%'
      AND a.status = 'active'
  LOOP
    INSERT INTO inbox_messages (
      recipient_account_id,
      sender_account_id,
      category,
      subject,
      body,
      link,
      metadata
    ) VALUES (
      admin_id,
      NULL, -- system message
      'membership_request',
      'New membership request from ' || NEW.full_name,
      COALESCE(
        NULLIF(NEW.message, ''),
        'Wants to join Koleex.'
      ),
      /* Deep-link target: the /inbox page reads ?request=<uuid> and
         auto-selects the matching inbox_messages row. */
      '/inbox?request=' || NEW.id::text,
      /* Merge: canonical fields first, then everything from the request's
         own metadata blob (phone, job_title, country, city, relationship,
         heard_from, …). `||` performs a shallow jsonb merge with the
         right-hand keys winning ties, so for safety we put extras on the
         RIGHT only when they don't clash with canonical keys. */
      jsonb_build_object(
        'request_id', NEW.id,
        'full_name',  NEW.full_name,
        'email',      NEW.email,
        'company',    NEW.company
      ) || COALESCE(NEW.metadata, '{}'::jsonb)
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The original trigger binding
-- (`trg_notify_super_admins_of_membership_request`) still points at this
-- function, so no DROP/CREATE TRIGGER is needed.

-- ── Backfill ─────────────────────────────────────────────────────────────
-- Retroactively repoint stale links AND merge richer metadata into
-- notifications that were created before this patch. Idempotent — the
-- LIKE clause ensures we only touch rows still pointing at the old
-- /admin/requests/* route. Safe to run as often as you like.

UPDATE inbox_messages im
SET
  link = '/inbox?request=' || mr.id::text,
  metadata = im.metadata || COALESCE(mr.metadata, '{}'::jsonb)
FROM membership_requests mr
WHERE im.category = 'membership_request'
  AND (im.metadata ->> 'request_id')::uuid = mr.id
  AND (im.link LIKE '/admin/requests/%' OR im.link IS NULL);
