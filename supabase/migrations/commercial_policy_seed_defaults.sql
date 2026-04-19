-- ─────────────────────────────────────────────────────────────────────
-- Commercial Policy — default seed data.
--
-- Populates every tenant with the Koleex Commercial Policy defaults
-- (verbatim from the published spec). Re-runnable via ON CONFLICT
-- DO NOTHING: existing edits are preserved; only missing rows fill in.
--
-- Applied on prod 2026-04-20 via Supabase MCP. Filed here for parity
-- in local / staging resets.
-- ─────────────────────────────────────────────────────────────────────

-- Singleton settings per tenant.
INSERT INTO commercial_settings (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Product levels (L1-L4).
INSERT INTO commercial_product_levels
  (tenant_id, code, name, sort_order, min_cost_cny, max_cost_cny, margin_percent, min_margin_percent)
SELECT t.id, v.code, v.name, v.sort_order, v.min_cost_cny, v.max_cost_cny, v.margin_percent, v.min_margin_percent
FROM tenants t
CROSS JOIN (VALUES
  ('L1', 'Entry / Volume',             1,    100.00,   5000.00,  5.000, 2.000),
  ('L2', 'Standard Commercial',        2,   5001.00,  20000.00, 10.000, 5.000),
  ('L3', 'Advanced / Semi-Industrial', 3,  20001.00,  50000.00, 15.000, 10.000),
  ('L4', 'High-End / Strategic',       4,  50001.00,     NULL,  25.000, 15.000)
) AS v(code, name, sort_order, min_cost_cny, max_cost_cny, margin_percent, min_margin_percent)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Customer tiers (End User ... Diamond).
INSERT INTO commercial_customer_tiers
  (tenant_id, code, name, real_name, level_number, sort_order, has_credit,
   credit_multiplier, credit_days, discount_cap_percent, market_rights)
SELECT t.id, v.code, v.name, v.real_name, v.level_number, v.sort_order, v.has_credit,
       v.credit_multiplier, v.credit_days, v.discount_cap_percent, v.market_rights
FROM tenants t
CROSS JOIN (VALUES
  ('end_user', 'End User',  'Personal Buyer',            0, 1, false, NULL::numeric, NULL::int, 0.000,  'Local'),
  ('silver',   'Silver',    'Dealer / Small Trader',     1, 2, false, NULL,           NULL,       5.000,  'Regional'),
  ('gold',     'Gold',      'Distributor',               2, 3, true,  3.00,           90,        10.000, 'National'),
  ('platinum', 'Platinum',  'Agent / Major Distributor', 3, 4, true,  4.00,           120,       15.000, 'Multi-Country'),
  ('diamond',  'Diamond',   'Sole Agent / Strategic',    4, 5, true,  NULL,           NULL,      20.000, 'Global')
) AS v(code, name, real_name, level_number, sort_order, has_credit,
       credit_multiplier, credit_days, discount_cap_percent, market_rights)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Market bands (A/B/C/D).
INSERT INTO commercial_market_bands
  (tenant_id, code, name, label, adjustment_percent, is_flexible, flex_min_percent, flex_max_percent, description, sort_order)
SELECT t.id, v.code, v.name, v.label, v.adjustment_percent, v.is_flexible,
       v.flex_min_percent, v.flex_max_percent, v.description, v.sort_order
FROM tenants t
CROSS JOIN (VALUES
  ('A', 'Band A', 'Price Sensitive',   -3.000, false, NULL::numeric, NULL::numeric, 'Highly price sensitive; strong competition; volume-driven.', 1),
  ('B', 'Band B', 'Balanced',            0.000, false, NULL, NULL,                   'Balanced markets with standard pricing.',                    2),
  ('C', 'Band C', 'Premium',             8.000, false, NULL, NULL,                   'Premium markets; higher margins possible.',                  3),
  ('D', 'Band D', 'Special / Project',   0.000, true, -10.000, 15.000,               'Government tenders, OEM, strategic deals. Custom pricing.',  4)
) AS v(code, name, label, adjustment_percent, is_flexible, flex_min_percent, flex_max_percent, description, sort_order)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Band -> country mapping (199 countries).
INSERT INTO commercial_band_countries (tenant_id, band_id, country_code)
SELECT t.id, mb.id, v.country_code
FROM tenants t
CROSS JOIN (VALUES
  ('AF','A'),('AL','A'),('DZ','A'),('AD','C'),('AO','A'),('AG','B'),('AR','B'),('AM','A'),('AU','C'),('AT','C'),
  ('AZ','B'),('BS','B'),('BH','C'),('BD','A'),('BB','B'),('BY','A'),('BE','C'),('BZ','A'),('BJ','A'),('BT','A'),
  ('BO','A'),('BA','A'),('BW','B'),('BR','B'),('BN','B'),('BG','B'),('BF','A'),('BI','A'),('CV','A'),('KH','A'),
  ('CM','A'),('CA','C'),('CF','A'),('TD','A'),('CL','B'),('CN','B'),('CO','B'),('KM','A'),('CG','A'),('CR','B'),
  ('CI','A'),('HR','B'),('CU','A'),('CY','C'),('CZ','B'),('DK','C'),('DJ','A'),('DM','A'),('DO','B'),('CD','A'),
  ('EC','A'),('EG','A'),('SV','A'),('GQ','A'),('ER','A'),('EE','B'),('SZ','A'),('ET','A'),('FJ','B'),('FI','C'),
  ('FR','C'),('GA','B'),('GM','A'),('GE','A'),('DE','C'),('GH','A'),('GR','B'),('GD','A'),('GT','A'),('GN','A'),
  ('GW','A'),('GY','A'),('HT','A'),('HN','A'),('HK','C'),('HU','B'),('IS','C'),('IN','B'),('ID','B'),('IR','A'),
  ('IQ','A'),('IE','C'),('IL','C'),('IT','C'),('JM','B'),('JP','C'),('JO','B'),('KZ','B'),('KE','A'),('KI','A'),
  ('XK','A'),('KW','C'),('KG','A'),('LA','A'),('LV','B'),('LB','A'),('LS','A'),('LR','A'),('LY','A'),('LI','C'),
  ('LT','B'),('LU','C'),('MO','C'),('MG','A'),('MW','A'),('MY','B'),('MV','B'),('ML','A'),('MT','C'),('MH','A'),
  ('MR','A'),('MU','B'),('MX','B'),('FM','A'),('MD','A'),('MC','C'),('MN','A'),('ME','A'),('MA','B'),('MZ','A'),
  ('MM','A'),('NA','B'),('NR','A'),('NP','A'),('NL','C'),('NZ','C'),('NI','A'),('NE','A'),('NG','A'),('KP','A'),
  ('MK','A'),('NO','C'),('OM','B'),('PK','A'),('PW','A'),('PS','A'),('PA','B'),('PG','A'),('PY','A'),('PE','B'),
  ('PH','B'),('PL','B'),('PT','B'),('QA','C'),('RO','B'),('RU','B'),('RW','A'),('KN','B'),('LC','A'),('VC','A'),
  ('WS','A'),('SM','C'),('ST','A'),('SA','B'),('SN','A'),('RS','A'),('SC','B'),('SL','A'),('SG','C'),('SK','B'),
  ('SI','B'),('SB','A'),('SO','A'),('ZA','B'),('KR','C'),('SS','A'),('ES','C'),('LK','A'),('SD','A'),('SR','A'),
  ('SE','C'),('CH','C'),('SY','A'),('TW','C'),('TJ','A'),('TZ','A'),('TH','B'),('TL','A'),('TG','A'),('TO','A'),
  ('TT','B'),('TN','B'),('TR','B'),('TM','A'),('TV','A'),('UG','A'),('UA','A'),('AE','C'),('GB','C'),('US','C'),
  ('UY','B'),('UZ','A'),('VU','A'),('VA','C'),('VE','A'),('VN','A'),('YE','A'),('ZM','A'),('ZW','A')
) AS v(country_code, band_code)
JOIN commercial_market_bands mb ON mb.tenant_id = t.id AND mb.code = v.band_code
ON CONFLICT (tenant_id, country_code) DO NOTHING;

-- Channel multipliers.
INSERT INTO commercial_channel_multipliers
  (tenant_id, code, name, applies_to_tier, multiplier, sort_order)
SELECT t.id, v.code, v.name, v.applies_to_tier, v.multiplier, v.sort_order
FROM tenants t
CROSS JOIN (VALUES
  ('platinum',      'Platinum (Agent)',       'platinum', 0.9700, 1),
  ('gold',          'Gold (Distributor)',     'gold',     1.0800, 2),
  ('silver',        'Silver (Dealer)',        'silver',   1.0800, 3),
  ('retail_global', 'Retail Global',          'end_user', 1.2000, 4)
) AS v(code, name, applies_to_tier, multiplier, sort_order)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Discount approval tiers.
INSERT INTO commercial_discount_tiers
  (tenant_id, code, label, min_percent, max_percent, approver_role, sort_order)
SELECT t.id, v.code, v.label, v.min_percent, v.max_percent, v.approver_role, v.sort_order
FROM tenants t
CROSS JOIN (VALUES
  ('auto',                'Auto (Salesperson)',       0.000,  3.000,          'salesperson',        1),
  ('sales_manager',       'Sales Manager',            3.000,  5.000,          'sales_manager',      2),
  ('commercial_manager',  'Commercial Manager',       5.000, 10.000,          'commercial_manager', 3),
  ('general_manager',     'General Manager',         10.000, 15.000,          'general_manager',    4),
  ('ceo',                 'CEO',                     15.000, NULL::numeric,   'ceo',                5)
) AS v(code, label, min_percent, max_percent, approver_role, sort_order)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Commission tiers.
INSERT INTO commercial_commission_tiers
  (tenant_id, code, name, rate_percent, applies_to, sort_order)
SELECT t.id, v.code, v.name, v.rate_percent, v.applies_to, v.sort_order
FROM tenants t
CROSS JOIN (VALUES
  ('standard',     'Standard',      3.000, 'All sales',              1),
  ('senior_sales', 'Senior Sales',  4.000, 'Senior sales personnel', 2),
  ('sales_lead',   'Sales Lead',    5.000, 'Sales leads',            3)
) AS v(code, name, rate_percent, applies_to, sort_order)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Approval authority (6 rows).
INSERT INTO commercial_approval_authority
  (tenant_id, level, role_slug, role_label, can_approve, sort_order)
SELECT t.id, v.level, v.role_slug, v.role_label, v.can_approve, v.sort_order
FROM tenants t
CROSS JOIN (VALUES
  (1, 'salesperson',        'Salesperson',        ARRAY['discount_0_3','routine_orders'],                                                    1),
  (2, 'sales_manager',      'Sales Manager',      ARRAY['discount_3_5','competitive_price_match'],                                           2),
  (3, 'commercial_manager', 'Commercial Manager', ARRAY['discount_5_10','project_pricing','promotions'],                                     3),
  (3, 'finance_manager',    'Finance Manager',    ARRAY['credit_limits','over_credit_orders','payment_terms'],                               4),
  (4, 'general_manager',    'General Manager',    ARRAY['discount_10_15','special_pricing','oem','market_entry'],                            5),
  (5, 'ceo',                'CEO',                ARRAY['discount_15_plus','diamond_contracts','market_exclusivity','territory_protection'], 6)
) AS v(level, role_slug, role_label, can_approve, sort_order)
ON CONFLICT (tenant_id, level, role_slug) DO NOTHING;
