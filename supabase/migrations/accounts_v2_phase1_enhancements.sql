-- ============================================================================
-- Accounts Manager v2 — Phase 1 Enhancements
--
-- Adds the layer of data needed for the Odoo-inspired UI refactor:
--
--   1. accounts.preferences (jsonb)        — language, theme, signature,
--                                             notifications, calendar defaults
--                                             (timezone, working hours, OOO)
--   2. accounts.status                     — adds the `invited` lifecycle state
--   3. account_permission_overrides        — per-module access overrides that
--                                             layer on top of the role's
--                                             access_preset bundle
--   4. koleex_employees.private HR fields  — private address, emergency contact,
--                                             IDs, passport, visa, etc.
--
-- This migration is idempotent and safe to re-run. It does NOT drop any data.
--
-- Notes:
-- - Preferences are stored as jsonb so we can evolve the shape without running
--   a migration every time we add a new preference key.
-- - Permission overrides are sparse: we only insert rows for modules that
--   actually differ from the role's preset. No row = "use preset default".
-- - Private HR fields live on koleex_employees (not on accounts) because they
--   are internal employee data, not login identity data.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. accounts.preferences (jsonb)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN accounts.preferences IS
  'User preferences bag. Keys: language, theme, email_signature, notifications, calendar.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. accounts.status — add `invited` to the CHECK constraint
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_status_check;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_status_check
  CHECK (status IN ('invited', 'active', 'inactive', 'suspended', 'pending'));

-- ────────────────────────────────────────────────────────────────────────────
-- 3. account_permission_overrides — per-account, per-module access level
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_permission_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  module_key    TEXT NOT NULL,
  access_level  TEXT NOT NULL
                 CHECK (access_level IN ('none', 'user', 'manager', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_permission_overrides_account
  ON account_permission_overrides(account_id);

CREATE INDEX IF NOT EXISTS idx_permission_overrides_module
  ON account_permission_overrides(module_key);

DROP TRIGGER IF EXISTS trg_permission_overrides_updated_at
  ON account_permission_overrides;
CREATE TRIGGER trg_permission_overrides_updated_at
  BEFORE UPDATE ON account_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE account_permission_overrides IS
  'Per-account per-module access overrides. Layered on top of the role access_preset. Absence = use preset default.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. koleex_employees — private HR fields
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE koleex_employees
  ADD COLUMN IF NOT EXISTS private_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS private_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS private_city           TEXT,
  ADD COLUMN IF NOT EXISTS private_state          TEXT,
  ADD COLUMN IF NOT EXISTS private_country        TEXT,
  ADD COLUMN IF NOT EXISTS private_postal_code    TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name         TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone        TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
  ADD COLUMN IF NOT EXISTS birth_date         DATE,
  ADD COLUMN IF NOT EXISTS marital_status     TEXT,
  ADD COLUMN IF NOT EXISTS nationality        TEXT,
  ADD COLUMN IF NOT EXISTS identification_id  TEXT,
  ADD COLUMN IF NOT EXISTS passport_number    TEXT,
  ADD COLUMN IF NOT EXISTS visa_number        TEXT,
  ADD COLUMN IF NOT EXISTS visa_expiry_date   DATE;

-- ============================================================================
-- Done.
-- ============================================================================
