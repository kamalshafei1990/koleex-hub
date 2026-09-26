-- ---------------------------------------------------------------------------
-- Planning audit (2026-09-25)
--
-- 1. Query indexes for the Planning board, the "mine"/resource lookups and
--    the entity strips (linked_entity_type + linked_entity_id).
-- 2. project_time_entries.planning_item_id — completing a planning item
--    linked from a project task now writes ONE time entry keyed by the item
--    (unique where not null) instead of adding onto project_tasks.logged_hours,
--    which Projects' time routes overwrite with sum(time entries).
-- 3. One employee resource per (tenant, account). Created ONLY when no
--    duplicates exist today — otherwise a NOTICE is raised and the index is
--    skipped so the migration never fails. Lead: check the NOTICE; to find
--    the duplicates run the SELECT at the bottom, re-point planning_items
--    .resource_id to the kept row, delete the extras, then re-run this file.
--
-- Every statement is idempotent (IF NOT EXISTS).
-- ---------------------------------------------------------------------------

-- 1. Indexes -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS planning_items_tenant_start_idx
  ON public.planning_items (tenant_id, start_at);

CREATE INDEX IF NOT EXISTS planning_items_tenant_resource_start_idx
  ON public.planning_items (tenant_id, resource_id, start_at);

CREATE INDEX IF NOT EXISTS planning_items_tenant_linked_idx
  ON public.planning_items (tenant_id, linked_entity_type, linked_entity_id);

-- 2. Planning → Projects time entries ----------------------------------------
ALTER TABLE public.project_time_entries
  ADD COLUMN IF NOT EXISTS planning_item_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS project_time_entries_planning_item_uniq
  ON public.project_time_entries (planning_item_id)
  WHERE planning_item_id IS NOT NULL;

-- 3. One employee resource per account ---------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.planning_resources
    WHERE type = 'employee' AND account_id IS NOT NULL
    GROUP BY tenant_id, account_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS planning_resources_tenant_account_employee_uniq
      ON public.planning_resources (tenant_id, account_id)
      WHERE type = 'employee' AND account_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'planning_resources has duplicate employee rows per (tenant_id, account_id); unique index NOT created — dedupe first.';
  END IF;
END $$;

-- Duplicate finder (read-only, for the lead):
-- SELECT tenant_id, account_id, array_agg(id ORDER BY created_at) AS ids
-- FROM public.planning_resources
-- WHERE type = 'employee' AND account_id IS NOT NULL
-- GROUP BY tenant_id, account_id
-- HAVING count(*) > 1;
