-- ---------------------------------------------------------------------------
-- Social Marketing composer (phase 1). Owner-approved 27/09/2026. ADDITIVE.
--
--   marketing_post_targets.publish_state  where publishing to this account
--       stands between two calls: Instagram prepares a video (or an album
--       with a video) before it can be published, so the prepared container
--       and when it was started are kept here until Meta says it is ready.
--       Also the photo ids of a Facebook album while it is being assembled.
--       Never an access key.
-- ---------------------------------------------------------------------------

ALTER TABLE marketing_post_targets
  ADD COLUMN IF NOT EXISTS publish_state jsonb NOT NULL DEFAULT '{}'::jsonb;
