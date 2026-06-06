-- ===========================================================================
-- QA Auto Investigation Layer — Phase 7
--
-- A deterministic engineering-intelligence cache. From an issue + its module
-- history it derives possible causes, regression/hotspot flags, related
-- patterns, suggested investigation files, and risk/confidence scores — with
-- NO AI, NO embeddings, NO filesystem scans. Pure scoped queries + rules.
--
-- Additive only; reuses qa_issue_reports / qa_debug_workspaces / watchers.
-- Posture mirrors the other QA tables: RLS ENABLED, NO policies
-- (service-role-only; admin-gated API). One report per issue (UNIQUE issue_id).
-- ===========================================================================

create table if not exists public.qa_investigation_reports (
  id                     uuid primary key default gen_random_uuid(),
  issue_id               uuid not null references public.qa_issue_reports(id) on delete cascade,
  workspace_id           uuid references public.qa_debug_workspaces(id) on delete set null,
  tenant_id              uuid not null references public.tenants(id) on delete restrict,
  created_at             timestamptz not null default now(),

  possible_causes        jsonb not null default '[]'::jsonb,
  regression_flags       jsonb not null default '[]'::jsonb,
  hotspot_flags          jsonb not null default '[]'::jsonb,
  related_patterns       jsonb not null default '[]'::jsonb,
  suggested_files        jsonb not null default '[]'::jsonb,
  investigation_notes    jsonb not null default '[]'::jsonb,
  risk_score             integer not null default 0,
  confidence_score       integer not null default 0,
  module_health_snapshot jsonb not null default '{}'::jsonb,
  generated_summary      text,

  analysis_version       text,
  generated_at           timestamptz not null default now(),
  stale                  boolean not null default false,

  unique (issue_id)
);

create index if not exists qa_investigation_reports_tenant_idx on public.qa_investigation_reports (tenant_id);
create index if not exists qa_investigation_reports_issue_idx  on public.qa_investigation_reports (issue_id);

alter table public.qa_investigation_reports enable row level security;
revoke all on public.qa_investigation_reports from anon, authenticated;
