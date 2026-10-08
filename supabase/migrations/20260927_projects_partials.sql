-- ---------------------------------------------------------------------------
-- 20260927_projects_partials — per-project member counts in one round trip.
--
-- Idempotent. Depends on 20260926_projects_additions.sql (project_members).
--
--   · GET /api/projects and GET /api/projects/:id return `member_count`
--     (the Members button count). They call project_member_counts(); until
--     this migration is applied they fall back to one narrow select of
--     project_members aggregated in JS — so they work before AND after it.
-- ---------------------------------------------------------------------------

create or replace function public.project_member_counts(p_tenant uuid, p_project_ids uuid[])
returns table (
  project_id   uuid,
  member_count integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select m.project_id, count(*)::int
  from public.project_members m
  where m.tenant_id = p_tenant
    and m.project_id = any (p_project_ids)
  group by m.project_id
$$;

revoke all on function public.project_member_counts(uuid, uuid[]) from public;
revoke all on function public.project_member_counts(uuid, uuid[]) from anon;
revoke all on function public.project_member_counts(uuid, uuid[]) from authenticated;
grant execute on function public.project_member_counts(uuid, uuid[]) to service_role;
