-- ============================================================================
-- Accounts Manager v2 — Identity System Refactor
--
-- Separates the v1 accounts table (which mixed profile + login + permission
-- data) into properly scoped entities:
--
--   people           — Person / contact records (identity + address).
--   companies        — Organisation records. Customer level lives here as the
--                      single source of truth for pricing logic.
--   employees        — Internal HR records, linked to both a person and an
--                      account.
--   accounts         — Login identity ONLY: username, login email, password,
--                      user type, status, role, linked person, linked company.
--   access_presets   — Default permission bundles keyed to roles. Placeholder
--                      for the future custom-overrides permission layer.
--
-- Naming note: we use `people` (not `contacts`) because there is already a
-- legacy `contacts` table used by the /customers, /suppliers, and /contacts
-- pages as a flat business directory. The new `people` table is the
-- identity-layer person record. Migration of the legacy `contacts` table is
-- a separate project.
--
-- This migration is idempotent and can be applied as either:
--   a) a fresh install (v1 never applied) — creates everything from scratch.
--   b) an upgrade from v1 — drops the empty v1 accounts table, alters
--      companies to add customer_level, re-seeds roles, and creates the new
--      tables.
-- ============================================================================

-- ── Extensions ──
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Shared updated_at helper (from v1 — safe to recreate) ──
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. Companies  (create or upgrade)
-- ============================================================================

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

-- v2 addition: customer_level on the company (source of truth for pricing).
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS customer_level TEXT
  CHECK (customer_level IS NULL OR customer_level IN ('silver', 'gold', 'platinum', 'diamond'));

-- v2 addition: tax_id / vat_number for real-world company records.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_id TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_type ON companies(type);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_customer_level ON companies(customer_level);

DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed the Koleex company if it doesn't exist yet.
INSERT INTO companies (name, type, country, currency)
SELECT 'Koleex International Group', 'koleex', 'AE', 'USD'
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE type = 'koleex' LIMIT 1
);

-- ============================================================================
-- 2. Roles  (create or refresh seed)
-- ============================================================================

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

-- ============================================================================
-- 3. People  (new — person / contact records, identity layer)
-- ============================================================================

CREATE TABLE IF NOT EXISTS people (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  full_name       TEXT NOT NULL,
  display_name    TEXT,
  first_name      TEXT,
  last_name       TEXT,
  job_title       TEXT,

  -- Contact channels
  email           TEXT,
  phone           TEXT,
  mobile          TEXT,
  avatar_url      TEXT,

  -- Address
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT,
  state           TEXT,
  country         TEXT,
  postal_code     TEXT,

  -- Links
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Meta
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

-- ============================================================================
-- 4. Accounts  (refactor — login identity only)
--
-- Drops the v1 accounts table and creates the v2 shape. The v1 table never
-- had a production UI so there is no user data to preserve.
-- ============================================================================

DROP TABLE IF EXISTS accounts CASCADE;

CREATE TABLE accounts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id           UUID,                -- nullable link to auth.users when Supabase Auth is wired up

  -- ── Login identity (the core of this table) ──
  username               TEXT NOT NULL UNIQUE,
  login_email            TEXT NOT NULL UNIQUE,
  password_hash          TEXT,
  force_password_change  BOOLEAN NOT NULL DEFAULT true,
  two_factor_enabled     BOOLEAN NOT NULL DEFAULT false,
  last_login_at          TIMESTAMPTZ,

  -- ── Type, status, role ──
  user_type              TEXT NOT NULL DEFAULT 'internal' CHECK (user_type IN ('internal', 'customer')),
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  role_id                UUID REFERENCES roles(id) ON DELETE SET NULL,

  -- ── Linked records (the refactor's whole point) ──
  person_id              UUID REFERENCES people(id) ON DELETE SET NULL,     -- identity / profile
  company_id             UUID REFERENCES companies(id) ON DELETE SET NULL,  -- workspace (required for customers)

  -- ── Admin-only notes ──
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

-- ============================================================================
-- 5. Employees  (new — internal HR record, links person ↔ account)
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  person_id          UUID REFERENCES people(id) ON DELETE SET NULL,
  account_id         UUID REFERENCES accounts(id) ON DELETE SET NULL,

  -- HR data
  employee_number    TEXT UNIQUE,
  department         TEXT,
  position           TEXT,
  hire_date          DATE,
  employment_status  TEXT DEFAULT 'active' CHECK (employment_status IN ('active', 'on_leave', 'terminated', 'inactive')),
  manager_id         UUID REFERENCES employees(id) ON DELETE SET NULL,

  -- Work contact
  work_email         TEXT,
  work_phone         TEXT,

  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_person_id ON employees(person_id);
CREATE INDEX IF NOT EXISTS idx_employees_account_id ON employees(account_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);

DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 6. Access Presets  (new — role → permission bundle, placeholder)
--
-- Every role has one preset. The preset defines default access flags. The
-- final permissions system will add per-account overrides on top of this.
-- ============================================================================

CREATE TABLE IF NOT EXISTS access_presets (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id                 UUID NOT NULL UNIQUE REFERENCES roles(id) ON DELETE CASCADE,
  preset_name             TEXT NOT NULL,
  description             TEXT,

  -- Commercial
  can_access_products     BOOLEAN NOT NULL DEFAULT false,
  can_view_pricing        BOOLEAN NOT NULL DEFAULT false,
  can_create_quotations   BOOLEAN NOT NULL DEFAULT false,
  can_place_orders        BOOLEAN NOT NULL DEFAULT false,

  -- System
  can_manage_accounts     BOOLEAN NOT NULL DEFAULT false,
  can_manage_products     BOOLEAN NOT NULL DEFAULT false,
  can_access_finance      BOOLEAN NOT NULL DEFAULT false,
  can_access_hr           BOOLEAN NOT NULL DEFAULT false,
  can_access_marketing    BOOLEAN NOT NULL DEFAULT false,

  scope_notes             TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_presets_role_id ON access_presets(role_id);

-- Seed: one preset per role, derived from the role slug.
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
  -- Commercial
  CASE WHEN r.slug IN ('super_admin','admin','sales','product_manager','customer_admin','customer_staff') THEN true ELSE false END,
  CASE WHEN r.slug IN ('super_admin','admin','sales','finance','customer_admin','customer_staff') THEN true ELSE false END,
  CASE WHEN r.slug IN ('super_admin','admin','sales','customer_admin') THEN true ELSE false END,
  CASE WHEN r.slug IN ('customer_admin') THEN true ELSE false END,
  -- System
  CASE WHEN r.slug = 'super_admin' THEN true ELSE false END,
  CASE WHEN r.slug IN ('super_admin','admin','product_manager') THEN true ELSE false END,
  CASE WHEN r.slug IN ('super_admin','admin','finance') THEN true ELSE false END,
  CASE WHEN r.slug IN ('super_admin','admin','hr') THEN true ELSE false END,
  CASE WHEN r.slug IN ('super_admin','admin','marketing') THEN true ELSE false END,
  'Default preset generated by refactor migration. Override in the future permissions system.'
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
-- Done.
-- ============================================================================
