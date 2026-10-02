-- ---------------------------------------------------------------------------
-- 20261003_ai_core_schema_tracking — document the core Koleex AI tables.
--
-- WHY: these tables were created out-of-band and had no migration file, so the
-- schema and RLS were unauditable from the repo and the DB was not
-- reproducible. This file is the faithful record of the PRODUCTION schema
-- (introspected 2026-10-03) and the RLS posture. It is fully idempotent —
-- every statement is IF NOT EXISTS / re-runnable — and changes nothing in an
-- existing database: the tables already exist, so CREATE TABLE IF NOT EXISTS
-- is a no-op.
--
-- RLS POSTURE (matches production):
--   · ai_conversations / ai_messages / ai_tool_calls → service_role-only
--     policy (deny-all for anon/authenticated).
--   · ai_knowledge_units / ai_sources / ai_projects / ai_ku_lineage → RLS
--     enabled with NO policies (deny-all; the app reaches them only through
--     the service-role server client).
-- ---------------------------------------------------------------------------

-- ── ai_conversations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  account_id     uuid NOT NULL,
  title          text NOT NULL DEFAULT 'New chat',
  last_preview   text,
  message_count  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  pinned         boolean NOT NULL DEFAULT false,
  project_id     uuid
);

-- ── ai_messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  conversation_id  uuid NOT NULL,
  role             text NOT NULL,
  content          text NOT NULL,
  provider         text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  source           text NOT NULL DEFAULT 'text',
  thinking         jsonb
);

-- ── ai_tool_calls ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_tool_calls (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  account_id         uuid NOT NULL,
  conversation_id    uuid,
  tool_name          text NOT NULL,
  args               jsonb NOT NULL DEFAULT '{}'::jsonb,
  permission_status  text NOT NULL,
  ok                 boolean NOT NULL,
  filtered_fields    text[] DEFAULT '{}'::text[],
  sources            text[] DEFAULT '{}'::text[],
  message            text,
  result_summary     text,
  latency_ms         integer,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ── ai_knowledge_units ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_knowledge_units (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid,
  source_id         uuid NOT NULL,
  version           integer NOT NULL DEFAULT 1,
  pipeline_version  text NOT NULL DEFAULT 'refinery-v1',
  seq               integer NOT NULL DEFAULT 0,
  kind              text NOT NULL DEFAULT 'fact',
  title             text,
  body              text NOT NULL,
  locator           jsonb NOT NULL DEFAULT '{}'::jsonb,
  languages         text[] NOT NULL DEFAULT '{}'::text[],
  domains           text[] NOT NULL DEFAULT '{}'::text[],
  tags              text[] NOT NULL DEFAULT '{}'::text[],
  sensitivity       text NOT NULL DEFAULT 'internal',
  trust_score       numeric NOT NULL DEFAULT 0.5,
  valid_until       timestamptz,
  status            text NOT NULL DEFAULT 'draft',
  approved_by       uuid,
  approved_at       timestamptz,
  tokens            integer,
  meta              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── ai_sources ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_sources (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid,
  title             text NOT NULL,
  kind              text NOT NULL,
  origin            text,
  mime              text,
  lang              text,
  domain            text,
  status            text NOT NULL,
  pipeline_version  text NOT NULL,
  error             text,
  meta              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── ai_projects ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  account_id  uuid NOT NULL,
  name        text NOT NULL,
  icon        text NOT NULL DEFAULT 'folder',
  color       text NOT NULL DEFAULT 'slate',
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── ai_ku_lineage ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_ku_lineage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,
  ku_id         uuid NOT NULL,
  parent_ku_id  uuid,
  relation      text NOT NULL DEFAULT 'derived_from',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE ai_conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_calls      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_ku_lineage      ENABLE ROW LEVEL SECURITY;

-- Service-role-only (deny-all for anon/authenticated). The four knowledge/
-- project/lineage tables intentionally have NO policy: RLS on with zero
-- policies is deny-all, which is what production runs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_conversations' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON ai_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_messages' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON ai_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_tool_calls' AND policyname = 'ai_tool_calls_service_role_all') THEN
    CREATE POLICY ai_tool_calls_service_role_all ON ai_tool_calls FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
