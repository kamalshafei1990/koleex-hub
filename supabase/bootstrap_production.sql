-- ============================================================================
-- Koleex HUB — Production Bootstrap
--
-- Single-file bundle that brings a brand-new Supabase instance up to the
-- current code's required schema. Runs four migrations in dependency order:
--
--   1. refactor_accounts_to_identity_system.sql  (core: companies, roles,
--                                                 people, accounts,
--                                                 koleex_employees,
--                                                 access_presets + seed data)
--   2. accounts_v2_phase1_enhancements.sql       (accounts.preferences,
--                                                 account_permission_overrides,
--                                                 private HR fields)
--   3. create_security_infrastructure.sql        (account_api_keys,
--                                                 account_sessions,
--                                                 account_login_history)
--   4. create_calendar_events.sql                (koleex_calendar_events)
--
-- This file is idempotent — every statement uses IF NOT EXISTS / ON CONFLICT /
-- DROP IF EXISTS. Safe to re-run.
--
-- HOW TO RUN:
--   Open the Supabase dashboard → SQL Editor → New query → paste this entire
--   file → Run. Expect ~30 seconds. No destructive data changes — the only
--   DROP is `DROP TABLE IF EXISTS accounts` at the start of block 1 and the
--   v1 accounts table was never populated with real data anyway.
-- ============================================================================

