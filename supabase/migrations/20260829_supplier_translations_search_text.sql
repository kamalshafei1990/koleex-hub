-- Owner request 2026-08-29: "the search bar in Product Data can search for
-- anything I type — especially the Supplier tab and Hero tab."
--
-- Same recipe as products/product_models search_text (the standing rule:
-- a new searchable field is a MIGRATION, not another ilike):
--
-- 1) product_suppliers.search_text — the Supplier tab's own words: the
--    supplier's model code, their product name (+ translations), the price
--    notes (+ translations), and the price ladder's notes (price_options
--    jsonb flattened). The CONTACT's company name is already reachable.
-- 2) product_translations.search_text — the Hero tab's translated words:
--    per-locale product name, tagline, excerpt, description. This is where
--    Chinese/Arabic product names actually live.

alter table public.product_suppliers
  add column if not exists search_text text
  generated always as (
    lower(
      coalesce(supplier_product_code, '') || ' ' ||
      coalesce(supplier_product_name, '') || ' ' ||
      coalesce(supplier_product_name_i18n::text, '') || ' ' ||
      coalesce(notes, '') || ' ' ||
      coalesce(notes_i18n::text, '') || ' ' ||
      coalesce(price_options::text, '')
    )
  ) stored;

create index if not exists product_suppliers_search_text_trgm
  on public.product_suppliers using gin (search_text gin_trgm_ops);

alter table public.product_translations
  add column if not exists search_text text
  generated always as (
    lower(
      coalesce(product_name, '') || ' ' ||
      coalesce(tagline, '') || ' ' ||
      coalesce(excerpt, '') || ' ' ||
      coalesce(description, '')
    )
  ) stored;

create index if not exists product_translations_search_text_trgm
  on public.product_translations using gin (search_text gin_trgm_ops);
