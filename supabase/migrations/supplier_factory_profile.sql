-- ============================================================================
-- Supplier Intelligence · Phase 2 · Factory Intelligence tranche
-- Migration: supplier_factory_profile
--
-- Adds a 1:1 factory profile hanging off the supplier identity (contacts row,
-- contact_type='supplier'). Additive + idempotent + production-safe. No
-- destructive ops, no enum reuse. Internal-tier intelligence: NOT RLS-enabled
-- by design — all access is server-gated through the Suppliers module
-- (service-role client + requireModuleAccess), never exposed to public/product
-- surfaces. Legacy tables (suppliers, product_suppliers, supplier_assets) are
-- left untouched.
-- ============================================================================

create table if not exists public.supplier_factory_profile (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  supplier_id             uuid not null references public.contacts(id) on delete cascade,

  -- Identity / scale
  factory_name            text,
  factory_type            text,            -- own_factory | partner_factory | contract_manufacturer | trading_only | multiple
  employee_count          integer,
  qc_staff_count          integer,
  rd_staff_count          integer,
  production_lines        integer,

  -- Capacity & operations
  monthly_capacity        numeric,
  capacity_unit           text,
  annual_output           numeric,
  output_unit             text,
  factory_size_sqm        numeric,
  export_percentage       numeric(5,2),    -- 0–100
  lead_time_days          integer,
  peak_season_months      text[],
  main_export_markets     text[],

  -- Capability profile
  production_categories   text[],
  supported_materials     text[],
  odm_supported           boolean,
  private_label_supported boolean,
  low_moq_supported       boolean,

  notes                   text,
  updated_by              uuid,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint uq_sfp_tenant_supplier unique (tenant_id, supplier_id)
);

-- factory_type vocabulary guard (NOT VALID → validate without locking existing rows)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_sfp_factory_type'
  ) then
    alter table public.supplier_factory_profile
      add constraint chk_sfp_factory_type
      check (factory_type is null or factory_type in
        ('own_factory','partner_factory','contract_manufacturer','trading_only','multiple'))
      not valid;
  end if;
end $$;

-- export_percentage range guard
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_sfp_export_pct'
  ) then
    alter table public.supplier_factory_profile
      add constraint chk_sfp_export_pct
      check (export_percentage is null or (export_percentage >= 0 and export_percentage <= 100))
      not valid;
  end if;
end $$;

-- non-negative numeric guard
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_sfp_nonneg'
  ) then
    alter table public.supplier_factory_profile
      add constraint chk_sfp_nonneg
      check (
        coalesce(employee_count, 0)   >= 0 and
        coalesce(qc_staff_count, 0)   >= 0 and
        coalesce(rd_staff_count, 0)   >= 0 and
        coalesce(production_lines, 0) >= 0 and
        coalesce(monthly_capacity, 0) >= 0 and
        coalesce(annual_output, 0)    >= 0 and
        coalesce(factory_size_sqm, 0) >= 0 and
        coalesce(lead_time_days, 0)   >= 0
      )
      not valid;
  end if;
end $$;

create index if not exists ix_sfp_supplier on public.supplier_factory_profile (supplier_id);
create index if not exists ix_sfp_tenant   on public.supplier_factory_profile (tenant_id);
