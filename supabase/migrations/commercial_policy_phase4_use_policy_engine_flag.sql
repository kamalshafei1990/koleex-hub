-- Phase 4 — feature flag for the policy-driven pricing path.
-- When true, the production pricing engine falls back to computing
-- from the commercial_* tables (12-step flow) when no override /
-- market price matches a line. When false (default), lines without
-- an explicit price stay unresolved — legacy behaviour.
ALTER TABLE commercial_settings
  ADD COLUMN IF NOT EXISTS use_policy_engine boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN commercial_settings.use_policy_engine IS
  'Feature flag: when true, the pricing engine falls back to computing from the Commercial Policy (12-step flow) when no override / market price matches a line.';
