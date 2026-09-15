-- Product configurator options — the questions a buyer answers to reach the
-- right configuration of a product, and what each answer contributes.
--
-- ── What this is NOT ────────────────────────────────────────────────────────
-- Not a second copy of the model list. "Which machine head — direct-drive or
-- auto-trimmer" is already answered by product_models inside the family, and
-- "head only vs complete set" is already answered by supports_head_only /
-- supports_complete_set on the product. The configurator DERIVES those two
-- questions; storing them here as rows would be a second copy of a fact that
-- can then disagree with the first (owner decision 2026-08-25: derived).
--
-- What lives here is everything else: the stand, its thickness, the wheels,
-- the wheel size, the table, its fans, the colour, the voltage note — the
-- per-product questions that have no rule across products.
--
-- ── One mechanism for price AND weight ──────────────────────────────────────
-- An answer contributes price, weight and volume the same way:
--   · linked to a product/model  → contributions read LIVE from that model
--     (cost via the pricing engine; weight/cbm from product_models). Nothing
--     is copied — a wheel's weight changes on the wheel, everywhere at once.
--   · manual value               → optional price_delta_cny / weight_delta_kg
--     / cbm_delta, for choices that are not products (e.g. "2mm thickness").
--   · informational value        → all null. Voltage, plug type: recorded on
--     the document, never priced.
--
-- ── Why per-product and not per-subcategory ─────────────────────────────────
-- Owner: "all the products have different situation, has no rule". Questions
-- attach to ONE product. Re-use is a copy action in the UI, not a shared row —
-- a shared row would make editing one machine's options silently edit twenty.
--
-- Supersedes accessory_option_values (ST-2, 0 rows) — the axis list there was
-- hardcoded (shape/type/size/...); these tables let the owner define any axis.

create table if not exists public.product_options (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,

  /* What the buyer is asked, in the three Hub languages. EN is the SoT and
     always present; zh/ar fall back to EN when empty. */
  title        text not null,
  title_i18n   jsonb not null default '{}'::jsonb,

  /* choice — pick one value from the list below
     yes_no — the value list holds the single "yes" row; "no" is implicit
     info   — recorded on the quotation, never priced (voltage, plug) */
  kind         text not null default 'choice'
               check (kind in ('choice','yes_no','info')),

  /* A required question blocks quoting until answered; an optional one
     falls back to its default value. */
  required     boolean not null default false,

  /* Show this question only when another question's SPECIFIC answer was
     chosen — wheel size only exists once "with wheels" = yes. Depending on a
     VALUE (not merely a question) is what lets one parent fan out to
     different follow-ups per answer. */
  depends_on_value_id uuid,

  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.product_option_values (
  id           uuid primary key default gen_random_uuid(),
  option_id    uuid not null references public.product_options(id) on delete cascade,

  label        text not null,
  label_i18n   jsonb not null default '{}'::jsonb,

  /* Chosen by the owner from the Visual Library / uploads — never generated. */
  image_url    text,

  /* ── What choosing this answer adds ──────────────────────────────────
     EITHER a live link (product, optionally narrowed to one model), OR
     manual deltas, or neither. The guard below refuses rows that carry
     both: a linked answer must never carry numbers that can drift from
     the linked model's own. */
  linked_product_id uuid references public.products(id) on delete set null,
  linked_model_id   uuid references public.product_models(id) on delete set null,

  price_delta_cny  numeric,
  weight_delta_kg  numeric,
  cbm_delta        numeric,

  is_default   boolean not null default false,
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

/* depends_on_value_id is declared after both tables exist (it points at the
   values table). NOT "on delete cascade": deleting an answer must not silently
   delete a whole branch of questions someone spent time entering — it just
   unhooks them, and the editor shows them as unconditional again. */
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'product_options_depends_on_value_fkey'
  ) then
    alter table public.product_options
      add constraint product_options_depends_on_value_fkey
      foreign key (depends_on_value_id)
      references public.product_option_values(id) on delete set null;
  end if;
end $$;

create index if not exists product_options_product_idx
  on public.product_options (product_id, sort_order);
create index if not exists product_option_values_option_idx
  on public.product_option_values (option_id, sort_order);
create index if not exists product_option_values_linked_idx
  on public.product_option_values (linked_product_id)
  where linked_product_id is not null;

/* A linked answer reads price and weight from its model; manual deltas on the
   same row would be a second copy able to disagree — the exact bug class this
   design exists to prevent. Enforced at the DB so no future route or console
   session can create the ambiguity. */
create or replace function public.guard_option_value_pricing()
returns trigger
language plpgsql
as $$
begin
  if new.linked_product_id is not null
     and (new.price_delta_cny is not null
          or new.weight_delta_kg is not null
          or new.cbm_delta is not null) then
    raise exception 'A linked option value takes price and weight from its linked model — remove the manual deltas or the link.';
  end if;
  /* A model belongs to a product; a model link without its product (or
     pointing at another product's model) is unresolvable. */
  if new.linked_model_id is not null then
    if new.linked_product_id is null then
      raise exception 'linked_model_id requires linked_product_id.';
    end if;
    if not exists (
      select 1 from public.product_models m
      where m.id = new.linked_model_id and m.product_id = new.linked_product_id
    ) then
      raise exception 'linked_model_id does not belong to linked_product_id.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_option_value_pricing on public.product_option_values;
create trigger trg_guard_option_value_pricing
  before insert or update on public.product_option_values
  for each row execute function public.guard_option_value_pricing();

/* Service-role only, like every table in this family: the browser never
   touches these directly — all reads and writes go through tenant-scoped
   server routes. */
alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_options'
      and policyname='product_options_service_role_all'
  ) then
    create policy product_options_service_role_all on public.product_options
      for all to service_role using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='product_option_values'
      and policyname='product_option_values_service_role_all'
  ) then
    create policy product_option_values_service_role_all on public.product_option_values
      for all to service_role using (true) with check (true);
  end if;
end $$;
