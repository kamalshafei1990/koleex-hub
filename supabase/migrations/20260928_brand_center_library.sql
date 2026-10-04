-- ---------------------------------------------------------------------------
-- Brand Center — the library (plan step C3). Owner-approved 28/09/2026.
-- ADDITIVE ONLY: seven new tables, nothing existing is touched.
--
--   brand_sections      the 21 sections (Stationery & office … Employees)
--   brand_groups        the groups inside a section
--   brand_items         every item that can carry the KOLEEX logo
--   brand_item_types    an item's axes: size, material, finish, colour …
--   brand_item_options  the choices on each axis; `chosen` = the owner's pick
--   brand_designs       any number of designs per item, or per chosen option
--                       (owner: "maybe later I need to add my own designs");
--                       one may be the default, old ones are retired
--   brand_files         the files of a design (print PDF, SVG, PNG, DXF …),
--                       kept in private storage and served by short links
--
-- Names: `name` is the English source of truth, `name_i18n` holds zh / ar.
-- Access is server-only, like hr_* and marketing_*: RLS on with no
-- policies; every read and write goes through /api/brand-center/* with the
-- service role. Reading is open to every employee; creating, editing and
-- deleting are granted in Roles & Permissions (module "Brand Center").
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS brand_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  key         text NOT NULL,
  no          integer NOT NULL,
  name        text NOT NULL,
  name_i18n   jsonb NOT NULL DEFAULT '{}'::jsonb,
  icon        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS brand_sections_key_uq ON brand_sections (tenant_id, key);

CREATE TABLE IF NOT EXISTS brand_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  section_id  uuid NOT NULL REFERENCES brand_sections(id) ON DELETE CASCADE,
  name        text NOT NULL,
  name_i18n   jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS brand_groups_name_uq ON brand_groups (section_id, name);

CREATE TABLE IF NOT EXISTS brand_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  section_id  uuid NOT NULL REFERENCES brand_sections(id) ON DELETE CASCADE,
  group_id    uuid REFERENCES brand_groups(id) ON DELETE SET NULL,
  key         text NOT NULL,
  name        text NOT NULL,
  name_i18n   jsonb NOT NULL DEFAULT '{}'::jsonb,
  use_text    text,
  use_i18n    jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- how much we need it (the workshop's tag)
  importance  text NOT NULL DEFAULT 'core' CHECK (importance IN ('core', 'optional', 'later')),
  -- the owner's decision in the workshop
  decision    text NOT NULL DEFAULT 'yes' CHECK (decision IN ('yes', 'later', 'no')),
  -- where the item stands in the Brand Center
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
  note        text,
  owner_note  text,
  -- rules, specs, do / don't — filled as each section is built
  rules       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- professions this item concerns ("Who am I?")
  roles       text[] NOT NULL DEFAULT '{}',
  sort        integer NOT NULL DEFAULT 0,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS brand_items_key_uq ON brand_items (section_id, key);
CREATE INDEX IF NOT EXISTS brand_items_section_idx ON brand_items (tenant_id, section_id, sort);

CREATE TABLE IF NOT EXISTS brand_item_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  item_id     uuid NOT NULL REFERENCES brand_items(id) ON DELETE CASCADE,
  key         text NOT NULL,
  label       text NOT NULL,
  label_i18n  jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS brand_item_types_key_uq ON brand_item_types (item_id, key);

CREATE TABLE IF NOT EXISTS brand_item_options (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  item_id      uuid NOT NULL REFERENCES brand_items(id) ON DELETE CASCADE,
  type_id      uuid NOT NULL REFERENCES brand_item_types(id) ON DELETE CASCADE,
  key          text NOT NULL,
  label        text NOT NULL,
  label_i18n   jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended  boolean NOT NULL DEFAULT false,
  chosen       boolean NOT NULL DEFAULT true,
  sort         integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS brand_item_options_key_uq ON brand_item_options (type_id, key);
CREATE INDEX IF NOT EXISTS brand_item_options_item_idx ON brand_item_options (item_id);

CREATE TABLE IF NOT EXISTS brand_designs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  item_id     uuid NOT NULL REFERENCES brand_items(id) ON DELETE CASCADE,
  -- the options this design is for; empty = the whole item
  option_ids  uuid[] NOT NULL DEFAULT '{}',
  name        text NOT NULL,
  name_i18n   jsonb NOT NULL DEFAULT '{}'::jsonb,
  kind        text NOT NULL DEFAULT 'other'
              CHECK (kind IN ('print_file', 'editable', 'logo_pack', 'mockup', 'photo', 'vendor_brief', 'template', 'other')),
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  is_default  boolean NOT NULL DEFAULT false,
  notes       text,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brand_designs_item_idx ON brand_designs (item_id, status);

CREATE TABLE IF NOT EXISTS brand_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  design_id     uuid NOT NULL REFERENCES brand_designs(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  mime          text,
  size_bytes    bigint,
  width_mm      numeric,
  height_mm     numeric,
  purpose       text NOT NULL DEFAULT 'other'
                CHECK (purpose IN ('print_pdf', 'pdf', 'svg', 'png', 'jpg', 'dxf', 'ai', 'other')),
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brand_files_design_idx ON brand_files (design_id);

ALTER TABLE brand_sections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_item_types   ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_designs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_files        ENABLE ROW LEVEL SECURITY;
