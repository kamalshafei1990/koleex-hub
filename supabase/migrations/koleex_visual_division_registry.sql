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

-- ── Canonical KOLEEX taxonomy (source of truth: Product Data coding system).
--    Division → Category → Subcategory. Idempotent, per tenant. ──

-- 9 divisions (Garment Machinery live; the rest planned)
INSERT INTO public.visual_divisions (tenant_id, code, slug, name, description, approval_state, sort_order)
SELECT t.id, v.code, v.slug, v.name, v.description, v.state, v.sort_order
FROM public.tenants t
CROSS JOIN (VALUES
  ('X', 'garment-machinery',    'Garment Machinery',    'Sewing, cutting, finishing, embroidery — full apparel pipeline.', 'active', 1),
  ('D', 'digital-devices',      'Digital Devices',      'Compute, displays, peripherals, IoT controllers.',                'draft',  2),
  ('S', 'smart-living',         'Smart Living',         'Lighting, climate, kitchen, surveillance product lines.',         'draft',  3),
  ('L', 'lifestyle',            'Lifestyle',            'Personal care, wellness, leisure consumer goods.',                'draft',  4),
  ('M', 'mobility',             'Mobility',             'EV scooter, e-bike, drive systems — battery + motor axes.',       'draft',  5),
  ('I', 'industrial-solutions', 'Industrial Solutions', 'Automation, conveyors, robotic arms, vision systems.',            'draft',  6),
  ('F', 'fabrics',              'Fabrics',              'Textiles, non-wovens, technical fabrics, finishing chemistry.',   'draft',  7),
  ('E', 'energy',               'Energy',               'Power systems, storage, solar, industrial energy management.',    'draft',  8),
  ('Md','medical',              'Medical',              'Medical devices, diagnostics, healthcare equipment.',             'draft',  9)
) AS v(code, slug, name, description, state, sort_order)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 11 categories under Garment Machinery
INSERT INTO public.visual_categories (tenant_id, division_id, code, slug, name, description, approval_state, sort_order)
SELECT d.tenant_id, d.id, c.code, c.slug, c.name, c.descr, 'active', c.ord
FROM public.visual_divisions d
CROSS JOIN (VALUES
  ('XPR','fabric-preparation','Fabric Preparation','Spreading, relaxing, inspecting, and rolling fabric before cutting.',1),
  ('XC','cutting-equipment','Cutting Equipment','Manual, mechanical, and CNC cutting across knife, laser, and drilling.',2),
  ('XS','industrial-sewing-machines','Industrial Sewing Machines','The core of the garment line — lockstitch, overlock, interlock, and specialty stitch.',3),
  ('XA','automatic-sewing-systems','Automatic Sewing Systems','Single-purpose automation for pockets, plackets, collars, hems, and buttons.',4),
  ('XSE','leather-footwear-machinery','Leather & Footwear Machinery','Shoe, bag, and leather goods — including edge binding and tape attaching.',5),
  ('XE','embroidery-equipment','Embroidery Equipment','Single-head, multi-head, computerized, sequin, and cording machines.',6),
  ('XP','printing-heat-press-equipment','Printing & Heat Press Equipment','Heat presses, screen, DTG, sublimation, and pneumatic stations.',7),
  ('XF','finishing-equipment','Finishing Equipment','Irons, boilers, finishing forms, fusing presses, and washing lines.',8),
  ('XPC','packing-inspection','Packing & Inspection','Quality and packout — needle/metal/X-ray detectors, folders, sealers.',9),
  ('XD','domestic-sewing-machines','Domestic Sewing Machines','Household lockstitch, overlock, embroidery, and portable units.',10),
  ('XSP','spare-parts-accessories','Spare Parts & Accessories','Motors, drives, control panels, attachments, and replaceable machine parts.',11)
) AS c(code, slug, name, descr, ord)
WHERE d.slug = 'garment-machinery'
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 77 subcategories (slug auto-derived from label)
INSERT INTO public.visual_subcategories (tenant_id, category_id, code, slug, name, approval_state, sort_order)
SELECT c.tenant_id, c.id, s.code,
  lower(regexp_replace(regexp_replace(s.label, '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g')),
  s.label, 'active', s.ord
FROM public.visual_categories c
JOIN (VALUES
  ('fabric-preparation','XPRS','Spreading Machines',1),('fabric-preparation','XPRR','Fabric Relaxing Machines',2),
  ('fabric-preparation','XPRI','Fabric Inspection Machines',3),('fabric-preparation','XPRL','Fabric Rolling Machines',4),
  ('fabric-preparation','XPRT','Fabric Cutting Tables',5),('fabric-preparation','XPRH','Fabric Handling Systems',6),
  ('cutting-equipment','XCS','Straight Knife Cutting Machines',1),('cutting-equipment','XCR','Round Knife Cutting Machines',2),
  ('cutting-equipment','XCB','Band Knife Cutting Machines',3),('cutting-equipment','XCE','End Cutters',4),
  ('cutting-equipment','XCT','Strip Cutting Machines',5),('cutting-equipment','XCP','Tape Cutting Machines',6),
  ('cutting-equipment','XCC','CNC Cutting Machines',7),('cutting-equipment','XCL','Laser Cutting Machines',8),
  ('cutting-equipment','XCD','Fabric Drilling Machines',9),
  ('industrial-sewing-machines','XSL','Lockstitch Machines',1),('industrial-sewing-machines','XSO','Overlock Machines',2),
  ('industrial-sewing-machines','XSI','Interlock Machines',3),('industrial-sewing-machines','XSC','Chainstitch Machines',4),
  ('industrial-sewing-machines','XSD','Double Needle Machines',5),('industrial-sewing-machines','XSM','Multi-Needle Machines',6),
  ('industrial-sewing-machines','XSPA','Pattern Sewing Machines',7),('industrial-sewing-machines','XSH','Heavy Duty Machines',8),
  ('industrial-sewing-machines','XSS','Special Machines',9),
  ('automatic-sewing-systems','XAPS','Pocket Setter Machines',1),('automatic-sewing-systems','XAPW','Pocket Welting Machines',2),
  ('automatic-sewing-systems','XAPP','Placket Sewing Units',3),('automatic-sewing-systems','XASS','Side Seam Units',4),
  ('automatic-sewing-systems','XACL','Collar Machines',5),('automatic-sewing-systems','XASL','Sleeve Setting Machines',6),
  ('automatic-sewing-systems','XAHM','Hemming Machines',7),('automatic-sewing-systems','XABT','Bartacking Machines',8),
  ('automatic-sewing-systems','XABA','Button Attaching Machines',9),('automatic-sewing-systems','XABH','Buttonhole Machines',10),
  ('leather-footwear-machinery','XSES','Shoe Sewing Machines',1),('leather-footwear-machinery','XSEB','Bag Sewing Machines',2),
  ('leather-footwear-machinery','XSEL','Leather Sewing Machines',3),('leather-footwear-machinery','XSEE','Edge Binding Machines',4),
  ('leather-footwear-machinery','XSET','Tape Attaching Machines',5),
  ('embroidery-equipment','XES','Single Head Embroidery Machines',1),('embroidery-equipment','XEM','Multi Head Embroidery Machines',2),
  ('embroidery-equipment','XEC','Computerized Embroidery Machines',3),('embroidery-equipment','XEQ','Sequin Embroidery Machines',4),
  ('embroidery-equipment','XEB','Cording / Beading Machines',5),
  ('printing-heat-press-equipment','XPH','Heat Press Machines',1),('printing-heat-press-equipment','XPRH','Rotary Heat Press Machines',2),
  ('printing-heat-press-equipment','XPPH','Pneumatic Heat Press Machines',3),('printing-heat-press-equipment','XPDH','Double Station Heat Press Machines',4),
  ('printing-heat-press-equipment','XPSP','Screen Printing Machines',5),('printing-heat-press-equipment','XPDT','Digital Textile Printers (DTG)',6),
  ('printing-heat-press-equipment','XPSU','Sublimation Printers',7),
  ('finishing-equipment','XFSI','Steam Irons',1),('finishing-equipment','XFSB','Steam Boilers',2),
  ('finishing-equipment','XFIT','Ironing Tables',3),('finishing-equipment','XFVT','Vacuum Ironing Tables',4),
  ('finishing-equipment','XFFF','Form Finishing Machines',5),('finishing-equipment','XFCP','Collar & Cuff Press Machines',6),
  ('finishing-equipment','XFTS','Thread Sucking Machines',7),('finishing-equipment','XFFP','Fusing Press Machines',8),
  ('finishing-equipment','XFWM','Washing Machines',9),
  ('packing-inspection','XPCN','Needle Detectors',1),('packing-inspection','XPCM','Metal Detectors',2),
  ('packing-inspection','XPCI','Fabric Inspection Machines (Final)',3),('packing-inspection','XPCX','X-Ray Inspection Machines',4),
  ('packing-inspection','XPCF','Folding Machines',5),('packing-inspection','XPCT','Packing Tables',6),
  ('packing-inspection','XPCC','Carton Sealing Machines',7),
  ('domestic-sewing-machines','XDL','Household Lockstitch Machines',1),('domestic-sewing-machines','XDO','Household Overlock Machines',2),
  ('domestic-sewing-machines','XDE','Household Embroidery Machines',3),('domestic-sewing-machines','XDP','Portable Sewing Machines',4),
  ('spare-parts-accessories','XSPS','Servo Motors',1),('spare-parts-accessories','XSPD','Direct Drive Motors',2),
  ('spare-parts-accessories','XSPC','Control Panels',3),('spare-parts-accessories','XSPT','Touch Screens',4),
  ('spare-parts-accessories','XSPP','Machine Parts',5),('spare-parts-accessories','XSPA','Attachments & Folders',6)
) AS s(cat_slug, code, label, ord) ON c.slug = s.cat_slug
ON CONFLICT (tenant_id, slug) DO NOTHING;
