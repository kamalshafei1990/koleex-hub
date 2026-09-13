-- The order: one deal, and every document raised against it.
--
-- ── Why a new table rather than extending sales_orders ─────────────────────
-- `sales_orders` exists and models fulfilment — items, quantities shipped,
-- shipments, inventory. This one models the DEAL and its paperwork. Owner
-- chose to keep them separate (2026-08-24). They will coexist, so the
-- distinction has to stay sharp: sales_orders answers "what left the
-- warehouse", orders answers "what did we agree and what did we send them".
--
-- ── Why documents point at the order, not the reverse ──────────────────────
-- The obvious shape is columns on the order: quotation_id, invoice_id,
-- contract_id … That breaks on the owner's own requirement — a proforma
-- invoice and the commercial invoice that replaces it are BOTH invoices of
-- the same deal, kept side by side. One column per type cannot hold two.
--
-- So each document carries `order_id` and the order owns none of them. One
-- order, many quotations / invoices / contracts, no join table, and the
-- "list every document of this order" query is one indexed read per type.
--
-- ── Snapshots ──────────────────────────────────────────────────────────────
-- customer_code / customer_name / company_name are copied at creation. They
-- let the orders list render without joining customers on every row, and they
-- record who the buyer WAS when the deal was struck. The live customer row
-- stays the source of truth for anything current.

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  /* The shared counter — the same value printed as KL-QU-12349,
     KL-IN-12349, KL-CN-12349. Unique per tenant: one deal, one number. */
  deal_no       bigint not null,
  order_no      text   not null,

  customer_id   uuid,
  customer_code text,
  customer_name text,
  company_name  text,

  /* open      — live, documents still being raised
     shipped   — goods have left
     closed    — delivered and settled
     cancelled — abandoned; kept for the record, never deleted */
  status        text not null default 'open'
                check (status in ('open','shipped','closed','cancelled')),

  currency      text,
  total         numeric default 0,
  notes         text,

  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One order per deal number, per tenant.
create unique index if not exists orders_deal_no_tenant_key
  on public.orders (tenant_id, deal_no);

create index if not exists orders_customer_idx on public.orders (tenant_id, customer_id);
create index if not exists orders_status_idx   on public.orders (tenant_id, status, created_at desc);

alter table public.orders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='orders'
      and policyname='orders_service_role_all'
  ) then
    create policy orders_service_role_all on public.orders
      for all to service_role using (true) with check (true);
  end if;
end $$;

-- ── Documents point at their order ─────────────────────────────────────────
-- Nullable: every existing document predates orders, and a quotation that
-- never became a sale never gets one.
alter table public.quotations add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.invoices   add column if not exists order_id uuid references public.orders(id) on delete set null;

create index if not exists quotations_order_idx on public.quotations (order_id) where order_id is not null;
create index if not exists invoices_order_idx   on public.invoices   (order_id) where order_id is not null;
