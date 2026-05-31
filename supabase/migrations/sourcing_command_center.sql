-- ============================================================================
-- Supplier Intelligence · Phase 3 · Sourcing Command Center
-- Migration: sourcing_command_center
--
-- The /suppliers/sourcing command center is read-only procurement intelligence
-- COMPUTED LIVE from existing tables (supplier_risk_profile, negotiation_intel,
-- sourcing_profile, supplier_product_links, specializations, supplier_media,
-- readiness). No snapshot/recommendation/alert tables are created — those are
-- rule-generated at read time (AI-ready). The only genuinely-missing
-- persistence is saved views / watchlists, so this adds ONE table. Additive,
-- idempotent; RLS locked down (service-role only).
-- ============================================================================

create table if not exists public.sourcing_watchlists (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null,
  kind            text not null default 'watchlist',   -- watchlist | view
  description     text,
  filters         jsonb not null default '{}'::jsonb,   -- saved sourcing filter state
  supplier_ids    uuid[] not null default '{}'::uuid[], -- pinned / followed suppliers
  visibility_tier text not null default 'procurement',
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint chk_swl_kind check (kind in ('watchlist','view')),
  constraint chk_swl_vis check (visibility_tier in ('public','internal','procurement','finance','management'))
);

create index if not exists ix_swl_tenant on public.sourcing_watchlists (tenant_id, created_at desc);

alter table public.sourcing_watchlists enable row level security;
