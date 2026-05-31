-- ============================================================================
-- Supplier Intelligence · Phase 3 · Sourcing / Comparison Intelligence
-- Migration: supplier_sourcing_intelligence
--
-- Procurement decision layer. ADDITIVE — extends the EXISTING
-- supplier_product_links (component supply relationship) with a sourcing ROLE +
-- sourcing terms, and adds a tiny 1:1 sourcing-override profile. Reuses
-- supplier_product_specializations (category ranking) and product_suppliers
-- (commercial terms) as-is — no duplicate relationship systems. No destructive
-- ops. The sourcing SCORE is computed from existing signals at read time; this
-- migration only persists the optional human override + sourcing notes.
-- ============================================================================

-- 1) Sourcing role + terms on the existing product↔supplier link.
alter table public.supplier_product_links add column if not exists sourcing_role text;
alter table public.supplier_product_links add column if not exists sourcing_priority smallint;
alter table public.supplier_product_links add column if not exists target_price text;
alter table public.supplier_product_links add column if not exists quality_level text;
alter table public.supplier_product_links add column if not exists lead_time_days integer;
alter table public.supplier_product_links add column if not exists moq text;
alter table public.supplier_product_links add column if not exists risk_notes text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_spl_sourcing_role') then
    alter table public.supplier_product_links add constraint chk_spl_sourcing_role
      check (sourcing_role is null or sourcing_role in ('preferred','approved','backup','experimental','blocked')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_spl_quality_level') then
    alter table public.supplier_product_links add constraint chk_spl_quality_level
      check (quality_level is null or quality_level in ('low','medium','high')) not valid;
  end if;
end $$;

create index if not exists ix_spl_product_role on public.supplier_product_links (product_id, sourcing_role) where sourcing_role is not null;

-- 2) Sourcing override profile (1:1). Score is computed; this stores override +
--    priority + sourcing notes. RLS locked down (service-role only).
create table if not exists public.supplier_sourcing_profile (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  supplier_id             uuid not null references public.contacts(id) on delete cascade,
  sourcing_score_override smallint,
  sourcing_priority       smallint,
  diversification_note     text,
  sourcing_notes          text,
  updated_by              uuid,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint uq_ssp_tenant_supplier unique (tenant_id, supplier_id),
  constraint chk_ssp_override check (sourcing_score_override is null or (sourcing_score_override between 0 and 100))
);

alter table public.supplier_sourcing_profile enable row level security;
