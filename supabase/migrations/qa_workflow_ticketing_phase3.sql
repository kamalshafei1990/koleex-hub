-- ===========================================================================
-- QA Workflow & Ticketing System — Phase 3
--
-- Transforms the QA Issue Reporter into a lightweight internal engineering
-- workflow: comments/threads, assignment, operational priority, an activity
-- timeline, duplicate linking, reopen lifecycle, and a "Ready for Claude"
-- readiness flag.
--
-- Safety:
--   • Additive only — existing reports untouched, no column drops/renames.
--   • New tables mirror qa_issue_reports' posture: RLS ENABLED, NO policies
--     (service-role-only; all access flows through tenant-checked API routes).
--   • Future-ready via jsonb (comment attachments, activity metadata) without
--     speculative columns.
-- ===========================================================================

-- ── A. qa_issue_reports — workflow columns ────────────────────────────────
alter table public.qa_issue_reports
  -- C. Operational priority (workflow urgency), separate from severity (impact)
  add column if not exists priority text not null default 'normal',
  -- B. Assignment metadata
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by uuid,
  -- E. Duplicate linking (manual only — no AI detection)
  add column if not exists duplicate_of_issue_id uuid
    references public.qa_issue_reports(id) on delete set null,
  -- F. Reopen lifecycle (preserves prior resolution data)
  add column if not exists reopened_at timestamptz,
  add column if not exists reopen_reason text,
  add column if not exists reopen_count integer not null default 0;

-- Priority must be one of the four operational levels.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'qa_issue_reports_priority_chk'
  ) then
    alter table public.qa_issue_reports
      add constraint qa_issue_reports_priority_chk
      check (priority in ('low','normal','high','urgent'));
  end if;
end$$;

-- G. "Ready for Claude" — a row is Claude-ready when it carries everything the
-- AI debugging pipeline needs: a screenshot, pinned component metadata, a
-- description, and an expected result. Generated + stored so it filters/sorts
-- cheaply and can never drift from the underlying fields.
alter table public.qa_issue_reports
  add column if not exists claude_ready boolean
  generated always as (
    screenshot_url is not null
    and component_name is not null
    and description is not null and length(btrim(description)) > 0
    and expected_result is not null and length(btrim(expected_result)) > 0
  ) stored;

-- ── B. qa_issue_comments — threaded discussion ────────────────────────────
create table if not exists public.qa_issue_comments (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  issue_id        uuid not null references public.qa_issue_reports(id) on delete cascade,
  user_id         uuid,
  user_name       text,
  user_role       text,
  message         text not null,
  is_internal_note boolean not null default false,
  -- Future-ready: attachments live as a jsonb array; UI not wired yet.
  attachments     jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  edited_at       timestamptz
);

create index if not exists qa_issue_comments_issue_idx
  on public.qa_issue_comments (issue_id, created_at);
create index if not exists qa_issue_comments_tenant_idx
  on public.qa_issue_comments (tenant_id);

-- ── D. qa_issue_activity — append-only timeline ───────────────────────────
create table if not exists public.qa_issue_activity (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  issue_id      uuid not null references public.qa_issue_reports(id) on delete cascade,
  actor_id      uuid,
  actor_name    text,
  activity_type text not null,   -- created | status_changed | assigned | unassigned
                                  -- | priority_changed | reopened | resolved
                                  -- | comment_added | duplicate_marked | commit_added
  old_value     text,
  new_value     text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists qa_issue_activity_issue_idx
  on public.qa_issue_activity (issue_id, created_at);
create index if not exists qa_issue_activity_tenant_idx
  on public.qa_issue_activity (tenant_id);

-- Filter/sort helpers on the parent table.
create index if not exists qa_issue_reports_assigned_idx
  on public.qa_issue_reports (tenant_id, assigned_to);
create index if not exists qa_issue_reports_priority_idx
  on public.qa_issue_reports (tenant_id, priority);
create index if not exists qa_issue_reports_dupe_idx
  on public.qa_issue_reports (duplicate_of_issue_id);

-- ── RLS — service-role-only, matching qa_issue_reports ────────────────────
alter table public.qa_issue_comments enable row level security;
alter table public.qa_issue_activity enable row level security;
-- No policies on purpose: anon/authenticated have no direct access; the
-- service-role API routes enforce tenant scoping. Revoke is belt-and-braces.
revoke all on public.qa_issue_comments from anon, authenticated;
revoke all on public.qa_issue_activity from anon, authenticated;
