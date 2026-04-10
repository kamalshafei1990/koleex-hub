-- ============================================================================
-- Add avatar_url to accounts
--
-- Stores the account's profile picture as a data URL (e.g.
--   data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA…
-- ) so we don't need a Supabase Storage bucket to ship avatar upload.
-- Client-side resize keeps these under ~30 KB. If/when we migrate to Storage,
-- this column will hold the public object URL instead — same type, same
-- AccountDetail/UserMenu code path.
--
-- AccountDetail already reads `people.avatar_url` as a fallback for accounts
-- that are linked to a person. This new column overrides that fallback so
-- users can set a picture even when no person record is linked.
--
-- This migration is idempotent and safe to re-run.
-- ============================================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN accounts.avatar_url IS
  'Account profile picture. Either a data URL (data:image/...) or a public object URL. Wins over people.avatar_url when both are set.';

-- ============================================================================
-- Done.
-- ============================================================================
