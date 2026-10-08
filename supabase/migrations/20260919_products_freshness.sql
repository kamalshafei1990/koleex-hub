-- ============================================================================
-- Product freshness — three moments the catalogue card can wear as a badge.
--
--   published_at        the product became ACTIVE (customers can see it)  → NEW
--   content_updated_at  customer-visible content changed after publishing → Updated
--   price_updated_at    a price/cost INPUT changed after publishing        → Price updated
--
-- Each badge lives 14 days from its moment (products-freshness.ts owns the
-- window; the database only records WHEN). Owner decisions, 19/09/2026:
--   · NEW counts from ACTIVE, not from creation — a draft is enriched for
--     weeks before anyone can see it, so created_at would expire the badge
--     before the product ever appeared.
--   · Updated fires only for content a customer can see: name, descriptions,
--     specs, knowledge, photos, models, translations. Status, visibility,
--     cost, supplier, SEO, internal identifiers and bookkeeping columns do
--     not count. Neither does an edit made while the product is still a
--     draft — it is not an "update" to anyone who could not see the original.
--   · Price updated fires when the inputs to the card's Global FOB change ON
--     THE PRODUCT: the primary supplier's landed cost or a model's cost
--     price. The daily FX rate and Commercial Setup move every card at once
--     and are NOT price changes of this product.
--
-- WHY TRIGGERS AND NOT THE API
-- A product is saved from twelve profile sheets, the full editor, the
-- models sheet, the media uploader, the supplier link, auto-translate and
-- the odd batch script. Each has its own write path. A trigger sees the
-- OLD and NEW row wherever the write came from, and it can never be
-- forgotten by the thirteenth path.
--
-- BATCH SCRIPTS: OPT OUT, PER TRANSACTION
-- A data script that touches 300 products (poster batch, taxonomy move,
-- backfill) must not paint "Updated" on the whole catalogue. Before its
-- writes, in the same connection:
--     select set_config('koleex.silent', 'on', true);
-- The third argument scopes it to the transaction. Nothing else is needed;
-- the triggers check the setting first.
--
-- BACKFILL: none, on purpose. We do not know when today's products became
-- active or when their content last changed, and a guess would put a badge
-- on products that are not new. The columns start NULL and fill from here.
--
-- Additive only: three nullable columns, four functions, five triggers.
-- ============================================================================

alter table public.products
  add column if not exists published_at       timestamptz,
  add column if not exists content_updated_at timestamptz,
  add column if not exists price_updated_at   timestamptz;

comment on column public.products.published_at       is 'When status last became active. Drives the NEW badge (14 days). Set by trigger; NULL = unknown/never.';
comment on column public.products.content_updated_at is 'Last customer-visible content change while active. Drives the Updated badge (14 days). Set by triggers.';
comment on column public.products.price_updated_at   is 'Last change to this product''s own price inputs while active. Drives the Price updated badge (14 days). Set by triggers.';

