-- ============================================================================
-- Super Admin Activity Monitoring, Audit Log, Live Tracking, Sessions, Devices
-- ============================================================================
-- Additive only. Creates new tables; touches NOTHING existing. Safe to re-run.
--
-- Security model (IMPORTANT):
--   Koleex Hub uses a CUSTOM signed cookie session (koleex_session), NOT
--   Supabase Auth. The browser is always the `anon` role with no JWT, so
--   auth.uid() is NULL on the client. Therefore every one of these tables is
--   SERVICE-ROLE-ONLY: RLS is ENABLED with NO anon/authenticated policies, so
--   the anon client is denied all access. ALL reads/writes go through server
--   API routes that authenticate via getServerAuth() and use the service-role
--   client (which bypasses RLS). This is the same posture as account_sessions.
--
--   Audit logs are append-only by construction: only the service role writes,
--   and no server route ever issues DELETE/UPDATE against audit_logs.
--
--   We do NOT add these tables to the supabase_realtime publication — the
--   Super Admin panel reads via short-interval polling on SA-gated server
--   routes, so activity data never reaches an anon subscriber.
-- ============================================================================

-- ── 1. app_sessions — live presence / heartbeat (one row per device session) ─
CREATE TABLE IF NOT EXISTS public.app_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  tenant_id     uuid,
  device_id     text NOT NULL,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','idle','offline','revoked','expired')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  current_route text,
  current_module text,
  last_action   text,
  ip            text,
  country       text,
  city          text,
  browser       text,
  os            text,
  device_type   text,
  user_agent    text,
  revoked_at    timestamptz,
  revoked_by    uuid,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_app_sessions_account   ON public.app_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_status    ON public.app_sessions(status);
CREATE INDEX IF NOT EXISTS idx_app_sessions_last_seen ON public.app_sessions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_sessions_tenant    ON public.app_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_route     ON public.app_sessions(current_route);

-- ── 2. activity_events — page views + general activity feed ───────────────────
CREATE TABLE IF NOT EXISTS public.activity_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  tenant_id   uuid,
  session_id  uuid REFERENCES public.app_sessions(id) ON DELETE SET NULL,
  device_id   text,
  event_type  text NOT NULL,            -- page_view | session_start | session_end
                                         -- | idle | active | login | logout | ...
  route       text,
  module      text,
  title       text,
  referrer    text,
  severity    text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  ip          text,
  country     text,
  browser     text,
  os          text,
  device_type text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_events_account  ON public.activity_events(account_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_session  ON public.activity_events(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_created  ON public.activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_type     ON public.activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_events_severity ON public.activity_events(severity);
CREATE INDEX IF NOT EXISTS idx_activity_events_module   ON public.activity_events(module);
CREATE INDEX IF NOT EXISTS idx_activity_events_tenant   ON public.activity_events(tenant_id);

-- ── 3. audit_logs — detailed business-action audit trail (append-only) ────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  tenant_id      uuid,
  session_id     uuid,
  action_type    text NOT NULL,         -- create | update | delete | archive |
                                         -- restore | export_pdf | change_price | ...
  entity_type    text,                  -- product | quotation | role | setting | ...
  entity_id      text,
  entity_label   text,
  old_values     jsonb,
  new_values     jsonb,
  changed_fields jsonb,
  severity       text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  module         text,
  route          text,
  ip             text,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_account  ON public.audit_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity   ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module   ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action   ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant   ON public.audit_logs(tenant_id);

-- ── 4. user_devices — per-account device registry (trust / block) ─────────────
CREATE TABLE IF NOT EXISTS public.user_devices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  tenant_id       uuid,
  device_id       text NOT NULL,
  browser         text,
  os              text,
  device_type     text,
  user_agent_hash text,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_ip         text,
  last_country    text,
  is_trusted      boolean NOT NULL DEFAULT false,
  is_blocked      boolean NOT NULL DEFAULT false,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_user_devices_account ON public.user_devices(account_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device  ON public.user_devices(device_id);

-- ── 5. notification_preferences — per-account channel/event toggles ───────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  prefs       jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { "<event_type>": {inapp:bool,push:bool,email:bool} }
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 6. push_subscriptions — Web Push endpoints (Phase 5) ──────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  device_id    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_account ON public.push_subscriptions(account_id);

-- ── RLS: service-role-only (deny anon/authenticated; service role bypasses) ───
ALTER TABLE public.app_sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions       ENABLE ROW LEVEL SECURITY;
-- No policies are created on purpose: with RLS enabled and zero policies, the
-- anon and authenticated roles are denied everything. The service-role client
-- used by our server routes bypasses RLS entirely. This keeps all activity,
-- audit, session, and device data unreadable by the browser except through
-- our Super-Admin-gated server endpoints.
