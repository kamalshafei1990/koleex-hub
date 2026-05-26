-- Seed the Lockstitch sewing machine template (idempotent).
-- Run AFTER create_product_template_engine.sql.
DO $$
DECLARE
  v_template_id uuid;
  v_basic_id    uuid;
  v_apps_id     uuid;
  v_fabric_id   uuid;
  v_sewing_id   uuid;
  v_mech_id     uuid;
  v_elec_id     uuid;
  v_pack_id     uuid;
  v_acc_id      uuid;
BEGIN
  -- Template
  INSERT INTO public.product_templates
    (name, slug, division_slug, category_slug, subcategory_slug, description, is_active)
  VALUES
    ('Lockstitch Sewing Machine', 'lockstitch-sewing-machine',
     'garment-machinery', 'sewing-machines', 'lockstitch',
     'Standard industrial lockstitch sewing machine specification template.',
     true)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    division_slug = EXCLUDED.division_slug,
    category_slug = EXCLUDED.category_slug,
    subcategory_slug = EXCLUDED.subcategory_slug,
    updated_at = now()
  RETURNING id INTO v_template_id;

  IF v_template_id IS NULL THEN
    SELECT id INTO v_template_id FROM public.product_templates
      WHERE slug = 'lockstitch-sewing-machine';
  END IF;

  -- Sections
  INSERT INTO public.product_template_sections (template_id, title, slug, description, icon, sort_order, is_public) VALUES
    (v_template_id, 'Basic Information',    'basic-information',  'Identifiers and high-level overview.',                            'info',       10, true),
    (v_template_id, 'Applications',         'applications',       'Where this machine is used and what it produces.',                'target',     20, true),
    (v_template_id, 'Fabric Compatibility', 'fabric-compatibility','Materials this machine can handle.',                              'fabric',     30, true),
    (v_template_id, 'Sewing Performance',   'sewing-performance', 'Throughput and stitch capabilities.',                             'gauge',      40, true),
    (v_template_id, 'Mechanical Specs',     'mechanical-specs',   'Drive train, needle and lubrication.',                            'cog',        50, true),
    (v_template_id, 'Electrical Specs',     'electrical-specs',   'Power, voltage and motor details.',                               'plug',       60, true),
    (v_template_id, 'Packaging',            'packaging',          'Carton size, weight and shipping data.',                          'box',        70, false),
    (v_template_id, 'Accessories',          'accessories',        'What ships with the machine.',                                    'accessory',  80, true)
  ON CONFLICT (template_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    is_public = EXCLUDED.is_public;

  -- Capture section ids
  SELECT id INTO v_basic_id  FROM public.product_template_sections WHERE template_id = v_template_id AND slug = 'basic-information';
  SELECT id INTO v_apps_id   FROM public.product_template_sections WHERE template_id = v_template_id AND slug = 'applications';
  SELECT id INTO v_fabric_id FROM public.product_template_sections WHERE template_id = v_template_id AND slug = 'fabric-compatibility';
  SELECT id INTO v_sewing_id FROM public.product_template_sections WHERE template_id = v_template_id AND slug = 'sewing-performance';
  SELECT id INTO v_mech_id   FROM public.product_template_sections WHERE template_id = v_template_id AND slug = 'mechanical-specs';
  SELECT id INTO v_elec_id   FROM public.product_template_sections WHERE template_id = v_template_id AND slug = 'electrical-specs';
  SELECT id INTO v_pack_id   FROM public.product_template_sections WHERE template_id = v_template_id AND slug = 'packaging';
  SELECT id INTO v_acc_id    FROM public.product_template_sections WHERE template_id = v_template_id AND slug = 'accessories';

  -- Basic Information
  INSERT INTO public.product_template_fields
    (section_id, field_key, field_label, field_type, unit, placeholder, help_text, icon, sort_order, is_required, is_searchable, ai_readable, show_in_brochure, show_in_quotation, show_in_catalog, options_json)
  VALUES
    (v_basic_id, 'short_description', 'Short description', 'text',      null, 'One-line summary',           null, 'text',   10, true,  true,  true,  true,  true,  true,  null),
    (v_basic_id, 'long_description',  'Long description',  'rich_text', null, null,                         null, 'text',   20, false, false, true,  true,  false, true,  null)
  ON CONFLICT (section_id, field_key) DO UPDATE SET
    field_label = EXCLUDED.field_label, sort_order = EXCLUDED.sort_order;

  -- Applications
  INSERT INTO public.product_template_fields
    (section_id, field_key, field_label, field_type, unit, placeholder, help_text, icon, sort_order, is_required, is_searchable, ai_readable, show_in_brochure, show_in_quotation, show_in_catalog, options_json)
  VALUES
    (v_apps_id, 'suitable_applications', 'Suitable applications', 'multi_select', null, 'Select all that apply', null, 'list', 10, false, true,  true, true, false, true,
      '{"options":[
        {"value":"shirts","label":"Shirts"},
        {"value":"trousers","label":"Trousers"},
        {"value":"jeans","label":"Jeans"},
        {"value":"jackets","label":"Jackets"},
        {"value":"home_textile","label":"Home textile"},
        {"value":"bags","label":"Bags"},
        {"value":"workwear","label":"Workwear"}
      ]}'::jsonb),
    (v_apps_id, 'production_level', 'Production level', 'select', null, null, 'Light / Medium / Heavy duty', 'level', 20, false, true, true, true, false, true,
      '{"options":[
        {"value":"light","label":"Light"},
        {"value":"medium","label":"Medium"},
        {"value":"heavy","label":"Heavy"}
      ]}'::jsonb)
  ON CONFLICT (section_id, field_key) DO UPDATE SET
    field_label = EXCLUDED.field_label, options_json = EXCLUDED.options_json, sort_order = EXCLUDED.sort_order;

  -- Fabric Compatibility
  INSERT INTO public.product_template_fields
    (section_id, field_key, field_label, field_type, unit, placeholder, help_text, icon, sort_order, is_required, is_searchable, ai_readable, show_in_brochure, show_in_quotation, show_in_catalog, options_json)
  VALUES
    (v_fabric_id, 'compatible_materials', 'Compatible materials', 'multi_select', null, 'Pick fabric weights', null, 'fabric', 10, false, true, true, true, false, true,
      '{"options":[
        {"value":"light_woven","label":"Light woven"},
        {"value":"medium_woven","label":"Medium woven"},
        {"value":"heavy_woven","label":"Heavy woven"},
        {"value":"knit","label":"Knit"},
        {"value":"denim","label":"Denim"},
        {"value":"leather","label":"Leather"}
      ]}'::jsonb)
  ON CONFLICT (section_id, field_key) DO UPDATE SET
    options_json = EXCLUDED.options_json;

  -- Sewing Performance
  INSERT INTO public.product_template_fields
    (section_id, field_key, field_label, field_type, unit, placeholder, help_text, icon, sort_order, is_required, is_searchable, ai_readable, show_in_brochure, show_in_quotation, show_in_catalog, options_json)
  VALUES
    (v_sewing_id, 'max_sewing_speed',     'Max sewing speed',    'measurement', 'spm', 'e.g. 5000',  'Stitches per minute', 'gauge', 10, false, true, true, true, true, true, null),
    (v_sewing_id, 'stitch_length',        'Max stitch length',   'measurement', 'mm',  'e.g. 5',     null,                  null,    20, false, false, true, true, false, true, null),
    (v_sewing_id, 'presser_foot_height',  'Presser foot lift',   'measurement', 'mm',  'e.g. 13',    null,                  null,    30, false, false, true, true, false, true, null)
  ON CONFLICT (section_id, field_key) DO UPDATE SET
    field_label = EXCLUDED.field_label, unit = EXCLUDED.unit, sort_order = EXCLUDED.sort_order;

  -- Mechanical Specs
  INSERT INTO public.product_template_fields
    (section_id, field_key, field_label, field_type, unit, placeholder, help_text, icon, sort_order, is_required, is_searchable, ai_readable, show_in_brochure, show_in_quotation, show_in_catalog, options_json)
  VALUES
    (v_mech_id, 'lubrication_system', 'Lubrication system', 'select', null, null, null, 'oil', 10, false, false, true, true, false, true,
      '{"options":[
        {"value":"automatic","label":"Automatic"},
        {"value":"semi_dry","label":"Semi-dry"},
        {"value":"dry_head","label":"Dry head"}
      ]}'::jsonb),
    (v_mech_id, 'needle_type', 'Needle type', 'text', null, 'e.g. DBx1 #14', null, 'needle', 20, false, true, true, true, true, true, null)
  ON CONFLICT (section_id, field_key) DO UPDATE SET options_json = EXCLUDED.options_json;

  -- Electrical Specs
  INSERT INTO public.product_template_fields
    (section_id, field_key, field_label, field_type, unit, placeholder, help_text, icon, sort_order, is_required, is_searchable, ai_readable, show_in_brochure, show_in_quotation, show_in_catalog, options_json)
  VALUES
    (v_elec_id, 'voltage',     'Voltage',     'select',      null,  null,        null, 'plug',  10, false, true, true, true, true, true,
      '{"options":[
        {"value":"110v_1ph","label":"110V, 1-phase"},
        {"value":"220v_1ph","label":"220V, 1-phase"},
        {"value":"220v_3ph","label":"220V, 3-phase"},
        {"value":"380v_3ph","label":"380V, 3-phase"}
      ]}'::jsonb),
    (v_elec_id, 'frequency',   'Frequency',   'measurement', 'Hz',  'e.g. 50/60', null, null,   20, false, false, true, true, false, true, null),
    (v_elec_id, 'motor_power', 'Motor power', 'measurement', 'W',   'e.g. 550',   null, 'bolt', 30, false, true,  true, true, true, true,  null)
  ON CONFLICT (section_id, field_key) DO UPDATE SET options_json = EXCLUDED.options_json, unit = EXCLUDED.unit;

  -- Packaging
  INSERT INTO public.product_template_fields
    (section_id, field_key, field_label, field_type, unit, placeholder, help_text, icon, sort_order, is_required, is_searchable, ai_readable, show_in_brochure, show_in_quotation, show_in_catalog, options_json)
  VALUES
    (v_pack_id, 'packing_type',  'Packing type', 'select',      null,  null,        null, 'box',  10, false, false, true, false, true, false,
      '{"options":[
        {"value":"carton","label":"Carton"},
        {"value":"wooden_crate","label":"Wooden crate"},
        {"value":"plywood_case","label":"Plywood case"}
      ]}'::jsonb),
    (v_pack_id, 'cbm',           'CBM',          'measurement', 'm³',  'e.g. 0.27', null, null,   20, false, false, true, false, true, false, null),
    (v_pack_id, 'gross_weight',  'Gross weight', 'measurement', 'kg',  'e.g. 45',   null, null,   30, false, false, true, false, true, false, null)
  ON CONFLICT (section_id, field_key) DO UPDATE SET options_json = EXCLUDED.options_json, unit = EXCLUDED.unit;

  -- Accessories
  INSERT INTO public.product_template_fields
    (section_id, field_key, field_label, field_type, unit, placeholder, help_text, icon, sort_order, is_required, is_searchable, ai_readable, show_in_brochure, show_in_quotation, show_in_catalog, options_json)
  VALUES
    (v_acc_id, 'included_accessories', 'Included accessories', 'repeater', null, null,
      'One row per accessory. Each row: name, qty, note.', 'accessory', 10, false, false, true, true, false, true,
      '{"item_schema":[
        {"key":"name","label":"Name","type":"text","required":true},
        {"key":"qty","label":"Qty","type":"number","required":false},
        {"key":"note","label":"Note","type":"text","required":false}
      ]}'::jsonb)
  ON CONFLICT (section_id, field_key) DO UPDATE SET options_json = EXCLUDED.options_json, help_text = EXCLUDED.help_text;
END $$;
