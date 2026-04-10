-- ============================================================================
-- Koleex Hub — Security Infrastructure (Project C, Phase 1)
--
-- Adds the persistence layer for the Security tab on the account detail page
-- without yet wiring real Supabase Auth. Once Supabase Auth is enabled in the
-- dashboard (see supabase/SUPABASE_AUTH_SETUP.md), these tables continue to
-- work alongside Supabase's built-in auth.users + sessions machinery.
--
-- Tables:
--   1. account_api_keys       — PATs the user can create to call the Koleex API
--   2. account_sessions       — device / session tracking for "Active Devices"
--   3. account_login_history  — audit log of auth events
--
-- Notes:
-- - API keys are stored as sha256 hashes only. The full key is shown exactly
--   once at creation time and never persisted in plaintext.
-- - session_token_hash is a sha256 of the session token the server hands out.
--   We never store the raw token so an attacker with DB read access can't
--   impersonate a user.
-- - This migration is idempotent and safe to re-run.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. account_api_keys
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Identifying metadata shown in the UI list.
  name          TEXT NOT NULL,
  key_prefix    TEXT NOT NULL,   -- first ~10 chars, e.g. 'koleex_ab'
  key_hash      TEXT NOT NULL,   -- sha256 of the full key; used for verification

  -- Optional restrictions.
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  expires_at    TIMESTAMPTZ,

  -- Activity.
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,

  UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_account
  ON account_api_keys (account_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix
  ON account_api_keys (key_prefix);

COMMENT ON TABLE account_api_keys IS
  'Per-account API keys (PATs). Only the sha256 hash of the key is stored.';
COMMENT ON COLUMN account_api_keys.key_hash IS
  'sha256 of the full key. The full key is shown once at creation.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. account_sessions
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Identifies the device/session without ever storing the raw token.
  session_token_hash  TEXT NOT NULL UNIQUE,

  -- UX metadata from the User-Agent string at session creation.
  device_name         TEXT,
  device_type         TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'other')),
  os                  TEXT,
  browser             TEXT,
  ip_address          TEXT,

  last_active_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_account_active
  ON account_sessions (account_id, last_active_at DESC);

COMMENT ON TABLE account_sessions IS
  'Active devices / sessions per account. Complements Supabase Auth sessions.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. account_login_history
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_login_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  event_type   TEXT NOT NULL CHECK (event_type IN (
                 'login_success',
                 'login_failed',
                 'logout',
                 'password_reset',
                 'force_reset_enabled',
                 'force_reset_cleared',
                 'two_factor_enabled',
                 'two_factor_disabled',
                 'api_key_created',
                 'api_key_revoked',
                 'session_revoked',
                 'passkey_enrolled',
                 'passkey_revoked'
               )),

  ip_address   TEXT,
  user_agent   TEXT,

  -- Arbitrary event-specific context (e.g. { "key_prefix": "koleex_ab" }).
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_history_account_created
  ON account_login_history (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_event
  ON account_login_history (event_type);

COMMENT ON TABLE account_login_history IS
  'Audit log of auth / security events per account. Append-only.';

-- ============================================================================
-- Done.
-- ============================================================================
