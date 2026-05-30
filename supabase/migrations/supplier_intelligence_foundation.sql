-- =====================================================================
-- KOLEEX SUPPLIER INTELLIGENCE — FOUNDATION (additive, idempotent)
-- Applied to project yxyizbnfjrwrnmwhkvme via Supabase migration
-- "supplier_intelligence_foundation". Identity: a supplier = contacts row
-- (contact_type='supplier'). Legacy suppliers/product_suppliers/
-- supplier_assets are intentionally NOT touched (different identity space).
-- This file is the repo-of-record copy of the applied DDL.
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE visibility_tier AS ENUM ('public','internal','procurement','finance','management');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.intel_visibility_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  entity text NOT NULL, field_key text NOT NULL,
  min_tier visibility_tier NOT NULL,
  surface_block text[] NOT NULL DEFAULT '{}', notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_intel_vis_registry ON public.intel_visibility_registry
  (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid), entity, field_key);
CREATE INDEX IF NOT EXISTS ix_intel_vis_registry_tenant ON public.intel_visibility_registry (tenant_id);

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS strategic_status text,
  ADD COLUMN IF NOT EXISTS strategic_status_since timestamptz,
  ADD COLUMN IF NOT EXISTS strategic_status_reason text,
  ADD COLUMN IF NOT EXISTS blacklist_reason text,
  ADD COLUMN IF NOT EXISTS supports_oem_branding boolean,
  ADD COLUMN IF NOT EXISTS supports_packaging_customization boolean,
  ADD COLUMN IF NOT EXISTS supports_spare_parts boolean,
  ADD COLUMN IF NOT EXISTS supports_samples boolean,
  ADD COLUMN IF NOT EXISTS sample_turnaround_days smallint,
  ADD COLUMN IF NOT EXISTS wecom_support_available boolean,
  ADD COLUMN IF NOT EXISTS wechat_sales_group_available boolean,
  ADD COLUMN IF NOT EXISTS wechat_official_account text;
DO $$ BEGIN
  ALTER TABLE public.contacts ADD CONSTRAINT chk_contacts_strategic_status
    CHECK (strategic_status IS NULL OR strategic_status IN
      ('strategic','preferred','approved','trial','inactive','blocked','blacklisted')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS ix_contacts_strategic_status
  ON public.contacts (tenant_id, strategic_status) WHERE contact_type = 'supplier';

-- NOTE: full table DDL (supplier_classifications, supplier_status_history,
-- supplier_risk_profile [RLS], supplier_negotiation_intel [RLS],
-- supplier_product_specializations, supplier_contact_persons (+channels),
-- supplier_digital_presence, supplier_qr_codes, supplier_product_links,
-- supplier_media, supplier_readiness_snapshots) was applied via the
-- Supabase migration of the same name; see Supabase migration history for
-- the authoritative, full statement. All tables are tenant_id + supplier_id
-- (-> contacts.id ON DELETE CASCADE) scoped, indexed, additive & idempotent.
