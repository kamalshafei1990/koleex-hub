-- ============================================================================
-- Supplier Intelligence · Phase 2 · Risk / Negotiation Intelligence tranche
-- Migration: supplier_risk_negotiation_intelligence
--
-- Builds on the Phase-1 Foundation scorecards (already present, NOT recreated):
--   · supplier_risk_profile        (1:1 risk scorecard — level scoring + score)
--   · supplier_negotiation_intel   (1:1 negotiation scorecard + AI summary)
-- This tranche ADDS two 1:N "log" tables that complement them, and locks down
-- RLS on the whole risk/negotiation surface (service-role only). Additive; no
-- destructive ops. The most sensitive supplier intelligence.
-- ============================================================================

-- 1) Active risk register (1:N) — individual risks with per-item visibility.
create table if not exists public.supplier_risk_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  supplier_id     uuid not null references public.contacts(id) on delete cascade,
  dimension       text not null,
  severity        text not null default 'medium',
  status          text not null default 'open',
  title           text not null,
  description     text,
  mitigation      text,
  visibility_tier text not null default 'procurement',
  raised_by       uuid,
  resolved_at     timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint chk_sri_dim check (dimension in ('financial','operational','strategic','geographic','relationship')),
  constraint chk_sri_sev check (severity in ('low','medium','high','critical')),
  constraint chk_sri_status check (status in ('open','mitigating','resolved')),
  constraint chk_sri_vis check (visibility_tier in ('public','internal','procurement','finance','management'))
);

-- 2) Negotiation rounds (1:N) — round-by-round memory; default management-visible.
create table if not exists public.supplier_negotiation_rounds (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  supplier_id               uuid not null references public.contacts(id) on delete cascade,
  round_no                  integer,
  topic                     text,
  outcome                   text,
  price_concession          text,
  moq_concession            text,
  payment_terms_concession  text,
  discount_pct              numeric(5,2),
  exclusivity_discussed     boolean not null default false,
  territory_discussed       boolean not null default false,
  leverage_notes            text,
  red_flags                 text,
  behavior_notes            text,
  visibility_tier           text not null default 'management',
  occurred_on               date,
  created_by                uuid,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint chk_snr_vis check (visibility_tier in ('public','internal','procurement','finance','management'))
);

create index if not exists ix_sri_supplier on public.supplier_risk_items (supplier_id) where resolved_at is null;
create index if not exists ix_sri_supplier_all on public.supplier_risk_items (supplier_id, created_at desc);
create index if not exists ix_snr_supplier on public.supplier_negotiation_rounds (supplier_id, created_at desc);

-- 3) RLS lockdown — service-role only (no policies → deny anon/authenticated)
--    across the entire risk/negotiation surface, incl. the Foundation scorecards.
alter table public.supplier_risk_profile        enable row level security;
alter table public.supplier_negotiation_intel   enable row level security;
alter table public.supplier_risk_items          enable row level security;
alter table public.supplier_negotiation_rounds  enable row level security;