-- ── products: publish moment + own-column content changes ───────────────────
create or replace function public.products_freshness_touch()
returns trigger
language plpgsql
as $$
begin
  if current_setting('koleex.silent', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'active' then
      new.published_at := now();
    end if;
    return new;
  end if;

  -- Publishing (anything → active) is its own moment and never an "update".
  if new.status = 'active' and old.status is distinct from 'active' then
    new.published_at := now();
    return new;
  end if;

  -- Not visible to customers: nothing they could notice.
  if new.status is distinct from 'active' then
    return new;
  end if;

  -- Customer-visible content on the products row itself.
  if    old.product_name       is distinct from new.product_name
     or old.slug               is distinct from new.slug
     or old.brand              is distinct from new.brand
     or old.level              is distinct from new.level
     or old.tags               is distinct from new.tags
     or old.division_slug      is distinct from new.division_slug
     or old.category_slug      is distinct from new.category_slug
     or old.subcategory_slug   is distinct from new.subcategory_slug
     or old.description        is distinct from new.description
     or old.excerpt            is distinct from new.excerpt
     or old.highlights         is distinct from new.highlights
     or old.alternate_names    is distinct from new.alternate_names
     or old.specs              is distinct from new.specs
     or old.schema_specs       is distinct from new.schema_specs
     or old.schema_knowledge   is distinct from new.schema_knowledge
     or old.feature_cards      is distinct from new.feature_cards
     or old.hero_poster_url    is distinct from new.hero_poster_url
     or old.brand_mark_url     is distinct from new.brand_mark_url
     or old.country_of_origin  is distinct from new.country_of_origin
     or old.warranty           is distinct from new.warranty
     or old.warranty_months    is distinct from new.warranty_months
     or old.warranty_type      is distinct from new.warranty_type
     or old.warranty_coverage  is distinct from new.warranty_coverage
     or old.moq                is distinct from new.moq
     or old.lead_time          is distinct from new.lead_time
     or old.supports_head_only   is distinct from new.supports_head_only
     or old.supports_complete_set is distinct from new.supports_complete_set
  then
    new.content_updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_freshness on public.products;
create trigger trg_products_freshness
  before insert or update on public.products
  for each row execute function public.products_freshness_touch();

-- ── child tables: bump the parent, only while it is active ──────────────────
-- One helper so every child trigger updates the parent the same way. The
-- parent UPDATE re-enters products_freshness_touch, which ignores it: the
-- freshness columns are not in its watched list.
create or replace function public.products_freshness_bump(p_product uuid, p_kind text)
returns void
language plpgsql
as $$
begin
  if p_product is null then
    return;
  end if;
  if p_kind = 'price' then
    update public.products set price_updated_at = now()
     where id = p_product and status = 'active';
  else
    update public.products set content_updated_at = now()
     where id = p_product and status = 'active';
  end if;
end;
$$;

-- product_models: a model's visible facts are content; its cost inputs are
-- price. Adding or removing a model is content.
create or replace function public.product_models_freshness_touch()
returns trigger
language plpgsql
as $$
begin
  if current_setting('koleex.silent', true) = 'on' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform public.products_freshness_bump(new.product_id, 'content');
    return null;
  end if;
  if tg_op = 'DELETE' then
    perform public.products_freshness_bump(old.product_id, 'content');
    return null;
  end if;

  if    old.model_name      is distinct from new.model_name
     or old.tagline         is distinct from new.tagline
     or old.name_i18n       is distinct from new.name_i18n
     or old.tagline_i18n    is distinct from new.tagline_i18n
     or old.visible         is distinct from new.visible
     or old.specs_overrides is distinct from new.specs_overrides
     or old.supports_head_only    is distinct from new.supports_head_only
     or old.supports_complete_set is distinct from new.supports_complete_set
     or old.moq             is distinct from new.moq
     or old.lead_time       is distinct from new.lead_time
     or old.stock_status    is distinct from new.stock_status
  then
    perform public.products_freshness_bump(new.product_id, 'content');
  end if;

  if    old.cost_price         is distinct from new.cost_price
     or old.pricing_mode       is distinct from new.pricing_mode
     or old.global_price       is distinct from new.global_price
     or old.head_only_price    is distinct from new.head_only_price
     or old.complete_set_price is distinct from new.complete_set_price
  then
    perform public.products_freshness_bump(new.product_id, 'price');
  end if;

  return null;
end;
$$;

drop trigger if exists trg_product_models_freshness on public.product_models;
create trigger trg_product_models_freshness
  after insert or update or delete on public.product_models
  for each row execute function public.product_models_freshness_touch();

-- product_suppliers: the landed cost the card's Global FOB is derived from.
-- Switching which link is primary changes that cost too. Adding/removing a
-- link only matters when it is (was) the primary.
create or replace function public.product_suppliers_freshness_touch()
returns trigger
language plpgsql
as $$
begin
  if current_setting('koleex.silent', true) = 'on' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    if new.is_primary then perform public.products_freshness_bump(new.product_id, 'price'); end if;
    return null;
  end if;
  if tg_op = 'DELETE' then
    if old.is_primary then perform public.products_freshness_bump(old.product_id, 'price'); end if;
    return null;
  end if;

  if    old.is_primary        is distinct from new.is_primary
     or old.unit_cost_cny     is distinct from new.unit_cost_cny
     or old.cost_basis        is distinct from new.cost_basis
     or old.cost_includes_tax is distinct from new.cost_includes_tax
     or old.cost_extras       is distinct from new.cost_extras
  then
    perform public.products_freshness_bump(new.product_id, 'price');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_product_suppliers_freshness on public.product_suppliers;
create trigger trg_product_suppliers_freshness
  after insert or update or delete on public.product_suppliers
  for each row execute function public.product_suppliers_freshness_touch();

-- product_media + product_translations: everything on them is content.
create or replace function public.product_children_content_touch()
returns trigger
language plpgsql
as $$
begin
  if current_setting('koleex.silent', true) = 'on' then
    return null;
  end if;
  if tg_op = 'DELETE' then
    perform public.products_freshness_bump(old.product_id, 'content');
  else
    perform public.products_freshness_bump(new.product_id, 'content');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_product_media_freshness on public.product_media;
create trigger trg_product_media_freshness
  after insert or update or delete on public.product_media
  for each row execute function public.product_children_content_touch();

drop trigger if exists trg_product_translations_freshness on public.product_translations;
create trigger trg_product_translations_freshness
  after insert or update or delete on public.product_translations
  for each row execute function public.product_children_content_touch();
