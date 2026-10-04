-- ═══════════════════════════════════════════════════════════════════════════
-- Feature Highlights — the supplier-catalog card: small photo + name + short
-- explanation of one feature/function (owner ask 2026-08-21, pointing at the
-- Sertol/Lingrai catalog pages: "Sensor", "Adjustment motor", "Wire breakage
-- responder"…). This is neither media nor tabular specs — its own structure,
-- and the Product Build North Star already calls for it ("numbered feature
-- bullets + detail thumbnails").
--
-- Scope: belongs to a PRODUCT; optionally pinned to one MODEL (member) when a
-- feature exists only on that member — the family/override grammar.
-- Trilingual by the standing rule (EN source of truth, zh/ar optional).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.product_feature_highlights (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  model_id    uuid REFERENCES public.product_models(id) ON DELETE CASCADE,
  title       text NOT NULL,
  title_zh    text,
  title_ar    text,
  description text,
  description_zh text,
  description_ar text,
  image_url   text,
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pfh_product_sort
  ON public.product_feature_highlights (product_id, sort);

-- Same posture as the other product_* tables: reads for signed-in users,
-- writes only through the server (service role bypasses RLS; no write
-- policies on purpose).
ALTER TABLE public.product_feature_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pfh_read_authenticated ON public.product_feature_highlights;
CREATE POLICY pfh_read_authenticated ON public.product_feature_highlights
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.product_feature_highlights IS
  'Catalog-style feature cards per product (optionally per model): small photo + trilingual title/description. Not media, not specs — the "numbered feature bullets + detail thumbnails" of the Product Build North Star.';
