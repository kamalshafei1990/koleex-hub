-- Collections / Icon Packs — graph-based visual organization (one asset → many collections).

CREATE TABLE IF NOT EXISTS public.visual_collections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code            text,
  name            text NOT NULL,
  slug            text NOT NULL,
  description     text,
  category        text,            -- free grouping: Core System | Business | Design | Product | Other
  collection_type text NOT NULL DEFAULT 'icon_pack'
    CHECK (collection_type IN ('ui_system','business_system','product_system','icon_pack',
      'illustration_pack','brand_assets','navigation','dashboard','semantic_group','style_system','experimental')),
  style_type      text,            -- minimal_outline | apple_style | rounded_geometry | industrial_controls | technical_icons | monochrome | filled
  icon_asset_id   uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL,
  cover_asset_id  uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL,
  approval_status text NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft','approved','archived','deprecated','internal_only')),
  visibility      text NOT NULL DEFAULT 'internal',
  -- Usage-context prep: { recommended:[], forbidden:[], target_modules:[], compatible_sections:[] }
  usage_context   jsonb NOT NULL DEFAULT '{}',
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vc_slug_uniq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_vc_tenant ON public.visual_collections (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vc_type   ON public.visual_collections (tenant_id, collection_type);
CREATE INDEX IF NOT EXISTS idx_vc_status ON public.visual_collections (tenant_id, approval_status);

CREATE TABLE IF NOT EXISTS public.visual_collection_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.visual_collections(id) ON DELETE CASCADE,
  asset_id      uuid NOT NULL REFERENCES public.visual_assets(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'secondary'
    CHECK (role IN ('primary','secondary','accent','deprecated','recommended','fallback','featured')),
  sort_order    integer NOT NULL DEFAULT 0,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vca_unique UNIQUE (collection_id, asset_id)
);
CREATE INDEX IF NOT EXISTS idx_vca_collection ON public.visual_collection_assets (collection_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_vca_asset      ON public.visual_collection_assets (asset_id);
CREATE INDEX IF NOT EXISTS idx_vca_tenant     ON public.visual_collection_assets (tenant_id);

CREATE OR REPLACE FUNCTION public.vc_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_vc_updated_at ON public.visual_collections;
CREATE TRIGGER trg_vc_updated_at BEFORE UPDATE ON public.visual_collections
  FOR EACH ROW EXECUTE FUNCTION public.vc_set_updated_at();

ALTER TABLE public.visual_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_collections;
CREATE POLICY service_role_full_access ON public.visual_collections FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.visual_collection_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_collection_assets;
CREATE POLICY service_role_full_access ON public.visual_collection_assets FOR ALL TO service_role USING (true) WITH CHECK (true);
