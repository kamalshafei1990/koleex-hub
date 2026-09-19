-- Cost-basis adjunct costs (owner request 2026-08-28):
-- when unit_cost_cny is NOT full-landed/tax-in, the operator can now enter
-- the missing pieces so the pricing engine works from the TRUE landed cost:
--   { tax_rate_percent, delivery_cny, packing_cny, combined_cny, combined }
-- combined=true means packing+delivery entered as ONE number (combined_cny).
alter table public.product_suppliers
  add column if not exists cost_extras jsonb;
