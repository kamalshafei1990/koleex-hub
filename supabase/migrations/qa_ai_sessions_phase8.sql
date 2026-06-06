-- ===========================================================================
-- QA AI Investigation Assistant — Phase 8
--
-- Stores each explicit, user-triggered AI analysis of a QA issue. The AI is an
-- analyst only: it reads the deterministic workspace + investigation context
-- (already sanitized of secrets) and returns a structured engineering report.
-- It NEVER edits code, commits, pushes, or mutates state.
--
-- One row per analysis run (sessions accumulate; newest-first). Additive only;
-- reuses qa_issue_reports / qa_debug_workspaces. Posture mirrors the other QA
-- tables: RLS ENABLED, NO policies (service-role-only; admin-gated API).
-- ===========================================================================

create table if not exists public.qa_ai_sessions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete restrict,
  issue_id          uuid not null references public.qa_issue_reports(id) on delete cascade,
  workspace_id      uuid references public.qa_debug_workspaces(id) on delete set null,
  account_id        uuid,

  provider          text,
  model             text,
  prompt            text,                       -- sanitized prompt actually sent
  response          text,                       -- raw provider text
  response_markdown text,                       -- cleaned, render-ready markdown
  status            text not null default 'pending',  -- pending | completed | failed
  error             text,                       -- failure reason when status = failed

  tokens_input      integer,
  tokens_output     integer,
  latency_ms        integer,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists qa_ai_sessions_issue_idx   on public.qa_ai_sessions (issue_id);
create index if not exists qa_ai_sessions_tenant_idx  on public.qa_ai_sessions (tenant_id);
create index if not exists qa_ai_sessions_created_idx on public.qa_ai_sessions (created_at desc);

alter table public.qa_ai_sessions enable row level security;
revoke all on public.qa_ai_sessions from anon, authenticated;
