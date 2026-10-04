-- Feature Highlights: free-locale translations (owner: "translate to any
-- language I want, same as the hero"). zh/ar keep their first-class columns
-- (the Hub's trilingual UI reads them); every other locale lives here as
-- { "<code>": { "title": "...", "description": "..." } } — the same
-- per-locale philosophy as product_translations.
ALTER TABLE public.product_feature_highlights
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
