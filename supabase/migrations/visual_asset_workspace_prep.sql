-- Asset Workspace prep: visual-family, dependency, usage-tracking columns + audit events.

ALTER TABLE public.visual_assets
  -- Visual family / style lineage
  ADD COLUMN IF NOT EXISTS visual_family        text,
  ADD COLUMN IF NOT EXISTS shape_language       text,
  ADD COLUMN IF NOT EXISTS stroke_family        text,
  ADD COLUMN IF NOT EXISTS corner_radius_family text,
  -- Dependency graph
  ADD COLUMN IF NOT EXISTS parent_asset_id      uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS derived_from_id      uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL,
  -- Usage intelligence (schema-ready; populated by future trackers)
  ADD COLUMN IF NOT EXISTS used_in_modules      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS used_in_pages        text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS used_in_products     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS used_in_templates    text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS used_in_dashboards   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_used_at         timestamptz;

CREATE INDEX IF NOT EXISTS idx_va_visual_family ON public.visual_assets (tenant_id, visual_family);
CREATE INDEX IF NOT EXISTS idx_va_parent ON public.visual_assets (parent_asset_id);

-- Audit / history events for assets.
CREATE TABLE IF NOT EXISTS public.visual_asset_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id    uuid NOT NULL REFERENCES public.visual_assets(id) ON DELETE CASCADE,
  event_type  text NOT NULL,          -- approved | unapproved | archived | restored | file_attached | file_replaced | governance_rule | relationship | collection | edited | uploaded
  summary     text,
  actor_id    uuid,
  actor_name  text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vae_asset ON public.visual_asset_events (asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vae_tenant ON public.visual_asset_events (tenant_id, created_at DESC);

ALTER TABLE public.visual_asset_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_asset_events;
CREATE POLICY service_role_full_access ON public.visual_asset_events FOR ALL TO service_role USING (true) WITH CHECK (true);
