-- Semantic Intelligence Layer — relationships between visual assets + AI-prep fields.

-- AI-preparation + collections columns on the asset (schema only; no AI generation yet).
ALTER TABLE public.visual_assets
  ADD COLUMN IF NOT EXISTS semantic_meaning         text,
  ADD COLUMN IF NOT EXISTS visual_style_description text,
  ADD COLUMN IF NOT EXISTS ai_prompt_description    text,
  ADD COLUMN IF NOT EXISTS collections              text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_visual_assets_collections_gin ON public.visual_assets USING GIN (collections);

-- Relationship edges between assets.
CREATE TABLE IF NOT EXISTS public.visual_asset_relationships (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_asset_id   uuid NOT NULL REFERENCES public.visual_assets(id) ON DELETE CASCADE,
  target_asset_id   uuid NOT NULL REFERENCES public.visual_assets(id) ON DELETE CASCADE,
  relationship_type text NOT NULL
    CHECK (relationship_type IN (
      'similar_to','alternative_of','parent_of','child_of','used_with','opposite_of',
      'represents','recommended_for','not_recommended_for','variation_of',
      'belongs_to_collection','semantic_match','visual_match','style_match')),
  confidence_score  integer NOT NULL DEFAULT 100 CHECK (confidence_score BETWEEN 0 AND 100),
  status            text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('suggested','approved','rejected','archived')),
  notes             text,
  -- provenance: 'manual' | 'ai' | 'import' — so future AI suggestions are distinguishable.
  origin            text NOT NULL DEFAULT 'manual',
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT var_no_self CHECK (source_asset_id <> target_asset_id),
  CONSTRAINT var_unique_edge UNIQUE (tenant_id, source_asset_id, target_asset_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_var_source ON public.visual_asset_relationships (source_asset_id, status);
CREATE INDEX IF NOT EXISTS idx_var_target ON public.visual_asset_relationships (target_asset_id, status);
CREATE INDEX IF NOT EXISTS idx_var_tenant ON public.visual_asset_relationships (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_var_type   ON public.visual_asset_relationships (tenant_id, relationship_type);

CREATE OR REPLACE FUNCTION public.var_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_var_updated_at ON public.visual_asset_relationships;
CREATE TRIGGER trg_var_updated_at BEFORE UPDATE ON public.visual_asset_relationships
  FOR EACH ROW EXECUTE FUNCTION public.var_set_updated_at();

ALTER TABLE public.visual_asset_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_asset_relationships;
CREATE POLICY service_role_full_access ON public.visual_asset_relationships
  FOR ALL TO service_role USING (true) WITH CHECK (true);