-- ============================================================================
-- BLOCK 1 / 4 — Identity System Refactor
-- Source: supabase/migrations/refactor_accounts_to_identity_system.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1.1 Companies
CREATE TABLE IF NOT EXISTS companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'customer' CHECK (type IN ('koleex', 'customer', 'supplier', 'partner')),
  country     TEXT,
  currency    TEXT DEFAULT 'USD',
  website     TEXT,
  logo_url    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS customer_level TEXT
  CHECK (customer_level IS NULL OR customer_level IN ('silver', 'gold', 'platinum', 'diamond'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_id TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_type ON companies(type);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_customer_level ON companies(customer_level);

DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO companies (name, type, country, currency)
SELECT 'Koleex International Group', 'koleex', 'AE', 'USD'
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE type = 'koleex' LIMIT 1
);

-- 1.2 Roles
CREATE TABLE IF NOT EXISTS roles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  description    TEXT,
  scope          TEXT NOT NULL DEFAULT 'internal' CHECK (scope IN ('internal', 'customer', 'all')),
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roles_scope ON roles(scope);

INSERT INTO roles (slug, name, description, scope, display_order) VALUES
  ('super_admin',     'Super Admin',      'Full access across every Koleex Hub app.',        'internal', 1),
  ('admin',           'Admin',            'Administrative access to most modules.',          'internal', 2),
  ('product_manager', 'Product Manager',  'Manage catalog, pricing, and product data.',      'internal', 3),
  ('sales',           'Sales',            'Quotations, customers, orders.',                  'internal', 4),
  ('finance',         'Finance',          'Invoices, payments, landed cost, expenses.',      'internal', 5),
  ('marketing',       'Marketing',        'Website, campaigns, events, brand assets.',       'internal', 6),
  ('hr',              'HR',               'Employees, recruitment, attendance, appraisals.', 'internal', 7),
  ('customer_admin',  'Customer Admin',   'Full access to their company workspace.',         'customer', 10),
  ('customer_staff',  'Customer Staff',   'Restricted access to their company workspace.',   'customer', 11)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  scope = EXCLUDED.scope,
  display_order = EXCLUDED.display_order;

-- 1.3 People
CREATE TABLE IF NOT EXISTS people (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  display_name    TEXT,
  first_name      TEXT,
  last_name       TEXT,
  job_title       TEXT,
  email           TEXT,
  phone           TEXT,
  mobile          TEXT,
  avatar_url      TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT,
  state           TEXT,
  country         TEXT,
  postal_code     TEXT,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  language        TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID
);

CREATE INDEX IF NOT EXISTS idx_people_company_id ON people(company_id);
CREATE INDEX IF NOT EXISTS idx_people_email ON people(email);
CREATE INDEX IF NOT EXISTS idx_people_full_name ON people(full_name);

DROP TRIGGER IF EXISTS trg_people_updated_at ON people;
CREATE TRIGGER trg_people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 1.4 Accounts (drops v1 shape which was never populated)
DROP TABLE IF EXISTS accounts CASCADE;

CREATE TABLE accounts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id           UUID,
  username               TEXT NOT NULL UNIQUE,
  login_email            TEXT NOT NULL UNIQUE,
  password_hash          TEXT,
  force_password_change  BOOLEAN NOT NULL DEFAULT true,
  two_factor_enabled     BOOLEAN NOT NULL DEFAULT false,
  last_login_at          TIMESTAMPTZ,
  user_type              TEXT NOT NULL DEFAULT 'internal' CHECK (user_type IN ('internal', 'customer')),
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  role_id                UUID REFERENCES roles(id) ON DELETE SET NULL,
  person_id              UUID REFERENCES people(id) ON DELETE SET NULL,
  company_id             UUID REFERENCES companies(id) ON DELETE SET NULL,
  internal_notes         TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             UUID
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_type ON accounts(user_type);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_person_id ON accounts(person_id);
CREATE INDEX IF NOT EXISTS idx_accounts_role_id ON accounts(role_id);
CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);
CREATE INDEX IF NOT EXISTS idx_accounts_login_email ON accounts(login_email);

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 1.5 Koleex Employees
CREATE TABLE IF NOT EXISTS koleex_employees (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id          UUID REFERENCES people(id) ON DELETE SET NULL,
  account_id         UUID REFERENCES accounts(id) ON DELETE SET NULL,
  employee_number    TEXT UNIQUE,
  department         TEXT,
  position           TEXT,
  hire_date          DATE,
  employment_status  TEXT DEFAULT 'active' CHECK (employment_status IN ('active', 'on_leave', 'terminated', 'inactive')),
  manager_id         UUID REFERENCES koleex_employees(id) ON DELETE SET NULL,
  work_email         TEXT,
  work_phone         TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koleex_employees_person_id ON koleex_employees(person_id);
CREATE INDEX IF NOT EXISTS idx_koleex_employees_account_id ON koleex_employees(account_id);
CREATE INDEX IF NOT EXISTS idx_koleex_employees_department ON koleex_employees(department);

DROP TRIGGER IF EXISTS trg_koleex_employees_updated_at ON koleex_employees;
CREATE TRIGGER trg_koleex_employees_updated_at
  BEFORE UPDATE ON koleex_employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 1.6 Access Presets
CREATE TABLE IF NOT EXISTS access_presets (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id                 UUID NOT NULL UNIQUE REFERENCES roles(id) ON DELETE CASCADE,
  preset_name             TEXT NOT NULL,
  description             TEXT,
  can_access_products     BOOLEAN NOT NULL DEFAULT false,
  can_view_pricing        BOOLEAN NOT NULL DEFAULT false,
  can_create_quotations   BOOLEAN NOT NULL DEFAULT false,
  can_place_orders        BOOLEAN NOT NULL DEFAULT false,
  can_manage_accounts     BOOLEAN NOT NULL DEFAULT false,
  can_manage_products     BOOLEAN NOT NULL DEFAULT false,
  can_access_finance      BOOLEAN NOT NULL DEFAULT false,
  can_access_hr           BOOLEAN NOT NULL DEFAULT false,
  can_access_marketing    BOOLEAN NOT NULL DEFAULT false,
  scope_notes             TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_presets_role_id ON access_presets(role_id);

INSERT INTO access_presets (
  role_id, preset_name, description,
  can_access_products, can_view_pricing, can_create_quotations, can_place_orders,
  can_manage_accounts, can_manage_products, can_access_finance, can_access_hr, can_access_marketing,
  scope_notes
)
SELECT
  r.id,
  r.name,
  r.description,
  CASE WHEN r.slug IN ('super_admin','admin','sales','product_manager','customer_admin','customer_staff') THEN true ELSE false END,
  CASE WHEN r.slug IN ('super_admin','admin','sales','finance','customer_admin','customer_staff') THEN true ELSE false END,
  CASE WHEN r.slug IN ('super_admin','admin','sales','customer_admin') THEN true ELSE false END,
  CASE WHEN r.slug IN ('customer_admin') THEN true ELSE false END,
  CASE WHEN r.slug = 'super_admin' THEN true ELSE false END,
  CASE WHEN r.slug IN ('super_admin','admin','product_manager') THEN true ELSE false END,
  CASE WHEN r.slug IN ('super_admin','admin','finance') THEN true ELSE false END,
  CASE WHEN r.slug IN ('super_admin','admin','hr') THEN true ELSE false END,
  CASE WHEN r.slug IN ('super_admin','admin','marketing') THEN true ELSE false END,
  'Default preset generated by bootstrap. Override in the future permissions system.'
FROM roles r
ON CONFLICT (role_id) DO UPDATE SET
  preset_name = EXCLUDED.preset_name,
  description = EXCLUDED.description,
  can_access_products = EXCLUDED.can_access_products,
  can_view_pricing = EXCLUDED.can_view_pricing,
  can_create_quotations = EXCLUDED.can_create_quotations,
  can_place_orders = EXCLUDED.can_place_orders,
  can_manage_accounts = EXCLUDED.can_manage_accounts,
  can_manage_products = EXCLUDED.can_manage_products,
  can_access_finance = EXCLUDED.can_access_finance,
  can_access_hr = EXCLUDED.can_access_hr,
  can_access_marketing = EXCLUDED.can_access_marketing;

-- ============================================================================
-- BLOCK 2 / 4 — Accounts v2 Phase 1 Enhancements
-- Source: supabase/migrations/accounts_v2_phase1_enhancements.sql
-- ============================================================================

-- 2.1 accounts.preferences
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN accounts.preferences IS
  'User preferences bag. Keys: language, theme, email_signature, notifications, calendar.';

-- 2.2 accounts.status — add `invited` to CHECK
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_status_check;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_status_check
  CHECK (status IN ('invited', 'active', 'inactive', 'suspended', 'pending'));

-- 2.3 account_permission_overrides
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
  'Per-account per-module access overrides. Layered on top of the role access_preset.';

-- 2.4 koleex_employees — private HR fields
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
-- BLOCK 3 / 4 — Security Infrastructure (Phase 1)
-- Source: supabase/migrations/create_security_infrastructure.sql
-- ============================================================================

-- 3.1 account_api_keys
CREATE TABLE IF NOT EXISTS account_api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_prefix    TEXT NOT NULL,
  key_hash      TEXT NOT NULL,
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  expires_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,
  UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_account ON account_api_keys (account_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix  ON account_api_keys (key_prefix);

COMMENT ON TABLE account_api_keys IS
  'Per-account API keys (PATs). Only the sha256 hash of the key is stored.';
COMMENT ON COLUMN account_api_keys.key_hash IS
  'sha256 of the full key. The full key is shown once at creation.';

-- 3.2 account_sessions
CREATE TABLE IF NOT EXISTS account_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  session_token_hash  TEXT NOT NULL UNIQUE,
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

-- 3.3 account_login_history
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
-- BLOCK 4 / 4 — Calendar Events
-- Source: supabase/migrations/create_calendar_events.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS koleex_calendar_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  location      TEXT,
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  all_day       BOOLEAN NOT NULL DEFAULT false,
  event_type    TEXT NOT NULL DEFAULT 'meeting'
                 CHECK (event_type IN (
                   'meeting',
                   'task',
                   'reminder',
                   'event',
                   'holiday',
                   'out_of_office'
                 )),
  color         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_time_order_check
    CHECK (end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_account_start
  ON koleex_calendar_events (account_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start
  ON koleex_calendar_events (start_at);

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at
  ON koleex_calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON koleex_calendar_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE koleex_calendar_events IS
  'Self-contained calendar events for the Koleex Hub Calendar app.';

-- ============================================================================
-- Bootstrap complete.
--
-- Sanity-check queries you can run right after:
--   SELECT count(*) FROM roles;              -- expect 9
--   SELECT count(*) FROM companies;          -- expect 1 (Koleex International Group)
--   SELECT count(*) FROM access_presets;     -- expect 9
--   SELECT count(*) FROM accounts;           -- expect 0 (fresh)
--   SELECT to_regclass('public.account_api_keys') IS NOT NULL;        -- expect t
--   SELECT to_regclass('public.account_sessions') IS NOT NULL;        -- expect t
--   SELECT to_regclass('public.account_login_history') IS NOT NULL;   -- expect t
--   SELECT to_regclass('public.koleex_calendar_events') IS NOT NULL;  -- expect t
-- ============================================================================
