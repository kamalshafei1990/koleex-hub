-- ─────────────────────────────────────────────────────────────────────
-- Commercial Policy — data foundation (Phase 1).
--
-- Adds 9 tenant-scoped tables that hold the editable configuration for
-- the Koleex Commercial Policy (product levels, customer tiers, market
-- bands, channel multipliers, discount approval tiers, commission
-- tiers, approval authority, country-to-band mapping, and per-tenant
-- settings like the CNY→USD FX rate).
--
-- Defaults seeded for every tenant match the Commercial Policy spec
-- exactly. The existing pricing_markets / pricing_customer_types /
-- customer_price_overrides / product_market_prices tables stay intact
-- and continue to layer on top as operational overrides.
--
-- Applied on prod 2026-04-20 via Supabase MCP. File committed so the
-- schema is part of the repo for local resets and staging parity.
-- ─────────────────────────────────────────────────────────────────────

-- 1. Singleton per tenant.
CREATE TABLE IF NOT EXISTS commercial_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fx_cny_per_usd      numeric(10,4) NOT NULL DEFAULT 7.2500,
  sales_sees_cost     boolean NOT NULL DEFAULT false,
  policy_version      text NOT NULL DEFAULT 'v1',
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid REFERENCES accounts(id),
  CONSTRAINT commercial_settings_tenant_unique UNIQUE (tenant_id)
);

-- 2. Product levels (L1-L4).
CREATE TABLE IF NOT EXISTS commercial_product_levels (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code                text NOT NULL,
  name                text NOT NULL,
  sort_order          int  NOT NULL DEFAULT 0,
  min_cost_cny        numeric(14,2) NOT NULL,
  max_cost_cny        numeric(14,2),
  margin_percent      numeric(6,3)  NOT NULL,
  min_margin_percent  numeric(6,3)  NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid REFERENCES accounts(id),
  CONSTRAINT commercial_product_levels_tenant_code_unique UNIQUE (tenant_id, code)
);

-- 3. Customer tiers.
CREATE TABLE IF NOT EXISTS commercial_customer_tiers (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code                     text NOT NULL,
  name                     text NOT NULL,
  real_name                text,
  level_number             int  NOT NULL,
  sort_order               int  NOT NULL DEFAULT 0,
  has_credit               boolean NOT NULL DEFAULT false,
  credit_multiplier        numeric(6,2),
  credit_days              int,
  discount_cap_percent     numeric(6,3) NOT NULL DEFAULT 0,
  market_rights            text,
  is_active                boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid REFERENCES accounts(id),
  CONSTRAINT commercial_customer_tiers_tenant_code_unique UNIQUE (tenant_id, code)
);

-- 4. Market bands.
CREATE TABLE IF NOT EXISTS commercial_market_bands (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code                 text NOT NULL,
  name                 text NOT NULL,
  label                text,
  adjustment_percent   numeric(6,3) NOT NULL,
  is_flexible          boolean NOT NULL DEFAULT false,
  flex_min_percent     numeric(6,3),
  flex_max_percent     numeric(6,3),
  description          text,
  sort_order           int  NOT NULL DEFAULT 0,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid REFERENCES accounts(id),
  CONSTRAINT commercial_market_bands_tenant_code_unique UNIQUE (tenant_id, code)
);

-- 5. Band → country mapping.
CREATE TABLE IF NOT EXISTS commercial_band_countries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  band_id      uuid NOT NULL REFERENCES commercial_market_bands(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES accounts(id),
  CONSTRAINT commercial_band_countries_tenant_country_unique UNIQUE (tenant_id, country_code)
);

-- 6. Channel multipliers (sequential ladder).
CREATE TABLE IF NOT EXISTS commercial_channel_multipliers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code               text NOT NULL,
  name               text NOT NULL,
  applies_to_tier    text,
  multiplier         numeric(6,4) NOT NULL,
  sort_order         int  NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES accounts(id),
  CONSTRAINT commercial_channel_multipliers_tenant_code_unique UNIQUE (tenant_id, code)
);

