-- To-do Phase 2 — start date, reminder, and status stages.
-- Additive only; safe to run once. Existing rows default to status='todo'
-- (or 'done' where already completed) with null start_date/remind_at.

alter table public.koleex_todos
  add column if not exists start_date date,
  add column if not exists remind_at timestamptz,
  add column if not exists status text not null default 'todo';

-- Constrain status to the known stages.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'koleex_todos_status_check'
  ) then
    alter table public.koleex_todos
      add constraint koleex_todos_status_check
      check (status in ('todo', 'in_progress', 'blocked', 'done'));
  end if;
end $$;

-- Backfill: any already-completed task starts life as 'done'.
update public.koleex_todos set status = 'done' where completed = true and status = 'todo';

-- Reminder scheduler reads this: due, not-yet-sent reminders.
create index if not exists idx_koleex_todos_remind_at
  on public.koleex_todos (remind_at)
  where remind_at is not null and completed = false;
