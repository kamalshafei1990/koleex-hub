-- ============================================================================
-- product_models.logistics_overrides — a family member's PACKING differences.
--
-- WHY
-- products.logistics (20260913) is the ONE home for packing & shipping, and it
-- is a FAMILY value: one row per product, shared by every model in the family.
-- Product Data's Packing & Logistics tab bound straight to it, so packing
-- typed while XPRS-8-190S was selected landed on the family and every other
-- member showed it (owner, 22 Sep 2026: "the data only follow the hero").
-- Members already keep their technical differences in specs_overrides and
-- their supplier-page differences in supplier_overrides; this column is the
-- same idea for the crates.
--
-- SHAPE
--   The same object as products.logistics, PARTIAL: a key present here
--   replaces the family value for this member; an absent key inherits it
--   live. NULL or {} = the member ships exactly like the family. Written by
--   Product Data (editor + profile), read by the public product page for the
--   selected model.
--
-- Additive only: nullable, no default, no existing column or row touched.
-- ============================================================================

alter table public.product_models
  add column if not exists logistics_overrides jsonb;

comment on column public.product_models.logistics_overrides is
  'Per-member packing & shipping differences vs products.logistics — same shape, partial; absent key = inherits the family. See supabase/migrations/20260922_product_models_logistics_overrides.sql.';
