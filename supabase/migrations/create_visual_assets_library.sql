-- KOLEEX Visual Library — centralized visual asset registry.
-- Tenant-scoped, service-role-only RLS (mirrors product_template_engine + supplier_media).
-- text+CHECK enums (not native pg enums) so the vocabulary can grow without ALTER TYPE.

CREATE TABLE IF NOT EXISTS public.visual_assets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Identity
  visual_asset_code text NOT NULL,                 -- ICO-NAV-HOME-001
  source_name       text,                          -- original file name e.g. fi-rr-home
  title             text NOT NULL,
  title_cn          text,
  title_ar          text,
  description       text,

  -- Classification
  asset_type        text NOT NULL DEFAULT 'icon'
                      CHECK (asset_type IN ('icon','illustration','photo','diagram','badge',
                                            'logo','pattern','ui_element','feature_graphic','technical_visual')),
  category          text,                           -- KOLEEX taxonomy segment (Navigation, Status, ERP...)
  subcategory       text,
  flaticon_folder   text,                           -- original source folder (provenance)
  tags              text[] NOT NULL DEFAULT '{}',
  usage             text[] NOT NULL DEFAULT '{}',
  style             text
                      CHECK (style IS NULL OR style IN ('outline','filled','duotone','line','flat',
                                                        'monochrome','technical','minimal','industrial',
                                                        'apple-style','3d','isometric','photographic')),

  -- File / storage
  file_type         text,                           -- svg | png | jpg ...
  storage_bucket    text,                           -- e.g. media
  svg_path          text,                           -- normalized asset storage path
  preview_path      text,                           -- optional raster preview path
  original_file     text,                           -- raw untouched original path
  viewbox           text,                           -- preserved SVG viewBox
  width             integer,
  height            integer,
  file_size         integer,
  mime_type         text,
  is_multipath      boolean NOT NULL DEFAULT false,

  -- Variant grouping (e.g. -alt siblings)
  is_variant        boolean NOT NULL DEFAULT false,
  variant_of        uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL,

  -- Lifecycle + governance (two orthogonal status columns, like supplier_media)
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','inactive','archived')),
  approval_status   text NOT NULL DEFAULT 'draft'
                      CHECK (approval_status IN ('draft','approved','deprecated','archived')),
  is_active         boolean NOT NULL DEFAULT true,
  source            text,                            -- 'flaticon' | 'upload' | 'taxonomy' | 'catalog'
  notes             text,

  -- Audit
  created_by        uuid,                            -- accounts.id (nullable: import/service jobs)
  approved_by       uuid,
  approved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT visual_assets_code_uniq UNIQUE (tenant_id, visual_asset_code)
);

CREATE INDEX IF NOT EXISTS idx_visual_assets_tenant      ON public.visual_assets (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visual_assets_tags_gin    ON public.visual_assets USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_visual_assets_usage_gin   ON public.visual_assets USING GIN (usage);
CREATE INDEX IF NOT EXISTS idx_visual_assets_category    ON public.visual_assets (tenant_id, category, subcategory);
CREATE INDEX IF NOT EXISTS idx_visual_assets_type        ON public.visual_assets (tenant_id, asset_type) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_visual_assets_approval    ON public.visual_assets (tenant_id, approval_status);

-- updated_at auto-maintenance
CREATE OR REPLACE FUNCTION public.visual_assets_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_visual_assets_updated_at ON public.visual_assets;
CREATE TRIGGER trg_visual_assets_updated_at
  BEFORE UPDATE ON public.visual_assets
  FOR EACH ROW EXECUTE FUNCTION public.visual_assets_set_updated_at();

-- RLS: service-role only (all access through API routes w/ requireAuth + requireModuleAccess)
ALTER TABLE public.visual_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_assets;
CREATE POLICY service_role_full_access ON public.visual_assets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Register the "Database" permission module by mirroring the sibling "Knowledge" app,
-- so existing roles keep the same visibility and nobody is locked out on launch.
INSERT INTO public.koleex_permissions (role_id, module_name, can_view, can_create, can_edit, can_delete, data_scope)
SELECT role_id, 'Database', can_view, can_create, can_edit, can_delete, data_scope
FROM public.koleex_permissions
WHERE module_name = 'Knowledge'
  AND role_id NOT IN (SELECT role_id FROM public.koleex_permissions WHERE module_name = 'Database');
