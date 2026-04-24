-- ============================================================================
-- add_product_excerpt_and_highlights
--
-- Two new Hero-section marketing fields on the products table so the
-- admin wizard can capture them in the same step where product name,
-- brand, tagline, and primary photo live — not buried in later steps:
--
--   · excerpt     — 1-2 sentence short description. Used on product
--                   cards in the catalog, SEO meta descriptions, and
--                   auto-generated quote emails. Short and punchy.
--                   Nullable so existing products keep working.
--   · highlights  — 3-5 bullet strings ("✓ Max 5000 SPM · ✓ 2yr warranty").
--                   Rendered prominently on the public product hero
--                   next to the tagline. Defaults to empty array so
--                   existing rows don't get a NULL surprise.
--
-- Applied 2026-04-24 via MCP; this file is kept so fresh environments
-- seed the same columns.
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS excerpt TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS highlights TEXT[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
