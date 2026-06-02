-- KOLEEX Visual Division Registry — business-aware visual infrastructure.
-- 5 normalized tables linking every visual asset to real KOLEEX business
-- structure (division → category → subcategory → product system). Deterministic,
-- service-role RLS, AI-prep columns present but unused. No AI generation.

-- shared updated_at trigger fn (idempotent)
CREATE OR REPLACE FUNCTION public.vr_set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────
-- 1 · Divisions
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visual_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  icon_asset_id uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL,
  cover_asset_id uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL,
  visual_style text,
  dna_profile_id uuid REFERENCES public.design_dna_profiles(id) ON DELETE SET NULL,
  approval_state text NOT NULL DEFAULT 'draft' CHECK (approval_state IN ('draft','active','approved','archived')),
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  -- AI-prep (unused)
  ai_category_vector jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vdiv_slug_uniq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_vdiv_tenant ON public.visual_divisions (tenant_id, active, sort_order);

-- ─────────────────────────────────────────────────────────────────────────
-- 2 · Categories
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visual_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES public.visual_divisions(id) ON DELETE CASCADE,
  code text,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  icon_asset_id uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL,
  cover_asset_id uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL,
  visual_style text,
  usage_context text,
  dna_profile_id uuid REFERENCES public.design_dna_profiles(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  approval_state text NOT NULL DEFAULT 'draft' CHECK (approval_state IN ('draft','active','approved','archived')),
  active boolean NOT NULL DEFAULT true,
  ai_category_vector jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vcat_slug_uniq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_vcat_division ON public.visual_categories (division_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_vcat_tenant ON public.visual_categories (tenant_id, active);

-- ─────────────────────────────────────────────────────────────────────────
-- 3 · Subcategories
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visual_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.visual_categories(id) ON DELETE CASCADE,
  code text,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  icon_asset_id uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL,
  visual_style text,
  machine_type text,
  operational_context text,
  dna_profile_id uuid REFERENCES public.design_dna_profiles(id) ON DELETE SET NULL,
  usage_rules jsonb,
  sort_order int NOT NULL DEFAULT 0,
  approval_state text NOT NULL DEFAULT 'draft' CHECK (approval_state IN ('draft','active','approved','archived')),
  active boolean NOT NULL DEFAULT true,
  ai_category_vector jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vsub_slug_uniq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_vsub_category ON public.visual_subcategories (category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_vsub_tenant ON public.visual_subcategories (tenant_id, active);

-- ─────────────────────────────────────────────────────────────────────────
-- 4 · Product systems (functional systems inside machines/products)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visual_product_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subcategory_id uuid NOT NULL REFERENCES public.visual_subcategories(id) ON DELETE CASCADE,
  code text,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  system_type text NOT NULL DEFAULT 'feature'
    CHECK (system_type IN ('feature','control','safety','automation','energy','assistant','mechanical','sensor')),
  visual_style text,
  icon_asset_id uuid REFERENCES public.visual_assets(id) ON DELETE SET NULL,
  feature_priority int NOT NULL DEFAULT 0,
  complexity_level text NOT NULL DEFAULT 'medium' CHECK (complexity_level IN ('low','medium','high')),
  ui_relevance int NOT NULL DEFAULT 50,
  machine_relevance int NOT NULL DEFAULT 50,
  active boolean NOT NULL DEFAULT true,
  ai_product_mapping jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vps_slug_uniq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_vps_subcategory ON public.visual_product_systems (subcategory_id, feature_priority);
CREATE INDEX IF NOT EXISTS idx_vps_tenant ON public.visual_product_systems (tenant_id, active);

-- ─────────────────────────────────────────────────────────────────────────
-- 5 · Asset ↔ business-structure mapping (the main bridge)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visual_asset_registry_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.visual_assets(id) ON DELETE CASCADE,
  division_id uuid REFERENCES public.visual_divisions(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.visual_categories(id) ON DELETE CASCADE,
  subcategory_id uuid REFERENCES public.visual_subcategories(id) ON DELETE CASCADE,
  product_system_id uuid REFERENCES public.visual_product_systems(id) ON DELETE CASCADE,
  usage_role text NOT NULL DEFAULT 'feature'
    CHECK (usage_role IN ('navigation','feature','warning','operation','dashboard','machine-control',
      'onboarding','production','analytics','maintenance','automation','instruction','safety','status',
      'product-feature','machine-animation','erp-module','marketing')),
  priority int NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT false,
  recommended boolean NOT NULL DEFAULT false,
  deprecated boolean NOT NULL DEFAULT false,
  visual_weight numeric NOT NULL DEFAULT 1,
  -- AI-prep (unused)
  ai_product_mapping jsonb,
  ai_visual_role text,
  ai_usage_prediction jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT varl_uniq UNIQUE (asset_id, division_id, category_id, subcategory_id, product_system_id, usage_role)
);
CREATE INDEX IF NOT EXISTS idx_varl_asset ON public.visual_asset_registry_links (asset_id);
CREATE INDEX IF NOT EXISTS idx_varl_tenant ON public.visual_asset_registry_links (tenant_id);
CREATE INDEX IF NOT EXISTS idx_varl_category ON public.visual_asset_registry_links (category_id, usage_role);
CREATE INDEX IF NOT EXISTS idx_varl_subcategory ON public.visual_asset_registry_links (subcategory_id, usage_role);
CREATE INDEX IF NOT EXISTS idx_varl_division ON public.visual_asset_registry_links (division_id, usage_role);
CREATE INDEX IF NOT EXISTS idx_varl_system ON public.visual_asset_registry_links (product_system_id);

-- ── triggers ──
DROP TRIGGER IF EXISTS trg_vdiv_updated_at ON public.visual_divisions;
CREATE TRIGGER trg_vdiv_updated_at BEFORE UPDATE ON public.visual_divisions FOR EACH ROW EXECUTE FUNCTION public.vr_set_updated_at();
DROP TRIGGER IF EXISTS trg_vcat_updated_at ON public.visual_categories;
CREATE TRIGGER trg_vcat_updated_at BEFORE UPDATE ON public.visual_categories FOR EACH ROW EXECUTE FUNCTION public.vr_set_updated_at();
DROP TRIGGER IF EXISTS trg_vsub_updated_at ON public.visual_subcategories;
CREATE TRIGGER trg_vsub_updated_at BEFORE UPDATE ON public.visual_subcategories FOR EACH ROW EXECUTE FUNCTION public.vr_set_updated_at();
DROP TRIGGER IF EXISTS trg_vps_updated_at ON public.visual_product_systems;
CREATE TRIGGER trg_vps_updated_at BEFORE UPDATE ON public.visual_product_systems FOR EACH ROW EXECUTE FUNCTION public.vr_set_updated_at();

-- ── RLS (service-role only; all access flows through server) ──
ALTER TABLE public.visual_divisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_divisions;
CREATE POLICY service_role_full_access ON public.visual_divisions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.visual_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_categories;
CREATE POLICY service_role_full_access ON public.visual_categories FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.visual_subcategories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_subcategories;
CREATE POLICY service_role_full_access ON public.visual_subcategories FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.visual_product_systems ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_product_systems;
CREATE POLICY service_role_full_access ON public.visual_product_systems FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.visual_asset_registry_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.visual_asset_registry_links;
CREATE POLICY service_role_full_access ON public.visual_asset_registry_links FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Seed 6 divisions (idempotent per tenant) ──
INSERT INTO public.visual_divisions (tenant_id, code, slug, name, description, visual_style, approval_state, sort_order)
SELECT t.id, v.code, v.slug, v.name, v.description, v.visual_style, 'active', v.sort_order
FROM public.tenants t
CROSS JOIN (VALUES
  ('DIV-GARMENT',   'garment-machinery',  'Garment Machinery',  'Industrial garment & sewing machinery systems.',        'industrial', 1),
  ('DIV-TEXTILE',   'textile-tech',       'Textile Tech',       'Textile production & processing technology.',           'industrial', 2),
  ('DIV-SMART',     'smart-devices',      'Smart Devices',      'Connected & intelligent device systems.',               'futuristic', 3),
  ('DIV-INDUSTRIAL','industrial-systems', 'Industrial Systems', 'Heavy industrial equipment & infrastructure.',          'industrial', 4),
  ('DIV-AUTOMATION','automation',         'Automation',         'Automation, robotics & intelligent control systems.',   'futuristic', 5),
  ('DIV-PACKAGING', 'packaging-systems',  'Packaging Systems',  'Packaging, finishing & logistics equipment.',           'industrial', 6)
) AS v(code, slug, name, description, visual_style, sort_order)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- ── Demo structure under Garment Machinery (idempotent, per tenant) ──
-- Categories
INSERT INTO public.visual_categories (tenant_id, division_id, code, slug, name, description, visual_style, usage_context, approval_state, sort_order)
SELECT d.tenant_id, d.id, c.code, c.slug, c.name, c.description, c.visual_style, c.usage_context, 'active', c.sort_order
FROM public.visual_divisions d
CROSS JOIN (VALUES
  ('CAT-SEW',  'industrial-sewing-machines', 'Industrial Sewing Machines', 'High-speed industrial sewing systems.', 'industrial', 'production', 1),
  ('CAT-CUT',  'cutting-machines',           'Cutting Machines',           'Fabric cutting & spreading equipment.', 'industrial', 'production', 2),
  ('CAT-CTRL', 'control-panels',             'Control Panels',             'Machine control & HMI panels.',         'futuristic', 'machine-control', 3)
) AS c(code, slug, name, description, visual_style, usage_context, sort_order)
WHERE d.slug = 'garment-machinery'
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- Subcategories under Industrial Sewing Machines
INSERT INTO public.visual_subcategories (tenant_id, category_id, code, slug, name, description, visual_style, machine_type, operational_context, approval_state, sort_order)
SELECT c.tenant_id, c.id, s.code, s.slug, s.name, s.description, s.visual_style, s.machine_type, 'production', 'active', s.sort_order
FROM public.visual_categories c
CROSS JOIN (VALUES
  ('SUB-LOCK',  'lockstitch', 'Lockstitch', 'Single/double needle lockstitch machines.', 'industrial', 'lockstitch', 1),
  ('SUB-OVER',  'overlock',   'Overlock',   'Edge-finishing overlock machines.',         'industrial', 'overlock',   2),
  ('SUB-INTER', 'interlock',  'Interlock',  'Coverstitch / interlock machines.',         'industrial', 'interlock',  3),
  ('SUB-BAR',   'bartack',    'Bartack',    'Bartacking & reinforcement machines.',      'industrial', 'bartack',    4)
) AS s(code, slug, name, description, visual_style, machine_type, sort_order)
WHERE c.slug = 'industrial-sewing-machines'
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- Product systems under Lockstitch
INSERT INTO public.visual_product_systems (tenant_id, subcategory_id, code, slug, name, description, system_type, feature_priority, complexity_level, ui_relevance, machine_relevance)
SELECT sc.tenant_id, sc.id, p.code, p.slug, p.name, p.description, p.system_type, p.feature_priority, p.complexity_level, p.ui_relevance, p.machine_relevance
FROM public.visual_subcategories sc
CROSS JOIN (VALUES
  ('SYS-TRIM',  'thread-trimming', 'Thread Trimming', 'Automatic thread trimming system.', 'feature',   10, 'medium', 80, 90),
  ('SYS-FOOT',  'foot-lifter',     'Foot Lifter',     'Automatic presser foot lifter.',    'control',    8, 'low',    70, 85),
  ('SYS-NEEDLE','needle-position', 'Needle Position', 'Needle up/down positioning.',       'control',    7, 'low',    75, 80),
  ('SYS-SPEED', 'speed-control',   'Speed Control',   'Variable speed control.',           'control',    9, 'medium', 85, 88),
  ('SYS-TENS',  'tension-control', 'Tension Control', 'Thread tension management.',        'mechanical', 6, 'medium', 60, 90),
  ('SYS-BACK',  'auto-backtack',   'Auto Backtack',   'Automatic backtacking.',            'automation', 7, 'medium', 70, 82),
  ('SYS-AI',    'ai-assistant',    'AI Assistant',    'On-machine AI guidance.',           'assistant', 10, 'high',   90, 60),
  ('SYS-ENERGY','energy-saver',    'Energy Saver',    'Energy-saving servo system.',       'energy',     5, 'low',    50, 75)
) AS p(code, slug, name, description, system_type, feature_priority, complexity_level, ui_relevance, machine_relevance)
WHERE sc.slug = 'lockstitch'
ON CONFLICT (tenant_id, slug) DO NOTHING;
