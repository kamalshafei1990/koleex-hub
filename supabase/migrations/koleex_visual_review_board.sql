-- KOLEEX Visual Review Board — operational approval workflow (5 tables + 15 seeded checklists).
CREATE TABLE IF NOT EXISTS public.visual_review_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text, title text NOT NULL, description text,
  board_type text NOT NULL DEFAULT 'production'
    CHECK (board_type IN ('production','design_review','migration','cleanup','duplicate_review','quality_review','branding_review')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed','archived')),
  created_by uuid, assigned_to text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vrb_tenant ON public.visual_review_boards (tenant_id, status);

CREATE TABLE IF NOT EXISTS public.visual_asset_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.visual_assets(id) ON DELETE CASCADE,
  board_id uuid REFERENCES public.visual_review_boards(id) ON DELETE SET NULL,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','approved','approved_with_notes','needs_revision','replace_recommended','deprecated','rejected')),
  review_priority text NOT NULL DEFAULT 'medium' CHECK (review_priority IN ('low','medium','high','critical')),
  production_ready boolean NOT NULL DEFAULT false,
  approval_score integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical')),
  recommendation text, reviewer_notes text, internal_notes text,
  reviewed_by uuid, reviewed_at timestamptz, expires_at timestamptz,
  replacement_asset_id uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL,
  redesign_required boolean NOT NULL DEFAULT false, redesign_reason text,
  usage_blocked boolean NOT NULL DEFAULT false,
  ai_review_score integer, ai_review_notes text, ai_review_confidence numeric,
  ai_suggested_replacement uuid, ai_detected_issues text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT var_asset_uniq UNIQUE (asset_id)
);
CREATE INDEX IF NOT EXISTS idx_var_tenant_status ON public.visual_asset_reviews (tenant_id, review_status);
CREATE INDEX IF NOT EXISTS idx_var_risk ON public.visual_asset_reviews (tenant_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_var_board ON public.visual_asset_reviews (board_id);

CREATE TABLE IF NOT EXISTS public.visual_review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  review_id uuid NOT NULL REFERENCES public.visual_asset_reviews(id) ON DELETE CASCADE,
  user_id uuid, user_name text, comment text NOT NULL,
  comment_type text NOT NULL DEFAULT 'note' CHECK (comment_type IN ('note','warning','suggestion','approval','rejection')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vrc_review ON public.visual_review_comments (review_id, created_at);

CREATE TABLE IF NOT EXISTS public.visual_review_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL, category text, weight numeric NOT NULL DEFAULT 1,
  required boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vrch_name_uniq UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.visual_review_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  review_id uuid NOT NULL REFERENCES public.visual_asset_reviews(id) ON DELETE CASCADE,
  checklist_id uuid NOT NULL REFERENCES public.visual_review_checklists(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0, passed boolean NOT NULL DEFAULT false, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vrs_uniq UNIQUE (review_id, checklist_id)
);
CREATE INDEX IF NOT EXISTS idx_vrs_review ON public.visual_review_scores (review_id);

CREATE OR REPLACE FUNCTION public.vrev_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_vrb_updated_at ON public.visual_review_boards;
CREATE TRIGGER trg_vrb_updated_at BEFORE UPDATE ON public.visual_review_boards FOR EACH ROW EXECUTE FUNCTION public.vrev_set_updated_at();
DROP TRIGGER IF EXISTS trg_var_updated_at ON public.visual_asset_reviews;
CREATE TRIGGER trg_var_updated_at BEFORE UPDATE ON public.visual_asset_reviews FOR EACH ROW EXECUTE FUNCTION public.vrev_set_updated_at();

ALTER TABLE public.visual_review_boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_review_boards;
CREATE POLICY service_role_full_access ON public.visual_review_boards FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE public.visual_asset_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_asset_reviews;
CREATE POLICY service_role_full_access ON public.visual_asset_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE public.visual_review_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_review_comments;
CREATE POLICY service_role_full_access ON public.visual_review_comments FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE public.visual_review_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_review_checklists;
CREATE POLICY service_role_full_access ON public.visual_review_checklists FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE public.visual_review_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_review_scores;
CREATE POLICY service_role_full_access ON public.visual_review_scores FOR ALL TO service_role USING (true) WITH CHECK (true);
