-- Migration: Add reference_model column to product_models table
-- Run this in the Supabase SQL Editor if not applied automatically.

ALTER TABLE product_models
ADD COLUMN IF NOT EXISTS reference_model TEXT DEFAULT NULL;

COMMENT ON COLUMN product_models.reference_model IS 'Supplier model number or name for internal reference';
