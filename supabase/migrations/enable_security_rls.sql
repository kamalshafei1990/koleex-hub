-- ============================================================================
-- Koleex Hub — Row Level Security for Project C Phase 2
--
-- Run this ONCE, after:
--   1. Supabase Auth is enabled in the dashboard
--   2. scripts/migrate-accounts-to-supabase-auth.ts has been executed so that
--      every accounts.id matches an auth.users.id
--
-- Until both of those are true, leave these tables wide open via the untyped
-- admin client exactly as Phase 1 ships them. Running this file early will
-- lock admins out of the Security tab because auth.uid() will be NULL.
--
-- This migration is idempotent: you can re-run it safely. Policies are
-- dropped and recreated so name changes propagate.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. account_api_keys
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE account_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account can read own api keys" ON account_api_keys;
CREATE POLICY "account can read own api keys"
  ON account_api_keys FOR SELECT
  USING (account_id = auth.uid());

DROP POLICY IF EXISTS "account can create own api keys" ON account_api_keys;
CREATE POLICY "account can create own api keys"
  ON account_api_keys FOR INSERT
  WITH CHECK (account_id = auth.uid());

DROP POLICY IF EXISTS "account can update own api keys" ON account_api_keys;
CREATE POLICY "account can update own api keys"
  ON account_api_keys FOR UPDATE
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

DROP POLICY IF EXISTS "account can delete own api keys" ON account_api_keys;
CREATE POLICY "account can delete own api keys"
  ON account_api_keys FOR DELETE
  USING (account_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────
-- 2. account_sessions
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE account_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account can read own sessions" ON account_sessions;
CREATE POLICY "account can read own sessions"
  ON account_sessions FOR SELECT
  USING (account_id = auth.uid());

DROP POLICY IF EXISTS "account can create own sessions" ON account_sessions;
CREATE POLICY "account can create own sessions"
  ON account_sessions FOR INSERT
  WITH CHECK (account_id = auth.uid());

DROP POLICY IF EXISTS "account can update own sessions" ON account_sessions;
CREATE POLICY "account can update own sessions"
  ON account_sessions FOR UPDATE
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

-- Deletions go through revoked_at; no DELETE policy on purpose.

-- ────────────────────────────────────────────────────────────────────────────
-- 3. account_login_history  (append-only from the account's perspective)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE account_login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account can read own history" ON account_login_history;
CREATE POLICY "account can read own history"
  ON account_login_history FOR SELECT
  USING (account_id = auth.uid());

-- Writes from the client are allowed so logEvent() still fires for the
-- currently signed-in user (e.g. passkey enrollment, 2FA toggles). Server-
-- side writes (logins, forced resets) should use the SERVICE ROLE key which
-- bypasses RLS entirely.
DROP POLICY IF EXISTS "account can append own history" ON account_login_history;
CREATE POLICY "account can append own history"
  ON account_login_history FOR INSERT
  WITH CHECK (account_id = auth.uid());

-- No UPDATE or DELETE policies — history is append-only.

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Super-admin bypass
--
-- Koleex HUB admins need to manage other users' keys / sessions / history
-- from the AccountDetail page. Grant a bypass to any account with the
-- 'super_admin' role. This uses a SECURITY DEFINER helper function so
-- policies can call it without causing recursion on the accounts table.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth_is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM accounts a
    JOIN roles r ON r.id = a.role_id
    WHERE a.id = auth.uid()
      AND r.name ILIKE 'super%admin'
  );
$$;

DROP POLICY IF EXISTS "super admin full access api keys" ON account_api_keys;
CREATE POLICY "super admin full access api keys"
  ON account_api_keys FOR ALL
  USING (auth_is_super_admin())
  WITH CHECK (auth_is_super_admin());

DROP POLICY IF EXISTS "super admin full access sessions" ON account_sessions;
CREATE POLICY "super admin full access sessions"
  ON account_sessions FOR ALL
  USING (auth_is_super_admin())
  WITH CHECK (auth_is_super_admin());

DROP POLICY IF EXISTS "super admin full access history" ON account_login_history;
CREATE POLICY "super admin full access history"
  ON account_login_history FOR ALL
  USING (auth_is_super_admin())
  WITH CHECK (auth_is_super_admin());

-- ============================================================================
-- Done.
-- ============================================================================
