-- ============================================================================
-- Accounts Manager — Core tables for user accounts, companies, and roles.
--
-- Tables:
--   companies  — Organisations that accounts belong to (Koleex + customers).
--   roles      — Role catalogue (super_admin, admin, sales, customer_admin...).
--   accounts   — Internal and customer user records.
--
-- Design notes:
--   - No hard FK to auth.users so we can seed/manage accounts from the admin
--     UI without requiring Supabase Auth to be wired up. `auth_user_id` is a
--     nullable link we can populate later when Supabase Auth is introduced.
--   - `password_hash` is nullable — initial provisioning stores a temporary
--     password (hashed client-side) with `force_password_change = true`. This
--     is a placeholder until proper auth is wired up.
--   - RLS is intentionally NOT enabled: all access is gated through the
--     Koleex Hub admin UI (sessionStorage-based `AdminAuth`) using the anon
--     key. Do NOT expose these tables to untrusted clients.
-- ============================================================================

-- ── Extensions ──
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Companies ──
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

CREATE INDEX IF NOT EXISTS idx_companies_type ON companies(type);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- ── Roles ──
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

-- ── Accounts ──
CREATE TABLE IF NOT EXISTS accounts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id           UUID,                                       -- nullable link to auth.users when Supabase Auth is wired up
  full_name              TEXT NOT NULL,
  username               TEXT NOT NULL UNIQUE,
  email                  TEXT NOT NULL UNIQUE,
  phone                  TEXT,
  avatar_url             TEXT,
  user_type              TEXT NOT NULL DEFAULT 'internal' CHECK (user_type IN ('internal', 'customer')),
  company_id             UUID REFERENCES companies(id) ON DELETE SET NULL,
  role_id                UUID REFERENCES roles(id) ON DELETE SET NULL,
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  country                TEXT,
  currency               TEXT,
  customer_level         TEXT CHECK (customer_level IS NULL OR customer_level IN ('silver', 'gold', 'platinum', 'diamond')),

  -- Feature flags (additive, future-ready)
  can_access_products    BOOLEAN NOT NULL DEFAULT true,
  can_create_quotations  BOOLEAN NOT NULL DEFAULT false,
  can_view_pricing       BOOLEAN NOT NULL DEFAULT true,
  can_place_orders       BOOLEAN NOT NULL DEFAULT false,

  -- Security
  password_hash          TEXT,
  force_password_change  BOOLEAN NOT NULL DEFAULT true,
  two_factor_enabled     BOOLEAN NOT NULL DEFAULT false,
  last_login_at          TIMESTAMPTZ,

  -- Notes
  internal_notes         TEXT,
  account_notes          TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             UUID
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_type ON accounts(user_type);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_role_id ON accounts(role_id);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);

-- ── updated_at trigger (shared helper) ──
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Seed: default Koleex company ──
INSERT INTO companies (name, type, country, currency)
VALUES ('Koleex International Group', 'koleex', 'AE', 'USD')
ON CONFLICT DO NOTHING;

-- ── Seed: roles catalogue ──
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
