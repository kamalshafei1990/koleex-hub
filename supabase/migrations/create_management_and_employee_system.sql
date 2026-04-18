/* ---------------------------------------------------------------------------
   Management & Employee System — Database Migration

   Creates the organizational structure tables and extends the employee table
   with missing fields needed for the unified employee system.

   Tables created:
     1. koleex_departments       – Org units with parent_id nesting
     2. koleex_roles              – Named roles for position-based access
     3. koleex_positions          – Jobs within departments, reporting hierarchy
     4. koleex_assignments        – Links people → positions
     5. koleex_permissions        – Per-module permission flags on roles
     6. koleex_position_history   – Immutable audit log

   Tables altered:
     - koleex_employees           – Add employment_type, contract/probation dates,
                                    work_location, bank fields
   --------------------------------------------------------------------------- */

BEGIN;

/* ═══════════════════════════════════════════════════
   1. DEPARTMENTS
   ═══════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS koleex_departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT DEFAULT 'building2',
  icon_type     TEXT DEFAULT 'icon',        -- 'emoji' | 'image' | 'icon'
  icon_value    TEXT,
  parent_id     UUID REFERENCES koleex_departments(id) ON DELETE SET NULL,
  sort_order    INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_departments_parent ON koleex_departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON koleex_departments(is_active);

/* ═══════════════════════════════════════════════════
   2. ROLES (organisational roles, distinct from account roles)
   ═══════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS koleex_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

/* ═══════════════════════════════════════════════════
   3. POSITIONS
   ═══════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS koleex_positions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                   TEXT NOT NULL,
  department_id           UUID NOT NULL REFERENCES koleex_departments(id) ON DELETE CASCADE,
  reports_to_position_id  UUID REFERENCES koleex_positions(id) ON DELETE SET NULL,
  level                   INTEGER DEFAULT 3,   -- 0=Exec,1=Senior Mgmt,2=Mgmt,3=Senior,4=Mid,5=Entry
  description             TEXT,
  role_id                 UUID REFERENCES koleex_roles(id) ON DELETE SET NULL,
  responsibilities        TEXT,
  requirements            TEXT,
  is_active               BOOLEAN DEFAULT true,
  sort_order              INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_positions_dept ON koleex_positions(department_id);
CREATE INDEX IF NOT EXISTS idx_positions_reports_to ON koleex_positions(reports_to_position_id);
CREATE INDEX IF NOT EXISTS idx_positions_role ON koleex_positions(role_id);

/* ═══════════════════════════════════════════════════
   4. ASSIGNMENTS (people → positions)
   ═══════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS koleex_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  position_id   UUID NOT NULL REFERENCES koleex_positions(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES koleex_departments(id),
  is_primary    BOOLEAN DEFAULT true,
  start_date    DATE,
  end_date      DATE,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_person ON koleex_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_assignments_position ON koleex_assignments(position_id);
CREATE INDEX IF NOT EXISTS idx_assignments_dept ON koleex_assignments(department_id);

/* ═══════════════════════════════════════════════════
   5. PERMISSIONS (role → module access)
   ═══════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS koleex_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         UUID NOT NULL REFERENCES koleex_roles(id) ON DELETE CASCADE,
  module_name     TEXT NOT NULL,
  can_view        BOOLEAN DEFAULT false,
  can_create      BOOLEAN DEFAULT false,
  can_edit        BOOLEAN DEFAULT false,
  can_delete      BOOLEAN DEFAULT false,
  data_scope      TEXT DEFAULT 'own' CHECK (data_scope IN ('own', 'department', 'all')),
  sensitive_fields JSONB DEFAULT '[]'::jsonb,
  UNIQUE(role_id, module_name)
);

CREATE INDEX IF NOT EXISTS idx_permissions_role ON koleex_permissions(role_id);

/* ═══════════════════════════════════════════════════
   6. POSITION HISTORY (immutable audit log)
   ═══════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS koleex_position_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id       UUID REFERENCES koleex_positions(id) ON DELETE SET NULL,
  person_id         UUID REFERENCES people(id) ON DELETE SET NULL,
  department_id     UUID REFERENCES koleex_departments(id) ON DELETE SET NULL,
  action            TEXT NOT NULL,
  from_position_id  UUID REFERENCES koleex_positions(id) ON DELETE SET NULL,
  to_position_id    UUID REFERENCES koleex_positions(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_position_history_person ON koleex_position_history(person_id);
CREATE INDEX IF NOT EXISTS idx_position_history_position ON koleex_position_history(position_id);

/* ═══════════════════════════════════════════════════
   7. EXTEND koleex_employees with missing fields
   ═══════════════════════════════════════════════════ */

-- Employment type & contract details
ALTER TABLE koleex_employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full_time';
ALTER TABLE koleex_employees ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE koleex_employees ADD COLUMN IF NOT EXISTS probation_end_date DATE;
ALTER TABLE koleex_employees ADD COLUMN IF NOT EXISTS work_location TEXT DEFAULT 'office';

-- Bank account fields
ALTER TABLE koleex_employees ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE koleex_employees ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;
ALTER TABLE koleex_employees ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE koleex_employees ADD COLUMN IF NOT EXISTS bank_iban TEXT;
ALTER TABLE koleex_employees ADD COLUMN IF NOT EXISTS bank_swift TEXT;
ALTER TABLE koleex_employees ADD COLUMN IF NOT EXISTS bank_currency TEXT;

-- Additional personal fields
ALTER TABLE koleex_employees ADD COLUMN IF NOT EXISTS number_of_children INTEGER;
ALTER TABLE koleex_employees ADD COLUMN IF NOT EXISTS gender TEXT;

/* ═══════════════════════════════════════════════════
   8. AUTO-UPDATE TRIGGERS
   ═══════════════════════════════════════════════════ */

-- Generic updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION koleex_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to each table with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'koleex_departments',
    'koleex_roles',
    'koleex_positions',
    'koleex_assignments'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I; CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION koleex_set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END;
$$;

/* ═══════════════════════════════════════════════════
   9. ROW-LEVEL SECURITY (permissive for now)
   ═══════════════════════════════════════════════════ */

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'koleex_departments',
    'koleex_roles',
    'koleex_positions',
    'koleex_assignments',
    'koleex_permissions',
    'koleex_position_history'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS %s_allow_all ON %I; CREATE POLICY %s_allow_all ON %I FOR ALL USING (true) WITH CHECK (true);',
      t, t, t, t
    );
  END LOOP;
END;
$$;

COMMIT;
