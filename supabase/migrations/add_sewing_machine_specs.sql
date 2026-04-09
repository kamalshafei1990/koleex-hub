-- ============================================================================
-- Sewing Machine Specs Table
-- Stores template-specific and common sewing machine specifications per product.
-- Uses JSONB for flexible schema per template type.
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_sewing_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  template_slug TEXT NOT NULL,              -- e.g. 'overlock', 'bartacking'
  common_specs JSONB DEFAULT '{}'::jsonb,   -- shared fields across all templates
  template_specs JSONB DEFAULT '{}'::jsonb, -- template-specific fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_product_sewing_specs UNIQUE (product_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_sewing_specs_product ON product_sewing_specs(product_id);
CREATE INDEX IF NOT EXISTS idx_sewing_specs_template ON product_sewing_specs(template_slug);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sewing_specs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sewing_specs_updated ON product_sewing_specs;
CREATE TRIGGER trigger_sewing_specs_updated
  BEFORE UPDATE ON product_sewing_specs
  FOR EACH ROW
  EXECUTE FUNCTION update_sewing_specs_timestamp();

-- Enable RLS (Row Level Security) with public read/write for now
ALTER TABLE product_sewing_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on sewing specs"
  ON product_sewing_specs FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on sewing specs"
  ON product_sewing_specs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on sewing specs"
  ON product_sewing_specs FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete on sewing specs"
  ON product_sewing_specs FOR DELETE
  USING (true);
