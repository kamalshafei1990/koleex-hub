-- ---------------------------------------------------------------------------
-- Projects audit (2026-09-25) — indexes, quotation provenance, list counts.
--
-- Idempotent: every statement is IF NOT EXISTS / OR REPLACE.
-- Code that depends on this file:
--   · POST /api/projects/from-quotation   needs projects.source_quotation_id
--     (the route fails with a 500 until this is applied).
--   · GET  /api/projects                  calls project_task_counts(); it
--     falls back to a narrow select + JS aggregation when the function is
--     missing, so it works before AND after this migration.
--
-- The single-column task_id / parent_task_id indexes below already exist in
-- prod under these exact names (checked 2026-09-25): they are listed for
-- fresh environments and are no-ops where present.
-- ---------------------------------------------------------------------------

-- 1. Composite indexes for the tenant-scoped list/filter paths.
create index if not exists idx_project_tasks_tenant_project_status
  on public.project_tasks (tenant_id, project_id, status);
create index if not exists idx_project_tasks_tenant_assignee_status
  on public.project_tasks (tenant_id, assignee_account_id, status);
create index if not exists idx_project_tasks_tenant_linked_entity
  on public.project_tasks (tenant_id, linked_entity_type, linked_entity_id);
create index if not exists idx_project_tasks_parent
  on public.project_tasks (parent_task_id);
create index if not exists idx_projects_tenant_manager
  on public.projects (tenant_id, manager_account_id);
create index if not exists idx_projects_tenant_created_by
  on public.projects (tenant_id, created_by_account_id);
create index if not exists idx_pte_task
  on public.project_time_entries (task_id);
create index if not exists idx_ptc_task
  on public.project_task_comments (task_id);
create index if not exists idx_pta_task
  on public.project_task_attachments (task_id);
create index if not exists idx_ptci_task
  on public.project_task_checklist_items (task_id);

-- 2. Quotation provenance: one delivery project per accepted quotation.
alter table public.projects
  add column if not exists source_quotation_id uuid
  references public.quotations(id) on delete set null;
create unique index if not exists uq_projects_tenant_source_quotation
  on public.projects (tenant_id, source_quotation_id)
  where source_quotation_id is not null;

-- 3. Per-project task counts for the project list, in one round trip.
--    done_top / total_top follow src/lib/project-progress.ts: top-level,
--    non-cancelled tasks. SECURITY INVOKER + EXECUTE revoked from the
--    browser roles: only the service role (the API) may call it, and the
--    tenant filter is an argument the API always passes.
create or replace function public.project_task_counts(p_tenant uuid, p_project_ids uuid[])
returns table (
  project_id    uuid,
  open_count    integer,
  overdue_count integer,
  done_top      integer,
  total_top     integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select t.project_id,
         (count(*) filter (where t.status = 'open'))::int,
         (count(*) filter (where t.status = 'open' and t.due_date < current_date))::int,
         (count(*) filter (where t.parent_task_id is null and t.status = 'done'))::int,
         (count(*) filter (where t.parent_task_id is null and t.status <> 'cancelled'))::int
  from public.project_tasks t
  where t.tenant_id = p_tenant
    and t.project_id = any (p_project_ids)
  group by t.project_id
$$;

revoke all on function public.project_task_counts(uuid, uuid[]) from public;
revoke all on function public.project_task_counts(uuid, uuid[]) from anon;
revoke all on function public.project_task_counts(uuid, uuid[]) from authenticated;
grant execute on function public.project_task_counts(uuid, uuid[]) to service_role;
