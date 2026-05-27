-- ============================================================================
-- PHASE 2.1 STABILIZATION
-- Pays down the architectural debt L8 prototype surfaced:
--   · products.tenant_id  (was global; broke API tenant boundary check)
--   · product_media.role  (hero | gallery | detail | video | document)
--   · Lockstitch template gains two new sections:
--       "Features & Highlights" (feature_cards) — moves products.highlights
--                                                 into the engine
--       "Smart Functions"        (multi_select)  — auto-features
--   · L8's existing highlights[] migrated to the new feature_cards value
-- ============================================================================

-- 1. tenant_id on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tenant_id uuid
    REFERENCES public.tenants(id) ON DELETE RESTRICT;

UPDATE public.products
   SET tenant_id = '490fbd4d-f3e8-44fa-83e6-ee26f961d5ca'  -- Koleex master
 WHERE tenant_id IS NULL;

ALTER TABLE public.products
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products(tenant_id);

COMMENT ON COLUMN public.products.tenant_id IS
  'Tenant that owns this product. Backfilled in phase_2_1_stabilization — products were previously global, which broke the API tenant boundary check.';

-- 2. role on product_media
ALTER TABLE public.product_media
  ADD COLUMN IF NOT EXISTS role text;

UPDATE public.product_media
   SET role = CASE WHEN "order" = 0 THEN 'hero' ELSE 'gallery' END
 WHERE role IS NULL;

ALTER TABLE public.product_media
  ALTER COLUMN role SET DEFAULT 'gallery';
ALTER TABLE public.product_media
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE public.product_media
  DROP CONSTRAINT IF EXISTS chk_product_media_role;
ALTER TABLE public.product_media
  ADD CONSTRAINT chk_product_media_role
    CHECK (role IN ('hero','gallery','detail','video','document'));

CREATE INDEX IF NOT EXISTS idx_product_media_product_role
  ON public.product_media (product_id, role, "order");

COMMENT ON COLUMN public.product_media.role IS
  'Display role: hero (one per product, primary image), gallery (carousel), detail (deep-dive shots), video, document. Phase 2.1.';

-- 3. New template sections + fields (Features & Highlights + Smart Functions)
DO $$
DECLARE
  v_template_id uuid;
  v_features_id uuid;
  v_smart_id    uuid;
BEGIN
  SELECT id INTO v_template_id
  FROM public.product_templates
  WHERE slug = 'lockstitch-sewing-machine';

  INSERT INTO public.product_template_sections
    (template_id, title, slug, description, icon, sort_order, is_public)
  VALUES
    (v_template_id, 'Features & Highlights', 'features-highlights',
     'Visual selling points that lead the catalog page and brochure.', 'star', 15, true),
    (v_template_id, 'Smart Functions', 'smart-functions',
     'Automation features that drive operator productivity.', 'cog', 45, true)
  ON CONFLICT (template_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    is_public = EXCLUDED.is_public;

  SELECT id INTO v_features_id FROM public.product_template_sections
    WHERE template_id = v_template_id AND slug = 'features-highlights';
  SELECT id INTO v_smart_id    FROM public.product_template_sections
    WHERE template_id = v_template_id AND slug = 'smart-functions';

  INSERT INTO public.product_template_fields
    (section_id, field_key, field_label, field_type, sort_order,
     is_required, is_public, ai_readable, show_in_brochure, show_in_catalog,
     help_text, options_json)
  VALUES
    (v_features_id, 'highlights', 'Product highlights', 'feature_cards', 10,
     false, true, true, true, true,
     'One row per selling point. Title is required; blurb shows on the brochure.',
     '{"item_schema":[
       {"key":"title","label":"Title","type":"text","required":true},
       {"key":"blurb","label":"Blurb","type":"text","required":false},
       {"key":"icon","label":"Icon key","type":"text","required":false}
     ]}'::jsonb)
  ON CONFLICT (section_id, field_key) DO UPDATE SET
    field_label = EXCLUDED.field_label,
    options_json = EXCLUDED.options_json,
    help_text = EXCLUDED.help_text;

  INSERT INTO public.product_template_fields
    (section_id, field_key, field_label, field_type, sort_order,
     is_required, is_public, is_searchable, ai_readable,
     show_in_brochure, show_in_catalog, show_in_quotation, options_json)
  VALUES
    (v_smart_id, 'auto_features', 'Automation features', 'multi_select', 10,
     false, true, true, true, true, true, true,
     '{"options":[
       {"value":"auto_trim","label":"Auto thread trimmer"},
       {"value":"auto_backstitch","label":"Auto backstitch"},
       {"value":"auto_foot_lift","label":"Auto presser foot lift"},
       {"value":"auto_needle_position","label":"Auto needle positioning"},
       {"value":"stitch_counter","label":"Stitch counter / programs"},
       {"value":"led_workspace","label":"LED workspace light"},
       {"value":"low_oil_indicator","label":"Low oil indicator"},
       {"value":"servo_motor","label":"Direct-drive servo motor"}
     ]}'::jsonb)
  ON CONFLICT (section_id, field_key) DO UPDATE SET
    options_json = EXCLUDED.options_json;
END $$;

-- 4. Migrate L8 highlights[] into feature_cards + seed Smart Functions
DO $$
DECLARE
  v_product_id uuid;
  v_field_id   uuid;
  v_highlights text[];
  v_value_json jsonb;
BEGIN
  SELECT id, highlights INTO v_product_id, v_highlights
  FROM public.products WHERE slug = 'l8-lockstitch';
  IF v_product_id IS NULL OR v_highlights IS NULL OR array_length(v_highlights, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT f.id INTO v_field_id
  FROM public.product_template_fields f
  JOIN public.product_template_sections s ON s.id = f.section_id
  WHERE s.slug = 'features-highlights' AND f.field_key = 'highlights'
    AND s.template_id = (SELECT id FROM public.product_templates WHERE slug='lockstitch-sewing-machine');
  IF v_field_id IS NULL THEN RETURN; END IF;

  SELECT jsonb_agg(jsonb_build_object('title', h)) INTO v_value_json
  FROM unnest(v_highlights) AS h;

  INSERT INTO public.product_field_values
    (product_id, model_id, field_id, value_json)
  VALUES (v_product_id, NULL, v_field_id, v_value_json)
  ON CONFLICT (product_id, field_id) WHERE model_id IS NULL DO UPDATE
    SET value_json = EXCLUDED.value_json, updated_at = now();

  SELECT f.id INTO v_field_id
  FROM public.product_template_fields f
  JOIN public.product_template_sections s ON s.id = f.section_id
  WHERE s.slug = 'smart-functions' AND f.field_key = 'auto_features'
    AND s.template_id = (SELECT id FROM public.product_templates WHERE slug='lockstitch-sewing-machine');
  IF v_field_id IS NOT NULL THEN
    INSERT INTO public.product_field_values
      (product_id, model_id, field_id, value_json)
    VALUES (
      v_product_id, NULL, v_field_id,
      '["auto_trim","auto_backstitch","auto_foot_lift","auto_needle_position","stitch_counter","servo_motor"]'::jsonb
    )
    ON CONFLICT (product_id, field_id) WHERE model_id IS NULL DO UPDATE
      SET value_json = EXCLUDED.value_json, updated_at = now();
  END IF;
END $$;

-- 5. Sanity
DO $$
DECLARE v_null_count int;
BEGIN
  SELECT COUNT(*) INTO v_null_count FROM public.products WHERE tenant_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'tenant_id back-fill incomplete — % NULLs remain', v_null_count;
  END IF;
END $$;
