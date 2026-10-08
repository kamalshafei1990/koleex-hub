-- International sales contracts.
--
-- ── One table, not seven ───────────────────────────────────────────────────
-- The brief sketched sales_contracts + items + payment_terms + clauses +
-- versions + document_requirements + annexes, and then said not to create
-- them without inspecting what exists first. Inspecting says one table does
-- the job here:
--
--   · line items already live on the invoice this contract is raised from,
--     and are copied into the snapshot when it is signed. A parallel item
--     table would be a second copy that can silently disagree with the first.
--   · payment stages, delivery, packing, inspection, warranty and the
--     document checklist are all "the terms agreed for THIS deal". They are
--     read and written together, always as a set, and never queried across
--     contracts. That is a jsonb column, not six tables.
--   · the general legal articles are the same for every contract of a given
--     version. Storing them per row would duplicate the whole contract body
--     on every deal; storing a version string does not.
--
-- Splitting can come later if a real query demands it. Starting split cannot
-- be undone cheaply.
--
-- ── Why the snapshot column ────────────────────────────────────────────────
-- The one requirement in the brief that cannot be retrofitted. Once a
-- contract is signed, later edits to the master legal terms — or to the
-- invoice it came from — must not alter what was agreed. Signing copies the
-- entire rendered contract into `snapshot` and the document renders from
-- there forever after. Before signing it renders live, so a draft still
-- follows corrections to the invoice.

create table if not exists public.sales_contracts (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,

  /* Same counter as the rest of the deal: KL-QU-12349 / KL-IN-12349 /
     KL-CN-12349. A deal can hold more than one contract (an amended
     agreement alongside the original), so the number is suffixed -2, -3
     exactly as invoices are. */
  deal_no        bigint not null,
  contract_no    text   not null unique,

  order_id       uuid references public.orders(id)   on delete set null,
  invoice_id     uuid references public.invoices(id) on delete set null,
  customer_id    uuid,

  /* draft     — being prepared, renders live from the invoice
     ready     — reviewed, awaiting signature
     signed    — executed; renders from `snapshot` and is immutable
     cancelled — abandoned, kept for the record
     superseded— replaced by a later contract on the same deal */
  status         text not null default 'draft'
                 check (status in ('draft','ready','signed','cancelled','superseded')),

  contract_date  date,
  place_of_signing text,
  currency       text,
  total          numeric default 0,

  /* Everything negotiated for this deal: payment stages, delivery, packing,
     inspection, warranty, documents, special conditions, governing law,
     dispute resolution. Read and written as one set. */
  terms          jsonb not null default '{}'::jsonb,

  /* Which edition of the general articles this contract was drawn against.
     Editing the master terms later bumps the version for NEW contracts and
     leaves existing ones pointing at the edition they were agreed under. */
  terms_version  text not null default '1.0',

  /* Written once, at signature. Null while the contract is still live. */
  snapshot       jsonb,
  signed_at      timestamptz,
  signed_by      uuid,

  notes          text,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists sales_contracts_deal_idx     on public.sales_contracts (tenant_id, deal_no);
create index if not exists sales_contracts_order_idx    on public.sales_contracts (order_id)   where order_id is not null;
create index if not exists sales_contracts_invoice_idx  on public.sales_contracts (invoice_id) where invoice_id is not null;
create index if not exists sales_contracts_status_idx   on public.sales_contracts (tenant_id, status, created_at desc);

alter table public.sales_contracts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='sales_contracts'
      and policyname='sales_contracts_service_role_all'
  ) then
    create policy sales_contracts_service_role_all on public.sales_contracts
      for all to service_role using (true) with check (true);
  end if;
end $$;

/* A signed contract is history. Blocking the write here rather than only in
   the API means no future route, script or console session can quietly edit
   an executed agreement. Status may still move signed → superseded, which is
   how an amendment supersedes what it replaces. */
create or replace function public.guard_signed_sales_contract()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'signed' then
    if new.status = 'superseded' and
       new.snapshot is not distinct from old.snapshot and
       new.terms    is not distinct from old.terms then
      return new;
    end if;
    raise exception 'Contract % is signed and cannot be modified. Raise an amendment instead.', old.contract_no;
  end if;
  return new;
end $$;

drop trigger if exists sales_contracts_signed_guard on public.sales_contracts;
create trigger sales_contracts_signed_guard
  before update on public.sales_contracts
  for each row execute function public.guard_signed_sales_contract();
