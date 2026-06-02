-- KOLEEX Design DNA Engine — deterministic brand visual-language layer.
-- (4 tables + collection DNA columns + RLS; seed lives in koleex_design_dna_seed.sql)

CREATE TABLE IF NOT EXISTS public.design_dna_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text, name text NOT NULL, slug text NOT NULL, description text,
  profile_type text NOT NULL DEFAULT 'brand_core'
    CHECK (profile_type IN ('brand_core','ui_system','product_visual','industrial','marketing','futuristic','luxury','minimal')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ddp_slug_uniq UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.design_dna_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.design_dna_profiles(id) ON DELETE CASCADE,
  rule_group text NOT NULL CHECK (rule_group IN ('geometry','stroke','spacing','corners','symmetry','density','readability','minimalism','futuristic','luxury','industrial','balance','contrast','hierarchy')),
  rule_name text NOT NULL,
  rule_type text NOT NULL DEFAULT 'preferred' CHECK (rule_type IN ('required','preferred','forbidden')),
  target_value text, tolerance numeric, weight numeric NOT NULL DEFAULT 1, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ddr_profile ON public.design_dna_rules (profile_id, rule_group);

CREATE TABLE IF NOT EXISTS public.asset_dna_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.visual_assets(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.design_dna_profiles(id) ON DELETE CASCADE,
  overall_score integer NOT NULL DEFAULT 0, geometry_score integer NOT NULL DEFAULT 0,
  spacing_score integer NOT NULL DEFAULT 0, corner_score integer NOT NULL DEFAULT 0,
  stroke_score integer NOT NULL DEFAULT 0, minimalism_score integer NOT NULL DEFAULT 0,
  futuristic_score integer NOT NULL DEFAULT 0, industrial_score integer NOT NULL DEFAULT 0,
  luxury_score integer NOT NULL DEFAULT 0, symmetry_score integer NOT NULL DEFAULT 0,
  balance_score integer NOT NULL DEFAULT 0, readability_score integer NOT NULL DEFAULT 0,
  consistency_score integer NOT NULL DEFAULT 0,
  shape_language text, visual_density numeric, stroke_family text, corner_family text,
  geometry_family text, negative_space_ratio numeric, complexity_level text, visual_weight text,
  icon_personality text, visual_temperature text,
  violates_brand_language boolean NOT NULL DEFAULT false, too_complex boolean NOT NULL DEFAULT false,
  inconsistent_stroke boolean NOT NULL DEFAULT false, weak_balance boolean NOT NULL DEFAULT false,
  over_detailed boolean NOT NULL DEFAULT false, poor_scalability boolean NOT NULL DEFAULT false,
  pattern_matches jsonb NOT NULL DEFAULT '[]',
  computed_at timestamptz NOT NULL DEFAULT now(), reviewed_by uuid, review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ada_uniq UNIQUE (asset_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_ada_tenant ON public.asset_dna_analysis (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ada_personality ON public.asset_dna_analysis (tenant_id, icon_personality);
CREATE INDEX IF NOT EXISTS idx_ada_overall ON public.asset_dna_analysis (tenant_id, overall_score);

CREATE TABLE IF NOT EXISTS public.design_dna_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.design_dna_profiles(id) ON DELETE CASCADE,
  pattern_name text NOT NULL, description text, category text,
  example_asset_ids text[] NOT NULL DEFAULT '{}', pattern_vector jsonb NOT NULL DEFAULT '{}',
  approved boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ddpat_profile ON public.design_dna_patterns (profile_id);

ALTER TABLE public.visual_collections
  ADD COLUMN IF NOT EXISTS dominant_geometry text,
  ADD COLUMN IF NOT EXISTS dominant_style text,
  ADD COLUMN IF NOT EXISTS visual_consistency_score integer,
  ADD COLUMN IF NOT EXISTS collection_purity_score integer,
  ADD COLUMN IF NOT EXISTS style_drift_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.ddp_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_ddp_updated_at ON public.design_dna_profiles;
CREATE TRIGGER trg_ddp_updated_at BEFORE UPDATE ON public.design_dna_profiles FOR EACH ROW EXECUTE FUNCTION public.ddp_set_updated_at();
DROP TRIGGER IF EXISTS trg_ada_updated_at ON public.asset_dna_analysis;
CREATE TRIGGER trg_ada_updated_at BEFORE UPDATE ON public.asset_dna_analysis FOR EACH ROW EXECUTE FUNCTION public.ddp_set_updated_at();

ALTER TABLE public.design_dna_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.design_dna_profiles;
CREATE POLICY service_role_full_access ON public.design_dna_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE public.design_dna_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.design_dna_rules;
CREATE POLICY service_role_full_access ON public.design_dna_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE public.asset_dna_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.asset_dna_analysis;
CREATE POLICY service_role_full_access ON public.asset_dna_analysis FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE public.design_dna_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.design_dna_patterns;
CREATE POLICY service_role_full_access ON public.design_dna_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);
