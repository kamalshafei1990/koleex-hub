-- KOLEEX Usage Context Rules & Visual Governance.

-- 1. Usage context registry
CREATE TABLE IF NOT EXISTS public.visual_usage_contexts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code              text,
  slug              text NOT NULL,
  name              text NOT NULL,
  description       text,
  parent_context_id uuid REFERENCES public.visual_usage_contexts(id) ON DELETE SET NULL,
  context_type      text NOT NULL DEFAULT 'ui'
    CHECK (context_type IN ('ui','product','erp','marketing','other')),
  icon              text,
  color             text,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vuc_slug_uniq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_vuc_tenant ON public.visual_usage_contexts (tenant_id, context_type, sort_order);

-- 2. Unified context rules (asset OR collection → context, allowed/forbidden/preferred)
CREATE TABLE IF NOT EXISTS public.visual_context_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type  text NOT NULL CHECK (entity_type IN ('asset','collection')),
  entity_id    uuid NOT NULL,
  context_id   uuid NOT NULL REFERENCES public.visual_usage_contexts(id) ON DELETE CASCADE,
  rule         text NOT NULL CHECK (rule IN ('allowed','forbidden','preferred')),
  notes        text,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vcr_unique UNIQUE (tenant_id, entity_type, entity_id, context_id, rule)
);
CREATE INDEX IF NOT EXISTS idx_vcr_entity  ON public.visual_context_rules (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_vcr_context ON public.visual_context_rules (context_id, rule);
CREATE INDEX IF NOT EXISTS idx_vcr_tenant  ON public.visual_context_rules (tenant_id);

-- 3. Collection style governance + targeting
ALTER TABLE public.visual_collections
  ADD COLUMN IF NOT EXISTS preferred_style         text,
  ADD COLUMN IF NOT EXISTS preferred_stroke        text,
  ADD COLUMN IF NOT EXISTS preferred_corner_radius text,
  ADD COLUMN IF NOT EXISTS preferred_monochrome    boolean,
  ADD COLUMN IF NOT EXISTS preferred_fill          text,
  ADD COLUMN IF NOT EXISTS design_system_level     text,
  ADD COLUMN IF NOT EXISTS target_modules          text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_platforms        text[] NOT NULL DEFAULT '{}';

-- 4. Asset AI-preparation governance fields (schema only; no AI yet)
ALTER TABLE public.visual_assets
  ADD COLUMN IF NOT EXISTS ai_usage_priority       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_confidence           numeric,
  ADD COLUMN IF NOT EXISTS ai_recommended_contexts text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_rejected_contexts    text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_style_vector         jsonb NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.vuc_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_vuc_updated_at ON public.visual_usage_contexts;
CREATE TRIGGER trg_vuc_updated_at BEFORE UPDATE ON public.visual_usage_contexts
  FOR EACH ROW EXECUTE FUNCTION public.vuc_set_updated_at();

ALTER TABLE public.visual_usage_contexts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_usage_contexts;
CREATE POLICY service_role_full_access ON public.visual_usage_contexts FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE public.visual_context_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_context_rules;
CREATE POLICY service_role_full_access ON public.visual_context_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed the standard KOLEEX usage contexts (idempotent).
INSERT INTO public.visual_usage_contexts (tenant_id, code, slug, name, context_type, sort_order)
SELECT '490fbd4d-f3e8-44fa-83e6-ee26f961d5ca', v.code, v.slug, v.name, v.ctype, v.ord
FROM (VALUES
  ('CTX-UI-SIDEBAR','sidebar','Sidebar','ui',1),
  ('CTX-UI-NAVBAR','navbar','Navbar','ui',2),
  ('CTX-UI-TABBAR','tab-bar','Tab Bar','ui',3),
  ('CTX-UI-FAB','floating-action','Floating Action','ui',4),
  ('CTX-UI-WIDGET','dashboard-widget','Dashboard Widget','ui',5),
  ('CTX-UI-TOOLBAR','toolbar','Toolbar','ui',6),
  ('CTX-UI-DROPDOWN','dropdown','Dropdown','ui',7),
  ('CTX-UI-MODAL','modal','Modal','ui',8),
  ('CTX-UI-EMPTY','empty-state','Empty State','ui',9),
  ('CTX-UI-LOADING','loading-state','Loading State','ui',10),
  ('CTX-UI-ONBOARD','onboarding','Onboarding','ui',11),
  ('CTX-PR-FEATURE','product-feature','Product Feature','product',12),
  ('CTX-PR-MACHINE','machine-function','Machine Function','product',13),
  ('CTX-PR-FABRIC','fabric-material','Fabric / Material','product',14),
  ('CTX-PR-SEWING','sewing-operation','Sewing Operation','product',15),
  ('CTX-PR-CERT','certification','Certification','product',16),
  ('CTX-PR-SAFETY','safety-warning','Safety Warning','product',17),
  ('CTX-ERP-FIN','finance','Finance','erp',18),
  ('CTX-ERP-INV','inventory','Inventory','erp',19),
  ('CTX-ERP-LOG','logistics','Logistics','erp',20),
  ('CTX-ERP-SUP','suppliers','Suppliers','erp',21),
  ('CTX-ERP-CRM','crm','CRM','erp',22),
  ('CTX-ERP-HR','hr','HR','erp',23),
  ('CTX-ERP-ANL','analytics','Analytics','erp',24),
  ('CTX-MK-SOCIAL','social-media','Social Media','marketing',25),
  ('CTX-MK-PRES','presentation','Presentation','marketing',26),
  ('CTX-MK-PROFILE','company-profile','Company Profile','marketing',27),
  ('CTX-MK-EXPO','exhibition','Exhibition','marketing',28),
  ('CTX-MK-BANNER','website-banner','Website Banner','marketing',29)
) AS v(code, slug, name, ctype, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.visual_usage_contexts x
  WHERE x.tenant_id='490fbd4d-f3e8-44fa-83e6-ee26f961d5ca' AND x.slug=v.slug
);
