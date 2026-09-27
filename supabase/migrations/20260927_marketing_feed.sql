-- ---------------------------------------------------------------------------
-- Social Marketing Feed (phase 1). Owner-approved 27/09/2026. ADDITIVE ONLY.
--
--   marketing_accounts.audience   the account's followers now, refreshed on
--                                 every sync (the column header of the Feed).
--   marketing_accounts.sync_state where the history import stopped (Meta's
--                                 paging cursor) and what the last sync saw,
--                                 so a long import resumes instead of
--                                 starting over.
--   marketing_account_days        one row per account per day: the audience,
--                                 posts and engagement that day, so the Feed
--                                 can show the change against a week ago.
--
-- Server-only like the other marketing_* tables: RLS on, no policies.
-- ---------------------------------------------------------------------------

ALTER TABLE marketing_accounts
  ADD COLUMN IF NOT EXISTS audience integer,
  ADD COLUMN IF NOT EXISTS sync_state jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS marketing_account_days (
  account_id uuid NOT NULL REFERENCES marketing_accounts(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  day        date NOT NULL,
  audience   integer,
  posts      integer,
  engagement integer,
  PRIMARY KEY (account_id, day)
);
CREATE INDEX IF NOT EXISTS marketing_account_days_tenant_idx ON marketing_account_days (tenant_id, day DESC);

ALTER TABLE marketing_account_days ENABLE ROW LEVEL SECURITY;
