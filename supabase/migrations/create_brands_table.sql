-- ============================================================================
-- create_brands_table
--
-- First-class brands table so brand records persist the moment an
-- admin clicks "Create Brand" — instead of being inferred later
-- from DISTINCT products.brand. Before this, clicking "Create
-- Brand" without also saving the product dropped the brand name
-- on the floor (the logo survived in storage but the name was lost).
--
-- products.brand stays as a text column. The brands table is a
-- reference list — no FK, just mirrored text so existing data and
-- routes keep working without a rewrite. Minor denormalisation,
-- but trivial to maintain.
--
-- Applied 2026-04-24 via MCP; this file is kept so fresh
-- environments seed the same table.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brands (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  logo_url   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT brands_name_unique_ci UNIQUE (name),
  CONSTRAINT brands_slug_unique    UNIQUE (slug)
);

-- Case-insensitive unique on name: "Koleex" and "koleex" collide.
CREATE UNIQUE INDEX IF NOT EXISTS brands_name_ci_idx
  ON public.brands ((lower(name)));

-- Backfill brand rows from every distinct, non-empty brand name
-- that already exists on a product.
INSERT INTO public.brands (name, slug)
SELECT DISTINCT
  p.brand,
  regexp_replace(
    regexp_replace(lower(p.brand), '[^a-z0-9]+', '-', 'g'),
    '(^-|-$)', '', 'g'
  ) AS slug
FROM public.products p
WHERE p.brand IS NOT NULL AND p.brand <> ''
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Read policy: authenticated users (anyone in the app) can SELECT.
-- Writes are blocked at the RLS layer — they must go through the
-- admin server routes using the service role key.
DROP POLICY IF EXISTS brands_select_all ON public.brands;
CREATE POLICY brands_select_all
  ON public.brands
  FOR SELECT
  USING (true);

NOTIFY pgrst, 'reload schema';
