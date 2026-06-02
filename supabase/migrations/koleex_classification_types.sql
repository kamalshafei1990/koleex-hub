-- KOLEEX Product Classification — add the Type level + simple direct icon_url.
-- Keeps the existing classification tables as the single source of truth;
-- no parallel registry. Type sits between subcategory and product systems.

-- 1 · icon_url for simple manual icon uploads (direct storage URL).
ALTER TABLE public.visual_divisions    ADD COLUMN IF NOT EXISTS icon_url text;
ALTER TABLE public.visual_categories   ADD COLUMN IF NOT EXISTS icon_url text;
ALTER TABLE public.visual_subcategories ADD COLUMN IF NOT EXISTS icon_url text;

-- 2 · Types (Division → Category → Subcategory → Type)
CREATE TABLE IF NOT EXISTS public.visual_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subcategory_id uuid NOT NULL REFERENCES public.visual_subcategories(id) ON DELETE CASCADE,
  code text,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  icon_url text,
  sort_order int NOT NULL DEFAULT 0,
  approval_state text NOT NULL DEFAULT 'active' CHECK (approval_state IN ('draft','active','approved','archived')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vtype_slug_uniq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_vtype_subcategory ON public.visual_types (subcategory_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_vtype_tenant ON public.visual_types (tenant_id, active);

DROP TRIGGER IF EXISTS trg_vtype_updated_at ON public.visual_types;
CREATE TRIGGER trg_vtype_updated_at BEFORE UPDATE ON public.visual_types FOR EACH ROW EXECUTE FUNCTION public.vr_set_updated_at();

ALTER TABLE public.visual_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_types;
CREATE POLICY service_role_full_access ON public.visual_types FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Classification icons are Visual Library assets ("Icons") — link, don't re-upload.
ALTER TABLE public.visual_types ADD COLUMN IF NOT EXISTS icon_asset_id uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL;
