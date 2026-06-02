-- ============================================================================
-- Koleex Main Suppliers · Sourcing Coverage Layer
-- Migration: koleex_main_suppliers_coverage
--
-- A thin taxonomy-keyed assignment join that records which suppliers cover
-- which Division → Category → Subcategory node, with a sourcing ROLE.
--
-- WHY a new table (and not supplier_product_links): product links are keyed by
-- a concrete product_id, so they cannot represent coverage at the *subcategory*
-- granularity the Main Suppliers board operates on, and a single supplier must
-- be placeable under multiple subcategories. This table is purely an assignment
-- join — suppliers still live in `contacts`; logos, Supplier 360, sourcing /
-- risk / readiness intelligence are all reused as-is. No duplicate supplier
-- system. Mirrors the RLS posture of supplier_sourcing_profile (service-role
-- only; the app reaches it through the service-role server client).
-- ============================================================================

create table if not exists public.supplier_coverage (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id)  on delete cascade,
  supplier_id       uuid not null references public.contacts(id) on delete cascade,
  division_slug     text not null,
  category_slug     text not null,
  subcategory_code  text not null,
  subcategory_label text,
  sourcing_role     text not null default 'approved',
  sourcing_priority smallint,
  is_main_supplier  boolean not null default false,
  notes             text,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_scov_node unique (tenant_id, supplier_id, category_slug, subcategory_code),
  constraint chk_scov_role check (sourcing_role in ('preferred','approved','backup','experimental','blocked'))
);

create index if not exists ix_scov_node     on public.supplier_coverage (tenant_id, division_slug, category_slug, subcategory_code);
create index if not exists ix_scov_supplier on public.supplier_coverage (tenant_id, supplier_id);

alter table public.supplier_coverage enable row level security;
