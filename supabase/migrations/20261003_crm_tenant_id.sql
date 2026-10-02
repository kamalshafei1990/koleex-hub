-- ---------------------------------------------------------------------------
-- 20261003_crm_tenant_id — add the missing tenant_id column to the CRM tables.
--
-- The API layer (`src/app/api/crm/opportunities/route.ts`) already filters
-- `.eq("tenant_id", auth.tenant_id)` and writes `tenant_id` on insert, but
-- the original `create_crm_pipeline.sql` never created the column. This is the
-- additive backfill that closes the drift (idempotent — safe to re-run).
--
-- NOTE: backfill existing NULL rows against production data before relying on
-- the column for isolation. New rows are stamped by the API from here on.
-- ---------------------------------------------------------------------------

ALTER TABLE crm_stages         ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE crm_opportunities  ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE crm_activities     ADD COLUMN IF NOT EXISTS tenant_id uuid;

CREATE INDEX IF NOT EXISTS crm_stages_tenant_idx        ON crm_stages (tenant_id);
CREATE INDEX IF NOT EXISTS crm_opportunities_tenant_idx ON crm_opportunities (tenant_id);
CREATE INDEX IF NOT EXISTS crm_activities_tenant_idx    ON crm_activities (tenant_id);
