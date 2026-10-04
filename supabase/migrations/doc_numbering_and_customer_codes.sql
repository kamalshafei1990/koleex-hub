-- One number per deal, and a stable code per customer.
--
-- ── Why a sequence table ───────────────────────────────────────────────────
-- Numbering today is DATE-derived: KL{YYYY}-{MMDD}. Every quotation raised on
-- 24 Aug 2026 shares the base KL2026-0824, so the number identifies a day, not
-- a deal. That cannot express what the owner asked for:
--
--     KL-QU-12349   quotation
--     KL-IN-12349   invoice for the same deal
--     KL-CN-12349   sales contract for the same deal
--     KL-PL-12349   packing list
--     KL-PO-12349   purchase order
--
-- One counter issues the number ONCE; each document prefixes it with its own
-- two letters. That is both what was asked for and the cleaner design — a
-- single source for the number means the link between documents cannot drift.
--
-- Owner decisions (2026-08-24):
--   · the counter runs continuously — it does NOT reset each year
--   · a number is reserved when a document is OPENED, so gaps are accepted
--     and expected (an abandoned draft keeps its number)
--
-- ── Why customer codes start at 100, per country ───────────────────────────
-- Owner asked for a code with MEANING, starting at 100. A per-country counter
-- gives that: BD-100 is the first Bangladeshi customer, EG-100 the first
-- Egyptian one. A single global counter would only record join order.
--
-- Additive and idempotent.

-- ── Deal numbers ───────────────────────────────────────────────────────────
create table if not exists public.doc_sequences (
  tenant_id   uuid not null references public.companies(id) on delete cascade,
  scope       text not null default 'deal',
  next_value  bigint not null default 12349,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, scope)
);

alter table public.doc_sequences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='doc_sequences'
      and policyname='doc_sequences_service_role_all'
  ) then
    create policy doc_sequences_service_role_all on public.doc_sequences
      for all to service_role using (true) with check (true);
  end if;
end $$;

/* Atomically hand out the next number.

   The UPDATE ... RETURNING takes a row lock, so two documents opened at the
   same instant cannot receive the same number — which a read-then-write in
   application code would allow. SECURITY DEFINER so the API can call it
   without granting write access to the table itself. */
create or replace function public.next_deal_number(p_tenant uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  insert into public.doc_sequences (tenant_id, scope)
       values (p_tenant, 'deal')
  on conflict (tenant_id, scope) do nothing;

  update public.doc_sequences
     set next_value = next_value + 1,
         updated_at = now()
   where tenant_id = p_tenant and scope = 'deal'
  returning next_value - 1 into v_next;

  return v_next;
end $$;

-- ── Customer codes ─────────────────────────────────────────────────────────
create table if not exists public.customer_code_sequences (
  tenant_id    uuid not null references public.companies(id) on delete cascade,
  country_code text not null,
  next_value   integer not null default 100,
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, country_code)
);

alter table public.customer_code_sequences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='customer_code_sequences'
      and policyname='customer_code_sequences_service_role_all'
  ) then
    create policy customer_code_sequences_service_role_all on public.customer_code_sequences
      for all to service_role using (true) with check (true);
  end if;
end $$;

/* Next code for a country, e.g. BD-100 then BD-101. Countryless customers
   fall back to XX so they still get a stable code rather than none. */
create or replace function public.next_customer_code(p_tenant uuid, p_country text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cc   text := upper(coalesce(nullif(trim(p_country), ''), 'XX'));
  v_next integer;
begin
  insert into public.customer_code_sequences (tenant_id, country_code)
       values (p_tenant, v_cc)
  on conflict (tenant_id, country_code) do nothing;

  update public.customer_code_sequences
     set next_value = next_value + 1,
         updated_at = now()
   where tenant_id = p_tenant and country_code = v_cc
  returning next_value - 1 into v_next;

  return v_cc || '-' || v_next::text;
end $$;

-- Lookups by code, and a guard against two customers sharing one.
create unique index if not exists customers_customer_code_tenant_key
  on public.customers (tenant_id, upper(customer_code))
  where customer_code is not null and customer_code <> '';