-- 7. Discount approval tiers.
CREATE TABLE IF NOT EXISTS commercial_discount_tiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code            text NOT NULL,
  label           text NOT NULL,
  min_percent     numeric(6,3) NOT NULL,
  max_percent     numeric(6,3),
  approver_role   text NOT NULL,
  sort_order      int  NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES accounts(id),
  CONSTRAINT commercial_discount_tiers_tenant_code_unique UNIQUE (tenant_id, code)
);

-- 8. Commission tiers.
CREATE TABLE IF NOT EXISTS commercial_commission_tiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code            text NOT NULL,
  name            text NOT NULL,
  rate_percent    numeric(6,3) NOT NULL,
  applies_to      text NOT NULL,
  sort_order      int  NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES accounts(id),
  CONSTRAINT commercial_commission_tiers_tenant_code_unique UNIQUE (tenant_id, code)
);

-- 9. Approval authority.
CREATE TABLE IF NOT EXISTS commercial_approval_authority (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  level           int  NOT NULL,
  role_slug       text NOT NULL,
  role_label      text NOT NULL,
  can_approve     text[] NOT NULL DEFAULT '{}',
  sort_order      int  NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES accounts(id),
  CONSTRAINT commercial_approval_authority_tenant_unique UNIQUE (tenant_id, level, role_slug)
);

-- Indexes.
CREATE INDEX IF NOT EXISTS idx_cp_product_levels_tenant        ON commercial_product_levels(tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cp_customer_tiers_tenant        ON commercial_customer_tiers(tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cp_market_bands_tenant          ON commercial_market_bands(tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cp_band_countries_tenant_ctry   ON commercial_band_countries(tenant_id, country_code);
CREATE INDEX IF NOT EXISTS idx_cp_band_countries_band          ON commercial_band_countries(band_id);
CREATE INDEX IF NOT EXISTS idx_cp_channel_multipliers_tenant   ON commercial_channel_multipliers(tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cp_discount_tiers_tenant        ON commercial_discount_tiers(tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cp_commission_tiers_tenant      ON commercial_commission_tiers(tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cp_approval_authority_tenant    ON commercial_approval_authority(tenant_id, level);

-- updated_at triggers.
DO $$ BEGIN
  CREATE TRIGGER trg_commercial_settings_updated_at BEFORE UPDATE ON commercial_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_commercial_product_levels_updated_at BEFORE UPDATE ON commercial_product_levels FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_commercial_customer_tiers_updated_at BEFORE UPDATE ON commercial_customer_tiers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_commercial_market_bands_updated_at BEFORE UPDATE ON commercial_market_bands FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_commercial_band_countries_updated_at BEFORE UPDATE ON commercial_band_countries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_commercial_channel_multipliers_updated_at BEFORE UPDATE ON commercial_channel_multipliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_commercial_discount_tiers_updated_at BEFORE UPDATE ON commercial_discount_tiers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_commercial_commission_tiers_updated_at BEFORE UPDATE ON commercial_commission_tiers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_commercial_approval_authority_updated_at BEFORE UPDATE ON commercial_approval_authority FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE commercial_settings IS
  'Per-tenant commercial policy singleton: FX rate, sales visibility, policy version.';
COMMENT ON TABLE commercial_product_levels IS
  'L1-L4 product cost bands with default and minimum margin.';
COMMENT ON TABLE commercial_customer_tiers IS
  'End User / Silver / Gold / Platinum / Diamond — discount caps, credit rules, market rights.';
COMMENT ON TABLE commercial_market_bands IS
  'A/B/C/D market bands with adjustment percent on retail price.';
COMMENT ON TABLE commercial_band_countries IS
  'Maps ISO country codes to market band. 199 rows per tenant (seeded from policy).';
COMMENT ON TABLE commercial_channel_multipliers IS
  'Sequential ladder: Platinum x0.97 -> Gold x1.08 -> Silver x1.08 -> Retail x1.20.';
COMMENT ON TABLE commercial_discount_tiers IS
  'Discount bands with approver role (0-3% auto, 3-5% Sales Mgr, ...).';
COMMENT ON TABLE commercial_commission_tiers IS
  'Commission rates (3% / 4% / 5%) and who they apply to.';
COMMENT ON TABLE commercial_approval_authority IS
  '6 authority levels + the list of decision types each level can approve.';
