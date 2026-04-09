-- Migration: Create landed_cost_simulations table
-- Run this in the Supabase SQL Editor if not applied automatically.

CREATE TABLE IF NOT EXISTS landed_cost_simulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Untitled Simulation',
  status TEXT NOT NULL DEFAULT 'draft',

  -- Customer info
  customer_name TEXT,
  customer_company TEXT,
  customer_country TEXT,
  customer_city TEXT,
  warehouse_destination TEXT,

  -- Product info (top-level for filtering)
  product_id TEXT,
  product_name TEXT,
  model_id TEXT,
  model_name TEXT,
  sku TEXT,
  hs_code TEXT,
  brand TEXT,
  country_of_origin TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  price_basis TEXT DEFAULT 'FOB',

  -- All detailed cost data stored as JSONB
  product_info JSONB DEFAULT '{}'::jsonb,
  export_costs JSONB DEFAULT '{}'::jsonb,
  shipping JSONB DEFAULT '{}'::jsonb,
  import_costs JSONB DEFAULT '{}'::jsonb,
  inland_delivery JSONB DEFAULT '{}'::jsonb,
  financial JSONB DEFAULT '{}'::jsonb,
  results JSONB DEFAULT '{}'::jsonb,

  -- Meta
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_lcs_status ON landed_cost_simulations(status);
CREATE INDEX IF NOT EXISTS idx_lcs_customer ON landed_cost_simulations(customer_company);
CREATE INDEX IF NOT EXISTS idx_lcs_created ON landed_cost_simulations(created_at DESC);

-- Enable RLS but allow all for now (internal app)
ALTER TABLE landed_cost_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for landed_cost_simulations" ON landed_cost_simulations FOR ALL USING (true) WITH CHECK (true);
