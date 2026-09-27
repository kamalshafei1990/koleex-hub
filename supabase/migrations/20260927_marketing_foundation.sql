-- ---------------------------------------------------------------------------
-- Marketing section — shared foundation (phase 0) and the Social Marketing
-- core (phase 1). Plan v6, owner 27/09/2026. ADDITIVE ONLY.
--
-- Six tables:
--   marketing_accounts      every connected account: Koleex's pages and
--                           profiles (space 'company') and the CEO's own
--                           (space 'ceo', CEO Brand). The platform's access
--                           key is stored ENCRYPTED (AES-256-GCM, key in the
--                           server env MARKETING_TOKEN_KEY) and never reaches
--                           a browser.
--   marketing_posts         one piece of content written once in the Hub.
--   marketing_post_targets  that post on each account it goes to, with the
--                           caption adapted for the platform and the result.
--   marketing_remote_posts  the Feed: every post on a connected account,
--                           published from the Hub or imported from before,
--                           with its numbers.
--   marketing_comments      comments on those posts, and Koleex's replies.
--   marketing_links         tracked links (UTM + a short code) for posts,
--                           emails and messages, counted per click.
--
-- Access is server-only, like hr_* and work_reports: RLS on with no
-- policies, every read and write goes through /api/marketing/* with the
-- service role. updated_at is set by the API on every write.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketing_accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  -- 'company' = Koleex's accounts (Social Marketing); 'ceo' = the CEO's own
  -- (CEO Brand, its own Roles module).
  space            text NOT NULL DEFAULT 'company' CHECK (space IN ('company', 'ceo')),
  platform         text NOT NULL
                   CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'x', 'wechat', 'whatsapp', 'douyin')),
  -- 'api' = the Hub publishes itself; 'assisted' = no API for this account
  -- (a Facebook personal profile, WeChat Moments, Douyin): the Hub prepares
  -- the post and a person shares it with one tap.
  connection       text NOT NULL DEFAULT 'api' CHECK (connection IN ('api', 'assisted')),
  external_id      text,
  name             text NOT NULL,
  handle           text,
  avatar_url       text,
  profile_url      text,
  token_encrypted  text,
  token_expires_at timestamptz,
  scopes           text[] NOT NULL DEFAULT '{}',
  status           text NOT NULL DEFAULT 'connected'
                   CHECK (status IN ('connected', 'expired', 'revoked', 'error', 'disconnected')),
  last_error       text,
  last_synced_at   timestamptz,
  connected_by     uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_accounts_external_uq
  ON marketing_accounts (tenant_id, platform, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_accounts_space_idx ON marketing_accounts (tenant_id, space, platform);

CREATE TABLE IF NOT EXISTS marketing_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  code            text NOT NULL UNIQUE,
  target_url      text NOT NULL,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  clicks          integer NOT NULL DEFAULT 0,
  last_clicked_at timestamptz,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_links_tenant_idx ON marketing_links (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  space         text NOT NULL DEFAULT 'company' CHECK (space IN ('company', 'ceo')),
  -- draft → in_review → approved → scheduled → publishing → published
  -- (or partly_published / failed); rejected goes back to its author.
  -- Company posts: the CEO or the marketing manager approves (owner,
  -- 27/09). CEO Brand posts: only the CEO.
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'in_review', 'approved', 'scheduled', 'publishing', 'published', 'partly_published', 'failed', 'rejected', 'archived')),
  body          text NOT NULL DEFAULT '',
  -- [{ url, file_path, kind: 'image' | 'video', alt, width, height }]
  media         jsonb NOT NULL DEFAULT '[]'::jsonb,
  link_id       uuid REFERENCES marketing_links(id) ON DELETE SET NULL,
  scheduled_at  timestamptz,
  published_at  timestamptz,
  created_by    uuid NOT NULL,
  submitted_at  timestamptz,
  decided_by    uuid,
  decided_at    timestamptz,
  decision_note text,
  -- Optimistic lock: a save carries the version it read; two editors can
  -- never overwrite each other silently (as quotations do).
  version       integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_posts_queue_idx ON marketing_posts (tenant_id, space, status, scheduled_at);
CREATE INDEX IF NOT EXISTS marketing_posts_recent_idx ON marketing_posts (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_post_targets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  post_id          uuid NOT NULL REFERENCES marketing_posts(id) ON DELETE CASCADE,
  account_id       uuid NOT NULL REFERENCES marketing_accounts(id) ON DELETE CASCADE,
  -- The caption adapted for this platform; NULL = the post's own body.
  body_override    text,
  -- 'shared' = an assisted account, shared by a person after approval.
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'publishing', 'published', 'failed', 'skipped', 'shared')),
  external_post_id text,
  permalink        text,
  error            text,
  attempts         integer NOT NULL DEFAULT 0,
  next_attempt_at  timestamptz,
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, account_id)
);
CREATE INDEX IF NOT EXISTS marketing_post_targets_due_idx ON marketing_post_targets (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS marketing_post_targets_account_idx ON marketing_post_targets (account_id, published_at DESC);

CREATE TABLE IF NOT EXISTS marketing_remote_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  account_id  uuid NOT NULL REFERENCES marketing_accounts(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  -- Set when the post was published from the Hub.
  target_id   uuid REFERENCES marketing_post_targets(id) ON DELETE SET NULL,
  message     text,
  media       jsonb NOT NULL DEFAULT '[]'::jsonb,
  permalink   text,
  posted_at   timestamptz,
  -- { reach, impressions, likes, comments, shares, saves, clicks, views }
  metrics     jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_id)
);
CREATE INDEX IF NOT EXISTS marketing_remote_posts_feed_idx ON marketing_remote_posts (account_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS marketing_remote_posts_tenant_idx ON marketing_remote_posts (tenant_id, posted_at DESC);

CREATE TABLE IF NOT EXISTS marketing_comments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  account_id         uuid NOT NULL REFERENCES marketing_accounts(id) ON DELETE CASCADE,
  remote_post_id     uuid REFERENCES marketing_remote_posts(id) ON DELETE CASCADE,
  external_id        text NOT NULL,
  parent_external_id text,
  author_name        text,
  author_external_id text,
  author_avatar_url  text,
  message            text,
  commented_at       timestamptz,
  -- A reply written by Koleex (from the Hub or on the platform).
  is_ours            boolean NOT NULL DEFAULT false,
  hidden             boolean NOT NULL DEFAULT false,
  replied_by         uuid,
  replied_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_id)
);
CREATE INDEX IF NOT EXISTS marketing_comments_post_idx ON marketing_comments (remote_post_id, commented_at);
CREATE INDEX IF NOT EXISTS marketing_comments_inbox_idx ON marketing_comments (tenant_id, commented_at DESC);

ALTER TABLE marketing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_post_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_remote_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_comments ENABLE ROW LEVEL SECURITY;
