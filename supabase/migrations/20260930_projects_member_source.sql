-- ---------------------------------------------------------------------------
-- 20260930_projects_member_source — automatic vs manual project members,
-- and fractional board positions.
--
-- Idempotent. Depends on 20260926_projects_additions.sql (project_members).
-- The app works before AND after this is applied:
--
--   1. project_members.source ('manual' | 'auto').
--      'auto' rows exist because the account manages the project or was
--      assigned a task in it (syncProjectMembersFromAssignees, the manager
--      add on create / manager change). When that reason is gone
--      (reassigned away, task deleted, manager replaced) and the account
--      is not the project's manager or creator, nor the assignee or
--      creator of any task in it, pruneProjectChatSeats deletes the 'auto'
--      row and — if that was their last way in — their project chat seat.
--      'manual' rows (Members panel, AI tool, any role change) are never
--      removed automatically. Before this migration the column is missing
--      and every row behaves as 'manual' (today's behaviour).
--
--      Backfill (runs once, when the column is first added): rows whose
--      account is the project's manager or the assignee of a task in the
--      project AND whose added_by is null (the 20260926 backfill wrote
--      exactly those) become 'auto'; everything else stays 'manual'.
--
--   2. project_tasks.sort_order → double precision (safe widening from
--      integer: every integer value is represented exactly). Board drops
--      then place the moved card at the exact midpoint of its neighbours,
--      so a drop by the owner of a card on a view-only project (who may
--      only write their own card) lands exactly where it was dropped.
--      Until this is applied the reorder route detects the integer column
--      and falls back to integer midpoints.
-- ---------------------------------------------------------------------------

-- 1. project_members.source --------------------------------------------------
do $$
begin
  if to_regclass('public.project_members') is null then
    raise notice 'project_members missing — apply 20260926_projects_additions.sql first';
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'project_members' and column_name = 'source'
  ) then
    alter table public.project_members
      add column source text not null default 'manual';

    -- One-time backfill (only on the run that adds the column, so a re-run
    -- never flips rows the app has written since).
    update public.project_members m
       set source = 'auto'
     where m.added_by is null
       and (
         exists (
           select 1 from public.projects p
            where p.id = m.project_id
              and p.manager_account_id = m.account_id
         )
         or exists (
           select 1 from public.project_tasks t
            where t.project_id = m.project_id
              and t.assignee_account_id = m.account_id
         )
       );
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'project_members_source_check'
       and conrelid = 'public.project_members'::regclass
  ) then
    alter table public.project_members
      add constraint project_members_source_check check (source in ('manual', 'auto'));
  end if;
end
$$;

-- 2. project_tasks.sort_order → double precision -----------------------------
do $$
declare
  v_type text;
begin
  select data_type into v_type
    from information_schema.columns
   where table_schema = 'public' and table_name = 'project_tasks' and column_name = 'sort_order';
  if v_type in ('integer', 'smallint', 'bigint', 'numeric', 'real') then
    alter table public.project_tasks
      alter column sort_order type double precision using sort_order::double precision;
  end if;
end
$$;
