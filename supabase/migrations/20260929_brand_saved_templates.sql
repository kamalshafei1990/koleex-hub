-- ---------------------------------------------------------------------------
-- Brand Center — saved templates ("my templates", owner 29/09/2026: "save a
-- style I did as my templates").
--
-- One row = one saved fill of a Brand Center template (e.g. the business
-- card): its style, typeface, lines, QR codes and switches, under a name the
-- person chose. Pictures are never stored here (portraits, QR pictures stay
-- in the browser); a person's own details only when they chose to keep them.
--
--   account_id  whose it is — "my templates" are a person's own
--   shared      true = offered to everyone in the company as a ready
--               template (needs the Brand Center "create" right)
--
-- Access is server-only like every brand_* table: RLS on, no policies; all
-- reads and writes go through /api/brand-center/saved with the service role.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS brand_saved_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  account_id   uuid NOT NULL,
  template_id  text NOT NULL,
  name         text NOT NULL,
  fill         jsonb NOT NULL DEFAULT '{}'::jsonb,
  shared       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brand_saved_templates_owner_idx ON brand_saved_templates (tenant_id, template_id, account_id);
CREATE INDEX IF NOT EXISTS brand_saved_templates_shared_idx ON brand_saved_templates (tenant_id, template_id) WHERE shared;

ALTER TABLE brand_saved_templates ENABLE ROW LEVEL SECURITY;
