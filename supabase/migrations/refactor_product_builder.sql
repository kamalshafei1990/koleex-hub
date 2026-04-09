-- ============================================================================
-- Product Builder Refactor Migration
-- Adds new fields to products and product_models tables for
-- status tracking, commercial data, and better product/model separation.
-- ============================================================================

-- ── Products table additions ──
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE products ADD COLUMN IF NOT EXISTS country_of_origin TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS moq INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_time TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS family TEXT;

-- ── Product models table additions ──
ALTER TABLE product_models ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE product_models ADD COLUMN IF NOT EXISTS moq INTEGER;
ALTER TABLE product_models ADD COLUMN IF NOT EXISTS lead_time TEXT;
ALTER TABLE product_models ADD COLUMN IF NOT EXISTS barcode TEXT;

-- ── Index for status filtering ──
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_family ON products(family);
CREATE INDEX IF NOT EXISTS idx_product_models_status ON product_models(status);
CREATE INDEX IF NOT EXISTS idx_product_models_barcode ON product_models(barcode);

-- ── Fix sku_seq permission (pre-existing issue) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'sku_seq') THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE sku_seq TO anon, authenticated';
  END IF;
END $$;
