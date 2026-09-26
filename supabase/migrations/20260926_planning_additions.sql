-- ---------------------------------------------------------------------------
-- Planning additions (2026-09-26) — templates, series, week actions.
--
-- Additive and idempotent (IF NOT EXISTS everywhere); safe to re-run.
-- The app degrades gracefully until this runs:
--   · templates: writes retry without resource_id / color /
--     created_by_account_id, reads just don't return them;
--   · recurring series use planning_items.recurrence_parent_id, which
--     already exists (no FK) — the index below only makes series edits fast;
--   · the draft index only speeds up "Publish week".
-- ---------------------------------------------------------------------------

-- 1. Shift templates ---------------------------------------------------------
-- The table already exists in production (it backed an unused API). Created
-- here only for a fresh environment, with the production shape.
CREATE TABLE IF NOT EXISTS public.planning_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text NOT NULL DEFAULT 'shift',
  role_id         uuid REFERENCES public.planning_roles(id) ON DELETE SET NULL,
  start_time      time,
  duration_hours  numeric,
  default_note    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.planning_templates ENABLE ROW LEVEL SECURITY;

-- A template's end is start_time + duration_hours (overnight-safe), so no
-- end_time column is added.
ALTER TABLE public.planning_templates
  ADD COLUMN IF NOT EXISTS resource_id uuid REFERENCES public.planning_resources(id) ON DELETE SET NULL;
ALTER TABLE public.planning_templates
  ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.planning_templates
  ADD COLUMN IF NOT EXISTS created_by_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS planning_templates_tenant_name_idx
  ON public.planning_templates (tenant_id, name);

-- 2. Recurring series (series id = recurrence_parent_id) ---------------------
CREATE INDEX IF NOT EXISTS planning_items_tenant_series_start_idx
  ON public.planning_items (tenant_id, recurrence_parent_id, start_at)
  WHERE recurrence_parent_id IS NOT NULL;

-- 3. Publish week: drafts in a window ----------------------------------------
CREATE INDEX IF NOT EXISTS planning_items_tenant_drafts_start_idx
  ON public.planning_items (tenant_id, start_at)
  WHERE status = 'draft';

-- 4. Conflict check + workload: live items of a resource in a window ---------
--    (tenant_id, resource_id, start_at) exists already
--    (planning_items_tenant_resource_start_idx, 20260925_planning_audit).
