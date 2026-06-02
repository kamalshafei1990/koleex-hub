-- Visual Quality Control — per-asset visual-quality profile (deterministic now, AI-ready).

CREATE TABLE IF NOT EXISTS public.visual_asset_quality (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id    uuid NOT NULL REFERENCES public.visual_assets(id) ON DELETE CASCADE,

  -- Scores (0–100)
  quality_score             integer NOT NULL DEFAULT 0,
  style_consistency_score   integer NOT NULL DEFAULT 0,
  stroke_consistency_score  integer NOT NULL DEFAULT 0,
  spacing_score             integer NOT NULL DEFAULT 0,
  dark_mode_score           integer NOT NULL DEFAULT 0,
  simplicity_score          integer NOT NULL DEFAULT 0,
  uniqueness_score          integer NOT NULL DEFAULT 0,
  readability_score         integer NOT NULL DEFAULT 0,
  scalability_score         integer NOT NULL DEFAULT 0,
  duplicate_risk_score      integer NOT NULL DEFAULT 0,
  visual_noise_score        integer NOT NULL DEFAULT 0,
  outdated_risk_score       integer NOT NULL DEFAULT 0,
  collection_match_score    integer NOT NULL DEFAULT 0,

  overall_status  text NOT NULL DEFAULT 'acceptable'
    CHECK (overall_status IN ('excellent','good','acceptable','poor','rejected')),

  -- Style fingerprint (deterministic now; AI vectors later)
  stroke_width      text,
  stroke_style      text CHECK (stroke_style IS NULL OR stroke_style IN ('outline','filled','mixed','duotone')),
  corner_style      text CHECK (corner_style IS NULL OR corner_style IN ('sharp','rounded','soft','mixed')),
  shape_language    text,
  complexity_level  text CHECK (complexity_level IS NULL OR complexity_level IN ('minimal','medium','complex')),
  visual_density            numeric,
  padding_ratio             numeric,
  symmetry_score            integer,
  optical_balance_score     integer,
  monochrome_compatibility  integer,
  dark_background_compatibility integer,
  small_size_readability    integer,

  -- Duplicate / similarity (comparison-ready for future AI)
  duplicate_group_id  uuid,
  visually_similar_to text[] NOT NULL DEFAULT '{}',

  -- Notes + review
  ai_notes      text,
  manual_notes  text,
  reviewed_by   uuid,
  reviewed_at   timestamptz,

  computed_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vaq_asset_uniq UNIQUE (asset_id)
);
CREATE INDEX IF NOT EXISTS idx_vaq_tenant ON public.visual_asset_quality (tenant_id);
CREATE INDEX IF NOT EXISTS idx_vaq_status ON public.visual_asset_quality (tenant_id, overall_status);
CREATE INDEX IF NOT EXISTS idx_vaq_dupgroup ON public.visual_asset_quality (duplicate_group_id);

CREATE OR REPLACE FUNCTION public.vaq_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_vaq_updated_at ON public.visual_asset_quality;
CREATE TRIGGER trg_vaq_updated_at BEFORE UPDATE ON public.visual_asset_quality
  FOR EACH ROW EXECUTE FUNCTION public.vaq_set_updated_at();

ALTER TABLE public.visual_asset_quality ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_asset_quality;
CREATE POLICY service_role_full_access ON public.visual_asset_quality FOR ALL TO service_role USING (true) WITH CHECK (true);
