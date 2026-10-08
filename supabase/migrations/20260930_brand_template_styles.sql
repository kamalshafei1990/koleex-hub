-- ---------------------------------------------------------------------------
-- Brand Center — the status of each template style (owner, 30/09/2026: many
-- styles must not blur the brand; staff see only what the owner approved).
--
-- One row = one style of one template (e.g. business-card / p-monolith):
--   approved  offered to everyone — the brand's official look
--   draft     seen only by those who manage Brand Center (to try, decide)
--   retired   hidden from everyone's choice, never deleted
-- No row = approved (the styles that shipped before this table stay in use
-- until the owner decides).
--
-- Access is server-only like every brand_* table: RLS on, no policies; all
-- reads and writes go through /api/brand-center/styles with the service role.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS brand_template_styles (
  tenant_id    uuid NOT NULL,
  template_id  text NOT NULL,
  style        text NOT NULL,
  status       text NOT NULL CHECK (status IN ('approved', 'draft', 'retired')),
  updated_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, template_id, style)
);

ALTER TABLE brand_template_styles ENABLE ROW LEVEL SECURITY;
