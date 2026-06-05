-- ===========================================================================
-- QA Watch / Follow System — Phase 5
--
-- Lets users follow an issue and receive its notifications without being the
-- reporter or assignee. Additive only; reuses inbox_messages + notifyIssue for
-- delivery (no new notification infrastructure).
--
-- Posture mirrors the other QA tables: RLS ENABLED, NO policies
-- (service-role-only; all access flows through tenant-checked API routes).
-- ===========================================================================

create table if not exists public.qa_issue_watchers (
  id          uuid primary key default gen_random_uuid(),
  issue_id    uuid not null references public.qa_issue_reports(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete restrict,
  created_at  timestamptz not null default now(),
  unique (issue_id, account_id)   -- one watch row per user per issue (idempotent)
);

create index if not exists qa_issue_watchers_issue_idx   on public.qa_issue_watchers (issue_id);
create index if not exists qa_issue_watchers_account_idx on public.qa_issue_watchers (account_id);
create index if not exists qa_issue_watchers_tenant_idx  on public.qa_issue_watchers (tenant_id);

alter table public.qa_issue_watchers enable row level security;
revoke all on public.qa_issue_watchers from anon, authenticated;
