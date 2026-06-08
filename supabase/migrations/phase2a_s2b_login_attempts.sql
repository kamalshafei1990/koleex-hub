-- Phase 2A S2b — login_attempts table for future rate-limiting / brute-force
-- protection. ADDITIVE ONLY. No application code reads/writes this yet
-- (recording happens in S2c observe mode; enforcement in S2d).
--
-- Applied to Supabase project yxyizbnfjrwrnmwhkvme via migration
-- "phase2a_s2b_login_attempts".

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- nullable: an unknown identifier may not map to any tenant.
  tenant_id       uuid REFERENCES public.tenants(id)  ON DELETE SET NULL,
  -- nullable: failures for unknown emails / pure per-IP attempts have no account.
  account_id      uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  -- the submitted email/username, lower-cased, to bucket attempts by target.
  identifier      text NOT NULL,
  -- optional privacy-preserving hash of the identifier (reserved for future use).
  identifier_hash text,
  ip_address      text NOT NULL,
  user_agent      text,
  outcome         text NOT NULL CHECK (outcome IN ('success','failure','blocked','disabled','unknown_user')),
  reason          text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Rate-limit window lookups (per IP / per identifier / per account) + cleanup.
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created         ON public.login_attempts (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_created ON public.login_attempts (identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_account_created    ON public.login_attempts (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created            ON public.login_attempts (created_at);

-- RLS: enabled + service-role-only (matches every other sensitive table).
-- No anon/authenticated policy => default-deny for the browser anon client.
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.login_attempts;
CREATE POLICY service_role_full_access ON public.login_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
