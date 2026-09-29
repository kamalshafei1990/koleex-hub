-- ---------------------------------------------------------------------------
-- Social Marketing Messages: the customer's picture. Owner-approved
-- 29/09/2026 («آه، ضيفها» — two new columns). ADDITIVE.
--
--   customer_avatar_url  the picture Meta's profile API returned for the
--       customer (Messenger PSID / Instagram IGSID). Meta's picture links
--       expire, so it is read again after a while; null = no picture.
--   customer_avatar_at   when it was last read (null = never tried).
--
-- Rollback: ALTER TABLE marketing_conversations DROP COLUMN customer_avatar_url,
--           DROP COLUMN customer_avatar_at;
-- ---------------------------------------------------------------------------

ALTER TABLE marketing_conversations ADD COLUMN IF NOT EXISTS customer_avatar_url text;
ALTER TABLE marketing_conversations ADD COLUMN IF NOT EXISTS customer_avatar_at timestamptz;
