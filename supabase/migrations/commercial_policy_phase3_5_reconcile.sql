-- ───────────────────────────────────────────────────────────────────
-- Phase 3.5 — reconcile the Commercial Policy schema + seed with
-- the authoritative reference portal
-- (https://koleex-commercial-system.vercel.app/admin).
--
-- Idempotent: every ADD COLUMN is IF NOT EXISTS, every UPDATE is
-- conditional, every INSERT uses ON CONFLICT DO NOTHING.
--
-- Applied on prod 2026-04-20 via Supabase MCP. Filed here so local
-- resets reach the same post-state.
-- ───────────────────────────────────────────────────────────────────

-- 1. Product levels — add margin ranges to match the portal (the
--    portal models levels as e.g. "L2 7-12%", not a single point).
ALTER TABLE commercial_product_levels
  ADD COLUMN IF NOT EXISTS margin_min_percent numeric(6,3),
  ADD COLUMN IF NOT EXISTS margin_max_percent numeric(6,3);

COMMENT ON COLUMN commercial_product_levels.margin_min_percent IS
  'Low end of the product-level margin range (inherited from the Commercial Policy).';
COMMENT ON COLUMN commercial_product_levels.margin_max_percent IS
  'High end of the product-level margin range.';

-- 2. Channel multipliers — add TRUE-MARGIN range the engine can use
--    instead of / alongside the pre-computed multiplier.
ALTER TABLE commercial_channel_multipliers
  ADD COLUMN IF NOT EXISTS margin_min_percent numeric(6,3),
  ADD COLUMN IF NOT EXISTS margin_max_percent numeric(6,3);

COMMENT ON COLUMN commercial_channel_multipliers.margin_min_percent IS
  'Low end of this channel''s TRUE-MARGIN range (Price = Parent / (1 - margin%)).';
COMMENT ON COLUMN commercial_channel_multipliers.margin_max_percent IS
  'High end of this channel''s TRUE-MARGIN range.';

-- 3. Net Internal Cost aggregate uplift — single-knob approximation
--    until we model the full cost breakdown.
ALTER TABLE commercial_settings
  ADD COLUMN IF NOT EXISTS cost_uplift_percent numeric(6,3) NOT NULL DEFAULT 0;

COMMENT ON COLUMN commercial_settings.cost_uplift_percent IS
  'Aggregate percent applied to raw KOLEEX cost to approximate Net Internal Cost.';

-- 4. Volume discount tiers — new table.
CREATE TABLE IF NOT EXISTS commercial_volume_discount_tiers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code                 text NOT NULL,
  name                 text NOT NULL,
  min_order_usd        numeric(14,2) NOT NULL DEFAULT 0,
  max_order_usd        numeric(14,2),
  discount_min_percent numeric(6,3)  NOT NULL DEFAULT 0,
  discount_max_percent numeric(6,3)  NOT NULL DEFAULT 0,
  sort_order           int  NOT NULL DEFAULT 0,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid REFERENCES accounts(id),
  CONSTRAINT commercial_volume_discount_tiers_tenant_code_unique UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cp_volume_discount_tiers_tenant
  ON commercial_volume_discount_tiers(tenant_id, sort_order);

DO $$ BEGIN
  CREATE TRIGGER trg_commercial_volume_discount_tiers_updated_at
    BEFORE UPDATE ON commercial_volume_discount_tiers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE commercial_volume_discount_tiers IS
  'Volume-based discount tiers (Small / Medium / Large / Very Large) applied automatically based on order size.';

-- ─── Seed / backfill ───────────────────────────────────────────────

-- Correct Band C (+8% → +5% per portal's pricing-algorithm page).
UPDATE commercial_market_bands
SET adjustment_percent = 5.000
WHERE code = 'C' AND adjustment_percent = 8.000;

-- Fill margin ranges on product levels.
UPDATE commercial_product_levels SET margin_min_percent = 3,  margin_max_percent = 6
  WHERE code = 'L1' AND (margin_min_percent IS NULL OR margin_max_percent IS NULL);
UPDATE commercial_product_levels SET margin_min_percent = 7,  margin_max_percent = 12
  WHERE code = 'L2' AND (margin_min_percent IS NULL OR margin_max_percent IS NULL);
UPDATE commercial_product_levels SET margin_min_percent = 13, margin_max_percent = 20
  WHERE code = 'L3' AND (margin_min_percent IS NULL OR margin_max_percent IS NULL);
UPDATE commercial_product_levels SET margin_min_percent = 20, margin_max_percent = 35
  WHERE code = 'L4' AND (margin_min_percent IS NULL OR margin_max_percent IS NULL);

-- Fill channel margin ranges (retail = terminal, no further margin).
UPDATE commercial_channel_multipliers SET margin_min_percent = 5,  margin_max_percent = 7
  WHERE code = 'platinum' AND (margin_min_percent IS NULL OR margin_max_percent IS NULL);
UPDATE commercial_channel_multipliers SET margin_min_percent = 6,  margin_max_percent = 8
  WHERE code = 'gold'     AND (margin_min_percent IS NULL OR margin_max_percent IS NULL);
UPDATE commercial_channel_multipliers SET margin_min_percent = 10, margin_max_percent = 15
  WHERE code = 'silver'   AND (margin_min_percent IS NULL OR margin_max_percent IS NULL);

-- Seed volume discount tiers.
INSERT INTO commercial_volume_discount_tiers
  (tenant_id, code, name, min_order_usd, max_order_usd, discount_min_percent, discount_max_percent, sort_order)
SELECT t.id, v.code, v.name, v.min_order_usd, v.max_order_usd, v.discount_min_percent, v.discount_max_percent, v.sort_order
FROM tenants t
CROSS JOIN (VALUES
  ('small',     'Small',       0::numeric,      10000::numeric,  0.000, 0.000, 1),
  ('medium',    'Medium',      10000::numeric,  50000::numeric,  1.000, 2.000, 2),
  ('large',     'Large',       50000::numeric,  200000::numeric, 3.000, 5.000, 3),
  ('very_large','Very Large',  200000::numeric, NULL::numeric,   5.000, 8.000, 4)
) AS v(code, name, min_order_usd, max_order_usd, discount_min_percent, discount_max_percent, sort_order)
ON CONFLICT (tenant_id, code) DO NOTHING;
