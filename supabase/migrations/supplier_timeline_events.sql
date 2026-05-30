-- ============================================================================
-- Supplier Intelligence · Phase 2 · Timeline / Activity Intelligence tranche
-- Migration: supplier_timeline_events
--
-- Canonical unified supplier operational history — the memory / audit / chronology
-- layer for the Supplier 360. Additive; does NOT replace supplier_status_history
-- (that remains the structured status audit). Visibility-aware + AI-ready
-- (structured event_type/category + metadata jsonb on every row).
-- ============================================================================

create table if not exists public.supplier_timeline_events (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  supplier_id          uuid not null references public.contacts(id) on delete cascade,

  event_type           text not null,
  event_category       text not null,   -- relationship|communication|factory|documents|procurement|system
  title                text not null,
  description          text,

  actor_id             uuid,
  actor_name           text,
  source_module        text,
  visibility_tier      text not null default 'internal',
  importance           text not null default 'normal',   -- low|normal|high|critical
  is_manual            boolean not null default false,

  related_entity_id    uuid,
  related_entity_type  text,
  metadata             jsonb not null default '{}'::jsonb,

  created_at           timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ste_category_chk') then
    alter table public.supplier_timeline_events add constraint ste_category_chk
      check (event_category in ('relationship','communication','factory','documents','procurement','system')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ste_visibility_chk') then
    alter table public.supplier_timeline_events add constraint ste_visibility_chk
      check (visibility_tier in ('public','internal','procurement','finance','management')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ste_importance_chk') then
    alter table public.supplier_timeline_events add constraint ste_importance_chk
      check (importance in ('low','normal','high','critical')) not valid;
  end if;
end $$;

create index if not exists ix_ste_supplier_created
  on public.supplier_timeline_events (supplier_id, created_at desc);
create index if not exists ix_ste_tenant
  on public.supplier_timeline_events (tenant_id);
create index if not exists ix_ste_category
  on public.supplier_timeline_events (supplier_id, event_category);

-- readiness-milestone marker so milestone events fire at most once per threshold.
alter table public.contacts
  add column if not exists readiness_milestone smallint not null default 0;
