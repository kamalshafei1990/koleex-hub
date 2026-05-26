-- ============================================================================
-- PRODUCT TEMPLATE ENGINE — Phase 1 hardening sprint
-- Combines: RLS tightening + template binding + soft-archive flags +
-- value size guard. Drop-in: existing rows + service-role API are
-- unaffected. Anon / authenticated browser clients now CANNOT read the
-- engine tables directly — they must go through the API (which already
-- enforces tenant + module checks).
-- ============================================================================

-- ── 1. RLS — service-role only (matches accounts / inventory pattern) ──────
DROP POLICY IF EXISTS pt_read_authenticated  ON public.product_templates;
DROP POLICY IF EXISTS pts_read_authenticated ON public.product_template_sections;
DROP POLICY IF EXISTS ptf_read_authenticated ON public.product_template_fields;
DROP POLICY IF EXISTS pfv_read_authenticated ON public.product_field_values;

CREATE POLICY service_role_full_access ON public.product_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_full_access ON public.product_template_sections
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_full_access ON public.product_template_fields
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_full_access ON public.product_field_values
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- No `authenticated` policy means anon / authenticated cannot read OR
-- write through the public Supabase client. Tenant isolation is enforced
-- in the API routes (requireAuth + tenant_id check + requireModuleAccess).

-- ── 2. Template binding on products + product_models ───────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS template_id uuid
    REFERENCES public.product_templates(id) ON DELETE SET NULL;
ALTER TABLE public.product_models
  ADD COLUMN IF NOT EXISTS template_id uuid
    REFERENCES public.product_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_template_id        ON public.products(template_id);
CREATE INDEX IF NOT EXISTS idx_product_models_template_id  ON public.product_models(template_id);

COMMENT ON COLUMN public.products.template_id IS
  'Optional: which product_templates row drives the dynamic-field UI for this product. NULL = legacy hard-coded form.';
COMMENT ON COLUMN public.product_models.template_id IS
  'Optional: per-model template override. Falls back to products.template_id when NULL.';

-- ── 3. Soft-archive flags on sections + fields ─────────────────────────────
ALTER TABLE public.product_template_sections
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.product_template_fields
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_template_sections_active
  ON public.product_template_sections(template_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_template_fields_active
  ON public.product_template_fields(section_id, is_active, sort_order);

COMMENT ON COLUMN public.product_template_sections.is_active IS
  'Soft archive. Renderer + APIs filter to is_active=true. Historical values stay attached for audit.';
COMMENT ON COLUMN public.product_template_fields.is_active IS
  'Soft archive. Renderer + APIs filter to is_active=true.';

-- ── 4. Value-size guard at the column level ────────────────────────────────
ALTER TABLE public.product_field_values
  DROP CONSTRAINT IF EXISTS chk_value_json_size;
ALTER TABLE public.product_field_values
  ADD  CONSTRAINT chk_value_json_size
    CHECK (value_json IS NULL OR pg_column_size(value_json) < 65536);
