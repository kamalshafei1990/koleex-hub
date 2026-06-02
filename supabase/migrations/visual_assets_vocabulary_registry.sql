-- Phase 2A — turn visual_assets into a visual-vocabulary registry.
-- Entities can exist with NO file ("Missing"). Add search/linking/usage columns.

ALTER TABLE public.visual_assets
  ADD COLUMN IF NOT EXISTS slug            text,
  ADD COLUMN IF NOT EXISTS keywords        text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS synonyms        text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS search_aliases  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_modules  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_apps     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS usage_count     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version         integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS theme           text;

-- Allow 'pending' in the approval workflow (Missing/Draft/Pending/Approved/Deprecated/Archived).
-- "Missing" is a DERIVED state (no svg_path), not stored — keeps approval_status orthogonal.
ALTER TABLE public.visual_assets DROP CONSTRAINT IF EXISTS visual_assets_approval_status_check;
ALTER TABLE public.visual_assets
  ADD CONSTRAINT visual_assets_approval_status_check
  CHECK (approval_status IN ('draft','pending','approved','deprecated','archived'));

-- Unique slug per tenant (the stable human key for a visual entity).
CREATE UNIQUE INDEX IF NOT EXISTS visual_assets_slug_uniq ON public.visual_assets (tenant_id, slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visual_assets_keywords_gin ON public.visual_assets USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_visual_assets_synonyms_gin ON public.visual_assets USING GIN (synonyms);
CREATE INDEX IF NOT EXISTS idx_visual_assets_usage ON public.visual_assets (tenant_id, usage_count DESC);
-- Partial index to quickly find "Missing" entities (registered but no file yet).
CREATE INDEX IF NOT EXISTS idx_visual_assets_missing ON public.visual_assets (tenant_id) WHERE svg_path IS NULL;
