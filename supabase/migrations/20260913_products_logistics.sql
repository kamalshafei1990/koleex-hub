-- ============================================================================
-- products.logistics — ONE home for packing & shipping, the same for every
-- product in the Hub.
--
-- WHY A COLUMN AND NOT A TEMPLATE FIELD
-- Packing lived inside the per-subcategory spec templates, and so it was only
-- ever asked of the products whose template happened to define it: 7 templates
-- out of 25 carried a packing group, two of them offered a 4-item packing-type
-- list while the rest offered 8, and one (zigzag) put the same questions on the
-- Specs tab instead. A crate is a crate whatever the machine inside it does —
-- how it is packed, what it weighs and how many fit in a container are asked of
-- EVERY product, exactly like country of origin and HS code, which were always
-- fixed fields on the form. This column makes packing one of those.
--
-- SHAPE (all keys optional; the form writes only what is filled)
--   packing_type        text    wooden_case | plywood_crate | wooden_pallet |
--                               pallet_film | carton | foam_carton |
--                               metal_frame | bulk_loose
--   wood_treatment      text    not_wood | plywood_exempt | heat_treated |
--                               fumigated | untreated
--                               ISPM-15: solid-wood packaging must be treated
--                               and marked or the shipment is held at the
--                               border (EU, US, AU and ~180 more).
--   packages            jsonb[] ONE ROW PER CRATE, not per product. A machine
--                               that ships as machine + table + accessory box
--                               is three rows; CBM, gross weight and container
--                               counts are all wrong without them.
--                               [{ label, qty, l_cm, w_cm, h_cm, gross_kg }]
--                               CENTIMETRES — the unit on every packing list
--                               and bill of lading. (Machine dimensions stay in
--                               mm on the Physical group: engineering unit.)
--   net_weight_kg       numeric bare goods, no packaging
--   gross_weight_kg     numeric derived: sum(package gross x qty)
--   cbm                 numeric derived: sum(l x w x h x qty) / 1e6
--   volumetric_kg       numeric derived: sum(l x w x h x qty) / 6000  (air)
--   stackable           bool    can a crate take another crate on top
--   stack_max           int     how many high, when stackable
--   qty_20ft/40ft/40hq  int     derived from footprint x layers, capped by the
--                               container's payload — see loading.ts
--   dangerous_goods     jsonb   { has, kinds[], un_numbers, notes }
--   port_of_loading     text
--   origin_certificate  text    none | co | form_a | form_e | eur1
--
-- Additive only: no existing column is touched and nothing is dropped.
-- ============================================================================

alter table public.products
  add column if not exists logistics jsonb not null default '{}'::jsonb;

comment on column public.products.logistics is
  'Packing & shipping for this product — the same fields for every category. See supabase/migrations/20260913_products_logistics.sql for the shape.';

-- Products whose packing is entered will be looked up by "is it filled yet",
-- so a partial index on the non-empty rows keeps that cheap without indexing
-- the whole (mostly empty) column.
create index if not exists products_logistics_filled_idx
  on public.products ((logistics <> '{}'::jsonb))
  where logistics <> '{}'::jsonb;
