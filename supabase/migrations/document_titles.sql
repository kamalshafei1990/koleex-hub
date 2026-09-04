-- Document titles — the heading a commercial document prints under.
--
-- Until now the heading was decided by the PAGE that rendered the document:
-- /quotations forced "QUOTATION", /invoices forced "COMMERCIAL INVOICE".
-- That made two real things impossible: issuing a Proforma Invoice (which is
-- what a bank actually wants when a buyer opens an L/C — a Commercial Invoice
-- is a post-shipment document), and issuing a Sales Contract at all.
--
-- Same shape as `incoterms` and `payment_terms` so the three settings
-- surfaces behave identically: system rows (tenant_id null) ship with the
-- product and are immutable; tenant rows are the owner's own additions.
--
-- Additive and idempotent — safe to run more than once.

create table if not exists public.document_titles (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.companies(id) on delete cascade,
  code         text not null,
  label_en     text not null,
  label_zh     text,
  label_ar     text,
  /* Which numbering series and party wording the document uses. A Proforma
     Invoice is numbered like a quotation (it precedes the sale) but reads
     like an invoice, so the heading alone cannot imply either. */
  doc_family   text not null default 'quotation'
               check (doc_family in ('quotation', 'invoice')),
  /* Marks the row a tenant cannot edit or delete. */
  is_system    boolean not null default false,
  is_default   boolean not null default false,
  is_active    boolean not null default true,
  sort_order   integer not null default 100,
  notes        text,
  created_by   uuid references public.accounts(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- A code is unique per tenant; system rows (tenant_id null) share one space.
create unique index if not exists document_titles_code_tenant_key
  on public.document_titles (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(code));

create index if not exists document_titles_lookup_idx
  on public.document_titles (tenant_id, is_active, sort_order);

-- Service-role only, matching incoterms / payment_terms: every read and write
-- goes through the API route, which does its own auth and tenant scoping.
alter table public.document_titles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_titles'
      and policyname = 'document_titles_service_role_all'
  ) then
    create policy document_titles_service_role_all
      on public.document_titles
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- System rows. `on conflict do nothing` keeps a re-run harmless and never
-- overwrites a label the owner has since edited on their own copy.
insert into public.document_titles
  (tenant_id, code, label_en, label_zh, label_ar, doc_family, is_system, is_default, sort_order)
values
  (null, 'quotation',          'QUOTATION',          '报价单',   'عرض سعر',           'quotation', true, true,  10),
  (null, 'proforma_invoice',   'PROFORMA INVOICE',   '形式发票', 'فاتورة مبدئية',      'quotation', true, false, 20),
  (null, 'sales_contract',     'SALES CONTRACT',     '销售合同', 'عقد بيع',           'quotation', true, false, 30),
  (null, 'commercial_invoice', 'COMMERCIAL INVOICE', '商业发票', 'فاتورة تجارية',     'invoice',   true, true,  40),
  (null, 'invoice',            'INVOICE',            '发票',     'فاتورة',            'invoice',   true, false, 50),
  (null, 'tax_invoice',        'TAX INVOICE',        '税务发票', 'فاتورة ضريبية',     'invoice',   true, false, 60)
on conflict do nothing;
