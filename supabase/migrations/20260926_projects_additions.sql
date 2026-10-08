-- ---------------------------------------------------------------------------
-- Projects additions (2026-09-26) — members, archive, budget currency,
-- Discuss project channels.
--
-- Idempotent: every statement is IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- The app degrades gracefully until this is applied:
--   · project_members missing  → access falls back to the manager / creator /
--     assignee rule; the Members panel shows "not available yet".
--   · projects.archived_at / currency missing → Archive still works through
--     status = 'archived'; currency is simply not shown / saved.
--   · discuss_channels.linked_project_id missing → "Open project chat"
--     answers with a clear error instead of creating an unlinked channel.
-- ---------------------------------------------------------------------------

-- 1. Project members --------------------------------------------------------
create table if not exists public.project_members (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  project_id  uuid not null references public.projects(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  role        text not null default 'member'
              check (role in ('manager', 'member', 'viewer')),
  added_by    uuid references public.accounts(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (project_id, account_id)
);

create index if not exists idx_project_members_tenant_account
  on public.project_members (tenant_id, account_id);
create index if not exists idx_project_members_project
  on public.project_members (project_id);

-- Service-role only (the API); the browser never reads this table directly.
alter table public.project_members enable row level security;
revoke all on public.project_members from anon;
revoke all on public.project_members from authenticated;

-- Backfill: every project's manager (role manager) + every task assignee.
insert into public.project_members (tenant_id, project_id, account_id, role)
select p.tenant_id, p.id, p.manager_account_id, 'manager'
  from public.projects p
 where p.manager_account_id is not null
on conflict (project_id, account_id) do nothing;

insert into public.project_members (tenant_id, project_id, account_id, role)
select distinct t.tenant_id, t.project_id, t.assignee_account_id, 'member'
  from public.project_tasks t
 where t.assignee_account_id is not null
on conflict (project_id, account_id) do nothing;

-- 2. Archive (restorable) ---------------------------------------------------
alter table public.projects add column if not exists archived_at timestamptz;
update public.projects
   set archived_at = coalesce(updated_at, now())
 where status = 'archived' and archived_at is null;
create index if not exists idx_projects_tenant_archived
  on public.projects (tenant_id, archived_at);

-- 3. Budget vs actual -------------------------------------------------------
-- budget_hours / budget_amount / billing_rate already exist in production;
-- listed for fresh environments (no-ops where present).
alter table public.projects add column if not exists budget_hours  numeric;
alter table public.projects add column if not exists budget_amount numeric;
alter table public.projects add column if not exists billing_rate  numeric;
alter table public.projects add column if not exists currency      text;

-- 4. Discuss channel per project --------------------------------------------
alter table public.discuss_channels
  add column if not exists linked_project_id uuid
  references public.projects(id) on delete set null;
-- One live chat per project (also closes the double-click race).
create unique index if not exists uq_discuss_channels_linked_project
  on public.discuss_channels (linked_project_id)
  where linked_project_id is not null and archived_at is null;
