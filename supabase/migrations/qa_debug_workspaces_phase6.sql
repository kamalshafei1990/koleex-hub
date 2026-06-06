-- ===========================================================================
-- QA Claude Debug Workspace — Phase 6
--
-- A deterministic, cached debugging package generated from a QA issue
-- (NO AI). Aggregates the issue, comments, activity, watchers, inspector
-- metadata, environment and deterministically-detected related issues into a
-- structured, copy-paste-ready prompt for Claude (and future AI systems).
--
-- Additive only; reuses every existing QA table. Posture mirrors the other QA
-- tables: RLS ENABLED, NO policies (service-role-only; admin-gated API).
-- One active workspace per issue (UNIQUE issue_id); regenerated on demand.
-- ===========================================================================

create table if not exists public.qa_debug_workspaces (
  id                    uuid primary key default gen_random_uuid(),
  issue_id              uuid not null references public.qa_issue_reports(id) on delete cascade,
  tenant_id             uuid not null references public.tenants(id) on delete restrict,
  created_by            uuid references public.accounts(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  workspace_status      text not null default 'ready',
  generated_prompt      text,
  issue_snapshot        jsonb not null default '{}'::jsonb,
  related_components    jsonb not null default '[]'::jsonb,
  related_routes        jsonb not null default '[]'::jsonb,
  related_issues        jsonb not null default '[]'::jsonb,
  reproduction_summary  text,
  environment_snapshot  jsonb not null default '{}'::jsonb,
  debug_context         jsonb not null default '{}'::jsonb,
  ai_ready              boolean not null default true,

  -- future-ready (export tracking / cache invalidation by generator version)
  exported_at           timestamptz,
  last_opened_at        timestamptz,
  generation_version    text,

  unique (issue_id)
);

create index if not exists qa_debug_workspaces_tenant_idx on public.qa_debug_workspaces (tenant_id);
create index if not exists qa_debug_workspaces_issue_idx  on public.qa_debug_workspaces (issue_id);

alter table public.qa_debug_workspaces enable row level security;
revoke all on public.qa_debug_workspaces from anon, authenticated;
