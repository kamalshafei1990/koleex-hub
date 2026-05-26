-- ============================================================================
-- PRODUCT TEMPLATE ENGINE — Phase 1 Foundation
--
-- Adds four new tables that form a dynamic template layer for products,
-- WITHOUT touching the existing products / product_models / product_media /
-- product_sewing_specs tables. The two systems live side-by-side. Future
-- phases will gradually migrate hard-coded forms to consume templates.
--
-- Hierarchy:
--   product_templates
--     └── product_template_sections (1..N)
--           └── product_template_fields (1..N)
--   product_field_values  (links a product/model to a field with a JSON value)
-- ============================================================================

-- ── 1. Templates ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  division_slug   text,
  category_slug   text,
  subcategory_slug text,
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_templates_slug ON public.product_templates(slug);
CREATE INDEX IF NOT EXISTS idx_product_templates_category ON public.product_templates(division_slug, category_slug, subcategory_slug);

-- ── 2. Sections ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_template_sections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid NOT NULL REFERENCES public.product_templates(id) ON DELETE CASCADE,
  title           text NOT NULL,
  slug            text NOT NULL,
  description     text,
  icon            text,
  sort_order      int NOT NULL DEFAULT 0,
  is_public       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_template_sections_template ON public.product_template_sections(template_id, sort_order);

-- ── 3. Fields ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_template_fields (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id        uuid NOT NULL REFERENCES public.product_template_sections(id) ON DELETE CASCADE,
  field_key         text NOT NULL,
  field_label       text NOT NULL,
  field_type        text NOT NULL,
  unit              text,
  placeholder       text,
  help_text         text,
  icon              text,
  sort_order        int NOT NULL DEFAULT 0,
  is_required       boolean NOT NULL DEFAULT false,
  is_public         boolean NOT NULL DEFAULT true,
  is_searchable     boolean NOT NULL DEFAULT false,
  ai_readable       boolean NOT NULL DEFAULT true,
  show_in_brochure  boolean NOT NULL DEFAULT true,
  show_in_quotation boolean NOT NULL DEFAULT false,
  show_in_catalog   boolean NOT NULL DEFAULT true,
  options_json      jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, field_key),
  CONSTRAINT chk_field_type CHECK (field_type IN (
    'text','rich_text','number','boolean','select','multi_select',
    'measurement','icon_select','image_select','color_select',
    'media','file','repeater','feature_cards'
  ))
);
CREATE INDEX IF NOT EXISTS idx_template_fields_section ON public.product_template_fields(section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_template_fields_key ON public.product_template_fields(field_key);

-- ── 4. Values ───────────────────────────────────────────────────────────────
--   Stored as JSON because field types vary (string, number, array, object).
--   model_id is nullable — value attached to PRODUCT applies to all models;
--   attached to a model_id, it overrides that one model.
CREATE TABLE IF NOT EXISTS public.product_field_values (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  model_id     uuid REFERENCES public.product_models(id) ON DELETE CASCADE,
  field_id     uuid NOT NULL REFERENCES public.product_template_fields(id) ON DELETE CASCADE,
  value_json   jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- Partial unique indexes to handle the nullable model_id (NULL ≠ NULL in
-- composite uniques, so two upserts at product-level would create duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS uq_field_value_product_only
  ON public.product_field_values (product_id, field_id) WHERE model_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_field_value_product_model
  ON public.product_field_values (product_id, model_id, field_id) WHERE model_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_field_values_product ON public.product_field_values(product_id);
CREATE INDEX IF NOT EXISTS idx_field_values_field ON public.product_field_values(field_id);

-- ── updated_at triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at_on_product_templates()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_set_updated_at_product_templates ON public.product_templates;
CREATE TRIGGER trg_set_updated_at_product_templates
BEFORE UPDATE ON public.product_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_on_product_templates();

DROP TRIGGER IF EXISTS trg_set_updated_at_product_field_values ON public.product_field_values;
CREATE TRIGGER trg_set_updated_at_product_field_values
BEFORE UPDATE ON public.product_field_values
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_on_product_templates();

-- ── Row Level Security ──────────────────────────────────────────────────────
--   Templates / sections / fields are STRUCTURE — global definitions readable
--   by any signed-in user. Values are scoped to a product (tenant inherited
--   via product_id) — readable to anyone who can read the product. Writes
--   only via service-role API routes (which call requireAuth + SA check).
ALTER TABLE public.product_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_template_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_template_fields    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_field_values       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pt_read_authenticated ON public.product_templates;
CREATE POLICY pt_read_authenticated ON public.product_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pts_read_authenticated ON public.product_template_sections;
CREATE POLICY pts_read_authenticated ON public.product_template_sections
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS ptf_read_authenticated ON public.product_template_fields;
CREATE POLICY ptf_read_authenticated ON public.product_template_fields
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pfv_read_authenticated ON public.product_field_values;
CREATE POLICY pfv_read_authenticated ON public.product_field_values
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.product_templates IS
  'Phase 1 Template Engine. Defines a reusable structure (sections + fields) that products in a given category can fill in.';
COMMENT ON TABLE public.product_template_sections IS
  'Grouping inside a template, e.g. "Sewing Performance", "Electrical Specs".';
COMMENT ON TABLE public.product_template_fields IS
  'Field definitions inside a section. field_type drives the renderer.';
COMMENT ON TABLE public.product_field_values IS
  'Per-product (or per-model) dynamic values for template fields. value_json shape depends on field_type.';
