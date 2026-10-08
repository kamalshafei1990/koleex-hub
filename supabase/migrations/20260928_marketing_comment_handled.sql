-- ---------------------------------------------------------------------------
-- Social Marketing comment replies. Owner-approved 28/09/2026. ADDITIVE.
--
--   marketing_comments.handled_at / handled_by  «No reply needed»: someone
--       looked at a comment thread and decided it needs no answer (a thank
--       you, an emoji). Set on the thread's first comment. The thread leaves
--       the «Needs a reply» list until someone writes in it again — a newer
--       comment than handled_at brings it back on its own. Cleared when a
--       person takes it back. handled_by is the account that decided.
-- Rollback: ALTER TABLE marketing_comments DROP COLUMN handled_at, DROP COLUMN handled_by;
-- ---------------------------------------------------------------------------

ALTER TABLE marketing_comments
  ADD COLUMN IF NOT EXISTS handled_at timestamptz,
  ADD COLUMN IF NOT EXISTS handled_by uuid;
