-- ---------------------------------------------------------------------------
-- Social Marketing insights. Owner-approved 28/09/2026 ("start"). ADDITIVE.
--
--   marketing_insight_days  one row per account per day: the platform's
--       numbers for that day (Meta's day, which ends at midnight Pacific).
--       metrics holds the Hub's own names (views, follows, unfollows,
--       visits, interactions, video_views, watch_ms, …) mapped from Meta's
--       metric names in lib/server/marketing/meta-insights, so when Meta
--       renames a metric the mapping changes, never this table. Kept apart
--       from marketing_account_days, whose rows are the Feed's snapshots.
--       synced_at tells the sync which days to fetch again: Meta finishes a
--       day's numbers up to 48 hours late.
--
-- Server-only like the other marketing_* tables: RLS on, no policies.
-- Rollback: DROP TABLE marketing_insight_days;
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketing_insight_days (
  account_id uuid NOT NULL REFERENCES marketing_accounts(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL,
  day        date NOT NULL,
  metrics    jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, day)
);
CREATE INDEX IF NOT EXISTS marketing_insight_days_tenant_idx ON marketing_insight_days (tenant_id, day DESC);

ALTER TABLE marketing_insight_days ENABLE ROW LEVEL SECURITY;
