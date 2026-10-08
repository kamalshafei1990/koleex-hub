-- ---------------------------------------------------------------------------
-- CEO Brand: the JD's content check on a post (KX-CEO-JD-001 v2.0 §15).
-- Owner-approved 30/09/2026 («أيوه، ضيفه» — one new column). ADDITIVE.
--
--   content_check  { confirmed_by, confirmed_at, ai: { at, sig, text, pictures } }
--       · confirmed_*: who confirmed, when sending the post to the CEO, that it
--         shows none of the JD's not-allowed content;
--       · ai: Koleex AI's reading of the words and of each picture against
--         that list — a warning for the CEO, never a block; sig ties it to
--         the words and pictures it read (an edit makes it stale).
--       null = never checked (every post before this, and company posts).
--
-- Rollback: ALTER TABLE marketing_posts DROP COLUMN content_check;
-- ---------------------------------------------------------------------------

ALTER TABLE marketing_posts ADD COLUMN IF NOT EXISTS content_check jsonb;
