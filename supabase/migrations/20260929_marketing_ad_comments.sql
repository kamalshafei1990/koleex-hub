-- ---------------------------------------------------------------------------
-- Social Marketing: comments on ADS. Owner-approved 29/09/2026 ("موافق، ابدأ";
-- Facebook and Instagram together; shown in the Comments tab marked «Ad»).
-- ADDITIVE.
--
--   marketing_ad_posts  the posts that exist ONLY as ads: a Facebook Page's
--       dark posts (Ads Manager) and the Instagram media of ads. A boosted
--       post is an organic post — it stays in marketing_remote_posts and is
--       never listed here — so ads never mix into the Feed, Insights or the
--       weekly plan's numbers. comments = Meta's count at the last scan;
--       comments_seen = the count when its comments were last read.
--   marketing_comments.ad_post_id  a comment on an ad post (remote_post_id
--       stays null for it).
--   marketing_accounts.user_token_encrypted / user_token_expires_at  the
--       connect flow's long-lived USER key (AES-256-GCM like the Page keys),
--       kept only when the ads permissions were granted: Instagram's ads are
--       found through the ad account, which a Page key cannot read. It lasts
--       about 60 days; comments on ads already found keep coming with the
--       Page key after it lapses. Removing the account deletes it.
--
-- Server-only like the other marketing_* tables: RLS on, no policies.
-- Rollback: ALTER TABLE marketing_comments DROP COLUMN ad_post_id;
--   ALTER TABLE marketing_accounts DROP COLUMN user_token_encrypted,
--   DROP COLUMN user_token_expires_at; DROP TABLE marketing_ad_posts;
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketing_ad_posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  account_id     uuid NOT NULL REFERENCES marketing_accounts(id) ON DELETE CASCADE,
  external_id    text NOT NULL,
  message        text,
  media          jsonb NOT NULL DEFAULT '[]'::jsonb,
  permalink      text,
  posted_at      timestamptz,
  comments       integer,
  comments_seen  integer,
  seen_at        timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_id)
);
CREATE INDEX IF NOT EXISTS marketing_ad_posts_account_idx ON marketing_ad_posts (tenant_id, account_id, posted_at DESC);
ALTER TABLE marketing_ad_posts ENABLE ROW LEVEL SECURITY;

ALTER TABLE marketing_comments ADD COLUMN IF NOT EXISTS ad_post_id uuid REFERENCES marketing_ad_posts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS marketing_comments_ad_post_idx ON marketing_comments (ad_post_id, commented_at);

ALTER TABLE marketing_accounts ADD COLUMN IF NOT EXISTS user_token_encrypted text;
ALTER TABLE marketing_accounts ADD COLUMN IF NOT EXISTS user_token_expires_at timestamptz;
